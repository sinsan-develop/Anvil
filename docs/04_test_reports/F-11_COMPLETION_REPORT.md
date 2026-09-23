# F-11 개발 완료보고 — OLLAMA local adapter와 endpoint SSRF 방어

## 판정

`COMPLETED` (Developer 기본 검증 제출). 독립 Tester 판정과 Main Agent의 최종 `ACCEPTED`는 별도다. 제품 exact6 외 변경, Git commit/push, control/progress 변경은 수행하지 않았다.

## 기준선·시작 상태

- Work Package `F-11`, actor `developer-primary-f11-r1`, branch `codex/f11-ollama-adapter`, 시작/현재 HEAD `ebe39c2ee7f27bfe3bd73937c385eac9e6c865ec` (clean 시작).
- 기준 main `4e5b20cfbe2342818396953c36a7c8490e8fa8aa`.
- 활성 worker lease `worker-lease-f11-r1-20260924-001`, execution token `f11-r1-execution-fence-epoch-1-4e5b20cfbe234281`; 종속 write lease `write-lease-f11-r1-20260924-001`, write token `f11-r1-write-fence-epoch-1-8396953c36a7c849`. 두 lease의 actor·F-11·exact6·기준 commit 일치, 확인 시 만료 전.
- 설계 SHA-256 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`, 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`, 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`, 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`, 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`, F-11 WI `634D34A1E500EDA5215A6496523355AC6064AA775B1C473A1424B32C7AE1CABB`.

## 판단 이유·변경 전후

변경 전에는 local `ollama` adapter/endpoint 구현이 없었다. 지정된 네 모듈과 테스트, 이 보고서만 새로 작성했다.

| 파일 | 변경 내용 |
|---|---|
| `packages/providers/ollama_endpoint.py` | 서버 환경별 exact scheme·host·port·IP allowlist, canonical URL/IP 검증, metadata/link-local/특수 주소 차단, 모든 DNS A/AAAA 결과 검증과 pinned IP 선택 |
| `packages/providers/ollama_adapter.py` | 매 요청 fresh resolve → pinned IP connect → 실제 peer 비교 → 동일 연결로 HTTP 송신. adapter가 경로 생성, redirect/proxy 금지 flag, native chat nonstream·NDJSON stream, final usage·abort·replay·probe·discovery. version/tags/ps 각 단계의 offline/unavailable 상태 분류. 공식 native NDJSON의 usage-only 최종 프레임과 빈 text message 최종 프레임 모두 지원 |
| `packages/providers/ollama_models.py` | detached wire 응답, receipt, stream·probe 결과 |
| `packages/providers/ollama_errors.py` | URL/endpoint/transport 원문을 숨기는 안정적 오류 코드와 credential material 차단 |
| `tests/providers/test_ollama_adapter_f11.py` | synthetic resolver/transport로 송신 전 peer, DNS/URL 우회, native wire, stream, usage, 상태 판정과 비노출 검증 |
| `docs/04_test_reports/F-11_COMPLETION_REPORT.md` | 이 결과와 미검증 범위 기록 |

OmniRoute 확인 기준은 local `ollama` registry가 없는 release/v3.8.51이며 cloud `ollama-cloud` 설정을 재사용하지 않았다. local canonical ID는 설계서의 `ollama`다. Ollama native wire의 근거는 [공식 API의 Chat request (With History) 최종 응답](https://github.com/ollama/ollama/blob/main/docs/api.md?plain=1)이다. 해당 final response는 `message` 없이 `done:true`·usage를 담는다. 다른 공식 예시의 빈 assistant message 최종 프레임도 허용하고, message가 있을 때 nonempty text/tool/nontext는 차단한다. endpoint 보안 경계는 [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)이다.

## 검증

| 명령 | 종료 | 실제 결과 |
|---|---:|---|
| `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers/test_ollama_adapter_f11.py` | 1 → 0 | RED: 모듈 없음, probe 단계 누락, 공식 usage-only final 누락 및 빈 tool/images 키 허용 재현 후 GREEN: 69 PASS (전체 관련 suite에도 포함) |
| `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget` | 0 | 699 PASS, 4 SKIP (격리 PostgreSQL 18 DSN 미구성) |
| `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -c "import ast,pathlib; names=('packages/providers/ollama_adapter.py','packages/providers/ollama_endpoint.py','packages/providers/ollama_models.py','packages/providers/ollama_errors.py','tests/providers/test_ollama_adapter_f11.py'); [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'),filename=p) for p in names]; print('AST_PASS',len(names))"` | 0 | `AST_PASS 5` |
| `git diff --check` | 0 | 추적 파일 diff 오류 없음. 신규 untracked exact6은 별도 trailing whitespace 검사에서 `[]` |

`py -m pytest`는 기본 Python 부재로 exit 1, root `.venv`는 pytest 미설치로 exit 1이었다. 위 기존 통합 검증 runtime으로 정상 실행했다. 테스트는 synthetic fixture만 사용하며 실제 외부 연결이 없다.

## 미검증·잔여 위험

- `NOT_EXECUTED`: 실제 Ollama, network/egress, WSL, DB, browser, 배포, credential. `/api/version`은 공식 저장소 API 문서와 fixture로만 검증했다. 브라우저 Network나 실제 socket 증거로 승격하지 않는다.
- 호스트 transport가 `connect`에서 socket만 열고 실제 peer 확인 전에 HTTP byte를 보내지 않으며 `request`가 같은 socket을 사용하고 redirect/proxy를 비활성화하는지는 이 단위 테스트만으로 증명되지 않는다. F-12 호스트 통합·실제 egress 검증이 필요하다.
- `NOT_INSTALLED`는 호스트가 명시적으로 `installation_status() == False`를 반환할 때만 판정한다. 네트워크 실패만으로 설치 부재를 추정하지 않는다. 스트림 `READY`도 같은 adapter에서 완료 final usage를 확인한 모델에 한정한다.
- 기존 Provider 파일·gateway/catalog/DB/public API는 변경하지 않았다. F-12 연결 전 local `ollama` UI 선택의 end-to-end 동작은 미검증이다.

## 다음 조치·rollback

Main Agent가 exact6 diff·기준선·독립 검증을 검토한다. 이후 F-12에서 호스트의 실제 socket/egress 계약과 same-origin UI 연동을 검증한다. Rollback은 아직 commit하지 않은 위 exact6 신규 파일만 소유자 확인 뒤 제거하는 것이다. 다른 dirty/untracked 자료는 건드리지 않는다. progress/HANDOFF는 작업지시 범위 밖으로 갱신하지 않았다.
