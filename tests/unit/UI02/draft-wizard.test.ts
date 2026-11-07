import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptyDraft} from '../../../apps/web/src/features/project-create/api.ts';
const m:any=await import(new URL('../../../apps/web/src/features/project-create/draft-wizard.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const uid='97000000-0000-4000-8000-000000000001',did='97000000-0000-4000-8000-000000000002';
function fixture():any{return{...emptyDraft(),ownerUserId:uid,draftId:did,version:2,wizardStep:2,input:{...emptyDraft().input,name:'이름',purpose:'왜',desiredOutcome:'기대',sourceMode:'EXISTING',sourceDeclaration:{hostLabel:'PC',displayName:'소스',pathHint:'D:/Synthetic/NotOpened',reason:'선언'}}};}
function move(b:any,target:number,busy=false,editable=true){assert.equal(typeof m.moveDraftWizardStep,'function','4단계 이동/보존 미구현');return m.moveDraftWizardStep(b,uid,target,busy,editable);}
test('기존 저장4단계와 동일 명령의 pending step을 복원한다',()=>{
 assert.equal(typeof m.draftWizardStep,'function');for(const step of [1,2,3,4])assert.equal(m.draftWizardStep({...fixture(),wizardStep:step}),step);
 const f=fixture();f.pendingCommand={draftId:did,body:{step:4},fingerprint:'고정'};assert.equal(m.draftWizardStep(f),4);assert.equal(m.draftWizardStep(emptyDraft()),1);
});
test('인접 이전/다음은 단계만 바꾸고 원입력·검토·명령·서버 버전을 보존한다',()=>{
 const f=fixture(),before=structuredClone(f),next=move(f,3);assert.equal(next.wizardStep,3);const {wizardStep,...rest}=next,{wizardStep:oldStep,...old}=before;assert.deepEqual(rest,old);assert.deepEqual(f,before);assert.equal(move(next,4).wizardStep,4);assert.equal(move(next,2).wizardStep,2);
});
test('잘못된 이동·소유자·pending·dirty 전진은 차단하되 읽기 전용 이전과 원입력은 보존한다',()=>{
 for(const f of [{...fixture(),ownerUserId:did},{...fixture(),pendingAction:{kind:'create'}},{...fixture(),pendingCommand:{body:{step:2}}},{...fixture(),dirty:true}]){const before=structuredClone(f);assert.equal(move(f,3),null);assert.deepEqual(f,before);}
 assert.equal(move(fixture(),3,true),null);assert.equal(move(fixture(),3,false,false),null);for(const n of [0,2,4,5,1.5])assert.equal(move(fixture(),n),null);assert.equal(move({...fixture(),dirty:true},1,false,false).wizardStep,1);
});
