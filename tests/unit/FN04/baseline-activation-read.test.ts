import assert from 'node:assert/strict';
import {test} from 'node:test';
import {activationModule,fixture,code,pid,actor,id,hash} from './baseline-activation-fixture.ts';

test('FN04 current NONE은 pointer와 이력이 모두 없는 지원 저장소에서만 반환한다',async()=>{
 const m=await activationModule(),f=fixture(),repo=new m.ProjectBaselineActivations();const value=await repo.current(f.db,actor,pid);
 assert.deepEqual(value,{projectId:pid,current:{state:'NONE'},observedAt:'2026-10-27T10:00:00.000Z',executionAuthorized:false,dispatchPerformed:false});assert.equal(f.state.writes.length,0);
});

test('FN04 current PRESENT와 고정 과거는 정확 snapshot hash·현재 ref를 보존하고 다른OWNER도 이유 없이 읽는다',async()=>{
 const m=await activationModule(),f=fixture(),repo=new m.ProjectBaselineActivations(),first=f.record(),next=f.record(2,first.ref);f.state.history=[first,next];f.state.pointer=next;
 const differentOwner={...actor,actorId:id(70),clientId:id(71)},current=await repo.current(f.db,differentOwner,pid);
 assert.deepEqual(current.current,{state:'PRESENT',activationRef:next.ref,designRef:next.snapshot.approvedDesignRef,planRef:next.snapshot.confirmedPlanRef});
 const value=await repo.read(f.db,differentOwner,pid,first.ref.id,1);assert.deepEqual(value.ref,first.ref);assert.deepEqual(value.snapshot,first.snapshot);assert.deepEqual(value.currentActivationRef,next.ref);assert.equal(value.isCurrent,false);assert.equal(value.executionAuthorized,false);assert.equal(value.dispatchPerformed,false);assert.equal(hash(value.snapshot),value.ref.contentHash);assert(!JSON.stringify(value).includes(f.input.reason));assert.equal(f.state.writes.length,0);
});

test('FN04 schema 미지원·pointer유실·해시/세대 변조는 NONE으로 숨기지 않고503이다',async()=>{
 const m=await activationModule(),repo=new m.ProjectBaselineActivations();
 for(const mode of ['SCHEMA','LOST_POINTER','HASH','GENERATION']){const f=fixture(),r=f.record();if(mode==='SCHEMA')f.state.broken=true;else{f.state.history=[r];f.state.pointer=mode==='LOST_POINTER'?null:r;if(mode==='HASH')r.snapshot.candidatePayloadHash='f'.repeat(64);if(mode==='GENERATION'){r.snapshot.generation=2;r.ref.contentHash=hash(r.snapshot);}}
  await assert.rejects(()=>repo.current(f.db,actor,pid),code('BASELINE_ACTIVATION_STORAGE_UNAVAILABLE',503));assert.equal(f.state.writes.length,0);
 }
});

test('FN04 OWNER회수·타프로젝트·고정이력미존재는404이며 다른client조회는현재권한과분리한다',async()=>{
 const m=await activationModule(),repo=new m.ProjectBaselineActivations();
 for(const member of [null,'VIEWER','HANDOFF_ELIGIBLE']){const f=fixture();f.state.member=member;await assert.rejects(()=>repo.current(f.db,actor,pid),code('NOT_FOUND',404));}
 const f=fixture();await assert.rejects(()=>repo.read(f.db,actor,id(99),id(101),1),code('NOT_FOUND',404));
 await assert.rejects(()=>repo.read(f.db,actor,pid,id(101),1),code('NOT_FOUND',404));assert.equal(f.state.writes.length,0);
});

test('FN04 두GET은pointer/이력/fixed를단일statement snapshot으로검사한다',async()=>{
 const m=await activationModule(),f=fixture(),repo=new m.ProjectBaselineActivations(),r=f.record();f.state.history=[r];f.state.pointer=r;await repo.current(f.db,actor,pid);await repo.read(f.db,actor,pid,r.ref.id,r.ref.version);const projections=f.state.calls.filter((v:any)=>v.sql.includes('fn04_activation_snapshot'));assert.equal(projections.length,2);assert(projections.every((v:any)=>v.sql.includes('baseline_activation_current')&&v.sql.includes('baseline_activations')&&v.sql.includes('fixed_row')&&v.sql.includes('transaction_timestamp()')));assert.equal(f.state.calls.filter((v:any)=>v.sql.includes('baseline_activations')&&!v.sql.includes('fn04_activation_snapshot')).length,0);assert.deepEqual(f.state.writes,[]);
});

test('FN04 읽기검증함수체인의STABLE선언은호출statement snapshot계약이며본문주석으로대체할수없다',async()=>{
 const {readFile}=await import('node:fs/promises'),sql=await readFile(new URL('../../../db/migrations/0050_design_baseline_activations.sql.pending',import.meta.url),'utf8');
 // PostgreSQL을실행하지않는선언검사다. 실제PG동시성/COMMIT증거가아니다.
 function definitions(source:string){const starts=[...source.matchAll(/^[ \t]*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+anvil\.([a-z0-9_]+)\s*\(/gim)],found=new Map<string,{header:string;body:string}>();
  for(let n=0;n<starts.length;n++){const item=starts[n]!,section=source.slice(item.index,starts[n+1]?.index??source.length).replace(/--[^\r\n]*|\/\*[\s\S]*?\*\//g,' '),as=/\bAS\s+(\$[a-z0-9_]*\$)/i.exec(section);assert(as,'함수AS/body경계가필요하다');const end=section.indexOf(as[1]!,as.index+as[0].length);assert(end>=0,'함수body종료경계가필요하다');found.set(item[1]!,{header:section.slice(0,as.index).replace(/'(?:''|[^'])*'|"(?:""|[^"])*"/g,' '),body:section.slice(as.index+as[0].length,end)});
  }return found;
 }
 const stable=(header:string)=>/\bSTABLE\b/i.test(header)&&!/\b(?:VOLATILE|IMMUTABLE)\b/i.test(header);
 for(const sample of ["CREATE FUNCTION anvil.example() RETURNS boolean LANGUAGE sql AS $$ SELECT 'STABLE'; $$;","CREATE FUNCTION anvil.example() RETURNS boolean LANGUAGE sql /* STABLE */ AS $$ SELECT true; $$;","CREATE FUNCTION anvil.example() RETURNS boolean LANGUAGE sql AS $$ SELECT true; -- STABLE\n$$;"]){assert.equal(stable(definitions(sample).get('example')!.header),false,'본문/comment의단어는함수volatility선언이아니다');}
 const functions=definitions(sql),readers=['fn04_activation_history_valid','fn04_activation_candidate_valid'];for(const name of readers){const definition=functions.get(name);assert(definition,'실제읽기검증함수정의가필요하다');assert(stable(definition.header),name+'의AS이전STABLE선언이없으면중첩조회가새snapshot을얻을수있다');}
 // history→candidate→payload의새읽기체인이VOLATILE현재성/시각guard를소비하면안된다.
 const pending=[readers[0]!],visited=new Set<string>();while(pending.length){const name=pending.pop()!;if(visited.has(name))continue;visited.add(name);const definition=functions.get(name);assert(definition);assert(/\b(?:STABLE|IMMUTABLE)\b/i.test(definition.header)&&!/\bVOLATILE\b/i.test(definition.header),name+'의읽기체인volatility가snapshot계약을깨뜨린다');assert(!/\bclock_timestamp\s*\(|\b(?:INSERT|UPDATE|DELETE)\b/i.test(definition.body),'읽기검증에는현재시각/변경guard를섞지않는다');for(const child of definition.body.matchAll(/\banvil\.(fn04_activation_[a-z0-9_]+)\s*\(/gi))pending.push(child[1]!);}
 assert(visited.has(readers[1]!),'고정이력검증은후보의불변귀속검사를소비한다');
});
