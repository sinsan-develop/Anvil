# C-02 WorkInstruction R1 — DelegationPacket 권한·컨텍스트·egress 경계

## 권위와 기준선

- Work Package: `C-02`
- 기준 commit: `d55763bdfe4595ce35ec1fce4da8aa0a0157afa5`
- 설계서 SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 책임: 최소 `DelegationPacket`, Main→Developer 권한·컨텍스트·egress immutable snapshot 계약
- 필수 검증: `AV-AGT-001`, `AV-SAFE-022`
- 선행조건: C-01 `ACCEPTED`, C-02 `READY_NOT_STARTED`, active lease 없음

## 목표

기존 C-02 prototype을 현재 권위 기준선에 재결박한다. Main이 Developer에게 전달하는 packet과 child permission/context/egress snapshot을 결정론적으로 검증하고, 필수 경계 누락·변조·parent 권한 확대를 실제 runner dispatch 전에 fail-closed로 거부한다.

## 필수 계약

1. `DelegationPacket`은 설계서 §47.6의 다음 정보를 빠짐없이 갖는다.
   - identity: delegation, parent Run/Agent, WorkInstruction, plan revision, Step, workspace
   - objective, `in_scope`, `out_of_scope`, `allowed_paths`, `prohibited_actions`
   - permission profile, expected result schema, required evidence, budget reference
   - completion conditions, baseline, permission, context, DataEgress snapshot hash
   - canonical packet hash와 schema version
2. Permission snapshot은 최소 allowed path/action/tool/backend와 prohibited/protected path/action을 immutable하게 표현한다.
3. DataEgress snapshot은 `local_only | metadata_only | approved_paths | masked_content`, provider allowlist, approved paths, excluded paths를 immutable하게 표현한다.
4. child allowed 범위는 parent 범위보다 넓을 수 없고 parent deny/protected/excluded 제약을 제거하거나 완화할 수 없다. 의미가 다른 path와 action 집합을 단순 교집합으로 비교하지 않는다.
5. C-02에서는 profile 종류를 암묵적으로 변환하지 않는다. child egress profile은 parent와 동일해야 하며 provider/approved-path는 부분집합, excluded-path는 상위 제약을 모두 유지해야 한다.
6. repository path/pattern은 slash-normalized relative identity이며 drive, UNC, absolute, backslash, `.`/`..`, 빈 segment, 중복, 허용/금지 충돌을 거부한다. 지원 glob은 exact 또는 trailing `/**`로 제한한다.
7. canonical JSON은 key 정렬, UTF-8, NaN 거부, duplicate key 및 unknown field 거부를 강제한다. packet/snapshot hash는 lowercase `sha256:` 형식이고 실제 canonical payload와 일치해야 한다.
8. validation receipt는 packet hash, parent/child permission hash, parent/child egress hash, verdict, ordered reason code와 field를 포함하며 `E-AUD`로 재현 가능해야 한다.
9. 모든 거부는 runner/provider/network dispatch 이전에 끝나며 외부 송신 횟수는 0이다.
10. 기존 C-03+ 소비자가 새 검증 입력을 전달해야 하는 경우에만 최소 adapter 변경을 허용하며 lifecycle 상태·runner 동작은 변경하지 않는다.

## 허용 경로

- `packages/orchestration/delegation.py`
- `packages/orchestration/__init__.py`
- `packages/orchestration/developer_lifecycle.py` — 새 C-02 검증 입력 전달만 허용
- `packages/e2e/harness.py` — 기존 fixture compatibility만 허용
- `tests/orchestration/test_delegation_packet.py`
- `tests/orchestration/test_developer_lifecycle.py`
- `tests/orchestration/test_developer_lifecycle_c04.py`
- `tests/orchestration/test_takeover_c13.py`
- `tests/e2e/**` — 기존 fixture compatibility만 허용
- `.superpowers/sdd/Anvil_작업계획서_v1/task-C-02-report.md` — 비추적 상세보고

## 금지

- C-03 이후의 신규 lifecycle, API, DB migration, UI, Provider, Telegram, Secret Broker, deployment 구현
- network·Provider·Telegram·DB·browser·WSL·ysna 호출
- 기존 seq1~728, historical evidence, C-01 제품/수락 파일 변경
- 설계서·작업계획서 변경, 새 dependency 추가, commit·push·PR·merge
- 허용 경로 밖 수정과 다른 Subagent 생성

## TDD 및 수락 기준

1. 새 동작별 RED를 실제로 확인한 뒤 최소 구현으로 GREEN을 만든다.
2. 각 필수 field의 누락·빈 값·잘못된 타입·비정규 hash가 정확한 reason code로 거부된다.
3. baseline/context/permission/egress snapshot의 stale 또는 변조가 거부된다.
4. child path/action/tool/backend/provider 확대와 parent deny/protected/excluded 완화가 거부된다.
5. hostile path/JSON/NaN/duplicate/unknown input이 fail-closed다.
6. 정상 packet round-trip/hash/receipt가 동일 입력에서 결정론적이다.
7. C-02 신규 테스트와 영향받는 orchestration/e2e 회귀, compileall, `git diff --check`가 통과한다.
8. 실제 외부 실행은 `NOT_EXECUTED`로 명시한다.

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED` 중 하나로 보고한다. 시작 HEAD/branch/status, RED와 GREEN 명령·결과, 변경 파일과 diff, 미실행 범위, 잔여 위험, rollback, 오류 fingerprint/count를 상세보고 파일에 기록한다.
