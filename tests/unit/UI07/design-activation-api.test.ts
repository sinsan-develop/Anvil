import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {fixture,pid,actor,id,hash,at} from '../FN04/baseline-activation-fixture.ts';
const session={user:{id:actor.actorId},clientId:actor.clientId,csrfToken:'C'.repeat(43)};
async function api(){const url=new URL('../../../apps/web/src/features/design-change/activation-api.ts',import.meta.url);const m=await import(url.href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.url===url.href)return null;throw e;});assert(m,'UI07 공개 적용 준비·명시 전송·current/fixed 보호 reader가 아직 없다');return m as any;}
const error=(code:string,status?:number)=>(e:any)=>e?.code===code&&(status===undefined||e.status===status);
const current=(f:ReturnType<typeof fixture>,present=false)=>({projectId:pid,current:present?{state:'PRESENT',activationRef:f.record().ref,designRef:f.input.approvedDesignRef,planRef:f.input.confirmedPlanRef}:{state:'NONE'},observedAt:at,executionAuthorized:false,dispatchPerformed:false});
const fixed=(f:ReturnType<typeof fixture>)=>({projectId:pid,...f.record(),currentActivationRef:f.record().ref,isCurrent:true,observedAt:at,executionAuthorized:false,dispatchPerformed:false});

test('UI07 current NONE/PRESENT는기존정확DTO만읽고권한/저장오류를NONE으로바꾸지않는다',async()=>{
 const m=await api(),f=fixture(),calls:any[]=[],client=new ApiClient(async(path,options)=>{calls.push({path,options});return Response.json(current(f));});
 assert.deepEqual(await m.readCurrentActivation(client,pid,()=>true),current(f));assert.equal(calls[0].path,`/api/v1/projects/${pid}/baseline-activations/current`);assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.redirect,'error');
 client.transport=async()=>Response.json(current(f,true));assert.deepEqual(await m.readCurrentActivation(client,pid,()=>true),current(f,true));
 for(const status of [401,403,404,503]){client.transport=async()=>Response.json({code:status===503?'BASELINE_ACTIVATION_STORAGE_UNAVAILABLE':'NOT_FOUND'},{status});await assert.rejects(()=>m.readCurrentActivation(client,pid,()=>true),(e:any)=>e.status===status);}
 client.transport=async()=>Response.json({...current(f),authorized:true});await assert.rejects(()=>m.readCurrentActivation(client,pid,()=>true));
 const before=calls.length;assert.equal(await m.readCurrentActivation(client,pid,()=>false),null);assert.equal(calls.length,before);
});

test('UI07 fixed조회는서버18필드snapshot/fullrefhash·현재대응을대조하고reason을추가하지않는다',async()=>{
 const m=await api(),f=fixture(),calls:string[]=[],client=new ApiClient(async path=>{calls.push(String(path));return Response.json(fixed(f));});
 const value=await m.readFixedActivation(client,pid,f.record().ref,()=>true);assert.deepEqual(value,fixed(f));assert.equal(Object.keys(value.snapshot).length,18);assert.equal(hash(value.snapshot),value.ref.contentHash);assert.equal(Object.hasOwn(value.snapshot,'reason'),false);assert.equal(calls[0],`/api/v1/projects/${pid}/baseline-activations/${f.record().ref.id}/versions/1`);
 for(const alter of [(v:any)=>v.snapshot.candidatePayloadHash='f'.repeat(64),(v:any)=>v.snapshot.reason='다른 공개 원문',(v:any)=>v.isCurrent=false,(v:any)=>v.projectId=id(99)]){const v=fixed(f);alter(v);client.transport=async()=>Response.json(v);await assert.rejects(()=>m.readFixedActivation(client,pid,f.record().ref,()=>true));}
});

test('UI07 준비는exact5입력/reason과현재pointer를원명령에동결하고같은ID재확인을보존한다',async()=>{
 const m=await api(),f=fixture(),client=new ApiClient(),b=m.newDesignActivation(client,pid,session,1,f.input,current(f)),c=await m.prepareDesignActivation(b,session);
 assert.equal(c.operation,'activateDesignChange');assert.equal(c.targetId,f.input.changeRef.id);assert.equal(c.expectedVersion,f.input.changeRef.version);assert.deepEqual(c.payload,f.input);assert.equal(c.payload.reason,f.input.reason);assert.deepEqual(c.baselineRefs,[]);assert.equal(c.approvalRef,null);assert.deepEqual(Object.keys(c.payload).sort(),['approvedDesignRef','changeRef','confirmedPlanRef','impactRef','reason']);
 const again=await m.prepareDesignActivation({...b,pending:c},session);assert.deepEqual(again,c);assert.equal(hash(again.payload),hash(f.input));
 const follow=m.newDesignActivation(client,pid,session,1,f.input,current(f,true)),next=await m.prepareDesignActivation(follow,session);assert.deepEqual(next.baselineRefs,[f.record().ref]);
 await assert.rejects(async()=>m.prepareDesignActivation({...b,pending:c},{...session,user:{id:id(90)}}));await assert.rejects(async()=>m.prepareDesignActivation({...b,pending:c},{...session,csrfToken:'D'.repeat(43)}));
});

test('UI07 session/user/client/transport/선택ABA는이전조회토큰을회수하고후속GET0이다',async()=>{
 const m=await api(),f=fixture(),client=new ApiClient(async()=>{throw Error('호출금지');}),scope=new m.ActivationScope(),selection={changeRef:f.input.changeRef,impactRef:f.input.impactRef};
 for(const kind of ['user','device','csrf','client','transport','selection']){scope.bind(client,session,pid,selection);const active=scope.capture(),transport=client.transport;
  const otherClient=kind==='client'?new ApiClient(transport):client,otherSession=kind==='user'?{...session,user:{id:id(90)}}:kind==='device'?{...session,clientId:id(90)}:kind==='csrf'?{...session,csrfToken:'D'.repeat(43)}:session;if(kind==='transport')client.transport=async()=>Response.json(current(f));
  scope.bind(otherClient,otherSession,pid,kind==='selection'?{...selection,impactRef:{...selection.impactRef,version:3}}:selection);client.transport=transport;scope.bind(client,session,pid,selection);assert.equal(active(),false);assert.equal(await m.readCurrentActivation(client,pid,active),null);
 }
});

test('UI07 412/유실은원입력·원명령을바꾸지않고명시재확인만같은POST를한다',async()=>{
 const m=await api(),f=fixture(),c=structuredClone(f.command),before=structuredClone(c),calls:any[]=[],client=new ApiClient(async(_path,options)=>{calls.push({body:JSON.parse(String(options?.body)),options});return Response.json({code:'DESIGN_ACTIVATION_NOT_READY'},{status:412});});
 await assert.rejects(()=>m.sendDesignActivation(client,c,session,()=>true),error('DESIGN_ACTIVATION_NOT_READY',412));assert.deepEqual(c,before);assert.equal(calls.length,1);assert.equal((calls[0].options.headers as any)['X-Anvil-CSRF'],session.csrfToken);assert.equal((calls[0].options.headers as any)['Idempotency-Key'],c.commandId);
 client.transport=async(_path,options)=>{calls.push({body:JSON.parse(String(options?.body)),options});throw Error('synthetic-private-dsn');};await assert.rejects(()=>m.sendDesignActivation(client,c,session,()=>true),error('CONNECTION_LOST'));assert.deepEqual(c,before);assert.deepEqual(calls[1].body,before);
 client.transport=async(_path,options)=>{calls.push({body:JSON.parse(String(options?.body)),options});const r=f.record();return Response.json({operationId:id(80),projectId:pid,commandId:c.commandId,status:'APPLIED',targetId:r.ref.id,version:r.ref.version,data:{status:'DESIGN_BASELINE_ACTIVATED',...r,executionAuthorized:false,dispatchPerformed:false},serverReceivedAt:at});};const value=await m.sendDesignActivation(client,c,session,()=>true);assert.deepEqual(value.data.snapshot,f.record().snapshot);assert.deepEqual(calls[2].body,before);assert.deepEqual(c,before);
});

test('UI07 늦은JSON·transport교체는적용영수증을다른문맥에수집하지않는다',async()=>{
 const m=await api(),f=fixture();let release!:()=>void,started!:()=>void;const begun=new Promise<void>(resolve=>started=resolve),client=new ApiClient(async()=>{started();await new Promise<void>(resolve=>release=resolve);const r=f.record();return Response.json({operationId:id(80),projectId:pid,commandId:f.command.commandId,status:'APPLIED',targetId:r.ref.id,version:r.ref.version,data:{status:'DESIGN_BASELINE_ACTIVATED',...r,executionAuthorized:false,dispatchPerformed:false},serverReceivedAt:at});}),scope=new m.ActivationScope();scope.bind(client,session,pid,f.input);const pending=m.sendDesignActivation(client,f.command,session,scope.capture());await begun;client.transport=async()=>Response.json({});scope.bind(client,session,pid,f.input);release();assert.equal(await pending,null);
});
