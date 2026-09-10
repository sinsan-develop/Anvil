# WI-C-21-WORKBENCH-UI-WSL-AUTH-BROWSER-RUNTIME-RETRY-R7-RESULT-20260909-001

## 목적

R6의 PowerShell stdout/exit-code 혼합 수집을 native result object로 분리하고 immutable control v2/candidate의 actual WSL development validation R7을 정확히 1회 실행해 seq657~662 exact12 projection으로 기록한다.

## 권위와 범위

- parent/private record `0e22a1d4e47cdff117b894dd885af816f354a550`
- runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`
- candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`
- exact12 Windows/ordinal `335DD6D1A0DAE21EEF33E7ACC095757E5772DFBB158B3961EB74CA5DECF29C67` / `1440E42A35D52FCC1924901F8665852ABCE928754003F34964507AE4B2D4AC77`
- cumulative261 Windows/ordinal `A3B103827529073532AF5208A8EB183D72411885F93EF6CCAD808CC084ADC29B` / `AAAC92F5DAD74BF24485D35053509B7AACAC8C1A72199692A043D93290DBDEEE`
- 제품/deploy/probe/WorkPlan/`.env`와 seq1~656/historical evidence는 수정하지 않는다.

## 실행 계약

- local native wrapper self-check는 harmless command만 사용하며 WSL action으로 세지 않는다.
- native invocation은 `$output = @(& <command> 2>&1); $exitCode=[int]$LASTEXITCODE; [pscustomobject]@{Output=[string[]]$output;ExitCode=$exitCode}`로 분리하고 caller는 `.ExitCode`만 판정한다.
- read-only preflight 뒤 deploy→verify→PG15 browser→PG18RC browser를 각 최대 1회 수행하고 outer-finally cleanup은 정확히 1회다.
- Playwright/Chromium은 R6 승인 경로를 process-local env로만 사용한다. 설치/download/`.env` mutation/runtime retry를 금지한다.
- Provider external, Telegram, Oracle Cloud, ysna, main, C-01은 실행하지 않는다.

## 완료 조건

성공/실패 모두 seq662 projection으로 종결하고 accepted=false, C-21/C-01 blocked, DIR-2 not triggered를 유지한다. strict checker, focused tests, deterministic generated5, exact12 sole direct-child를 검증하며 push하지 않는다.

## 실제 종결

native wrapper와 preflight, deploy1, verify1은 PASS했다. PG15 browser는 parsed secret-safe receipt non-PASS/exit1이었으나 세부 predicate가 보존되지 않아 `FAILED_R7_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT`로 종결한다. PG18RC는 미실행, cleanup1은 PASS, 재실행은 없다. R8 전에 secret-safe parsed receipt/predicate persistence를 먼저 고정한다.
