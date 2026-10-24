import type {KnowledgeEntry,KnowledgeScope} from '../../../../server/modules/knowledge/knowledge-entry.ts';
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const ref=(v:unknown)=>exact(v,['id','version','contentHash'])&&typeof v.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
export function validKnowledgeScope(value:unknown,pid:string,kind:KnowledgeEntry['kind']):value is KnowledgeScope{
  if(!exact(value,['projectId','stageRefs','taskRefs'])||value.projectId!==pid||!Array.isArray(value.stageRefs)||!Array.isArray(value.taskRefs)||value.stageRefs.length+value.taskRefs.length>200||['PURPOSE','CONSTITUTION'].includes(kind)&&(value.stageRefs.length||value.taskRefs.length))return false;
  const seen=new Set<string>();
  for(const [tag,list] of [['STAGE',value.stageRefs],['TASK',value.taskRefs]] as const){for(const item of list){
    const key=tag==='STAGE'?'applicationRef':'planRef',label=tag==='STAGE'?'nodeId':'taskCode';
    if(!exact(item,[key,label])||!ref(item[key])||typeof item[label]!=='string'||!item[label].trim()||item[label].length>200||!item[label].isWellFormed())return false;
    const fingerprint=JSON.stringify([tag,item[key].id,item[key].version,item[key].contentHash,item[label]]);if(seen.has(fingerprint))return false;seen.add(fingerprint);
  }}return true;
}
export function knowledgeScopeOf(b:{projectId:string;scope?:KnowledgeScope}):KnowledgeScope{return b.scope===undefined?{projectId:b.projectId,stageRefs:[],taskRefs:[]}:b.scope;}
