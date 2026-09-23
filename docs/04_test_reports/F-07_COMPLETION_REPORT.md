# F-07 UPSTAGE adapter 완료보고

## 판정

`COMPLETED` — F-07 제품 exact5 범위의 host-only 구현과 결정론적 계약 검증을 마쳤다. 독립 검토의 429 분류 Important finding 1건을 재현·수정했다. Main Agent 재검토와 인수 판정은 별도다. 실제 Upstage key/API/Network, DB, 브라우저, WSL, 배포는 실행하지 않았다.

## 판단 이유

- 작업자: `developer-primary-f07-r1`; worker lease `worker-lease-f07-r1-20260924-001`, execution fence `f07-r1-execution-fence-epoch-1-f38880326e614b3e`; write lease `write-lease-f07-r1-20260924-001`, write fence `f07-r1-write-fence-epoch-1-06a2b67ba7b11799`. 두 lease 모두 작업 시작 시 `ACTIVE`였으며 제품 exact5와 일치했다.
- 시작 branch `codex/f07-upstage-adapter`, HEAD `498f7f62b90a06818bad67325b595f3af977e145`, `git status --short --branch`: clean. 기준 main `f38880326e614b3e06a2b67ba7b1179957bdf3f1`.
- 기준 SHA-256: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`; WorkInstruction `B681077B227190C0C6FD9071588A44144F16F1156EFC4D81C3BF84A09540B1CA`.
- OmniRoute read-only clone `release/v3.8.51` HEAD `20f39008892b683a639063fb8aed8c07782fb0c3`의 `open-sse/config/providers/registry/upstage/index.ts` 및 `open-sse/config/providers/shared.ts`에서 canonical ID `upstage`, OpenAI format/default executor, bearer, chat URL, 등록 모델 `solar-pro3`·`solar-mini`를 대조했다.
- F-02 model snapshot/routing 계약과 기존 Provider 파일을 수정하지 않았다. `AV-OPS-010`, `AV-OPS-011`, `AV-FLOW-019(UPSTAGE)`에 해당하는 adapter fixture 경계만 검증했다.

## 조치와 변경 파일

- `packages/providers/upstage_models.py`: 정적 registry 출처·wire metadata, 분리된 transport/receipt/stream 값 객체, 결정적 hash.
- `packages/providers/upstage_errors.py`: 400/401/403/404/405/408/429/5xx 조건부 mapping, retry-after 형식·상한, credential fail-closed. 403의 credit·billing·IP 불명확 응답은 단정하지 않는다. 429는 명시적인 `error.code`가 usage/credit limit인 경우에만 quota, 알려진 rate code인 경우에만 retryable rate limit으로 분류한다. Code 부재·미인식은 `PROVIDER_429_AMBIGUOUS`, nonretryable이다.
- `packages/providers/upstage_adapter.py`: injected host transport, 송신 전 request ID fingerprint, 성공 replay·실패 후 동일 입력 재시도, generate/stream/health/discovery, abort·최종 usage provenance. Discovery는 정적 등록 목록이며 credential health/live freshness는 `UNVERIFIED`로 남긴다. Health `AVAILABLE`은 host가 인증형 probe 결과 `{status:ok, authenticated:true}`를 반환할 때에만 부여한다.
- `tests/providers/test_upstage_adapter_f07.py`: fake host 계약 31개. 정상 wire, 충돌·재시도, role-only·null usage·final usage/ID 일관성, abort, 정적 discovery/health 분리, 오류·retry-after·credential을 확인한다.
- 이 완료보고. 다른 제품·control/progress/HANDOFF 파일은 수정하지 않았다. Git commit/push/merge도 수행하지 않았다.

## 실행 명령과 실제 결과

모든 pytest는 worktree cwd에서 `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B`, `--import-mode=importlib -p no:cacheprovider`로 실행했다.

1. RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests/providers/test_upstage_adapter_f07.py` → exit 1, 수집 중 `ModuleNotFoundError: packages.providers.upstage_adapter`.
2. 최초 GREEN: 같은 focused 명령 → exit 0, `21 passed`.
3. 429 code 및 health/credential/abort 추가 후 focused: 같은 명령 → exit 0, `25 passed`.
4. 정적 wire metadata RED: 같은 명령에 `-k static_discovery` 추가 → exit 1, `KeyError: 'format'`; metadata 반영 뒤 최종 관련 회귀에서 GREEN.
5. 최종 관련 회귀: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget` → exit 0, `502 passed, 4 skipped in 4.21s`. Skip 4건은 `tests/budget/test_atomic_reservation.py`의 isolated PostgreSQL 18 DSN 미설정.
6. AST 구문 검사: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -c "import ast,pathlib; files=['packages/providers/upstage_adapter.py','packages/providers/upstage_models.py','packages/providers/upstage_errors.py','tests/providers/test_upstage_adapter_f07.py']; [ast.parse(pathlib.Path(x).read_text(encoding='utf-8'),filename=x) for x in files]; print('compile AST OK',len(files))"` → exit 0, `compile AST OK 4`.
7. `git diff --check` → exit 0. 신규 파일은 untracked이므로 이 명령의 검사 범위에 포함되지 않는다.
8. 독립 검토 Important finding `F07-429-AMBIGUOUS-RETRY` RED: 같은 focused 명령에 `-k '429'` 추가 → exit 1, `4 failed, 6 passed, 21 deselected`. No-code/unknown-code 429가 `RATE_LIMIT`로 잘못 분류되는 것을 재현했다.
9. Finding 수정 후 focused: 같은 focused 명령 → exit 0, `31 passed in 0.06s`.
10. 수정 후 관련 회귀: 5번과 같은 명령 → exit 0, `508 passed, 4 skipped in 3.97s`. Skip 이유는 동일한 isolated PostgreSQL 18 DSN 미설정.
11. 수정 후 AST 구문 검사: 6번과 같은 명령 → exit 0, `compile AST OK 4`.

## 미검증·잔여 위험·복구

- `UNVERIFIED`: 실제 Upstage credential/인증형 health probe, response wire, `stream_options`의 final usage 옵션 지원 여부, rate/credit/IP error code의 실제 Provider 표현, Network, DB, 브라우저, WSL, 배포. Host fixture가 final usage를 실제 제공할 때에만 `PROVIDER_FINAL`로 인정했고, 없으면 fail-closed한다.
- Provider 모델 목록은 OmniRoute commit의 정적 두 모델만 반영한다. 실시간 모델 가용성이나 credential 유효성으로 승격하지 않는다.
- Host transport가 인증형 health probe와 bearer 주입을 실제로 결박하는 배선은 이 Package 범위 밖이다. Fake host가 `AVAILABLE` receipt를 낸 사실은 live health PASS가 아니다.
- Rollback: Main Agent가 이 F-07 신규 다섯 파일만 해당 작업 브랜치에서 제거하고 관련 회귀를 재실행한다. 기존 F-02/다른 Provider 계약에 손댄 변경은 없다.
- `docs/progress/build-progress.json` 및 `docs/progress/BUILD_HANDOFF.md` 갱신은 Main Agent 소유이므로 작업자가 수행하지 않았다.
