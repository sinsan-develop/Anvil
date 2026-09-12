# C-03 WorkInstruction R2 — Developer read-only lifecycle compatibility

## 권위와 기준선

- Work Package: `C-03`
- WorkInstruction ID: `WI-C-03-DEVELOPER-LIFECYCLE-R2-20260912-001`
- Parent approval: `APPROVAL-20260814-WORKPLAN-V16-001`
- Direct scope approval: `C-03-WI-R2-HARNESS-COMPAT-APPROVED-20260912`
- Main internal revision authority: `MAIN-AUTH-C03-WI-R2-20260912-001`
- Superseded WorkInstruction: `WI-C-03-DEVELOPER-LIFECYCLE-R1-20260912-001` / SHA-256 `96A6F7EF446E663560BC1CD6E05F58D1314AD682B8FFAE308B42FB38552E10B7`
- 기준 commit: `2dcd4da89e92425be52b570ae2110f60dfcc29de`
- 설계서 SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 수락 결박: `AV-AGT-004`, 검증 수준 `L3`, 방법 `AI`, 증거 `E-GIT`, `E-ART`
- 선행조건: C-02 `ACCEPTED`, C-03 `IN_PROGRESS`, R1 worker lease active, R1 write lease active

## 목표

실제 Developer Subagent 한 명을 읽기 전용으로 시작하고, Main Agent가 기다림과 정지를 제어하며 종료 시 raw result를 자동 수신하는 M1 lifecycle을 구현한다. 필수 PENDING stop fail-closed 계약과 기존 E2E 호출자의 호환을 위해 `SyntheticE2EHarness.record_takeover`가 공개 lifecycle 전이를 사용해 start→wait→stop 순서를 지키도록 한다.

R2는 기능·요구사항·중요 위험을 변경하지 않는 내부 호환 revision이다. 원 human approval을 부모로 유지하되 WI content hash 변경으로 R1 binding과 write lease를 무효화한다. R1 worker lease는 동일 actor·baseline·범위의 실행 주체로 유지하고 write lease만 폐기 후 epoch 2로 재발급한다.

## 허용 경로

- `packages/orchestration/developer_lifecycle.py`
- `packages/orchestration/__init__.py`
- `tests/orchestration/test_developer_lifecycle.py`
- `packages/e2e/harness.py` — `SyntheticE2EHarness.record_takeover`의 start→wait(또는 공개 lifecycle state 전이)→stop 순서 호환만 허용

문자열 prefix는 경로 권한이 아니다. 위 네 경로의 segment-aware exact identity만 허용하고 `packages_evil/**`, 절대경로, drive/UNC, backslash, `.`/`..`, 빈 segment를 거부한다.

## 필수 계약

1. lifecycle은 정확히 한 명의 `developer-primary` 세션만 `start → wait → stop → raw result auto-receive` 순서로 처리한다.
2. start는 immutable packet hash와 baseline commit에 session_id를 결박한다. 같은 session_id를 재사용할 때 packet 또는 baseline이 다르면 runner 호출 전에 거부한다.
3. runner가 반환한 session_id는 요청한 session_id와 정확히 같아야 한다. 다르면 상태 승격과 결과 수신을 거부한다.
4. 작업 실행은 read-only이고 repository write, shell mutation, network egress를 허용하지 않는다.
5. raw result freeze는 JSON-compatible scalar/list/mapping만 받는다. mapping key는 실제 문자열이어야 하고 `str(key)` 강제 변환을 금지하며 set/frozenset과 비결정적 순서 자료형은 거부한다.
6. freeze 결과는 UTF-8 canonical JSON bytes로 고정한다. key 정렬, NaN 거부, 입력 객체와 독립된 snapshot을 보장한다.
7. wait/stop/result는 올바른 lifecycle 상태와 동일 session binding을 요구하며 중복·역순·stale 호출을 fail-closed로 거부한다.
8. raw result는 자동 수신하되 자동 합격으로 취급하지 않는다. `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`를 구분해 Main 판단 대상으로 전달한다.
9. `SyntheticE2EHarness.record_takeover`는 lifecycle caller 예외를 두지 않고 start 뒤 wait 또는 공개 lifecycle state 전이를 거친 다음 stop해야 한다. 다른 E2E 기능·동작·테스트 변경은 금지한다.

## 금지

- C-04 이상 기능, Skill, Hook, 다중 Developer, Reviewer/Tester 병렬화
- Provider, Telegram, Secret, DB, API, browser, WSL, deploy, network 실행 또는 변경
- 기존 seq1~740, historical evidence, C-02 및 C-03 R1 산출물 bytes 변경
- 허용 경로 밖 제품 변경, 새 dependency, commit, push, PR, merge

## TDD와 완료 증거

요구 동작별 RED를 먼저 확인하고 최소 구현으로 GREEN을 만든다. 정상 lifecycle, PENDING stop 거부, 동일 session 재사용, runner session mismatch, exact path와 `packages_evil` 충돌, non-string key와 set 거부, canonical raw freeze 결정성, `record_takeover`의 공개 start→wait→stop 호환만 검증한다. rollback은 R2 exact4 제품 변경을 제거하고 R1 write lease 범위로 돌아가되, 다시 제품 write를 시작하려면 새 lease를 발급하는 방식이다.
