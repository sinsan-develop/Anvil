# C-21 Workbench UI WSL authenticated browser runtime retry R10 result

`FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R10_WSL_DEVELOPMENT_VALIDATION`

## 판정

- R10 controller TDD와 actual 전 self-check, final read-only WSL preflight는 PASS했다.
- 최초 actual 요청은 안전 심사에서 pre-dispatch/action0으로 거절됐고, 이후 신산님의 exact direct approval과 self-check/preflight 재확인 뒤 same R10 one-shot을 실행했다.
- 실제 WSL runtime action은 deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 browser1 `exit1/FAIL`, PG18RC browser0 `NOT_EXECUTED`, outer-finally cleanup1 `exit0/PASS`, retry0이다.
- PG15 safe receipt는 `result=ACCEPTANCE_FAILED`, `runtime_execution=EXECUTED`, viewport3 중 pass2, provider read GET only, write0/cross-origin0/fixture0, Last-Event-ID exact, secret safety0, screenshot memory-only, filesystem mutation residue0다. native exit1과 receipt ACCEPTANCE_FAILED는 일치한다.
- exact false predicates는 `receipt.result==PASS`, `viewports.all_acceptance_predicates==true`, `native.exit_code==0`이다. 다만 safe transformer가 실패 viewport 이름과 개별 UI/SSE/accessibility false field path를 보존하지 않아 재실행 없이 더 좁은 제품 원인을 확정할 수 없다.

## 준비 증거

- parent/private record `27406570cbfbb89f19ee3a5d746687125d043d7e`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`, immutable control `fb311d456fe3cbb2e8439f39017356ddec6cf266`을 사용했다.
- seq686 controller focused TDD는 RED `6 failed, 280 deselected` 후 GREEN `6 passed, 280 deselected in 5.96s`다.
- final self-check는 alias collision0, AST parse error0, synthetic4 one-object/secret-safe, harmless Node stdout/stderr 각 line1, known SHA-256, fixed nonzero exit를 PASS했다.
- final preflight는 application/control clean exact, manifest/control-runtime/probe hash exact, env mode600/hash/name/scope exact, initial residue0, process-local Playwright/Chromium presence를 secret 값 비노출로 확인했다.

## 오류와 영향

- `R10_ACTUAL_PERMISSION_BOUNDARY_REJECTED_R1` count1: actual process 생성 전 안전 심사 거절. product/runtime/WSL/Git/external impact `NONE`, action count0.
- primary `BROWSER_ACCEPTANCE_FAILED_R10` count1: PG15 browser native exit1/receipt ACCEPTANCE_FAILED. 제품 결함은 미확정이다.
- diagnostic `R10_SAFE_RECEIPT_VIEWPORT_PREDICATE_DETAIL_INSUFFICIENT_R1` count1: safe receipt가 failing viewport/field exact path를 보존하지 않았다. 이는 재실행 없는 원인 축소를 제한한다.
- controller draft 과정의 patch/self-check 오류는 모두 actual 이전의 서로 다른 orchestration fingerprint이며 WORK_STATUS에 기록했다. WSL action과 제품 영향은 없다.

## 보존 상태와 다음 조치

- seq1~680/historical evidence, 제품/probe/deploy/`.env`는 byte-preserve 상태다.
- post-cleanup read-only preflight는 application/control clean, `.env` mode/hash byte-identical, container/network/dedicated-volume/lock residue0를 확인했다.
- current evidence SHA-256은 backup PG15 `52F690C5...E9C3`, PG18RC `97453E6C...906C`; verification PG15 `96BD2FC8...8DB2`, PG18RC `0CE473C5...4D3B`; image metadata PG15 `18108107...E88B3`, PG18RC `2E549E4B...32393`다. backup/evidence는 보존했다.
- accepted=false, C-21/C-01 blocked, DIR-2 not triggered다. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다.
- 다음은 이 failure result의 independent review이며, failing viewport/field를 보존하는 별도 successor 전 runtime 재실행은 금지한다. push는 Main에게 맡긴다.

## 직접 승인 provenance

- source/mode: `DIRECT_USER_APPROVAL`
- approved at: `2026-09-09 Asia/Seoul`
- response: `계속하자`
- subject SHA-256: `723A1D914C3540B7D4FF677C25C25DDA7CFF25ED7CD43ABF1E7D436D8B6426DC`
- scope: immutable control `fb311d4...`와 candidate `f0d4bc7...`을 사용한 격리 PG15/PG18RC deploy1, verify1, PG15 browser1, PG15 strict PASS 시 PG18RC browser1, finally cleanup1 및 승인된 테스트 container/network/dedicated volume 정리.
- exclusions: `.env`, 다른 Docker 자원, Provider external/Telegram/Oracle/ysna/main/C-01 변경·실행.
- prior rejection은 pre-dispatch/action0으로 남기고 승인 후 self-check/preflight exact PASS를 재확인해 same R10 one-shot을 재개했다.
