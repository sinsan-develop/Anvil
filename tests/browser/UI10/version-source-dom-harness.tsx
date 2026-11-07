import React from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgeVersionComparison} from '../../../apps/web/src/features/knowledge/KnowledgeVersionComparison.tsx';
const w=window as any,seed=w.__versionSeed;
const qa=w.__versionQA={mode:'NORMAL',calls:[] as string[],pending:false,consumed:0,bodyHashSettled:0,release:null as null|(()=>void)};
// Observe the real final body digest, not just earlier metadata JSON completion.
const originalDigest=crypto.subtle.digest.bind(crypto.subtle),expectedBytes=new TextEncoder().encode(seed.bodies[1]);
crypto.subtle.digest=async(algorithm,data)=>{
 const bytes=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);
 const targeted=bytes.length===expectedBytes.length&&bytes.every((v,i)=>v===expectedBytes[i]);
 const value=await originalDigest(algorithm,data);if(targeted)qa.bodyHashSettled++;return value;
};
const client=new ApiClient(async(path,options)=>{
 qa.calls.push((options?.method??'GET')+' '+String(path));if(options?.method!=='GET')throw Error('UNEXPECTED_WRITE');
 const url=String(path),version=url.endsWith('/1')?1:2;
 if(url.includes('/knowledge/'))return Response.json(version===1?seed.before:seed.after);
 if(url.includes('/documents/')){
  if(qa.mode==='DENY')return Response.json({code:'SOURCE_READ_DENIED'},{status:403});
  const response=Response.json(qa.mode==='WRONG_HASH'?{...seed.documents[version-1],contentHash:'f'.repeat(64)}:seed.documents[version-1]);
  if(qa.mode==='DELAY'){const json=response.json.bind(response);response.json=async()=>{qa.pending=true;await new Promise<void>(resolve=>qa.release=resolve);const value=await json();qa.consumed++;return value;};}
  return response;
 }
 if(url.includes('/files/'))return new Response(url.endsWith(seed.documents[0].content.body.artifactId)?seed.bodies[0]:seed.bodies[1],{headers:{'content-type':'application/octet-stream'}});
 throw Error('UNEXPECTED_QA_PATH');
});
createRoot(document.getElementById('root')!).render(<KnowledgeVersionComparison {...{client,projectId:seed.projectId,session:seed.session,view:seed.after,onAuthenticationLost:()=>{throw Error('UNEXPECTED_AUTH');}}}/>);
