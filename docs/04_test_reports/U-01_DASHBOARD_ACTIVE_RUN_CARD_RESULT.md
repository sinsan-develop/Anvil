# U-01 실행 중 Run 카드 결과 / 2026-10-13

## 판정 → 판단 이유

**구현 완료·핵심 동작 확인(격리 WSL-server)**. 실제 PG15에 저장된 같은 조합의 Run 상태를 제품 API가 읽고, 인증 화면에서 ACTIVE만 건수·ID·phase·원본·시각으로 표시한다. Run 프로세스 실행 엔진, 전체 U-01 인수, 정식 사용자 화면 배포를 검증한 것은 아니다. U-01 NOT_ACCEPTED·Release DEFER·기존 R6 FAIL 유지.

설계 §29.2/작업계획 U-01과 부모 승인 SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39` 안의 기존 완전 원본 UI 읽기 연결이다. WI `90AB26200FD9881B4873316440F44B5316053DD6B85F621CC62136448F9450D3`, Invocation `F7B70C2D9494BC3D4971B1DF0D3BD6596D616C07C12D57F25BCA3124629AA456`. 공개 API·DB·권한·기존 전체 Run count 변경0.

W15 `0ad3e1b31a2e061faa17451f6d7da34f9bcc40f6`→A14 `5e1471ce2885640b30be7f190d50d0ede7a5435d`→C14 `6c71f45c5573fae3fa8ba65fcb5dd84065a5c266`→B14 `7f51aabb96922207bb2a417d86a7f95ac9bda2bf`→H14 `86481032ba9c81967bd33443a582c04f75ee8f80`는 기존 `codex/u01-dashboard-r2`의 직계 이력이다. C14 exact4 코드·B14 exact4 문서·H14 exact5 통제, local/private clean 실제 G-05 각 seq2402/2402/2404 PASS. H14는 Event1~2402 원문 보존 후2403 write→2404 worker 회수, epoch123 두 lease REVOKED·active0이다. 독립 코드/B/H 검토 C0/I0/M0, 단일 Primary 정식 실패보고0·Main 제품 코드 수정0.

## 실제 변경·검증

- 제품 `apps/web/src/console/App.tsx` +27행: 같은 current.run의 전체 count/items·고유 ID·알려진 status/phase·reason:null·exact-pair 완전성·동일 관측시각/서버 snapshot 5초를 확인하고 ACTIVE만 새 `실행 중 Run` 카드로 표시한다. 불명·결손·위조·불일치면 UNAVAILABLE이며 확인된 빈 ACTIVE 집합만0. 기존 전체 Run/BLOCKED/Database 유지. 파생 값은 기존 응답에서 렌더링 중 계산하며 새 cache/effect/dependency·구조 개편0.
- Web 시험1·통제 검사기/시험2만 추가했다. 합계4파일 C14 diff745행 추가, diff check0. 기준 A14 시작 local/private동일·trackedclean과 유효 epoch123 dual lease/허용4·제품1을 확인했다.

| 정확 실행 범위 | 실제 결과 |
|---|---|
| apps/web에서 `node --import tsx --test --test-name-pattern='scoped active Run displays' tests/f15-console.test.mjs` | RED exit1 카드 부재→GREEN exit0 |
| 신규/기존 BLOCKED/Database Web 집중 target | exit0, 3PASS |
| `python -B -m pytest -q -s -p no:cacheprovider tests/tooling/test_u01_postmerge_control_projection.py -k U01DashboardActiveRunEpoch123Tests` | RED exit1 validator 없음→GREEN exit0, 7PASS/193 deselected |
| 인접 `-k 'U01DashboardBlockedRunEpoch122Tests and not a13 and not c13_requires'` | exit0, 4PASS |
| 더 넓은 epoch122 5건 | exit1, 4PASS/1FAIL: 기존 synthetic C13 collector의 live A14 disk bytes 의존. 역사 검사/fixture 완화0 |
| `npm run web:typecheck`, `npm run web:lint`, `npm run web:build`, `git diff --check` | 각 exit0, 생성한 dist3파일 exact 정리·잔여0 |
| UTF-8 stdin QA helper를 `ssh WSL-server 'python3 -'`에서 실행 | exit0, exact C14/G05seq2402·Web build·실제0020·PG 저장→인증API/UI·상태 변경·철회 PASS marker |
| exact cleanup 및 별도 독립 잔여 조회 | 각 exit0, 등록 root1·container3·ports5545/8444/8445 잔여0·기존 formal 서비스 보존 |

같은 코드의 로컬 검사를 Main이 다시 전수 반복하지 않고 실제 WSL 국소 흐름을 독립 확인했다. backend/API/migrations가 C13에서 바뀌지 않아 전체 API/DB suite도 반복하지 않았다. 전체 suite/R6·다중기기/부하/복구 시험 미실행을 PASS로 표시하지 않는다.

## WSL 증거와 자원

생성 전 WORK_STATUS/commentary에 `/tmp/anvil-u01-active-run-6c71f45c`(daon0700·secret0600), `anvil-u01-active-run-{pg,node,chromium}-6c71f45c`, cached PG15 `40710ae2...`/Node24 `e8c4de1e...`/Playwright1.62.1 `fee853fa...`, 수명·정리를 등록했다. 이름/경로 부재·owner/link·image·포트 영향0을 재확인했다. PG AutoRemove/tmpfs256MiB/mount0/loopback5545·전용 비관리자 role/DB, OIDC/제품 HTTPS loopback8444/8445만 사용했다.

새빈 DB의 actual0020와 정상 Task/Run repository로 합성 혼합3행을 저장한 뒤 fixture 상태를 ACTIVE/WAITING_APPROVAL/BLOCKED로 설정했다. 실제 제품 ASGI/OIDC PKCE·nonce/HTTPS Chromium에서 API 전체Run3 대비 화면 ACTIVE1의 정확ID/IMPLEMENTING·원본/시각/pair, 7d 서버 기간과 새 관측시각의 화면 반영을 확인했다. 격리 fixture의 ACTIVE→BLOCKED·version증가 후 **새 인증 context 조회**에서 ACTIVE0·BLOCKED2를 확인했다. 같은 페이지의 live 실행 상태 전이·Worker 동작 또는 승인 객체를 검증했다고 하지 않는다. 다른pair403, grant철회403·이전 목록/ID 제거도 확인했다.

`/api/`·`/auth/` same-origin, cookie Secure/HttpOnly, DOM DSN/session 값 미노출만 확인했다. 실제 외부 OIDC/Provider와 전체 Secret·Network 전수 인수는 미검증이다. QA orchestration/정리 helper 독립 C0/I0/M0; PG ID `47c01779fb3b2df4d482b5245a81dc0a2d5e06bfaf6fd9354067d08b7277e75d`와 Chromium ID `2f5697e88c421d458de9298bf83c71b527843935bcd15199d58dcc8361733bbf`, SHA/label/image/mount/port·path owner/realpath/link/process 확인 후 등록 자원만 정리했다. 독립 조회로 잔여0, 기존 anvil-web image `c0254177...`·running 보존. 비밀값/DSN 출력0.

## 조치·미충족·다음

Main B14 문서 helper의 상수명 AttributeError exit1/쓰기0은 ignored helper1곳 보정 후 실제 projection 검증0으로 분리 기록했다. 출력 라벨 B13도 표시만B14로 정정; 제품/검사 기준 변경0이다. `.pytest_cache` ACL/Python launcher 경고·역사 fixture1FAIL을 보존한다.

현재 기능 오류를 막는 핵심 읽기/UI·권한 실패는 국소 확인했다. 기존 전수 하네스/역사 fixture 실패는 제품 결함 확정이 아니며 정밀 검증 미진으로 남긴다. 보안·권한 위험을 뒤로 미루거나 검사를 느슨하게 바꾸지 않았다. 다른 Health5·승인 객체·Gate/cost/baseline·E-NET/E-API/E-AUD/E-SHOT·필수 AV 인수는 미구현/미확인이다.

**정식 화면 반영은 미실행**이다. 읽기 전용 확인에서 formal WSL app revision `bb2ff437...`, WSL_ACCEPTANCE mode·OIDC trust/operational shell 미설정, `/health/ready` 응답 migration_head=`0013_task_bootstrap_authority`다. 컨테이너 직접 Python DB metadata 조회2회는 해당 조회 방식의 exit1/직접 SELECT 결과 미확인으로 남기며 실패 원인을 확정하지 않는다. 준비 응답을 직접 SQL 결과라고 하지 않는다. 기존 개발 DB/인증·HTTPS 설정 변경은 현재 WI 제외라 자동 실행하지 않았다. 사용자가 새 카드를 직접 확인할 정식 URL은 아직 제공하지 못한다.

다음은 별도 승인된 계획에서 WSL 개발 DB 보존/백업·필요 migration·테스트 로그인/HTTPS 및 exact Git 배포·rollback을 다뤄 정식 화면으로 연결하는 것이다. DB/인증/인증서 변경은 별도 사용자 승인 경계이며 Oracle/ysna/Production·외부 공개·비용·PR/main은 제외한다. Rollback은 승인된 후속 WI/lease에서 이 C14 제품 diff만 역변경·국소 재검증한다. progress/HANDOFF와 H14 회수 증거를 남겼고 새 branch/history rewrite/force push/예약 변경0이다.
