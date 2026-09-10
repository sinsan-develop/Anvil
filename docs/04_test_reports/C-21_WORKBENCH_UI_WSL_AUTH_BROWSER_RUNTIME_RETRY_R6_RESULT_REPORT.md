# C-21 Workbench UI WSL authenticated browser runtime retry R6 result

## 현재 판정

`FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R6_WSL_DEVELOPMENT_VALIDATION`

- classification: `WSL_DEVELOPMENT_VALIDATION`
- accepted: `false`
- C-21: `BLOCKED_NOT_ACCEPTED`
- C-01: `BLOCKED_PENDING_C21_ACCEPTANCE`
- DIR-2: `NOT_TRIGGERED`

## 기준선과 교정

- parent `4a30f234745677025a572beb2ec8dcad379ac193`
- immutable control `fb311d456fe3cbb2e8439f39017356ddec6cf266`
- candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`
- architect path hash 계산 오류는 Main 독립 재계산으로 교정했으며 product/runtime failure가 아니다.
- R5의 Playwright module default-path failure만 process-local 기존 runtime 경로로 교정한다. install/download/`.env` mutation은 없다.

## 실행 결과

- read-only preflight는 candidate/control/ref, application 및 control clean, `.env` mode600/byte hash, required names와 provider-read scope, 초기 residue0, process-local Playwright module/Chromium executable 존재를 모두 확인했다. 비밀값은 출력하지 않았다.
- actual은 정확히 1회 시작했다. deploy는 1회 `exit0/PASS`했고 backup receipt2와 image metadata2를 생성했다.
- PowerShell controller 함수가 WSL stdout과 마지막 exit code를 하나의 배열로 반환하여 성공한 deploy를 실패로 오분류했다. fingerprint는 `POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6`이고 controller exit는 1이다. 제품 UI/API/SSE 실패가 아니다.
- stop-on-first-failure에 따라 verify, PG15 browser, PG18RC browser는 모두 `NOT_EXECUTED`; runtime action 재실행은 0회다.
- outer-finally cleanup은 정확히 1회 `exit0/PASS`했다. 사후 application/control clean, `.env` byte-identical, container/network/exact-volume/lock/probe-created screenshot residue0이다.
- current R6 JSON receipt는 backup2/verification0/rollback0이다. SHA-256은 `894462E0...7ADAE`, `C02F8A37...72FB5`; image metadata SHA-256은 `18108107...E88B3`, `2E549E4B...32393`이다. 두 JSON은 `secret_values=omitted`이며 민감 키/raw URL이 없다.

## 오류와 경계

- `MAIN_R6_ARCHITECT_PATH_HASH_CALCULATION_ERROR_R1` 1회와 `DETACHED_BRANCH_EMPTY_OUTPUT_NULL_TRIM` 2회는 pre-runtime orchestration 오류이며 product/runtime action 실패가 아니다.
- Main 상태 점검의 `MAIN_COLLAB_TOOL_ARGUMENT_ERROR`는 인자 오류 3회, impact `NONE`, resolved `true`이며 Developer/runtime failure count에 포함하지 않는다.
- Python executable 탐색 3건, WSL read sandbox denial 1건, secret-safe 검사 quoting/jq unavailable 1건, pycompile cache denial 1건은 모두 tooling orchestration 오류로 분리했다.
- accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external, Telegram, Oracle Cloud, ysna, main, C-01은 미실행이다.
- 다음 조치는 PowerShell 함수 stdout과 exit code를 분리하는 별도 successor다. 이번 R6 runtime은 재실행하지 않는다.
