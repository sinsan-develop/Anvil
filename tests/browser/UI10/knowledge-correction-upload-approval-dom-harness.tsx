import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import '../../../apps/web/src/styles/tokens.css';
import '../../../apps/web/src/styles/app.css';
import {KnowledgeCorrectionForm} from '../../../apps/web/src/features/knowledge/KnowledgeCorrectionForm.tsx';
import {newKnowledgeCorrection,type KnowledgeCorrectionBuffer} from '../../../apps/web/src/features/knowledge/correction-api.ts';
const w=window as any,s=w.__knowledgeCorrectionUploadSeed;
function stable(v:any):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}
async function hash(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const qa=w.__knowledgeCorrectionUploadQA={calls:[] as any[],uploads:[] as any[],writes:[] as any[],raw:[] as number[][],unknown:[] as string[],deniedReads:[] as {path:string;method:string;status:404;response:{code:string}}[],buffer:null as KnowledgeCorrectionBuffer|null,view:null as any,policy:null as any,generation:7,target:null as any,saved:0,closed:0,lostUpload:false,lostRequest:false,saveDenied:false,requestDenied:false,delayApproval:false,releases:new Map<number,()=>void>(),change:(_value:string)=>{},approve:async()=>{},authLost:0};
const policyBody={rules:[{ruleId:'UPLOAD',subjectRef:{kind:'HUMAN',userId:s.uid},operations:['uploadArtifact'],targetScopes:[{kind:'PROJECT',projectId:s.pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:new Date(Date.now()+300000).toISOString()}],reason:'기존 업로드 일회 승인',reviewRefs:[]};
const policyReady=(async()=>{qa.policy={ref:{id:s.aid,version:1,contentHash:await hash(policyBody)},...policyBody,createdAt:s.at};const body='기존 원문',entry={kind:'FACT',title:'기존 관측',contentRef:{artifactId:s.did,bytes:new TextEncoder().encode(body).length,contentHash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))].map(n=>n.toString(16).padStart(2,'0')).join(''),mediaType:'text/plain;charset=utf-8'},sourceRefs:[{kind:'CONVERSATION',id:s.uid,contentHash:'b'.repeat(64)}],reason:'기존 이유',scope:{projectId:s.pid,stageRefs:[],taskRefs:[]},relatedRefs:[]};qa.target={ref:{id:s.kid,version:1,contentHash:await hash(entry)},entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:s.did,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:s.uid},recordedAt:s.at}]};})();
async function makeRequest(c:any){const snapshot={projectId:s.pid,details:c.payload.details,scopeDigest:await hash(c.payload.details.actionScope),requiredDecider:{kind:'HUMAN',userId:s.uid},policyRef:qa.policy.ref,requestedBy:{kind:'HUMAN',userId:s.uid,clientId:s.device},controlGeneration:7};qa.view={request:{id:s.rid,version:1,status:'PENDING',...snapshot,createdAt:s.at},requestRef:{id:s.rid,version:1,contentHash:await hash(snapshot)},currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:s.at};}
async function approve(reason='별도 UI08 합성 결정'){const v=qa.view,body={requestId:s.rid,requestVersion:1,requestRef:v.requestRef,scopeDigest:v.request.scopeDigest,decision:'APPROVE',reason,decidedBy:v.request.requestedBy,controlGeneration:7,policyRef:qa.policy.ref};v.currentVersion=2;v.storedStatus='APPROVED';v.effectiveState='APPROVED';v.decision={id:s.did,...body,ref:{id:s.did,version:1,contentHash:await hash(body)},decidedAt:s.at};}qa.approve=approve;
async function transport(input:any,init?:RequestInit):Promise<Response>{
 await policyReady;const path=String(input),method=init?.method??'GET',call={path,method,jsonStarted:false,settled:false},index=qa.calls.length;qa.calls.push(call);const base='/api/v1/projects/'+s.pid;
 const json=(data:any,status=200)=>{call.settled=true;return Response.json(data,{status});};
 const receipt=(c:any,data:any,targetId:string,version:number|null)=>json({operationId:s.aid,commandId:c.commandId,projectId:s.pid,status:'APPLIED',targetId,version,data,serverReceivedAt:s.at});
 if(method==='GET'&&(path==='/api/v1/projects/'+s.other+'/conversations?limit=50'||path==='/api/v1/projects/'+s.other+'/knowledge?query=&limit=50')){const response={code:'NOT_FOUND'};qa.deniedReads.push({path,method,status:404,response});return json(response,404);}
 if(method==='GET'&&path==='/api/v1/session')return json({user:{id:s.uid,displayName:'합성 사용자'},clientId:s.device,csrfToken:'C'.repeat(43)});
 if(method==='GET'&&path===base)return json({id:s.pid,name:'합성 지식',purpose:'원문 보관',desiredOutcome:'별도 승인',version:1,createdAt:s.at,updatedAt:s.at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:s.uid,clientId:s.device,generation:qa.generation}});
 if(method==='GET'&&path===base+'/permission-policy')return json({configured:true,policy:qa.policy});
 if(method==='GET'&&path===base+'/approvals/'+s.rid){if(qa.delayApproval){qa.delayApproval=false;return{ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>{call.jsonStarted=true;await new Promise<void>(resolve=>qa.releases.set(index,resolve));call.settled=true;return qa.view;}} as Response;}return json(qa.view);}
 if(method==='GET'&&path.startsWith(base+'/knowledge?'))return json({items:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:s.at});
 if(method==='GET'&&path.startsWith(base+'/conversations?'))return json({items:[],hasMore:false,nextCursor:null,observedAt:s.at});
 if(method==='GET'&&path.startsWith('/api/v1/projects?'))return json({items:[],hasMore:false,nextCursor:null,observedAt:s.at,baselineVersion:null});
 if(method==='POST'&&path===base+'/files'){
  const c=JSON.parse(new Headers(init?.headers).get('X-Anvil-Command')!);qa.uploads.push(c);qa.raw.push(Array.from(new Uint8Array(await new Response(init?.body).arrayBuffer())));
  if(c.approvalRef===null)return json({code:'APPROVAL_REQUIRED'},412);
  const view=qa.view;view.currentVersion=3;view.storedStatus='CONSUMED';view.effectiveState='CONSUMED';view.consumption={id:s.aid,status:'CONSUMED',commandId:c.commandId,serverCommandId:s.aid,requestHash:await hash(c),scopeDigest:view.request.scopeDigest,policyRef:qa.policy.ref,consumedAt:s.at};
  if(qa.lostUpload){qa.lostUpload=false;call.settled=true;throw Error('SYNTHETIC_UPLOAD_LOST');}
  return receipt(c,{status:'ARTIFACT_READY',artifactRef:{artifactId:s.aid,...c.payload}},s.aid,null);
 }
 if(method==='POST'&&path===base+'/commands'){
  const c=JSON.parse(String(init?.body));qa.writes.push(c);
  if(c.operation==='requestApproval'){if(qa.requestDenied)return json({code:'APPROVAL_INPUT_INVALID'},422);await makeRequest(c);if(qa.lostRequest){qa.lostRequest=false;call.settled=true;throw Error('SYNTHETIC_REQUEST_LOST');}return receipt(c,{status:'APPROVAL_REQUESTED',ref:qa.view.requestRef,request:qa.view.request},s.rid,1);}
  if(c.operation==='correctKnowledge'){if(qa.saveDenied)return json({code:'APPROVAL_REQUIRED'},412);const ref={id:s.kid,version:2,contentHash:await hash(c.payload.entry)};return receipt(c,{status:'PROPOSED',ref,entry:c.payload.entry,baseRef:c.payload.baseRef,supersedesRef:c.payload.baseRef,reason:c.payload.reason,changeSources:c.payload.sourceRefs,eventId:s.did},s.kid,2);}
 }
 qa.unknown.push(method+' '+path);return json({code:'UNEXPECTED_SYNTHETIC_REQUEST'},500);
}
w.__knowledgeCorrectionUploadTransport=transport;
function Harness(){
 const [context,setContext]=useState('A'),[buffer,setBuffer]=useState<KnowledgeCorrectionBuffer|null>(()=>({...newKnowledgeCorrection(s.pid,qa.target,{user:{id:s.uid},clientId:s.device,csrfToken:'C'.repeat(43)},7),title:'정정 관측',body:s.body,reason:'현재 이유',changeReason:'새 근거에 따른 정정',dirty:true}));
 const session=useMemo(()=>({user:{id:context==='ACTOR'?s.other:s.uid},clientId:context==='CLIENT'?s.other:s.device,csrfToken:'C'.repeat(43)}),[context]),client=useMemo(()=>new ApiClient(transport),[context]);
 qa.buffer=buffer;qa.change=value=>flushSync(()=>{qa.generation=value==='CONTROL'?8:7;setContext(value);});
 const shown=buffer&&context==='PROJECT'?{...buffer,projectId:s.other}:buffer&&context==='CONTROL'?{...buffer,controlGeneration:8}:buffer&&context==='TARGET'?{...buffer,target:{...buffer.target,ref:{...buffer.target.ref,id:s.other}}}:buffer;
 return shown?<KnowledgeCorrectionForm client={client} session={session} buffer={shown} onChange={setBuffer} onSaved={()=>qa.saved++} onAuthenticationLost={()=>qa.authLost++}/>:<p>정정 입력 닫힘</p>;
}
void policyReady.then(()=>createRoot(document.getElementById('root')!).render(<Harness/>));
