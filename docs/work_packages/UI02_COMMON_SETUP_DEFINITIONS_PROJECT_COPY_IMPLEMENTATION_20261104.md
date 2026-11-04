# UI02 공통 도구·환경 선택과 프로젝트 사본 구현 작업지시서

담당: 기존 Primary 단독 writer / Main 어울 관리·검수·통합. 승인: 신산님 call_190a168be3ae4b5783502f5243c8e116의 r3 계약·source-only 구현 채택. 목표는 화면 입력→본인 공통 저장/조회→초안 선택 저장/재진입→생성 시 독립 사본/출처→보호 재조회까지 연결하는 하나의 업무 단위다.

정본 계약: docs/contracts/UI02_COMMON_SETUP_DEFINITIONS_PROJECT_COPY_CANDIDATE_20261104.md / SHA256 55759195fb6c8b4045ecc7a54b933d32f6551e677ae38a2c061034183456d747(18511B). 계약 파일 자체를 수정하지 않는다. 기준 branch codex/av3-stage-b, 시작 code/doc HEAD5dbd76e42bccf9dac5404f8367cabf454ea31ea8. 작업지시서/승인 반영 docs 게시 후 실제 시작 HEAD를 다시 기록한다. 기존 dirty 보호3와 Main docs를 건드리지 않는다. 기존 담당자를 재사용하며 새 agent/branch/worktree·Main 동시 code write0.

**적용 절차:** 구현 계획 작성·subagent-driven-development·TDD·독립 검수 절차를 기존 정본 WORK_STATUS와 이 카드에서 수행한다. 사용자 지정 위치/기존 담당자 우선으로 새 스킬 작업공간·새 세션·독자 ledger를 만들지 않는다. 단일 writer가 아래 A→B→C를 순서대로 수행하되 구간별 RED/GREEN/정확 지문을 Main에 반환한다. 구간 제출은 전체 완료가 아니며 Main은 전체 연결을 검수한다.

**구조:** 기존 USER_COMMON 인증/명령·불변 버전과 생성 transaction을 재사용하고 portable 원형·초안 선택·UNBOUND 사본을 별도 소유 경계로 연결한다. 실제 project 연결·권한·session은 복사하지 않는다.\n\n**기술:** 현재 React/TypeScript·Node/Fastify·기존 PostgreSQL producer/guard 패턴. 새 runtime 의존성·서비스·DB 실행 없음.\n\n**중점 검수:** 다른 owner/client·원형 저장 후 회수/개정 경쟁·생략 caller의 호환·사본/비용 실패 시 생성 전체 rollback·늦은 인증 오류/생성 성공 후 조회 실패를 각 A/B/C의 실패 검사로 입증한다.\n\n## 1. 불변 제한과 완료 증거

- 실제 DB 접속/SQL 적용·정식/일회 PG 생성·실제 정책/권한 부여·키/Secret·실자료 조사·기존 서비스·Agent·외부 비용·J3 QA·P03 R3 실행0. 새 0075는 .sql.pending 원문만 작성한다.
- 실제 ConnectionDefinition/EnvironmentVersion/HUMAN 등록/session/credential·정책을 복사하지 않는다. 새 사본은 UNBOUND이며 실행 권위 false다.
- 기존 미선택 caller의 payload/requestHash/replay·초안/생성·방법론·자료귀속·한도/권한검사는 보존한다. setupSelection 생략이면 신규 provider/quota/copy 호출0.
- 신규 공통 한도는 head1000/version10000/선택 포함 draft version10000/논리량 합계64MiB. 과거/회수/소비 이력 비용 산입·replay 추가0·COMMIT 불명0으로 회수 금지. 프로젝트 사본은 실제 canonical bytes·출처와 기존 used/held/역완결로 연결한다.
- 원형 개정/회수는 프로젝트 사본을 바꾸지 않는다. 저장→생성 사이 개정/회수/오염은 전체 생성 rollback·원초안 보존이다.
- 새 source 구축을 기존 자료 backfill/실행 또는 기존 프로젝트 차단 해제로 승격하지 않는다. 실 DB/화면/Agent 인수는 NOT_RUN이다.
- fake/합성 검사는 명령 handler·저장 adapter·source 검산·UI 상태 흐름을 실제 호출한다. mock PASS를 실제 PG/served browser 증거로 쓰지 않는다.

## 2. 허용 파일과 책임

신규:
- contracts/runtime/user-common-setup-v1.ts — exact portable TOOL/ENV schema·refs/slot/copy wire 타입/검산.
- apps/server/modules/user-common-setup/input.ts, cursor.ts, repository.ts, write.ts, storage.ts, routes.ts — 본인 입력/목록서명/불변조회·원형명령·개인 비용/물리 완결·공개 route. 새 이름 추가가 꼭 필요하면 Main에게 내부 영향만 먼저 전달한다.
- apps/server/modules/projects/draft-common-setup.ts, project-setup-copies.ts — 초안 원형/선택 잠금·생성 사본/출처·고정 조회/새 비용.
- db/migrations/0075_user_common_setup_definitions.sql.pending — 신규 schema/보호/producer와 필요한 forward 확장. 이전 SQL 원문 수정0.
- apps/web/src/features/project-create/common-setup-api.ts, common-setup-selection.ts, CommonSetupSelector.tsx, CommonSetupDefinitionEditor.tsx, ProjectSetupCopies.tsx — 사용자/초안 고정 문맥의 선택·작성·보호 조회와 실패 상태.

필요한 최소 수정만:
- apps/server/app.ts — 새 공통 읽기 route 등록.
- apps/server/modules/access/common-command.ts — 기존 USER_COMMON 두 operation/receipt 형식 호환.
- apps/server/modules/access/project-command.ts — 승인된 readProjectSetupCopy operation 및 기존 disposition 의미.
- apps/server/modules/access/repository.ts — 기존 서명 포트/typed project copy 보호 연결이 필요할 때만, 인증/세대/키 의미 변경0.
- apps/server/modules/methodologies/common-write.ts — 기존 단일 user-common commands schema/dispatcher에 두 연산만 연결. 기존 method/form/review 분기와 scope 보존.
- apps/server/modules/projects/routes.ts, repository.ts, draft-artifacts.ts, project-storage-quota.ts — 초안 optional selection·생성 단일 Tx·물리 사본/원장·한도·보호 GET/재조회.
- apps/web/src/features/project-create/api.ts, ProjectCreatePage.tsx, DraftWizardReview.ts — optional 선택 상태·중간저장/재진입·생성/receipt·3단계 실제 입력.
- apps/web/src/features/projects/api.ts, ProjectsPage.tsx 및 apps/web/src/App.tsx — 생성 후/다시 연 프로젝트의 승인된 사본 참조를 기존 project 상세 문맥으로 연결할 때 필요한 최소 접합만. 새 공개 목록 endpoint나 다른 개인 자료 노출 금지.
- apps/web/src/features/connections/policy-editor-profile.ts — readProjectSetupCopy의 기존 OWNER 정책 작성 경로. 표시 허용은 wire AUTO이며 ALLOW enum0. 실제 정책 부여0.
- tests/unit/FN01/common-setup-input.test.ts, common-setup-cursor.test.ts, common-setup-commands.test.ts, common-setup-schema.test.ts, draft-setup-selection.test.ts, project-setup-copies.test.ts.
- tests/unit/UI02/common-setup-api.test.ts, common-setup-selection.test.ts, common-setup-screen.test.ts.
- tests/integration/FN01/common-setup-synthetic.test.ts — 명시 합성 PoolClient/transaction·실 handler·UI 연결, 실제 DB import/연결/실행0.
- 기존 tests/unit/UI02/draft-api.test.ts, draft-wizard.test.ts, draft-wizard-screen.test.ts, draft-mutation-gate.test.ts와 tests/unit/FN01/draft-artifact-*.test.ts — 직접 영향 legacy 정상/음성 반례에 필요한 최소 추가만. 기대값/기준 완화0.

Main 소유: 승인 계약·이 WI·설계·WORK_PLAN/SCREEN_WORK/WORK_STATUS·결과서·Git commit/push. Primary는 변경하지 않는다. 허용 외 파일이 필요하면 정확 이유/기존 호출선을 제시하고 Main의 내부 allowlist 조정을 받은 뒤 진행한다. 독자 public operation/형식/상한·새 의존성 도입0.

## 3. A — 휴대 원형·본인 명령/조회·pending SQL

인터페이스: readCommonSetupDefinition(kind,definition), readSetupSelection(value), commonSetupHash(value); CommonSetupRepository의 list/version; writeCommonSetupDefinition(db,actor,request) / revokeCommonSetupDefinition(db,actor,request). 기존 USER_COMMON envelope가 대상/버전의 유일 권위다. 구체 내부 타입명은 위 책임 안에서 통일하되 공개 wire는 r3 그대로다.

- [ ] exact/유효 Unicode·중복 label·2MiB·비밀·outer/payload 주입·CAS·타인/만료·서명/다른client/cursor 30분·head/유일version·상한/원문 오염 음성의 신규 실패 검사를 먼저 작성하고 RED를 수거한다.
- [ ] schema/해시·immutable 원형·회수/ACTIVE head·idASC 현재 가시 keyset·본인 인증/client·원 requestHash/replay를 구현한다. 과거 원문/현재 사용 가능을 구분한다.
- [ ] USER_COMMON dispatcher/route를 실제 연결하고 예전 seven operation의 정상·분리 경계를 보존한다. 새 명령이 메모리 대역만의 독립 함수로 끝나지 않는다.
- [ ] 0075의 catalog heads/immutable versions·draft selection history·개인 비용/command/receipt/audit·project copies/출처와 보호 함수를 작성한다. table/column·증가분 charge projection은 상수/코드와 일치시킨다. 개인 lock→초안→정렬된 원형 heads→새 project/비용의 고정 잠금 순서를 사용한다.
- [ ] charge는 실제 server canonical 원문/원장행을 검산하고 caller count/bytes 신뢰0·역완결 누락이면 거절한다. 논리량과 물리 디스크 추정을 혼동하지 않는다.
- [ ] node --test tests/unit/FN01/common-setup-*.test.ts 를 실제 존재 파일 목록으로 실행·GREEN/타입·pending SQL 정적 관계 증거를 수거한다. 신규 모듈 부재 실패와 실제 행동 반례를 구분한다.

## 4. B — 초안→생성 사본의 원자적 저장/조회

- [ ] 선택 저장 뒤 원형 head 개정/회수·다른 owner·hash/kind 불일치·기존 선택 없음·중복 명령·사본 쓰기/비용 실패 rollback·COMMIT 불명·프로젝트 간 격리를 RED로 수거한다.
- [ ] optional 3slot 선택을 초안 version 저장/GET에 연결한다. 같은 원형을 두 TOOL 슬롯에서 선택할 수 있지만 각 slot 사본/출처를 정확히 만든다. 프로젝트/초안 소유 혼동0.
- [ ] 생성은 잠근 저장 초안만 읽고 source owner/kind/head/version/hash/ACTIVE를 재검산한 뒤 기존 생성 전체와 같은 Tx로 독립 UNBOUND 사본/ref·출처/비용을 보관한다. 원형 snapshot과 사본 원문·출처 검산, replay 추가0/불명 자동재전송0을 구현한다.
- [ ] 생성 응답의 setupCopyRefs를 현재 project 문맥에서 보존·재진입할 수 있게 연결한다. 생성 후 새로고침 때 ref를 잃어 사용자가 UUID를 재입력하는 기능으로 대체하지 않는다. 기존 project 상세의 보호/같은 ref projection을 재사용하되 추가 공개 endpoint/원 개인 목록 전용0. 필요한 응답 접합이 승인 범위 밖이라고 판단되면 Main에 정확 diff/대안을 제시한다.
- [ ] 고정 사본 GET·OWNER 정책 작성 경로/서버 op·AUTO/DENY·REQUIRE_APPROVAL 미지원/본문0을 연결한다. 정책 미설정은 원 refs/receipt를 보존하고 조회 준비 필요다. actual policy·권한 자동 부여0.
- [ ] 프로젝트 used/held·지속 reservation과 실제 사본 행/출처/receipt 역완결을 연결한다. 없는 provider를 임시 success callback으로 채우지 않는다.
- [ ] node --test tests/unit/FN01/draft-setup-selection.test.ts tests/unit/FN01/project-setup-copies.test.ts tests/integration/FN01/common-setup-synthetic.test.ts 로 실제 합성 producer/transaction/handler 소비선을 검증한다.

## 5. C — 화면 선택·편집·재진입·사본 조회

- [ ] 사용자/client/초안 전환·늦은401/403·재선택 전 stale·사용하지 않은 기존 생성 경로·입력 보존·선택해제·조회 실패/생성 성공 분리의 실제 컴포넌트/상태 반례를 RED로 수거한다.
- [ ] 3슬롯 selector·본인 목록/다음페이지·정확 원형 보기/선택·TOOL/ENV 작성/개정/회수 UI를 실제 ApiClient에 연결한다. 모델명/auto 원값 보존·명령/경로는 metadata이며 실행0이다.
- [ ] 기존 buffer에 optional selection·unsaved/초안 저장/재진입·최종 고정 review를 연결하고 source 원형 변경/회수를 자동 최신화/조용히 제거하지 않는다.
- [ ] 생성 후/재진입한 프로젝트의 setupCopyRefs→명시 사본 GET을 연결한다. 이전 project/사용자 결과 늦게 도착 시 대체0·사본 UNBOUND/조회 준비 필요·실연동 미검증을 정확히 표시한다.
- [ ] 기존 UI 표준·키보드 label/focus/페이지·오류 접근을 유지한다. placeholder/TODO/빈 callback/하드코딩된 catalogue로 완료 처리하지 않는다.
- [ ] node --test tests/unit/UI02/common-setup-*.test.ts 및 직접 영향 기존 UI02 핵심만 선택해 실행. SSR/순수 상태/합성 DOM 증거를 구분한다. 실 served/browser/DB 인수는 제외/미검증으로 남긴다.

## 6. Main 인계·검수·통합

- [ ] Primary는 각 A/B/C 구간의 파일·diff·정확 명령/exit·RED/GREEN·변경지문·오류 횟수·남은 연결을 짧게 제출한다. 모호한 성공 선언 대신 COMPLETED/INCOMPLETE/FAILURE_REPORT를 구분한다. commit/push0.
- [ ] root noEmit·필요 최소 build(가능하면 기존 memory write:false 경로)·direct regression·git diff --check를 수행한다. 기존 fixture/보안 기대값을 통과 목적으로 낮추지 않는다.
- [ ] Main은 r3와 source/SQL/실제 소비 경로·직접 fresh 검사를 독립 대조한다. Important/Critical은 동일 Primary가 보정하고 Main이 재검수한다. 동일 근본 원인 정식 실패3회에만 Main 인수 규칙 적용.
- [ ] Main이 WORK_STATUS/계획 상태·결과·정확 commit/private SHA를 기록한다. 일반 stage branch의 승인 source-only checkpoint만 게시, main/PR/merge/DB/서비스/Agent/J3/P03R3 실행0.
- [ ] 완료라 부를 범위는 이 source-only 업무 단위의 실제 연결/합성 증거뿐이다. 실제 DB 적용/브라우저/현환경·후속 FN06/FN09/전체 UI02·작업계획서 완료와 구분한다.
