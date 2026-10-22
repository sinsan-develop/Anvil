import {encodeProviderHandleCapsule} from '../../../apps/connector/runtime/provider-handle-capsule.ts';
import {sentResponseBasisFixture} from './sent-response-basis-fixture.ts';
export async function sentResponseHandleFixture(){
 const f=await sentResponseBasisFixture();f.fault('busy');let mode='',currents=0,reads=0,now=Date.parse(f.f.basis.fact.checkedAt);
 const buffers:Uint8Array[]=[],server:any={transport:'SYNTHETIC_ONLY',currentSentResponse:async(e:any,r:any)=>{currents++;const v:any=await f.bound(s=>s.currentSentResponse(e,r));if(mode==='REVOKED'&&currents===2)throw Error('PRIVATE_REVOKED');if(mode==='PURPOSE')v.purpose='SEND';if(mode==='PERMIT')v.permitRef={...v.permitRef,version:2};if(mode==='GRANT')v.basis.grantRef={...v.basis.grantRef,version:2};if(mode==='OWNER'&&currents===2)v.basis.fact.writerState='UNKNOWN';return v;}};
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);
 const store:any={transport:'SYNTHETIC_ONLY',read:async(c:any)=>{reads++;const{protectedHandleRef:_,...input}=c,bytes=encodeProviderHandleCapsule(input,{threadId:'private-response-thread',turnId:null});buffers.push(bytes);if(mode==='DELAY'){enter();await gate;}if(mode==='EXPIRE')now+=26000;return{ciphertextHash:mode==='CIPHER'?'e'.repeat(64):'f'.repeat(64),plaintext:bytes};}};
 const selection={envelope:f.e,claim:f.claim,claimRef:f.claimRef,attemptRef:f.attempt.localAttemptRef,permitRef:f.attempt.permitRef,grantRef:f.f.scope.grantRef,preSendBindingHash:f.attempt.bindingHash,instructionContentHash:f.attempt.instructionContentHash};
 const m=await import('../../../apps/connector/runtime/sent-response-handle-reader.ts'),reader=new m.SyntheticSentResponseHandleReader(server,store,{clock:()=>now,timeoutMs:1000});
 return{f,reader,selection,buffers,server,mode:(v:string)=>mode=v,currents:()=>currents,reads:()=>reads,entered,release:()=>release()};
}
