# FN10/FN11/UI05 단계 시작 대기요청 일회 승인 연결 검수

2026-10-27 · Main 어울 · 기준 `codex/av3-stage-b` / `be7802497a55f52ecc2e4f3ef46f42801a1121e5`.

## 판정·변경 이유

기존 startStage의 REQUIRE_APPROVAL 경로를 일회 승인 요청→UI08 별도 결정→원 임무 상세 복귀·명시 결박→같은 원명령 WAITING 저장·queue 조회에 연결한 소스 단위를 검수했다. 변경 전은 STAGE_QUEUE_APPROVAL_NOT_CONNECTED/412였고, 변경 후 명확 APPROVAL_REQUIRED/412에서만 승인 절차를 작성한다. 기존 AUTO 저장·취소는 유지한다. 전체 FN10/FN11/UI05·Stage·계획 완료나 실제 Agent 실행 가능 판정은 아니다.

WI r2 SHA256 `C64626EDA948564E4C1E3661169914B169F909CCCED9D39B74DA5A36EEA01107`, 허용18경로. 초기589A1B81은 preflight/첫 RED 기준이다. r2는 같은 허용 시험의 실제 SELECT fixture 원열 보완만 명시한 Main 내부 상세화이며 범위·권한·검수 기준은 불변이다. 단일 writer `fn10_stage_start_one_time_approval`, Main 제품 수정0이다.

## 구현·보존

- 기존 operation/payload·null/0 봉투·전체 원 payload hash·candidateCommandId·현재 user/client/control/policy·기한을 결박한다. 원 payload의 budgetRef/baselineRefs를 별도 scope 필드로 이동하지 않는다.
- 현재 방법론/graph·모드/도달 경계·예산 검사를 유지하고 receipt/소비·stage_runs/queue_requests·감사를 기존 transaction에서 결합한다. 기존 input_json을 소비해 새 영구 후보를 만들지 않으며 transaction-local payload는 최종 원 input과 대조한다.
- WAITING/version1, assignmentRef=null·기존 readinessIssues·slotReserved/writerReservationPerformed/executionAuthorized/dispatchPerformed=false를 유지한다. scheduler/dispatch·Agent·슬롯/writer 예약은 연결하지 않는다.
- App 기존 StageStartStorage를 보존하고 원 draft fullref로 상세 화면에 복귀한다. 확정 assignmentRef를 초안 URL에 대입하지 않는다. 원 후보 부재/타 주체를 hash만으로 복원하지 않는다.
- 승인 요청/결정/결박만으로 저장0. 원명령·입력·미확인을 보존하며 UNKNOWN 후412를 새 승인으로 우회하지 않는다. 저장은 사용자의 별도 확인·명시 등록이며 응답 유실은 같은 명령, GET 실패는 수동 재조회다.
- 무소비 종결의 명시 종료는 현재 제어를 다시 검사하고 원명령/요청/종결 이력을 보존한다. 과거 정책의 동일성을 현재 실행과 로컬 종료에 혼합해 영구 잠금을 만들지 않는다. 실행 정책·주체/제어·소비·UNKNOWN 보호는 유지한다.
- 역사 조회는 당시에 소비된 정확 command·payload·receipt/audit를 검증하고 현재 회원을 확인한다. 합법 정책/제어 개정만으로 과거 원장을 위조로 바꾸지 않는다. LEFT JOIN·감사count=1로 누락/중복을 드러내고, 영수증 commandId/operationId도 실제 command 원열과 대조한다.
- cancelQueuedRequest 승인 차단·기존 AUTO/null 취소, 한도/알림·다른 연산은 이번 기능으로 확대하지 않는다. 실제 DB 적용·사용자 정책/권한 부여·GRANT·Secret/TLS/서비스·Agent/native·비용은 실행0이다.

## Main 실행 증거

| 검사 | 실제 결과 |
|---|---|
| 최초 guard RED | 401b88 `node --test tests/unit/FN10/stage-start-approval-consumption.test.ts`: 1 FAIL262.7508ms/exit1, 실제 미연결 오류와 기대 승인필요412 차이. 제품/SQL0 |
| 직접·인접12파일 | 743313: 73 PASS1112.0695ms/FAIL·SKIP0, UI05/FN10·UI08/FN11·직전FN05 소비 회귀. I1 보정 전 증거 |
| 영수증 반례 RED | a8810e `--test-name-pattern='영수증 식별자 불일치'`: commandId/operationId 각 단독 UUID 변조2 FAIL269.9593ms/exit1, Missing expected rejection |
| I1 보정 직접5파일 | 425f38: stage-queue/routes·start 승인 소비·UI05 start/queue API 30 PASS975.2876ms/skip0·type/diff0. 앞선73과 중복을 포함한 별도 실행 |
| 실제 App 첫 실행 | c52aa5→3936e5: CASE/AUTO/AUTO_NULL/LOST_REQUEST/LOST_START/GET_FAIL6 PASS, REJECTED1 FAIL·후속2 NOT_RUN, 총16.5s/exit1 |
| 표시 보정 후 실제 App | 50d6fc: REJECTED/REVOKED_POLICY/UNKNOWN412 3 PASS5.1s/exit0. 앞선6과 나누어 실행했으며 최종9 일괄 PASS로 표시하지 않는다 |
| 최종 타입·diff | 0ea684: tsc --noEmit -p tsconfig.base.json 및 git diff --check exit0 |

첫 실제 App은 JS `index-GkYLHnGt.js` SHA256 `B851BEF98AFFC1FE7DA889DE2A9FD2CA03E026C56482CDDE1347A9169D58FAB6`(452modules320ms)다. 종결 이력 표시2행 보정 후 최종 JS `index-3Cus1QBy.js` SHA256 `285F4B9814CFCCA52741645197190BC5C44D3839F4AA7672B09CF9A0ADD3BD67`(452modules311ms)로 남은3모드만 실행했다. CSS `BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87`는 불변이다. 실제 App은 제품 번들+합성 API이며 실제 DB 저장·정식 HTTPS 서비스 증거가 아니다.

## 검수·실패 보존

- 독립 preflight C0/I0. SQL0047 `2A276689E6490AF3C35A6369CA0E15DFE9135C596BC2A5E83B89E0E89CF22630`의 정적 C0/I0/M0. 기존0036 graph/budget/AUTO 취소·0046→기준선→export wrapper chain, mixed operation/allNULL/receipt-only/자료없는APPLIED/흔적삭제 guard를 보존했다. 실제 SQL compile/DML/COMMIT/RLS/경합 NOT_RUN이다.
- 독립 코드 I1은 Main 실제2 RED 뒤 같은 writer round1으로 해소됐다. 실제 c.operation_id와 외부 명령ID를 대조하고 fixture 권위는 INSERT p7에서 별도 보존했다. result_ref에서 권위를 역산하지 않는다. scoped ADDRESSED·새 C/I/M0.
- Minor 정책 fixture는 startStage REQUIRE와 요청/결정 AUTO 규칙을 분리해 재귀 승인 정책을 제거했다. 화면 왕복으로 초기화되는 기존 ack도 다시 명시 확인하는 정상 조작을 시험에 넣었다. 실제 정책·제품 허가를 완화하지 않았다.
- 실제 REJECTED의 원값/편집 복귀는 성공했으나 closedStageApprovals 안내가 pending 분기 안이라 숨겨지는 표시 오류로 첫 실행이 실패했다. 기존 안내1줄을 같은 buffer 분기 안·pending 분기 밖으로 옮겼고 새 scoped C0/I0/M0와 후속3 PASS로 확인했다. 추가 SSR·리팩토링은 없다.
- writer 추가 입력2PASS/1FAIL211.7357ms, 최초 직접72PASS/1FAIL1136.1402ms와 해당9 PASS353.7794ms는 제출 근거다. 후자의 손상 시험 fakeSELECT가 state를 상수 APPLIED로 덮은 오류는 기대·제품 불변의 fixture 정정이었다. Main fresh와 구분한다. 초기 quoting/type/중복키/fixture mutate/code명 준비 오류는 기능 RED와 분리한다. 개발자 정식 FAILURE_REPORT0이다.
- 최종 Panel `2250BD0F3B41F8C42819294A0450B37B154129248C26A295177A2D8191E8F6A4`, server stage-queue `FC494392B65B12A4EB40A0261BF30E3EDF0BFCDDD0A94A190E0B72B5F754B404`, browser spec `A3961929124523C142E1ABBD0A422813FB2BF279A51FD2E0D9F479C3DDC799DB`. 전체18 raw/index 지문은 SOURCE_MANIFEST에 기록한다.

## 자원·한계·다음

사전등록 QA `D:/tmp/anvil-v3-stage-b/ui05-stage-start-approval-20261027-01`의 dist/results/temp/config.mjs만 사용했다. owner SINSAN\cyhuh·생성별30분·생성 전 부재/부모 owner/nonlink/realpath, 회수 전 항목별 소유/link/절대경로와 해당 Node/Edge process0을 확인했다.

- 첫 생성00:53:48.009Z→00:54:55.323Z 정리77항목(392d8d), 별도95d67a rootFalse.
- 후속 생성00:56:31.620Z→0ea684 정확 정리·최종타입/diff, 별도 c62964가00:57:14.593Z qaAbsent=true 확인. 정리 항목 수는 출력으로 보존되지 않아 수치를 주장하지 않는다.

정식 DB/served·실제SQL/동시성·실Agent/native/슬롯·사용자 인수는 NOT_RUN. API/session/transport·ABA의 모든 실제 DOM 음성 조합을9모드로 인증하지 않는다. 기존 보호 untracked8·과거 실패/다른 작업은 보존한다. 소스 rollback은 후속 revert이며 실제 자료 복구·삭제는 실행하지 않는다. 검수 소스를 기존 branch에 checkpoint/private 게시한 뒤 다음 계획 미완료인 한도 정책의 승인 연결을 정확 기존 계약 안에서 대조한다. 전체 계획 목표는 active다.
