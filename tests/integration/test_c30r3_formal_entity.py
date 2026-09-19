"""C30R3 Task4 local preflight. WSL/PG/browser/process restart NOT_EXECUTED.

An SSH-blocked run cannot attest formal acceptance. The local database below is
the existing isolated in-memory SQLite fixture, never PostgreSQL evidence.
"""
import ast
from pathlib import Path


def formal_seed(token, now):
    """Trusted QA fixture: real PENDING owners, no invented successful results."""
    from dataclasses import asdict, replace
    from datetime import timedelta
    import json
    from hashlib import sha256
    from packages.agent_team import role_contracts as r
    from packages.agent_team.models import TeamSession, TeamSessionState, TeamTask, TeamTaskStatus
    from packages.agent_team.orchestration import RoleTeamOrchestrator, TeamTaskBinding
    from packages.agent_team.role_results import RoleResultService
    from packages.agent_team.moa import MoADeliberation
    from packages.agent_team.collaboration import canonical_hash
    from packages.orchestration.delegation import PermissionSnapshot, DataEgressProfile, DelegationPacket
    from packages.agent_team.owner_component_restore import OwnerComponentBundle, export_owner_components
    from packages.persistence import agent_team_owner_repository as repo
    def digest(value):return 'sha256:'+sha256(value.encode()).hexdigest()
    target=digest('c30r3-disposable-qa-target')
    permission=PermissionSnapshot(('docs/**',),('read',),('repo_read',),('local',),(),('.git/**',),
        ('delete','merge','deploy','approve','bypass'))
    egress=DataEgressProfile('local_only',(),(),())
    budget=r.BudgetLimits(100,10000,100,3600)
    policy=r.RolePolicyService(session_id='c30r3-qa-session',baseline_hash=target,target_hash=target,
        implementation_actor='qa-coder',implementation_context='qa-code-context',implementation_workspace='qa-code-workspace',
        implementation_context_hash=digest('qa-code-context'),parent_permission=permission,parent_egress=egress,parent_budget=budget)
    definition=r.AgentDefinition.for_role('REVIEW',definition_id='qa-review',version=1,read_scope=('docs/**',),
        write_scope=(),prohibited_scope=(),permission_ceiling=permission,budget=r.BudgetLimits(20,2000,20,3600))
    packet=DelegationPacket('qa-delegation','qa-parent','main','qa-wi',1,'qa-task','qa-workspace',
        'read disposable QA owner',('docs',),('production',),permission.allowed_paths,permission.prohibited_actions,
        'Guided',definition.result_schema,('evidence',),'qa-budget',('bound evidence',),target,digest('qa-context'),
        permission,permission.snapshot_hash,permission.snapshot_hash,egress,egress.snapshot_hash,egress.snapshot_hash)
    assignment=policy.register(assignment_id='qa-assignment',definition=definition,packet=packet,actor_id='qa-reader',
        context_id='qa-context',thread_id='qa-thread',workspace_id='qa-workspace',session_id='c30r3-qa-session',
        context_snapshot_hash=digest('qa-context'),issued_at=now,expires_at=now+timedelta(hours=2),execution_fence='qa-exec-1')
    session=TeamSession('c30r3-qa-session','main',frozenset({'main','qa-reader'}),target,
        frozenset({'team:coordinate'}),20,TeamSessionState.ACTIVE,1,now)
    results=RoleResultService(policy)
    team=RoleTeamOrchestrator(session,policy,results,parent_task_id='qa-parent',target_hash=target,deadline=now+timedelta(hours=2))
    task=TeamTask('qa-task',session.session_id,'read disposable QA owner',TeamTaskStatus.PENDING,
        frozenset(),('docs/readme.md',),created_at=now,parent_hash=canonical_hash(session))
    team.register_plan((TeamTaskBinding(task,assignment,None,now+timedelta(hours=2),5),),actor_id='main',now=now)
    moa=MoADeliberation(team,quorum=1,deadline=now+timedelta(hours=2))
    binding=repo.OwnerBinding('c30r3-qa','local',session.session_id,assignment.assignment_id,1,assignment.actor_id,
        assignment.context_id,assignment.workspace_id,target,target,assignment.content_hash,assignment.execution_fence,None)
    mapping=repo.PrincipalMapping(binding,digest(token),1,assignment.actor_id,'tester',('tasks:read',),
        now,now+timedelta(hours=2),'')
    mapping=replace(mapping,mapping_hash=repo._seal(mapping,'mapping_hash'))
    bundle=OwnerComponentBundle(binding=binding,owner_version=1,owner_snapshot_hash=digest('unpersisted-qa'),
        principal_mapping_hash=mapping.mapping_hash,restored_at=now,policy=policy,results=results,team=team,moa=moa)
    components=[]
    for p in export_owner_components(bundle):
        raw=json.dumps(asdict(p),sort_keys=True,separators=(',',':'),ensure_ascii=False)
        components.append(repo.OwnerComponent(p.component_type,1,raw,digest(raw)))
    snapshot=repo.OwnerSnapshot(binding,1,*components,(mapping,),now,now+timedelta(hours=2),'')
    return replace(snapshot,content_hash=repo._seal(snapshot))


def formal_cli():
    """Explicit disposable harness only. Never mounted as an HTTP write route."""
    import sys, os, json, hmac
    from datetime import datetime, timezone
    from hashlib import sha256
    from sqlalchemy import create_engine,text
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.engine import make_url
    from packages.persistence import agent_team_owner_repository as repo
    command=sys.argv[1]
    app_url=make_url(os.environ['ANVIL_DATABASE_URL'])
    owner_url=make_url(os.environ['C30R3_OWNER_DATABASE_URL'])
    assert app_url.database=='c30r3_app' and owner_url.database=='c30r3_owner'
    assert app_url.host==owner_url.host and app_url.host.startswith('anvil-c30r3-t4-')
    assert app_url.drivername==owner_url.drivername=='postgresql+psycopg'
    token=os.environ['C30R3_QA_SESSION']
    assert len(token)>=32
    engine=create_engine(owner_url)
    sessions=sessionmaker(bind=engine)
    repository=repo.SqlAlchemyAgentTeamOwnerRepository()
    def stored():
        with sessions() as s,s.begin():
            raw=s.execute(text("SELECT snapshot_json FROM agent_owner_heads WHERE project_id='c30r3-qa'")).scalar_one()
            return repo._decode(raw,repo.OwnerSnapshot)
    if command=='init':
        from alembic.config import Config
        from alembic import command as alembic_command
        config=Config('alembic.ini')
        for url,target in ((app_url,'0013_task_bootstrap_authority'),(owner_url,'0015_agent_team_owner')):
            os.environ['ANVIL_DATABASE_URL']=url.render_as_string(hide_password=False)
            alembic_command.upgrade(config,target)
        os.environ['ANVIL_DATABASE_URL']=app_url.render_as_string(hide_password=False)
        snapshot=formal_seed(token,datetime.now(timezone.utc).replace(microsecond=0))
        with sessions() as s,s.begin():repository.save_owner_snapshot(s,snapshot=snapshot,expected_version=0,request_id='qa-seed')
        print(json.dumps(dict(seed='COMMITTED',snapshot_hash=snapshot.content_hash)))
    elif command=='revoke':
        snapshot=stored()
        with sessions() as s,s.begin():
            repository.revoke_generation(s,binding=snapshot.binding,expected_version=1,request_id='qa-revoke',reason='OWNER_REVOKED')
        print('{"revocation":"COMMITTED"}')
    elif command=='stats':
        with sessions() as s,s.begin():
            output=dict(head=s.execute(text('SELECT version_num FROM alembic_version')).scalar_one(),
                heads=s.execute(text('SELECT count(*) FROM agent_owner_heads')).scalar_one(),
                receipts=s.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one(),
                revoked=s.execute(text('SELECT max(revoked_through) FROM agent_owner_heads')).scalar_one())
        with create_engine(app_url).connect() as c:
            output['app_db_head']=c.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
        print(json.dumps(output))
    elif command=='serve':
        from packages.api.runtime import create_runtime_app,RuntimeConsoleOwner
        from packages.api.common import SessionPrincipal
        from apps.api.anvil_api.asgi import create_asgi_app
        def authenticate(value):
            mapping=stored().principal_mappings[0]
            if not hmac.compare_digest('sha256:'+sha256(value.encode()).hexdigest(),mapping.auth_session_hash):return None
            return SessionPrincipal(mapping.principal_actor_id,mapping.principal_role,'qa-csrf',frozenset(mapping.permissions),
                frozenset({'c30r3-qa'}),frozenset({'local'}))
        def resolve(principal,token_hash):
            mapping=stored().principal_mappings[0]
            if not hmac.compare_digest(token_hash,mapping.auth_session_hash):raise ValueError('AUTHORITY_DENIED')
            return mapping
        # App and owner repositories are physically separate DBs, never a fake
        # migration-version rewrite or a runtime production auth integration.
        app=create_runtime_app(authenticate=authenticate)
        app.state.agent_console_runtime=RuntimeConsoleOwner(session_factory=sessions,authenticate=authenticate,resolve_mapping=resolve)
        import uvicorn
        uvicorn.run(create_asgi_app(app),host='0.0.0.0',port=3770,access_log=False)
    else:raise ValueError('FORMAL_COMMAND_INVALID')


if __name__=='__main__':
    formal_cli()
    raise SystemExit(0)


import pytest

from apps.api.anvil_api.routes.agent_console import create_agent_console_app
from tests.integration.test_c30r3_runtime_restore import setup, request, receipts


ROOT=Path(__file__).resolve().parents[2]


def formal_execution_plan():
    """This invocation's non-executing inventory, not an evidence issuer.

    The Main ruling permits a distinct disposable owner DB at 0015 while the
    candidate app DB stays 0013. No DB names/credentials/resources were minted
    because SSH alias resolution failed before reaching the remote host.
    """
    return dict(
        app_db_head="0013_task_bootstrap_authority",owner_db_head="0015_agent_team_owner",
        database_layout="ONE_DISPOSABLE_PG15_TWO_DISTINCT_DATABASES",release_schema_change=False,
        status="BLOCKED",blocker="SSH_ALIAS_UNRESOLVED_IN_WORKER",formal_acceptance=False,
        created_resources=[],execution={name:"NOT_EXECUTED" for name in (
            "postgresql","live_http","browser_network","process_restart","cleanup_inventory")},
    )


def plan():
    build=globals().get("formal_execution_plan")
    assert callable(build), "C30R3_DUAL_DATABASE_FORMAL_PREFLIGHT_MISSING"
    return build()


def test_dual_database_plan_preserves_release_head_without_claiming_execution():
    p=plan()
    assert p["app_db_head"]=="0013_task_bootstrap_authority"
    assert p["owner_db_head"]=="0015_agent_team_owner"
    assert p["database_layout"]=="ONE_DISPOSABLE_PG15_TWO_DISTINCT_DATABASES"
    assert p["release_schema_change"] is False
    assert p["formal_acceptance"] is False
    assert p["status"]=="BLOCKED"
    assert p["blocker"]=="SSH_ALIAS_UNRESOLVED_IN_WORKER"


@pytest.mark.parametrize("axis", ["postgresql","live_http","browser_network","process_restart","cleanup_inventory"])
def test_required_formal_axes_remain_not_executed(axis):
    assert plan()["execution"][axis]=="NOT_EXECUTED"


def test_plan_returns_detached_no_secret_or_runtime_self_attestation():
    one=plan()
    one["execution"]["postgresql"]="PASS"
    one["formal_acceptance"]=True
    assert plan()["execution"]["postgresql"]=="NOT_EXECUTED"
    assert plan()["formal_acceptance"] is False
    assert plan()["created_resources"]==[]


def test_migration_source_proves_owner_tables_are_not_in_release_0013():
    tables={}
    for path in sorted((ROOT/"migrations/versions").glob("*.py")):
        tree=ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=="create_table":
                if node.args and isinstance(node.args[0],ast.Constant):
                    tables[node.args[0].value]=path.name
    for name in ("agent_owner_heads","agent_owner_history","agent_owner_requests"):
        assert tables[name]=="0015_agent_team_owner.py"
    tree=ast.parse((ROOT/"apps/api/anvil_api/asgi.py").read_text(encoding="utf-8"))
    targets=[n.value.value for n in ast.walk(tree) if isinstance(n,ast.Assign)
        and any(isinstance(t,ast.Name) and t.id=="required_migration_head" for t in n.targets)]
    assert targets==["0013_task_bootstrap_authority"]


def test_local_four_menus_receipts_and_new_host_instance_do_not_attest_restart(monkeypatch):
    with setup(monkeypatch) as f:
        bodies={}
        for menu in ("team","moa","sns","adapters"):
            response=request(f["app"],url="/api/agent-console/"+menu)
            assert response.status_code==200,response.text
            bodies[menu]=response.json()
            assert bodies[menu]["target_hash"]==f["binding"].target_hash
            assert bodies[menu]["counts_as_pass"] is False
        assert bodies["sns"]["state"]=="EMPTY"
        assert bodies["adapters"]["data"]["kakao"]["status"]=="OPEN_DECISION"
        assert receipts(f)==4
        fresh=create_agent_console_app(runtime_owner=f["owner"]())
        for menu,body in bodies.items():
            assert request(fresh,url="/api/agent-console/"+menu).json()==body
        assert receipts(f)==4
        assert plan()["execution"]["process_restart"]=="NOT_EXECUTED"


@pytest.mark.parametrize("action", ["pause","resume","approve","apply","deploy","delete"])
@pytest.mark.parametrize("headers", [{},{"x-csrf-token":"synthetic-untrusted","origin":"https://foreign.invalid"}])
def test_local_runtime_control_and_high_risk_refused_without_receipt(monkeypatch,action,headers):
    with setup(monkeypatch) as f:
        response=request(f["app"],"POST","/api/agent-console/control",headers=headers,
            json={"action":action,"target_hash":f["binding"].target_hash,"request_id":"caller"})
        assert response.status_code==403
        assert response.json()["counts_as_pass"] is False
        assert receipts(f)==0


def test_local_offline_and_invalid_request_are_not_formal_browser_evidence():
    app=create_agent_console_app()
    assert request(app).status_code==503
    assert request(app,params={"owner":"forged"}).status_code==400
    assert request(app,url="/api/agent-console/unknown").status_code==404
    assert plan()["execution"]["browser_network"]=="NOT_EXECUTED"


def test_disposable_seed_has_actual_pending_owners_without_fake_pass():
    from datetime import datetime,timezone
    from sqlalchemy.orm import sessionmaker
    from packages.persistence.agent_team_owner_repository import SqlAlchemyAgentTeamOwnerRepository
    from packages.agent_team.owner_component_restore import restore_owner_components
    from tests.persistence.test_agent_team_owner_repository import database
    now=datetime.now(timezone.utc).replace(microsecond=0)
    snapshot=formal_seed('synthetic-formal-session-for-local-contract',now)
    with database() as engine:
        sessions=sessionmaker(bind=engine)
        with sessions() as s,s.begin():
            SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(s,snapshot=snapshot,expected_version=0,request_id='local-seed')
        bundle=restore_owner_components(snapshot,snapshot.principal_mappings[0],session_factory=sessions,now=now)
        view=bundle.team.project().to_dict()
        assert view['tasks']['qa-task']['status']=='PENDING'
        assert view['tasks']['qa-task']['result_hash'] is None
        assert bundle.moa.project().to_dict()['proposals']==[]
