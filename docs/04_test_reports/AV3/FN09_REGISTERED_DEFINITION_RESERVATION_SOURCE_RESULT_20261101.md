# FN09 등록 정의 책임 세션 예약 A — source-only 검수 결과

## 판정

승인된 코드·화면·미적용 SQL·합성 검증 범위는 구현·검수했다. 실제 DB/SQL 적용·권한·키·서비스·Agent는 변경하지 않았다. 실제 PG 문법/정규식/OID/trigger/RLS/경합, 실제 App·브라우저·사용자 인수는 NOT_RUN이다. 전체 FN09/Stage/WORK_PLAN 완료 또는 실제 사용 가능 판정이 아니다.

- 승인 후보 SHA256: 81E87C515C35D3689859C15259B464238F4B0BDBE10DDC6AAB21D848A11DD759
- 최종 WI SHA256: 4DA9F311ABCCE98FB1E9D052D3A39B8B453753FBFE691DE5D433A8B8474131C1
- 시작 제품 기준 10cd3c84770f5b54798cc486a2e5d4aa0380b281, 승인/WI 문서 기준 8a7a0a4a2b2ff6d47eea94794a5fe7b64072eb26 / codex/av3-stage-b.
- 기존 Primary 단일 writer 구현, Main 관리·fresh 검수·통합, 기존 Reviewer 읽기 독립 검토. 새 agent/chat/branch/worktree/자동화 생성0.
- 제품·시험·SQL은 정확 허용12이며 Main 결과/계획/현황 문서는 별도다. 보호 untracked3은 보존한다.

## 변경과 보존

기존 후보 exact5 payload/binding14/session6·CANDIDATE_ONLY는 유지했다. 등록 정의는 명시 connectionKind:REGISTERED_DEFINITION의 exact6/binding15/session7과 REGISTERED_DEFINITION_ONLY로 구분한다. 동일 UUID를 근거로 namespace를 추정하지 않는다.

같은 PoolClient/현재 주체의 실제 정의 보호reader로 fullref/head를 검사하고 기존 정책·원명령·승인 요청/별도 결정/한 번 소비와 연결했다. 현재 회원·제어·DENY는 replay도 보호한다. 원명령 replay에 과거 승인 만료·정의 head/임무 초안 변경을 fresh 조건으로 소급하지 않는다. 같은 연결·같은 종류·정확 이전 ref의 후속 예약만 같은 session으로 이어지며 종류/연결 교체는 기존 절차에 남긴다.

Web은 기존 보호 고정 GET의 명시 선택→부모에 원명령 보관 성공→POST→영수증/상태 재조회로 연결했다. 모순된 status/code·판독불가 응답은 명확 거절로 낮추지 않는다. 전송 전 조회 실패는 입력·재준비를 보존하고, 실제 전송 후 결과 불명은 원 pending/UNKNOWN으로 보존한다. 저장 후 GET 실패·늦은401/문맥 ABA를 구분한다.

실행 준비는 등록 정의 예약이면 후보/head/context 조회 전에 거절한다. FN16 inventory와 FN12 보완 초안은 새 정확 원형을 수용하지만 실행·현재권위·복원 합격으로 승격하지 않는다. HUMAN 보고나 NOT_READY 설정은 실제 능력 증명이 아니다.

0068.pending에만 forward 분기를 작성했다. 기존0016/0049는 원지문을 보존하고 CHECK·함수 signature/trigger·0055/0056 승인 wrapper chain과 후보 분기 의미를 유지한다. 새 표/데이터 변환·삭제·초기화0. 이름 없는 CHECK는 정확 대상·원정의·일치1개만 교체하도록 검산하고 인용 리터럴의 case/공백/escape를 보존한다. 모든 SQL은 미적용이다.

## 검증 근거

Main 최종 314806: 정확6파일 신규19+직접인접16 = 35PASS, FAIL/SKIP/CANCEL/TODO0, native exit0, 743.4533ms.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN09/registered-definition-responsible-session.test.ts tests/unit/FN09/registered-definition-responsible-session-schema.test.ts tests/unit/FN09/registered-definition-responsible-session-ui.test.ts tests/unit/FN09/responsible-session-web.test.ts tests/unit/FN09/responsible-session-approval-input.test.ts tests/unit/FN09/responsible-session-approval-consumption.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc -p tsconfig.base.json --noEmit
```

Main ef22fc 타입 exit0. dd6d9e 실제 Web 메모리 build exit0: configFile:false/envDir:false/publicDir:false/write:false/emptyOutDir:false, JS2515448/CSS11129/HTML354bytes(합2526931). 환경 파일 읽기·디스크 산출0. Main2338d6 diff/native0·신규4 raw CR/후행공백/EOF 빈줄0. Primary be7197도 동일35PASS/native0, 5853bf type0,4037ef memorybuild0과 269b24 형식 검사를 제출했다.

독립 검수는 제품8 최초 C0/I1 후 Workspace I1 scoped C0/I0, SQL 최초 C0/I1 후 매칭 I1 scoped C0/I0, 최종 신규시험3/12지문 대조 C0/I0다. 마지막 제품8/SQL은 기존 검토 지문과 동일하여 미변경 본문을 다시 전수 검사하지 않았다.

서버 시험은 실제 정의 producer/reader·정책·승인 요청/결정/소비·예약/고정조회·replay/CAS·실행 차단을 소비하며 미모델 SQL을 거절한다. React는 실제 컴포넌트와 합성 부모/transport의 메모리 DOM이다. inventory는 별도 원증빙 fixture, FN12는 변환 fixture이므로 생산자부터 이어진 종단 증거가 아니다. SQL 시험은 정적 패턴/JS 알고리즘 검사이며 PostgreSQL 실행 증거가 아니다.

## 오류와 보완

- 최초 TEST_ONLY06f537: 정상 후보 class/UI2PASS, 등록 정의 parser422·선택입력0의 기능 RED2. 0068 부재1은 정적 준비 실패로 분리했다. publicDir:false 보정 후 UI27c28b의 정상/RED도 기록했다.
- 모순된 status/code를 명확 거절로 읽는 반례01b439 후 닫힌 조합으로 보완했다.
- SQL CHECK 매칭이 인용 key/value의 case·공백을 지우는 I1은 Main3d4255 정적 반례 뒤 토큰 보존으로 보완했다. 역치환 지문이 이전 DCC24F8F와 정확히 일치해 나머지 본문 불변을 확인했다. 실제 PG 미실행 한계는 유지한다.
- POST전 control403/정의GET409도 pending 없는 UNKNOWN 잠금으로 만드는 I1은 실제 React c3b6a8 RED 뒤 전송 단계/실제 command로 분리해 d48ab9 GREEN·독립 scoped C0/I0를 확인했다.
- 실행 준비 fixture 빈 sourceScopes의 선행422는 준비 오류1로 분리하고 정상 필수scope 보정 후 f97f4f1PASS를 확인했다.
- 일반 상태 최종문1건은 INCOMPLETE로 인수해 같은 담당자를 즉시 재개했다. 정식 FAILURE_REPORT 횟수로 세지 않았다. 경로/cwd·문서 EOF 등 준비 오류와 정확 보정은 WORK_STATUS에 남겼고 제품 성공으로 소급하지 않았다.
- 기준 WI의 EOF1바이트만 비의미 보정했으며 새bytes+LF의 SHA가 이전E7996DD6와 정확히 일치한다. 사용자 재승인/범위 확대0.

## 미검증·통합·복구

실제 DB 적용/PG 문법·정규식·OID/trigger·RLS·경합, 실제 App 부모버퍼 종단·브라우저·서비스·Agent·설치·사용자 인수는 미검증이다. 명시 제외를 PASS로 계산하지 않는다. 기존 실제 사용자 자료·백업 대상 조사/권한 부여·키/서비스 변경·기존 프로젝트 차단 해제0, 소유 QA/browser/service/livehandle0이다.

Main은 허용12와 결과/계획/현황3만 기존 private branch에 checkpoint하며 main 병합·운영/Oracle 반영은 하지 않는다. 원격 main f976ed5e29e14b13e12729d5b1ccf98f050f2210과 로컬 main ref0443043251d25aa77c17d23165b7c9299c8dbeb8은 구분하고 변경하지 않는다. 문제 시 소유 source commit을 정상 revert한다. SQL은 적용하지 않아 실제 DB rollback은 수행하지 않는다. 다른 업무·보호3을 되돌리거나 삭제하지 않는다.

## 최종 허용12 SHA256

- `apps/server/modules/assignments/responsible-sessions.ts`: `851513EADAAE8E2F9310907F08D5C472881E6E6C7AB27C13FC43C40D189F0295`
- `apps/server/modules/projects/routes.ts`: `E09868B2E916A1AF232636FD266B84126EED0C9B190CE428ADF354ED7AAFC10F`
- `apps/web/src/features/workspace/responsible-session-api.ts`: `0DBFF8CC4E29E4B4B5E9C5808E7816112B267F8416237F263F0C4CC55FE41E9A`
- `apps/web/src/features/workspace/responsible-session-approval.ts`: `91EDCB4184D7B72B61293F1F6D5F26167378EB7282779290E5013BE1246A055A`
- `apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx`: `CE3274D9318DD494E5BA4FB2176C742BD5016B59FD78C523142C1C3F89A9D9F4`
- `apps/server/modules/executions/project-execution-preparations.ts`: `5DB49D39CCE97C8F20B71E48942B90DE27955CAE5F407AD36193F7514AA1E340`
- `apps/server/modules/backups/responsible-session-inventory.ts`: `9A9D3CD996029042F271D9D50347FC16B4A9ADD7DC051C65C327BA2F3A7BA936`
- `apps/server/modules/results/result-rework-input.ts`: `2778AE829C370ABC9C8713852A963E420FB40B66CA40F78FDF67A7F00EDF0096`
- `db/migrations/0068_registered_definition_reservations.sql.pending`: `158E7DAABC85870D9C42C19CD38312B7DAE9609589200B8B3BC6D32A7F48054D`
- `tests/unit/FN09/registered-definition-responsible-session.test.ts`: `349B2BCBF97E0D4406A3409555018AF9F7E50D92C0851F15107EC0A3A3451416`
- `tests/unit/FN09/registered-definition-responsible-session-schema.test.ts`: `2ED3DDA3C009B4991D15906616DAEC19EA71444949147C765DFFD590CD8B95FB`
- `tests/unit/FN09/registered-definition-responsible-session-ui.test.ts`: `5FC0026A612D3F99496794847C1CFCA82F2C40D9615568C48924721A50CE4BF1`
