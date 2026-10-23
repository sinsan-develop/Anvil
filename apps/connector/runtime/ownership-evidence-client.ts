import {readOwnershipPreparationInputSource,readOwnershipPreparationSelectionSource} from './ownership-preparation-input-source.ts';

export type OwnershipPreparationProfileSourcePort=(selection:Readonly<Record<string,string>>)=>Promise<unknown>;
const failure=()=>new Error('OWNERSHIP_EVIDENCE_CLIENT_SOURCE_UNAVAILABLE');
/** 미등록 read-only SOURCE client. port는 관측 입력만 반환하며 늦은 완료에 실행 효과를 만들면 안 된다.
 * 실제 전송/인증/credential/native provider는 없다. caller 유한 거절은 port 강제종료가 아니다. */
export async function readOwnershipEvidencePreparationSource(selectionValue:unknown,
 port:OwnershipPreparationProfileSourcePort|null=null,options:{timeoutMs?:number;signal?:AbortSignal}={}){
 try{
  const timeoutMs=options.timeoutMs??10000,signal=options.signal;
  if(typeof port!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||signal!==undefined&&!(signal instanceof AbortSignal))throw failure();
  const selected=readOwnershipPreparationSelectionSource(selectionValue),from=Date.now(),started=performance.now();
  let end=Date.parse(selected.expiresAt);
  const check=()=>{const now=Date.now();if(signal?.aborted||now<from||now>=end||Date.parse(selected.issuedAt)>now||end-Date.parse(selected.issuedAt)>120000||performance.now()-started>=timeoutMs)throw failure();};
  const current=async()=>{
   check();let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined;
   const stop=new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(failure()),Math.max(1,Math.ceil(Math.min(end-Date.now(),timeoutMs-(performance.now()-started)))));
    abort=()=>reject(failure());signal?.addEventListener('abort',abort,{once:true});
   });
   try{
    check();const work=Promise.resolve().then(()=>{check();return port(selected);});
    const raw=await Promise.race([work,stop]);check();return readOwnershipPreparationInputSource(raw,selected);
   }finally{if(timer!==undefined)clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);}
  };
  check();const first=await current();end=Math.min(end,Date.parse(first.expiresAt));check();
  const last=await current();end=Math.min(end,Date.parse(last.expiresAt));
  if(Date.parse(last.checkedAt)<Date.parse(first.checkedAt)||first.missingEvidence.join('\0')!==last.missingEvidence.join('\0'))throw failure();
  const result=Object.freeze({...last,purpose:'OWNERSHIP_EVIDENCE_PREPARATION_CLIENT_SOURCE_ONLY' as const,expiresAt:new Date(end).toISOString()});
  check();return result;
 }catch{throw failure();}
}
