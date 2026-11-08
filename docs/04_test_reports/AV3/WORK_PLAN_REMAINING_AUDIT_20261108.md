# 작업계획 44항목 구현·검증 잔여 대조

작성: 2026-11-08 / Main 어울 / 기준 main e3c7dd1abe69c3a966a419f63c661b72ba1ddef0.

## 판정과 읽는 방법

전체 작업계획은 미완료다. 준비 시안/계약의 수용, 개별 소스 구현, 합성 검증, 실제 환경·사용자 인수를 구분했다. 이미 구현한 저장/조회와 PR63~65를 다시 미구현으로 돌리지 않는다. 반대로 실행·회수·이전 등의 핵심 기능 공백을 ‘추후 테스트’로 숨기지 않는다.

기능 상태는 구현 완료·핵심 동작 확인 / 구현했지만 동작 미확인 / 부분 구현 / 미구현을 기준으로 한다. 아래 ‘동작 미확인’은 현재 통합본의 전체 실제 여정을 뜻하며 합성 검수 이력을 삭제하는 말이 아니다. 준비/통합 업무의 상태는 기능 코드 존재와 다른 검수 완료 상태로 별도 표기한다.

44항목은 P3 + UI15 + FN18 + IX8이다. 카드의 옛 ‘전부 시작 전’ 머리글은 현재 상태로 사용하지 않는다. 근거 경로는 저장소 루트 기준이며 UI의 W는 apps/web/src, 서버의 M은 apps/server/modules, R은 docs/04_test_reports/AV3다. 카드 파일명은 docs/work_packages 아래이며 같은 행에서 접두사를 생략한 sibling 파일은 앞 모듈과 같다. 상세 실제 명령·오류·수정/회수·승인은 WORK_STATUS와 연결 결과서를 따른다.

## 준비 3항목

| ID | 현재 판정·구현/수용된 것 | 구체 잔여·다음 행동 | 근거 |
|---|---|---|---|
| P01 | 준비 범위 완료: 상세 시안/공식 양식 사용자 수용 | 제품/DB 기능 인수와 별개. 시안 재작성 불필요 | INTEGRATION_WORK.md:5; P01 REVIEW-02/승인 기록 |
| P02 | 준비 범위 완료: 기술·계약·수치 기준 결정 수용 | 실제 Agent 지원/성능/손실 수치는 실증거 필요 | INTEGRATION_WORK.md:15; P02 RESULT/TECH_DECISIONS |
| P03 | 부분: 초기 환경/build/단위/WSL PG15·HTTPS 확인 이력 | 현재 보호 PG 복구 미완료. R3는 소스 검수이며 실제 복제/기동/전환 미실행 | INTEGRATION_WORK.md:28; R/P03_R3_FIXED_BINDING_SOURCE_RESULT_20261031.md:7,40 |

## 화면 15항목

| ID·현재 상태 | 이미 연결·확인한 소스/이력 | 구체적으로 남은 기능·검증 | 근거 |
|---|---|---|---|
| UI00 부분 구현 | 공통 탐색/인증/오류/프로젝트 보호 GET, 과거 실제 PG+Edge auth QA·합성 App | 현재 서비스 전체 왕복/접근성. M2의 기존 세션 재확인 결합은 이번 합성 직접시험으로 확인; 암호 로그인/실서버는 별도 | SCREEN_WORK.md:18; W/shell/AppShell.tsx:44,92; R/UI00_SHELL_PROJECT_ACCESS_READ_SOURCE_RESULT_20261107.md:18 |
| UI01 부분 구현 | 검색/보관/cursor/접근·승인/방법론 원문 이동 | 현재 단계/담당/실작업/다음행동 응답 생산·실사용 두 프로젝트 검수 | SCREEN_WORK.md:29; W/features/projects/ProjectsPage.tsx:25; projects/api.ts:3 |
| UI02 부분 구현 | 생성 초안/검토/확정/생성·재진입, 방법론 JSON·설정 사본 | 실제 기존 소스 관측/기준선·총괄/환경 배치·전체 자료 가져오기·실DB 여정 | SCREEN_WORK.md:39; W/features/project-create/ProjectCreatePage.tsx:145,176; WORK_STATUS:17897 |
| UI03 부분 구현 | 방법론 복사/graph 편집/검토/확정/별도 적용/역사 | 실제 총괄 제안·실행 중 영향 근거·served 저장왕복 | SCREEN_WORK.md:51; W/features/methodology-editor/ProjectMethodologyPage.tsx:84; R/FN02/UI03_EXPLICIT_APPLICATION_RESULT.md:16 |
| UI04 부분 구현 | 임무/맥락/책임 예약·준비·승인 보관/조회 | 실제 총괄/책임 Agent 세션·지시/수행·중지/재개. 비활성 버튼을 임의 활성화하지 않음 | SCREEN_WORK.md:61; W/features/workspace/WorkspacePage.tsx:44,52 |
| UI05 부분 구현 | 결과/검수/보완 초안/체크포인트·PR64 등록 정의 준비 | 실제 증거 진위/완료 수용·실제 쓰기 회수·후속 보완 임무 | SCREEN_WORK.md:71; W/features/session-detail/SessionDetailPage.tsx:129; R/FN12_REGISTERED_BINDING_REWORK_PREPARATION_UI_RESULT_20261108.md |
| UI06 부분 구현 | 공식문서/양식·설계/계획·trace/원문·드리프트 | 문서 항목별 귀속 ref 저장·실파일/시험/diff의 실제 연결 | SCREEN_WORK.md:81; W/features/design-trace/TraceViewer.tsx:14; WORK_STATUS:17921 |
| UI07 부분 구현 | 변경 요청/영향·UNKNOWN/승인·기준 후보/포인터 역사 | 보호 영향/OS writer 근거 부재로 실제 적용412. 기준 전환→계획 개정→영향 업무 재개 | SCREEN_WORK.md:93; W/features/design-change/DesignActivationPanel.tsx:29; R/FN04_ACTIVATION_APPROVAL_POINTER_RESULT_20261027.md:12 |
| UI08 부분 구현 | 목적별 승인·세 결정·UNKNOWN/CAS·PR63 소비v3 읽기 | 실제 관측 기반 문제 분류/회수/교체·실행 효과와 승인 연결 | SCREEN_WORK.md:103; W/features/decisions/ApprovalsPage.tsx:213; R/FN09_ORIGIN_REUSE_START_CONSUMPTION_RESULT_20261108.md |
| UI09 부분 구현 | 이전 준비기록/과거 결박/대상 선택·보호 GET/저장·PR65 | 실제 새 대상/세션·6항목 이해 대조/이전 확정/안전재개 | SCREEN_WORK.md:113; W/features/transfers/TransferPreparationPage.tsx:31; R/FN14_REGISTERED_BINDING_PREPARATION_READ_UI_RESULT_20261108.md |
| UI10 부분 구현 | 지식/대화·검토/확정/정정/제외·헌법 적용·공유 요청 | 원발언 자동 이동의 대화방 매핑·실제 공유/헌법 전달·이해 대조 | SCREEN_WORK.md:124; W/features/knowledge/KnowledgePage.tsx:94; WORK_STATUS:17921 |
| UI11 부분 구현 | 연결/환경/정책·native 준비·사람 보고·권위 기록 조회 | 실제 첫/둘째 Agent 연결/측정·역할 배정·Windows↔WSL·해제 | SCREEN_WORK.md:134; W/features/connections/ConnectionsPage.tsx:60; R/UI11_NATIVE_PREPARATION_R2_A_SOURCE_RESULT_20261102.md:62 |
| UI12 부분 구현 | 제어 요청/보호 요약/명시 수락·UNKNOWN 확인 코드 | 실제 두 기기·구세대 차단/PG 원자성·진행 작업/실정지 요약. 수락 코드 자체는 존재 | SCREEN_WORK.md:144; W/features/control-handoff/ControlAccessPage.tsx:55; WORK_STATUS:13664 |
| UI13 부분 구현 | 같은 App/ID의 모바일 대화·절차·문서/승인탭, 합성 PC/430px | 실제 지시/역할·중지/재개·기기/원격 제어·푸시·실기기 인수 | SCREEN_WORK.md:154; W/features/mobile/MobileNavigation.tsx:4; R/UI13_MOBILE_WORKSPACE_PANES_RESULT_20261031.md:5 |
| UI14 부분 구현 | 단일 원본 export·보호참조/설치 intent·대기·앱내 알림 | 전체 프로젝트/DB/소스 백업/검증복원·전체 슬롯·외부 push/설치 운영 | SCREEN_WORK.md:164; W/features/backups/ProjectBackupsPanel.tsx:37,58; InstallationResourcePanel.tsx:53 |

## 기능 18항목

| ID·현재 상태 | 이미 구현·확인한 핵심 | 구체 기능 공백/실제 미검증 | 근거 |
|---|---|---|---|
| FN01 구현했지만 동작 미확인 | 생성/참여/로그인·제어·소스 선언/첨부·기준선/승인 이력 | 현재 통합본 생성→재시작→권한별 조회 전체 여정. USER_DECLARED/UNVERIFIED는 의도된 표식 | FUNCTION_WORK.md:15; M/projects/project-baselines.ts:43 |
| FN02 구현했지만 동작 미확인 | 내장3방법론/복사/개정/graph/검토/확정·별도 적용/고정본 | 현DB/served의 빈 작성·복사 수정·두 프로젝트 버전 고정 | FUNCTION_WORK.md:28; M/methodologies/project-methodologies.ts:18,116 |
| FN03 부분 구현 | 문서·첨부 불변 버전/가져오기/제안/검토/확정/원문·소스 링크 | 실제 보호 파일 관측 생산자→드리프트→제안 수집 미완료, 현재 공급자 부재412 | FUNCTION_WORK.md:39; M/documents/document-source-link-history.ts:21 |
| FN04 부분 구현 | 설계/화면/업무 추적·영향 검토/적용 승인 후보·포인터 | 실제 영향 완전성/OS writer 회수 공급자 부재로 실제 적용 차단, 영향 업무 재개 | FUNCTION_WORK.md:52; M/traceability/baseline-activations.ts:43 |
| FN05 부분 구현 | 대화/지식 버전·정정/제외/검색·헌법 적용/맥락·공유 요청 | 실제 공유/대상 반영·Agent 맥락 전달→새 세션 이해 대조 | FUNCTION_WORK.md:63; M/knowledge/knowledge.ts:19; project-knowledge-share-requests.ts:38 |
| FN06 부분 구현 | 연결/환경 정의·HUMAN/native 신뢰/수신·codec/준비 | 실제 기존 코딩 Agent 작은 작업→파일/시험/결과/중지 회수 제품 연결 | FUNCTION_WORK.md:75; apps/connector/adapters/primary/codec.ts:166; apps/connector/adapters/primary/provider-bound-wire.ts:15 |
| FN07 부분 구현 | Claude SDK 정규화/session owner·coordinator/instruction bridge | 실제 둘째 도구/계정 교체·생성/지시/결과, 현재 핵심 bridge는 SYNTHETIC_ONLY | FUNCTION_WORK.md:88; apps/connector/adapters/secondary/instruction-bootstrap.ts:20 |
| FN08 부분 구현 | START/SEND/자료 등록·spool/관측/ACK·중복/UNKNOWN·원자료 queue | 실제 Windows 소유 프로세스/도구 승인·중지/회수·재접속 생산 경로/실측 | FUNCTION_WORK.md:99; M/executions/project-runtime-commands.ts:17; 최신 FN09 결과서 |
| FN09 부분 구현 | 임무/역할/세션 예약·Options/이해 검토·원자료 승인/소비 | 실제 총괄/단계/하위 Agent 운영 연결. queue/material/outbox 합성 저장은 실제 실행이 아님 | FUNCTION_WORK.md:113; M/assignments/responsible-sessions.ts:187 |
| FN10 부분 구현 | 단계 대기/취소/한도/예약·판단 저장/후속 후보 | 실제 scheduler/dispatch·완료→다음 단계 실행. 과거 실제 PG 대기열 증거는 별도 유지 | FUNCTION_WORK.md:124; M/scheduling/next-actions.ts:18; R/FN10/STAGE_QUEUE_PG_QA_01.md:11 |
| FN11 구현했지만 동작 미확인 | 인증/client/제어·정책·요청/결정/일회 소비/감사 | 현 전체SQL의 실제 ACL/RLS/경쟁/회수/만료·부작용1회 통합 | FUNCTION_WORK.md:136; M/approvals/project-approvals.ts; access/project-command.ts |
| FN12 부분 구현 | 결과/증거·조건별 검수/분류·보완 초안/이력·PR64 | 실제 관측/산출물 진위 기반 완료 수용·보완→후속 임무 배정/실행 계보 | FUNCTION_WORK.md:150; M/results/project-result-reworks.ts:16; rework-successor-input.ts:24 |
| FN13 부분 구현 | 체크포인트 prepare/저장/읽기·중지 이력/합성 recovery | 실제 OS 프로세스/쓰기 회수→잔류→reconcile→수동재개. HTTP quota 저장은 현재 연결돼 있음 | FUNCTION_WORK.md:162; M/checkpoints/project-checkpoints.ts:54; projects/routes.ts:335 |
| FN14 부분 구현 | 이전 준비기록·과거결박/대상 선택·저장/GET·UNKNOWN/PR65 | 실제 인계 manifest 동결/회수·새 대상 이해 대조/확정/재개 미완료 | FUNCTION_WORK.md:174; M/transfers/preparation-record-input.ts:7 |
| FN15 구현했지만 동작 미확인 | 요청/수락/grant·세대 전환·보호 조회·다른client 차단 | 현재 실제DB/두 기기·모바일·이전 writer 폐기 여정. 과거 QA setup 실패와 분리 | FUNCTION_WORK.md:186; M/control-handoff/control-acceptance.ts:28; R/FN15/SOURCE_QA_20261026_RESULT.md:5 |
| FN16 부분 구현 | 정책/보호참조/inventory·bundle/검증복원 helper·단일 원본 export | 전체 프로젝트 DB/소스/미커밋/관계 반출→별도 복원검증→영향/확정 적용 | FUNCTION_WORK.md:199; M/backups/project-backups-input.ts:5; project-inventory-composition.ts:70 |
| FN17 부분 구현 | 승인 사건 알림/목록/읽음/딥링크·browser push 지원조회 | 중요 오류/자동한도/최종완료 사건과 모바일 push 구독/전달 | FUNCTION_WORK.md:211; M/notifications/notification-input.ts:6; W/notifications/BrowserPushSupportPanel.tsx:8 |
| FN18 부분 구현 | Electron shell/HTTPS설정·종료/trust/native·installer 생성 검산 코드 | 실제 설치 산출물·격리 실행/로그인/재시작·업데이트/제거. native 격리 미확인으로 생성 차단 | FUNCTION_WORK.md:222; apps/desktop/src/main.cjs; R/FN18_DEVELOPMENT_INSTALLER_SOURCE_RESULT_20261101.md:5 |

## 통합 검수 8항목

검증 코드/준비물과 검수 실제 수행은 별개다. 아래는 완료로 판정할 근거가 부족한 통합 검수이며, 기능 자체의 미구현을 단순 테스트 미실행으로 치환하지 않는다.

| ID·현재 판정 | 필수 실제 흐름·구체 잔여 | 근거·선행 |
|---|---|---|
| IX01 미완료 | 방법론3종/선택3경로→문서/계획/지식·실DB 저장/재조회·브라우저·재시작/TM07 | INTEGRATION_WORK.md:41; J3은 실제 SQL105 후 NETWORK/UNKNOWN/childDiagnostic null. 현재 source/113SQL 결박·후속 여정 필요 |
| IX02 미완료 | 화면 지시→실제 Agent→파일/시험→제출/검수→추적 | INTEGRATION_WORK.md:51; FN06/08/09 실제 생산자 선행 |
| IX03 미완료 | 자동/건별·승인/거절/수정/불명·보완/중지/대조 재개 | INTEGRATION_WORK.md:61; IX02/FN10/11/13 |
| IX04 미완료 | 새 세션/다른 도구/총괄 교체와 변경 통제 A~D | INTEGRATION_WORK.md:70; IX03/UI07/09/FN07/14. 다른 실제 도구 미실행을 이전 완료로 볼 수 없음 |
| IX05 미완료 | 실제 두 사용자/client 제어 인수·옛권한 차단·중복1회/모바일 | INTEGRATION_WORK.md:82; IX03/FN15/17·실기기/통신/보안 |
| IX06 미완료 | 전체백업→별도복원→단절재기동→대조재개→설치형 | INTEGRATION_WORK.md:90; IX04/FN16/18 |
| IX07 미완료 | IX01~06/TC01~15 실제 전체 기능과 사용자 확인 | INTEGRATION_WORK.md:99; 정확commit/image/DB/Agent/URL과 사용자 인수 |
| IX08 미완료 | Oracle의 정확 후보 정밀 검증·사용자 인수 | INTEGRATION_WORK.md:108; IX07/이전 승인·배포/rollback. 이전을 공개 운영 승인으로 해석하지 않음 |

## 승인·실증거와 다음 작업

1. UI00 M2의 실제 App control UNKNOWN→상단401→동일 주체 기존 세션 명시 재확인→원 packet 보존은 신규1/전체·최소인접17 PASS로 확인했다. 제품 RED/변경은 없고 암호 재인증·새 credential·실서버 증거는 아니다. 이것을 새 기능 구현 진도로 계산하지 않는다.
2. 현재 IX01 후보의 old source6123654b/SQL112를 최신 source/113SQL과 정합화하는 준비는 기존 계획 안이다. 기존 J3에 신규 격리 PG·내부망·합성인증/임시권한·실제 App 자식이 이미 포함됐다. SHA/개수/자원명 변경만으로 같은 효과의 재승인 경계를 만들지 말고 실제 효과 차이·정확 결박/기한을 대조한다. 실제 기존 자원/운영·native 등록키·외부 Agent·새 신뢰 영역이 필요하면 그 정확 차이만 별도로 결정받는다. 이 문서 자체가 실행 GO는 아니다.
3. FN07 새 관측 서명 목적 CLAUDE_EXECUTION_CONFIGURATION_OBSERVATION은 미채택 delta다. 실제 CREATE_CLAUDE_PROCESS·새 E/token·argv/env/비밀 실행과도 별도이며 다른 승인 소스 작업까지 일괄 중단하지 않는다.
4. FN06/08의 실제 도구 접점, FN09/12의 후속 계보, FN13/14 회수·복구/교체, FN16 전체복원/적용, FN17 비승인 사건/push, FN18 설치는 실제 기능 공백이다. 기존 승인 상세의 생산자→소비자→화면과 연결해 다음 허용단위를 구체화하고, 새 인증/키/외부 실행 의미만 정확히 분리한다.
5. 초기 ENVIRONMENT_READY나 과거 PG/Edge 검수는 해당 당시 범위를 보존한다. 현 protected PG 복구/새 통합 검수 완료로 상속하지 않는다. 반대로 과거 실제 증거를 전부 합성이라고 지우지도 않는다.

## 오래된 기록의 정정

- 카드의 ‘전부 시작 전’은 현 상태표가 아니다.
- FN13 옛 quota 부재 보고와 달리 정상 HTTP 저장은 현재 quota prepare/reserve/start/settle에 연결돼 있다.
- WORK_PLAN의 역사 ‘J3 미실행’ 문구와 달리 보존 결과는 실제 NETWORK/UNKNOWN·105개 진행이며 성공도 미실행도 아니다.
- 현재TC01 후보의 소스/프로필 차이 자체를 새 사람 승인 필수로 단정했던 이전 설명은 실제 효과 대조가 필요하다. 새 native profile 키가 TC01 정상 생성에 필수라는 근거는 이번 대조에서 확인되지 않았다.

읽기 감사는 시험·환경·자료 접근을 새로 수행하지 않았다. 각 항목의 상세 source/문서 근거는 기존 담당자 제출과 WORK_STATUS에 보존했다. 전체 완료 주장은 하지 않으며 Main이 다음 실행 가능한 업무를 계속 소유한다.
