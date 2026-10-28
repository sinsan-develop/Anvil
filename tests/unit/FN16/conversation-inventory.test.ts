import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AuthFailure,type AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {inspectArtifact} from '../../../apps/server/storage/sensitive-inspection.ts';

// 실제 수집 함수에 공개 합성 DB 행만 제공한다. 원문 파일·실제 PG는 사용하지 않는다.
const id=(n:number)=>`c3000000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),actorId=id(2),clientId=id(3),sessionId=id(4),token='v'.repeat(43),at=new Date('2026-10-29T00:00:00.000Z'),marker='public-private-driver-detail';
const clone=<T>(v:T):T=>structuredClone(v),hash=(v:unknown)=>contentHash(canonicalJson(v));
async function collector(){const u=new URL('../../../apps/server/modules/backups/conversation-inventory.ts',import.meta.url),m:any=existsSync(u)?await import(u.href):{};assert.equal(typeof m.collectConversationInventory,'function','대화 inventory 미구현');return m.collectConversationInventory as(a:AccessRepository,t:string,v:unknown,s:AbortSignal)=>Promise<any>;}
const rejected=(status:number)=>(e:any)=>e instanceof AuthFailure&&e.statusCode===status&&!e.cause&&!JSON.stringify(e).includes(marker)&&!String(e.stack).includes(marker)&&!/SELECT|storage_key|blobs\//.test(e.message);
function fixture(count=2){
 const input={projectId:pid,limits:{metadataBytes:4194304,inputBytes:1048576,fileCount:10,deadlineMs:10000}},abort=new AbortController();
 const bytes=[new TextEncoder().encode('공개 A'),new TextEncoder().encode('공개 B')];
 const artifacts=bytes.map((b,i)=>({id:id(10+i),project_id:pid,bytes:b.length,content_hash:createHash('sha256').update(b).digest('hex'),media_type:'text/plain;charset=utf-8',state:'READY',inspection_json:inspectArtifact(b)}));
 const ref=(i:number)=>{const a=artifacts[i]!;return{artifactId:a.id,bytes:a.bytes,contentHash:a.content_hash,mediaType:a.media_type};};
 const conversations:any[]=[],messages:any[]=[];
 for(let c=0;c<count;c++){
  const cid=id(100+c),start=messages.length,amount=c===0?2:1;
  for(let seq=1;seq<=amount;seq++){
   const first=messages[start],source=first?{kind:'CONVERSATION',id:first.id,contentHash:first.content_hash}:null;
   const message={kind:c===0?'USER_INSTRUCTION':'USER_MESSAGE',bodyRef:ref(c%2),attachmentRefs:[],replyTo:source,supersedesInstructionRef:c===0&&seq===2?source:null,effectiveScope:{projectId:pid,stageRefs:[],taskRefs:[]}},authorRef={kind:'HUMAN',userId:actorId},snapshot={conversationId:cid,targetRoleRef:null,message,sourceRefs:[],serverSequence:seq,authorRef};
   messages.push({project_id:pid,conversation_id:cid,sequence:seq,id:id(10000+c*10+seq),author_ref:authorRef,kind:message.kind,body_artifact_id:message.bodyRef.artifactId,source_refs:[],reply_to:source?.id??null,supersedes_instruction_id:message.supersedesInstructionRef?.id??null,effective_scope:message.effectiveScope,message_json:snapshot,content_hash:hash(snapshot),redaction_state:'NOT_REDACTED',client_id:clientId,command_id:id(20000+c*10+seq),recorded_at:at});
  }
  const last=messages.at(-1);conversations.push({id:cid,project_id:pid,target_role_ref:null,head_sequence:amount,created_by:actorId,last_client_id:last.client_id,last_command_id:last.command_id,created_at:at,updated_at:at});
 }
 const tables:Record<string,any[]>={conversations,conversation_messages:messages,artifacts};
 const state={auth:0,rc:0,rr:0,connects:0,releases:0,rollback:0,owner:'OWNER',archived:false,changed:'',failTable:'',overRows:false,duplicate:false,bigRow:false,failBegin:false,failRollback:false,cancelCommit:false,sessionMs:1000,beforeAuth:null as null|((phase:number)=>void),afterCommit:null as null|((phase:number)=>void),afterQuery:null as null|((scope:string,sql:string)=>void)};
 const trace:Array<{scope:string;sql:string;values:unknown[];phase:number}>=[],releaseErrors:unknown[]=[];
 const keys=(table:string)=>table==='conversation_messages'?['conversation_id','sequence']:['id'];
 async function query(scope:string,sql:string,values:unknown[]=[]):Promise<any>{
  trace.push({scope,sql,values:clone(values),phase:state.auth});assert(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|GRANT)\b/i.test(sql),'쓰기0');
  if(/^BEGIN/.test(sql)){assert.equal(scope,'RR');assert(/REPEATABLE READ READ ONLY/.test(sql));if(state.failBegin)throw Error(marker);return{rows:[]};}
  if(/^ROLLBACK/.test(sql)){state.rollback++;if(state.failRollback)throw Error(marker);return{rows:[]};}
  assert(!/^COMMIT/.test(sql));
  if(/set_config/.test(sql)){assert(/statement_timeout/.test(sql));assert(Number(values[0])>0&&Number(values[0])<=input.limits.deadlineMs);return{rows:[]};}
  if(/current_setting|clock_timestamp|pg_current_snapshot/.test(sql)&&!/FROM anvil\./.test(sql))return{rows:[{isolation:scope==='RR'?'repeatable read':'read committed',read_only:scope==='RR'?'on':'off',snapshot:'4:40:',at}]};
  if(/FROM anvil\.projects\b/.test(sql)){assert(values.includes(pid)&&values.includes(actorId));return{rows:[{id:pid,participation:state.owner,archived_at:state.archived?at:null}]};}
  const table=/FROM anvil\.([a-z_]+)/.exec(sql)?.[1];assert(table&&Object.hasOwn(tables,table),'허용3표');assert.equal(scope,'RR');assert(values.includes(pid));assert(!/SELECT\s+(?:\w+\.)?\*/i.test(sql));assert(!/\bOFFSET\b/i.test(sql));assert(!/storage_key|body_utf8/.test(sql));assert(/CASE\s+WHEN/i.test(sql)&&/octet_length|length\s*\(.*::bytea/i.test(sql),'SQL측 크기제한');assert(/LIMIT 200/.test(sql));
  if(state.failTable===table)throw Object.assign(Error(marker),{cause:marker});
  let rows=clone(tables[table]!);const k=keys(table);rows.sort((a,b)=>{for(const key of k){const diff=typeof a[key]==='number'?a[key]-b[key]:String(a[key]).localeCompare(String(b[key]));if(diff)return diff;}return 0;});
  if(table==='artifacts'){const selected=values.flatMap(v=>Array.isArray(v)?v:[]);rows=rows.filter(r=>selected.includes(r.id));}
  // 기존 문서 collector와 같은 명시열 CTE의 마지막 인자는 남은 byte cap이다.
  const params=values.slice(1,-1);if(table!=='artifacts'&&params.length){const position=Array.isArray(params[0])?params[0]:params;if(position[0]!==null&&position[0]!==undefined)rows=rows.filter(r=>{for(let n=0;n<k.length;n++){const a=r[k[n]!],b=position[n];if(a!==b)return a>b;}return false;});}
  rows=rows.slice(0,200);if(state.overRows&&rows.length)rows=Array.from({length:201},()=>clone(rows[0]));else if(state.duplicate&&rows.length)rows.splice(1,0,clone(rows[0]));
  const cap=Number(values.at(-1)),result=rows.map(r=>{const text=JSON.stringify(r),row_bytes=state.bigRow?cap+1:Buffer.byteLength(text);return{inventory_data:row_bytes>cap?null:JSON.parse(text),row_bytes};});state.afterQuery?.(scope,sql);return{rows:result,rowCount:result.length};
 }
 const access={pool:{async connect(){assert.equal(state.rc,0);assert.equal(state.rr,0);state.connects++;state.rr++;return{query:(s:string,v?:unknown[])=>query('RR',s,v),release(error?:unknown){assert.equal(state.rr,1);state.rr--;state.releases++;releaseErrors.push(error);}};}},async authenticated(t:string,c:string|null,body:any){assert.equal(t,token);assert.equal(c,null);assert.equal(state.rr,0);assert.equal(state.rc,0);const phase=++state.auth;state.beforeAuth?.(phase);state.rc++;const actor:any={actorId,clientId,credentialGeneration:1,serverOwner:false,reauthUntil:null,authSession:{id:sessionId,idleExpiresAt:new Date(at.getTime()+state.sessionMs).toISOString(),absoluteExpiresAt:new Date(at.getTime()+600000).toISOString()}};
  if(phase===2&&state.changed){if(state.changed==='session')actor.authSession.id=id(99);else actor[state.changed]=state.changed==='credentialGeneration'?2:id(99);}
  try{const result=await body({query:(s:string,v?:unknown[])=>query('RC',s,v)},actor);state.rc--;if(phase===2&&state.cancelCommit)abort.abort();state.afterCommit?.(phase);return result;}finally{state.rc=0;}
 }}as unknown as AccessRepository;
 return{input,abort,access,tables,conversations,messages,artifacts,state,trace,releaseErrors,run:async()=>{const fn=await collector();return fn(access,token,input,abort.signal);}};
}
function rehash(row:any){row.content_hash=hash(row.message_json);}

test('conversationInventory 정상 양방향 reply·정정·복수대화·중복원문은 원hash/투영hash를 분리한다',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.kind,'CONVERSATION_INVENTORY_V1');assert.equal(r.scope,'CONVERSATION_HISTORY_ONLY');assert.equal(r.projectId,pid);assert.equal(r.conversations.length,2);assert.equal(r.messages.length,3);assert.equal(r.artifacts.length,2);assert.equal(r.messages[1].message.supersedesInstructionRef.id,f.messages[0].id);assert.equal(r.messages[1].message.replyTo.id,f.messages[0].id);
 for(const m of r.messages){const source=f.messages.find(x=>x.id===m.sourceRef.id);assert(source);assert.equal(m.sourceRef.contentHash,source.content_hash);assert.deepEqual(m.author,{kind:'HUMAN'});const{projectionHash,...projection}=m;assert.equal(projectionHash,hash(projection));assert.notEqual(projectionHash,m.sourceRef.contentHash);}
 assert.equal(r.contentHash,hash({projectId:r.projectId,conversations:r.conversations,messages:r.messages,artifacts:r.artifacts,issues:r.issues,externalDependencies:r.externalDependencies}));
 assert.equal(r.usage.fileCount,2);assert.equal(r.usage.inputBytes,f.artifacts.reduce((n,a)=>n+a.bytes,0));assert.equal(r.usage.metadataBytes,Buffer.byteLength(canonicalJson(r)));assert.equal(r.metadataComplete,false,'미수집 command 증빙을 완료로 승격0');assert.equal(r.externalDependencies.length,3);assert(r.externalDependencies.every((e:any)=>e.kind==='COMMAND'&&e.verification==='NOT_PERFORMED'));
 for(const field of ['fullProjectCoverage','restorable'])assert.equal(r[field],false);assert.equal(r.blobVerification,'NOT_PERFORMED');assert.equal(r.observation.isolation,'repeatable read');assert.equal(r.observation.readOnly,true);assert.equal(f.state.rollback,1);assert.equal(f.state.releases,1);assert.equal(f.state.rc,0);assert.equal(f.state.rr,0);
 const text=JSON.stringify(r);for(const secret of [actorId,clientId,sessionId,token,'storage_key','blobs/','created_by','userId'])assert(!text.includes(secret));
});

test('conversationInventory 201대화/202메시지 keyset은 모든 순서를 보존한다',async()=>{const f=fixture(201),r=await f.run();assert.equal(r.conversations.length,201);assert.equal(r.messages.length,202);for(const table of ['conversations','conversation_messages'])assert(f.trace.filter(t=>t.sql.includes('FROM anvil.'+table+' ')).length>=2);assert.equal(r.usage.fileCount,2);});

test('conversationInventory 빈 자료와 누락/오류는 구별한다',async()=>{const f=fixture(0),r=await f.run();assert.deepEqual(r.messages,[]);assert.deepEqual(r.conversations,[]);assert.deepEqual(r.artifacts,[]);assert.equal(r.metadataComplete,true);assert.equal(r.restorable,false);assert.equal(f.state.auth,2);});

test('conversationInventory hash·분리열·author·head 마지막명령·scope 불일치는503',async()=>{
 for(const kind of ['hash','body','author','creator','headClient','headCommand','scope','extra','unsupported']){const f=fixture(),m=f.messages[0];if(kind==='hash')m.content_hash='0'.repeat(64);if(kind==='body')m.body_artifact_id=id(99);if(kind==='author')m.author_ref.userId=id(99);if(kind==='creator')f.conversations[0].created_by=id(99);if(kind==='headClient')f.conversations[0].last_client_id=id(99);if(kind==='headCommand')f.conversations[0].last_command_id=id(99);if(kind==='scope'){m.message_json.message.effectiveScope.projectId=id(99);rehash(m);}if(kind==='extra'){m.message_json.extra='api_key=public-fixture-value';rehash(m);}if(kind==='unsupported'){m.kind=m.message_json.message.kind='AGENT_OUTPUT';rehash(m);}await assert.rejects(f.run(),rejected(503));assert.equal(f.state.rr,0);}
});

test('conversationInventory reply/정정은 이전 같은대화·정확hash·지시종류만 허용',async()=>{
 for(const kind of ['otherConversation','future','hash','targetKind','newKind']){const f=fixture(),m=f.messages[1];if(kind==='otherConversation'){const other=f.messages[2];m.message_json.message.replyTo={kind:'CONVERSATION',id:other.id,contentHash:other.content_hash};m.reply_to=other.id;}if(kind==='future'){m.message_json.message.replyTo={kind:'CONVERSATION',id:m.id,contentHash:m.content_hash};m.reply_to=m.id;}if(kind==='hash')m.message_json.message.supersedesInstructionRef.contentHash='0'.repeat(64);if(kind==='targetKind'){const first=f.messages[0];first.kind=first.message_json.message.kind='USER_MESSAGE';rehash(first);m.message_json.message.replyTo.contentHash=first.content_hash;m.message_json.message.supersedesInstructionRef.contentHash=first.content_hash;}if(kind==='newKind')m.kind=m.message_json.message.kind='USER_MESSAGE';rehash(m);await assert.rejects(f.run(),rejected(503));}
});

test('conversationInventory sequence/참조누락·중복·역범위·page201을 거절',async()=>{
 for(const kind of ['missing','head','duplicate','over','pid','artifactMissing','artifactHash','state']){const f=fixture();if(kind==='missing')f.messages.splice(0,1);if(kind==='head')f.conversations[0].head_sequence=3;if(kind==='duplicate')f.state.duplicate=true;if(kind==='over')f.state.overRows=true;if(kind==='pid')f.messages[0].project_id=id(99);if(kind==='artifactMissing')f.artifacts.pop();if(kind==='artifactHash')f.artifacts[0]!.content_hash='0'.repeat(64);if(kind==='state')f.artifacts[0]!.state='NEW_STATE';await assert.rejects(f.run(),rejected(503));}
});

test('conversationInventory message격리·원문격리/UNKNOWN은 보존하고 bytes완료로 승격0',async()=>{const f=fixture();f.messages[0].redaction_state='QUARANTINED';f.artifacts[0]!.state='QUARANTINED';f.artifacts[0]!.inspection_json={policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'SUSPECTED',reasonCodes:['PRIVATE_KEY_MARKER']} as any;f.artifacts[1]!.inspection_json=null as any;const r=await f.run();assert.equal(r.messages[0].redactionState,'QUARANTINED');assert.equal(r.artifacts[0].state,'QUARANTINED');assert.equal(r.artifacts[1].inspectionStatus,'UNKNOWN');assert(r.issues.length>=3);assert.equal(r.metadataComplete,false);assert(r.artifacts.every((a:any)=>a.blobVerification==='NOT_PERFORMED'));});

test('conversationInventory metadata/원문총량/건수 한도와SQL큰row 제한',async()=>{for(const kind of ['metadataBytes','inputBytes','fileCount','bigRow']){const f=fixture();if(kind==='bigRow')f.state.bigRow=true;else f.input.limits[kind as 'metadataBytes'|'inputBytes'|'fileCount']=1;await assert.rejects(f.run(),rejected(413));assert.equal(f.state.rr,0);assert.equal(f.state.rc,0);}});

test('conversationInventory 입력 accessor/외부snapshot·preabort는 IO0',async()=>{const fn=await collector();for(const kind of ['accessor','extra','abort']){const f=fixture(),input:any=clone(f.input);if(kind==='accessor')Object.defineProperty(input,'limits',{enumerable:true,get(){throw Error(marker);}});if(kind==='extra')input.inventory={};if(kind==='abort')f.abort.abort();await assert.rejects(fn(f.access,token,input,f.abort.signal),rejected(kind==='abort'?409:400));assert.equal(f.state.auth,0);assert.equal(f.state.connects,0);}});

test('conversationInventory OWNER/보관/최종신원세대 변경은 성공0',async()=>{for(const kind of ['owner','archived','actorId','clientId','session','credentialGeneration']){const f=fixture();if(kind==='owner')f.state.owner='VIEWER';else if(kind==='archived')f.state.archived=true;else f.state.changed=kind;await assert.rejects(f.run(),rejected(kind==='owner'||kind==='archived'?404:401));assert.equal(f.state.rr,0);assert.equal(f.state.rc,0);}});

test('conversationInventory DB/BEGIN유실/rollback불명은503·원오류비노출·반납',async()=>{for(const kind of ['query','begin','rollback']){const f=fixture();if(kind==='query')f.state.failTable='conversation_messages';if(kind==='begin')f.state.failBegin=true;if(kind==='rollback')f.state.failRollback=true;await assert.rejects(f.run(),rejected(503));assert.equal(f.state.releases,1);assert.equal(f.state.rr,0);if(kind!=='query')assert(f.releaseErrors[0] instanceof Error,'불명client정상재사용0');}});

test('conversationInventory 최종COMMIT취소·총기한·최초세션기한·회수우선',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);for(const kind of ['cancel','deadline','session','cleanup']){now=0;const f=fixture();f.input.limits.deadlineMs=1000;f.state.sessionMs=500;if(kind==='cancel')f.state.cancelCommit=true;if(kind==='deadline')f.state.afterCommit=phase=>{if(phase===2)now=1001;};if(kind==='session'){f.state.beforeAuth=phase=>{if(phase===2){now=400;f.state.sessionMs=5000;}};f.state.afterCommit=phase=>{if(phase===2)now=501;};}if(kind==='cleanup'){f.state.failRollback=true;f.state.afterQuery=()=>f.abort.abort();}await assert.rejects(f.run(),rejected(kind==='cancel'?409:kind==='cleanup'?503:413));assert.equal(f.state.rc,0);assert.equal(f.state.rr,0);}
});
