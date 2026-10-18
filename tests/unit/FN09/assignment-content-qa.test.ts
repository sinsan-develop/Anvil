import assert from 'node:assert/strict';import test from 'node:test';
import * as module from '../../../scripts/assignment-content-sql-qa.ts';
test('내용 확정 SQL QA는 exact clean WSL Git·유한 수명만 허용하고 정식DB 설정·다른 Docker를 거절한다',()=>{
 const check=(value:any)=>{assert.equal(typeof (module as any).assertAssignmentContentQaBinding,'function');return(module as any).assertAssignmentContentQaBinding(value,1000);};
 const good={platform:'linux',uid:1000,cwd:'/home/daon/deploy/anvil-v3',module:'/home/daon/deploy/anvil-v3/scripts/qa-assignment-content-sql.ts',head:'a'.repeat(40),commit:'a'.repeat(40),dirty:'',remote:'git@github-sinsan-develop:sinsan-develop/Anvil.git',sqlHash:'b'.repeat(64),expiresAt:new Date(601000).toISOString(),env:{}};
 assert.equal(check(good),601000);
 for(const change of [(v:any)=>{v.platform='win32';},(v:any)=>{v.uid=0;},(v:any)=>{v.cwd='/tmp/other';},(v:any)=>{v.head='c'.repeat(40);},(v:any)=>{v.dirty='M file';},(v:any)=>{v.remote='other';},(v:any)=>{v.expiresAt=new Date(1000).toISOString();},(v:any)=>{v.expiresAt=new Date(1201001).toISOString();},(v:any)=>{v.env.ANVIL_DB_CONFIG='/formal/app.json';},(v:any)=>{v.env.DOCKER_HOST='tcp://other';}]){const value=structuredClone(good);change(value);assert.throws(()=>check(value),/CONTENT_QA_BINDING_INVALID/);}
});
