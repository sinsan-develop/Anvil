import test from 'node:test';import assert from 'node:assert/strict';
import {createControlHandoffEvidenceSource,HandoffBudget} from '../../../apps/server/modules/control-handoff/control-handoff-evidence-source.ts';
import {requestBundle,projectId,baseControl,now} from './control-handoff-summary-fixture.ts';
const load=()=>import('../../../apps/server/modules/control-handoff/control-handoff-protected-summary.ts');
test('보호요약은 원 생산 provenance를 요구하고 parsed UNKNOWN을 READY로 바꾸지 않는다',async()=>{
 const m=await load(),request=requestBundle().request,scope={projectId,requestRef:request.requestRef,baseControl,sessionId:projectId,actorId:baseControl.actorId,clientId:baseControl.clientId};
 const packet={projectId,requestRef:request.requestRef,baseControl,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null};
 const db={query:async()=>({rows:[{packet}]})},lease=new HandoffBudget(),source=createControlHandoffEvidenceSource(),evidence=await source.collect(db as never,scope,lease);
 const input={scope,request:request.snapshot,version:1,observedAt:now,evidence};
 const result=m.issueProtectedHandoffSummary(input,db,lease);assert.equal(result.snapshot.transferState,'UNKNOWN');assert.equal(result.snapshot.schemaVersion,2);
 assert.throws(()=>m.issueProtectedHandoffSummary({...input,evidence:structuredClone(evidence)},db,lease));
 const altered=structuredClone(result);altered.snapshot.transferState='READY';assert.throws(()=>m.readProtectedHandoffSummary(altered));
});
