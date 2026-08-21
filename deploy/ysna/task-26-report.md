# C-32 ReleaseManifest 및 배포 preflight 보고서

## 판정

`PREFLIGHT_BLOCKED_TARGET_MISMATCH`.

현재 승인 후보 commit은 `173a835cadb38eaad0e931997c9819177e802b1f`이며, 로컬 작업 트리는 clean이다. 그러나 `ysna-server:~/deploy/anvil/repo`의 read-only preflight에서 detached HEAD가 `d4cb841464c19817afd79ed7127cc3ad5dc9a4b4`로 확인되어 동일 full SHA 조건을 충족하지 않는다.

## 수행한 검증

| 항목 | 결과 |
|---|---|
| `pytest tests/agent_team tests/api tests/persistence tests/browser -q` | PASS, 81 passed |
| `python -m compileall -q packages apps migrations tests` | PASS |
| `git diff --check` | PASS |
| 로컬 Git status | CLEAN |
| migration head | `0011_telegram_webhook_state` |
| target checkout status | CLEAN, detached |
| target compose | `docker-compose.local.yml`, `services: {}` |
| target existing `anvil-web` | running, unchanged; read-only inspect |

## 변경·금지 경계

- 생성: `deploy/ysna/ReleaseManifest.json`
- 생성: 이 보고서
- 실행하지 않음: push, server checkout, server-local patch, restart/recreate, migration, webhook 등록, 공개 proxy/DNS 변경
- secret 값은 기록하지 않고 이름만 ReleaseManifest에 기록했다.

## 다음 조치

Main Agent가 target checkout을 승인 후보 full SHA로 정합화할 별도 배포 WorkInstruction과 권한을 확인한 뒤, 동일 SHA preflight를 다시 수행해야 한다. 이 보고서는 target mismatch를 해소한 것으로 간주하지 않는다.
