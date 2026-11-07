import{AuthFailure}from'../access/repository.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{exactKeys}from'./work-plan-card.ts';
export interface ImpactTargetRef{kind:'DOCUMENT_VERSION'|'DESIGN_ITEM'|'SCREEN_REGION'|'PLAN_TASK'|'EXECUTION'|'TEST_EVIDENCE';id:string;versionRef:VersionRef;localCode?:string;anchor?:string}
export interface ImpactTarget{ref:ImpactTargetRef;designRefs:VersionRef[];dependencies:ImpactTargetRef[]}
export interface ImpactItem{targetRef:ImpactTargetRef;state:'AFFECTED'|'UNKNOWN';reason:string;evidenceRefs:never[]}
export interface ImpactGap{code:string;targetRef?:ImpactTargetRef}
export function isImpactTargetRef(v:unknown):v is ImpactTargetRef{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['kind','id','versionRef','localCode','anchor'].includes(k)))return false;const r=v as ImpactTargetRef;
 return['DOCUMENT_VERSION','DESIGN_ITEM','SCREEN_REGION','PLAN_TASK','EXECUTION','TEST_EVIDENCE'].includes(r.kind)&&isVersionRef({id:r.id,version:1,contentHash:'0'.repeat(64)})&&isVersionRef(r.versionRef)&&(r.localCode===undefined||typeof r.localCode==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(r.localCode))&&(r.anchor===undefined||typeof r.anchor==='string'&&/^line:[1-9][0-9]{0,7}$/.test(r.anchor))&&(r.kind!=='PLAN_TASK'||r.id===r.versionRef.id&&!!r.localCode&&r.anchor===undefined)&&(r.kind!=='DOCUMENT_VERSION'||r.id===r.versionRef.id&&r.localCode===undefined&&r.anchor===undefined);
}
/** 호출자가 영속 자료·프로젝트·원문 hash를 검증한 참조만 전달한다. 의미 판단/실행 관측을 대신하지 않는다. */
export function calculateDesignImpact(beforeRef:VersionRef,value:unknown,scopeTruncated:boolean){
 if(!isVersionRef(beforeRef)||typeof scopeTruncated!=='boolean'||!Array.isArray(value)||value.length>2000)throw new AuthFailure('IMPACT_INPUT_INVALID',422);
 const targets:ImpactTarget[]=[],keys=new Set<string>(),identities=new Set<string>();
 for(const t of value){if(!exactKeys(t,['ref','designRefs','dependencies'])||!isImpactTargetRef(t.ref)||!Array.isArray(t.designRefs)||t.designRefs.length>200||!t.designRefs.every(isVersionRef)||!Array.isArray(t.dependencies)||t.dependencies.length>200||!t.dependencies.every(isImpactTargetRef))throw new AuthFailure('IMPACT_INPUT_INVALID',422);const key=canonicalJson(t.ref),identity=canonicalJson({kind:t.ref.kind,id:t.ref.id,version:t.ref.versionRef.version,localCode:t.ref.localCode??null});if(keys.has(key)||identities.has(identity))throw new AuthFailure('IMPACT_TARGET_AMBIGUOUS',422);keys.add(key);identities.add(identity);targets.push(structuredClone(t)as ImpactTarget);}
 const gaps:ImpactGap[]=[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}];if(scopeTruncated)gaps.push({code:'IMPACT_SCOPE_TRUNCATED'});if(!targets.length)gaps.push({code:'IMPACT_TARGETS_MISSING'});
 const consumers=new Map<string,string[]>(),affected=new Set<string>(),queue:string[]=[];
 for(const t of targets){const key=canonicalJson(t.ref);if(t.designRefs.some(r=>canonicalJson(r)===canonicalJson(beforeRef))){affected.add(key);queue.push(key);}let missing=false;for(const dep of t.dependencies){const dependency=canonicalJson(dep);if(!keys.has(dependency))missing=true;else{const list=consumers.get(dependency)??[];if(!list.includes(key))list.push(key);consumers.set(dependency,list);}}if(missing)gaps.push({code:'DEPENDENCY_SOURCE_MISSING',targetRef:t.ref});}
 for(let i=0;i<queue.length;i++)for(const key of consumers.get(queue[i]!)??[])if(!affected.has(key)){affected.add(key);queue.push(key);}
 const items:ImpactItem[]=targets.map(t=>{const direct=t.designRefs.some(r=>canonicalJson(r)===canonicalJson(beforeRef)),changed=affected.has(canonicalJson(t.ref));if(!changed)gaps.push({code:'TARGET_IMPACT_UNCONFIRMED',targetRef:t.ref});return{targetRef:t.ref,state:changed?'AFFECTED':'UNKNOWN',reason:direct?'변경 전의 정확한 설계 버전을 직접 참조하므로 재확인 대상입니다.':changed?'재확인 대상에 의존하므로 영향 가능성을 별도 검토해야 합니다.':'확인된 연결/근거가 없어 영향 여부를 판단하지 못했습니다. 영향 없음이 아닙니다.',evidenceRefs:[]};});
 return{sourceKind:'MECHANICAL_TRACE' as const,beforeRef:{...beforeRef},items,coverageGaps:gaps,requiresReview:true as const};
}
