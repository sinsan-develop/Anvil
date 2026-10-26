import React,{useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgePage} from '../../../apps/web/src/features/knowledge/KnowledgePage.tsx';
const w=window as any,seed=w.__storedReviewSeed;
const qa=w.__storedReviewQA={calls:[] as {path:string;method:string}[],unexpected:[] as string[],changes:[] as unknown[],denied:false,authLost:0};
function Harness(){
 const client=useMemo(()=>new ApiClient(async(input,init)=>{
  const path=String(input),method=init?.method??'GET';qa.calls.push({path,method});
  const base='/api/v1/projects/'+seed.projectId;
  if(method==='GET'&&path.startsWith(base+'/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:seed.at});
  if(method==='GET'&&path.startsWith(base+'/knowledge?'))return Response.json({items:[{versionRef:seed.after.ref,title:seed.after.entry.title,kind:'FACT',sourceRefs:[],reasonSnippet:seed.after.entry.reason,state:'PROPOSED'}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:seed.at});
  for(const view of [seed.after,seed.before])if(method==='GET'&&path===base+'/knowledge/'+view.ref.id+'/versions/'+view.ref.version)return qa.denied?Response.json({code:'KNOWLEDGE_READ_DENIED'},{status:403}):Response.json(view);
  qa.unexpected.push(path);throw Error('Unexpected synthetic transport');
 }),[]);
 const changed=(value:unknown)=>qa.changes.push(value);
 return <KnowledgePage client={client} projectId={seed.projectId} session={seed.session} buffer={null} onChange={changed} conversationBuffer={null} onConversationChange={changed} exclusion={null} onExclusionChange={changed} correction={null} onCorrectionChange={changed} decision={null} onDecisionChange={changed} onAuthenticationLost={()=>qa.authLost++}/>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
