from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import json
import os
from uuid import uuid4
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from packages.execution.run_creation import AuthorityMismatch, RunCreationCommand
from packages.persistence.run_creation_repository import SqlAlchemyRunCreationRepository

DSN=os.environ.get("ANVIL_TEST_DATABASE_URL")
pytestmark=pytest.mark.skipif(not DSN,reason="isolated PostgreSQL DSN required")
H=lambda char: "sha256:"+char*64


def _suffix(label):
    return f"{label}-{uuid4().hex}"

def _seed(engine,suffix,baseline_project="project-1"):
    ids={"task":f"task-{suffix}","spec":f"spec-{suffix}","db":f"db-{suffix}","wp":f"wp-{suffix}","ip":f"ip-{suffix}","wi":f"wi-{suffix}","plan":f"plan-{suffix}"}
    now=datetime.now(timezone.utc)
    with engine.begin() as c:
        c.execute(text("INSERT INTO design_artifacts (artifact_id,revision,content_hash,actor_type,actor_id,artifact_type,source_refs) VALUES (:id,1,:hash,'AGENT','eoul','DESIGN_SPECIFICATION',CAST('[]' AS json))"),{"id":ids["spec"],"hash":H("9")})
        c.execute(text("INSERT INTO design_baselines (artifact_id,revision,content_hash,actor_type,actor_id,specification_id,root_human_approval_id,approval_mode,scope,project_id) VALUES (:id,1,:hash,'HUMAN','owner',:spec,:approval,'HUMAN_APPROVED',CAST('{}' AS json),:project)"),{"id":ids["db"],"hash":H("a"),"spec":ids["spec"],"approval":f"approval-spec-{suffix}","project":baseline_project})
        c.execute(text("INSERT INTO work_plans (artifact_id,revision,content_hash,design_baseline_id,design_baseline_hash,scope) VALUES (:id,1,:hash,:db,:dbh,CAST('{}' AS json))"),{"id":ids["wp"],"hash":H("b"),"db":ids["db"],"dbh":H("a")})
        c.execute(text("INSERT INTO iteration_plans (artifact_id,revision,content_hash,work_plan_id,work_plan_hash,sequence) VALUES (:id,1,:hash,:wp,:wph,1)"),{"id":ids["ip"],"hash":H("c"),"wp":ids["wp"],"wph":H("b")})
        c.execute(text("INSERT INTO work_instructions (artifact_id,revision,content_hash,iteration_plan_id,iteration_plan_hash,allowed_paths,allowed_actions,completion_conditions) VALUES (:id,1,:hash,:ip,:iph,CAST('[]' AS json),CAST('[]' AS json),CAST('[]' AS json))"),{"id":ids["wi"],"hash":H("d"),"ip":ids["ip"],"iph":H("c")})
        c.execute(text("INSERT INTO execution_plans (plan_id,plan_hash,source_work_instruction_id,source_work_instruction_hash,baseline_analysis_hash,impact_analysis_hash,status) VALUES (:id,:hash,:wi,:wih,:bah,:iah,'APPROVED')"),{"id":ids["plan"],"hash":H("e"),"wi":ids["wi"],"wih":H("d"),"bah":H("f"),"iah":H("1")})
        for kind,key,hash_value in (("DESIGN_SPECIFICATION","spec",H("9")),("WORK_PLAN","wp",H("b")),("WORK_INSTRUCTION","wi",H("d")),("EXECUTION_PLAN","plan",H("e"))):
            c.execute(text("INSERT INTO approval_records (approval_id,approval_type,subject_id,subject_hash,approved_by,authenticated_human,approved_at,expires_at,status) VALUES (:approval,:kind,:subject,:hash,'owner',true,:now,:expires,'ACTIVE')"),{"approval":f"approval-{key}-{suffix}","kind":kind,"subject":ids[key],"hash":hash_value,"now":now,"expires":now+timedelta(hours=1)})
        c.execute(text("INSERT INTO tasks (task_id,project_id,repository_id,title,objective,requested_by,status,version) VALUES (:id,'project-1','repo-1','title','objective','owner','CONFIRMED',3)"),{"id":ids["task"]})
    return ids

def _command(ids,key="create-1",expected=3,prior=None,checkpoint=None):
    return RunCreationCommand(None,ids["task"],ids["wi"],ids["plan"],expected,"project-1","env-1",H("8"),prior,checkpoint,"operator","request",key,H("e"),"approved test run")


def _bindings(**overrides):
    values={
        "design_specification":H("9"),
        "design_baseline":H("a"),
        "work_plan":H("b"),
        "work_instruction":H("d"),
        "execution_plan":H("e"),
        "permission_snapshot":H("8"),
    }
    values.update(overrides)
    return values


def _checkpoint(engine,ids,run_id,suffix,*,bindings=None,completed_step=False,verified_evidence=False,pending_writes=None,evidence_project="project-1"):
    checkpoint_id=f"checkpoint-{suffix}"
    state_id=f"state-{suffix}"
    now=datetime.now(timezone.utc)
    with engine.begin() as c:
        c.execute(text("INSERT INTO artifacts (artifact_id,artifact_type,content_hash,byte_size,media_type,storage_ref,project_id,run_id,step_id,actor_id,created_at,source_artifact_ids) VALUES (:id,'CHECKPOINT_STATE',:hash,1,'application/json',:ref,'project-1',:run,NULL,'operator',:now,CAST('[]' AS json))"),{"id":state_id,"hash":H("2"),"ref":"sha256/22/"+"2"*64,"run":run_id,"now":now})
        if completed_step:
            step_id=f"step-{suffix}"; attempt_id=f"attempt-{suffix}"; result_id=f"result-{suffix}"
            c.execute(text("INSERT INTO plan_steps (step_id,run_id,step_lineage_id,sequence) VALUES (:step,:run,:lineage,1)"),{"step":step_id,"run":run_id,"lineage":f"lineage-{suffix}"})
            c.execute(text("INSERT INTO step_attempts (attempt_id,plan_step_id,attempt_number,executor_kind,target_hash,takeover_reference) VALUES (:attempt,:step,1,'MAIN_TAKEOVER',:hash,'takeover-1')"),{"attempt":attempt_id,"step":step_id,"hash":H("7")})
            c.execute(text("INSERT INTO results (result_id,step_attempt_id,status,target_hash,delivered_hash,actor_id,event_sequence) VALUES (:result,:attempt,'COMPLETED',:hash,:hash,'operator',:event_sequence)"),{"result":result_id,"attempt":attempt_id,"hash":H("7"),"event_sequence":int(uuid4().hex[:12],16)})
            if verified_evidence:
                c.execute(text("INSERT INTO artifacts (artifact_id,artifact_type,content_hash,byte_size,media_type,storage_ref,project_id,run_id,step_id,actor_id,created_at,source_artifact_ids) VALUES (:id,'CHANGE',:hash,1,'application/octet-stream',:ref,'project-1',:run,:step,'operator',:now,CAST('[]' AS json))"),{"id":f"change-{suffix}","hash":H("7"),"ref":"sha256/77/"+"7"*64,"run":run_id,"step":step_id,"now":now})
                c.execute(text("INSERT INTO evidence_manifests (manifest_id,manifest_path,design_baseline_hash,work_plan_hash,work_instruction_hash,git_head,git_status_before_ref,git_status_after_ref,target_hash,delivered_artifact_hash,container_image_digest,db_migration_head,config_revision_hash,policy_hash,provider_routing_snapshot_hash,environment_id,toolchain_versions,commands,started_at,finished_at,actor_id,actor_role,acquisition_mode,skipped_or_blocked,unverified_scope,run_id,step_id,project_id,execution_plan_id,execution_plan_hash,permission_snapshot_hash) VALUES (:id,:path,:dbh,:wph,:wih,'abcdef','before','after',:target,:target,:image,'0012_run_authority',:config,:policy,:provider,'env-1',CAST('{}' AS json),CAST('[]' AS json),:now,:now,'operator','operator','real',CAST('[]' AS json),CAST('[]' AS json),:run,:step,:project,:plan,:plan_hash,:permission_hash)"),{"id":f"manifest-{suffix}","path":f"evidence/{suffix}.json","dbh":H("a"),"wph":H("b"),"wih":H("d"),"target":H("7"),"image":H("3"),"config":H("4"),"policy":H("5"),"provider":H("6"),"now":now,"run":run_id,"step":step_id,"project":evidence_project,"plan":ids["plan"],"plan_hash":H("e"),"permission_hash":H("8")})
                c.execute(text("INSERT INTO evidence_raw_artifacts (manifest_id,path,byte_size,content_hash,target_hash,environment_id) VALUES (:id,:path,1,:content,:target,'env-1')"),{"id":f"manifest-{suffix}","path":f"evidence/{suffix}.raw","content":H("6"),"target":H("7")})
        c.execute(text("INSERT INTO checkpoints (checkpoint_id,run_id,thread_id,graph_version,state_schema_version,source_event_sequence,next_nodes,pending_writes,state_artifact_id,state_artifact_hash,binding_hashes,actor_id,created_at) VALUES (:id,:run,'thread-1','graph-1',1,1,CAST('[]' AS json),CAST(:pending_writes AS json),:state,:state_hash,CAST(:bindings AS json),'operator',:now)"),{"id":checkpoint_id,"run":run_id,"state":state_id,"state_hash":H("2"),"pending_writes":json.dumps(pending_writes or [],sort_keys=True,separators=(",",":")),"bindings":json.dumps(bindings or _bindings(),sort_keys=True,separators=(",",":")),"now":now})
        c.execute(text("UPDATE runs SET status='FAILED' WHERE run_id=:run"),{"run":run_id})
        c.execute(text("UPDATE tasks SET status='CONFIRMED' WHERE task_id=:task"),{"task":ids["task"]})
    return checkpoint_id

def test_postgres_atomic_creation_and_idempotent_replay():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("normal"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    first=repo.create(_command(ids)); replay=repo.create(_command(ids))
    assert first.duplicate is False and replay.duplicate is True and replay.run_id==first.run_id
    with engine.connect() as c:
        rows=c.execute(text("SELECT event_id,event_type,sequence_no FROM run_events WHERE run_id=:run ORDER BY sequence_no"),{"run":first.run_id}).mappings().all()
        task=c.execute(text("SELECT status,version FROM tasks WHERE task_id=:task"),{"task":ids["task"]}).mappings().one()
    assert [r["event_type"] for r in rows]==["TASK_CONFIRMED"]
    assert [r["sequence_no"] for r in rows]==[1]
    assert task=={"status":"IN_PROGRESS","version":4}
    engine.dispose()

def test_postgres_task_confirmed_event_failure_rolls_back_everything():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("rollback"))
    with engine.begin() as c:
        c.execute(text("CREATE FUNCTION reject_analysis_r2() RETURNS trigger AS $$ BEGIN IF NEW.event_type='TASK_CONFIRMED' THEN RAISE EXCEPTION 'reject analysis'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql"))
        c.execute(text("CREATE TRIGGER reject_analysis_r2 BEFORE INSERT ON run_events FOR EACH ROW EXECUTE FUNCTION reject_analysis_r2()"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    with pytest.raises(Exception,match="reject analysis"):
        repo.create(_command(ids))
    with engine.begin() as c:
        assert c.execute(text("SELECT count(*) FROM runs WHERE task_id=:task"),{"task":ids["task"]}).scalar_one()==0
        assert c.execute(text("SELECT status,version FROM tasks WHERE task_id=:task"),{"task":ids["task"]}).one()==("CONFIRMED",3)
        c.execute(text("DROP TRIGGER reject_analysis_r2 ON run_events")); c.execute(text("DROP FUNCTION reject_analysis_r2()"))
    engine.dispose()

def test_postgres_concurrent_same_idempotency_creates_one_run():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("concurrent"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    with ThreadPoolExecutor(max_workers=2) as pool:
        receipts=list(pool.map(lambda _: repo.create(_command(ids,"same-key")),range(2)))
    assert len({r.run_id for r in receipts})==1
    assert sorted(r.duplicate for r in receipts)==[False,True]
    with engine.connect() as c: assert c.execute(text("SELECT count(*) FROM runs WHERE task_id=:task"),{"task":ids["task"]}).scalar_one()==1
    engine.dispose()


def test_postgres_idempotent_replay_rejects_noncanonical_first_event():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("wrong-first-event"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    first=repo.create(_command(ids))
    with engine.begin() as c:
        c.execute(text("ALTER TABLE run_events DISABLE TRIGGER USER"))
        c.execute(
            text("UPDATE run_events SET event_type='RUN_CREATED' WHERE run_id=:run AND sequence_no=1"),
            {"run": first.run_id},
        )
        c.execute(text("ALTER TABLE run_events ENABLE TRIGGER USER"))
    with pytest.raises(AuthorityMismatch, match="incomplete"):
        repo.create(_command(ids))
    engine.dispose()


def test_postgres_idempotent_replay_returns_original_creation_receipt_after_run_progresses():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("progressed-replay"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    first=repo.create(_command(ids))
    with engine.begin() as c:
        c.execute(
            text("UPDATE runs SET phase='EXECUTION_PLAN_REVIEW', status='WAITING_APPROVAL' WHERE run_id=:run"),
            {"run": first.run_id},
        )
    replay=repo.create(_command(ids))
    assert replay.duplicate is True
    assert replay.run_id==first.run_id
    assert replay.phase=="ANALYZING"
    assert replay.status=="ACTIVE"
    assert replay.event_ids==first.event_ids
    engine.dispose()


def test_postgres_wrong_approval_type_is_rejected():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("wrong-type"))
    with engine.begin() as c:
        c.execute(
            text("UPDATE approval_records SET approval_type='DEPLOY' WHERE subject_id=:subject"),
            {"subject": ids["wi"]},
        )
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    with pytest.raises(AuthorityMismatch, match="approval lineage"):
        repo.create(_command(ids))
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM runs WHERE task_id=:task"),{"task":ids["task"]}).scalar_one()==0
    engine.dispose()


def test_postgres_design_baseline_requires_its_exact_root_specification_approval():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("wrong-root"))
    with engine.begin() as c:
        c.execute(
            text("UPDATE design_baselines SET root_human_approval_id='approval-unrelated' WHERE artifact_id=:baseline"),
            {"baseline": ids["db"]},
        )
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    with pytest.raises(AuthorityMismatch, match="approval lineage"):
        repo.create(_command(ids))
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM runs WHERE task_id=:task"),{"task":ids["task"]}).scalar_one()==0
    engine.dispose()


def test_postgres_task_rejects_approved_artifact_chain_from_another_project():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("cross-project"),"project-2")
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    with pytest.raises(AuthorityMismatch, match="approval lineage"):
        repo.create(_command(ids))
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM runs WHERE task_id=:task"),{"task":ids["task"]}).scalar_one()==0
    engine.dispose()


def test_postgres_task_rejects_command_authorized_for_another_project():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("wrong-authorized-project"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    with pytest.raises(AuthorityMismatch, match="project scope"):
        repo.create(replace(_command(ids),project_id="project-2"))
    engine.dispose()


def test_postgres_continuation_rejects_checkpoint_from_another_task():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("cross-task"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    prior=repo.create(_command(ids)); checkpoint=_checkpoint(engine,ids,prior.run_id,_suffix("cross-task-checkpoint"))
    other=dict(ids); other["task"]=_suffix("other-task")
    with engine.begin() as c:
        c.execute(text("INSERT INTO tasks (task_id,project_id,repository_id,title,objective,requested_by,status,version) VALUES (:id,'project-1','repo-1','title','objective','owner','CONFIRMED',3)"),{"id":other["task"]})
    with pytest.raises(AuthorityMismatch,match="continuation lineage"):
        repo.create(_command(other,"resume-cross-task",3,prior.run_id,checkpoint))
    engine.dispose()


def test_postgres_continuation_rejects_stale_binding_hashes():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("stale-binding"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    prior=repo.create(_command(ids)); checkpoint=_checkpoint(engine,ids,prior.run_id,_suffix("stale-binding-checkpoint"),bindings=_bindings(work_instruction=H("0")))
    with pytest.raises(AuthorityMismatch,match="continuation lineage"):
        repo.create(_command(ids,"resume-stale",4,prior.run_id,checkpoint))
    engine.dispose()


def test_postgres_continuation_rejects_completed_step_without_artifact_evidence():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("missing-evidence"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    prior=repo.create(_command(ids)); checkpoint=_checkpoint(engine,ids,prior.run_id,_suffix("missing-evidence-checkpoint"),completed_step=True)
    with pytest.raises(AuthorityMismatch,match="continuation lineage"):
        repo.create(_command(ids,"resume-missing-evidence",4,prior.run_id,checkpoint))
    engine.dispose()


def test_postgres_continuation_rejects_unreconciled_pending_writes():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("pending-write"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    prior=repo.create(_command(ids)); checkpoint=_checkpoint(engine,ids,prior.run_id,_suffix("pending-write-checkpoint"),pending_writes=[{"operationId":"external-1"}])
    with pytest.raises(AuthorityMismatch,match="continuation lineage"):
        repo.create(_command(ids,"resume-pending-write",4,prior.run_id,checkpoint))
    engine.dispose()


def test_postgres_continuation_rejects_evidence_manifest_from_another_project():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("foreign-evidence"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    prior=repo.create(_command(ids)); checkpoint=_checkpoint(engine,ids,prior.run_id,_suffix("foreign-evidence-checkpoint"),completed_step=True,verified_evidence=True,evidence_project="project-2")
    with pytest.raises(AuthorityMismatch,match="continuation lineage"):
        repo.create(_command(ids,"resume-foreign-evidence",4,prior.run_id,checkpoint))
    engine.dispose()


def test_postgres_continuation_accepts_same_task_authority_and_verified_evidence():
    engine=create_engine(DSN,pool_pre_ping=True); ids=_seed(engine,_suffix("valid-resume"))
    repo=SqlAlchemyRunCreationRepository(sessionmaker(bind=engine,expire_on_commit=False))
    prior=repo.create(_command(ids)); checkpoint=_checkpoint(engine,ids,prior.run_id,_suffix("valid-resume-checkpoint"),completed_step=True,verified_evidence=True)
    resumed=repo.create(_command(ids,"resume-valid",4,prior.run_id,checkpoint))
    assert resumed.run_id != prior.run_id
    with engine.connect() as c:
        row=c.execute(text("SELECT prior_run_id,resume_checkpoint_id FROM runs WHERE run_id=:run"),{"run":resumed.run_id}).one()
    assert row==(prior.run_id,checkpoint)
    engine.dispose()
