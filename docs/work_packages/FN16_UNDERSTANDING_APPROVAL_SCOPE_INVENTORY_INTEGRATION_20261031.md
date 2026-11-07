# FN16 이해검토 승인 scope 이력 — 내부 호환성 보완 WI

2026-10-31 / 구현 dispatch 전 독립 경계 검토 / 기존 승인 내부 통합.
기준 codex/av3-stage-b c61ea87586acb36fa552a93a11400d0ff2b3adcb.
사용자 승인된 FN09 이해검토 r1 A(source 직접승인 B7E7AE96, WI AB27C0E2)와 WORK_PLAN FN16 승인/감사 이력 보존을 따른다.

## 1. 실제 문제와 전후
approval-input.ts의 readApprovalDetails/assertApprovalCandidate는 reviewUnderstanding만 targetRef=null 및 양수 안전정수 expectedVersion=실행 generation으로 검사한다.
실제 UnderstandingReviewApprovalCandidates와 ProjectApprovals.request는 이 원형을 저장한다.
현재 approval-history-inventory.ts details()는 모든 operation의 targetRef=null에 expectedVersion=0을 요구해, 원문 증빙이 있는 정상 이해검토 승인 요청을503으로 거절한다.
변경 후 이 operation만 현재 승인된 null/양수 generation 의미로 구조 검사한다. 다른 operation의 기존 null0/ref.version 규칙은 보존한다.
정상 source 요청/과거 이력 보관의 내부 정합 보완이며 새 승인 입력·결정·소비/권한·DTO·공개 endpoint·SQL 계약을 만들지 않는다.
현재 승인/기한/실행 허가를 발급하거나 기존 프로젝트 차단/전체 coverage412를 풀지 않는다.

## 2. 책임과 정확2경로
기존 Primary 단일 writer, Main 문서/검수/통합, 기존 Reviewer read-only. Main 같은 source 수정0.
1. apps/server/modules/backups/approval-history-inventory.ts
   시작 SHA256 D632A275810F2D296686AF53F7383E8AFF0ED2359527BFB7440B744191F7C062
2. tests/unit/FN16/approval-understanding-inventory.test.ts
   신규/부재를 시작 때 확인한다.
원 회귀 시험은 수정하지 않는다:
- tests/unit/FN16/approval-history-inventory.test.ts SHA256 0F5E86ED97307D580DAF65CE6939A4F918DD6CE69F835C559C04C33A750A502B
- tests/unit/FN16/approval-history-inventory-schema.test.ts SHA256 8281F2E447ABB50F7813EE4C9392A02C1F38F04C7DF7176C13C356809FB20DFD
- tests/unit/FN09/understanding-review-approval.test.ts 및 실제 승인 producer.
context-preparation/understanding-permit 수집기·approval producer·공통 helper·SQL·UI·보호3/다른 자료는 변경하지 않는다.
허용 밖 수정이 실제 필요하면 정확 근거를 보고하고 해당 변경 전 Main이 판정한다.

## 3. 구현·TDD
- 실제 현재 승인 producer가 만들 수 있는 null/양수 generation 승인 요청의 원 details/request_json·명령/receipt/audit를 연결해 수집 RED부터 확인한다.
- 가능하면 실제 ProjectApprovals.request를 합성 포트에서 소비한다. 준비 제약이 크면 실제 readApprovalDetails/원 receipt 생성 함수를 소비한 범위를 명확히 보고한다. 결과를 재봉인해 원검산을 억지 통과시키지 않는다.
- 세밀한 predicate는 reviewUnderstanding이면 targetRef===null 및 expectedVersion>=1의 안전정수, 그 외는 기존 조건 그대로다. 문자열/NaN/Infinity/소수/0/음수·nonnull target은 이 operation에서 거절한다.
- 현재 readApprovalDetails 전체를 과거 이력에 호출해 현재 만료/현재 actor 조건을 재적용하지 않는다. 기존 collector의 역사 구조 검사·양끝 OWNER/RR·원시각/유한한도·민감 익명투영을 유지한다.
- 원 request 증빙이 있는 정상 source 행과 원형 없는 legacy 행의 unsupported fallback을 구분한다. legacy를 새 성공/완전 검증으로 승격하거나 원래 fallback을 일반503으로 바꾸지 않는다.
- stored scope hash·원문/명령·receipt/audit·결정/소비 연결 검산은 그대로다. 기존 requestReconstructionVerification/domainArtifactVerification NOT_PERFORMED도 유지한다. 이 작업은 별도 candidate 원문 전체를 수집했다고 주장하지 않는다.
- 다른operation의null양수/target버전불일치가 계속거절되는지, 기준0/null·기존ref정상·자료없음·현재OWNER/기한·손상원문/proof·소비관계 음성을 보존한다.

## 4. 검수·제출·한계
신규/원 history/schema/FN09 직접 승인 시험과 typecheck/diff만 선택한다. 실제 UI/DB/서비스·전체회귀를 반복하지 않는다.
최종 제출은 정확diff/지문·RED/준비오류분리·명령/exit/결과·남은범위·writer반환이다. 이미 통과한 검사는 소스 변경·새 지적 없이 재실행하지 않는다.
실제 DB/SQL/RLS/권한·키·사용자 파일 조사·서비스/Agent·백업복원·일반차단 해제0, 새QA0. source 검수는 전체 FN16/계획 완료가 아니다.
rollback은 source commit 정상 revert이며 실제 데이터/원문 삭제·down migration0.
