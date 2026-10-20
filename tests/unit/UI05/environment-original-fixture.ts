import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
export const environmentProject='11111111-1111-4111-8111-111111111111',environmentId='33333333-3333-4333-8333-333333333333';
export function environmentOriginal(kind='ENVIRONMENT_CANDIDATE'){
 const policy={id:environmentProject,version:1,contentHash:'a'.repeat(64)};
 const input={kind,candidate:{label:'고정 환경 후보'},candidateRef:null,policyRef:policy,expiresAt:'2026-10-19T00:00:00.000Z',reason:'이 임무의 당시 환경'};
 const candidate={kind,input,readiness:{state:'NOT_READY',executionAuthorized:false,missingRequirements:[{field:'executionHostRef',reason:'NOT_PROVIDED'},{field:'hostTrust',reason:'UNVERIFIED'}]},capabilities:['INSTRUCTION_SESSION','STATE_ORIGINAL','RESULT_EVIDENCE','TOOL_APPROVAL','STOP_RECLAIM','PATH_WRITE_CONTROL'].map(code=>({code,documentation:null,measurement:{state:'UNVERIFIED',toolVersion:null,environmentRef:null,executionRef:null,evidenceRefs:[]},controlLevel:'UNVERIFIED',limitations:['NO_AGENT_MEASUREMENT']}))};
 const previousRef={id:environmentId,version:1,contentHash:contentHash(canonicalJson(candidate))};
 Object.assign(input,{candidateRef:previousRef});
 return {ref:{id:environmentId,version:2,contentHash:contentHash(canonicalJson(candidate))},candidate,expired:true,executionAuthorized:false,recordedBy:environmentProject,createdAt:'2026-10-18T00:00:00.000Z',observedAt:'2026-10-20T00:00:00.000Z'};
}
