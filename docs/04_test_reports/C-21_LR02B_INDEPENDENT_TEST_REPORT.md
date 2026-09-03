# C-21 / LR-02B 독립 검증 보고서

- 판정: `PASS / READY_FOR_MAIN_ACCEPTANCE`
- WorkInstruction: `WI-C-21-LR-02B-20260903-001`
- 기준 commit: `4178eee2ffeb0d5701e1fac058d89891331c74c2`
- Reviewer: `lr02b-independent-review` (read-only)
- 외부 side effect: `NOT_EXECUTED`

## R1 실패 및 재작업

- 최초 판정: `FAILURE_REPORT`
- fingerprint: `C21_LR02B_YSNA_DUPLICATE_SCOPE_ASSIGNMENT_PREFLIGHT_BYPASS`
- 유효 실패 횟수: `1`
- 원인: `deploy.sh`는 canonical exact 행 수만 확인하고 전체 assignment 중복을 거부하지 않았으며, `verify.sh`는 마지막 값만 읽어 반대 순서의 중복을 허용했다.
- 영향: 유효값 뒤 축소값은 deploy preflight를 통과해 checkout/build/migration 이후 runtime 시작에서야 실패할 수 있었다.
- 보완: 두 스크립트 모두 전체 assignment count가 정확히 1인지 확인한 뒤 canonical exact 값을 비교한다. canonical→reduced와 reduced→canonical 순서 모두 deploy/verify에서 거부한다.
- 재작업 결과: fingerprint `CLOSED`.

## 독립 재검증

| 검증 | 결과 |
|---|---|
| focused API | `32 passed` |
| 전체 API | `99 passed` |
| ysna deploy 계약 | `18 passed` |
| progress checker | `PASS sequence=428 reporting=AUTO_CONTINUE` |
| `git diff --check` | exit `0` |
| EvidenceManifest raw checksum | `10/10 match` |

확인한 계약:

- permission parser는 wildcard, unknown, duplicate, 공백 비정규값을 fail-close한다.
- 환경변수 미설정 시 기존 `run:events:read` read-only 동작을 유지한다.
- Task create/read, Run create, Run events SSE 네 endpoint만 test-session scope를 반환한다.
- Task/Run의 project/environment DB authority와 SSE run ID allowlist를 유지한다.
- ysna deploy/verify는 `tasks:write,tasks:read,run:events:read` 단일 assignment를 요구한다.
- exact12 write lease 밖 Developer 변경은 없다.

## Evidence binding

- Developer evidence manifest: `253F04787519BC356A6297F64EB6F0F2B3FCFAE543B15A9E8CB847CD3E240A5E`
- Developer progress report: `9E1C89B29762D09A4DCF4BD38711FB95DC6400C02DBC95F2337B0E2634181103`
- `deploy/ysna/deploy.sh`: `5F3C33987A32AEBDCB6E68F5DA88BBAC5725B757EC938F33445AF7BEC77CD339`
- `deploy/ysna/verify.sh`: `273681B3498D713DD59736EB1CEFA4FADC21EC17174A6DF749F6C27B0DF8B1B6`
- duplicate regression test: `05B27FC86D63E7FBD14179BF3FD4E7D32928902246E1D402DA8FAFB903EF6B96`

## 미검증·잔여 위험

- 실제 ysna 배포, PostgreSQL production Task/Run chain, public HTTPS/SSE, Telegram signed POST와 Provider probe는 실행하지 않았다.
- 위 범위는 승인된 LR-02C 이후 운영 검증 대상이며 C-01은 계속 차단한다.

## 최종 판정

blocking finding `0`, 새 failure fingerprint 없음. LR-02B는 Main acceptance가 가능하다.
