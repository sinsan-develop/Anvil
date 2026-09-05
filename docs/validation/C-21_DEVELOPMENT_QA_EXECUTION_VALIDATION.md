# C-21 Development QA 검증

## 결과

- `COMPLETED_FOR_INDEPENDENT_REVIEW`
- local focused regression: 45 PASS / failure 0 / exit 0.
- broader agent_team/API/persistence regression: 188 PASS / 20 SKIP / failure 0 / exit 0.
- revision 2 fresh focused regression: 46 PASS / failure 0 / exit 0.
- revision 2 fresh broader agent_team/API/persistence/llm_gateway: 195 PASS / 20 SKIP / failure 0 / exit 0.
- WSL PG15·PG18RC: Git-only deploy, migration, API, authenticated SSE, Last-Event-ID, backup/restore PASS.
- Telegram: outbound-free local boundary 및 WSL PostgreSQL audit PASS; 실제 outbound 미실행.
- Provider: canonical 9/config/MoA recorded fixture PASS; runtime status port HTTP 501, 실제 provider 미실행.
- Chromium: 두 ingress에서 auth/SSE/resume/same-origin PASS. Tier는 `PAGE_EVALUATE_FETCH_SCOPE_ONLY`, UI click 증거 아님.
- cleanup: exact container/network/volume `0/0/0`.
- control checkout: active verified control stage 1개 보존, non-active stage 0.

## 독립 검토 체크리스트

1. exact7 외 mutation이 없는지 확인한다.
2. manifest의 4개 QA artifact bytes/SHA-256을 raw file과 대조한다.
3. Provider fixture PASS가 runtime status port 또는 실제 credential/model/health/cost 검증으로 승격되지 않았는지 확인한다.
4. Telegram WSL POST가 synthetic identity와 내부 endpoint만 사용하고 실제 Telegram outbound가 없었는지 확인한다.
5. Chromium ledger에 credential/header 원문이 없고 모든 URL이 pathname만 기록됐는지 확인한다.
6. `/api/workbench/config` 404 finding이 숨겨지지 않았는지 확인한다.
7. WSL exact project/label cleanup residue0과 server log error0을 확인한다.
8. active control checkout 실제 HEAD가 `772afbd5eb55791ca7b5002d58378437ea496750`이고 candidate가 그 ancestor인지 확인한다.
9. control manifest/deploy/verify/cleanup raw SHA-256가 manifest의 immutable binding과 일치하는지 확인한다.
10. browser receipt가 request/response/requestfailed 전부를 포함하고 failed attempted URL에도 same-origin predicate를 적용하는지 확인한다.
11. manifest receipt를 명시된 canonicalization으로 독립 재계산해 5개 receipt SHA-256와 대조한다.

## Revision 2 판정 근거

- I1 `PASS`: PG15/PG18RC 재실행 command/exit, Telegram DB audit IDs/outcomes, server receipt, browser normalized ledger, cleanup residue를 report/manifest에 결박했다.
- I2 `PASS`: 실제 Chromium과 self-test 모두 3개 Network phase를 수집한다. cross-origin failed request negative self-test가 거부를 확인한다.
- I3 `PASS`: runtime control 출력만 신뢰하지 않고 active pointer → resolved checkout → exact HEAD → clean → candidate ancestor → immutable action raw hash를 확인한다. wrong-root는 exit 9로 거부됐다.
- I4 `PASS`: actual adapter protocol/fake/native 경계를 network-denied 상태에서 호출했다. 이것은 actual Provider credential/egress 검증이 아니다.
- cleanup `PASS`: control cleanup 및 별도 read-only 재확인 모두 exact Compose project container/network/volume `0/0/0`이다.
- integrity `PASS`: canonical receipt 5개와 QA artifact 4개 bytes/SHA-256가 독립 재계산과 일치한다.
- known finding: `/api/workbench/config` 404. C-21 auth/SSE proof와 분리하며 제품 UI click proof로 승격하지 않는다.

## Revision 3 reviewer finding closure

- `C0/I1 PASS`: `project`는 `runProbe` required input이며 raw stdout JSON에 probe 자체가 기록한다.
- raw stdout parse 후 field injection 없이 두 WSL receipt를 canonicalize했고 manifest receipt/hash와 일치한다.
- self-test의 explicit project와 fixture default project를 모두 코드 계약으로 유지한다.
- WSL browser-only 재검증을 위한 deploy/verify는 exit 0, PG15/PG18RC probe는 exit 0/0, 즉시 cleanup exit 0, 최종 residue `0/0/0`이다.
- revision 3 fresh broader는 195 PASS/20 SKIP/exit 0이고 Chromium self/cross-origin 및 Bash syntax/contract도 exit 0이다.
- Telegram/Provider 실행 evidence는 revision 2를 유지하며 revision 3에서 재실행하거나 결과를 변경하지 않았다.
- commit 전 EOF 공백 제거 후 Telegram QA artifact는 3,596 bytes / SHA-256 `592018D4B61AFF8E15E989820464643F48E3E975579893EB7BCEB4B4DDE49E28`로 재결박됐고 의미 변경은 없다.

## 제한과 다음 판정

이 검증은 C-21 acceptance가 아니다. 독립 Reviewer/Tester는 위 evidence tier와 미구현·미검증 경계를 유지해 재판정해야 한다. 실제 Provider credential/health/model/cost 호출 또는 실제 Telegram outbound가 acceptance 필수라면 대상, 비용, Secret 사용, egress, rollback을 명시한 별도 승인 package가 필요하다.
