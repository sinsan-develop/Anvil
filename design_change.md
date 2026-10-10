# Anvil 설계 변경·미진사항 기록

이 파일은 신산님의 2026-10-09 지시에 따른 작업 주기별 추적 기록이다. 작업을 진행할 수 없는 항목은 사유·재현 근거·영향·실제 수행/미검증 범위·재개 조건·권고안을 기록하고 다음 독립 작업을 계속한다. 이 기록으로 해당 항목의 **이번 계획 진도**는 정리할 수 있으나 실제 기능 구현, 테스트 PASS, 보안·DB 검증, PR 병합, 사용자 인수의 증거로 승격하지 않는다. 정본 상태와 실제 증거는 `docs/WORK_STATUS.md`, `docs/progress/build-progress.json`, 검증 보고서와 Git을 함께 대조한다.

## 현재 주기: U-01 정확 조합·기간 Dashboard

- 기준: 승인된 계약 B `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md`, 승인 기록 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`, 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md`.
- 작업 범위: Windows 로컬 개발 → 기존 단일 branch push → `ssh WSL-server`에서 동일 SHA 격리 검증. `ysna-server`와 Production은 이 주기 작업 대상이 아니다.
- 최초 보고 시 Task 1 API shell, Task 2 Reader, Task 3 화면의 로컬 절편은 구현·검증·원격 보존했고 Task 3 종료 `95d79d9bed1187d1480e3f341984827a19028d40`의 G-05 seq2304 PASS까지 확인했다. 이후 Task 4 보고 통제 H `f6257baad4d6f340301b04218e9949f1dc28c114`의 G-05 seq2309 PASS와 WSL-server 일부 실측까지 진행했다. 아래 DC-U01-003~005는 최초 차단 당시의 역사 기록이며 최신 미충족 판정은 DC-U01-006~010을 따른다. 이 기록으로 이번 계획 주기의 미충족 항목을 정리하되 U-01 전체는 `NOT_ACCEPTED`, Release는 `DEFER`, Production은 `NOT_EXECUTED`이며 실제 미실행 항목을 PASS로 바꾸지 않는다.
- R7 네 phase의 Network 인수 공백은 DC-U01-012, epoch107 H2 이후 역사 focused fixture 공백은 DC-U01-013, epoch108 H3의 합성 B registry fixture 공백은 DC-U01-014를 따른다. 아래 역사 실패는 삭제하지 않는다.

### DC-U01-014 — epoch108 H3 합성 B의 registry hash 불일치

- 후속 재검증(2026-10-10 KST): 별도 epoch109 WI/dual lease의 정확 검사기·통제 테스트2로 합성 Event `_file_hashes`/registry와 과거 R Git blob·현재 보고/DC 시점 혼합을 RED→GREEN 보완했다. H4 exact SHA `91fa68b0092ebf56d8118b285499a3c88269df51`는 로컬·WSL-server clean G-05 seq2334 PASS, WSL-server epoch109/108/107 focused exit0 `26 passed, 71 deselected, 133 subtests passed`다. 사전 등록 0700 격리 checkout은 owner/realpath/process/symlink/clean 확인 후 정확 제거·잔여0이다. 상세 `docs/04_test_reports/U-01_TASK4_EPOCH109_H4_WSL_CONTROL_QA_RESULT.md`. DC-U01-014의 해당 재검증 조건은 H4 범위에서 충족됐지만 전체97/Windows 기본 fd-capture·Foundation R6 `STORED_ROW`·전체 E-NET/E-API/E-AUD·U-01 인수는 미검증이다. 이 후속 기록 자체는 H4 exact-SHA G-05 PASS를 최신 보고 commit으로 이전하지 않으며, 새 보고 successor는 별도 통제 판정이 필요하다. U-01 NOT_ACCEPTED/Release DEFER/Production NOT_EXECUTED/U-02 BLOCKED, PR/main·새 branch·ysna 제외.

- 판정: H3 `37323c39839f119137fc9b22502464034086189f`의 로컬·WSL-server exact-SHA G-05 seq2329는 PASS이나 WSL 집중 회귀는 exit1(`1 failed, 13 passed, 73 deselected, 110 subtests passed`)이다. U-01 인수나 집중 회귀 PASS가 아니다.
- 사유·영향: `test_g05_dispatches_b_and_h3_without_accepting_u01`의 합성 B는 변경된 문서 바이트에 맞는 `_file_hashes`/registry 결박 없이 full dispatcher를 호출해 `PRG_REGISTRY_HASH_MISMATCH`가 난다. H3 fixture에는 같은 경로를 mock한 차이가 있다. 후속 로컬 재현에서는 과거 R의 `design_change.md` hash를 현재 파일에도 요구해 새 DC 기록을 거부하는 `U01_TASK4_POSTCLOSE_R_INVALID`도 확인했다. 역사 fixture/후속 route 결함으로 판단하지만 제품·전체 회귀 문제 부재는 아직 확정하지 않는다.
- 조치·재개 조건: 상세 명령·결과·임시 checkout 잔여0은 `docs/04_test_reports/U-01_TASK4_EPOCH108_H3_WSL_CONTROL_QA_RESULT.md`에 보존한다. 별도 비제품 WI·유효 dual lease로 합성 fixture만 최소 수정하고 동일 기존 branch의 clean/private 정확 SHA를 Windows/WSL-server G-05·focused로 재검증한다. 이 기록으로 이번 주기 미진은 정리하되 실패를 PASS로 바꾸지 않는다. Foundation R6 `STORED_ROW`·E-NET/E-API/E-AUD는 별개, U-01 `NOT_ACCEPTED`/Release `DEFER`/Production `NOT_EXECUTED`/U-02 `BLOCKED`, PR/main·새 branch·ysna 제외다.

### DC-U01-013 — epoch107 H2의 역사 focused fixture가 현재 종료 상태를 읽음

- 판정: H2 `d6cf8be5608eeb3ce438353a8184bb9b2e55cc20`의 Windows·WSL-server clean G-05 seq2324는 PASS이나 WSL focused epoch107 시험은 exit1(`10 failed, 2 passed, 73 deselected`)이다. Windows 동일 H2의 A 활성 단일 시험도 같은 Event 오류로 1 FAIL이어서 WSL 특이 결함으로 승격하지 않는다.
- 사유·영향: 시험의 `checker.load_bundle(ROOT)`가 과거 A seq2322·활성 lease 대신 현재 H2 seq2324·회수 lease를 읽는다. B/H2 합성 fixture와 active Git matching의 역사 HEAD 가정이 이 현재 상태와 충돌한다. 해당 시험 PASS·전체 통제 회귀·U-01 인수는 증명되지 않았으며 실제 H2 G-05 PASS와 구별한다.
- 조치·재개 조건: exact SHA·WSL G-05·실패 재현, 격리 checkout 0700/owner/realpath/clean 및 삭제 잔여0을 `docs/04_test_reports/U-01_TASK4_EPOCH107_G05_WSL_CONTROL_QA_RESULT.md`에 기록한다. 별도 비제품 WI/dual lease에서 과거 A 불변 Git blob으로 fixture를 고정하고 후속 G-05 경로를 복구해 Windows/WSL-server focused를 재실행한다. 이 기록은 이번 주기 미진 정리일 뿐 FAIL을 PASS로 바꾸지 않는다. Foundation R6 `STORED_ROW`와 전체 E-NET/E-API/E-AUD는 별도이고 U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, PR/main·새 branch/U-02·ysna 제외다.

### DC-U01-012 — R7 API URL 증거 보강 후 남은 Network 전체 인수·통제

- 판정: R7 exact SHA `c1d145c6fb52ab53ab9daa7ff584276b8ac1402b`의 WSL-server 네 phase는 각각 2 PASS다. 독립 Tester는 API 응답 95건의 전체 URL·origin과 request origin 148건이 허용 HTTPS origin만 사용하고 비허용 query·userinfo·fragment 0건임을 확인했다. R6의 API URL 증거 공백은 이 절편에서 해소됐지만, 전체 E-NET·E-API·E-AUD와 U-01은 `NOT_ACCEPTED`다.
- 남은 사유·영향: 정적·OIDC 요청은 민감 query 보존을 피하기 위해 origin만 기록했으므로 증거 12개만으로 Network 전체 URL을 사후 전수 감사할 수 없다. 런타임 fail-closed URL 검사가 PASS한 절편과 전체 ID 수락은 다르다. 기존 Foundation R6 `STORED_ROW` 실패·epoch106 G-05 10개 오류도 별개로 남으며, 필수 gate GREEN이 아니므로 PR/main·branch 정리·U-02는 진행할 수 없다.
- 수행·재개 조건: PNG4/Network4/DB-API-AUD4의 원격/로컬 SHA 일치, 네 화면 육안·독립 검토, WSL 전용 container/network/image/세 root/port 잔여0을 `docs/04_test_reports/U-01_TASK4_TWO_PAIR_WSL_QA_R7_RESULT.md`에 기록하고 기존 branch commit `58b72b07969b0afbc76593632d817cb6e4579ed3`로 사설 원격에 보존했다. 다음은 epoch106 정확2 lease 회수→별도 비제품 G-05 successor lease/RED→GREEN→Foundation R6 별도 재현, 이후 전체 Network/API/Audit와 남은 필수 ID별 독립 실측이다. 범위·요구사항·중요 위험 변경이 아니므로 일반 사용자 재승인 요청은 하지 않는다. Release `DEFER`, ysna/Production `NOT_EXECUTED` 유지.

### DC-U01-011 — R5 네 phase 통과 이후 남은 U-01 전체 인수 증거

- 판정: R5 exact SHA `208c8fbbe0fa93f216772379e14b679cfa2436f9`의 WSL-server PG15/OIDC/HTTPS/Chromium 네 phase는 각 2 PASS지만, 독립 Tester가 `AV-SAFE-034`·`AV-OPS-027`·`AV-UI-017`을 부분 검증으로 판정했다. 기존 R6 실패와 최신 G-05 RED가 있어 U-01 전체는 `NOT_ACCEPTED`다.
- 근거·영향: R5 PNG4/Network JSON4의 WSL/로컬 SHA-256 일치와 단계별 API/화면/DB 단언은 보존됐다. 그러나 서울 자정/월말/윤일·브라우저 시간대, 부분 Alert 페이지, 원본 지연/결손 및 카드별 완전성/신선도, 7상태 전량, ACK·Audit/운영 복구, 필수 E-SHOT/E-NET/E-API/E-EVT/E-AUD 동일 scope/시간 결박은 이 증거만으로 PASS가 아니다. 공통 UI-001/002/006/007/010~014, 추가 UI-003/004/008/009, OPS-001~005/027도 전체 ID 수락이 아니다. R6 `STORED_ROW`는 하네스 control0 단언과 현재 ACK 버튼 충돌이 유력하지만 런타임 확정 전이다. G-05는 epoch106 후속 route 부재로 exit1 10개 오류다.
- 조치·재개 조건: R5 8개 증거와 결과보고를 기존 branch `2798e6a0`에 commit·사설 development push했고 전용 자원 잔여0이다. 독립 Tester는 읽기 전용 판정만 했다. 같은 branch에서 정확 WorkInstruction·dual lease로 R6 계약/하네스 원인 분리 및 fail-closed G-05 successor를 보완하고, 남은 ID별 실제 WSL-server 증거·독립 재판정을 실행한다. 이 기록은 실행 불가 항목의 이번 주기 추적이며 PASS·사용자 인수·병합 허용으로 승격하지 않는다. Release `DEFER`, PR/main·branch 삭제·새 branch/U-02·ysna/Production 미실행. 추가 일반 승인 요청 대상은 아니다.

### DC-U01-010 — R4 세 phase PASS·other 빈 목록 선택자 불일치

- R5 후속 실측(2026-10-10 KST): 같은 단일 branch의 clean exact SHA `208c8fbbe0fa93f216772379e14b679cfa2436f9`를 WSL-server Git으로 수신하고 새 빈 전용 PG15/OIDC/HTTPS/Chromium의 동일 DB 수명에서 granted·revoked·restored·other 각각 2 PASS/30 deselected(exit0)를 확인했다. R4의 other 선택자 실패는 재발하지 않았다. 8개 PNG/Network 증거를 WSL 원본과 SHA-256 일치로 보존했고 전용 container/network/image tag/세 root/loopback 포트 잔여0으로 정리했다. 상세 `docs/04_test_reports/U-01_TASK4_TWO_PAIR_WSL_QA_R5_RESULT.md`. DC-U01-010의 재실행 조건은 충족됐지만 역사 R6 `STORED_ROW`, 최신 G-05 successor, 필수 증거 ID와 독립 Tester 판정은 별개로 남는다. U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main·새 branch·U-02·ysna/Production 미실행이다.

- 판정: R4 exact SHA `3eb267c910422c6ee486ef664d16bd9a2f45db54`의 새 빈 전용 PG15/OIDC/HTTPS/Chromium에서 granted·revoked·restored는 같은 DB 수명으로 각각 2 PASS였다. 마지막 other는 UI status 선택자 TimeoutError로 FAIL이므로 네 phase 인수는 아니다.
- 근거: other DB/API 접근 차단과 원장 `2|2|2|8|5`를 통과했다. Main 별도 Chromium DOM에서 다른 사용자 callback200, 빈 목록 status 텍스트1·기본 option1·pair select disabled를 확인했다. 기존 하네스의 `getByRole('status',{name:'선택 가능한 조합이 없습니다.'})`는 count0이고 같은 role의 `filter({hasText:'선택 가능한 조합이 없습니다.'})`는 count1이다. 이 선택자 불일치는 하네스 결함이며 제품 빈 상태 결함으로 단정하지 않는다. 진단 screenshot은 공식 other PASS가 아니다.
- 조치·잔여: phase별 screenshot/network 6파일과 other 진단 PNG를 로컬 hash 일치로 보존했다. R4 전용 container/network/image tag/세 root/두 port 잔여0, 공유 Web/PG 불변. epoch106 단일 Developer가 허용 브라우저 하네스 한 파일만 최소 보완했고 로컬 Main 31 PASS/1 opt-in SKIP 및 JS 자체·구문 PASS이나 WSL 재검증은 미실행이다. 세부 `docs/04_test_reports/U-01_TASK4_TWO_PAIR_WSL_QA_R4_RESULT.md`.
- 재개 조건: 같은 branch 새 clean SHA를 push→WSL-server Git 수신→새 빈 전용 PG15 네 phase 실측. 기존 R6, G-05 successor, 필수 증거와 독립 Tester 판정은 별개로 남는다. U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main·새 branch·U-02·ysna/Production 미실행. 일반 추가 승인 요청 대상은 아니다.

### DC-U01-009 — R3 실제 granted PASS와 revoked 하네스 기간 단언 충돌

- 판정: 승인 Task4의 WSL-server 새 빈 DB `granted`는 실제 OIDC/HTTPS/Chromium 2 PASS와 screenshot/network 파일을 확보했다. 다음 `revoked`는 DB 철회·감사7 뒤 브라우저 `FAULT_TRIGGER` 실패이므로 네 phase 인수는 `NOT_ACCEPTED`다. `restored`/`other`는 미실행이다.
- 근거: exact SHA `56b66b513b378b0f7865f4801ac8acae6da87128`의 `revoked` 브라우저 코드에서 1조합 UI 루프는 `30d`로 끝나고 2조합 전용 stale 블록은 건너뛰지만, fault 진입은 `7d`를 무조건 요구한다. 이것은 하네스의 phase 경로 불일치이며 제품 철회 기능의 최종 판정이 아니다. 첫 준비 단계의 API 합성 Telegram 값, DB 이름, Git remote alias, issuer subject 설정 오류는 각각 전용 자원에서 보정하고 새 빈 DB로 재시작했다.
- 영향·조치: `granted` 증거 2개를 로컬 hash 일치로 보존했다. R3 전용 컨테이너·network·image tag·세 root·두 loopback port는 신원 대조 후 잔여0, 공유 Web/PG ID·running 불변. 상세는 `docs/04_test_reports/U-01_TASK4_TWO_PAIR_WSL_QA_R3_RESULT.md`. 기존 epoch106 exact2 범위의 단일 Developer가 브라우저 하네스 한 파일을 최소 수정했고 로컬 Main 31 PASS/1 opt-in SKIP와 JS 자체·구문 검사 PASS를 확인했다. 실제 WSL 재검증 전이므로 phase PASS를 추가하지 않는다. 일반 추가 승인 대상은 아니다.
- 재개 조건: 하네스 변경 로컬 검증·새 exact clean SHA를 기존 branch에 push하고 WSL-server의 새 빈 격리 PG15에서 `granted→revoked→restored→other`를 모두 재실행한다. 기존 R6 실패·G-05 successor·독립 Tester 판정도 별도 남는다. 그 전 U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main·새 branch·U-02·ysna/Production 미실행.

### DC-U01-008 — 두 조합 하네스의 합성 실행 환경·통제 successor 미구현

- 후속 실측(2026-10-10 KST): R2 전용 PG15/OIDC/HTTPS/Web/Chromium은 실제 기동했다. 첫 정식 `granted` opt-in은 seed 이후 브라우저 실패(exit1)였고, 같은 DB를 빈 상태로 재사용하지 않았다. 고정 단계 진단→stale 대기→503 경고·복구 대기 보완의 정확 두 하네스 파일 C `e8ffca89`→`003c43ee`→`2373e91a`를 기존 branch에 보존했다. 최종 SHA의 기존 seed DB에 대한 **직접 Chromium 단일 granted**는 두 조합·6기간 조회, 경합·503 회복, same-origin network를 `pairs=2, reads=6, apiRequests=28`로 통과했다. 이는 새 SHA 빈 DB의 정식 네 phase나 E-SHOT/E-NET/E-API/E-AUD 인수가 아니다. R2 전용 자원은 정확 신원 대조 후 모두 정리해 잔여0·공유 Web/PG 불변이며 근거는 `docs/04_test_reports/U-01_TASK4_TWO_PAIR_WSL_QA_R2_RESULT.md`다. 이제 runner/fixture **부재**가 아니라 최종 SHA 네 phase 정식 재실행·기존 R6 원인 분리·최신 G-05 successor·독립 수락이 미충족이다. 추가 사용자 승인 요청 없이 같은 계획의 재작업으로 이어간다.
- 후속 보완(2026-10-10 KST): 합성 admin/reader/other 신원 seed와 source-bound Docker browser 명령은 기존 WI의 정확 한 파일 재작업 C `3346252c058c21915e7a3258377f9d604f61a0a9`로 구현·원격 보존했다. 독립 집중 27 PASS/1 실제 opt-in SKIP이며 수직 QA 완료가 아니다. WSL 호스트에서 합성 도메인이 외부 IP로 해석됨을 확인해 브라우저는 전용 Docker network alias 안에서만 돌리도록 R2 자원 계획을 기록했다. 남은 미충족은 exact SHA 전용 HTTPS app/issuer/Playwright 네 phase, 기존 R6 실패 분리, 최신 G-05 successor와 독립 수락이다.
- 판정: Task4 두 조합 하네스 자체는 로컬·WSL 비-opt-in 검증을 통과했지만, 실제 OIDC/HTTPS/Chromium 네 phase를 기동하는 전용 runner/fixture가 빠져 이번 주기 수직 인수는 `NOT_EXECUTED`다. 새 epoch106 C 이후 G-05 경로도 RED다. 이는 제품 결함 확정이나 추가 사용자 승인 요청이 아니라 계획 범위의 재작업 입력이다.
- 재현 근거: 기존 단일 branch의 하네스 C `0dff0ea73650a8c4d1a5b426f295b1113f6682c1`, 자원 계획 checkpoint `2c3dd55520f4296a6d642d18830a58abfee0acd9`은 개발 원격과 일치했다. `ssh WSL-server`의 clean exact SHA에서 전용 PG15 `150018`/migration0020·빈 5개 등록/감사 원장, 새 Python 22 PASS/1 opt-in SKIP, Node 자체 검사/구문 검사를 확인했다. 그러나 합성 issuer·세 principal seed·HTTPS 앱/화면 build/Playwright 런타임을 묶어 기동할 절차가 하네스에 없어 실제 네 phase는 시작하지 않았다. 기존 R6 통합 시험은 단일 host·다른 DB/name/계약이므로 재사용 가능한 runner가 아니다. G-05는 최신 branch에서 exit1 10개 mismatch/route 오류다.
- 영향·조치: 두 조합 선택·기간·철회·복원·독립 actor의 실제 DB/API/UI/Network·E-SHOT/E-NET/E-API/E-AUD와 기존 R6 `STORED_ROW` 회귀 해소는 미검증이다. 공유 서비스를 전용 QA 대체로 사용하지 않았다. 격리 PG container/network·세 경로·합성 Secret/venv는 ID·owner·clean 상태를 대조해 정확히 정리했고 잔여0, 공유 Web/PG ID·running 불변이다. 상세 근거는 `docs/04_test_reports/U-01_TASK4_TWO_PAIR_WSL_QA_RESULT.md`에 있다.
- 재개 조건·권고: 같은 branch에서 내부 QA runner/fixture를 정확 WI·dual lease로 로컬 구현하고 fail-closed G-05 successor를 보완한다. 그 SHA를 push해 WSL-server가 Git으로 수신한 후 전용 PG15/OIDC/HTTPS/Chromium 네 phase와 R6 정확 assertion을 재검증하고 독립 Tester 판정을 받는다. 그때까지 U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main·새 branch·U-02·ysna/Production 금지. 이 기록은 사용자에게 계속 여부를 다시 묻는 근거가 아니다.

### DC-U01-006 — SSH 복구 후 Task 4 동일 SHA 부분 검증과 잔여 수직 인수

- 판정: DC-U01-003의 SSH 접속 장애는 해소됐다. 그러나 승인 계획 Task 4의 두 정확 pair 선택→철회→재선택을 실제 OIDC/HTTPS/Chromium 화면·API·DB row·Network로 연결하는 인수는 여전히 미실행이므로 이번 주기 미충족 항목으로 기록한다.
- 실제 수행: 기존 단일 branch `codex/u01-dashboard-r2`의 정확 H `f6257baad4d6f340301b04218e9949f1dc28c114`를 로컬·개발 원격·WSL-server 전용 Git checkout에서 일치시켰고, 양쪽 G-05 seq2309 PASS(exit0)를 확인했다. WSL-server의 H에서 API/Reader/등록 76 PASS·1 warning, Web 103 PASS와 typecheck/lint/build exit0, 격리 PostgreSQL 15의 F-19A 등록·철회 2 PASS·2 warnings 및 U-01 빈 pair 읽기 1 PASS를 확인했다. 이는 실제 DB를 쓴 제한적 검증이며 두 허용 pair의 U-01 화면 수직 검증이 아니다.
- 독립 검토·미검증: 읽기 전용 Tester는 새 scoped GET/UI를 구동하는 두 pair 브라우저 하네스와 E-SHOT/E-NET/E-API/E-AUD 묶음이 현 H에 없음을 확인해 `U-01 NOT_ACCEPTED`로 판정했다. 1920×1080·12px, 7상태·키보드, 서울 달력일 경계의 실제 DB/API/화면/Network 대조, stale 응답 경합, `AV-SAFE-034`·`AV-OPS-027`·`AV-UI-017` 및 U-01 공통 ID의 독립 실제 인수는 PASS가 아니다.
- 자원·영향: QA 전용 `/home/daon/deploy/anvil-u01-task4-023369b5-qa`, 전용 Playwright 임시 패키지, tmpfs PostgreSQL 15 컨테이너 두 개를 신원·SHA·포트·마운트 검사 후 제거했다. 정확 두 컨테이너와 loopback 5545, 전용 checkout·패키지·pytest base 잔여0을 확인했다. 공유 `/home/daon/deploy/anvil`, 다른 Docker/DB/서비스, `ysna-server`·Production은 변경하지 않았다.
- 재개 조건·권고: 현재 단일 branch에서 새 U-01 두 pair OIDC/HTTPS/Chromium 수직 하네스를 승인 계획 범위·dual lease로 작성하고, 동일 SHA의 증거·독립 ID별 판정까지 실행한다. 그 전에는 Task 4 gate GREEN 또는 PR/main 병합을 주장하지 않는다. 이 기록은 다음 재작업 입력이며 추가 승인 요청은 아니다.

### DC-U01-007 — 기존 Foundation 브라우저 회귀 1건 실패

- 판정: H의 기존 R6 OIDC/HTTPS/Chromium/PG15 opt-in은 `1 failed, 51 deselected, 1 warning`(exit1)이며 Foundation 회귀 PASS가 아니다. 단계는 `STORED_ROW`, 오류 분류는 `AssertionError`다.
- 근거·원인 경계: 역사 R6 브라우저 시험은 저장 Critical 행의 `a, button, input, select` 개수 0을 요구하지만 현재 화면은 열린 Critical에 `확인` 버튼을 제공한다. 이것이 충돌 원인일 가능성은 높으나 실패 출력에 정확 assertion code가 없어 확정하지 않는다. 본 시험은 신규 scoped GET/두 pair 선택 자체를 검사하지 않아, 역사 단언을 보정하더라도 U-01 수직 인수를 대체하지 못한다.
- 영향·조치: 실패를 키 문제로 무시하거나 PASS로 승격하지 않는다. 테스트 전용 PG15는 비관리자 DB·migration0019·감사행1을 확인한 뒤 이름/label/tmpfs/loopback/mount0을 검사해 stop/자동제거했고 port5545 잔여0이다. 실제 제품 회귀인지 역사 하네스 계약 불일치인지 분리하는 최소 재작업과 새 U-01 수직 하네스를 같은 계획의 후속 검증 범위로 둔다.
- 통제 상태: 최초 DC-U01-005의 후속 G-05 경로 부재는 H에서 seq2309 PASS로 해소됐다. 본 새 기록의 추가는 H가 고정한 역사 보고 blob을 변경하므로 새 fail-closed 보고 successor 없이 최신 G-05 PASS를 주장하지 않는다. 단일 브랜치와 원격 H를 복구 기준으로 보존한다.

### DC-U01-003 — Task 4 WSL-server 동일 SHA 실측 불가

- 판정: 이번 주기 미실행 사항으로 기록한다. 설계·요구사항을 바꾸지 않으며 Task 1~3의 로컬 증거는 보존한다.
- 사유·재현 근거: 승인 계획은 로컬 clean SHA를 원격에 push한 뒤 `ssh WSL-server`에서 같은 SHA를 pull·검증하도록 정했다. Task 3 종료 SHA `95d79d9bed1187d1480e3f341984827a19028d40`의 로컬·`development/codex/u01-dashboard-r2` 동등성과 G-05 seq2304 PASS를 확인했다. Windows 로컬에서 `ssh -o BatchMode=yes -o ConnectTimeout=12 -o ConnectionAttempts=1 WSL-server true`는 2026-10-09에 종료 코드 1, `Connection timed out during banner exchange` / `172.27.253.53 port 22 timed out`으로 실패했다. 앞선 8·25·12초 시도도 같은 배너 시간 초과였으며 TCP 22 연결 가능성만으로 SSH 로그인 성공을 뜻하지 않는다.
- 영향: WSL-server Git pull/checkout, 격리 PG15·OIDC·HTTPS·Chromium, 실제 등록 두 pair→철회→재선택, 달력일 경계·DB row/API/화면/Network, 1920×1080·키보드·E-SHOT/E-NET/E-API/E-AUD/E-EVT와 해당 ID의 E-DEC/E-PRG·기존 Foundation 회귀는 `NOT_EXECUTED`다. 따라서 AV-SAFE-034·AV-OPS-027·AV-UI-017 및 U-01 공통 ID의 실제 환경 인수는 PASS 불가다.
- 수행·미검증: Windows 로컬 Web 103 PASS, typecheck/lint/build exit0, 인접 API 61 PASS/2 warnings, Task3 통제 인접 281 PASS와 독립 정적 검토 C0/I0/M0은 수행했다. 이는 WSL-server DB·브라우저·네트워크 결과를 대신하지 않는다. 이번 시도에서 WSL-server의 process/container/DB/임시 browser profile은 생성하지 않았으므로 그 대상에 대한 정리 작업은 없다. 기존 원격 잔여 자원 여부는 접속 불가로 미확인이다.
- 재개 조건·권고: SSH 배너 응답이 정상화되면 같은 단일 브랜치의 clean·원격 동일 exact SHA를 WSL-server가 Git으로 수신하고 Task 4의 격리 자원 이름·수명·정리법을 먼저 기록한 뒤 계획 Step 1~3을 실제 실행한다. WSL 서비스 재시작·Windows 재부팅·VHDX/ACL 변경 또는 다른 서버 대체는 이 기록만으로 승인되지 않는다.

### DC-U01-004 — Task 4 인수·PR/main 병합 보류

- 판정: 이번 주기 진도 기록상 미실행 항목으로 정리하되 제품 완료·수락·병합으로 표기하지 않는다.
- 사유·근거: 계획 Step 4는 필수 gate가 모두 GREEN일 때만 PR 생성·main 병합·merged-main smoke·기존 branch/worktree 정리를 허용한다. DC-U01-003의 실제 WSL-server·브라우저·DB·독립 인수 증거가 없으므로 GREEN 조건을 충족하지 못한다.
- 영향·조치: `codex/u01-dashboard-r2`는 기존 단일 작업 브랜치로 유지하고 새 브랜치를 만들지 않는다. PR/main 병합·merged-main smoke·branch/worktree 삭제·U-02 시작·ysna/Production 작업은 실행하지 않는다. 사용자 추가 승인을 요청해 작업을 멈추는 대신, 이 미충족 조건과 후속 재작업 범위를 여기와 결과보고서에 남긴다.
- 재개 조건: DC-U01-003의 동일 SHA 실측과 독립 Tester 판정, 필수 gate GREEN이 증거로 확인된 뒤 기존 브랜치에서 PR→main 병합→merged-main smoke→기존 브랜치·worktree 정리 순서를 수행한다. 승인 계획 밖의 기능·중요 위험 변경이 생기면 그 변경 내용 자체를 별도 항목으로 기록한다.

### DC-U01-005 — Task 4 결과 기록의 G-05 successor 경로 부재

- 판정: Task3 종료 checkpoint의 G-05 PASS는 보존하되, 이 변경기록·결과보고·evidence manifest를 같은 브랜치에 추가한 최신 상태를 GREEN으로 주장하지 않는다.
- 사유·재현 근거: Task3 H `95d79d9bed1187d1480e3f341984827a19028d40`은 clean/private 동일·G-05 seq2304 PASS(exit0)였다. Task4 보고 문서 추가 후 `python -B scripts/check_project_progress.py D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`는 종료 코드 1, `U01_TASK3_CLOSE_GIT_INVALID`다. 현재 검사기는 Task3 P→H 정확 5문서·1커밋 종료 경로에 결박되어 있으며 Task4 문서 후속 게시 route는 아직 없다. 보고서 내용 검증이 제품/WSL PASS라는 뜻도 아니다.
- 영향·조치: 후속 문서와 digest의 원문 해시는 맞췄지만 최신 Git에 대한 G-05는 NON-GREEN으로 남는다. 이를 무시해 PR/main을 진행하거나 검사 결과를 조작하지 않는다. Task3 H 불변 commit과 원격 복구 ref는 보존하고 새 문서는 같은 브랜치에 이력으로 보존한다.
- 재개 조건·권고: 기존 단일 브랜치에서 Task4 결과·미실행 상태를 명시적으로 허용하는 fail-closed 통제 successor와 위조 거부 테스트를 별도 작업지시·dual lease로 구현·독립 검토한 뒤 최신 G-05를 GREEN으로 복구한다. 이는 새 기능·공개 API·DB/운영 변경이 아니라 내부 진행 검증 경로 보완이다. WSL 실측 결손 DC-U01-003은 이 보완으로 해소되지 않는다.

### DC-U01-001 — Task 2 시작 문서의 제품 경로 표시 불일치

- 판정: 내부 문서 투영 오류를 A2에서 교정. 설계·기능 범위 변경은 아니다.
- 사유·근거: 최초 A `d89a1c6160821af0ed3fb62ee1426b9a576f201a`의 `repository.product_write_scope`가 전 Task 1 경로를 표시해 epoch102 WI·binding/write lease의 12경로와 달랐다.
- 영향·조치: Developer 쓰기를 중단하고 Event·lease 원문은 보존한 채 A2 `7b5c8bfc60e7db8d0147cf8bd7d82b5a674cc49d`에서 해당 표시와 A checkpoint를 교정했다. A2 local/private 동일·clean을 확인했다.
- 잔여·재개 조건: 신규 Task 2 통제 route와 제품 검증은 별도 gate다. A2 교정 자체를 제품 PASS로 간주하지 않는다.

### DC-U01-002 — Task 2 통제 독립 검토의 단계별 Git 허용 경계

- 판정: 동일 승인 범위의 통제 결함 2건과 음성 테스트 공백 2건을 단일 Developer가 보완했다.
- 사유·근거: 최초 통제 diff는 B 전용 `design_change.md` 수정을 D→P에도 허용했고, 종료 H가 test-only 제품 D를 허용했다. B→P/P→H 시각 역행 재결박 음성도 빠져 있었다.
- 영향·조치: 각각 RED→GREEN 음성을 추가하고 C→B에만 새 기록 파일을 요구하며 D→P 문서 및 H 제품 경로를 좁혔다. 최종 통제 SHA-256은 검사기 `BDC1AD0C9D932E8C1966C5814AFAE992C880BB33479E4592205C1E2FD6A607A9`, 테스트 `F49A5D11A67BBE2D6F1E04CD63F556714A695196D7F96837755C5ED2A7816CB7`이다.
- 실제 검증: Task 2 집중 10 PASS, 인접 7파일 271 PASS/0 FAIL(exit 0), 활성 G-05 seq2297 PASS, 독립 재검토 Critical 0/Important 0. 제품 12파일·WSL-server 실제 QA는 미실행이다.
- 잔여·재개 조건: 통제 C `ff8f26b60c22696fdb8a27ed5d551b26ab879100`는 기존 branch/private에 게시·원격 동일·clean까지 확인했다. 이 문서를 포함한 B 투영의 G-05·원격 게시/clean 후에만 제품 RED 테스트를 시작한다.
