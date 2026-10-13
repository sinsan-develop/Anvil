# U-01 BLOCKED Run 카드 결과 / 2026-10-13

## 판정

BLOCKED Run 카드는 **구현 완료·핵심 동작 확인(격리 WSL-server)**이다. 실제 PostgreSQL 저장→요청별 조합 인가→제품 API→인증 브라우저에서 BLOCKED 건수·목록·관측시각을 확인했다. 정식 WSL 사용자 화면에 새 코드를 배포한 것은 아니다. 전체 U-01 NOT_ACCEPTED, Release DEFER, 기존 기본 R6 FAIL은 유지한다.

## 판단 이유와 기준

- 승인 설계 §29.2/작업계획 U-01, 부모 승인 SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39` 안의 기존 원본 읽기 연결이다. 새 API·DB schema·권한·운영 설정 변경0.
- WI SHA256 `7E99A57F74BEB20EF6C4CF4E0B315567DD21CF680A3CD87A551389FC0D55163E`, Invocation `DD1320746B0A0ACF67D7FA5864B669525A4F2C1A89F724EC0D251154612EE0A0`.
- W14 `592d9fd6`→검증목록 비의미 revision `79a1c0b3`→A13 `ebedb20287a8a7824e751b062dcf749d2ae6c548`→C13 `9215621bf6eedfb02132b3f11c2198981791e548`→B13 `38870888a200dfefe8d26c63f2ba88d6789e19fb`→H13 `c57935a17dfb7f7e8a715f3af0c3d82b975b3c35`는 기존 `codex/u01-dashboard-r2`의 직계 checkpoint다. C13 exact7코드·B13 exact4문서·H13 exact5통제문서, 각 게시본 실제 G-05 seq2397/2397/2399 PASS. H13 epoch122 seq2398 write→2399 worker REVOKED·active lease/agent0.
- 시작 당시 A13 local/private 동일·tracked clean, 단일 Developer의 유효 dual lease/허용7·제품2. 독립 코드 재검토와 B13/H13 검토는 C0/I0/M0이다. Main 제품 코드 수정0·Developer 정식 FAILURE_REPORT0.

## 변경과 실제 동작

제품은 `packages/api/scoped_dashboard.py`, `apps/web/src/console/App.tsx` 정확2다. 기존 완전한 exact-pair `ScopedRunSource`의 상태·ID·phase·관측시각과 current.run을 대조해 기존 `current.blocked` 건수를 연결하고 화면에 BLOCKED Run 건수·목록·원본·시각을 표시한다. 결손·중복·불일치·미확인 원본은 UNAVAILABLE이다. 전체 Run count와 다른 카드·기간 발생 의미는 바꾸지 않았다.

시험3은 reader/API/Web 시험, 통제2는 checker/control 시험이다. C13 diff 904행 추가·2행 삭제, `git diff --check` exit0. 전체 변경은 C13의 A13 대비 Git diff로 복원 가능하다. 범위 밖 dirty/untracked 복구·reset/history rewrite를 수행하지 않았다.

## 실시한 최소 검증

| 실행 | exit 및 실제 결과 |
|---|---|
| `python -B -m pytest -q -s -p no:cacheprovider tests/api/test_u01_scoped_dashboard_reader.py -k blocked_run` | 최초 RED exit1(1FAIL/1PASS)→GREEN exit0(2PASS) |
| `node --import tsx --test --test-name-pattern='scoped BLOCKED Run' tests/f15-console.test.mjs` (apps/web) | 카드 부재·reason 충돌 음성 RED exit1→GREEN exit0 |
| `python -B -m pytest -q -s -p no:cacheprovider tests/tooling/test_u01_postmerge_control_projection.py -k U01DashboardBlockedRunEpoch122Tests` | RED exit1→GREEN exit0, 최종7PASS |
| reader 파일 집중 실행 | exit0, 19PASS |
| `npm run web:test` / `web:typecheck` / `web:lint` / `web:build` | 각 exit0, Web105PASS |
| API `--collect-only ... -k blocked_run` (Windows) | exit0 신규1건 수집. 실제 실행 PASS 아님 |
| epoch121 인접2건 | exit1: frozen B/H 1PASS, live A13 bundle에 epoch121 양성을 기대한 기존 fixture 1FAIL. 기준/fixture 변경0 |
| Main 기존/새 reader를 각각 `create_app(scoped_dashboard_reader=...).openapi()['paths']`로 비교 | exit0, paths101 동일 |
| WSL 전용 venv `python -B -m pytest -q -p no:cacheprovider tests/api/test_u01_scoped_dashboard_api.py -k blocked_run` | exit0 신규 API1PASS, 정확 pair 거부/철회 후 source 호출 금지 |
| UTF-8 stdin으로 `.codex_qa/blocked-run-9215621b.py`를 `ssh WSL-server 'python3 -'`에 전달 | exit0, exact C13 Git/G05·Web build·migration0020·저장3Run·실제인증API/UI·권한철회 PASS marker |
| exact identity cleanup helper와 별도 잔여 조회 | 각 exit0, 등록 root1·containers3·ports3 잔여0, 기존 formal 서비스 이미지/실행 상태 보존 |

Windows TestClient 기존 정체는 같은 환경에서 다시 반복하지 않고 Linux 신규 API1을 실행했다. 기존 `.pytest_cache` ACL 경고와 Python launcher 경고는 보존했다. 최초 부재 조회 quoting SyntaxError exit1은 자원 생성 전 환경 오류이며, helper 내부 이름/소유자/이미지/포트 부재를 재확인한 뒤 생성했다. QA 7d UI 단언 Important1은 제품 시험 기준을 낮춘 것이 아니라 실제 화면의 7d·새 응답 관측시각을 추가로 확인하도록 보정했고 독립 재검토 C0/I0/M0이다.

## WSL 실측·자원

사전등록 root `/tmp/anvil-u01-blocked-run-9215621b`(daon/0700), secret0600, PG `anvil-u01-blocked-run-pg-9215621b`(tmpfs256MiB/mount0/AutoRemove/loopback5545), Node/Chromium 일회성 컨테이너, 합성 OIDC와 제품 HTTPS loopback8444/8445만 사용했다. PG15 image `40710ae2...`, Node24 `e8c4de1e...`, Playwright1.62.1 `fee853fa...`를 생성 전 확인했다. 비관리자 전용 DB/role·새빈DB에서 actual0020 migration, 정상 Task/Run repository로 합성 ACTIVE/WAITING_APPROVAL/BLOCKED 3행을 저장했다. 합성 QA 행을 실제 사용자 데이터·운영 승인으로 승격하지 않는다.

실제 제품 ASGI에 등록한 exact pair/권한과 OIDC PKCE·nonce·HTTPS Chromium을 사용했다. API current.run=3/BLOCKED=1·목록ID, 화면 건수/목록/원본/관측시각/pair, 7d 서버 기간 및 새 관측시각 화면 교체, 다른 pair403, grant철회403·카드/이전RunID 제거를 확인했다. `/api/`와 `/auth/`의 same-origin, cookie Secure/HttpOnly, DOM의 DSN·해당 session 값 미노출을 확인했다. 이 범위를 모든 URL·모든 Secret 전수 보안 PASS로 확대하지 않는다.

종료 시 PG ID `b8000a624115efb9590a09f65f56a42ac110984648301db2a056bb1d20683d0b`, Chromium ID `8897a72f403a93f4bbc2e3e287d30ac7acf36f8d8b558de459ab65cc8094b664`와 label/image/port/mount/AutoRemove, 경로 owner/realpath/link/process를 확인해 해당 자원만 정리했다. 독립 조회로 root/3이름/5545·8444·8445 잔여0 및 기존 anvil-web image `c0254177...`·running 보존을 확인했다. secret/DSN 값 출력0.

## 조치·미확인·다음

진짜 DB 원본 없는 다른 Health5·Gate/cost/baseline/승인 객체는 미구현/미확인으로 유지한다. 기존 R6 실패와 E-NET/E-API/E-AUD/E-SHOT 및 필수 AV 인수는 미충족이며 이번 국소 PASS로 대체하지 않는다. 정식 WSL 화면은 이전 revision/0013이라 사용자가 이번 카드를 직접 확인할 배포 URL은 아직 없다. persistent DB migration/인증 설정 변경은 이 WI 제외다.

이번 카드의 안전 checkpoint와 progress/HANDOFF·임대 회수를 남겼다. rollback이 필요하면 C13 제품 diff를 승인된 후속 WI에서 역변경하고 동일 핵심 검증을 수행한다. PR/main/새 branch/Oracle/ysna/Production/예약 변경0. 다음은 같은 기존 Run 원본에서 ACTIVE만 구분하는 실행 중 카드의 미완성 UI를 구현한다.
