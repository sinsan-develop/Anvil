# WI-U01-DASHBOARD-BLOCKED-RUN-CARD-20261013-001

## 목표·승인 범위

설계 §29.2·계획 U-01·`APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`의 기존 정확pair 읽기 계약 4·6과 최신 기능 구현 우선 지시를 적용한다. 이미 요청별pair인가 후 `load_scoped_run_source`가 읽는 완전한 현재Run 원본에서 `BLOCKED` Run만 세어, 선택한 조합의 고정UNAVAILABLE `current.blocked`와 화면을 연결한다. Run 상태를 승인객체·Gate실패·Queue건강·기간발생으로 해석하지 않는다. 새 공개 경로·상위응답필드·metric형식·DB schema/migration·persistent write·권한·Secret·Provider 비용 변경은 없다. Main 비의미 구현 binding은 부모승인 hash `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39` 범위를 넓히지 않는다.

## 제품 구현 경계

- 기존 `current.run`과 같은 요청의 신뢰된 `ScopedRunSource`만 사용한다. loader는 exact project/environment SQL·100행 초과/legacy NULL scope·DB오류/비정상행을 실패-폐쇄한다. 코드에서는 고유ID·유효RunStatus·유효phase·source 관측시각과 기존current.run items/count의 일치를 확인한 뒤 BLOCKED 행 수를 계산한다. 누락·중복·위조상태·미래/오래된관측·잘린원본은 `UNAVAILABLE/count:null`, 완전한 빈원본만 AVAILABLE/0이다. 요청 snapshot과 source관측 차이가 절대5초를 넘으면 blocked를 연결하지 않는다.
- `current.blocked`는 기존metric `{status,count,source,observedAt,reason}` 형식을 유지하고 source `scoped_run_owner`를 사용한다. `sourceCompleteness.current.blocked`는 실제pair·관측시각·CURRENT_OBSERVATION·완전성 근거를 current.run과 결박한다. current.run의 기존응답·기타카드·occurrences는 변경하지 않는다.
- 화면은 `BLOCKED Run`·실제건수·같은 응답 current.run items의 BLOCKED 목록과 관측시각을 표시한다. count/목록/근거/pair 불일치면 UNAVAILABLE이며 이전pair 응답을 재사용하지 않는다. 최근현재상태와 period발생을 혼합하지 않는다. 브라우저는 기존 same-origin 경로만 호출한다.
- 허용제품은 `packages/api/scoped_dashboard.py`, `apps/web/src/console/App.tsx` 정확2. 시험은 `tests/api/test_u01_scoped_dashboard_reader.py`, `tests/api/test_u01_scoped_dashboard_api.py`, `apps/web/tests/f15-console.test.mjs` 정확3. 통제successor는 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` 정확2. 합계 최대7, 단일기존Developer만 유효dual token으로 수정한다. Main은 활성lease 중 이7파일을 수정하지 않는다.

## 실행·검증 순서

1. Main이 이번DB-card 실측보고+WI/Invocation/WORK_STATUS W14 정확4 문서 checkpoint를 기존branch에 게시한다. 그 뒤 rawEvent seq1~2394 보존·activelease0·hash/private/time 확인, A13 seq2395 WI→2396 epoch122 worker→2397 write를 Event/progress/HANDOFF/digest/WORK_STATUS 정확5에 결박한다. token서로다름·24시간·제품scope2/전체7이다.
2. Developer RED→GREEN: reader actual `ScopedRunSource` 혼합상태/빈/결손·중복·위조/시각과 API exactpair·철회·Web 값/목록/근거불일치. 명령 `python -B -m pytest -q -s -p no:cacheprovider tests/api/test_u01_scoped_dashboard_reader.py tests/api/test_u01_scoped_dashboard_api.py`, 대상Web test 및 `npm run web:typecheck`, `npm run web:build`. 기존 통제 위조음성·현재epoch 신규class만 검사하며 이전expired fixture 실패를 숨기지 않는다. 전체R6/전수suite 반복은 없다.
3. C13은 A13 직접자식 허용코드 최대7·independent C/I0·local/private clean actual G05 seq2397 PASS 후에만 등록된WSL exactSHA PG15/OIDC/HTTPS/Chromium에서 실제BLOCKED Run row→API→UI와 exactpair거부를 핵심확인한다. 생성전 자원identity/lifetime/cleanup 기록·후 잔여0이다.
4. B13 C13직접자식 progress/HANDOFF/digest/WORK_STATUS4, action `U01_DASHBOARD_BLOCKED_RUN_CLOSE_READY`, snapshot `snapshot-u01-dashboard-blocked-run-b13-seq2397`; active_projection_checkpoint null. H13 B13직접자식 정확통제5, seq2398 write→2399 worker회수·active null·제품0, action `U01_DASHBOARD_BLOCKED_RUN_RECORDED_U01_PENDING`, snapshot `snapshot-u01-dashboard-blocked-run-h13-seq2399`; 여기서만 B13 SHA 결박. 첫reporttail 신규 `docs/04_test_reports/U-01_DASHBOARD_BLOCKED_RUN_CARD_RESULT.md`+WORK_STATUS 정확2.

## 판정·제외

기능별 네상태로 보고한다. 다른Health5/Gate·cost·baseline·승인객체·전수R6·필수ID는 미충족 그대로이며 U-01 NOT_ACCEPTED/ReleaseDEFER다. Main이이번선택은 기존원본을 기존읽기필드에 연결하는 내부구현방법으로 판정한다. 계약차이나중요위험 발견시 경계를 보고하고 독립계획작업은 계속한다. 정식WSL지속DB migration·Oracle/ysna/Production·PR/main·신규branch·historyrewrite·forcepush 제외.
