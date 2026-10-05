# F-20/U-01 R48 Critical Alert ACK 개발 결과

## 판정

`COMPLETED` — developer-primary의 exact18 로컬 구현·기본 검증 및 독립 검토 Important1의 harness 보완 범위 완료. WSL-server 격리 PostgreSQL 15/HTTPS 합성 IdP/Chromium 실측과 최종 R48 수락은 Main 검증 전이므로 **미검증**이다. F-20/U-01 전체 미수락, Release `DEFER`, Production 미실행을 유지한다.

## 판단 이유

- 시작 기준: branch `codex/f18-wsl-ops`, HEAD `71a6ba5a805880b96331dfb16b2677a96a9d2541`, local/private 동일·clean. 직전 기준 `bf2da1bb64fcbc3dffdb58e2e1a14ebcdd4dc3bf`의 후손인 통제 checkpoint. G-05 seq2100 PASS는 Main이 시작 전에 확인했다.
- 정본 binding: 계획 SHA-256 `A0AEC467AD0CEA8689697DF075158B9E5A1B82A8F8FED5DE30DB75CC244FEA58`, WorkInstruction `261DC4F85575BABE0FB56400386C8FEF0BFE5BC6F29BBA6ECCAA201AB4191456`, Invocation `6AB4B8C1887EA42B876F0E84B48B742182A509AE7DDD7D6BE12743468829E6F6`. 시작 전 canonical progress/HANDOFF의 epoch64 `ACTIVE` worker/write lease, actor·만료·exact18 scope 및 서로 다른 종속 fencing token을 확인했다. 이 문서에는 token 원문을 싣지 않는다.
- API는 ACK 1개 route와 정확한 `operations:alerts:acknowledge` permission만 추가했다. 기존 인증·Origin·CSRF·precondition·Idempotency-Key 경계 뒤에서 project/environment scope를 먼저 검증한다. 서버가 open Critical의 검출 sequence/evidence hash를 대조하고 principal actor·서버 발급 `ack:<opaque>` receipt를 실제 append-only 감사 Event에 남긴다. 재요청·경합은 409, scope 밖은 403, 범위 내 unknown은 404다. 기존 내부 idempotent `_transition` 소비자는 변경하지 않았다.
- UI는 메모리 CSRF 없이는 ACK를 차단하고 POST 성공 응답만으로 완료를 표시하지 않는다. 기존 scoped audit GET에서 ACK sequence·alert ID·receipt·evidence hash 일치를 확인해야 완료한다. 감사 조회 실패·미도달·불일치는 실패-폐쇄하고 POST를 자동 재전송하지 않는다.
- OIDC는 configured callback redirect를 같은 origin `/`로 바꾸고, 사용자 클릭 popup과 opener에 독립 보관한 browser_state·정확 origin·Window를 대조한다. popup 첫 실행에서 URL의 code/state를 지운 후 opener로 전달한다. state 불일치·popup 종료·중복/직접 진입·토큰 소실은 재인증 경계다. 기존 callback POST body/schema, 서버 PKCE·pending/session 계약과 공유/외부 IdP는 변경하지 않았다.
- 독립 검토 Important1 보완: R48 전용 WSL opt-in harness에 5개 분리 시나리오를 넣었다. 첫 redirect GET의 code/state 유입을 확인하되 현재 URL/history state/DOM/후속 Referer 잔여0과 `no-referrer`·`no-store` 헤더 및 합성 HTTPS 두 listener의 `access_log=False`를 검증한다. 실제 PG role permission을 순차 변경해 ACK 403과 audit GET 403을 확인한다. 같은 인증 세션으로 잘못된 CSRF·Origin 요청의 실제 HTTP 403을 확인한다. audit 페이지 미도달은 Chromium route에서 유효하나 대상 ACK가 없는 합성 audit 응답으로 주입해 UI 미확인·POST 재전송0을 검증한다. 이 마지막 항목은 실제 audit 서버 장애를 재현한 것이 아니라 UI 실패-폐쇄 검증이다. 정상 ACK는 마지막 별도 시나리오에서만 실행한다.
- TDD RED→GREEN: service 명령 부재, HTTP route 부재, OIDC root redirect/합성 allowlist, Web ACK·popup·재인증 절편의 선행 실패를 확인하고 최소 구현 후 GREEN을 확인했다. 같은 근본 원인의 유효한 정식 실패보고는 0회다. 저장소 루트에서 한 차례 `npm run test:console`을 잘못 호출해 `Missing script`(exit 1)가 났으며, `apps/web`에서 즉시 재실행해 PASS했다. 이는 제품·테스트 실패가 아니다.

### 로컬 검증 증거

| 명령/범위 | 종료 코드 | 결과 |
| --- | ---: | --- |
| `python -m pytest -p no:cacheprovider -q --tb=short tests/api/test_f13_operations_api.py tests/observability/test_f13_operations.py tests/api/test_registry_openapi.py tests/api/test_oidc_asgi_binding.py tests/api/test_oidc_runtime_factory.py tests/deploy/test_f18_oidc_qa_issuer.py tests/integration/test_f20_u01_r48_ack_pg15.py` | 0 | 112 passed, 3 skipped, 1 기존 `python_multipart` 경고. R48 PG 2건은 opt-in 격리 DB 부재로 skip. |
| `npm run test:console` (`apps/web`) | 0 | 86 passed, 0 failed. |
| `npm run typecheck` (`apps/web`) | 0 | PASS. |
| `npm run lint` (`apps/web`) | 0 | PASS. |
| `npm run build` (`apps/web`) | 0 | PASS. 생성된 `apps/web/dist/`의 현재 빌드 3파일을 확인 후 정확한 디렉터리만 정리. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | PASS. |
| `python -m pytest -p no:cacheprovider -q --tb=short tests/integration/test_f20_u01_r48_ack_pg15.py` | 0 | 2 skipped: WSL 격리 PG15 opt-in 미설정. 수집·구문만 확인했고 실측 PASS가 아니다. |
| `git diff --check` | 0 | PASS. |

변경은 exact18 중 제품·테스트 14파일과 신규 통합 테스트 1파일 및 본 결과 1파일에 한정된다. exact18의 `tests/api/test_oidc_runtime_factory.py`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`는 기존 계약이 유지되어 수정하지 않았다. Main 소유 `docs/WORK_STATUS.md`의 병행 변경은 건드리지 않았고 결과 diff·commit 대상이 아니다. `.pytest_cache` ACL 경고도 보존했다. 코드 diff는 이 branch의 `git diff` 및 신규 통합 테스트로 추적한다.

## 조치와 남은 검증

- Main은 정확한 Git SHA로 WSL-server에 pull해 격리 PG15 두 인스턴스 CAS 1승1충돌, 합성 HTTPS OIDC popup 실제 클릭/Network, R48 분리 5시나리오, scoped ACK/audit, 권한·CSRF/Origin·audit 페이지 실패 경계, 잔여 DB/프로세스/cert/browser/temp 0을 확인한다. 기존 R6~R47 read-only browser 절편은 별도 R48 모드로 분리했다. Important1 보완 harness는 WSL 미실행으로 RED→GREEN 실측 주장을 하지 않는다.
- 첫 redirect GET의 URL/Network에는 code/state가 URL 정리 전 일시적으로 보일 수 있다. 공유 proxy/access log 기록 여부, 실제 외부 IdP, ACK 단독 권한 UX, WSL 실제 브라우저와 Production은 미검증이다. 이를 PASS로 승격하지 않는다.
- 롤백은 Main이 R48 제품 diff만 제거하거나 R48 도입 전 검증된 `71a6ba5a805880b96331dfb16b2677a96a9d2541`로 해당 작업 branch를 되돌리는 방식으로 수행한다. Main 승인 없이 history rewrite·main 변경·운영 배포를 하지 않는다.
- developer-primary는 제품 commit/push, WSL/ysna/Production, canonical progress/HANDOFF/Event/WORK_STATUS 쓰기를 수행하지 않았다. 해당 기록·독립 검토·최종 판정은 Main 소유다.
