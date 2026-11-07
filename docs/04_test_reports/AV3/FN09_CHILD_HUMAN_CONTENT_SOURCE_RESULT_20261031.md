# FN09 하위 HUMAN 내용검토·별도확정·과거조회 r2 A 소스 검수 결과

## 판정과 기준

승인된 source/UI·미적용 SQL·합성 검증 범위는 구현·검수했다. 전체 FN09·Stage C·WORK_PLAN 또는 실제 사용 인수 완료가 아니다. Main은 어울, 단일 구현자는 기존 developer-primary, 독립 검수는 기존 Reviewer다.

- 시작 branch/HEAD: codex/av3-stage-b / c8fa59eecf0aa50f916026fcf928de7169ac2735. 당시 local/private 동일, main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변, 보호3만 untracked였다.
- 직접승인: docs/work_packages/FN09_CHILD_HUMAN_CONTENT_SOURCE_DIRECT_APPROVAL_20261031.md / E49057622D68AD322766DD8C82659AC4BB3D6B395F1F571FA36A460EF960E602.
- WI: docs/work_packages/FN09_CHILD_HUMAN_CONTENT_IMPLEMENTATION_20261031.md / 59FA7762426B4EFA57C717245BF45316E361A86B9D1E5AAB2136306B542B1C12.
- 원 r1 51F71890EDCE8668676A39AFD5A1A76DA71C5BB3FC26A60452F8464B8617BEBB + r2 5880747B61C0D48C5D08F7F01CD8F43D6E6C30101CC73CB85485F623B5B0478D. 과거 미채택 표기는 이력이며 직접승인 binding이 현재 근거다.

## 변경 전·후와 영향

기존에는 child 초안의 HUMAN 내용검토·확정도 차단했다. 이제 기존 GET2/POST2만 HUMAN 전용 sibling을 선택해 검토→별도 확정→고정 원문 조회를 연결한다. 새 공개 endpoint/operation/table/DTO는 없다. 새 쓰기는 부모→child 잠금과 현재 부모·기준·부분집합을 검사하고, 과거 read/replay는 새 부모 head를 재적용하지 않으면서 원명령·내용행·receipt·audit를 검산한다. contentConfirmed는 내용 사실이며 실행 허가가 아니다.

UI04 child 내용패널은 직접 입력·명시 저장·보호 재조회 후 성공을 표시한다. 명확한 POST 거절은 원명령/입력을 보존한 명시 수정으로, 통신·응답 손상·저장 뒤 조회 실패는 불명으로 구분한다. child의 책임자·맥락·실행 준비 패널과 실행상세 이동은 마운트/호출하지 않는다. 기존 root reader/current/decision·일반 command/다른 의존 주입과 root 정상 흐름은 보존한다.

0061은 미적용 forward SQL이다. 내용 BEFORE trigger2만 전용 guard로 바꾸고 기존 0013 내용 guard·0034 원문과 root_reference/나머지 downstream10 차단을 보존한다. 실제 원내용 행에서 child와 operation을 분류해 JSON 변조 우회를 닫고, 원행/receipt/audit 양방향 완결을 검사한다. 무관 PROJECT/DRAFT 명령은 기존 범위를 유지한다.

## 실행한 검증

정확 Node는 C:/Program Files/nodejs/node.exe다. 다음 9파일을 node --test --test-reporter=tap으로 실행했다.

1. tests/unit/FN09/child-human-content.test.ts
2. tests/unit/UI04/child-human-content.test.ts
3. tests/unit/FN09/child-human-content-schema.test.ts
4. tests/unit/FN09/assignment-confirmation-input.test.ts
5. tests/unit/FN09/assignment-confirmation-store.test.ts
6. tests/unit/FN09/assignment-confirmation-web.test.ts
7. tests/unit/FN09/assignment-parent.test.ts
8. tests/unit/FN09/assignment-parent-original.test.ts
9. tests/unit/FN09/assignment-policy.test.ts

- Primary fdd724: 신규20(서버8/UI9/SQL정적3)+인접22 = 42 PASS, skip0, exit0, 1470.3563ms. type0. Writer 반환·실행 handle0.
- Main fresh 3dbdcc: 같은 9파일 42 PASS/0 FAIL/0 skip/0 todo, 1402.0232ms, exit0. 이어 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0.
- Main a78c5e: Vite build({configFile:'apps/web/vite.config.ts',envDir:false,build:{write:false}}) 484 modules/3 memory outputs, exit0. 실제 dist 쓰기0. 기존 impeccable detect --json UI2 결과[]/exit0. launcher가 보관 binary engine0.1.17과 pin0.1.18 차이를 경고했으며 binary 삭제/설치·설정 변경은 하지 않았다. 검출 결과를 실브라우저 검증으로 확대하지 않는다.
- git diff --check exit0. routes CRLF→LF 경고는 별도이며 Git 설정 변경0. Main이 새로 추가한 현황 앞부분 줄바꿈만 바로잡았다.
- Main9a502e: 최종10 지문과 보호3 일치, local/private control HEAD 동일·main 불변·등록 worktree 목록 대조. 다른 기존 worktree/dirty·역사 자료는 수정/삭제하지 않았다. 이번 결과는 branch-only이며 main 통합이 아니다.

## 독립 검수와 오류 처리

최종 source/UI/SQL 및 신규시험 읽기 검수 C0/I0. 다음 중요한 결함을 보완한 뒤 scoped 재검토했다.

- 최신 REWORK의 audit가 빠지면 INNER JOIN 목록에서 사라져 이전 ACCEPTED로 확정되는 문제: 실제 producer 반례0d53ed RED→원행 aggregate/cardinality 보완 d81534 GREEN. root 목록 원형은 보존.
- SQL raw result의 draftRef를 root로 바꿔 검산을 우회하는 문제와 연결된 operation 조기 반환: 실제 원행→보호 draft→expected operation/state 분류로 보완. 조기 반환 제거로 무관 DRAFT까지 막는 회귀는 분류표로 보완했다. state 단독 우회 가설은 기존 최종 guard가 닫을 수 있어 Reviewer가 철회했으며 확정 결함으로 계산하지 않는다.
- UI 명확 POST409/422를 모두 불명으로 처리해 수정을 막는 회귀: c355a7 RED→93e94c GREEN. 원입력·원명령 보존, 손상거절/성공 뒤 조회실패는 불명 유지.
- 닫기 뒤 늦은401, 실제 Workspace 패널 부재, sibling 부재 등 의미 있는 RED→GREEN를 별도로 수행했다.

Primary 교정 오류: craft-floor 추정 경로1, 타입 명령 config 생략1, fixture 내부/외부 command ID 혼동1, Vite virtual entry1, 정책/세션 fixture·미모델 INSERT1묶음, 신규 시험 타입1묶음, checkbox 선택자1, 편집 스크립트 const 재할당1. 중간34a30f 부분 실행은 최종 증거에서 제외했다. Main은 추정 parser/0013 filename 조회 오류 각1·sandbox Git context 오류1을 실제 목록/경로와 승인된 elevated 읽기로 교정했다. 정식 동일 FAILURE_REPORT 3회는 없으며 Main 코드 인수0이다.

## 미검증·제외·사용 확인

실제 DB/SQL 적용·권한/정책 부여·키/Secret·사용자 파일 조사·서비스·Agent 실행·기존 프로젝트 일반 차단 해제는 모두0이다. 별도 QA·listener·브라우저 프로세스 생성0이다.

서버는 실제 class/persist/정책·부모 현재성 코드를 메모리 원장으로 소비하되 부모 확정·계획·방법론은 대역이다. Fastify.inject는 실제 route/schema와 prototype spy의 연결 증거다. UI는 실제 React/API/decoder/native hash를 실행하지만 입력은 React onChange 직접 호출이며 native 브라우저 입력이 아니다. SQL3은 정적 구조와 별도 JS 분류표이며 실PG 문법/trigger/FK/DML·원자성/경합 증거가 아니다.

따라서 실제 개발 서비스에서 사용 가능한 기능으로 반영됐다고 주장하지 않는다. 향후 실제 환경 반영과 권한이 별도 승인된 뒤 UI04의 저장된 child 임무에서 사람 검토·별도 확정·과거 원문 조회를 확인해야 한다. 실행 준비/책임 세션/Agent 호출은 이 내용 확정으로 열리지 않는다.

rollback은 이번 소유 commit의 일반 revert이며 main/history rewrite·사용자 dirty 복원은 하지 않는다. SQL은 적용하지 않았으므로 DB rollback은 없다. WORK_STATUS/WORK_PLAN에는 부분 구현·미검증을 유지하며 다음 승인 범위 내 미완료 단위를 이어간다.

## 최종 소유10 지문
- apps/server/modules/access/project-command.ts / BF7919259818C3358FFB9216D8005E4DA782704632CAFAAB48D2D73792396886
- apps/server/modules/projects/routes.ts / CCFE3AB016C092E3050F9F5A73233280B64474300C00B8F7E924DDD0CE8CFF1E
- apps/server/modules/assignments/project-assignment-drafts.ts / 8ACD0D694B128CF30AA6020A94883B9FF299B87D539FB90DC29D4019E5BF031F
- apps/server/modules/assignments/project-assignment-confirmations.ts / CF590A5B1D413C3205B54D634D4925E0801CEE8C7B55CB6DF4E99EF6A6EEDCE2
- apps/web/src/features/workspace/WorkspaceAssignments.tsx / DF7206C03420BF3B920CCC6DF815EC7C0037E8B66879EC6DA79699497841F993
- apps/web/src/features/workspace/AssignmentContentDecision.tsx / 5823A952BF06F298F957AE2E907DC73F92C3CA1B18234ECEB3BF3DF29F4EB5E2
- tests/unit/FN09/child-human-content.test.ts / 2EE37C8EB7FB658065E97058C5AC8D1D0DDC2971451A3685678C4A72E4BADB5F
- tests/unit/UI04/child-human-content.test.ts / D55449BF8DAEC516111E94D18A01A41731B9A42E3FD989712D60A6456CD38381
- tests/unit/FN09/child-human-content-schema.test.ts / 802A530391729D97BF60C291F25788FA75223CC57B7CFE668D7A38A24BD96A6F
- db/migrations/0061_child_assignment_content.sql.pending / FEFF63CA4E0748721F89C5640E3E150AD6D0E0D1B01B0F58257242AFCE95C18B
