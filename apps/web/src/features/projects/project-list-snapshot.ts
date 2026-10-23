import type {ApiClient} from '../../api/client.ts';
import type {ProjectPage} from './api.ts';

export interface ProjectListRequest {client:ApiClient;query:string;archived:boolean;refresh:number;cursor:string|null}
export interface ProjectListSnapshot extends ProjectListRequest {page:ProjectPage;itemObservedAt:Record<string,string>}
const sameScope=(a:ProjectListRequest,b:ProjectListRequest)=>a.client===b.client&&a.query===b.query&&a.archived===b.archived;

/** 같은 조회의 pagination만 합치며 기존 항목의 관측 시각을 새 페이지 시각으로 덮지 않는다. */
export function mergeProjectListSnapshot(previous:ProjectListSnapshot|null,request:ProjectListRequest,page:ProjectPage):ProjectListSnapshot{
 const keep=!!request.cursor&&!!previous&&sameScope(previous,request)&&previous.refresh===request.refresh;
 const received=structuredClone(page),items=new Map((keep?previous.page.items:[]).map(item=>[item.id,structuredClone(item)]));
 const itemObservedAt:Record<string,string>=keep?{...previous.itemObservedAt}:{};
 for(const item of received.items){items.set(item.id,item);itemObservedAt[item.id]=received.observedAt;}
 return {...request,page:{...received,items:[...items.values()]},itemObservedAt};
}

/** 다른 조회 주체·필터는 즉시 숨긴다. 같은 조회의 대기/실패 시 이전 목록은 stale로만 소비한다. */
export function selectProjectListSnapshot(snapshot:ProjectListSnapshot|null,request:ProjectListRequest){
 if(!snapshot||!sameScope(snapshot,request))return null;
 return {...snapshot,current:snapshot.refresh===request.refresh&&snapshot.cursor===request.cursor};
}
export type ProjectListVisible=NonNullable<ReturnType<typeof selectProjectListSnapshot>>;
