# U-01 Dashboard 화면 로그아웃 / 2026-10-14

## 목표·범위

WSL 기능 구현 단계다. 신산님의 현재 `계속하자`는 직전 제안한 UI 로그아웃 구현의 계속 지시다. 기존 U-01/인증 API를 화면에 연결하는 내부 보완이며 인증 정책·권한·공개 API·DB·Secret 의미를 바꾸지 않는다. 부모는 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`(SHA256 60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39), WSL 운영은 기존 `APPROVAL-20261014-U01-WSL-DEVELOPMENT-RUNTIME-001.md` 범위다. Main 분류 MAIN_RECONFIRMED_NON_SEMANTIC, 이전 결과/기준 HEAD `1be966cb83c7e85f0e74e73c1e098106c41c4f6c`·private동일·trackedclean·seq2409·lease0. 역사 R6 FAIL/전체 U-01 NOT_ACCEPTED·Release DEFER 불변.

## 최소 동작

1. 기존 화면에서 접근 가능한 `로그아웃` 버튼과 처리/실패/종료 안내를 제공한다. 메모리 CSRF가 있을 때만 기존 `POST /auth/oidc/logout`에 `credentials:same-origin`·정확 x-csrf-token으로 요청한다. 상대경로만 허용, server API/정책 변경0. 200만으로 끝내지 않고 authenticated:false 계약을 확인한다.
2. reload 뒤 session cookie는 남아도 CSRF는 없다. session/status는 csrf를 반환하지 않으므로 이를 추측·storage보관·새endpoint로 우회하지 않는다. CSRF 없는 경우 무CSRF POST0, `로그아웃하려면 재인증이 필요합니다`와 기존 재인증 동작을 제공한다. 재인증 뒤 사용자가 로그아웃을 눌러 현재 세션을 종료한다. 이 제약을 실제 보고에 남긴다. 이미 비인증이면 상태 조회로 확인한 경우만 이미 종료 안내한다.
3. 시작 시 중복 click/ACK/재인증과의 mutation 경쟁을 직렬화한다. 이미 callback 교환/ACK가 진행 중이면 종료 전 로그아웃하지 않는다. auth authorization 지연/popup callback/ACK/카드·pair·alert 비동기 결과의 늦은 도착이 종료 후 상태를 부활시키지 않도록 실제 사용 상태에 generation/abort/dispose를 적용한다. 새 구조·공통화·라이브러리 도입0.
4. 성공 뒤 CSRF·pending popup/state·ACK·민감 카드/pair/selection/alerts를 제거하고 이전값이 재노출되지 않아야 한다. 로그아웃 뒤 refresh/reselect/401 및 다시 재인증 후 정상조회가 가능해야 한다. readiness 같은 비인증 정보와 인증정보는 구분한다.
5. 401/403/5xx/비JSON/네트워크 실패를 성공으로 표시하지 않는다. 실패 시 민감 화면은 숨기고 종료 확인 불가/재인증·재시도 안내를 남긴다. 401은 status 비인증을 별도 확인한 경우만 이미 종료로 판정한다. CSRF/토큰/세션cookie 원문은 DOM/log/storage에 넣지 않는다. 기존 source/origin/state 검증·ACK·읽기 카드/메뉴 동작 보존.

## 단일 Primary 허용 경로4

- `apps/web/src/console/App.tsx` (제품1)
- `apps/web/tests/f15-console.test.mjs`
- `scripts/check_project_progress.py`
- `tests/tooling/test_u01_postmerge_control_projection.py`

이외 source/API/DB/migration/auth issuer/proxy/패키지·lock·CSS 변경 금지. Main은 유효 write lease 중 위4경로 수정 금지. Developer stage/commit/push/서버·secret/새branch/하위agent0. 결과는 COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED를 구분하고 정확 RED/GREEN 명령·exit·미검증·diff·실패횟수를 반환한다.

## 최소 검증

- TDD: 실제 logout 요청/결과와 UI 상태를 검증하고 테스트가 helper mock 존재만 확인하지 않는다. 정상 종료·중복 click·csrf없음·401/403/5xx/비JSON/네트워크·지연 authorization/callback/ACK/읽기응답 경쟁의 핵심 실패를 확인한다. renderer 한계는 실제 브라우저로 보완하고 미실행을 숨기지 않는다.
- `npm run web:test`, `npm run web:typecheck`, `npm run web:lint`, `npm run web:build` 중 직접 영향 검사 각1회. 신규 통제class/위조음성·epoch124 인접 고정fixture 필요범위. 기존 전체 Python/전체R6/다중브라우저/부하 반복0. 환경 오류는 제품 실패와 분리한다.
- C16 clean/private actual G05 뒤 Main이 WSL Git exact source로 Web만 build/교체한다. 기존 API/issuer image·DB0020·QA principal·Secret·cert·internal망 불변, 새 manifest에 새 Web source/image와 기존 API/issuer source/image를 구분한다. 기존 Web ID/image/config는 rollback으로 보존, 생성 전 자원/수명/정리 등록. 이전 M15 backup 다시 생성·복원·migration하지 않는다.
- 새 브라우저에서 actual 재인증→선택카드→UI logout→cookie제거/sessionfalse/보호API401/이전정보제거→reload→재인증/재조회, 실패 안내·reload CSRF 제약을 확인한다. same-origin/cookie/DOM·선택본문 비밀보호, 일회성 정확정리0. 전체R6·외부SSO·U01인수 PASS 아님.

## 단일 브랜치 통제 계약

W17은 기준HEAD 직접자식 WI/Invocation/WORK_STATUS 정확3. A16은 W17 직접자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5, Event1~2409 raw객체 보존→2410 WI→2411 epoch125 worker→2412 write, 분리24시간token·제품1/허용4. actor `developer-primary-u01-dashboard-logout`, subject `U-01/DASHBOARD-LOGOUT`, step `U01_DASHBOARD_LOGOUT`.

binding `u01_dashboard_logout_binding`, mode/status `U01_DASHBOARD_LOGOUT_ACTIVE`, action `U01_DASHBOARD_LOGOUT_IMPLEMENTATION_ONLY`, snapshot `snapshot-u01-dashboard-logout-a16-seq2412`. WI ID `WI-U01-DASHBOARD-LOGOUT-20261014-001`. C16은 A16 직접자식 허용최대4 코드만, 새 G05 route 전 예상 RED를 PASS로 바꾸지 않는다.

Main M16은 C16 직접자식 신규 `deploy/wsl/U01LogoutReleaseManifest.json`+WORK_STATUS 정확2. actual manifest는 schema_version1/environment WSL_SERVER_TEST_STAGING/NOT_ACCEPTED/DEFER, source_commit C16·predecessor_manifest_commit M15, origin https172.27.253.53:3770, web source/image C16/newimmutableID, api/issuer sourceC15/기존immutableID를 구분하고 backup/DB/credentials변경0을 기록한다. 값은 실측 후 채우며 unresolved/secret/Git범위밖image를 거부한다.

B16은 M16 직접자식 progress/HANDOFF/digest/WORK_STATUS/DEVELOPMENT_ENVIRONMENT 정확5, Event2412불변. binding에 w17_checkpoint/a16_docs_checkpoint/control_checkpoint/manifest_checkpoint/manifest_sha256/previous_result_checkpoint를 exact결박, active_projection_checkpoint=null, action `U01_DASHBOARD_LOGOUT_CLOSE_READY`, snapshot `snapshot-u01-dashboard-logout-b16-seq2412`.

H16은 B16 직접자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5, seq2413write→2414worker REVOKED, completed `completed_u01_dashboard_logout_{write,worker}_lease`, active0. Event IDs `evt_u01_2413_dashboard_logout_write_lease_revoked`/`evt_u01_2414_dashboard_logout_worker_lease_revoked`, step `U01_DASHBOARD_LOGOUT_CLOSE`, reason/mode/status `U01_DASHBOARD_LOGOUT_CLOSED`, action `U01_DASHBOARD_LOGOUT_RECORDED_U01_PENDING`, snapshot `snapshot-u01-dashboard-logout-h16-seq2414`, H에서만 active_projection_checkpoint=B16. 첫 보고 H16직접자식 신규 `docs/04_test_reports/U-01_DASHBOARD_LOGOUT_RESULT.md`+WORK_STATUS 정확2. 모든 route는 과거통제/역사실패/원문prefix/새hash·타임스탬프·private exactSHA/clean/directparent/허용경로 위조를 fail-closed 검증한다.

## 제외·진행

Oracle/ysna/Production/예약/PR/main/새branch·history rewrite/force0. 기능범위·공개계약·보안정책 변경 필요시 Main보고, 독립 구현 가능한 나머지는 계속한다. 이번 화면 연결의 근거·동작·미진을 짧게 보고하며 정밀검증·UI제약과 기능누락을 분리한다.
