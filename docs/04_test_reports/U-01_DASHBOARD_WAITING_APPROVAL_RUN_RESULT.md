# U-01 승인 대기 Run 결과 / 2026-10-14

## 판정

별도 `승인 대기 Run` 카드 구현 완료·핵심 동작 확인. 기존 영속 Run의 WAITING_APPROVAL 상태만 수·ID·원 phase·관측시각으로 연결했다. 승인 요청 객체 수·승인/반려 기능은 아니다. 실제 WSL Run0/대기0·빈 안내가 API와 일치했다. `approvalPending`는 원장 미구현으로 UNAVAILABLE을 유지한다(DC-U01-020).

전체 U-01 NOT_ACCEPTED/Release DEFER 및 역사 전체 R6 FAIL/DC-U01-019를 유지한다. 비영 실DB, 실제 승인 요청 원장·개별 owner/Worker 건강·Health/Gate/cost/baseline 미연결은 미확인 또는 미구현이며 추후 테스트로 숨기지 않는다.

## 판단 이유·변경

- WI SHA256 `A03AED3F30A7403472FF9FA000EB77D64CE9C0CF00EF5B909DF7FBBA4485B751`, Invocation `FD9840F360061AB969BA5E7D107667FEFC6395E3FB0A3A4C5FF5ECCA0D4DC59C`. 부모 scoped 계약 승인 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`·기존 WSL runtime 승인 범위다.
- 시작 A19 `16d00c2519498487b26d9997abf42478696fe913`, 기존 `codex/u01-dashboard-r2`/trackedclean/private동일. 단일 Primary exact4, Main 동일 source 쓰기0·formal FAILURE_REPORT0.
- C19 `41f489253b6b4d02369b3db489bae755e02eeb18`은A19직접자식 exact4/865삽입2삭제. App의 별도 read-only 카드37행·웹 테스트160행·additive checker379행·통제 테스트289삽입2삭제만 변경했다. API/DB/schema/권한/Secret/새 요청0, 기존 generic approvalPending·Run/ACTIVE/BLOCKED/Queue/Agent/logout 불변. ID는 원본 계약의 printable Unicode128 codepoint·unique·0~100, 전체 근거·시각·만료 실패는 수치/목록을 숨긴다. phase로 승인 대기를 추측하지 않는다.
- W20 `83de257e270d7abccd4980e5404a49fb33ca4b1c` exact4에서 DC-U01-020을 append했고 기존 DC 원문을 보존한다. M19 `639992c9e01de2bb151c639e91089c2c1aa31818`은C19직접자식 exact2, B19 `5af570a8017e48b82ece4b6e7c7460d97c107f03`은M19직접자식 exact5. 각 게시본 actual G-05 seq2427 PASS다.
- H19 `692b458f16d3cb662d79fcd6b840469c800b6cb2`은B19직접자식 exact5/독립C0I0M0·privateclean actualG05seq2429PASS. Event1~2427 원문 보존 뒤2428write→2429worker REVOKED, epoch128 activeworker/write/agentnull. 이 첫report tail 게시본 검사는 별도 실행한다.

## 최소 검증·오류

웹 명령은 `apps/web`, Python은 저장소 기준에서 실행했다. 독립 사양·품질 검토 C0/I0/M0이며 아래 실행 범위만 통과했다.

| 명령·범위 | 실제 결과 |
|---|---|
| `node --import tsx --test --test-name-pattern="Waiting approval Run" tests/f15-console.test.mjs` | RED0P/6F exit1→최종7P/0F/0S exit0; Main fresh7P 및 뒤 보강된 malformed/101 음성1P exit0 |
| `npm run test:console` | 전체 한 번138P/0F/0S exit0/2952ms |
| `npm run typecheck`, `npm run lint`, `npm run build` | 각각 한 번 exit0 |
| `python -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_u01_postmerge_control_projection.py::U01DashboardWaitingApprovalRunEpoch128Tests --tb=short` | RED7F/20.14초→GREEN7P/123.90초 exit0 |
| 위 pytest 옵션으로 epoch127 및 `tests/observability/test_f20_u01_run_status_summary.py` | 최초28P/1F/54.51초; Run summary22P는 재실행하지 않았고 frozen 입력 보완 뒤 epoch127만7P/47.44초 exit0. 지정 Python36건 최종 GREEN |
| Python2파일 builtin compile/기존 checker prefix·tail bytes 비교/`git diff --check` | exit0 |
| `python -B scripts/check_project_progress.py <저장소 절대경로>` | C/M/B 게시본 seq2427, H seq2429 PASS exit0 |
| Main Git-only build / manifest fetch / Web-only swap / Chromium 핵심 확인 / 독립 보존·자원 조회 | 각각exit0·아래 실제/시험 범위 분리 |

epoch127 최초실패 `test_c18_m18_git_direct_children_and_source_hash_binding`는 과거 A18 mock이 현재 A19 문서를 읽은 입력 혼입이다. P/E/H/D만 A18 frozen Git bytes로 공급해 고쳤으며 collector·기대·위조 음성 완화0. Main static helper 최초실패1은 함수명을 recover로 오독한 것으로 recover_web의 실제 AST를 대조해 해소했다. 서버/제품 실행 전 도구오류이며 기존 복구 함수가 동일해 이전8사례를 불필요하게 반복하지 않았다. cache 접근·Python 시작 경고·legacy Docker builder 경고는 별도 도구정비 항목으로 남기고 ACL·도구 설치0.

## 실제 WSL·시험용 반례·보존

- URL `https://172.27.253.53:3770/`. Chromium151.0.7922.34/1920×1080에서 실제 재인증 팝업→개발 조합 선택→Run AVAILABLE/전체0·WAITING0/빈 안내→7d 현재값/Queue·Agent 보존→실제 원본 복원→UI로그아웃/sessionfalse/보호API401/카드 제거의7단계를 확인했다.
- client 주입 대기2/ACTIVE1(phase가 APPROVAL_PENDING이어도 ACTIVE는 미집계), HTML ID text escape·clock5분 만료·중복ID failclosed는 실DB 비영 증거가 아니다. 정식DB 합성Task/Run/승인 객체 생성0, 실제 승인 요청 원장·조합별 대기 객체 수는 미구현이다.
- 브라우저 요청 same-origin, cookieSecure/HttpOnly/Strict·DOM token 미노출, 선택 auth/기능 본문9개 서버 비밀 감사 CLEAR. 전체 background본문·전체R6 감사는 미실행이며 원문/Secret/DSN을 Git/보고서에 남기지 않았다.
- image `sha256:467066b6dce412f74766262e60ec9b59b39c660a28fa1b5b5c8d4dbc76b3939b`, 새WebID `1497bbf9b76b319bd82233267f58aebb542e6f21b76685e908e759b0b12b7b41`, sourceC19/M19. archive583680bytes/SHA256 `D94FDBAD9871F9E063C91D3011DB3A6DAFB8AC7126637793B8FC38DE4E0A7871`. 정식 Git M19 detached/clean을 별도 읽기 확인했다.
- API3c52b542/issuere2667673 sourceC15/image/ID·DB0020/권한/Secret/cert/보호 hash/망 불변·strictCAready0020. env raw 순서false와 고유 전체 키값true/bind·entrypoint·cmdexact는 구분한다. 정상 서비스3·정지망분리rollback5를 보존했다.
- 일회성 `anvil-u01-waiting-approval-run-browser-41f48925` exactID/image/label/mount/port 검증 후 정리·독립 부재0. Primary 자체 dist3파일도 링크/tracked/프로세스 확인 후 정확 정리·부재0. 등록 proof4개는 root0700 runtime 아래 root0600으로 개발/복구 수명까지 유지하고 기존 backup·rollback 삭제0.

## 조치·남은 기능·복구

이번 확인 범위에서 기능을 막는 오류와 즉시 처리할 보안·데이터 위험은 남지 않았다. 새 사용자 오류가 나오면 해당 범위는 바로 해결한다. 과거 전체 R6 하네스 실패·전체 통합/다기기·성능/복구 정밀 검증은 미진을 보존하고, 1단계에서 직접 영향받는 검증과 혼동하지 않는다.

실제 승인 요청 저장·조회는 승인 완료 기록으로 대체할 수 없다. 조합별 원장·데이터/인가 계약이 없는 기능을 추가하려면 정확 계약안을 먼저 확정하고 별도 승인받아야 한다. 다른 미연결 기능 중 기존 완전 원본으로 연결 가능한 작업은 계속할 수 있다. 새 권한·DB 계약을 이번 카드 승인에 묵시 포함하지 않는다.

Rollback: oldWeb `988cb3591fc9c61c0476e09984f030e6acff1ce261203d7b15686d310083cd41`/M18image는 `anvil-u01-waiting-approval-run-rollback-20261014`에 정지·망분리 보존했다. 현재exactID/manifest/보호자료·망을 재대조해 Web만 이전 profile/image로 복구한다. 옛 compose.env로 전체 Compose 재생성하지 않으며 API/DB migration·권한 rollback은 필요하지 않다. Oracle/ysna/Production/예약/PR/main/새branch/historyrewrite/force/실Provider·외부비용/타프로젝트 변경0.
