# U-01 Dashboard 화면 로그아웃 결과 / 2026-10-14

## 판정

**UI 로그아웃 구현 완료·핵심 동작 확인(정식 WSL)**. 전체 U-01은 NOT_ACCEPTED, Release는 DEFER다.

사용 주소 `https://172.27.253.53:3770/`. `재인증` 후 조합을 조회하고 `로그아웃`을 누르면 현재 세션과 화면의 이전 카드 정보가 제거된다. 새로고침 뒤에는 메모리 CSRF가 없으므로 안내에 따라 재인증한 다음 로그아웃을 다시 누른다. 무CSRF 요청·브라우저 storage 저장·새 인증 API는 추가하지 않았다.

## 기준·변경

- Package U-01, WI `U-01_DASHBOARD_LOGOUT_WORK_INSTRUCTION.md` SHA256 `473CB1C9EA8600D9E7F784B280D2FAF817EBCED95215CE6E2B150AEFF9AA07A1`, Invocation SHA256 `0ADD6C5A8A52550523B85BE72B4D65487A485B19763086FE8DB3AF990958E9A8`.
- 신산님의 직전 UI 로그아웃 제안에 대한 `계속하자`, 기존 scoped 승인 `60167FF6…`와 WSL 개발 실행 승인 `171D1524…` 범위다. 새 인증 정책·권한·DB 계약 승인이 아니다.
- 시작 branch `codex/u01-dashboard-r2`, local/private HEAD `1be966cb83c7e85f0e74e73c1e098106c41c4f6c`, tracked clean·seq2409·lease0. 결과는 branch-only이며 main 통합·Release·전체 기능 완료가 아니다.
- W17 `34d805a5`→manifest 계약 명시 `713ce91e`→A16 `5c0c33d7`→C16 `d31d1225c297758fe702cedad6760c6748074d92`→M16 `a1b4ccc85e90d0b1b0432bfd3174f993b82c4723`→B16 `a2e5647340665cefbb071ce2a84a4b23e64ae2c9`→H16 `44bdf98633b1329b9818f8f0de96f2824d3b1bd8`.
- 단일 Primary 변경 exact4: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`. diff `git diff --stat 5c0c33d7 d31d1225`=928추가/18삭제. Main 동일 source write0, API·DB·issuer·migration·lock·CSS 변경0.
- M16 실제 manifest blob SHA256 `0EFC53C926CB10FC714490FFCD14CB12B2ED82F6762D29EE8E4295DFCDEEC61B`, 혼합 Web C16/API·issuer C15 source와 기존 M15/retained4 hash를 결박했다. 독립 spec/quality·각 문서 최종 C0/I0/M0.

## 검증·증거

| 실행 | 실제 결과 |
|---|---|
| `node --import tsx --test --test-name-pattern=logout tests/f15-console.test.mjs` (apps/web) | 최초 RED9F→최종12P. Main fresh12P/0F/0S·358.8153ms |
| `npm run web:test` / `web:typecheck` / `web:lint` / `web:build` | exit0, web118P/0F/0S·686.27ms, 타입·린트·빌드 PASS |
| `python -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_u01_postmerge_control_projection.py::U01DashboardLogoutEpoch125Tests tests/tooling/test_u01_postmerge_control_projection.py::U01WslDevelopmentEpoch124Tests --tb=short` | 신규·인접 최종14P/0F/0S·88.98s; 새 기능 부재/위조 RED 후 GREEN |
| `git diff --check`, Python checker/test compile | exit0; 기존 checker 본문 바이트 보존 확인 |
| WSL Git exact C16 restricted archive→기존 pinned Dockerfile `docker build --target web --build-arg ANVIL_RELEASE_COMMIT=C16 -f deploy/wsl/Dockerfile.f18 -t anvil-u01-logout-web:d31d1225 -` | 최종 exit0, Web typecheck/build20, archive563200bytes/SHA2569B992387…; Windows 제품 source 복사0 |
| M16 Git exact checkout→Web 전용 교체→strict private CA HTTPS ready | 최종 exit0, migration0020, API/issuer exact ID·보호파일 hash·망 설정 불변 |
| 실제 Playwright1.62.1/Chromium151.0.7922.34/1920×1080 | 재인증/카드조회→UI logout→cookie없음/sessionfalse/API401/이전정보제거→reload→재로그인/조회 PASS |
| reload CSRF 부재·실패 표시 | 무CSRF POST0/재인증 안내. client가 가로챈403은 종료 확인 불가·서버 세션true로 구분한 뒤 실제 재인증/UI logout 확인 |
| 선택 보안·정리 | same-origin·Secure/HttpOnly/Strict·DOM credential 비노출, auth/선택기능 body25 서버 비밀 CLEAR, 일회성 browser/configcheck 부재. 별도 최종 읽기 조회 exit0 |
| 게시본 `python -B scripts/check_project_progress.py .` | C16/M16/B16 seq2412 PASS, H16 seq2414 PASS; 각 당시 clean/private exact SHA 한정 |

로컬 Python은 `C:/Users/cyhuh/anaconda3/python.exe`다. 서버의 등록된 Main 운영 프로그램은 `ssh -o BatchMode=yes WSL-server sudo -n python3 -`와 정확 source/manifest 인자로 실행했다. 비밀/DSN/인증 body 원문을 Git·로그에 넣지 않고 보호 proof에 요약했다. 전체 Python/R6/다중기기·부하 검사는 이번 변경에 반복하지 않았다.

## 실패와 한계

- 인접 역사 fixture 최초12P/2F: `test_c15_m15_git_direct_children_and_source_hash_binding`, `test_public_route_preserves_all_canonical_controls_and_rejects_tamper`가 현재 A16을 읽었다. 입력만 A15 Git 원문·hash로 고정, 기대값·위조/만료 음성은 유지했다. exact2 재실행2P 후 최종14P이며 최초 실패를 지우지 않는다.
- 첫 Web 빌드는 legacy builder가 선행 python-deps COPY도 처리하여 제한 archive의 기존 requirements 파일 누락으로 exit1. Web typecheck/build20은 먼저 통과했다. 동일 Git 파일을 포함해 성공했고 buildx/패키지/제품 source 변경0.
- Git fetch 완료 전 조기 교체 preflight는 HEAD 불일치로 mutation 전에 exit1. fetch 완료를 확인한 뒤에만 교체했다.
- 첫 실제 Web 교체는 env 배열 순서 대조 실패로 중단, 새 exact ID만 제거하고 기존5d6a1f82/name/두 IP/alias·running을 복구·독립 확인했다. 진단에서 entrypoint/cmd exact true, env 순서false/전체 고유 키값true를 확인했다. raw 차이는 FAIL로 보존하고 중복키 거부·전체 키값 exact 및 bind/명령/파일·서비스·망 검증을 유지한 attempt02로 성공했다. 첫 private 자료를 덮어쓰지 않았다.
- Main 운영 도구의 timeout/복구 누락 위험은 서버 실행 전에8반례로 보강·독립 C0/I0/M0. 생성 프로그램의 로컬 UTF8 오류, Primary 내부 lint/fixture/인용 오류는 최종 보완과 구분하며 정식 Developer FAILURE_REPORT0.
- 새로고침 뒤 한 번에 종료하는 CSRF 회수 계약은 없다. 재인증 필요 안내가 있는 상태로 사용 가능하며 이 제약을 숨기지 않는다. 403은 client 반례이고 서버 보안 정책 변경을 증명하지 않는다. 기존 실제 CSRF 거부 증거는 C15에 한정해 유지한다.
- 선택 auth/기능 body 검증은 전체 background/R6 감사가 아니다. 과거 R6 FAIL, 외부 SSO/Provider·PG18/Oracle/Production·전체 U01 필수 인수 ID 미충족은 유지한다. 나머지 health5/Gate/cost/baseline/approval 객체는 여전히 미구현·부분 구현이며 정밀 테스트 이월로 숨기지 않는다.

## 운영·정리·조치

새 Web `c9f677874802c61a2d5fc74de1f17b9e11cd3489f04d37badb25fffe33b1bac4`/image `sha256:6be9d1a751bfa45a40f7e47c44402eb061923304be75c35f44fb002e199cfb4e`, API `3c52b542…`/issuer `e2667673…` 기존 ID 유지, repo M16 detached/clean. 보호 파일·인증서·DB schema0020·망 설정은 불변이다. 로그인/로그아웃에 필요한 정상 세션 생성·폐기와 DB 전체 불변 주장은 구분한다.

기존 Web5d6a1f82는 `anvil-u01-logout-rollback-20261014`로 정지·망 연결 해제 보존, 원래 f0107aad rollback도 정지 보존한다. Compose가 renamed old를 제거하지 않도록 Web만 동일 profile 제약의 exact-ID Docker create를 사용했다. 기존 compose.env로 전체 compose up하지 않으며 후속 갱신은 최신 manifest/현재 Web ID를 대조한다. 실패 복구는 새 정확 Web만 회수→old 이름/두 망의 원 IP·alias 연결→start다. API/DB를 재생성하거나 무조건 restore하지 않는다.

실행·복구·비교·브라우저 proof는 `/srv/anvil-wsl/runtime/u01-development-20261014` root0700/파일0600에 보존한다. 일회성 browser/configcheck·로컬 dist 잔여0이며 정식3서비스/복구 image·정지 rollback/기존 암호화 backup은 목적 있게 유지한다. H16 seq2413 write→2414 worker REVOKED·active0, progress/HANDOFF/개발환경 안내를 갱신했다. PR/main·새 branch·예약·공개/운영 전환0. 다음은 남은 실제 연결 기능 구현이며 전체 프로젝트 완료보고가 아니다.
