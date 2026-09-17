"""SQL contract tests are not PostgreSQL runtime evidence."""
from pathlib import Path
import importlib.util
import os
import pytest

ROOT=Path(__file__).resolve().parents[2]

def migration():
    spec=importlib.util.spec_from_file_location('e04migration',ROOT/'migrations/versions/0014_dag_queue.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def test_migration_additive_existing_owner_and_rollback(monkeypatch):
    m=migration();statements=[];monkeypatch.setattr(m.op,'execute',lambda sql:statements.append(str(sql)))
    m.upgrade();sql='\n'.join(statements)
    for marker in ('ALTER TABLE durable_queue_jobs','CREATE OR REPLACE FUNCTION anvil_queue_claim_next','CURRENT_TIMESTAMP','FOR UPDATE SKIP LOCKED','dependency_ids','conflict_keys','completed_token_hash'):
        assert marker in sql
    assert 'CREATE TABLE' not in sql
    statements.clear();m.downgrade();assert 'DROP COLUMN' in '\n'.join(statements)

def test_postgres_adapter_does_not_accept_worker_clock():
    import inspect
    from packages.persistence.dag_queue_repository import PostgresDagQueue
    assert 'now' not in inspect.signature(PostgresDagQueue.claim).parameters

def test_claim_keeps_b09_skip_locked_nonblocking_and_scopes_conflict_lock():
    sql=migration().CLAIM_SQL
    assert 'pg_try_advisory_xact_lock' in sql
    assert 'FOREACH conflict_key IN ARRAY candidate.conflict_keys' in sql
    assert 'PERFORM pg_advisory_xact_lock(17004001)' not in sql

def test_claim_locks_one_candidate_without_query_cursor_prefetch():
    sql=migration().CLAIM_SQL
    assert 'FOR candidate IN' not in sql, 'query-FOR may prefetch and lock independent legacy rows'
    assert 'SELECT q.* INTO candidate' in sql
    assert 'FOR UPDATE SKIP LOCKED LIMIT 1' in sql
    assert 'NOT (q.job_id=ANY(attempted_ids))' in sql
    assert 'attempted_ids=array_append(attempted_ids,candidate.job_id)' in sql
    assert 'IF NOT FOUND THEN RETURN claimed; END IF' in sql


@pytest.mark.skipif(not os.environ.get('ANVIL_TEST_DATABASE_URL'),reason='E04_REAL_POSTGRES_NOT_EXECUTED: isolated PostgreSQL DSN unavailable')
def test_real_postgres_cursor_prefetch_minimal_behavior_probe():
    """Two connections distinguish implicit query-FOR prefetch from bounded selection.

    This creates only synthetic objects inside the existing scratch DB harness.
    It is real DB behavior evidence only when actually run, not a mock simulator.
    """
    import runpy
    from sqlalchemy import create_engine,text
    harness=runpy.run_path(str(ROOT/'tests/verification/test_c01_l3_independent_acceptance.py'))
    with harness['_scratch_database']() as dsn:
        engine=create_engine(dsn)
        try:
            with engine.begin() as c:
                c.execute(text('CREATE TABLE e04_cursor_lock_probe(id integer PRIMARY KEY)'))
                c.execute(text('INSERT INTO e04_cursor_lock_probe VALUES (1),(2)'))
                c.execute(text('''CREATE FUNCTION e04_cursor_lock_probe_claim(bounded boolean) RETURNS integer AS $$
                DECLARE candidate integer;
                BEGIN
                  IF bounded THEN
                    SELECT id INTO candidate FROM e04_cursor_lock_probe ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1;
                    RETURN candidate;
                  ELSE
                    FOR candidate IN SELECT id FROM e04_cursor_lock_probe ORDER BY id FOR UPDATE SKIP LOCKED LOOP
                      RETURN candidate;
                    END LOOP;
                  END IF;
                  RETURN NULL;
                END; $$ LANGUAGE plpgsql;'''))
            for bounded,expected_remaining in ((False,[]),(True,[2])):
                with engine.connect() as first:
                    transaction=first.begin()
                    try:
                        assert first.execute(text('SELECT e04_cursor_lock_probe_claim(:b)'),{'b':bounded}).scalar_one()==1
                        with engine.begin() as second:
                            second.execute(text("SET LOCAL statement_timeout='3s'"))
                            remaining=list(second.execute(text('SELECT id FROM e04_cursor_lock_probe ORDER BY id FOR UPDATE SKIP LOCKED')).scalars())
                            assert remaining==expected_remaining, {'bounded':bounded,'remaining':remaining}
                    finally:transaction.rollback()
        finally:engine.dispose()

def test_adapter_transaction_failure_has_no_partial_registration():
    from contextlib import contextmanager
    from copy import deepcopy
    from packages.persistence.dag_queue_repository import PostgresDagQueue
    from tests.queue.test_dag_e04 import graph,node,HASH
    class Result:
        def mappings(self):return self
        def all(self):return []
    class Engine:
        def __init__(self):self.rows=[];self.fail=True;self.rollbacks=0
        @contextmanager
        def begin(self):
            before=deepcopy(self.rows)
            try:yield self
            except Exception:self.rows=before;self.rollbacks+=1;raise
        def execute(self,sql,params=None):
            if str(sql).startswith('INSERT'):
                self.rows.append(params)
                if self.fail and len(self.rows)==2:raise RuntimeError('INJECTED_WRITE_FAILURE')
            return Result()
    engine=Engine();q=PostgresDagQueue(engine);g=graph([node('a'),node('b')])
    with pytest.raises(RuntimeError,match='INJECTED_WRITE_FAILURE'):q.register(g,verified_inputs={'a':HASH,'b':HASH})
    assert engine.rows==[] and engine.rollbacks==1
    engine.fail=False;q.register(g,verified_inputs={'a':HASH,'b':HASH})
    assert len(engine.rows)==2

def test_migration_downgrade_preserves_old_owner_function_definitions(monkeypatch):
    m=migration();statements=[];monkeypatch.setattr(m.op,'execute',lambda sql:statements.append(str(sql)));m.downgrade()
    assert sum('CREATE OR REPLACE FUNCTION anvil_queue_claim_next' in s for s in statements)==1
    assert sum('CREATE OR REPLACE FUNCTION anvil_queue_complete' in s for s in statements)==1
    assert 'E04_DAG_ROWS_REQUIRE_EXPLICIT_ROLLBACK' in statements[0]


def test_downgrade_fences_before_precheck_in_registration_lock_order(monkeypatch):
    m=migration();statements=[];monkeypatch.setattr(m.op,'execute',lambda sql:statements.append(str(sql)))
    m.downgrade();sql='\n'.join(statements)
    advisory=sql.index('pg_advisory_xact_lock(17004001)')
    table=sql.index('LOCK TABLE durable_queue_jobs IN ACCESS EXCLUSIVE MODE')
    check=sql.index('IF EXISTS(SELECT 1 FROM durable_queue_jobs WHERE graph_id IS NOT NULL)')
    drop=sql.index('DROP COLUMN graph_id')
    assert advisory < table < check < drop
    assert 'COMMIT' not in sql and 'ROLLBACK;' not in sql


@pytest.mark.skipif(not os.environ.get('ANVIL_TEST_DATABASE_URL'),reason='E04_REAL_POSTGRES_NOT_EXECUTED: isolated PostgreSQL DSN unavailable')
@pytest.mark.parametrize('ordering',['register-first','downgrade-first-register','downgrade-first-direct-sql'])
def test_real_postgres_downgrade_live_dag_race(ordering,monkeypatch):
    """Use real locks and two competing transactions; never infer locking from timing alone."""
    import runpy,time
    from contextlib import contextmanager
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from sqlalchemy import create_engine,text
    from packages.persistence.dag_queue_repository import PostgresDagQueue
    from packages.queue.dag import DagNode,TaskGraph
    from uuid import uuid4
    m=migration();statements=[];monkeypatch.setattr(m.op,'execute',lambda sql:statements.append(str(sql)));m.downgrade()
    harness=runpy.run_path(str(ROOT/'tests/verification/test_c01_l3_independent_acceptance.py'))
    with harness['_scratch_database']() as dsn:
        engine=create_engine(dsn);suffix=uuid4().hex;run='race-'+suffix;task='task-'+suffix;h='sha256:'+'a'*64
        g=TaskGraph('race-graph-'+suffix,run,'repo',(DagNode('a',(),(),True,h),))
        # Adapter consumes the test-owned ambient transaction without ending it.
        class BoundEngine:
            def __init__(self,connection):self.connection=connection
            @contextmanager
            def begin(self):yield self.connection
        def register(connection):
            PostgresDagQueue(BoundEngine(connection)).register(g,verified_inputs={'a':h})
        def wait_for_lock(observer,pid,future):
            deadline=time.monotonic()+5
            while time.monotonic()<deadline:
                if observer.execute(text('SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=:pid AND NOT granted)'),{'pid':pid}).scalar_one():return
                if future.done():break
                time.sleep(0.01)
            pytest.fail('competing transaction did not block on a real PostgreSQL lock')
        try:
            with engine.begin() as c:
                c.execute(text("INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) VALUES (:t,'p','r','e04','e04','host','DRAFT')"),{'t':task})
                c.execute(text("INSERT INTO runs(run_id,task_id,baseline_id,phase,status) VALUES (:r,:t,'b','DRAFT','ACTIVE')"),{'r':run,'t':task})
            with ThreadPoolExecutor(max_workers=1) as pool, engine.connect() as primary, engine.connect() as observer:
                transaction=primary.begin();ready=Event();worker_pid=[]
                def concurrent():
                    try:
                        with engine.begin() as c:
                            c.execute(text("SET LOCAL statement_timeout='8s'"))
                            worker_pid.append(c.execute(text('SELECT pg_backend_pid()')).scalar_one());ready.set()
                            if ordering=='register-first':
                                for statement in statements:c.execute(text(statement))
                            elif ordering=='downgrade-first-register':register(c)
                            else:
                                c.execute(text("INSERT INTO durable_queue_jobs(job_id,run_id,payload,max_attempts,available_at,graph_id,graph_hash) VALUES (:j,:r,'direct',2,CURRENT_TIMESTAMP,:g,:h)"),{'j':'direct-'+suffix,'r':run,'g':g.graph_id,'h':g.content_hash})
                        return 'COMMITTED'
                    except Exception as exc:
                        return (getattr(getattr(exc,'orig',None),'sqlstate',None),str(exc))
                try:
                    if ordering=='register-first':register(primary)
                    else:primary.execute(text(statements[0]))
                    future=pool.submit(concurrent);assert ready.wait(5)
                    wait_for_lock(observer,worker_pid[0],future)
                    if ordering!='register-first':
                        for statement in statements[1:]:primary.execute(text(statement))
                    transaction.commit()
                    result=future.result(timeout=10)
                finally:
                    if transaction.is_active:transaction.rollback()
                assert result!='COMMITTED'
                if ordering=='register-first':assert 'E04_DAG_ROWS_REQUIRE_EXPLICIT_ROLLBACK' in result[1]
                else:assert result[0]=='42703', result  # explicit undefined-column rejection, not authority loss
            with engine.connect() as c:
                columns=c.execute(text("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='durable_queue_jobs' AND column_name='graph_id'")).scalar_one()
                rows=c.execute(text('SELECT count(*) FROM durable_queue_jobs')).scalar_one()
                assert (columns,rows)==((1,1) if ordering=='register-first' else (0,0))
        finally:engine.dispose()

@pytest.mark.skipif(not os.environ.get('ANVIL_TEST_DATABASE_URL'),reason='E04_REAL_POSTGRES_NOT_EXECUTED: isolated PostgreSQL DSN unavailable')
def test_real_postgres_atomic_dependency_visibility_quarantine():
    import runpy
    from sqlalchemy import create_engine,text
    from concurrent.futures import ThreadPoolExecutor
    from packages.persistence.dag_queue_repository import PostgresDagQueue
    from packages.queue.dag import DagNode,TaskGraph
    from uuid import uuid4
    harness=runpy.run_path(str(ROOT/'tests/verification/test_c01_l3_independent_acceptance.py'))
    with harness['_scratch_database']() as dsn:
        engine=create_engine(dsn);suffix=uuid4().hex;run='e04-'+suffix;task='task-'+suffix
        with engine.begin() as c:
            c.execute(text("INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) VALUES (:t,'p','r','e04','e04','host','DRAFT')"),{'t':task})
            c.execute(text("INSERT INTO runs(run_id,task_id,baseline_id,phase,status) VALUES (:r,:t,'b','DRAFT','ACTIVE')"),{'r':run,'t':task})
        h='sha256:'+'a'*64;g=TaskGraph('g-'+suffix,run,'repo',(DagNode('a',(),(),True,h),DagNode('b',('a',),(),True,h)))
        q=PostgresDagQueue(engine);q.register(g,verified_inputs={'a':h,'b':h},max_attempts=2)
        with ThreadPoolExecutor(max_workers=2) as pool:claims=list(pool.map(lambda w:q.claim(w,visibility_seconds=5),['one','two']))
        assert sum(x is not None for x in claims)==1
        first=next(x for x in claims if x);assert q.claim('three',visibility_seconds=5) is None
        with engine.begin() as c:c.execute(text("UPDATE durable_queue_jobs SET lease_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE job_id=:j"),{'j':first.job_id})
        second=q.claim('four',visibility_seconds=5);assert second.lease_epoch==first.lease_epoch+1
        with pytest.raises(Exception):q.complete(first)
        q.complete(second);q.complete(second)
        child=q.claim('five',visibility_seconds=5);assert child is not None
        q.fail(child,reason='POISON');child=q.claim('six',visibility_seconds=5);q.fail(child,reason='POISON')
        assert q.project(g.graph_id)['nodes'][1]['status']=='QUARANTINED'
        # Legacy B09 claim must skip an uncommitted locked row, not wait on a global lock.
        with engine.begin() as c:
            for name in ('legacy-a','legacy-b'):
                c.execute(text("INSERT INTO durable_queue_jobs(job_id,run_id,payload,max_attempts,available_at) VALUES (:j,:r,'legacy',2,CURRENT_TIMESTAMP)"),{'j':name+suffix,'r':run})
        with engine.connect() as first_connection:
            transaction=first_connection.begin()
            row=first_connection.execute(text("SELECT * FROM anvil_queue_claim_next('first-legacy',5)")).mappings().one()
            with engine.begin() as second_connection:
                second_connection.execute(text("SET LOCAL statement_timeout='3s'"))
                other=second_connection.execute(text("SELECT * FROM anvil_queue_claim_next('second-legacy',5)")).mappings().one()
                assert other['job_id'] and row['job_id']!=other['job_id']
            transaction.commit()
        from packages.queue.models import QueueClaim
        for r in (row,other):q.complete(QueueClaim(r['job_id'],r['claimed_by_worker_id'],r['lease_epoch'],r['execution_fencing_token'],r['lease_expires_at']))
        # Group exclusion is a DB reservation property, including another graph.
        for name in ('left','right'):
            independent=TaskGraph(name+suffix,run,'repo',(DagNode(name,(),('LOCKFILE',),True,h),))
            q.register(independent,verified_inputs={name:h})
        # A conflict reservation race must not starve the next independent row.
        independent=TaskGraph('free'+suffix,run,'repo',(DagNode('free',(),(),True,h),))
        q.register(independent,verified_inputs={'free':h})
        from packages.queue.dag import graph_job_id
        with engine.connect() as lock_owner:
            transaction=lock_owner.begin()
            try:
                lock_owner.execute(text("SELECT pg_advisory_xact_lock(hashtextextended('anvil-queue-conflict:repo:group:lockfile',0))"))
                available=q.claim('independent-after-conflict',visibility_seconds=5)
                assert available and available.job_id==graph_job_id(independent,'free')
                q.complete(available)
            finally:transaction.rollback()
        grouped=q.claim('grouped',visibility_seconds=5)
        assert grouped and q.claim('blocked',visibility_seconds=5) is None
        with engine.connect() as c:
            now=c.execute(text('SELECT CURRENT_TIMESTAMP')).scalar_one()
            assert 0 < (grouped.lease_expires_at-now).total_seconds() <= 5
        q.complete(grouped);assert q.claim('after-completion',visibility_seconds=5) is not None
        engine.dispose()
