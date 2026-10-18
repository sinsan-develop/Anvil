import assert from 'node:assert/strict';import test from 'node:test';
import * as module from '../../../scripts/assignment-content-sql-qa.ts';
import { spawnSync } from 'node:child_process';

test('실제 workflow 연결은 새 전용 network/fullID의 사설 IPv4만 소비하고 게시포트·다른network를 거절한다',()=>{
 const check=(value:any)=>{assert.equal(typeof(module as any).assignmentContentQaAddress,'function');return(module as any).assignmentContentQaAddress(value,'a'.repeat(64));};
 const network=module.assignmentContentWorkflowQaResource.network,good={HostConfig:{PublishAllPorts:false,PortBindings:{}},NetworkSettings:{Ports:{'5432/tcp':null},Networks:{[network]:{NetworkID:'a'.repeat(64),IPAddress:'172.29.0.2'}}}};
 assert.equal(check(good),'172.29.0.2');
 for(const change of[(v:any)=>{v.HostConfig.PortBindings={'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'5547'}]};},(v:any)=>{v.NetworkSettings.Ports['5432/tcp']=[{HostIp:'0.0.0.0',HostPort:'5432'}];},(v:any)=>{v.NetworkSettings.Networks[network].NetworkID='b'.repeat(64);},(v:any)=>{v.NetworkSettings.Networks.extra={};},(v:any)=>{v.NetworkSettings.Networks[network].IPAddress='127.0.0.1';},(v:any)=>{v.NetworkSettings.Networks[network].IPAddress='172.32.0.2';},(v:any)=>{v.NetworkSettings.Networks[network].IPAddress='172.29.0.999';}]){const value=structuredClone(good);change(value);assert.throws(()=>check(value),/CONTENT_QA_NETWORK_OR_PORT_INVALID/);}
});
test('내용 확정 SQL QA는 exact clean WSL Git·유한 수명만 허용하고 정식DB 설정·다른 Docker를 거절한다',()=>{
 const check=(value:any)=>{assert.equal(typeof (module as any).assertAssignmentContentQaBinding,'function');return(module as any).assertAssignmentContentQaBinding(value,1000);};
 const good={platform:'linux',uid:1000,cwd:'/home/daon/deploy/anvil-v3',module:'/home/daon/deploy/anvil-v3/scripts/qa-assignment-content-sql.ts',head:'a'.repeat(40),commit:'a'.repeat(40),dirty:'',remote:'git@github-sinsan-develop:sinsan-develop/Anvil.git',sqlHash:'b'.repeat(64),expiresAt:new Date(601000).toISOString(),env:{}};
 assert.equal(check(good),601000);
 for(const change of [(v:any)=>{v.platform='win32';},(v:any)=>{v.uid=0;},(v:any)=>{v.cwd='/tmp/other';},(v:any)=>{v.head='c'.repeat(40);},(v:any)=>{v.dirty='M file';},(v:any)=>{v.remote='other';},(v:any)=>{v.expiresAt=new Date(1000).toISOString();},(v:any)=>{v.expiresAt=new Date(1201001).toISOString();},(v:any)=>{v.env.ANVIL_DB_CONFIG='/formal/app.json';},(v:any)=>{v.env.DOCKER_HOST='tcp://other';}]){const value=structuredClone(good);change(value);assert.throws(()=>check(value),/CONTENT_QA_BINDING_INVALID/);}
});
test('실제 API 격리 시험은 실행기 전달이 없으면 인증키·Pool·원문root 생성 전에 거절한다',()=>{
 const childEnv:NodeJS.ProcessEnv={...process.env,ANVIL_FN09_CONTENT_WORKFLOW_QA:'',ANVIL_FN09_CONTENT_APP_PASSWORD:'',ANVIL_FN09_CONTENT_MIGRATOR_PASSWORD:''};delete childEnv.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--test','tests/integration/FN09/assignment-content-isolated.test.ts'],{encoding:'utf8',env:childEnv,timeout:10000});
 assert.equal(result.status,1);assert.match(result.stdout+result.stderr,/CONTENT_WORKFLOW_EXACT_ISOLATED_TARGET_REQUIRED/);
});
