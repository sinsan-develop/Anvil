import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {impactDesignItemFixture} from './impact-design-item-fixture.ts';

export function impactScreenRegionFixture(){
 const f=impactDesignItemFixture(),body='보관된 시안 문서\nS01 · 오류 복구 <img src=x onerror="globalThis.impactScreenUnsafe=true">\n등록 당시 원문',bytes=Buffer.from(body);
 const content={...f.document.content,body:{...f.document.content.body,bytes:bytes.length,contentHash:contentHash(bytes)}},title='고정 AF03 시안 문서';
 const document={...f.document,title,content,contentHash:contentHash(canonicalJson({title,formRef:f.document.formRef,stageNodeRef:null,content}))};
 const documentRef={id:document.id,version:document.version,contentHash:document.contentHash},sourceRef=f.page.change.beforeRef;
 const itemData={documentRef:sourceRef,localCode:'D01',title:'저장 등록된 오류 복구',anchor:'line:2'},item={id:f.item.id,...itemData,itemHash:contentHash(canonicalJson(itemData))};
 const regionData={designItemId:item.id,screenCode:'S01',documentRef,artifactRef:content.body,anchor:'line:2'},region={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',...regionData,regionHash:contentHash(canonicalJson(regionData))};
 const target={kind:'SCREEN_REGION' as const,id:region.id,versionRef:documentRef,localCode:region.screenCode,anchor:region.anchor};
 const versions:any[]=[];
 for(const old of [...f.page.impactVersions,...f.history.impactVersions].sort((a,b)=>a.ref.version-b.ref.version)){
  const {ref,observedAt,...rest}=old,snapshot={...rest,items:[{targetRef:target,state:ref.version===1?'AFFECTED':'UNKNOWN',reason:'등록 시안 문서를 확인한다',evidenceRefs:[]}],...(ref.version===1?{}:{baseImpactRef:versions.at(-1).ref})};
  versions.push({...snapshot,ref:{...ref,contentHash:contentHash(canonicalJson(snapshot))},observedAt});
 }
 const page={...f.page,impactVersions:versions.slice(1).reverse(),latestImpactRef:versions.at(-1).ref},history={...f.history,impactVersions:[versions[0]],latestImpactRef:versions.at(-1).ref};
 const formRef=document.formRef,form={ref:formRef,definition:{scope:'SYSTEM',formCode:'AF03',name:'화면 시안',purpose:'등록 시안',requiredInputs:['설계'],authorRole:'작성',reviewerRole:'검토',confirmerRole:'사용자',items:[{itemId:'SC01',title:'화면',required:true,repeated:false,valueType:'TEXT',authoringRules:['구체화'],reviewCriteria:['확인'],fields:[]}],authoringStandardRef:formRef},authoringStandard:{ref:formRef,content:'공통 기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 return{...f,body,bytes,document,sourceRef,item,region,target,form,index:{documentRef:sourceRef,items:[item],screenRegions:[region],status:'INDEXED',observedAt:page.observedAt},page,history,selection:{...f.selection,changeRef:page.change.ref,impactRef:page.impactVersions[0].ref,target}};
}
