# WI-C-21-WORKBENCH-UI-WSL-AUTH-BROWSER-RUNTIME-RETRY-R6-RESULT-20260909-001

## 목적

R5에서 확인된 Windows Playwright dependency resolution 경계를 process-local 기존 runtime 경로로 교정하고, immutable control v2와 candidate의 actual WSL development validation R6를 정확히 1회 실행하여 seq651~656 append-only exact12 projection으로 기록한다.

## 권위와 범위

- parent/private record `4a30f234745677025a572beb2ec8dcad379ac193`
- runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`
- candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`
- exact12 Windows/ordinal: `58CE542C2E5F2946FDFC0D159D4E294AC50D9FFF1012CE86BE151F9724941975` / `2FD1D089F870B271B0E97C21F675DAAC4DAD5A1923838E25446EC4B12FFE6DC3`
- cumulative255 Windows/ordinal: `880C34EB128C6C44407AF05BC1692D7C0C6C99232EF1B89EA1BD2D9D0D584786` / `CEEBA7C44B1AB182186202579F550791FBE9455AE3138DB3B0C66FCBCC5554F6`
- 최초 architect hash 불일치는 Main 독립 재계산으로 교정한 orchestration error이며 runtime failure가 아니다.
- 제품/deploy/probe/WorkPlan/`.env`, seq1~650과 historical evidence는 수정하지 않는다.

## 실행 계약

- read-only preflight 뒤 deploy→verify→Windows canonical browser PG15→PG18RC 순서, 각 phase 최대 1회
- 첫 failure 뒤 후속 runtime phase는 실행하지 않고 outer-finally cleanup 정확히 1회
- `ANVIL_PLAYWRIGHT_MODULE`과 `ANVIL_CHROMIUM_EXECUTABLE`은 승인된 기존 경로를 process-local environment에만 주입
- install/download/`.env` mutation/runtime retry 금지
- environment-only token/run ID, screenshot memory-only, secret/token/cookie/header/raw URL 출력·저장 금지
- Provider external, Telegram, Oracle Cloud, ysna, main, C-01 미실행

## 완료 조건

성공이면 `PASSED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R6_WSL_DEVELOPMENT_VALIDATION_PENDING_INDEPENDENT_REVIEW`, 실패면 대칭 FAILED 상태를 기록한다. 두 경우 모두 accepted=false, C-21/C-01 blocked, DIR-2 not triggered이며 strict checker, focused tests, deterministic generated5, exact12/direct-child를 검증한다.

## 실제 종결

preflight와 deploy1(exit0)는 PASS했으나 PowerShell 함수 stdout/exit-code 혼합 수집으로 controller가 exit1로 중단했다. verify/PG15/PG18RC는 미실행, outer-finally cleanup1은 exit0이다. `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R6_WSL_DEVELOPMENT_VALIDATION` failure projection으로 종결하며 runtime 재실행은 금지한다.
