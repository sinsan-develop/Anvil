import{test}from'node:test';import assert from'node:assert/strict';
const load=()=>import('../../../apps/server/modules/projects/source-declaration.ts').catch(()=>null);
test('기존 소스 선언은 사용자 입력 그대로 보존하며 경로를 실행·정규화하거나 관측 완료로 만들지 않는다',async()=>{
 const m=await load();assert.ok(m,'사용자 소스 선언 입력 검사가 필요하다');const value={hostLabel:'내 Windows PC',displayName:'기존 프로젝트',pathHint:'D:\\Project\\MyApp\\..\\MyApp',reason:'사용자 자료 위치 설명이며 실제 접근 검증 전'};
 const declaration=m.readSourceDeclaration(value);assert.deepEqual(declaration,value);assert.notEqual(declaration,value);value.reason='뒤에서 바뀐 입력';assert.notEqual(declaration.reason,value.reason);
});
test('소스 선언은 위장한 권한/검증 필드·불완전/과대 입력·알려진 비밀을 성공으로 저장하지 않는다',async()=>{
 const m=await load();assert.ok(m);const value={hostLabel:'WSL-server',displayName:'개발 소스',pathHint:'/home/user/app',reason:'기존 자료 설명'};
 for(const bad of [{...value,readiness:'VERIFIED'},{...value,sourceRootId:'invented'},{...value,reason:' '},{...value,pathHint:''},{...value,hostLabel:'line\nbreak'},{...value,pathHint:'a'.repeat(4097)},{...value,displayName:'a'.repeat(201)}])assert.throws(()=>m.readSourceDeclaration(bad),{message:'SOURCE_DECLARATION_INPUT_INVALID'});
 assert.throws(()=>m.readSourceDeclaration({...value,pathHint:'token=synthetic-not-a-real-token'}),{message:'SOURCE_DECLARATION_SENSITIVE_CONTENT_SUSPECTED'});
});
