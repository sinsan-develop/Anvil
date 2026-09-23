"""C29 read-only host projection API; no DB, runtime bootstrap or transport send.

The embedding host supplies authentication and exact domain owners. Headers and
request bodies never create identity. Default construction is fail-closed.
"""
from dataclasses import asdict, dataclass, fields
from datetime import datetime, timezone
import json
import hashlib
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from packages.agent_team.orchestration import RoleTeamOrchestrator
from packages.agent_team.role_contracts import RolePolicyService
from packages.agent_team.moa import MoADeliberation
from packages.agent_team.sns_gateway import SNSGateway, _id, _c24_hash, plain, utc
from packages.agent_team.provider_catalog import _c24_read

MENUS = ('team', 'moa', 'sns', 'adapters')


@dataclass(frozen=True, slots=True)
class ConsoleAuthority:
    assignment_id: str
    actor_id: str
    context_id: str
    session_id: str
    target_hash: str
    execution_fence: str


class ConsoleProjectionService:
    def __init__(self, team, policy, *, assignment_ids, moa=None, gateway=None, identity=None, sns_receipts=()):
        if type(team) is not RoleTeamOrchestrator or type(policy) is not RolePolicyService:
            raise ValueError('OWNER_REQUIRED')
        if moa is not None and type(moa) is not MoADeliberation: raise ValueError('OWNER_REQUIRED')
        if gateway is not None and type(gateway) is not SNSGateway: raise ValueError('OWNER_REQUIRED')
        ids=plain(assignment_ids)
        if type(ids) is not dict or len(ids)>64: raise ValueError('ASSIGNMENTS_INVALID')
        for key,value in ids.items(): _id(key); _id(value)
        if type(sns_receipts) is not tuple or len(sns_receipts)>50: raise ValueError('RECEIPTS_INVALID')
        # Only sealed value handles, detached before future reads; never arbitrary objects.
        from packages.provider_catalog.models import snapshot
        def detached(handle):
            data=_c24_read(handle)
            return snapshot(handle.kind,handle.record_id,data)
        self._identity=detached(identity) if identity is not None else None
        self._receipts=tuple(detached(h) for h in sns_receipts)
        self._team,self._policy,self._ids=team,policy,ids
        self._moa,self._gateway=moa,gateway
        self._owner_bundle=None

    @classmethod
    def from_owner_bundle(cls, bundle):
        """Consume the closed typed codec; construction itself grants no authority."""
        from packages.agent_team.owner_component_restore import OwnerComponentBundle, export_owner_components
        if type(bundle) is not OwnerComponentBundle: raise ValueError('OWNER_REQUIRED')
        export_owner_components(bundle)
        # Public codec construction detaches all four linked mutable owners.
        detached=OwnerComponentBundle(**{f.name:getattr(bundle,f.name)
            for f in fields(OwnerComponentBundle) if f.init})
        payloads=export_owner_components(detached)
        bindings=payloads[2].payload['state']['bindings']
        ids={row['value']['task']['task_id']:row['value']['assignment']['assignment_id'] for row in bindings}
        service=cls(detached.team,detached.policy,assignment_ids=ids,moa=detached.moa)
        service._owner_bundle=detached
        return service

    def _authority(self, authority, now):
        now=utc(now)
        if type(authority) is not ConsoleAuthority: raise ValueError('AUTHORITY_REQUIRED')
        row={f.name:getattr(authority,f.name) for f in fields(ConsoleAuthority)}
        for key,value in row.items():
            (_c24_hash if key=='target_hash' else _id)(value)
        assignment=self._policy.get_assignment(row['assignment_id'])
        reason=self._policy.validate_assignment(assignment,actor_id=row['actor_id'],context_id=row['context_id'],
            session_id=row['session_id'],target_hash=row['target_hash'],execution_fence=row['execution_fence'],now=now)
        if reason: raise ValueError('AUTHORITY_DENIED')
        if 'read' not in assignment.packet.permission_snapshot.allowed_actions: raise ValueError('READ_DENIED')
        self._team.mailbox(assignment.packet.step_id,actor_id=row['actor_id'],execution_fence=row['execution_fence'],now=now)
        source=self._team.project(); view=plain(source.to_dict())
        if view['session']['session_id']!=row['session_id'] or view['target_hash']!=row['target_hash']:
            raise ValueError('TRACE_MISMATCH')
        return assignment,source,view

    def owner_components(self, authority, *, now):
        """Bind public owner views; NOT a serialization/restore of private authority.

        The host must supply real domain owners. These reference projections never
        recreate revoked grants, spent budgets, evidence registries or write leases.
        """
        from packages.persistence.agent_team_owner_repository import OwnerComponent
        _, source, view = self._authority(authority, now)
        assignments = []
        for task_id, assignment_id in sorted(self._ids.items()):
            assignment = self._policy.get_assignment(assignment_id)
            if task_id not in view['tasks'] or view['tasks'][task_id]['assignment_hash'] != assignment.content_hash:
                raise ValueError('TASK_MAPPING_INVALID')
            assignments.append(dict(task_id=task_id,assignment_id=assignment_id,assignment_hash=assignment.content_hash))
        def component(kind, value):
            body=json.dumps(plain(value),sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
            return OwnerComponent(kind,1,body,'sha256:'+hashlib.sha256(body.encode()).hexdigest())
        policy=component('ROLE_POLICY',dict(schema='console-policy-references/v1',assignments=assignments))
        results=component('ROLE_RESULTS',dict(schema='console-result-references/v1',
            results={k:v['result_hash'] for k,v in view['tasks'].items()}))
        team=component('TEAM',dict(schema='console-team-projection/v1',projection=view))
        moa=None if self._moa is None else component('MOA',dict(schema='console-moa-projection/v1',projection=self._moa.project().to_dict()))
        _, latest, _=self._authority(authority,now)
        if latest.content_hash!=source.content_hash: raise ValueError('PROJECTION_CHANGED')
        return policy,results,team,moa

    def verify_owner_snapshot(self, snapshot, authority, *, now):
        from packages.persistence.agent_team_owner_repository import OwnerSnapshot
        if type(snapshot) is not OwnerSnapshot: raise ValueError('OWNER_REQUIRED')
        assignment,_,_=self._authority(authority,now)
        binding=snapshot.binding
        for name in ('assignment_id','actor_id','context_id','workspace_id','session_id','baseline_hash','target_hash'):
            if getattr(binding,name)!=getattr(assignment,name): raise ValueError('TRACE_MISMATCH')
        if binding.assignment_hash!=assignment.content_hash or binding.execution_fence!=assignment.execution_fence:
            raise ValueError('TRACE_MISMATCH')
        if self._owner_bundle is not None:
            from packages.agent_team.owner_component_restore import export_owner_components
            from packages.persistence.agent_team_owner_repository import OwnerComponent
            bundle=self._owner_bundle
            if (bundle.binding!=binding or bundle.owner_version!=snapshot.owner_version
                or bundle.owner_snapshot_hash!=snapshot.content_hash):raise ValueError('TRACE_MISMATCH')
            components=[]
            for payload in export_owner_components(bundle):
                raw=json.dumps(asdict(payload),sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
                components.append(OwnerComponent(payload.component_type,1,raw,'sha256:'+hashlib.sha256(raw.encode()).hexdigest()))
            actual=tuple(components)
        else:
            actual=self.owner_components(authority,now=now)
        if actual!=(snapshot.policy,snapshot.results,snapshot.team,snapshot.moa):
            raise ValueError('PROJECTION_CHANGED')

    def read(self, menu, authority, *, now):
        if type(menu) is not str or menu not in MENUS: raise ValueError('MENU_INVALID')
        a,source,v=self._authority(authority,now)
        state='NORMAL'
        if menu=='team':
            if set(self._ids)!=set(v['tasks']): raise ValueError('TASK_MAPPING_INVALID')
            rows=[]
            for tid,row in sorted(v['tasks'].items()):
                current=self._policy.get_assignment(self._ids[tid])
                if current.content_hash!=row['assignment_hash'] or current.packet.step_id!=tid: raise ValueError('TASK_MAPPING_INVALID')
                rows.append(dict(task_id=tid,parent_task_id=row['parent_task_id'],role=current.definition.role,
                    status=row['status'],assignment_hash=row['assignment_hash'],result_hash=row['result_hash'],
                    dependency_ids=row['dependency_ids'],artifact_refs=[],evidence_refs=[],
                    evidence_status='NOT_EXPOSED_BY_OWNER',provider=None,model=None))
            data=dict(tasks=rows,team_status=v['status'],plan_hash=v['plan_hash'],provider_status='NOT_OBSERVED')
            if not rows: state='EMPTY'
        elif menu=='moa':
            data=dict(proposals=[],critiques=[],synthesis='NOT_EXPOSED_BY_OWNER',final_owner=None)
            if self._moa is not None:
                mv=plain(self._moa.project().to_dict());data['final_owner']=mv['final_owner']
                for kind in ('proposals','critiques'):
                    for entry in mv[kind]:
                        task=v['tasks'].get(entry['task_id'])
                        if task is None or any(entry[k]!=task[k] for k in ('actor_id','assignment_hash','result_hash','binding_hash')):
                            raise ValueError('TRACE_MISMATCH')
                        if kind=='proposals' and (entry['session_id']!=a.session_id or entry['target_hash']!=a.target_hash or entry['baseline_hash']!=a.baseline_hash or entry['plan_hash']!=v['plan_hash']):
                            raise ValueError('TRACE_MISMATCH')
                        if kind=='critiques' and entry['proposal_id'] not in {p['id'] for p in mv['proposals']}:
                            raise ValueError('TRACE_MISMATCH')
                        keys=('id','task_id','actor_id','result_hash','evidence_refs')+(('proposal_id','verdict') if kind=='critiques' else ())
                        data[kind].append({k:entry[k] for k in keys})
            if not data['proposals'] and not data['critiques']: state='EMPTY'
        elif menu=='sns':
            data=dict(receipts=[],channel='SNS / Daon User',identity_status='NOT_LOADED',delivery='NOT_EXECUTED')
            for handle in self._receipts:
                if self._gateway is None or self._identity is None: raise ValueError('SNS_OWNER_REQUIRED')
                identity=_c24_read(self._identity)
                if identity['internal_user']!=a.actor_id or identity['session_id']!=a.session_id or identity['target_hash']!=a.target_hash:
                    raise ValueError('TRACE_MISMATCH')
                receipt=self._gateway.receipt(handle,identity=self._identity,execution_fence=authority.execution_fence,now=now)
                r=plain(receipt.to_dict());trace=r['trace']
                if trace['session_id']!=a.session_id or trace['target_hash']!=a.target_hash: raise ValueError('TRACE_MISMATCH')
                data['receipts'].append(dict(receipt_ref=receipt.record_id,receipt_hash=receipt.content_hash,
                    session_id=trace['session_id'],status=r['status'],channel=r['channel'],delivery=r['delivery'],privacy=r['privacy']))
                data['identity_status']='CURRENT_OWNER_VALIDATED'
            if not data['receipts']: state='EMPTY'
        else:
            # Contract boundaries only: no invented connected adapter instance or receipt.
            data=dict(telegram=dict(status='NOT_INTEGRATED',control='REQUESTED_NOT_APPLIED',delivery='NOT_EXECUTED'),
                      kakao=dict(status='OPEN_DECISION',allowed=False,delivery='NOT_EXECUTED'))
        result=plain(dict(schema='agent-console/v1',menu=menu,state=state,target_hash=v['target_hash'],
            baseline_hash=v['session']['baseline_hash'],session_id=v['session']['session_id'],projection_hash=source.content_hash,
            data=data,deploy_readiness='NOT_EVALUATED',external_runtime='NOT_EXECUTED',automatic_acceptance=False,counts_as_pass=False))
        _,latest,_=self._authority(authority,now)
        if latest.content_hash!=source.content_hash: raise ValueError('PROJECTION_CHANGED')
        del result['projection_hash']
        result['projection_hash']='sha256:'+hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
        return result

    def control(self, body, authority, *, now):
        body=plain(body)
        if type(body) is not dict or set(body)!={'action','target_hash','request_id'}: raise TypeError('BODY_INVALID')
        _id(body['action']);_id(body['request_id']);_c24_hash(body['target_hash'])
        a,_,_=self._authority(authority,now)
        if body['target_hash']!=a.target_hash: raise ValueError('TARGET_MISMATCH')
        low=body['action'] in ('pause','resume')
        return (202 if low else 403),dict(schema='agent-console-control/v1',state='REQUESTED_NOT_APPLIED' if low else 'HUMAN_APPROVAL_REQUIRED',
            request_id=body['request_id'],target_hash=a.target_hash,allowed=False,applied=False,io_count=0)


def create_agent_console_app(service=None, *, resolve_authority=None, clock=None, runtime_owner=None):
    if service is not None and type(service) is not ConsoleProjectionService: raise ValueError('OWNER_REQUIRED')
    if runtime_owner is not None:
        from packages.api.runtime import RuntimeConsoleOwner
        if type(runtime_owner) is not RuntimeConsoleOwner or service is not None or resolve_authority is not None:
            raise ValueError('OWNER_REQUIRED')
    app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
    clock=clock or (lambda:datetime.now(timezone.utc))
    def response(code,data): return JSONResponse(data,status_code=code,headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
    def failure(code,state): return response(code,dict(state=state,reason='CONSOLE_REQUEST_DENIED',counts_as_pass=False))
    def authority(request):
        if resolve_authority is None: raise ValueError('AUTHORITY_REQUIRED')
        return resolve_authority(request)
    @app.get('/api/agent-console/{menu}')
    async def read(menu:str,request:Request):
        if menu not in MENUS:return failure(404,'EMPTY')
        if request.query_params:return failure(400,'ERROR')
        # GET never consumes caller owner JSON, including chunked body variants.
        async for chunk in request.stream():
            if chunk:return failure(400,'ERROR')
        if runtime_owner is not None:
            from packages.api.runtime import RuntimeConsoleNotIntegrated
            try:return response(200,runtime_owner.read_request(menu,request))
            except RuntimeConsoleNotIntegrated:
                return response(503,dict(state='OFFLINE',reason='OWNER_EXPORT_NOT_AVAILABLE',
                    owner_restore='NOT_INTEGRATED',counts_as_pass=False))
            except (ValueError,TypeError,KeyError):return failure(403,'PERMISSION_DENIED')
            except Exception:return failure(503,'OFFLINE')
        if service is None:return failure(503,'OFFLINE')
        try:return response(200,service.read(menu,authority(request),now=clock()))
        except (ValueError,TypeError,KeyError):return failure(403,'PERMISSION_DENIED')
        except Exception:return failure(500,'ERROR')
    @app.post('/api/agent-console/control')
    async def control(request:Request):
        # This durable read-side seam never creates control authority/intents.
        if runtime_owner is not None:return failure(403,'PERMISSION_DENIED')
        if service is None:return failure(503,'OFFLINE')
        raw=b''
        try:
            async for chunk in request.stream():
                raw+=chunk
                if len(raw)>4096:return failure(413,'ERROR')
            body=json.loads(raw)
        except (ValueError,UnicodeError):return failure(400,'ERROR')
        try:
            code,data=service.control(body,authority(request),now=clock());return response(code,data)
        except TypeError:return failure(400,'ERROR')
        except (ValueError,KeyError):return failure(403,'PERMISSION_DENIED')
        except Exception:return failure(500,'ERROR')
    return app


app=create_agent_console_app()
