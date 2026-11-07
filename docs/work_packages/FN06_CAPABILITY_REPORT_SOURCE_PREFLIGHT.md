# FN06 HUMAN 능력 보고 보관 — 결정 전 읽기 preflight

상태: READ_ONLY_PREFLIGHT / NOT_ISSUED. 부모 r2 SHA6546808480650288302FB6AAF674AE35D7A72744E2C85A693D6BB13AA2E6B7F8의 정확 채택 전 제품/SQL/테스트 실행을 지시하지 않는다. 이 파일은 새 계약 승인·업무 발행·migration 예약이 아니다. 기존 질문을 복제하지 않는다.

## A. 정확 보관·고정 GET source

r2 §2~7/9를 소비할 후보 경로:

- 신규 apps/server/modules/connections/capability-report-input.ts
- 신규 apps/server/modules/connections/project-capability-reports.ts
- 기존 apps/server/modules/access/project-command.ts (신규 operation 허용목록만)
- 기존 apps/server/modules/projects/routes.ts (명시 분기/고정 GET/기존 dependency 주입)
- 신규 db/migrations/0043_capability_report_human_storage.sql.pending (빈 번호 후보이며 착수 전 재대조)
- 신규 tests/unit/FN06/capability-report-input.test.ts
- 신규 tests/unit/FN06/capability-report-store.test.ts
- 신규 tests/unit/FN06/capability-report-routes.test.ts
- 필요한 최소 fixture tests/unit/FN06/capability-report-fixture.ts

기존 ProjectConnectionCandidates 전용 repository/ArtifactStore 주입 패턴을 소비한다. 공통 command 흐름을 새로 고치지 않고 replay 전에 재인증한다. 신규 DTO/6능력/NUL·원주장 보존/서버 UNVERIFIED, fake transaction/부분 rollback·receipt/근거 양방향 대조, exact replay/충돌·재인증/제어/정책 회수, 과거 보존 GET/회원회수/무결성 실패를 직접 TDD한다. 인접 candidate-input과 기존 후보 GET/명령만 좁게 회귀한다. 실제 PG·SQL 적용·권한 검증은 제외다.

## B. UI11 작성·명시 저장·고정 조회 source

A의 확정된 DTO/응답 한정 검수 후 순차 배정할 후보 경로:

- 신규 apps/web/src/features/connections/capability-report-api.ts
- 신규 apps/web/src/features/connections/CapabilityReportPanel.tsx
- 기존 apps/web/src/features/connections/ConnectionsPage.tsx
- 기존 apps/web/src/App.tsx (현재 주체/프로젝트별 buffer·pending/uncertain 보존)
- 신규 tests/unit/UI11/capability-report-api.test.ts
- 신규 tests/browser/UI11/capability-report.spec.ts
- 신규 tests/browser/UI11/capability-report-harness.tsx

기존 listCandidates/readCandidate/documentControl/readCandidatePermissionPolicy/ApiClient를 소비하고 A의 타입만 type-only import한다. 기존 VersionRef를 재사용해 generated-types 수동 편집/새 codegen은 기본 범위 밖이다. policy-editor-profile과 실제 사용자 정책 생성은 제외한다. 다른 reader에 가짜 KnowledgeView를 만들어 전달하지 않는다.

정확 후보/6항목 작성→명시 저장→반환 ref 고정조회, 원주장과 서버판정 분리, 자동probe/POST/prepareExecution0, 응답유실·화면왕복·같은명령 확인·입력/주체/CSRF/세대/물리client·ABA/403/지연응답을 최소 단위·합성 DOM으로 확인한다. 브라우저 임시 자원은 Main이 literal 경로/소유/수명/정리 사전등록 후 실행·정리하고 실제 서비스 인수로 승격하지 않는다.

## 결정 전 보호·검수 경계

현재 inventory는 .pending 포함0042까지이며0043은 없다고 읽기 확인했다. 기존0008 복수 파일/0031 sql·pending/0037·0039~0042 pending 및 실제 적용 여부는 별개다. 0042 원문·자동 migration 등록·정식 manifest·실DB를 수정하지 않는다. 착수 전에 실제 목록을 다시 대조하고 번호 충돌이면 Main이 새 빈 번호만 결정한다.

현재 codewriter0·새QA0이다. A/B는 서로 독립 동시 writer가 아니라 선행/검수 경계가 있는 순차 위임 단위다. 각 단위는 새 implementer의 RED→GREEN·직접 인접/type/build·독립 검수 후 Main이 통합하며 최종 UI까지 연결되기 전 전체 기능을 완료로 표시하지 않는다. 실제 DB/서비스/정책·credential/probe/native/Agent/비용은 부모 후보에서 제외됐고 이 preflight로 열리지 않는다.
