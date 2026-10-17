import {test} from 'node:test';import assert from 'node:assert/strict';
import {qaEdgeAuxiliary} from '../../support/fn06-windows-qa-resources.ts';
test('Edge 보조물은 본인run 새부모·실소유PID·정확이름/크기/속성에만 결박하고 옛payload시각만 예외로 둔다',()=>{
 const start=Date.parse('2026-10-17T02:41:12.867Z'),lease={createdAt:new Date(start).toISOString(),expiresAt:'2026-10-17T03:29:30.227Z'},meta={directory:false,size:20795,attributes:34,ownerCurrent:true,nonlink:true,samePath:true,createdMs:Date.parse('2026-09-18T00:00:00Z'),parentCreatedMs:start+1000},processes=[{pid:78228,startMs:start+100}];
 assert.deepEqual(qaEdgeAuxiliary('results/msedgeedge_BITS_78228_123/BIT4800.tmp',meta,lease,processes),{hiddenAllowed:true});
 for(const change of [{size:20796},{attributes:35},{attributes:38},{ownerCurrent:false},{nonlink:false},{samePath:false},{parentCreatedMs:start-1}])assert.throws(()=>qaEdgeAuxiliary('results/msedgeedge_BITS_78228_123/BIT4800.tmp',{...meta,...change},lease,processes));
 for(const path of ['results/msedgeedge_BITS_999_123/BIT4800.tmp','results/msedgeedge_BITS_78228_123/secret.key','outside/BIT4800.tmp','results/cv_debug.log'])assert.throws(()=>qaEdgeAuxiliary(path,meta,lease,processes));
 assert.deepEqual(qaEdgeAuxiliary('results/cv_debug.log',{...meta,size:123,attributes:32,createdMs:start+500},lease,processes),{hiddenAllowed:false});
 assert.throws(()=>qaEdgeAuxiliary('results/cv_debug.log',{...meta,size:123,attributes:32},lease,processes));
});
