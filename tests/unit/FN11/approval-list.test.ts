import assert from'node:assert/strict';import{test}from'node:test';import{Pool}from'pg';import{AccessRepository}from'../../../apps/server/modules/access/repository.ts';import{buildApp}from'../../../apps/server/app.ts';
test('승인 목록은 인증 없는 요청을 DB 조회 전에 거절한다',async()=>{
 const pool=new Pool({host:'127.0.0.1',port:1}),repository=new AccessRepository(pool,{installationId:'a6f30000-0000-4000-8000-000000000081',key:Buffer.alloc(32,1)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
 try{const response=await app.inject({method:'GET',url:'/api/v1/projects/a6f30000-0000-4000-8000-000000000083/approvals',headers:{host:'localhost:3830'}});assert.equal(response.statusCode,401,response.body);}finally{await app.close();await pool.end();}
});
test('승인 목록은 유한 페이지/정확 상태·대상만 받고 전체 수집/임의 필터를 거절한다',async()=>{
 const m=await import('../../../apps/server/modules/approvals/approval-input.ts');assert.equal(typeof m.readApprovalListQuery,'function','유한 승인 목록 입력 검사 필요');assert.deepEqual(m.readApprovalListQuery({}),{status:null,targetId:null,limit:50,cursor:undefined});assert.equal(m.readApprovalListQuery({status:'EXPIRED',limit:'200'}).limit,200);
 for(const bad of [{limit:'201'},{limit:'0'},{limit:'01'},{status:'ALL_APPROVED'},{targetId:'../outside'},{cursor:'x'.repeat(4097)},{allow:true}])assert.throws(()=>m.readApprovalListQuery(bad));
});
