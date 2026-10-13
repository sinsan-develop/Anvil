# U-01 WSL 개발 화면 반영 실행계획 / 2026-10-14

> 구현은 단일 기존 Primary Developer, 배포·DB·Secret·실측은 Main이 수행한다. 기존 실행 방식을 유지하고 별도 반복 승인/새 세션을 요구하지 않는다.

**목표:** 실제 Anvil 개발 DB를 보존하면서 검증된 DB/BLOCKED/실행 중 카드를 정식 WSL HTTPS 화면에서 테스트 로그인으로 사용하게 한다.
**근거:** 설계 §29.2/작업계획 U-01·WSL Stage1 및 `APPROVAL-20261014-U01-WSL-DEVELOPMENT-RUNTIME-001.md`의 직접 실행 승인. 기존 R6/전체 U-01/Release 인수를 승인한 것은 아니다.
**접근:** 기존 F18 Web/API/QA issuer 역할을 재사용하는 개발 한정 profile. 공개 서비스 포트3770·같은 origin `/api/`, `/auth/`, `/realms/anvil/`. 제품 API·UI·DB migration source는 그대로다.

## 확인된 기준선과 한계

local/private HEAD `4b75c87f395ded6e48b0074b1d8c21f364061730`, clean·G05seq2404PASS·activelease0. WSL 정식 repo `/srv/anvil-wsl/repo` root-owned·clean·HEAD `a681e0c0a97bdb67956a0a50aa208bd38982a545`; 실제 anvil-web ID `f0107aad...`·image `c0254177...`·label bb2ff437는 repo HEAD와 다르므로 두 값을 혼동하지 않는다. `/opt/venv/bin/python` 직접 SQL로 `anvil`/PG15.18/0013/50tables를 확인했다. 앞선 `python` 명령 실패를 DB 오류로 승격하지 않는다. 기존 http172.27.253.53:3770/WSL_ACCEPTANCE·proxy-network·mount0와 `.env`를 보존한다. 이번 새 HTTPS IP는 실행 직전 현재 private IP와 일치해야 한다.

## 정확 source 허용8 / 제품 API·UI 변경0

1. 신규 `deploy/wsl/compose.u01-development.yml`: existing3770의 Web HTTPS, API 내부3770, issuer 내부8302. 기존 API entrypoint(8301)를 배열로 명시 override하여3770/--no-access-log로 실행한다. API/Web의 필요한 기존 proxy-network 접근과 Anvil 소유 internal망을 구분, 다른 네트워크 설정 변경0. readonly/cap_drop ALL/no-new-privileges·개별 secret RO mount·접근 로그 민감값 배제. nginx 신규 설정 RO mount 및 Web UID101/API·issuer UID10001의 개별 파일 읽기 권한을 rendered config에서 확인한다. 새 PG 서비스/기존DB삭제 금지. image refs는 Main이 검사한 exact image IDs로만 받는다. API에는 정확 trusted Web IP, OIDC/0020/F15 shell을 설정한다.
2. 신규 `deploy/wsl/nginx-u01-development.conf`: TLS1.2/1.3·3770, 기존 dist, API/auth/realm 상대경로 proxy·Host/ForwardedProto, auth code/query/cookie 로그 출력0. 정상·401·upstream 실패에서도 query가 error log에 남지 않도록 access/error 로그 정책과 반례를 확인한다. fixture routes404·CSP/same-origin 유지. API upstream anvil-u01-api:3770, issuer anvil-u01-issuer:8302. TLS source 외부 private 파일, cert/key를 source에 담지 않는다.
3. `deploy/wsl/oidc_qa_issuer.py`: `create_qa_issuer(...,issuer_url=ISSUER,redirect_uri=REDIRECT_URI,token_ttl_seconds=60,wsl_development_only=False)`의 선택적 개발 설정만 추가. 기본 기존 QA 계약/TTL/subject allowlist 보존. custom private HTTPS3770 URL/900초 token은 `ANVIL_U01_WSL_TEST_LOGIN=1` 및 WSL_SERVER_TEST_STAGING에서만, URI userinfo/query/fragment/외부·Production host/잘못된 port·type/TTL 거부. request로 임의 subject/role을 받지 않고 기존 f19a-qa-reader만 사용. entrypoint 환경 설정 소비, access_log=False. 실제 외부 SSO/실제 인간 인증이라고 하지 않는다.
4. 신규 `deploy/wsl/U01DevelopmentReleaseManifest.template.json`: WSL_DEVELOPMENT_ONLY·NOT_RELEASE/NOT_ACCEPTED, source exactSHA/approved path/hash/image digest/migration13→20·backup/rollback tuple·private3770/읽기 QA principal·자료 owner·배포 승인과 미검증의 resolve 계약. 실제 manifest는 Main이 secret 없이 채워 별도 Git M15에 결박한다. unresolved template이나 Production manifest로 실행 금지.
5. 신규 `tests/deploy/test_u01_wsl_development_contract.py`: profile/rendered config/manifest의 wrong host/port/type/image/WSL mode/secret literal/privileged scope/Production 반례. 개발900초 TTL mode의 URI/TTL 악성 입력도 실제 issuer 요청 경계로 확인한다.
6. `tests/deploy/test_f18_oidc_qa_issuer.py`: 기본 QA 호환성과 custom private3770→redirect/token issuer/pinned key/PKCE·nonce·one-use/code expiry, 범위 외 설정 거부 RED→GREEN.
7~8. `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`: 아래 W16→A15→C15→M15→B15→H15/report fail-closed successor. 기존 gates·검사·역사 실패 완화0.

## 실행할 작업

- [ ] Main W16 승인기록/WI/Invocation/DEVELOPMENT_ENVIRONMENT/WORK_STATUS 정확5 게시. A15 W16직접자식통제5·Event2404까지원문보존→2405WI→2406epoch124worker→2407write ACTIVE/24시간분리token·허용8/제품 APIUI0. 독립 확인/private뒤 Primary TDD.
- [ ] Primary의 신규 contract/issuer RED→GREEN·기본 issuer 인접시험·신규 통제class/위조음성·문법/config 검사. 공개 제품 route/UI/API/source/migration hash 불변 확인. Windows TestClient 정체면 Linux 국소시험으로 구분. 전체R6/전수suite/부하/다중기기 반복0. C15는 A15 직접자식 허용최대8코드·독립C/I0·privatecleanactualG05seq2407PASS.
- [ ] Main 정식repo를 clean/realpath/owner·기존 credential 그대로 Git fetch/exactC15 detached로갱신. build는 restricted `git archive` source만 WSL에서 생성해 기존 pinned Dockerfile.f18의 web/api와 OIDC issuer 역할에 사용한다. source·revision·image IDs를 확인하며 이 시점에는 아직 actual M15를 게시하지 않는다. 실제 소스는C15, manifest는후속M15 Git blob/hash이며 Windows source copy/서버 source patch0.
- [ ] 기존 image/config/.env 복구 수단·DB 소유권/크기/알려진 writer만 확인. 해당 anvil-web만 정지·보존. `/srv/anvil-wsl/backups/u01-development-20261014-4b75c87f` ownerroot0700/파일0600에 암호화 dump+key+원본config 보호(값/Git/로그출력0). 별도 one-usePG15 복원 직후 원본 schema/data fingerprint 동일을 확인한다. 복원본 migration0020 뒤에는 기존50테이블의 migration 전 존재한 컬럼 값·행수·키 보존을 비교하고 승인된 추가 schema를 별도 확인한다(신규 default 컬럼을 이전 row hash에 섞지 않는다). 실패는 원 DB 변경0/기존 서비스 재시작. restore/cert/source/image 자원 생성 전 identity·수명·정리를 다시 기록한다. 실제 backup/hash/복원·migration보존 결과와 old image/config rollback tuple 확정 뒤에만 M15(actual manifest+WORK_STATUS 정확2)를 C15직접자식으로게시/G05seq2407PASS. 예정 경로/미확인 증거를 actual로 채우지 않는다. 원 DB migration/새 서비스 전환은 M15 검증 뒤다.
- [ ] 복원·보존 성공/M15 검증 때만 동일 C15 migration을 기존 anvil DB에 적용. 기존데이터를 새 값으로 backfill/삭제하지 않는다. 정상 F19 repository와 Main 트랜잭션으로 새 고정 QA조합 `anvil-wsl-development / wsl-development`와 `anvil-wsl-development-reader`의 dashboard:read만 멱등 등록한다. 기존행을 정확 확인하고 충돌을 거부한다. QA 전용 DB/8444에 한정된 f19a_qa_bootstrap.py를 정식 anvil/3770에 직접 실행하지 않는다. bootstrap 관리 actor는 OIDC subject binding을 주지 않는다. 기존 프로젝트 전부 접근·비용·관리/배포 권한0.
- [ ] `/srv/anvil-wsl/runtime/u01-development-20261014`의 private env/cert/signing/client-secret/trust를 생성(값문서/Git출력0), 기존 `.env`무변경. 30일 개발 self-signed cert/privateIP SAN·pinned JWKS·same-origin URI, 단일 시험 subject로 local 테스트 SSO. Windows 전역 CA/SSH/Git설정 변경0. 기존 anvil-web은정확ID로보존/rename된rollback container로남기고 새 anvil-web/Anvil API/issuer만 전환한다. source IDs/manifest/3770/TLS·ready0020·UI·실제popup 로그인→pair/DB/Run·refresh·logout·otherpair403·비밀/내부API URL유출을국소확인. 전체E2E·외부SSO·Worker실행을PASS로확대0.
- [ ] 실패 시 새Anvil서비스만정지, 원본 image/config와 필요 시 검증된 DB백업으로 복구한다. 새사용자데이터가 생긴 경우 무조건 restore하지 않고 보존·판단한다. 성공 시 일회성 restorePG/migration/build검증잔여0, 정식3서비스/자료와 암호화 backup/oldrollback은목적·수명·재개조건을기록해보존. B15(actualQA/DEVELOPMENT_ENVIRONMENT 포함정확5)→H15lease회수통제5→첫결과보고2/각G05, 사용자URL·테스트SSO/인증서경고·확인법 제공.

## 통제 literal

binding `u01_wsl_development_runtime_binding`, actor `developer-primary-u01-wsl-development-runtime`, subject `U-01/WSL-DEVELOPMENT-RUNTIME`. A15 mode/status `U01_WSL_DEVELOPMENT_RUNTIME_ACTIVE`, action `U01_WSL_DEVELOPMENT_RUNTIME_IMPLEMENTATION_ONLY`, snapshot `snapshot-u01-wsl-development-a15-seq2407`, predecessor=W16/seq2404, new/root approval=this direct approval, previous result=4b75c87f. M15 신규 `deploy/wsl/U01DevelopmentReleaseManifest.json`+WORK_STATUS 정확2·Event/projection 불변; source=C15이며 M15 manifest hash/actual private image tuple 검사. B15 M15직접자식 progress/HANDOFF/detached digest/WORK_STATUS/DEVELOPMENT_ENVIRONMENT 정확5·Event2407불변·C15/M15 binding·active_projection_checkpoint null, action `U01_WSL_DEVELOPMENT_RUNTIME_CLOSE_READY`, snapshot `snapshot-u01-wsl-development-b15-seq2407`.

H15 B15직접자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5, seq2408 WRITE_LEASE_REVOKED `evt_u01_2408_wsl_development_write_lease_revoked`→2409 WORKER_LEASE_REVOKED `evt_u01_2409_wsl_development_worker_lease_revoked`; step `U01_WSL_DEVELOPMENT_RUNTIME_CLOSE`, same subject, completed keys `completed_u01_wsl_development_runtime_{write,worker}_lease`, active0,status/mode `U01_WSL_DEVELOPMENT_RUNTIME_CLOSED`, action `U01_WSL_DEVELOPMENT_RUNTIME_RECORDED_U01_PENDING`, snapshot `snapshot-u01-wsl-development-h15-seq2409`, onlyH active_projection_checkpoint=B15. firstreport 신규 `docs/04_test_reports/U-01_WSL_DEVELOPMENT_RUNTIME_RESULT.md`+WORK_STATUS 정확2.

## 제외와 검토 초점

기존 baseline/UI/API/migration 변경·임의 backfill·Provider/Telegram/운영/Oracle/공개·다른 프로젝트·main/PR/새branch·SSH/key/Windowsglobaltrust·예약 변경0. 중요한 반례: backup 복원실패/기존데이터불일치, 기존writer·port/owner/link 불일치, 역할범위확대/토큰·query로그, source/image/manifest불일치, TLS/proxy/origin/nonce 오류. 각 반례는 원본 mutation 전 중단 또는 기존상태 복구하며 임시PASS·F20/Release 수락으로 숨기지 않는다.
