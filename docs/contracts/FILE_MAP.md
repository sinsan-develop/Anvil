# P02 A안 파일 책임·검증 지도

## P03 초기 실제 생성 범위

공통 단일 package/lock와 `.gitattributes`로 시작한다. 별도 app별 dependency 복제를 만들지 않으며 서버 `config.ts`·`main.ts/app.ts`, 웹 index/main·vite/tsconfig, 공통 `canonical/catalog/generated-types/references`·refs schema와 타입 생성 script를 먼저 구현했다. 로그인·업무 UI/Agent는 해당 FN/UI에서 추가한다. 시험은 `tests/unit/P03/{config,database-config,health,web,resource-guards}.test.ts`·기존 공통 계약 시험·`tests/integration/P03/storage.test.ts`다.

자원 준비의 정확 소유 파일은 `scripts/{prepare-dev-https.ps1,provision-development.ts,development-resource-guards.ts,migrate-development.ts}`, `apps/server/storage/development-config.ts`, `db/migrations/0000_environment.sql`, `db/qa/fixtures.json`이다. 0000은 migration 이력·분리된 합성 QA 자료 저장만 하며 실제 사용자/프로젝트 schema를 대체하지 않는다. P03 setup/test와 FN01 실제 제품 저장을 혼동하지 않는다.

Windows의 새 app DB 보호 참조·소유 runtime 준비는 `scripts/link-development-db.ts`와 `scripts/start-development.ps1`, 승인 CA·엄격한 TLS의 단일 health 읽기는 `scripts/check-development-https.ts`에 둔다. 기존 Secret/사용자 프로필/공유 process를 다루지 않고 새 app 역할·포트3830/5546만 소비한다. receipt와 키/연결 설정은 Git 제외 `.av3-data` 안에서만 관리한다.

상태: **승인 A안의 상세 명세 / 제품 파일 미생성**. 2026-10-15 Main 어울. TD-01 승인 범위에서 TypeScript·React/Node/Fastify·Electron·PostgreSQL/파일의 책임을 고정한다. 이 문서는 파일 생성·설치·DB 변경·실제 Agent 호출 승인이 아니다. P03의 기준선/명령/환경 수용 후 해당 업무 시작 패킷에 정확한 파일을 열거한다.

## 1. 경로와 단일 writer

2026-10-16 구현 관측: Stage A/P03 source는 main PR41로 통합했다. Stage B/UI00은 §1의 App/shell/api/styles·시험을 작성 중이며 `apps/web/src/vite-env.d.ts`는 Vite CSS 타입 진입점, `tests/unit/UI00/routes.test.ts`는 경로 거절/프로젝트 유지 검수로 추가한다. FN01 access `service.ts`는 native Node Argon2id/세션 판정을 먼저 구현하며 실제 routes/repository·DB 연결 전에는 부분 구현이다. 아래 ‘파일 미생성’의 초기 상태를 현재 전체 사실로 해석하지 않는다.

동일 Stage B의 `scripts/start-development.ps1`은 실제 branch·LOCAL_UNCOMMITTED/COMMITTED_SOURCE를 receipt에 기록하도록 메타데이터를 보완한다. 기존 Stage A branch 상수는 Stage B 시작 시 틀린 값이 실제 출력됐고, 로컬 dirty Web build를 exact commit 검증으로 오인하지 않도록 하는 변경이다. 공통 port·CA·권한·DB 연결은 그대로다.

FN01 추가 관측: access `routes.ts/repository.ts/service.ts`와 0001의 실제 인증 저장을 연결 중이다. `tests/unit/FN01/auth-http.test.ts`는 DB 이전 Origin/무인증/추가필드 거절, 기존 auth-postgres는 실제 저장·cookie/CSRF·회수를 대조한다. 초기 적용 migration은 수정하지 않으며 후속 변경은 새 migration으로 한다. 실제 운영 계정/기존 인증 서버는 제외한다.

FN01 조회 연결의 정확 파일은 `apps/server/modules/projects/{routes,repository,service}.ts`, `tests/unit/FN01/project-list.test.ts`, `tests/integration/FN01/project-read.test.ts`다. 공통 인증 gate는 access repository의 서버 내부 `authenticated`를 사용하고 raw credential을 내보내지 않는다. 목록 cursor는 같은 보호 key의 용도 구분 HMAC만 소비하며 키를 새로 만들지 않는다. FN01 생성/방법론·기준선 연결 완료를 대신하지 않는다.

FN01 중간 저장의 실제 생성/중복·다른 client·stale·별도 연결 재조회 검사는 `tests/integration/FN01/draft-storage.test.ts`다. WSL의 기존 app 참조와 별도 기존 migrator 참조(`ANVIL_QA_CLEANUP_CONFIG`)를 읽되 비밀을 출력/복사하지 않는다. 이번 무작위 QA 소유자 삽입 성공을 추적한 뒤 그 초안/명령/감사만 정확 정리한다. 제품 app 감사 변경 금지와 실제 사용자/원본 보존은 유지한다.

UI00 실제 인증 연결의 추가 정확 파일은 `apps/web/src/shell/AuthForm.tsx`, `tests/browser/FN01/auth-live.spec.ts`다. 같은 auth route/storage·승인 CA·전용 개발 DB를 소비하는 실제 초기 등록/로그인 브라우저 검수이며 예시 화면 fixture와 구분한다.

공식 프로젝트 root는 `D:\Project\Anvil`이다. 아래는 그 상대 경로이며 경로 이동/변경은 영향 업무와 함께 기록한다. `{a,b}` 표기는 열거한 정확한 두 파일을 뜻하며 glob·하위 폴더 전체 권한이 아니다. 등록되지 않은 파일이 필요하면 Main이 이유/소유/소비자를 갱신한다. Backup·기존 자료·Secret·Git 메타데이터는 제품 writer 범위가 아니다.

| 공통 파일 | 소유·소비 |
|---|---|
| `package.json`, `package-lock.json`, `tsconfig.base.json`, `.gitignore` | P03 초기 설정. 이후 변경 업무의 명시 허가로만 수정 |
| `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html}` | P03 최소 실행, UI00 이후 공통 변경 조율 |
| `apps/web/src/{main.tsx,App.tsx}`, `apps/web/src/shell/{AppShell.tsx,routes.ts,StatusView.tsx}`, `apps/web/src/styles/{tokens.css,app.css}`, `apps/web/src/api/{client.ts,errors.ts}` | UI00. 다른 화면은 호출/사용만 하고 임의 수정하지 않음 |
| `apps/server/{package.json,tsconfig.json,app.ts,main.ts}`, `apps/server/http/{errors.ts,context.ts,register-routes.ts}` | P03 최소 실행, FN01/FN11이 실제 인증/권한 연결. health와 기능 성공 구별 |
| `contracts/common/{command.schema.json,event.schema.json,error.schema.json,page.schema.json,refs.schema.json}` | P02 명세, P03 코드 형태 확정 뒤 공통 계약 소유자만 수정 |
| `contracts/{catalog.ts,generated-types.ts}`, `scripts/generate-contract-types.ts` | P03의 schema 단일 원본→타입 생성·검증. generated-types는 수동 수정 금지. 생성 도구/버전은 lockfile과 COMMAND_MAP에 고정 |
| `db/migrations/README.md`, `apps/server/storage/{postgres.ts,blobs.ts,transactions.ts}` | FN01 초기 저장 연결, FN03 파일 저장·FN11 원자성 소비. 실제 migration/영속 자원은 별도 승인 대조 |
| `apps/connector/{package.json,tsconfig.json,main.ts}`, `apps/connector/transport/{client.ts,protocol.ts}` | P03 실행 틀만, FN06/08 실제 연결. 인증 등록 전 listener/Agent 시작 없음 |
| `apps/desktop/{package.json,tsconfig.json,main.ts,preload.ts,forge.config.ts}` | FN18. renderer는 web 공통 소스 사용, 별도 프로젝트 데이터 없음 |

JSON schema는 제품 개발자가 검토한 신뢰 계약만 등록한다. 사용자 방법론/문서 양식을 이 schema compiler의 실행 코드로 받지 않는다. 타입 생성 자체를 위한 별도 대형 도구는 만들지 않으며 P03에서 최소 도구를 선정한다.

## 2. 화면별 정확 파일

각 row의 page 파일과 `api.ts`는 해당 기능 폴더 안의 정확한 두 파일이다. 스타일 추가는 같은 폴더의 `style.css`를 명시한 경우만 허용한다. 공유 동작/계약을 복제하지 않는다.

| 업무 | 파일 | 소유 시험 파일 |
|---|---|---|
| UI00 | §1 shell·api·styles 파일 | `tests/browser/UI00/shell.spec.ts`, `tests/unit/UI00/api-client.test.ts` |
| UI01 | `apps/web/src/features/projects/{ProjectsPage.tsx,api.ts}` | `tests/browser/UI01/projects.spec.ts` |
| UI02 | `apps/web/src/features/project-create/{ProjectCreatePage.tsx,api.ts}` | `tests/browser/UI02/project-create.spec.ts` |
| UI03 | `apps/web/src/features/methodology-editor/{MethodologyEditorPage.tsx,api.ts}` | `tests/browser/UI03/methodology-editor.spec.ts` |
| UI04 | `apps/web/src/features/workspace/{WorkspacePage.tsx,api.ts}` | `tests/browser/UI04/workspace.spec.ts` |
| UI05 | `apps/web/src/features/session-detail/{SessionDetailPage.tsx,api.ts}` | `tests/browser/UI05/session-detail.spec.ts` |
| UI06 | `apps/web/src/features/design-trace/{DesignTracePage.tsx,api.ts}` | `tests/browser/UI06/design-trace.spec.ts` |
| UI07 | `apps/web/src/features/design-change/{DesignChangePage.tsx,api.ts}` | `tests/browser/UI07/design-change.spec.ts` |
| UI08 | `apps/web/src/features/decisions/{DecisionsPage.tsx,api.ts}` | `tests/browser/UI08/decisions.spec.ts` |
| UI09 | `apps/web/src/features/transfers/{TransfersPage.tsx,api.ts}` | `tests/browser/UI09/transfers.spec.ts` |
| UI10 | `apps/web/src/features/knowledge/{KnowledgePage.tsx,api.ts}` | `tests/browser/UI10/knowledge.spec.ts` |
| UI11 | `apps/web/src/features/connections/{ConnectionsPage.tsx,api.ts}` | `tests/browser/UI11/connections.spec.ts` |
| UI12 | `apps/web/src/features/control-handoff/{ControlHandoffPage.tsx,api.ts}` | `tests/browser/UI12/control-handoff.spec.ts` |
| UI13 | `apps/web/src/features/mobile/{MobileWorkspace.tsx,MobileTabs.tsx}` | `tests/browser/UI13/mobile.spec.ts` |
| UI14 | `apps/web/src/features/settings/{SettingsPage.tsx,api.ts}`, `apps/web/src/features/overview/OverviewPage.tsx` | `tests/browser/UI14/settings.spec.ts` |

UI13 소비 UI04/UI08의 반응형 조정, UI14 소비 scheduler·backup API처럼 다른 소유 파일의 실제 수정은 시작 패킷에 함께 열거한다. 위 표만으로 다른 업무 파일의 쓰기 권한을 얻지 않는다.

## 3. 기능별 서버·계약·시험 파일

UI02 초기 중간 저장은 기존 `features/project-create/{ProjectCreatePage.tsx,api.ts}`·`tests/browser/UI02/project-create.spec.ts`와 추가 `tests/unit/UI02/draft-api.test.ts`로 연결한다. App은 탭의 입력·미확인 command만 보존하고 실제 세션/권한은 서버에서 재확인한다. 완료된 UI00/01의 공유 App·새 프로젝트 진입·CSS 수정 이유는 중간 입력을 버리지 않고 같은 저장을 명시 재확인하기 위한 것이며 범위를 해당 소비부로 한정했다.

아래 ‘서버 모듈’의 정확한 공통 파일은 `apps/server/modules/<명칭>/{routes.ts,service.ts,repository.ts}`다. 행당 지정한 모듈만 해당하며 사용하지 않는 빈 repository/빈 함수를 형식상 만들지 않는다. 쿼리·명령의 타입/필수값·응답/오류 원본은 `contracts/<명칭>.schema.json`이며 함수명/실제 연산은 INTERFACES에 연결한다.

| 업무 | 서버 모듈·공통 schema 명칭 | 추가 정확 파일 | 소유 시험 파일 |
|---|---|---|---|
| FN01 | projects, access | `db/migrations/0001_projects_access.sql` | `tests/unit/FN01/projects.test.ts`, `tests/integration/FN01/projects-postgres.test.ts` |
| FN02 | methodologies | `db/migrations/0002_methodologies.sql`, `apps/server/modules/methodologies/builtins.ts` | `tests/unit/FN02/graph.test.ts`, `tests/integration/FN02/versions.test.ts` |
| FN02 내장·구조 검사 | `contracts/methodologies.ts`·기존 `apps/server/modules/methodologies/service.ts` | 승인 원문·공식 양식 ref로7단계·사람 확인·자료형 조건·유한 동일 실패 재작업 제공. 실제 실행/승인 binding·JSON schema/DB/API 미완료 | `tests/unit/FN02/builtins.test.ts`, 기존 graph.test.ts |
| FN02 내장 저장/조회 | 기존 methodologies `repository.ts`/`routes.ts`·추가 `catalog-seed.ts`·`app.ts`/`scripts/migrate-development.ts` | 계획0002 버전/범위 분리, 공식 원문 출처만 seed·사람 검토/확정 자동 생성0. 직접 쓰기 API/적용·cursor 미완료 | `tests/unit/FN02/api-access.test.ts`, `tests/integration/FN02/versions.test.ts` |
| FN02/FN11 본인 공통 쓰기 | `apps/server/modules/methodologies/common-write.ts`, `db/migrations/0011_user_common_control.sql`·기존 app/runner | 직접 승인한 USER_COMMON 명령·receipt·감사·소유자 guard, 내장본 복사/좌표 포함 불변 개정. 확정·양식 쓰기는 아직 미구현 | `tests/integration/FN02/common-write.test.ts`, 기존 api-access.test.ts |
| FN03/FN11 공통 양식 쓰기 | `apps/server/modules/documents/{common-write.ts,form-validation.ts}`, `apps/server/modules/access/common-command.ts`, `db/migrations/0011_user_common_forms.sql`·기존 공통 명령 route/runner | 본인 양식 복사/불변 개정·공식 원본 쓰기 차단·저장 기준 exact 참조. 공통 receipt는 내부 저장만 재사용, 확정/검토는 후속 | `tests/unit/FN03/custom-form.test.ts`, `tests/integration/FN03/common-form-write.test.ts`, 기존 방법론 쓰기 시험 |
| FN03/FN11 공통 양식 내용검토/확정 | `apps/server/modules/documents/content-review.ts`, `db/migrations/0011_user_common_content_reviews.sql`·기존 공통 명령/양식 repository | 본인 공통 exact ref·고정5기준·실제 검토자/동일 작성 주체 여부·append-only 검토와 별도 확정. 현재 FORM만 지원, 다른 도메인/할당 Agent 검토/실행은 미구현 | `tests/integration/FN03/form-review.test.ts` |
| UI03 본인 공통본 작성 연결 | `apps/web/src/features/methodology-editor/{CommonMethodEditor.tsx,common-api.ts}`·기존 MethodologyEditorPage/App | 복사·직접 초안·단계 목적/좌표·조건 개정·저장/정확 재조회. 입력/미확인 명령은 탭 메모리에 보존, 실제 Agent 시작0·전체 흐름도 편집/확정 미완료 | `tests/unit/FN02/common-client.test.ts`, 기존 methodology-editor.spec.ts |
| UI03 공간형/단계·연결·문서 편집 | `apps/web/src/features/methodology-editor/{MethodGraphCanvas.tsx,NodeDefinitionFields.tsx,NodeDocumentFields.tsx,GraphRelationsEditor.tsx,ConditionEditor.tsx}`·기존 편집/App 상태·scoped CSS | SVG 선택/확대/좌표·기본/복합 판단 자료·입출력 양식 exact ref·사람/도구 역할/합류·유한 재작업 정의. Agent 실행·권한·정책 허가 아님 | 기존 methodology-editor.spec.ts·FN02 graph.test.ts/common-write.test.ts |
| UI03 본인 공통 양식 편집 | `apps/web/src/features/methodologies/{CommonFormEditor.tsx,form-editor-state.ts}`·기존 FormsCatalog/forms-api/App·공통 명령 client | 공식본 복사·새 양식·역할/목차/필수·반복 필드·작성/검토 기준 개정·초안 저장/정확 재조회. SYSTEM 읽기 기준은 유지·USER_COMMON 미완성 초안만 별도 조회 | 기존 forms.spec.ts·`tests/unit/FN03/form-draft-client.test.ts` |
| UI03 본인 양식 검토/확정 | `apps/web/src/features/methodologies/FormReviewPanel.tsx`·기존 FormBuffer/FormsCatalog/forms-api/공통 명령 client | 5개 기준의 사람 직접 판단/이유·별도 확정·정확 재조회, 작성 기록자 동일 여부 공개·입력/미확인 명령 보존. 실제 시험/독립 검수/실행 승인으로 승격0 | 기존 forms.spec.ts·form-draft-client.test.ts |
| FN02 계약15.3 정정 | `db/migrations/0002_builtin_condition_contract.sql`·기존 builtin/service/types/seed/runner | 구형 v1 원본은 보존하고 fieldRef/operator/value·all/any/not 조건의 v2 추가. 실제 v1 사용/확정이 있으면 head 변경 전 실패 | 기존 FN02 graph/builtins/versions 및 UI03 조회 시험 |
| FN03 | documents, imports | `db/migrations/0003_documents.sql`, `apps/server/modules/documents/forms.ts` | `tests/unit/FN03/forms-import.test.ts`, `tests/integration/FN03/documents.test.ts` |
| FN03 초기 catalog 연결 | `apps/server/modules/documents/{repository.ts,routes.ts,catalog-seed.ts}`·기존 `apps/server/app.ts`/`scripts/migrate-development.ts` | 승인 원문 기반8종/공통 작성 기준 고정 버전, 계획0003 catalog부터 forward-only 적용·후속 문서 저장은 별도 migration | `tests/unit/FN03/form-access.test.ts`, `tests/integration/FN03/forms-catalog.test.ts` |
| UI03 초기 catalog 연결 | `apps/web/src/features/methodologies/{FormsCatalog.tsx,forms-api.ts}`·기존 `App.tsx`/`styles/app.css` | 전역 방법론의 공식 양식 조회·원문/필수 항목·정확 ref 검증, 공유 변경은 경로 분기/읽기 스타일에 한정. 방법론/문서 작성 전체 완료 아님 | `tests/browser/UI03/forms.spec.ts` |
| FN04 | traceability, design_changes | `db/migrations/0004_trace_changes.sql` | `tests/unit/FN04/impact.test.ts`, `tests/integration/FN04/trace.test.ts` |
| FN05 | knowledge, constitution, context | `db/migrations/0005_knowledge.sql` | `tests/unit/FN05/context.test.ts`, `tests/integration/FN05/knowledge.test.ts` |
| FN06 | connections, environments | `apps/connector/adapters/{adapter.ts,codex.ts}`, `db/migrations/0006_connections.sql` | `tests/unit/FN06/adapter.test.ts`, `tests/integration/FN06/codex-live.test.ts` |
| FN07 | FN06 공통 schema 소비 | `apps/connector/adapters/claude.ts` | `tests/unit/FN07/adapter.test.ts`, `tests/integration/FN07/claude-live.test.ts` |
| FN08 | executions | `apps/connector/runtime/{dispatch.ts,ownership.ts}`, `apps/connector/spool/{store.ts,sync.ts}`, `apps/connector/observers/facts.ts`, `db/migrations/0008_executions.sql` | `tests/unit/FN08/spool.test.ts`, `tests/integration/FN08/dispatch-recovery.test.ts` |
| FN09 | assignments, coordinator, understanding | `db/migrations/0009_assignments.sql` | `tests/unit/FN09/assignment.test.ts`, `tests/integration/FN09/bindings.test.ts` |
| FN10 | scheduling, quotas | `db/migrations/0010_scheduling.sql` | `tests/unit/FN10/scheduler.test.ts`, `tests/integration/FN10/queue.test.ts` |
| FN11 | policies, approvals, command_authorization, audit | `db/migrations/0011_authorization.sql`, `apps/server/http/authorize.ts` | `tests/unit/FN11/policy.test.ts`, `tests/integration/FN11/approval-race.test.ts` |
| FN12 | results, verification, issues | `db/migrations/0012_results.sql` | `tests/unit/FN12/verification.test.ts`, `tests/integration/FN12/results.test.ts` |
| FN13 | recovery, checkpoints | `apps/connector/stopping/{stop.ts,reconcile.ts}`, `db/migrations/0013_checkpoints.sql` | `tests/unit/FN13/stopping.test.ts`, `tests/integration/FN13/recovery.test.ts` |
| FN14 | transfers, handoff_bundles | `db/migrations/0014_transfers.sql` | `tests/unit/FN14/transfer.test.ts`, `tests/integration/FN14/handoff.test.ts` |
| FN15 | control_handoffs, client_ownership | `db/migrations/0015_control.sql` | `tests/unit/FN15/control.test.ts`, `tests/integration/FN15/control-race.test.ts` |
| FN16 | backups, exports, restore_validation | `db/migrations/0016_backups.sql` | `tests/unit/FN16/manifest.test.ts`, `tests/integration/FN16/restore.test.ts` |
| FN17 | notifications | `apps/web/src/notifications/{support.ts,client.ts}`, `db/migrations/0017_notifications.sql` | `tests/unit/FN17/notifications.test.ts`, `tests/integration/FN17/delivery.test.ts` |
| FN18 | FN08/FN15/FN16 소비 | §1 desktop 파일, `apps/desktop/{security.ts,lifecycle.ts}` | `tests/desktop/lifecycle.spec.ts`, `tests/desktop/package.spec.ts` |

이름의 migration 번호는 파일 식별자이고 실행 순서/업무 순서가 아니다. Stage B에서 FN11을 먼저 개발하더라도 미구현 FN06~10 migration을 만들어 채우거나 번호순 개발을 강요하지 않는다. 실제 migration runner·schema 의존 DAG·checksum과 적용 순서는 P03/저장 업무에서 확정하며 이미 적용된 파일은 고치지 않는다. migration 내용/실제 적용은 승인된 데이터 계약과 별도 실행 경계를 대조한다.

첫/둘째 어댑터 파일명은 현 후보를 명시한다. 공급자 지원·인증 계약이 충족되지 않으면 허위 구현 대신 CAPABILITIES에 미확인을 남기고 대체 결정을 기록한다. Windows Job Objects·Secret 보호의 실제 binding/helper 파일은 검증 경로 선정 전 임의 추가하지 않는다. 정확 helper/bridge/검수 파일은 §9·TECH_DECISIONS §11에 추가했으며 실제 동작은 미검증이다.

## 4. 통합·산출물·검수 소유

IX01~IX08 각각 `tests/integration/<ID>/journey.test.ts`, `tests/browser/<ID>/journey.spec.ts`를 소유한다. IX06/FN18의 desktop 검사는 위 desktop 파일을 소비한다. 공통 `tests/helpers/{qa.ts,server.ts}`·최소 시험 설정은 P03 소유, 확장은 실제 소비 업무가 이유/영향을 기록한다. fixture/단위/실제 DB/실제 Agent/브라우저 검사를 분리하고 live 미연결을 통과로 바꾸지 않는다.

공식 결과 위치는 `docs/04_test_reports/AV3/<ID>/{RESULT.md,manifest.json}`다. 실제 코드/파일diff·명령/exit·QA ID·환경/버전·미실행·정리·rollback을 포함한다. 전체 진도는 WORK_STATUS 하나에 누적하고 업무별 보고와 링크한다. 문서 존재만으로 완료를 세지 않는다.

## 5. 미확정 경계

외부 검토 보완으로 FN01의 access 모듈이 사용자 인증·참여 권한·최초 client/control 저장을, FN11 audit 모듈이 공통 허가/거절·결정/소비 감사를 소유한다. FN15 client_ownership은 이 기반의 전환 연산을 소비하며 별도 초기 제어 저장소를 중복 생성하지 않는다. 구체 인증/키·실행기 등록 방식은 INTERFACES §11~12·TECH_DECISIONS §11~12에 연결했고 실제 사용자 설정은 아직 없다.

현재 제품 파일은 생성하지 않았다. 인증/등록·OS binding·DB/보존/단절의 상세 기준은 §6~10·연결 계약을 따르고, 실제 OS/DB/Agent 검증과 P03 경로/port·패키지 lock·명령표는 별도 수행한다. FILE_MAP이 존재한다고 P02/P03 완료로 판정하지 않는다. `routes/service/repository`가 필요 없는 계산 전용 모듈은 실제 시작 패킷에서 파일을 줄이고 이유를 남기며, 관련 없는 공통화/리팩토링을 추가하지 않는다.

## 6. P02 재개 — 초기 저장 흐름의 명세 소비 위치

2026-10-16. 완료한 P01/지원 조사를 반복하지 않고 INTERFACES §9·DATA_MODEL §6을 추가했다. 아래는 기존 파일 목록에 대한 상세 소비 위치이며 제품 파일 생성·SQL 적용은 하지 않았다. 인증/정책/등록·나머지 연산의 잔여를 해소한 뒤 배정한다.

| 소유 | 명세·후속 정확 파일 | 검수 책임 |
|---|---|---|
| FN01 | INTERFACES §9.1~2/§11·DATA_MODEL §6.1~2/§8, `contracts/projects.schema.json`, `contracts/access.schema.json`, `db/migrations/0001_projects_access.sql` | UI01/02 초안·생성·기준선·TD-02 전용 로그인 상세, 프로젝트/초안 격리·재시작 재조회. 실제 보안/DB 시험은 미실행 |
| FN02 | INTERFACES §9.3·DATA_MODEL §6.3, `contracts/methodologies.schema.json`, `db/migrations/0002_methodologies.sql`, 기존 builtins.ts | 승인 내장3종·사용자 공통/전용·복사·버전 고정·graph/좌표/문서·확정/적용 경계 |
| FN03 | INTERFACES §9.4·DATA_MODEL §6.4, `contracts/documents.schema.json`, `contracts/imports.schema.json`, `db/migrations/0003_documents.sql`, 기존 forms.ts·blobs.ts | 공식8종·헌법 별도 문서·사용자 양식·원본/추출·본문/제안/이전 버전. 파일/DB 실패·안전 렌더·타 프로젝트 참조 거절 |
| FN11 | INTERFACES §9.1·DATA_MODEL §6.5, `contracts/command_authorization.schema.json`, `db/migrations/0011_authorization.sql`, 기존 authorize.ts | 공통 command/버전/제어/권한 집행과 저장/감사 원자성. 이번 상세를 실제 구현/검수로 세지 않음 |

형태화된 schema와 SQL은 후속 구현 산출물이다. 현재 Markdown 명세를 기존 제품 schema가 존재하는 것으로 계산하지 않는다. `contracts/<명칭>.schema.json`이 schema의 실제 파일 명칭이고, 업무 카드의 `contracts/documents/` 같은 폴더 표현은 논리 책임 범위였음을 구별한다. 문서만으로 해당 폴더/파일을 일괄 생성하지 않는다.

## 7. P02 후속 코어 — 승인·계획/추적·원문/맥락

FN01 초안/프로젝트가 소비하는 FN11 저장 기반의 정확 신규 검사 파일은 `tests/integration/FN11/authorization-schema.test.ts`다. 실제 0011 테이블·append 감사 DML 제한을 검수하며 schema 존재만으로 권한/승인 집행이나 전체 FN11 완료로 표시하지 않는다.

INTERFACES §10·DATA_MODEL §7은 다음 기존 소유 모듈을 소비한다. FN04의 작업계획 저장/확정은 traceability 모듈의 `service.ts/repository.ts` 안의 별도 연산이고 범용 프로젝트 관리 subsystem을 새로 만들지 않는다. 추가된 공개 operation 명칭은 기존 요구의 누락 보완이며 실제 API 호환성 변경/배포가 아니다.

| 소유 | 실제 schema·migration 참조 | 실제 구현 뒤 필요한 검수 |
|---|---|---|
| FN11 | `contracts/{policies,approvals,command_authorization,audit}.schema.json`, `db/migrations/0011_authorization.sql`, `apps/server/http/authorize.ts` | 요청/결정/소비 분리·동시 결정/소비·현재 정책/권한/세대·본문 hash·한 명령·거절 부작용0, 감사 실패·권한 없는 변경 차단 |
| FN04 | `contracts/{traceability,design_changes}.schema.json`, `db/migrations/0004_trace_changes.sql`, traceability/design_changes 모듈3파일씩 | 설계/화면 위치↔업무/시험·AF04 card·두 선행·초안/확정·영향/UNKNOWN·승인/계획 적용·과거 근거/무관 작업 유지 |
| FN05 | `contracts/{knowledge,constitution,context}.schema.json`, `db/migrations/0005_knowledge.sql`, knowledge/constitution/context 모듈3파일씩 | 원문·가설/결정/이유·정정/사용제외/공유 승인·project 검색 격리·manifest·누락 공개·서버 조회/후속 전달·6항목 이해/검토 주체 |

시험 파일은 §3의 각 FN 소유 목록을 유지한다. FN05의 실제 외부 전달/이해와 FN04 변경 중 writer 안전은 FN09/14/FN08/13의 실제 연동 뒤 검수하며, 원문/계획 저장·재조회·권한/중복 기본 검수를 그때까지 미루지 않는다. 시작 패킷은 공통 schema/서버 HTTP/storage를 함께 수정해야 하는 경우 그 정확 파일·이유·writer 순서를 열거한다.

## 8. TD-02 전용 로그인 상세 소비

Stage B 정확 추가 파일: `apps/server/modules/access/config.ts`(실행 보호 참조 검증), `setup.ts`(독립 비밀·배타 파일 생성), `scripts/initialize-development-auth.ts`(직접 승인된 신규 개발 초기화만), `tests/unit/FN01/{auth-config,auth-initialization,auth-http}.test.ts`. 실제 초기화는 기존 보호 root·새 두 파일·초기화 행1을 대조하며 기존 자료 덮어쓰기·실제 소유자 자동 생성은 없다.

UI00 인증 후속은 `apps/web/src/shell/AccountSecurity.tsx`·기존 `AuthForm.tsx/App.tsx/api/client.ts`와 `tests/browser/UI00/auth-security.spec.ts`다. 설정 화면의 로그인 보안만 연결하며 UI14의 백업/한도 기능 완료를 뜻하지 않는다.

FN01의 기존 access 모듈 `routes.ts/service.ts/repository.ts`와 `contracts/access.schema.json`이 INTERFACES §11/DATA_MODEL §8을 소유한다. 암호/세션/CSRF·초기 claim 분리는 `apps/server/modules/access/{passwords.ts,sessions.ts,csrf.ts,setup.ts}`로 명시하며 범용 인증 서버를 추가하지 않는다. 공통 Context/authorize는 FN11과 단일 writer 순서로 결박한다. 실제 파일/라이브러리는 P03/업무 배정 뒤 생성한다.

추가 정확 시험 파일은 `tests/unit/FN01/auth.test.ts`, `tests/integration/FN01/auth-postgres.test.ts`다. UI00의 로그인/만료/재인증 표시는 기존 shell/StatusView 경계를 소비하고 보호/복구·초대의 실제 화면 위치는 P01 기준에 맞춘 상태/양식으로 상세 배정한다. 별도 OIDC·외부 발송 서비스·비용·실제 계정/키를 이번 선택으로 생성하지 않는다.

## 9. 연결·실행/회수 명세 소비

INTERFACES §12·DATA_MODEL §9는 FN06/07/08/13의 기존 modules/schema·Windows adapter/runtime/spool/observer/stopping 파일과 §3의 시험 파일을 소비한다. 서버 실행기 endpoint의 소유는 connections 모듈의 등록/credential 검사와 executions 모듈의 command/receipt/observation 집행으로 구별한다. 별도 공개 PC listener·원격 SSH 실행 subsystem을 만들지 않는다.

정확 추가 데이터 계약 파일은 `contracts/connector.schema.json`, `contracts/agent-adapter.schema.json`, `contracts/source-snapshot.schema.json`이며 FN06이 초기 소유하고 FN08/13이 Main 대조 후 확장한다. 서버측 credential 검사 helper는 `apps/server/http/connector-auth.ts`, 실행기 보호 저장소 인터페이스는 `apps/connector/security/secret-store.ts`다. OS 경로 상세안은 TECH_DECISIONS §11의 `apps/connector/native/{OwnershipHost.cs,ProtectedStore.cs}`, `apps/connector/runtime/windows-host.ts`, `scripts/build-windows-helper.ps1`다. FN08/13 소유/회수와 FN06 보호 저장이 단일 writer로 소비하며 `tests/unit/FN08/windows-host.test.ts`, `tests/integration/FN08/windows-ownership.test.ts`, `tests/unit/FN06/protected-store.test.ts`를 추가 검수한다. 아직 파일 생성/build/검증은 없으며 그 상태에서 변경 역할 READY를 허용하지 않는다.

등록/credential/범위·세대/ACK·관측의 제한된 계약 테스트는 기존 adapter/spool/dispatch-recovery 시험을 확장한다. 실제 도구의 승인·거부/한도·중지/회수·파일/exit·스풀 재연결은 FN06/07/08/13과 IX02~04의 실제 근거로만 판정한다. CAPABILITIES의 후보를 새 지원 확정/실측 기록으로 덮지 않는다.

## 10. 나머지 실행/이전·복구 계약과 공통 codec

INTERFACES §13~14·DATA_MODEL §10은 §3의 FN09~18 모듈·schema/migration/단위·통합/desktop 시험 목록에 그대로 배정한다. 부분 변경 보존/범위 복원은 recovery 모듈·실행기 stopping/runtime의 정확 허가 파일만 사용하고 범용 Git 조작 subsystem을 추가하지 않는다. task/기준/실행·검수/이전의 새 ID/상태는 같은 project 참조 resolver와 원자 command 집행을 소비한다.

공통 정규화/hash/참조 코드는 `contracts/{canonical.ts,references.ts}`와 `tests/unit/contracts/{canonical.test.ts,references.test.ts}`로 명시한다. JSON 객체 키를 정렬·배열 순서 유지·UTF-8/문자열 유효성·중복 키/비유한 수/지원 범위 밖 정수/unknown 필드를 거절하는 고정 wire 규칙을 서버가 적용한다. 비밀 auth 요청은 일반 codec 영속 경로에 넣지 않는다. helper는 서명할 canonical byte를 받으므로 다른 serializer가 조용히 다른 hash를 만들지 않게 벡터로 확인한다. 실제 코드/형식화된 schema는 아직 생성하지 않았다.

빠진 FN/UI 필드나 명칭을 과거 보관 코드에서 추측하지 않는다. 기존 schema 명칭 목록·새 정확 파일과 UI15/FN18 소비를 P02 종료 대조표에서 확인하고, 실제 검증 명령은 P03 COMMAND_MAP에 결박한다. OS helper/file store·형식별 parser/보호 렌더·라이브러리/lockfile 미확인은 해당 단계 전 해소하고 미검증을 숨기지 않는다.

생성 전 방법론 초안/검토는 projects/methodologies의 기존 routes/service/repository가 DRAFT scope를 명시해 처리하며 일반 프로젝트 dispatch를 노출하지 않는다. 공통 내용 검토의 데이터 계약 파일은 `contracts/content-review.schema.json`, 저장/감사는 기존 FN11 audit 모듈·0011 migration이다. 종류별 검토/확정 조건은 해당 domain service의 책임이며 새 범용 판정 엔진을 만들지 않는다. 생성/검토 누락 대조는 `tests/unit/FN02/draft-methodology.test.ts`, `tests/integration/FN01/draft-create.test.ts`, `tests/unit/FN11/content-review.test.ts`를 추가해 초안 stale·교차 소유·위조/자기 검토·원자 생성/원문 보존을 확인한다.

독립 P02 검토의 최초 소스 선언은 FN01 projects service/repository·0001·projects.schema, 문서 링크/관측 선택·구버전 제목/출처 보존은 FN03 documents service/repository·0003·documents.schema가 소유한다. 추가 시험 파일은 `tests/unit/FN01/source-declaration.test.ts`와 `tests/integration/FN03/source-links.test.ts`다. 초안 소유/귀속·실관측 없는 VERIFIED 거절, 링크 stale/경로 이탈·타 project 거절, 서버 유지/제안 수집/별도 분리·기존 확정본 불변, 제목/출처 개정 후 구버전 내용/hash 유지를 검수한다. 실제 소스 관측은 FN08 실행기 결과를 사용하고 문서·저장 시험의 fixture를 실제 호스트 검증으로 승격하지 않는다.

방법론 검토 구현: `apps/server/modules/methodologies/content-review.ts`, `db/migrations/0011_user_common_method_reviews.sql`, `apps/web/src/features/methodology-editor/MethodReviewPanel.tsx`, `tests/integration/FN02/method-review.test.ts`. 기존 FORM 보호의 forward 보완만 포함하며 기존 적용 migration 수정0.

방법론 읽기 페이지의 순수 필터/cursor는 `apps/server/modules/methodologies/list-page.ts`, 단위 증거는 `tests/unit/FN02/list-page.test.ts`, 실제 순회/격리는 기존 `tests/integration/FN02/versions.test.ts`에 둔다. 변경은 기존 목록 repository/routes와 UI03/생성 선택의 명시 읽기에 한정하며 schema/권한·새 도메인을 만들지 않는다.

프로젝트 초안 선택: `contracts/project-drafts.ts`의 자료형, `apps/server/modules/projects/draft-methodology.ts`의 owner/출처·확정/버전 검사, `apps/web/src/features/project-create/MethodologySelection.tsx`의 고정 버전 선택을 기존 초안 writer와 연결한다. 생성/초안 검토·확정은 아래 후속 연결을 따르며 파일 존재만을 전체 완료 근거로 쓰지 않는다.

프로젝트 전용 방법론 입력은 `apps/web/src/features/project-create/DraftMethodEditor.tsx`가 기존 UI03의 그래프/단계·입출력/조건 편집 부품을 소비하고 기존 초안 저장으로 보존한다. 공통본 writer를 호출하지 않는다. GET 기반 원본 복사는 같은 디렉터리 MethodologySelection이 정확 sourceRef를 남기며 명시 저장 전에는 서버를 쓰지 않는다.

2026-10-16 직접 승인 후속: `apps/server/modules/projects/draft-review.ts`가 현재 owner/client·exact draft ref의 recordContentReview/confirmDraftMethodology를, 기존 repository/routes가 최초 createProject를 처리한다. `db/migrations/0011_project_creation.sql`→`0011_draft_method_reviews.sql`은 기존10개 뒤의 forward DAG다. 첫 PROJECT 원본/고정 snapshot·owner/control1·명령/receipt/audit는 같은 transaction, 후속 PROJECT 개정·실행 허가는 별도다. UI는 `features/project-create/DraftReviewPanel.tsx`·기존 page/api·root buffer이며 `tests/integration/FN01/draft-create.test.ts`, `tests/browser/UI02/project-finalize.spec.ts`, `tests/unit/UI02/finalize-api.test.ts`가 실제/합성 경계를 나눠 확인한다. 문서 import/기존 소스/실제 UI DB/Agent는 이 연결의 완료 범위가 아니다.
