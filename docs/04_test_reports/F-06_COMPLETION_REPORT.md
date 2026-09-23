# F-06 OPENROUTER adapter Developer 완료보고

## 판정

`COMPLETED` — F-06 WorkInstruction의 제품 exact5 구현과 host-only 기본 검증을 마쳤다. 독립 Reviewer/Tester 판정과 Main acceptance는 이 보고의 범위 밖이며 아직 수행되지 않았다.

## 판단 이유

- 시작 cwd: `D:\Project\Anvil\.codex-sandbox\f06-openrouter-adapter`; branch `codex/f06-openrouter-adapter`; 시작 HEAD `dcebdf2473f1c05e607eec26846696bcc678fc39`; `git status --short --branch`는 clean이었다. 기준 main `19aee3360d90d3a046183ae66e6dd02150d9d747`.
- 활성 실행 lease: `worker-lease-f06-r1-20260923-001`, execution token `f06-r1-execution-fence-epoch-1-19aee3360d90d3a0`; 활성 제품 write lease: `write-lease-f06-r1-20260923-001`, write token `f06-r1-write-fence-epoch-1-46183ae66e6dd021`. 양쪽 경로 범위는 아래 exact5와 일치한다. `docs/progress/BUILD_HANDOFF.md` event sequence 1388.
- 기준 SHA-256: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`; F-06 WI `7B31A60A9BAD67DC85AB026E0B9CF559513180CF74117D3277640F91D5EA1C98`; invocation `EAFB2E318EF1725FFD56B45CC1848801FC4B1D0CDFC6BD01C6FE8A134D35FD11`.
- 변경 exact5: `packages/providers/openrouter_adapter.py`, `packages/providers/openrouter_models.py`, `packages/providers/openrouter_errors.py`, `tests/providers/test_openrouter_adapter_f06.py`, 이 보고서. F-02 snapshot·routing과 control/progress/HANDOFF는 변경하지 않았다.
- 계약: canonical `openrouter`, 요청 model passthrough, generate/stream/별도 key health/catalog discovery를 host transport의 operation으로 구분한다. 요청 model, served model, generation ID 및 확인된 serving provider/model/upstream ID를 receipt에 분리한다. routing metadata가 없거나 선택 여부가 불명확하면 provider `UNVERIFIED`다. generation metadata와 명시적으로 선택된 endpoint가 충돌하면 receipt 없이 실패한다. catalog의 USD/token quoted price와 final usage/generation의 실제 USD billed cost를 분리하고 Decimal finite·nonnegative 및 상충 검증을 적용한다. stream final usage 미수신, midstream top-level error, 변경된 request ID fingerprint, malformed/credential/non-finite material은 fail-closed한다. 402는 connection quota, generate/stream 404만 model scope이며 health/discovery 404는 일반 endpoint 오류다.
- 인증형 health는 host가 `health` operation을 OmniRoute registry의 인증형 `/api/v1/auth/key` 요청으로 결박하여 transport를 제공해야 의미가 있다. 성공 응답의 `data.is_free_tier`를 확인하고 quota `limit`·`limit_remaining`은 있을 때만 검증한다. 공개 `/api/v1/models` discovery 결과는 `credential_health=UNVERIFIED`이고 health 성공 증거로 쓰지 않는다. 실제 host transport wiring은 이번 exact5 밖이므로 이 계약의 운영 연동은 미검증이다.

## TDD 및 검증 명령

모든 pytest는 worktree cwd에서 `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B`로 실행하고 `--import-mode=importlib -p no:cacheprovider`를 사용했다.

1. RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests\providers\test_openrouter_adapter_f06.py` → exit 1, 수집 중 `ModuleNotFoundError: packages.providers.openrouter_adapter` (신규 기능 부재).
2. midstream 축약 오류 frame RED: 같은 명령 → exit 1, 2 failed/16 passed; 502·429 `choices:[]` 오류가 `RESPONSE_MALFORMED`로 분류되던 위치를 확인했다. 오류 frame을 다른 필드보다 먼저 판정하도록 수정했다.
3. key health 및 in-band nonstream 오류 RED: 같은 명령 → exit 1, 2 failed/22 passed; 인증형 key 응답과 HTTP 200 오류 본문 처리를 추가했다.
4. 마지막 stream frame metadata RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests\providers\test_openrouter_adapter_f06.py -k terminal_stream_metadata` → exit 1, 1 failed/24 deselected; 마지막 frame의 확인된 serving 계보가 누락되던 것을 확인하고 충돌 검증과 함께 보존했다.
5. catalog 문자열 가격 RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests\providers\test_openrouter_adapter_f06.py -k catalog_numeric_price` → exit 1, 1 failed/26 deselected; 숫자형 값을 quoted 문자열로 받아들이던 경계를 문자열로 제한했다.
6. Main preliminary rework RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests\providers\test_openrouter_adapter_f06.py -k auth_key_health_accepts_valid` → exit 1, 1 failed/29 deselected. OmniRoute의 유효한 `/api/v1/auth/key` 응답 `{data:{label:'ok',is_free_tier:false}}`에 quota 필드가 없어서 거절되던 결함을 확인했다.
7. routing 증거 충돌 RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests\providers\test_openrouter_adapter_f06.py -k conflicting_generation_and_selected` → exit 1, 1 failed/30 deselected. 상충하는 두 authoritative provider를 성공 receipt로 보존하던 결함을 확인했다.
8. 독립 검토 추가 RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests\providers\test_openrouter_adapter_f06.py -k "nonmodel_operation_404 or nested_credential_keys"` → exit 1, 4 failed/31 deselected. 비모델 404 scope와 중첩 credential 필드 누락을 확인했다.
9. 최종 focused GREEN: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests\providers\test_openrouter_adapter_f06.py` → exit 0, `35 passed`.
10. 관련 회귀: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests\providers tests\llm_gateway tests\provider_catalog tests\model_registry tests\budget` → exit 0, `477 passed, 4 skipped`. skip 4건은 모두 `tests/budget/test_atomic_reservation.py`의 격리 PostgreSQL 18 DSN 미설정이다.
11. 구문 검사: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -c "import ast,pathlib; files=['packages/providers/openrouter_adapter.py','packages/providers/openrouter_models.py','packages/providers/openrouter_errors.py','tests/providers/test_openrouter_adapter_f06.py']; [ast.parse(pathlib.Path(x).read_text(encoding='utf-8'),filename=x) for x in files]; print('compile AST OK',len(files))"` → exit 0, `compile AST OK 4`.

## OmniRoute source 대응

읽기 전용 `D:\Project\.omniroute-inspect`의 `release/v3.8.51` commit `20f39008892b683a639063fb8aed8c07782fb0c3`을 기준으로 대조했다. `src/lib/catalog/openrouterCatalog.ts`의 `/api/v1/models` 공개 catalog 및 price 문자열, `open-sse/config/providers/registry/openrouter/index.ts`와 `tests/unit/openrouter-key-validation-auth-endpoint.test.ts`의 인증형 `/api/v1/auth/key`, `open-sse/config/providerErrorRules.ts`의 OpenRouter 402 connection quota, `tests/unit/openrouter-quota-6842.test.ts`의 key/credits와 공개 catalog의 분리, `tests/unit/openrouter-midstream-error-chunk.test.ts`의 HTTP 200 `choices:[]` 502/429 error frame을 F-06 계약에 반영했다. OmniRoute의 free-window 카운터·캐시는 이번 host-only exact5에 포함하지 않았다. 공개 API 문서는 wire 참고로만 사용했다.

## 미검증·잔여 위험·조치

- 실제 OpenRouter API/key, network, DB, browser, WSL, 배포는 실행하지 않았다. 키 부재·무효로 인한 실제 호출 실패는 제품 결함으로 집계하지 않았다.
- Host가 `health`를 실제 인증형 `/api/v1/auth/key`에 연결하는지, stream/generation metadata가 실제 계정·모델에서 어떤 조합으로 오는지 운영 연동 검증이 남아 있다. 이 단계의 fake transport PASS를 실제 Provider PASS로 승격하지 않는다.
- Main Agent가 exact5 diff와 lease scope를 독립 검토한 뒤 F-06 acceptance 경로를 진행한다. rollback은 이 branch에서 위 exact5 변경만 제외한 시작 HEAD `dcebdf2473f1c05e607eec26846696bcc678fc39`로 돌아가는 것이다. Developer는 commit·push·merge·외부 작업을 수행하지 않았다.
