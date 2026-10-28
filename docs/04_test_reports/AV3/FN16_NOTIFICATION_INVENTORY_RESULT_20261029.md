# FN16 본인 승인알림·최초 읽음 이력 수집 결과

2026-10-29 / Main 어울 / codex/av3-stage-b / 시작 e98d39cd10f782d41248ababe978321dd6a5b974.

## 판정
본인 승인알림과 최초 읽음의 내부 metadata 수집 구현·합성검증 완료. 전체 FN16, 실제 백업·복원, 화면 연결과 사용자 인수는 미완료다. 실제 키·DB·서비스 변경은 없다.

## 변경과 근거
신규 notification-inventory.ts와 시험 2개만 제품 범위다. WI FN16_NOTIFICATION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md의 SHA256은 2E93986AA164778BC8A1214C02525CE81C0A2F774358C153E623839C59D013A4다.
본인 recipient의 알림/최초 읽음, 원 승인요청 snapshot과 현재 상태, 참조 명령·권한 영수증·감사를 수집한다. 명시 6표/열·유한 keyset·크기/시간 상한·본인 GUC·양끝 현재 권한 대조를 유지한다. 원 hash 검증 뒤 신원 투영을 익명화하고 projectionHash를 별도로 계산한다. 과거 client와 최초 요청 PENDING/v1을 현재 client/현재 승인 상태로 덮어쓰지 않는다.

## 검증
- Main ff5df9 최초 13건: schema 1 PASS, 미구현 12 FAIL, skip 0, 170.9266ms, exit 1.
- Main 9a27ef 후보 13 PASS/skip 0/724.8055ms, typecheck·diff exit 0. 독립 검수는 C0/I1/M0: operation을 포함한 중복 키가 실제 project_command_once(project_id,actor_id,command_id)와 달랐다.
- 기존 시험 기대를 유지하고 정합 재결박한 교차 연산 중복 반례 1개 추가. Main 526d5b: Missing expected rejection, 1 FAIL/skip 0/389.0278ms, exit 1.
- 제품 수정은 requestKey의 operation 접두사 제거뿐이다. 독립 검수의 메모리 역산 hash가 이전 AFE6F88D와 일치했다.
- Main 1c2f09: node --test --test-reporter=tap tests/unit/FN16/notification-inventory.test.ts tests/unit/FN16/notification-inventory-schema.test.ts → 14 PASS/0 FAIL/skip 0/788.7964ms/exit 0. npm run typecheck 및 git diff --check exit 0.
- 독립 최종 C0/I0/M0, I1 해결. 독립 검수는 읽기만 했으며 Main 시험과 구분한다.

## 지문
- apps/server/modules/backups/notification-inventory.ts: 02981FB2B707FABEF6B37E316B505428A342502CC460E9FC342F94B762BAE5FB
- tests/unit/FN16/notification-inventory.test.ts: D1BFFB5EF4F72A2C7590ED6E933FD260A4C4FE786D45FDA89529CC88770FF7F9
- tests/unit/FN16/notification-inventory-schema.test.ts: 84AB070ECCF1BBEB7627865F01418A5431A1123D354B888D22CF828740153932

## 미검증과 복구
실제 DB/RLS/원문FS/키/서비스/Agent는 NOT_RUN. 다른 수신자·설정·반복 읽음 명령·승인 결정/소비 이력은 NOT_COLLECTED. 원 requestApproval 전체 preimage·현재 정책/승인 결박·감사 전체 chain·원문 검증은 NOT_PERFORMED다. fullProjectCoverage/restorable/executionAuthorized/dispatchPerformed/atomicSnapshotVerified는 false다. 알려진 비밀 표식 검사만 수행하며 완전한 탐지를 주장하지 않는다.
신규 SQL/DB 적용과 QA 자원 생성은 0. rollback은 신규 source/test의 검토된 revert이며 기존 데이터/키/보호 미추적 자료는 변경하지 않는다. 다음 작업은 기존 결과 제출 이력의 내부 수집이며 수동 정책 후보는 별도 미채택 상태다.
