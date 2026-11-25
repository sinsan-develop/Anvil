import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {create0076NegativeLinuxFdProofProtectedIssuer,type NegativeLinuxFdProofProtectedReadSystem} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof-issuer.ts';
import {current0076NegativeLinuxFdProofEntryContract,run0076NegativeLinuxFdProofEntry,type NegativeLinuxFdProofEntryAuthority} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof-entry.ts';

const attemptId='00000000-0000-4000-8000-000000000701';
function fixture(mode:'PASS'|'PARTIAL'='PASS'){
 const candidate=Object.freeze({schemaVersion:1 as const,purpose:current0076NegativeLinuxFdProofEntryContract.candidatePurpose,attemptId,sourceHead:'a'.repeat(40),planHash:'b'.repeat(64),sourceHash:'c'.repeat(64),graphHash:'d'.repeat(64),issuedAt:1000,expiresAt:9000});
 const recipient=Object.freeze({}),issuerRecipient=Object.freeze({}),systemRecipient=Object.freeze({});
 const authority=Object.freeze<NegativeLinuxFdProofEntryAuthority>({recipient,candidate,now:()=>1000,monotonic:()=>10,assertCurrent(this:object,found){assert.equal(this,recipient);assert.equal(found,candidate);}});
 const approvalId='00000000-0000-4000-8000-000000000702';
 const expected=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_PROTECTED_START' as const,attemptId,approvalId,approvalRef:Object.freeze({id:approvalId,version:1,contentHash:'e'.repeat(64)}),approvalHash:'e'.repeat(64),sourceHead:candidate.sourceHead,planHash:candidate.planHash,sourceHash:candidate.sourceHash,graphHash:candidate.graphHash,issuedAt:candidate.issuedAt,expiresAt:candidate.expiresAt,nodePath:'/opt/node-v24.22.1-linux-x64/bin/node' as const,nodeHash:'f'.repeat(64),launcherHash:'1'.repeat(64),issuerHash:'2'.repeat(64),entryHash:'3'.repeat(64),systemHash:'4'.repeat(64),loadedSourceRef:Object.freeze({id:'00000000-0000-4000-8000-000000000703',version:1,contentHash:'5'.repeat(64)})});
 let reads=0;
 const issuerAuthority=Object.freeze({recipient:issuerRecipient,entryAuthority:authority,expected,now:()=>1000,monotonic:()=>10,assertCurrent(this:object,found:typeof expected){assert.equal(this,issuerRecipient);assert.equal(found,expected);}});
 const system=Object.freeze<NegativeLinuxFdProofProtectedReadSystem>({recipient:systemRecipient,read(this:object,path:string,maxBytes:number){assert.equal(this,systemRecipient);assert.equal(path,`/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-${attemptId}-start.json`);assert.equal(maxBytes,32768);reads++;const bytes=Buffer.from(canonicalJson(expected));return mode==='PARTIAL'?bytes.subarray(0,bytes.length-1):bytes;}});
 return {authority,issuerAuthority,system,reads:()=>reads};
}

test('RAM protected receipt verification cannot select the private native provider and is one shot',async()=>{
 const h=fixture(),issuer=create0076NegativeLinuxFdProofProtectedIssuer(h.issuerAuthority,h.system);
 const [first,second]=await Promise.all([issuer.issue(),issuer.issue()]);
 assert.equal(first.status,'SYNTHETIC_PROTECTED_EVIDENCE_VERIFIED_NOT_NATIVE');
 assert.equal(second.status,'UNKNOWN');
 assert.equal(h.reads(),1);
 const result=await run0076NegativeLinuxFdProofEntry(h.authority,first.evidence);
 assert.equal(result.status,'PROTECTED_START_EVIDENCE_UNAVAILABLE');
 assert.equal(result.effectsStarted,false);
});

test('partial protected receipt returns UNKNOWN and cannot be consumed',async()=>{
 const h=fixture('PARTIAL'),issuer=create0076NegativeLinuxFdProofProtectedIssuer(h.issuerAuthority,h.system);
 const result=await issuer.issue();
 assert.equal(result.status,'UNKNOWN');
 assert.equal(h.reads(),1);
 assert.equal((await run0076NegativeLinuxFdProofEntry(h.authority,result.evidence)).status,'PROTECTED_START_EVIDENCE_UNAVAILABLE');
});
