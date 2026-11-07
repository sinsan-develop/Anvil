import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {buildApp} from '../../../apps/server/app.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id=(n:number)=>'a6f30000-0000-4000-8000-'+String(n).padStart(12,'0');
const pid=id(1),user=id(2),client=id(3),session=id(4);
const token='S'.repeat(43),csrf='C'.repeat(43);
const digest=(input:string)=>createHash('sha256').update(input).digest('hex');
const origin='https://anvil-synthetic.invalid',host=new URL(origin).host,path='/api/v1/projects/'+pid;
const statements={
  auth:'SELECT s.*,u.id AS uid,u.display_name,u.normalized_login_name,u.server_owner,u.status AS user_status,u.revoked_at AS user_revoked_at,u.credential_generation AS current_generation,c.revoked_at AS client_revoked_at FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients c ON c.id=s.client_id AND c.user_id=s.user_id WHERE token_digest=$1 FOR UPDATE OF u,s,c',
  member:'SELECT p.id,p.archived_at,m.participation FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL',
  control:'SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',
  replay:"SELECT operation,request_hash,result_ref FROM anvil.commands WHERE scope_kind='PROJECT' AND project_id=$1 AND actor_id=$2 AND command_id=$3",
  policy:'SELECT p.id,p.head_version,v.rules_json,v.content_hash,v.reason,v.review_refs,v.created_at FROM anvil.permission_policies p JOIN anvil.permission_policy_versions v ON v.policy_id=p.id AND v.project_id=p.project_id AND v.version=p.head_version WHERE p.project_id=$1 FOR SHARE OF p',
  clock:'SELECT transaction_timestamp() AS at',
  command:"INSERT INTO anvil.commands(id,scope_kind,scope_id,project_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,completed_at) VALUES($1,'PROJECT',$2,$2,$3,$4,$5,$6,$7,$8,'APPLIED',$9,$10,$11,$12,$13,$14,$15,now())",
  receipt:"INSERT INTO anvil.authorization_receipts(id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref) VALUES($1,'PROJECT',$2,$3,$4,$5,$6,$7)",
  applied:"INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,$7,$8,$9,'APPLIED',$10,$11,'HUMAN_COMMAND' FROM anvil.audit_events WHERE project_id=$1",
  denied:"INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,target_ref,outcome,reason_code,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,'DENIED',$6,'SERVER_DENIAL' FROM anvil.audit_events WHERE project_id=$1",
  setContext:"SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true),set_config('anvil.command_id',$3,true)",
  head:'INSERT INTO anvil.permission_policies(id,project_id,head_version,created_by) VALUES($1,$2,1,$3)',
  version:'INSERT INTO anvil.permission_policy_versions(project_id,policy_id,version,rules_json,content_hash,reason,review_refs,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
} as const;
const wireId=/^[0-9a-f-]{36}$/;
const authActor={kind:'HUMAN',userId:user},authSubject={...authActor,clientId:client};

function fixture(){
  const now=Date.now(),at=new Date(now);
  const sessionRow={id:session,uid:user,client_id:client,user_status:'ACTIVE',server_owner:false,credential_generation:1,current_generation:1,
    csrf_digest:digest(csrf),idle_expires_at:new Date(now+600_000),absolute_expires_at:new Date(now+1_200_000),reauth_until:new Date(now+600_000),
    revoked_at:null,user_revoked_at:null,client_revoked_at:null};
  const controlRow={actor_id:user,client_id:client,generation:1,revoked_at:null as Date|null};
  type ReceiptArgs={command:unknown[];receipt:unknown[];applied:unknown[]};
  const empty=()=>({head:[] as unknown[][],version:[] as unknown[][],command:[] as ReceiptArgs['command'][],receipt:[] as ReceiptArgs['receipt'][],
    applied:[] as ReceiptArgs['applied'][],denied:[] as unknown[][]});
  let committed=empty();
  const txs:{steps:string[];released:boolean}[]=[];
  const pool={async connect(){
    const tx={steps:[] as string[],released:false};txs.push(tx);
    let staged:ReturnType<typeof empty>|null=null;
    let ended=false;
    return {
      async query(sql:string,args:unknown[]=[]){
        assert.equal(tx.released,false);assert.equal(ended,false);
        const text=sql.replace(/\s+/g,' ').trim();
        if(text==='BEGIN'){
          assert.deepEqual(args,[]);assert.equal(staged,null);tx.steps.push('BEGIN');staged=structuredClone(committed);
          return {rows:[],command:'BEGIN'};
        }
        assert.ok(staged,'모든 SQL은 제품 인증 거래 안에서 실행');
        if(text==='COMMIT'||text==='ROLLBACK'){
          assert.deepEqual(args,[]);tx.steps.push(text);if(text==='COMMIT')committed=staged;ended=true;return {rows:[],command:text};
        }
        const use=(step:string)=>tx.steps.push(step);
        if(text===statements.auth){assert.deepEqual(args,[digest(token)]);use('AUTH');return {rows:[{...sessionRow}]};}
        if(text===statements.member||text===statements.member+' FOR UPDATE OF p,m'){
          assert.deepEqual(args,[pid,user]);use(text.endsWith('FOR UPDATE OF p,m')?'MEMBER_LOCK':'MEMBER');
          return {rows:[{id:pid,archived_at:null,participation:'OWNER'}]};
        }
        if(text===statements.control){assert.deepEqual(args,[pid]);use('CONTROL_LOCK');return {rows:[{...controlRow}]};}
        if(text===statements.replay){
          assert.deepEqual(args.slice(0,2),[pid,user]);assert.equal(args.length,3);assert.match(String(args[2]),wireId);
          use('REPLAY');return {rows:staged.command.filter(row=>row[5]===args[2]).map(row=>({operation:row[4],request_hash:row[6],result_ref:JSON.parse(String(row[14]))}))};
        }
        if(text===statements.policy){
          assert.deepEqual(args,[pid]);use('POLICY');
          return {rows:staged.version.map(row=>({id:row[1],head_version:row[2],rules_json:JSON.parse(String(row[3])),
            content_hash:row[4],reason:row[5],review_refs:JSON.parse(String(row[6])),created_at:at}))};
        }
        if(text===statements.clock){assert.deepEqual(args,[]);use('CLOCK');return {rows:[{at}]};}
        if(text===statements.command){assert.equal(args.length,15);use('COMMAND_WRITE');staged.command.push([...args]);return {rows:[]};}
        if(text===statements.receipt){assert.equal(args.length,7);use('RECEIPT_WRITE');staged.receipt.push([...args]);return {rows:[]};}
        if(text===statements.applied){assert.equal(args.length,11);use('APPLIED_WRITE');staged.applied.push([...args]);return {rows:[]};}
        if(text===statements.denied){assert.equal(args.length,6);use('DENIAL_WRITE');staged.denied.push([...args]);return {rows:[]};}
        if(text===statements.setContext){assert.deepEqual(args,[user,client,staged.command[0]?.[0]]);use('CONTEXT');return {rows:[]};}
        if(text===statements.head){assert.equal(args.length,3);use('HEAD_WRITE');staged.head.push([...args]);return {rows:[]};}
        if(text===statements.version){assert.equal(args.length,10);use('VERSION_WRITE');staged.version.push([...args]);return {rows:[]};}
        assert.fail('UNMODELED_POLICY_SQL '+text);
      },
      release(error?:Error){assert.equal(error,undefined);assert.equal(ended,true);assert.equal(tx.released,false);tx.released=true;},
    };
  }};
  // 외부 키나 인증 대역 없이 실제 인증 흐름을 사용한다. 설정의 32바이트와 SQL 행만 시험 전용이다.
  const access=new AccessRepository(pool as unknown as Pool,{installationId:id(99),key:Buffer.alloc(32,0x41)});
  const app=buildApp({},undefined,{repository:access,origin});
  const headers={host,origin,cookie:'__Host-anvil.sid='+token,'x-anvil-csrf':csrf};
  const save=(command:ProjectCommand)=>app.inject({method:'POST',url:path+'/commands',headers,payload:command});
  const read=()=>app.inject({method:'GET',url:path+'/permission-policy',headers});
  const rule={ruleId:'OWN_DOCUMENTS',subjectRef:authActor,operations:['saveDocumentDraft'],targetScopes:[{kind:'PROJECT',projectId:pid}],
    disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(now+3_600_000).toISOString()};
  const request:ProjectCommand={schemaVersion:1,projectId:pid,commandId:id(10),clientId:client,controlGeneration:1,
    operation:'savePermissionPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{rules:[rule],reason:'합성 초기 정책',reviewRefs:[]}};
  return {app,save,read,request,rule,at,sessionRow,controlRow,txs,snapshot:()=>structuredClone(committed)};
}

const begin=['BEGIN','AUTH'],controller=['MEMBER_LOCK','CONTROL_LOCK'];
const settled=(steps:string[])=>({steps,released:true});
const contentHashOf=(value:unknown)=>contentHash(canonicalJson(value));

test('IX01 실제 정책 저장과 보호 조회 뒤 만료 세션·회수 제어·이전 제어 세대가 변경을 막는다',async()=>{
  const f=fixture();
  try{
    const saved=await f.save(f.request);
    assert.equal(saved.statusCode,200,saved.body);
    const result=saved.json(),ref=result.data.ref;
    assert.match(ref.id,wireId);
    assert.deepEqual(ref,{id:ref.id,version:1,contentHash:contentHashOf(f.request.payload)});
    assert.match(result.operationId,wireId);
    assert.deepEqual(result,{operationId:result.operationId,commandId:f.request.commandId,projectId:pid,status:'APPLIED',targetId:ref.id,version:1,
      data:{status:'POLICY_SAVED',ref},evidenceRefs:[],warnings:[],serverReceivedAt:f.at.toISOString()});
    const snapshot=f.snapshot();
    assert.equal(snapshot.command.length,1);assert.equal(snapshot.receipt.length,1);assert.equal(snapshot.applied.length,1);assert.deepEqual(snapshot.denied,[]);
    const command=snapshot.command[0]!,receipt=snapshot.receipt[0]!,audit=snapshot.applied[0]!;
    for(const key of [command[0],receipt[0],audit[1]])assert.match(String(key),wireId);
    const requestHash=contentHashOf(f.request),scopeDigest=contentHashOf({projectId:pid,actorId:user,clientId:client,controlGeneration:1,requestHash,policyRef:null,targetRef:ref});
    assert.deepEqual(command,[command[0],pid,user,client,'savePermissionPolicy',f.request.commandId,requestHash,result.operationId,receipt[0],null,0,1,null,null,JSON.stringify(result)]);
    assert.deepEqual(receipt,[receipt[0],pid,command[0],JSON.stringify(authSubject),null,scopeDigest,null]);
    assert.deepEqual(audit,[pid,audit[1],JSON.stringify(authActor),client,command[0],result.operationId,JSON.stringify(ref),null,null,'OWNER_REAUTHENTICATED_INITIAL_POLICY',scopeDigest]);
    assert.deepEqual(snapshot.head,[[ref.id,pid,user]]);
    assert.deepEqual(snapshot.version,[[pid,ref.id,1,canonicalJson([f.rule]),ref.contentHash,f.request.payload.reason,'[]',user,client,command[0]]]);
    const protectedPolicy={configured:true,policy:{ref,rules:[f.rule],reason:f.request.payload.reason,reviewRefs:[],createdAt:f.at.toISOString()}};
    const before=await f.read();assert.equal(before.statusCode,200,before.body);assert.deepEqual(before.json(),protectedPolicy);
    assert.deepEqual(f.txs,[
      settled([...begin,...controller,'REPLAY','POLICY','CLOCK','COMMAND_WRITE','RECEIPT_WRITE','APPLIED_WRITE','CONTEXT','HEAD_WRITE','VERSION_WRITE','COMMIT']),
      settled([...begin,'MEMBER','POLICY','COMMIT']),
    ]);

    const idle=f.sessionRow.idle_expires_at;
    const {denied:initialDenials,...original}=snapshot;
    assert.deepEqual(initialDenials,[]);
    const denialReasons:string[]=[];
    for(const [index,code,status] of [[0,'AUTH_REQUIRED',401],[1,'PROJECT_CONTROL_REQUIRED',403],[2,'CONTROL_GENERATION_CONFLICT',409]] as const){
      f.sessionRow.idle_expires_at=index===0?new Date(f.at.getTime()-1):idle;
      f.controlRow.revoked_at=index===1?f.at:null;
      f.controlRow.generation=index===2?2:1;
      const txStart=f.txs.length;
      const response=await f.save({...f.request,commandId:id(11+index),targetId:ref.id,expectedVersion:1,
        payload:{...f.request.payload,reason:'거절되어야 하는 합성 개정 '+index}});
      assert.equal(response.statusCode,status,response.body);
      assert.equal(response.headers['cache-control'],'no-store');
      const {requestId,...error}=response.json();assert.equal(typeof requestId,'string');assert.ok(requestId.length>0);
      assert.deepEqual(error,{code,message:'요청을 처리하지 못했습니다',targetId:null,retryDisposition:'not-retryable',details:{}});
      const {denied,...domain}=f.snapshot();assert.deepEqual(domain,original);
      if(index===0){
        assert.deepEqual(f.txs.slice(txStart),[settled([...begin,'ROLLBACK'])]);
      }else{
        denialReasons.push(code);
        assert.deepEqual(f.txs.slice(txStart),[
          settled([...begin,...controller,'ROLLBACK']),settled([...begin,'MEMBER_LOCK','DENIAL_WRITE','COMMIT']),
        ]);
      }
      assert.equal(denied.length,denialReasons.length);
      denied.forEach((entry,n)=>{
        assert.match(String(entry[1]),wireId);
        assert.deepEqual(entry,[pid,entry[1],JSON.stringify(authActor),client,JSON.stringify({id:pid}),denialReasons[n]]);
      });
    }

    const after=await f.read();assert.equal(after.statusCode,200,after.body);assert.deepEqual(after.json(),protectedPolicy);
    assert.deepEqual(f.txs.at(-1),settled([...begin,'MEMBER','POLICY','COMMIT']));
    const {denied:finalDenials,...finalDomain}=f.snapshot();assert.deepEqual(finalDomain,original);assert.equal(finalDenials.length,2);
  }finally{await f.app.close();assert.equal(f.app.server.listening,false);}
});
