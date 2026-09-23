import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const moduleUrl=new URL('../src/app/c28-console.js',import.meta.url);
async function api(){assert.ok(existsSync(moduleUrl),'C28 interaction module missing');return import(moduleUrl.href);}

test('initial mockup never claims user confirmation, runtime data or deploy readiness',async()=>{
  const m=await api(),s=m.createState(),v=m.view(s);
  assert.equal(v.mode,'MOCKUP_ONLY');assert.equal(v.userConfirmation,'PENDING');
  assert.equal(v.integrationAllowed,false);assert.equal(v.runtime,'NOT_EXECUTED');
  assert.equal(s.menu,'team');assert.equal(s.condition,'ready');assert.ok(Object.isFrozen(s));
});

for(const [menu,title] of [['team','Agent Team'],['moa','MoA'],['sns','SNS / Daon User'],['adapters','보조 채널']]){
  test(`menu ${menu} is reachable without a request`,async()=>{
    const m=await api(),s=m.transition(m.createState(),{type:'MENU',value:menu});
    assert.equal(m.view(s).title,title);assert.match(m.render(s),new RegExp(title));
    assert.equal(m.view(s).requestCount,0);
  });
}

for(const [condition,text] of [['permission','권한 없음'],['error','오류'],['empty','결과 없음'],['offline','오프라인']]){
  test(`state ${condition} is explicit and blocks commands`,async()=>{
    const m=await api(),s=m.transition(m.createState(),{type:'CONDITION',value:condition});
    assert.match(m.render(s),new RegExp(text));assert.equal(m.view(s).canRequest,false);
    assert.equal(m.transition(s,{type:'REQUEST_CONTROL',value:'pause'}).notice,'ACTION_BLOCKED');
  });
}

test('pause/resume are draft-only and cannot mutate a run',async()=>{
  const m=await api();for(const command of ['pause','resume']){
    const s=m.transition(m.createState(),{type:'REQUEST_CONTROL',value:command});
    assert.equal(s.notice,'REQUESTED_NOT_APPLIED');assert.equal(m.view(s).requestCount,0);
    assert.equal(m.view(s).runtime,'NOT_EXECUTED');
  }
});

for(const action of ['approve','apply','deploy','delete','provider','permission']){
  test(`${action} requires reconfirm but confirmation never grants authority`,async()=>{
    const m=await api(),s=m.transition(m.createState(),{type:'HIGH_RISK',value:action});
    assert.equal(s.modal,action);assert.match(m.render(s),/aria-modal="true"/);
    const next=m.transition(s,{type:'RECONFIRM'});
    assert.equal(next.notice,'HUMAN_APPROVAL_REQUIRED');assert.equal(next.modal,null);
    assert.equal(m.view(next).integrationAllowed,false);assert.equal(m.view(next).requestCount,0);
  });
}

test('cancel closes reconfirm and switching menu clears stale confirmation',async()=>{
  const m=await api(),s=m.transition(m.createState(),{type:'HIGH_RISK',value:'deploy'});
  assert.equal(m.transition(s,{type:'CANCEL'}).modal,null);
  assert.equal(m.transition(s,{type:'MENU',value:'moa'}).modal,null);
});

test('team view includes role trace, provider/model, artifact/evidence and honest readiness',async()=>{
  const m=await api(),html=m.render(m.createState());
  for(const label of ['ORCH','CODE','REVIEW','TEST','DEPLOY','parent','child','model','provider','artifact','evidence','NOT_EXECUTED'])assert.ok(html.includes(label),label);
});

test('MoA and adapter views retain provenance, manual-only and OPEN_DECISION boundaries',async()=>{
  const m=await api(),moa=m.render(m.transition(m.createState(),{type:'MENU',value:'moa'}));
  for(const label of ['proposal','critique','synthesis','provenance','Main'])assert.ok(moa.includes(label));
  const adapters=m.render(m.transition(m.createState(),{type:'MENU',value:'adapters'}));
  assert.match(adapters,/Telegram/);assert.match(adapters,/Kakao/);assert.match(adapters,/OPEN_DECISION/);
});

for(const path of ['https://example.test/a','//internal/path','http://localhost:8000','/\\evil','/api/../secret','/api/%2e%2e/secret','/api/path?token=value']){
  test(`unsafe handoff path rejected ${path}`,async()=>{
    const m=await api();assert.throws(()=>m.sameOriginPath(path),/PATH_INVALID/);
  });
}

test('relative handoff is inert and exact',async()=>{
  const m=await api();assert.equal(m.sameOriginPath('/api/agent-console/team'),'/api/agent-console/team');
});

test('hostile getters and unknown events cannot change approved schema',async()=>{
  const m=await api();let calls=0;const event={type:'MENU',get value(){calls++;return 'team';}};
  assert.throws(()=>m.transition(m.createState(),event),/INPUT_INVALID/);assert.equal(calls,0);
  assert.throws(()=>m.transition(m.createState(),{type:'APPROVED',value:true}),/EVENT_INVALID/);
  assert.throws(()=>m.transition(m.createState(),{type:'MENU',value:'<script>x</script>'}),/MENU_INVALID/);
});

test('JSON handoff cannot enable integration before real user confirmation',async()=>{
  await api();const c=JSON.parse(readFileSync(new URL('../../../docs/evidence/ui/C-28_INTERACTION_CONTRACT.json',import.meta.url),'utf8'));
  assert.equal(c.schema,'c28-interaction/v1');assert.equal(c.user_confirmation.status,'PENDING');
  assert.equal(c.user_confirmation.evidence_ref,null);assert.equal(c.integration.status,'BLOCKED_USER_CONFIRMATION');
  assert.deepEqual(c.owners,['C-22','C-23','C-24','C-25','C-26','C-27']);
  const m=await api();for(const r of c.handoff){assert.equal(r.status,'PROPOSED_NOT_IMPLEMENTED');assert.equal(r.method,'GET');assert.equal(m.sameOriginPath(r.path),r.path);}
});

function rootFixture(){
  const listeners=new Map(),focus=[];
  const first={focus:()=>focus.push('first')},last={focus:()=>focus.push('last')};
  const root={innerHTML:'',addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k),
    contains:button=>button.inside!==false,querySelector:()=>({focus:()=>focus.push('selected')}),querySelectorAll:()=>[first,last]};
  const click=(type,value,options={})=>listeners.get('click')({target:{closest:()=>({dataset:{event:type,...(value?{value}: {})},...options})}});
  return {root,listeners,focus,first,last,click};
}

test('mount binds real interaction reducer and removes handlers without IO',async()=>{
  const m=await api(),f=rootFixture(),app=m.mount(f.root);
  f.click('MENU','sns');assert.equal(app.getState().menu,'sns');assert.match(f.root.innerHTML,/SNS \/ Daon User/);
  f.click('REQUEST_CONTROL','pause');assert.equal(app.getState().notice,'REQUESTED_NOT_APPLIED');
  f.click('MENU','team',{inside:false});assert.equal(app.getState().menu,'sns');
  f.click('MENU','team',{disabled:true});assert.equal(app.getState().menu,'sns');
  app.unmount();assert.equal(f.listeners.size,0);
});

test('dialog initial focus keeps Shift Tab inside; Escape closes without approval',async()=>{
  const m=await api(),f=rootFixture(),app=m.mount(f.root);f.click('HIGH_RISK','deploy');
  let prevented=0;f.listeners.get('keydown')({key:'Tab',shiftKey:true,target:{},preventDefault:()=>prevented++});
  assert.equal(f.focus.at(-1),'last');assert.equal(prevented,1);
  f.listeners.get('keydown')({key:'Escape',preventDefault:()=>prevented++});
  assert.equal(app.getState().modal,null);assert.equal(m.view(app.getState()).integrationAllowed,false);
});

test('modal Tab cycles last to first and cancel publishes no approval',async()=>{
  const m=await api(),f=rootFixture(),app=m.mount(f.root);f.click('HIGH_RISK','apply');
  f.listeners.get('keydown')({key:'Tab',shiftKey:false,target:f.last,preventDefault:()=>{}});
  assert.equal(f.focus.at(-1),'first');f.click('CANCEL');assert.equal(app.getState().modal,null);
  assert.equal(app.getState().notice,'');
});
