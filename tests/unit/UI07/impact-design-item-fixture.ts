import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {impactDocumentFixture} from './impact-document-fixture.ts';

export function impactDesignItemFixture(){
 const f=impactDocumentFixture(),body='저장된 설계 원문\nD01 · 오류 복구 <script>globalThis.impactItemUnsafe=true</script>\n이전 판단을 보존한다',bytes=Buffer.from(body);
 const content={...f.document.content,body:{...f.document.content.body,bytes:bytes.length,contentHash:contentHash(bytes)}};
 const document={...f.document,title:'고정 설계 문서',content,contentHash:contentHash(canonicalJson({title:'고정 설계 문서',formRef:f.document.formRef,stageNodeRef:null,content}))};
 const documentRef={id:document.id,version:document.version,contentHash:document.contentHash},itemData={documentRef,localCode:'D01',title:'저장 등록된 오류 복구',anchor:'line:2'},item={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',...itemData,itemHash:contentHash(canonicalJson(itemData))};
 const target={kind:'DESIGN_ITEM' as const,id:item.id,versionRef:documentRef,localCode:item.localCode,anchor:item.anchor};
 const original=f.page.impactVersions[0]!,{ref,observedAt,...source}=original;
 const versions:any[]=[];
 for(let version=1;version<=11;version++){
  const snapshot={...source,items:[{targetRef:target,state:version===1?'AFFECTED':'UNKNOWN',reason:'저장된 설계의 재확인이 필요하다',evidenceRefs:[]}],...(version===1?{}:{sourceKind:'HUMAN_REVIEW',baseImpactRef:versions.at(-1).ref,reason:'당시 미확인 보존',reviewer:{kind:'HUMAN',userId:f.selection.userId}})};
  versions.push({ref:{...ref,version,contentHash:contentHash(canonicalJson(snapshot))},...snapshot,observedAt});
 }
 const base={...f.page,latestImpactRef:versions.at(-1).ref},page={...base,impactVersions:versions.slice(1).reverse(),hasMoreImpacts:true,nextBeforeVersion:2},history={...base,impactVersions:[versions[0]],hasMoreImpacts:false,nextBeforeVersion:null};
 const index={documentRef,items:[item],screenRegions:[],status:'INDEXED',observedAt};
 return{...f,body,bytes,document,item,index,target,page,history,selection:{...f.selection,changeRef:page.change.ref,impactRef:page.impactVersions[0].ref,target}};
}
