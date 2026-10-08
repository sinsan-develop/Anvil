# F-20/U-01 R4 Dashboard Critical Alerts 저장 기록 WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical WI Event·epoch16 exact3 dual lease/G-05 PASS 전 제품 exact3 수정 금지.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_설계서_v2.md` §29.2, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_U01_R4_CRITICAL_ALERTS_BINDING_PLAN.md`.
- 환경: Windows 로컬 개발, 지정 원격 exact SHA를 `ssh WSL-server`에서 격리 검증. 기존 branch 하나만 사용하며 새 branch·main 병합·ysna-server·Production 제외.

## 정확한 제품 쓰기 범위

1. `apps/web/src/console/App.tsx`
2. `apps/web/tests/f15-console.test.mjs`
3. `docs/04_test_reports/F-20_U01_R4_CRITICAL_ALERTS_RESULT.md`

Main은 R3b epoch15 write→worker lease를 순서대로 회수하고 R4 epoch16 worker/write exact3를 발급한다. 단일 Developer의 제품 경로를 Main이 동시에 수정하지 않는다.

## 구현·검증

- 기존 OIDC host의 `GET /api/operations/alerts` 저장 기록 응답만 Dashboard에서 same-origin·credential 포함 읽는다. 응답의 `data.alerts`와 `next_before_sequence`를 엄격 검증하고 critical/open 또는 acknowledged 기록의 code/source/observed_at/owner_id(미배정 fallback)·원인/대상을 안전한 텍스트로 표시한다. 100건 상한, 중복 alert_id, 잘못된 status/level/time/cursor 등은 전체 응답을 `UNAVAILABLE`로 닫는다.
- 빈 배열은 해당 페이지에 저장된 Critical 기록 없음만 뜻한다. detector 실행·경고 완전성/신선도, 다른 source 건강이나 Dashboard Critical Alerts 0건을 추론하지 않는다. older cursor가 있으면 과거 페이지 미조회/부분 결과를 보인다. `UNAVAILABLE` 및 partial에서도 정상/안전 상태를 표시하지 않는다.
- 정상/빈/부분/401·403·500/malformed/network·JSON 오류/악성 텍스트를 TDD RED→GREEN으로 검증한다. 기존 Database/Provider 카드 회귀, web typecheck/lint/build, F-13 API 인접·G-05를 실행한다. Main 독립 검토·commit/push 후 WSL-server exact SHA 실제 OIDC/API·브라우저 1920×1080/390×844·Network same-origin을 확인한다.
- 새 API·permission/role·DB schema/migration·Secret, detector/acknowledge mutation, Next Actions, Queue/Worker/Backend/Artifact 상태, 가짜 경고, 작동하지 않는 확인 버튼·딥링크는 만들지 않는다. 임시 자원은 사전 이름/수명/정리 방법을 기록하고 정확한 것만 제거한다.
- 결과보고서에 시작 HEAD/branch/status, 기준 hash·token, 변경 diff, RED/GREEN 명령·exit·실측, WSL 미검증, 기존 동작, 잔여 위험, rollback 및 progress/HANDOFF 상태를 기록한다. Developer는 Main 인수 전 commit/push/merge하지 않는다.

## 완료 경계

R4 GREEN도 U-01/F-20 수락이나 C30 사고 복구가 아니다. `OPEN_BLOCKING`·`DEFER`, 기존 skip/warning 및 실제 Production 미실행을 유지한다.
