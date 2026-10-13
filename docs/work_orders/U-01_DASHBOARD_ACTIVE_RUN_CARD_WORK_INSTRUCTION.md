# U-01 실행 중 Run 카드 WorkInstruction / 2026-10-13

## 승인·판정

WI-U01-DASHBOARD-ACTIVE-RUN-CARD-20261013-001. 신산님의 기능 우선 로컬/WSL 1단계 계속 지시, 설계 §29.2 실행 중 운영 카드, 작업계획 U-01과 부모 승인 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md` SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39` 범위 안의 내부 UI 읽기 연결이다. Main MAIN_RECONFIRMED_NON_SEMANTIC; 요구사항·공개 API·DB·권한 변경0. 기준 결과보고 tail `b21d1ec24f67b8cc0c9a1f2827ae021de110e750`은 H13 직접 자식 정확2·local/private clean·G05seq2399PASS·epoch122두leaseREVOKED/active0·QA자원0이다.

현재 Run 원본은 완전한 exact-pair ScopedRunSource를 actual DB에서 읽고 current.run의 전체 건수/상태·phase·ID·시각·근거를 제공한다. 화면의 일반 `run` 카드는 전체 Run 수이지 실행 중 건수가 아니다. 기존 응답 의미를 바꾸지 않고, 같은 응답에서 canonical `RunStatus.ACTIVE`만 실행 중 Run 건수·목록으로 구분한다. Run ACTIVE는 Run 업무 상태이며 OS 프로세스/Worker 정상 또는 승인 객체 수를 뜻하지 않는다.

## 정확 구현 경계

- 제품 `apps/web/src/console/App.tsx` 정확1. 새 `실행 중 Run` 카드에 ACTIVE 건수·Run ID·phase·원본 `scoped_run_owner`·관측시각을 표시한다. current.run 전체 count/기존 generic 카드·BLOCKED/Database/occurrences는 보존한다. API·reader·DB·routing/auth/Secret 변경0.
- 기존 `validScopedOwnerItems`/canonical status·phase enum, 전체count/items/genuine unique IDs·AVAILABLE/source/reason:null·exactpair completeness/eventTimeBasis CURRENT_OBSERVATION·같은 관측시각/서버 snapshot<=5초를 검증한다. 결손·중복·상충reason·다른pair·불명상태/phase·부분/위조근거·시각불일치면 UNAVAILABLE; 확인된 완전한 빈 원본만0. 별도 상태/cache/effect·새 dependency·공통화/구조개편/최적화 금지.
- 시험 `apps/web/tests/f15-console.test.mjs` 정확1. 실제 React 렌더링으로 혼합 ACTIVE/WAITING_APPROVAL/BLOCKED의 전체3 대비 실행중1·목록, 완전빈0, source/reason/ID/enum/pair/time/count 위조 음성을 RED→GREEN. 카드 부재 또는 잘못된 상태 포함을 실제 실패로 먼저 확인한다.
- 통제 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` 정확2. 합계최대4/제품1, 유효 epoch123 dual token의 단일기존Primary Developer만쓴다. Main동일4파일수정금지. 정식 실패만계수하며 C13 역사fixture실패/환경오류를제품실패로승격하지않는다.

## 순서·국소 검증

1. W15 신규WI/Invocation/WORK_STATUS 정확3을 기존branch에게시. 새successor전G05예상RED는PASS아니다. A14는W15직접자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5, rawEvent1~2399보존후seq2400WI→2401epoch123worker→2402write ACTIVE·24시간분리token·정확4scope/제품1; 독립검토/private뒤dispatch.
2. Developer Web 신규target+BLOCKED/Database 관련 인접target, `npm run web:typecheck`, `npm run web:lint`, `npm run web:build`; 새통제class·Gitdirty/remote/history/extra/rename 위조음성. 사용자단계지시에따라 전체suite/R6/브라우저전수 반복금지; 기존시험삭제/기대완화금지. exact 명령/exit/미실행 기록.
3. C14는 A14직접자식 허용코드최대4·독립C/I0·local/private clean actualG05seq2402PASS 이후만 새빈 사전등록 WSL GitexactSHA PG15/0020/OIDC/HTTPS/Chromium 국소실측. 정상Task/Runrepo의합성혼합3Run→current.run전체3/실행중UI1+ACTIVE ID/phase, BLOCKED기존1 유지·새로고침/기간현재상태구분·pair철회시이전목록제거. 기존DB/서비스변경0·secret값출력금지·exact자원정리및독립잔여0. API제품불변이므로 무관전체API/DBsuite반복없음.
4. B14 C14직접자식 progress/HANDOFF/digest/WORK_STATUS 정확4, ACTIVE/seq2402 action `U01_DASHBOARD_ACTIVE_RUN_CLOSE_READY`, snapshot `snapshot-u01-dashboard-active-run-b14-seq2402`, binding `u01_dashboard_active_run_card_binding`: a14_docs_checkpoint=A14/control_checkpoint=C14/active_projection_checkpoint=null. H14 B14직접자식 정확5통제, seq2403write→2404worker REVOKED·active0, status/mode `U01_DASHBOARD_ACTIVE_RUN_CLOSED`, action `U01_DASHBOARD_ACTIVE_RUN_RECORDED_U01_PENDING`, snapshot `snapshot-u01-dashboard-active-run-h14-seq2404`, completed keys `completed_u01_dashboard_active_run_{write,worker}_lease`; 이때만 active_projection_checkpoint=B14. subject `U-01/DASHBOARD-ACTIVE-RUN-CARD`, step `U01_DASHBOARD_ACTIVE_RUN_CLOSE`, EventIDs `evt_u01_2403_dashboard_active_run_write_lease_revoked`/`evt_u01_2404_dashboard_active_run_worker_lease_revoked`. 첫tail 신규 `docs/04_test_reports/U-01_DASHBOARD_ACTIVE_RUN_CARD_RESULT.md`+WORK_STATUS 정확2/최신G05.

## 미구현·제외

실행중카드 핵심확인과 정식사용자화면배포를구분한다. 정식WSL persistent DB/인증설정변경·신규API/DB필드·승인대기객체·다른Health5/Gate/cost/baseline·전수R6·필수인수·Oracle/ysna/Production·PR/main/새branch/historyrewrite/forcepush/예약변경은제외. U-01NOT_ACCEPTED/ReleaseDEFER·기존R6FAIL·역사fixture1FAIL 유지. 실현가능한다음미구현기능은원본/권한계약을확인해별도WI로계속한다.
