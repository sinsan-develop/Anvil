# FN16 정책·승인 DB 시간 경계 보완 결과 — 2026-10-29

## 판정과 범위
기존 FN16 내부 수집기의 DB 시각 호환 오류를 정확 4개 코드·시험 파일에서 보완했다. 시작 branch codex/av3-stage-b, HEAD 542f6d49942b0ce27951cd416524e5697a7ed69d. WI docs/work_packages/FN16_POLICY_APPROVAL_PG_TIME_BOUNDARY_RECOVERY_20261029.md SHA256 01D358A47EA78EE2F69706A58363FA2A03388A5C742843612684C57E1CB4D6C2.

Main은 관리·검수·통합, 기존 Primary는 단독 구현, Reviewer는 읽기 검수를 수행했다. 실제 DB·키·서비스·SQL·공개 API·권한·파일 저장 계약은 변경하지 않았다. 전체 FN16이나 WORK_PLAN 완료 판정이 아니다.

## 변경 전후
변경 전 두 private stamp는 DB JSON의 offset과 최대 6자리 소수를 원문 프로토콜의 .sssZ 기준으로 거절했다. 변경 후 DB 열만 이미 검수한 통제원장 parser와 동일하게 UTC로 정규화하며 마이크로초를 보존한다. 양의 4자리 연도와 유효 달력·offset·정밀도를 검사한다. 무시간대·잘못된 달력·7자리 소수·지원 밖 연도는 계속 503으로 거절한다.

원문 request.createdAt·decision.decidedAt·result.serverReceivedAt와 expiresAt는 기존 strict ISO를 유지했다. 원문/hash는 수정하지 않으며 snapshot과 DB 열이 1마이크로초 달라도 계속 거절한다. nullable 증거, 과거 상태, 현재 권한 미판정, 기존 21수집 조합과 원문 검증은 유지했다. 새 공통화·의존성·다른 수집기 변경은 없다.

## 검증과 보완
- Primary 7e2a8b: PG 정상 반례 RED 0 PASS / 2 FAIL.
- 최초 Main 6ca7b9: 지정 8파일 74 PASS, 타입·diff 0. 보완 전 증거다.
- 독립 검수 I1: 원문 MICRO 3개 반례가 DB 시각 불일치에서 먼저 거절돼 strict ISO 검사 부재를 검출하지 못했다.
- 동일 Primary가 원문과 대응 DB 열을 함께 맞췄다. 336ff6에서 REQUEST·DECISION·EXPIRY 검사 각각 단독 제거 시 Missing expected rejection으로 exit1을 확인하고 source 지문을 정확 복구했다. 정식 제품 source 오류 횟수 0, 시험 보완 I1 1건이다.
- 최종 Main a462ce: 아래 지정 8파일 74 PASS / 0 FAIL / 0 SKIP, 1295.7446ms, exit0. npm run typecheck 및 git diff --check exit0.
- 독립 최종 C0/I0: 변경 범위, 두 parser 일치, 원문 선검사, 마스킹 제거와 최종 4지문을 읽기 확인했다. 읽기 검수를 실제 실행으로 세지 않는다.

실행 명령: node --test tests/unit/FN16/permission-policy-inventory.test.ts tests/unit/FN16/permission-policy-inventory-schema.test.ts tests/unit/FN16/approval-history-inventory.test.ts tests/unit/FN16/approval-history-inventory-schema.test.ts tests/unit/FN16/project-inventory-composition.test.ts tests/unit/FN16/project-inventory-composition-schema.test.ts tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts

## 최종 지문
- permission-policy-inventory.ts: F472913AB6D27BE608D97817CF7217BE46869A903113C44690F2B23BDF07524C
- approval-history-inventory.ts: D632A275810F2D296686AF53F7383E8AFF0ED2359527BFB7440B744191F7C062
- permission-policy-inventory.test.ts: 5D945EB335A96AB4BCDA41C6A518336727C633CDE9A1EA82B535E47A72EB5FBC
- approval-history-inventory.test.ts: 0F5E86ED97307D580DAF65CE6939A4F918DD6CE69F835C559C04C33A750A502B

## 미검증과 후속
실제 PG/RLS·현재 서비스·실제 원문 파일·전체 archive/복원·UI 인수는 NOT_RUN이다. 기존 실제 키·DB·서비스 제외와 미채택 수동 정책 후보158E10BC를 유지한다. 이미 완료한 수집기 전수 검사를 반복하지 않았다.

Main만 코드4 + WI/본 결과/WORK_STATUS/WORK_PLAN 정확8경로를 checkpoint한다. 보호8 untracked는 보존한다. 복구는 이번 4코드 보완의 검토된 revert이며 자료·승인·키 삭제가 아니다. 다음은 기존 전체 통제원장과 수집 조합의 연결을 실제 DTO와 승인 범위 안에서 검토한다.
