# FN16 조합 원문 현재상태·바이트 검증 연결 결과 — 2026-10-29

## 판정·범위
내부 원문 연결 source를 Main/독립 검수로 인수했다. 실제 백업·복원·UI/사용자 인수 및 전체 FN16 완료가 아니다.
기준 branch codex/av3-stage-b, 시작 HEAD d80946a32e109094611c933b449b567bfcd5ee38. WI docs/work_packages/FN16_PROJECT_INVENTORY_ARTIFACT_VERIFICATION_IMPLEMENTATION_20261029.md SHA256 460C09286237B0B39219800802D8A49496482D9223F2B2C6E0286D6E87CF5FA0. Main 관리·검수·통합, 단일 primary 구현, reviewer 읽기 검수. 실제 키·DB·서비스/Agent·실제 파일 reader 실행0.

## 변경 전후·유지
기존 자료 조합은 원문 byte검사 NOT_PERFORMED였다. 새 verifyProjectInventoryArtifacts는 실제 고정19 조합의 exact 원문 합집합과 대화 참조를 재결박하고 기존 현재권한/상태·바이트 검증을 호출한다. 중복 원문은1회 읽고 최초 원문/메시지 격리·검사 UNKNOWN은 다른 출처와 공유돼도 IO0을 유지한다. 최초 eligible 원문의 이후 상태/원hash/메시지 변동은 전체 실패다. 마지막에 검증 대상 전체의 메시지/원문 현재상태를 재대조한다.
변경은 artifact-current-verification.ts import1+끝 신규 함수64줄과 신규 행동/schema 시험2다. 기존 helper·normalizer·기존 진입점 본문은 삭제/수정0이며 Primary8fd6ea 원본문 바이트 SHA256 9EF2A9F0E8961817F3F18EB484AF244CBF08156C8EFA76B507D8927FF6977FFE가 시작 지문과 같았다. Main85e0dd diff와 독립c47111에서도 추가만 확인했다. 완료된 기존 collector 전수 재검사0.
새 함수 전용 bounded CTE는 기존 helper의 정확 artifact SELECT에만 적용하고 raw rows 형태를 복원한다. 추가 metadata·남은 기한·최소 세션기한을 누적하며 전체 false 계약과 원 미검증을 보존한다. 조합 hash는 전체 백업 checksum이 아니고 검증 원문 일부는 전체 보존/복원 가능의 증거가 아니다.

## 실제 검증 증거
- Primary8d747c RED: 신규10시험 0PASS/10FAIL/skip0/371.3005ms, 새 함수 미구현. 실제 환경 실패와 분리.
- Primarydc4057 GREEN: 신규13PASS/0FAIL/skip0/1025.8945ms, npm run typecheck exit0.
- Main94e844: node --test tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts →13PASS/0FAIL/skip0/1078.4564ms/exit0. npm run typecheck 및 git diff --check exit0. 최종3지문 일치.
- 실제19 collector+메모리SQL/reader로 공유원문 IO1·최초차단 해제 뒤 IO0·현재격리/변조/누락 실패·IO전/최종 변화·신원/OWNER/COMMIT후취소·byte변조·DB/reader회수불명503 우선·최소 expiry/기한을 확인했다.
- 추가 metadata 반례는 정상실측 usage-1024에서 같은 최종 인증 단계·IO1까지 도달한 뒤413을 확인해 조합 조기 초과와 구분했다. 각 항목 바이트 수의 독립 재계산 증명은 아니다. closeError+abort 동시503을 별도로 확인했다.
- 독립97b383 읽기 C0/I0, 최종3지문 동결 조건을 Main이 확인했다. 초기 fake envelope 지적은 새 전용 CTE→raw 복원 구현 대조로 결함 아님을 확인했으며 잘못된 finding을 제품 결함으로 세지 않았다.

## 최종 지문
- apps/server/modules/backups/artifact-current-verification.ts: 1CD54C6F937D5CB432B879AC9B45FB89BAB5D3F6006F6BE0168525EA9FCBA3A4
- tests/unit/FN16/project-inventory-artifact-verification.test.ts: 282C695379E93859ED4DE9E3E2A7F8A49FEA494957515456B6FF3E48DB5F6D00
- tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts: AC1B9FD5D487E174F79AC43E2B95CF16176D4A98D28C06E138FD4DA2C7846649

## 오류·미검증·다음 조치
도구 인용/UTF8 명시 누락은 교정하고 제품 오류와 분리했다. 동일 근본 제품 실패3회 없음. 실제 PG/RLS·실파일/OS 안정·강제 실시간 상한·모든 시점/새 메시지 탐지·키/서비스·UI·archive/검증복원은 NOT_RUN이다. 최초 관측 자료만 검증하며 전체coverage/atomic/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed=false. 158E10 정책 후보 미채택을 우회해 READY/정책저장/API/실행 허가로 사용하지 않는다.
보호 untracked8은 유지한다. Main이 허용3+WI/결과/WORK_STATUS/WORK_PLAN 정확7경로만 게시하고 실제 다음 미완료 선행을 선정한다. rollback은 import/신규함수/시험의 검토된 Git revert이며 자료·백업 삭제0, 기존 helper 복원 작업 불필요. 전체 WORK_PLAN은 미완료다.
