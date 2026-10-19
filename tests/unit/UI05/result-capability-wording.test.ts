import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../../apps/web/src/features/session-detail/SessionDetailPage.tsx',import.meta.url),'utf8');
// 안내 문구 회귀만 확인한다. DOM·조회·저장·실제 Agent/서비스 검증이 아니다.
test('등록 원문 조회와 보완 초안을 전면 미연결이라 쓰거나 실제 수행으로 승격하지 않는다',()=>{assert.ok(source.includes('등록 산출물 텍스트·변경 diff/명령 출력 참조는 별도 명시 조회'));assert.ok(source.includes('보완 초안 저장은 실제 재작업·검수 합격이 아닙니다'));assert.equal(source.includes('산출물·diff의 실제 바이트 조회, 증거 검수·보완·중지·이전 처리는 아직 미연결입니다.'),false);});
test('현황 파일/보관 이력 조회와 실제 Agent·쓰기 회수/재개를 구분한다',()=>{assert.ok(source.includes('현황 파일 대조·보관 관측/중지 요청 이력'));assert.ok(source.includes('실제 Agent 수행·증거 출처·쓰기 회수·안전 재개/이전은 미확인'));assert.equal(source.includes('실제 Agent 관측·작업현황 파일·파일 diff 원본·하위 임무와 증거 검수는 아직 연결되지 않았습니다.'),false);});
