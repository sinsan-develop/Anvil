# Anvil v3 기능 단위 업무 카드

상위 계약: [작업계획서 r7](../WORK_PLAN.md), [설계 r8](../design/Anvil_설계서_v3_초안.md). 2026-10-16 본문 통합에 맞춰 관련 카드의 구현·검수 조건을 보완했다. 모든 카드는 공통 시작·RED/GREEN·QA·rollback·결과/검수 계약을 상속한다. 상태는 전부 시작 전이다. 설계의 F번호와 이 문서의 FN번호는 다른 ID이며 각 카드의 설계 추적을 따른다.

## 0. 인터페이스·파일·검증 사용 규칙

아래 연산명은 **서버/실행기 업무 계약의 논리적 이름**이다. P02는 이를 실제 endpoint/함수·request/response schema·오류와 정확 파일에 일대일 연결해 `docs/contracts/INTERFACES.md`, `FILE_MAP.md`에 고정한다. 언어·SDK 미확정 상태에서 가상의 구현 명령을 실제 명령으로 쓰지 않는다. P03의 `COMMAND_MAP.md`에 업무별 실행 명령·기대 결과·환경을 고정하고 담당자는 실제 명령/결과를 제출한다.

공통 변경 입력 `CommandContext`: projectId, actorId, clientId, commandId, expectedVersion, controlGeneration. 실행 요청에는 assignmentId, executionGeneration, writeScope를 더한다. 서버가 실제 인증·권한과 대조하며 client 입력만 믿지 않는다. 결과는 operationId, version, status, evidenceRefs 또는 코드/원인/해결할 항목을 돌려준다. 같은 commandId의 동일 요청은 기존 결과, 다른 payload는 충돌이다.

읽기는 projectId·허가 범위·페이지/cursor를 검사한다. 표준 오류는 `ACCESS_DENIED`, `VERSION_CONFLICT`, `INPUT_INVALID`, `PRECONDITION_FAILED`, `CAPABILITY_UNVERIFIED`, `APPROVAL_REQUIRED`, `EXECUTION_UNKNOWN`, `STORAGE_FAILED`를 구분한다. 통신 오류를 업무 실패/성공으로 둔갑시키지 않는다.

카드의 ‘파일 범위’는 책임 폴더다. **배정 전 실제 파일 목록을 시작 패킷에 확정**한다. 공통 schema/migration 수정은 Main의 계약 소유권 대조 후 같은 업무에 포함한다. 관련 시험은 `tests/unit/<업무ID>/`, `tests/integration/<업무ID>/`에 귀속시키고 actual 파일명은 FILE_MAP에 둔다.

## FN01 프로젝트 원본·접근·시작 기준선

- **인증·제어 기반 책임:** Anvil 사용자 로그인/로그아웃·세션 만료/회수·프로젝트 소유자/참여자 조회/변경의 서버 확인, client 식별·최초 활성 제어 세대 저장을 포함한다. 구체 인증/초기 등록은 P02 계약을 따른다. 조회자는 변경 불가, 최초 제어와 나중 사람/기기 인계(FN15)를 구별한다. 제어 전환 미구현을 다중 변경 허용으로 우회하지 않는다. 로그인·소유/참여 API의 무권한/만료·세션 재사용과 프로젝트 격리를 기본 검증한다.

- **왜/설계:** 프로젝트가 외부 Agent 계정에 종속되지 않는 기본 원본을 만든다. 설계 §2,3,9.3,10; S01,S02, AV3-TC01,13,14.
- **선행/입력:** P03, 인증·저장·개발환경 확정안. 입력은 이름/목적/원하는 결과, 빈 소스 또는 기존 소스 참조, 소유자/참여자, 구현 상태와 근거.
- **파일 범위:** `apps/server/modules/projects/`, `access/`, 해당 모델/schema·migration·시험. 기존 인증 서버 설정·사용자 실제 계정 변경은 제외.
- **인터페이스:** `createProject(context,draft)→Project`; `listProjects(actor,filter,cursor)→Page<ProjectSummary>`; `getProject(actor,id)→Project`; `confirmBaseline(context,items,evidenceRefs)→BaselineVersion`. 소비: UI01,UI02,FN02~FN18.
- **수행:** 원본·멤버 권한·프로젝트 상태 저장, 타 프로젝트 격리, 목적 없는 생성 거부. 기존 소스는 읽기 조사와 4상태 분류를 저장하고 사용자 확인 전 기준선 확정 금지. 생성이 Agent 실행을 유발하지 않게 한다.
- **RED/GREEN:** `project_survives_agent_account_change`는 Agent 연결 제거 뒤에도 같은 문서·목록 조회, `cross_project_read_denied`는 목록/직접ID/첨부 모두 차단, `create_duplicate_once`는 중복 생성0. `baseline_without_evidence_not_verified`는 파일 존재만으로 확인 완료 아님을 검증.
- **검수:** 프로젝트 생성→서비스 재시작→재조회로 원본/목적/권한 유지. 다른 참여자는 허가한 목록만 조회. 기준선 원문·미확인 목록 확인. UI01/02와 연결된 부분은 IX01에서 실제 확인.
- **제출/복구:** schema·데이터 참조·권한 시험·재조회 증거·연결 미확인 제출. 삭제/초기화 대신 업무 QA 프로젝트만 식별 정리; migration 복구 영향 명시.

## FN02 방법론 버전·그래프·적용본

- **왜/설계:** 사용자가 절차를 직접 정하고 재사용한다. AV3-F01,F02, §4; S03, TC01,04.
- **선행/입력:** FN01, 노드/연결/문서/승인/한도 계약. 입력은 공통/전용, 단계 목적·사람/Agent 역할·분기/합류/재작업·완료 조건.
- **파일 범위:** `apps/server/modules/methodologies/`, `contracts/methodologies/`, 해당 저장·시험. 실행 scheduler는 FN10 소유.
- **인터페이스:** `saveMethodologyDraft(context,graph)→DraftVersion`; `validateMethodology(version)→Issue[]`; `confirmMethodology(context,version)→ConfirmedVersion`; `applyMethodology(context,version)→ProjectMethodology`. UI03/FN09/FN10 소비.
- **수행:** 시스템 기본 제공/사용자 공통/프로젝트 전용 카탈로그와 특정 버전 적용, 기본본 복사·수정, 빈 방법론/가져오기 직접 작성. 최초 내장은 SYS-M01 구조적 방법론/SYS-M02 객체지향 방법론/SYS-M03 애자일 방법론으로 확정했다. 각 상세 절차·표기·문서·검수 구성은 설계 §4.1.2와 P01 승인 상세안 버전을 소비하고 P02에서 실제 저장/연산 계약으로 고정한다. 내장본은 노드·문서양식·역할·산출·조건·승인·재작업을 함께 제공한다. 버전 불변, 공통과 프로젝트 적용본 분리. 미연결/도달 불가/분기 조건 없음/의도하지 않은 순환/합류 조건/완료 조건 검사. 명시한 재작업 edge는 무조건 cycle 오류로 막지 않는다.
- **RED/GREEN:** `shared_revision_does_not_mutate_active_project`; `rework_edge_valid_but_accidental_cycle_invalid`; `join_requires_declared_results`; `human_step_not_agent_executed`. 저장 뒤 읽기에서 노드 ID·좌표·문서·조건 보존.
- **검수:** 확정된 각 내장 방법론의 그래프/필수 문서·승인·보완 경로가 정의돼 있고 직접 적용 가능해야 한다. 기본본 그대로 적용/복사 수정/빈 직접 작성 각각 저장·재조회. 두 프로젝트가 같은 v1을 쓰는 상태에서 시스템/공통 v2 생성, 한 프로젝트만 적용하고 나머지는 v1 유지. 기본본에 실제 계정/비밀/환경·무제한 실행 권한이 들어가지 않아야 함. 각 validation 오류가 해당 노드 ID로 연결돼 UI03에서 찾을 수 있음.
- **제출/복구:** 그래프 예시/오류별 증거·버전 diff 제출. 과거 확정본 수정 대신 새 개정, 실행 적용 rollback은 이전 버전 선택의 새 기록으로 처리.

## FN03 문서 가져오기·양식·편집·확정

- **공식 산출물 계약:** P01 승인된 [8종 양식](../design/공식산출물_양식정의.md)을 기준으로 P02에서 실제 양식/산출물의 저장·연산 계약을 확정한다. 방법론/단계에 적용 양식 ID·버전·필수 항목·작성/검수 규칙을 연결하고, 작성 결과는 프로젝트·단계·양식 버전·입력 출처·작성 주체·본문/첨부·상태·이력으로 조회한다. 형식 합격은 내용 검수/사용자 승인이 아니다. LLM 작성 임무는 FN09, 실제 결과 회수는 IX02와 연결한다.
- **드리프트 구현/검수:** 설계 §4.3.1대로 documentId/version/hash와 sourceRootId/relativePath/blobHash/commit 연결을 저장한다. 연결/반출입·착수/제출/재개 때 관련 문서를 대조한다. `linked_source_edit_reports_drift_without_overwrite`, `source_change_imported_as_proposal`, `confirmed_server_version_survives_source_change`를 확인하고 서버 유지/제안 수집/별도 분리의 선택·이력·재조회를 UI06/FN04와 검수한다. 전체 소스 주기 전수 수집은 하지 않는다.
- **왜/설계:** 절차의 문서를 실행 가능한 입력으로 관리한다. AV3-F03, INT-01,05~07,10, §4.3; S02,S06, TC01,02,14.
- **선행/입력:** FN01, P02가 확정한 최초 지원 문서 형식/크기/파서. 기본 Markdown·텍스트 외 형식은 검증 없이 지원이라 표시하지 않는다.
- **파일 범위:** `apps/server/modules/documents/`, `imports/`, `contracts/documents/`, 해당 파일 저장·시험.
- **인터페이스:** `importDocument(context,fileRef)→ImportCandidate`; `saveDocumentDraft(context,baseVersion,content)→DraftVersion`; `proposeDocumentChange(context,diff,reason)→Proposal`; `confirmDocument(context,version,reviewRefs)→ConfirmedVersion`; `getDocumentVersion(actor,id,version)→Document`.
- **수행:** 원본/추출/사용자 확정 분리, 양식 필수항목 검사, Agent diff 제안 확인 후 반영. 동시 수정 충돌 감지, 구버전 보존, 설계 확정 전 실제 개발계획 실행 차단에 필요한 상태 제공. 외부 문서 명령은 자료로 취급. 문서작성 공통 기준의 특정 버전을 기본 설계/계획 양식에 연결하고 프로젝트 적용본으로 재사용한다. 상세 화면·업무 구분·위임/검수 필수정보의 누락을 반환한다.
- **RED/GREEN:** `imported_instruction_cannot_execute`; `stale_base_rejected_without_overwrite`; `agent_proposal_not_auto_applied`; `unsupported_format_preserves_original_and_reports_gap`; `read_confirmed_version_unchanged`; `authoring_standard_version_pinned_and_reusable`는 다른 프로젝트에도 같은 작성 구조를 쓰고 내용/ID는 해당 프로젝트로 바뀌는지 확인.
- **검수:** 원본 가져오기→추출 후보 수정→저장→diff→확정→과거/현재 조회를 실제 파일 저장과 함께 확인. 파서 실패 시 원문/사용자 입력 보존, 비밀 마스킹 경계 확인.
- **제출/복구:** 지원 형식/제약·내용 checksum·버전/원본 연결·보안 결과. 파일 정리는 참조중인 원본을 제거하지 않는 규칙으로 구현하고 QA 파일만 정리.

## FN04 설계·계획·코드·시험 추적과 설계 변경

- **왜/설계:** 어느 단계 어느 지점인지, 왜 바뀌었는지 확인한다. AV3-F04,F05, §5; S06,S07, TC02,10.
- **선행/입력:** FN02,FN03,FN11. 설계 ID/화면 위치/계획 업무 유형/증거 참조. 실제 실행 결과는 FN12가 나중에 공급.
- **파일 범위:** `apps/server/modules/traceability/`, `design_changes/`, 관련 schema/migration·시험.
- **인터페이스:** `linkTrace(context,fromRef,toRef)→TraceEdge`; `getTrace(actor,designId,version)→TraceView`; `proposeDesignChange(context,before,after,reason)→ChangeRequest`; `analyzeImpact(changeId)→ImpactSet`; `activateDesignChange(context,approvalRef,planVersion)→AppliedBaseline`.
- **수행:** 화면/기능/연결 계획 분리, 미연결 설계·근거 없는 작업 탐지. 작업 진행/사용 가능성/검증 3축 분리. 변경 영향 있음/없음/미확인, 사용자 승인→계획 개정→영향 작업 재개, 과거 결과 보존.
- **RED/GREEN:** `ui_and_api_done_without_link_not_feature_complete`; `unknown_impact_not_no_impact`; `approved_change_without_plan_revision_not_activated`; `unrelated_assignment_continues`; `historical_evidence_remains_readable`.
- **검수:** 설계→화면 위치→작업→실행·변경/시험 및 역방향 조회. 결과가 아직 없는 연결은 미확인으로 보임. 완료 항목 변경 때 구근거 보존과 영향 작업만 재확인 표시.
- **제출/복구:** 추적 그래프·누락/영향 표·전후 승인 기록. 잘못된 적용도 삭제가 아니라 새 개정/복구 기록. 권한/실제 승인 판정은 FN11을 소비하며 자체 가짜 승인 생성 금지.

## FN05 헌법·지식·원문·임무 맥락

- **구조화 이해/보호 검수:** 설계 §6.2의 목적·기준/권한·결정 이유·완료/현재 위치·실제 차이/공백·다음/미확인의 6항목별 원문/버전·응답·일치/불일치/부족·확인 주체/근거를 저장한다. ID/hash/누락 검사와 의미 판정을 분리하고 자기 합격을 허용하지 않는다. `required_context_not_dropped_by_one_hop`, `understanding_missing_item_blocks_ready`를 FN09/FN14와 확인한다. 의심 비밀은 전송/일반 조회를 제한해 비밀 없는 ID로 통지하고 원문 자동 삭제·계정 변경은 금지한다(§12.1.1).
- **왜/설계:** Agent가 ‘왜’와 기준을 잃지 않게 한다. AV3-F06,F11, §6,8.1; S10, TC05~07,14.
- **선행/입력:** FN03. 목적·헌법·최신 지시·결정 이유·원문·실패/해결·적용 범위·상태·출처.
- **파일 범위:** `apps/server/modules/knowledge/`, `constitution/`, `context/`, 검색/저장·시험. 자체 모델 훈련·외부 공유 자동화 제외.
- **인터페이스:** `appendConversation(context,event)→SourceRef`; `saveKnowledge(context,entry)→KnowledgeVersion`; `searchKnowledge(actor,projectId,query,cursor)→Page<KnowledgeHit>`; `buildTaskContext(assignmentId,budget)→ContextBundle`; `compareUnderstanding(bundleRef,response)→UnderstandingReview`.
- **수행:** 원문과 구조화 지식 분리, 사실/가설·출처·이유·정정·대체·사용 제외·공유 승인. 목적/헌법/최신 지시/위치 필수 전달, 용량 초과 시 누락 공개·분할/검색, 규칙 몰래 삭제 금지. 판단 모델은 교체 가능한 연결 사용.
- **RED/GREEN:** `summary_edit_keeps_source`; `excluded_knowledge_not_reselected`; `budget_exhaustion_reports_missing_required_context`; `constitution_read_receipt_not_understanding_approval`; `sharing_requires_explicit_target_permission`.
- **검수:** 사용자 결정 원문→구조화→임무 전달→새 세션 이해 대조에서 이유/기준/현재 위치 일치. 실제 도구는 FN09/IX04에서 확인. 정정 전후·비밀 제거·다른 프로젝트 격리 확인.
- **제출/복구:** 맥락 manifest·원문 위치·불일치/빠진 부분. 외부 판단 불가면 검색/저장은 계속하고 실제 Agent 이해 대조만 미확인. 지식 복원은 과거 원문 덮어쓰기 금지.

## FN06 첫 기존 코딩 Agent와 환경 실제 연결

- **조기 타당성 검수:** P03/FN01/FN11 수용 뒤 Stage B 전체 종료 없이 제한된 실제 지원을 먼저 확인할 수 있다. 연결 등록과 실제 변경 시험 승인 범위를 구별한다. 지시/상태·원문/결과·파일/도구 승인/중지·회수/쓰기 통제별 정확 버전·실측/미확인/미지원을 기록한다. 임무 필수 능력 부족이면 그 역할 배정은 불가. 어떤 후보도 충족하지 못하면 근거·공식 대안·영향을 사용자에게 보고하며 사후 모니터링 제품으로 자동 축소하지 않는다.

- **왜/설계:** Anvil에서 기존 코딩 Agent에 일을 시키는 실제 접점. AV3-F13,F14, §9.1~2; S11, TC03,14.
- **선행/입력:** FN01,FN11,P02. 공식 인터페이스 확인을 통과한 첫 제품·버전·실행 방식·모델·Windows 실행기·보호 인증 참조·허가 환경. 단순 설치/도움말 읽기와 실제 임무/세션 검증은 구별한다.
- **파일 범위:** `apps/connector/adapters/primary/`, `apps/server/modules/connections/`, `environments/`, `contracts/agent-adapter/`. 외부 계정 생성/변경·무승인 설치/비용·세션 가져오기 제외.
- **인터페이스:** `probeCapabilities(connection)→CapabilityReport`; `startSession(contextBundle,options)→SessionRef`; `sendInstruction(sessionRef,instructionId,payload)→DeliveryReceipt`; `observe(sessionRef,cursor)→AgentEvent[]`; `requestStop(sessionRef,scope)→StopReceipt`; `submitToolDecision(requestRef,decision)→DecisionReceipt` (미지원은 명시 반환).
- **수행:** 등록/인증/읽기 검사/작은 실제 시험 분리. 지시·수신·결과·중지·재개·도구 승인·하위 Agent별 확인/미확인/미지원과 통제 수준 기록. 필수 능력 부족 임무 배정 금지. 환경은 실행기와 대상 별도 저장.
- **RED/GREEN:** `opening_tool_not_connected`; `missing_stop_support_blocks_mutating_role`; `expired_credentials_not_server_failure`; `unsupported_approval_not_silently_approved`; `secret_not_in_event_or_context`.
- **검수:** 실제 기존 Agent의 세션/실행 ID·작은 파일 수정/시험·결과 수집을 직접 확인. 모델 답변만으로 코딩 Agent 연동 PASS 금지. 필수 기능이 불가능하면 대체 후보와 영향 기록, 거짓 성공 금지.
- **제출/복구:** 제품/버전·공식 근거·확인 기능 표·비밀 제거 로그·QA 변경 diff. 연결 해제해도 프로젝트/문서/지식 보존. 연결 시험 생성 자원과 파일만 정확 복구.

## FN07 두 번째 기존 Agent·다른 계정 연결

- **왜/설계:** ‘교체 가능’을 말이 아닌 실제 경로로 만든다. AV3-F12,F13, INT-26~32; TC07.
- **선행/입력:** FN06의 공통 어댑터 계약, P02의 두 번째 제품 후보·접속 가능 조건. 첫 도구와 다른 실제 코딩 Agent가 기본 검증 대상이다.
- **파일 범위:** `apps/connector/adapters/secondary/`, 해당 capability/시험. 첫 어댑터 공통 계약 수정은 영향 검토 후 허가 파일에 포함.
- **인터페이스:** FN06과 같은 계약을 구현하되 제품별 미지원은 CapabilityReport로 노출. 서비스 계정 참조 교체 시 Project/Knowledge ID는 변경하지 않는다.
- **수행:** 독립 인증/모델/한도·제어 기능 시험, 계정 교체와 프로젝트 권한 분리, 기존 Anvil 세션 재개와 새 세션 인계 구분. 계정 내부 과거 세션 import는 제외.
- **RED/GREEN:** `secondary_returns_same_normalized_receipts`; `account_switch_keeps_project_history`; `quota_reached_keeps_anvil_access`; `capability_difference_blocks_only_incompatible_role`.
- **검수:** 두 실제 도구에 같은 제한 임무를 각각 전달해 실제 결과를 회수. 동일 도구/다른 계정도 가능 범위 내 확인하되 계정 없는 경우 해당 사례 미실행. mock2개를 다중 Agent 지원이라 부르지 않는다.
- **제출/복구:** 제품별 차이·실제 확인·미지원 목록. 외부 연결이 막히면 독립 기능은 진행하고 IX04의 타도구 인수 증거만 차단. 인증/계정은 사용자 자산이므로 삭제 금지.

## FN08 Windows 실행·진행 회수·명령 중복 방지

- **경로·회수 검수:** 설계 §10.2.1과 TM01~04/08에 따라 표시 상대 경로/호스트 실경로·파일 정체성/등록 매핑을 분리한다. `path_swap_between_check_and_use_denied`, `wsl_mapping_outside_registered_root_denied`, `stale_generation_observation_not_write_authority`, `ack_requires_contiguous_persisted_sequence`를 검증한다. 링크/상위 이탈·겹치는 범위·자식 프로세스 소유/이탈·잔류와 순번/hash 공백을 관측한다. 실제 OS binding은 P02 확정 후 사용하고 문자열 정규화/DB lock만으로 안전 PASS를 주장하지 않는다.
- **소스/Git 증거 책임:** 임무의 허가 소스 root·실제 경로·시작/종료 branch·commit·dirty 파일/실제 diff/hash를 실행 facts와 연결한다. 읽기 확인과 실제 commit/push/병합·rollback 명령의 허가는 구별한다. Git 충돌/범위 밖 변경을 자동 reset/덮기로 해결하지 않는다. 별도 실행영역의 통합 책임은 FN09 임무에 명시하고 실제 상태 대조/복구는 FN13으로 연결한다. 범용 Git 관리 기능을 새로 추가하는 뜻은 아니다.

- **왜/설계:** 작업 중 기록을 Anvil에 회수해 마지막 요약 없이 이전한다. §2.2,7.4,10.2~3; TC03,08,11.
- **선행/입력:** FN01,FN06,FN11, 인증된 서버/실행기 연결·저장 경로·허용 소스. 스풀에는 실제 확인한 비밀 제거 이벤트만 저장. 실제 사용자/제어 세대·명령/범위/승인 집행 없이 실행을 먼저 만들지 않는다.
- **파일 범위:** `apps/connector/runtime/`, `spool/`, `observers/`, `apps/server/modules/executions/`, 이벤트 계약·시험.
- **인터페이스:** `dispatch(commandEnvelope)→DispatchReceipt`; `appendObservation(executionId,sequence,event)→LocalReceipt`; `syncObservations(executionId,afterSequence)→ServerAck`; `getExecutionFacts(executionId)→ExecutionFacts`.
- **수행:** 요청/수신/실행 관측 분리, 순번/중복 키·서버 확인 지점, 명령 출력·변경 파일·시험 증거·원문 회수. 소스 실경로/링크 확인. 전송 끊김 뒤 같은 부작용 명령 재실행 금지.
- **RED/GREEN:** `lost_ack_does_not_repeat_mutation`; `duplicate_event_once`; `clock_skew_preserves_execution_order`; `source_link_outside_scope_denied`; `disk_full_blocks_new_dispatch_with_visible_gap`.
- **검수:** 한 실제 임무 중 통신 전달을 제한된 QA 방법으로 끊고 복구해 로컬/서버 순번·공백·중복0을 확인. 창 닫힘과 실행기 종료를 구분. OS/공유 네트워크 변경 없이 시험.
- **제출/복구:** command/실행 ID, spool/ACK 지점·관측·누락 manifest. 미전송 자료 제거 전 서버 영속화 증거 필수. 실패한 실제 변경은 범위 diff와 복구 제안.

## FN09 총괄·단계책임자·하위 임무

- **왜/설계:** 프로젝트 지속 역할과 교체 가능한 세션을 분리한다. AV3-F07, §2.1,7.1; S04,S05, TC03,05.
- **선행/입력:** FN02,FN04,FN05,FN08,FN11. 확정 단계·계획·사용자 목표/기대 결과·연결 도구·환경.
- **파일 범위:** `apps/server/modules/assignments/`, `coordinator/`, `understanding/`, 관련 계약·시험.
- **인터페이스:** `prepareAssignment(context,stageId,goal,outputs)→AssignmentDraft`; `confirmAssignment(context,draftVersion)→Assignment`; `bindResponsibleSession(context,assignmentId,connectionId)→RoleBinding`; `delegateSubtask(context,parentId,scope)→SubAssignment`; `reviewUnderstanding(context,bundleRef,review)→StartReadiness`.
- **수행:** 총괄의 세부 임무 제안/확정, 다른 Agent 단계 배정, 직접/하위 수행 방법 기록, 임무/권한 부분집합·같은 파일 단일 writer. 필수 맥락과 이해 대조 전 실행 금지. 완료/재작업 같은 세션 유지 기본값, 교체 금지 아님. 설계/계획 작성 임무에는 문서작성 공통 기준 버전·프로젝트 목적/요구·필수 양식·검수 조건을 함께 전달하고 결과를 문서 제안으로 수집한다.
- **RED/GREEN:** `subtask_cannot_expand_parent_scope`; `overlapping_writer_rejected`; `different_agents_per_stage_supported`; `new_coordinator_keeps_role_history`; `missing_purpose_blocks_start`.
- **검수:** 사용자 목적에서 생성한 임무·근거 설계·완료 조건을 확인하고 실제 책임 세션에 전달. 하위 임무는 노출되는 지원 범위만 생성/관측, 주장을 사실로 등록 금지.
- **제출/복구:** 역할/세션 관계·이해 검토·위임 경계·미지원. 담당 해제는 역할 이력을 보존하고 실제 실행 정리 FN13을 거친다.

## FN10 자동/건별·분기·한도·대기열

- **TM10 한도 검수:** 정책 버전과 호출/시간/비용 사용량·예약/누적을 실행에 결박하고 중복·재시도·재시작으로 초기화하지 않는다. FN06/08의 실제 사용량 가시성과 FN11의 허가를 소비하며 관측/강제 불가 비용은 추정/미확인·통제 한계로 공개한다. 필요한 정책 없이 새 유료 호출을 허용하지 않고 이미 발생한 공급자 과금을 취소한다고 보장하지 않는다. 합성 한도/사용량의 정상·도달·누락·재시작 시험과 실제 과금 확인은 구분해 IX03에 제출한다.
- **왜/설계:** 정의된 절차가 실제 진행된다. AV3-F02,F08, §7.2~3,9.3; TC04.
- **선행/입력:** FN02,FN09,FN11. 그래프·확정 임무·완료 판정 이벤트·자동 범위·사용자 한도.
- **파일 범위:** `apps/server/modules/scheduling/`, `quotas/`, 관련 상태/시험.
- **인터페이스:** `evaluateNext(projectId,currentResult)→NextAction[]`; `startStage(context,stageId,mode,boundary)→RunRequest`; `getQueue(actor,projectId)→QueueView`; `applyLimitPolicy(context,policy)→PolicyVersion`.
- **수행:** 자동은 허가 범위/승인 지점까지만, 건별은 선택 단계 수행+총괄 판정 뒤 대기. 사람 노드·병렬/분기/합류/재작업·입력 대기·전체/프로젝트 슬롯. 보고 자체를 중지로 사용하지 않는다. 미설정 재시도/비용 정책은 명시 준비 부족.
- **RED/GREEN:** `case_mode_stops_before_next_stage`; `auto_stops_at_approval_node`; `join_does_not_count_skipped_as_complete`; `approval_wait_not_fake_running_slot`; `limit_not_reset_by_retry`.
- **검수:** 동일한 작은 방법론을 자동/건별로 실행해 다음 행동 차이와 승인 지점 확인. 실패 분기는 보완 노드로, 독립 분기는 계속. 한도/queue는 UI14에 이유와 실제 상태 제공.
- **제출/복구:** 전이 순서·판정 근거·슬롯 관측·정책 버전. scheduler 재시작 후 이미 dispatch한 command를 새 명령으로 재발급하지 않음.

## FN11 환경 권한·일회 승인·명령 통제

- **TM12 감사 신뢰 검수:** 무권한 감사 수정·삭제 거절과 정정의 새 이력을 확인한다. 순번/hash 대조와 관리자/자료·검증 기준 동시 침해의 한계를 구별한다. 독립 검증 기준이 없으면 전체 관리자 침해까지 변조 검출 PASS를 주장하지 않으며 합성 변조의 검출/미보장 범위·근거를 IX03/06에 남긴다. 별도 외부 저장/키는 이번 문서로 생성하지 않는다.
- **공통 소유:** FN01의 초기 단독 제어/인증 상태를 소비해 모든 변경 명령의 현재 client·generation·기준/범위·중복 key를 서버에서 집행한다. 허용/거절·승인 결정/소비·실행 연결의 audit event를 영속하고 민감 payload는 제외한다. 조회 권한도 서버에서 검사한다. FN15는 이 저장 기반을 사용해 제어 전환을 완성하며 중복 정책 저장소를 새로 만들지 않는다.

- **왜/설계:** 사람의 결정과 안전 범위를 실제 집행한다. AV3-F14, §9.2,10.2,12.1; S08,S11, TC08,13,14.
- **선행/입력:** FN01, 명령 분류·경로/환경·범위·유효 기간·복구·위험·현재 작업 주체.
- **파일 범위:** `apps/server/modules/policies/`, `approvals/`, `command_authorization/`, 해당 저장·동시성 시험.
- **인터페이스:** `authorizeCommand(context,action,target)→Allow|Deny|ApprovalRequired`; `requestApproval(context,scope,risks,rollback)→ApprovalRequest`; `decideApproval(context,requestId,expectedVersion,decision)→ApprovalDecision`; `consumeApproval(context,commandId,scopeDigest)→AuthorizationReceipt`.
- **수행:** 자동/승인/금지와 실제 target 검사, 승인 원문·범위 digest·한 번 결정/실행·만료/stale·권한 취소. PC/모바일 같은 요청. Agent 자체 승인은 공식 어댑터 응답과 연결하고 우회 금지.
- **RED/GREEN:** `concurrent_approve_once`; `changed_payload_rejects_old_approval`; `revoked_actor_cannot_approve`; `approval_cannot_authorize_unrelated_command`; `credential_not_in_audit`.
- **검수:** 승인/거절/수정/만료/권한 없는 직접 API·재전송을 시험. 요청 1건에 부작용 최대1회. 알려진 지원 없음은 승인 완료로 바꾸지 않음.
- **제출/복구:** 허가표·승인/소비 원자성·실제 요청 증거. 이미 실행된 명령 취소는 승인 기록 삭제로 되돌리지 않고 별도 복구 절차.

## FN12 결과 수집·검증·이상 분류

- **증거 출처 검수:** 설계 §7.3대로 수행자 주장/실행기 관측/시험 산출물/검수자 확인을 분리하고 정확 commit·환경·명령·exit·내용 hash로 연결한다. `agent_claim_cannot_forge_observed_test`, `missing_artifact_prevents_verified_result`를 확인한다. 변경/중요 위험/증거 부족 경계만 필요한 재현을 수행하며 미실행·재사용 증거의 범위/기준을 공개한다.
- **왜/설계:** 완료 선언이 아닌 실제 증거로 다음을 결정한다. AV3-F09, §6.3,7.3; S05,S08, TC09.
- **선행/입력:** FN04,FN08,FN09. 결과 제출·diff·명령/종료·시험·기준/환경·완료 조건.
- **파일 범위:** `apps/server/modules/results/`, `verification/`, `issues/`, 관련 시험.
- **인터페이스:** `submitResult(context,assignmentId,manifest)→SubmittedResult`; `evaluateResult(context,resultId,criteria)→ReviewDecision`; `classifyExecutionIssue(facts)→IssueClassification`; `requestRework(context,resultId,missingItems)→ReworkAssignment`.
- **수행:** 제출→검토/테스트→완료, 미실행/차단/실패 분리. 오류·거부·연결 단절·원인 미확인·증거 불충분 분류. 같은 근본원인만 실패 횟수로 묶고 quota/환경은 구분. 정상 장시간·승인 대기를 idle로 오인 금지.
- **RED/GREEN:** `claimed_complete_without_evidence_rework`; `build_pass_not_browser_pass`; `unknown_reason_remains_unknown`; `long_running_observed_not_idle`; `unexecuted_not_pass`.
- **검수:** 제출물에서 시험/파일을 일부 누락해 부족 조건 정확 판정, 보완 결과를 원결과와 연결. 결과 평가 모델이 추측한 이유는 사실이 아니라 제안으로만 저장.
- **제출/복구:** 조건별 판정·부족/미실행·실제 증거와 다음 행동. 기존 합격 결과 변경 시 이유/영향을 남기고 소급 삭제 금지.

## FN13 상세 체크포인트·중지·재개

- **회수 경계 검수:** 설계 §7.4의 지원 중지→실제 소유/쓰기 관측→잔류 확인을 따른다. `timeout_does_not_kill_or_grant_new_writer`, `unknown_child_writer_keeps_resume_blocked`를 검증한다. 별도로 지시된 특정 실행 강제 회수는 소유·영향·손실/공백·대안을 확인한 정확 범위만 가능하며 공유 프로세스/WSL 재시작/ACL 변경으로 확대하지 않는다.
- **왜/설계:** 에러/비상 시 미완료 지점에서 안전하게 잇는다. AV3-F10, §7.4,10.3; TC08,11.
- **선행/입력:** FN08,FN09,FN11. 세션/단계/프로젝트 범위·하위 실행·작업현황·실제 파일/프로세스.
- **파일 범위:** `apps/server/modules/recovery/`, `checkpoints/`, `apps/connector/stopping/`, 상태 파일·시험.
- **인터페이스:** `saveCheckpoint(context,assignmentId,state)→Checkpoint`; `requestStop(context,scope)→StopRequest`; `observeStop(executionId,facts)→StopState`; `reconcile(context,checkpointRef)→StateDiff`; `resume(context,reconciliationRef)→ResumeRequest`.
- **수행:** 착수/변경/시험/오류/중단 상세 상태 파일, 서버/로컬 회수 지점. 새 배정 차단, 실제 중지/권한 세대 회수, 미확인은 새 writer 차단. 재시작 자동 실행 금지·사용자 재개·완료 작업 반복 방지.
- **RED/GREEN:** `stop_requested_not_stopped`; `old_generation_cannot_write`; `restart_waits_user_resume`; `completed_work_not_repeated`; `unrecorded_local_changes_visible_in_reconcile`.
- **검수:** 진행 작업+하위 작업 중 단계 중지, 실제 프로세스/쓰기 확인. 구세션 응답 없이도 상태 파일/관측에서 복구. 불명인 상태에서는 읽기만 허용되는지 확인.
- **제출/복구:** 복구 파일과 실제 상태 diff·진행 프로세스·잔류·미수신 구간. 임의 kill/WSL 재시작·ACL 변경을 복구 기본값으로 넣지 않는다.

## FN14 총괄·책임자 최소 손실 이전

- **이해 검수의 필수 입력:** 설계 §6.2의 6항목별 근거·응답·불일치/부족·확인 주체를 사용한다. 원문/실제 소스 모순을 모델 점수로 합격시키지 않는다. 목적/결정 이유/현재 위치 누락을 의도적으로 만들어 보완 전 재개 거부를 확인한다. 총괄 교체 사용자 확인과 단계 교체 총괄 확인을 구별한다.
- **왜/설계:** 제품의 핵심인 도구/세션 독립성을 입증한다. AV3-F12, §8.2; S09, TC06,07.
- **선행/입력:** FN05,FN07,FN12,FN13. 목적·헌법·원문·이유·완료/미완료·실제 차이·공백·새 연결 기능.
- **파일 범위:** `apps/server/modules/transfers/`, `handoff_bundles/`, 어댑터 소비·시험. 기존 외부 세션 import 제외.
- **인터페이스:** `prepareTransfer(context,roleRef,targetRef)→TransferDraft`; `getTransferManifest(actor,id)→TransferManifest`; `compareTransferUnderstanding(context,id,response)→TransferReview`; `confirmTransfer(context,id,reviewVersion)→NewRoleBinding`.
- **수행:** 인계 기준 동결→정지/쓰기 상태 확인→부족 기록 공개→새 대상 기능검사→실제 상태/이해 대조→확인 후 재개. 총괄 교체 사용자 확인, 단계 교체 총괄 확인. 계정교체·연결해제 후 원본 유지.
- **RED/GREEN:** `unresponsive_old_agent_no_final_summary_required`; `unsafe_stop_prevents_new_writer`; `decision_reversal_requires_correction`; `missing_context_disclosed`; `coordinator_switch_requires_human_confirmation`.
- **검수:** 같은 도구 새 세션, 실제 다른 도구, 총괄 세션 교체 각각 임무를 이어가며 결정 번복·완료 반복·현재 위치 상실·추가 설명/회수 공백을 기록. 수치 임계값은 P02 확정값 적용, 없으면 합격 수치 주장 금지.
- **제출/복구:** 이전 전후 기준/도구/실제 결과·손실·사용자 보완·원문 연결. 실패하면 새 writer 안 켜고 기존 기록 유지, ‘복구 완료’가 아닌 안전 상태/다음 선택 표시.

## FN15 사람·클라이언트 단독 제어

- **기반 소비:** FN01의 최초 사용자/client·제어 세대와 FN11의 집행이 먼저 존재해야 한다. 이 업무는 사람/기기 인수·수락·원자적 전환·옛 권한 회수의 전체 흐름을 완성한다. 초기 단독 제어를 이 시점까지 미루지 않는다. 조회 기기의 승인 전용 별도 위임은 기존 합의 밖이므로 추가하지 않는다.

- **왜/설계:** 여러 사람은 조회하되 동시에 지휘하지 않는다. AV3-F15, §9.3; S12,S13, TC08,13,14.
- **선행/입력:** FN01,FN11,FN13. 참여자 역할·현재 제어권/기기·인수 요청·안전 상태.
- **파일 범위:** `apps/server/modules/control_handoffs/`, `client_ownership/`, 관련 원자적 저장·시험.
- **인터페이스:** `requestControl(context,targetActor,targetClient,reason)→ControlRequest`; `prepareControlHandoff(context,id)→HandoffSummary`; `acceptControl(context,id,summaryVersion)→ControlGrant`; `checkControl(context)→ControlState`.
- **수행:** 한 사람/한 제어클라이언트·동시 조회, 현재 담당 안전 대기→다음 수락→옛 권한 회수/새 발급. 같은 사용자 PC→모바일은 프로젝트 재시작 없이 인계. 거부/미수락/끊김 이중 권한 금지.
- **RED/GREEN:** `simultaneous_accept_single_owner`; `old_tab_cannot_approve`; `viewer_cannot_command_direct_api`; `same_user_client_change_keeps_execution`; `unaccepted_request_keeps_previous_owner`.
- **검수:** 실제 두 클라이언트/두 QA 사용자로 지시·승인·조회·인수 대조, 오래된 화면 직접 요청도 차단. 관련 실행 정지 상태와 제어화면 전환의 차이를 확인.
- **제출/복구:** 제어 세대·인계 요약·전후 권한·거부 근거. 권한 복구는 서버 현재 상태에서 단일 발급, 양쪽을 모두 살리지 않는다.

## FN16 원본 백업·반출·검증 복원

- **포함/제외 검수:** 설계 §10.4대로 파일 목록·용량/hash·제외 이유 preview와 manifest를 저장한다. `.gitignore`만으로 필요한 ignored 원본/자료를 누락하지 않는다. `required_ignored_source_not_silently_excluded`, `excluded_item_reason_visible`를 확인한다. 백업 핵심은 FN17 전체 미완료 때문에 막지 않되 이미 제공된 알림/이력과 최종 전체 참조는 IX06에서 확인한다.
- **왜/설계:** Anvil 자체를 옮겨도 사용자 자료가 남는다. §10.4, INT-39; S14, TC12.
- **선행/입력:** FN03,FN05,FN12,FN13,FN15, 사용자 선택 저장 위치/주기/보관·암호화 참조. 사람 제어권을 포함한 원본 manifest를 검사한다. FN17이 이미 제공된 경우 알림 설정/이력도 포함하며, 미구현이면 미포함 범위를 명시한다. 백업 핵심 생성/검증을 푸시 기능 때문에 막지 않는다. 최종 IX06에서는 전체 제공 자료의 보존을 확인한다.
- **파일 범위:** `apps/server/modules/backups/`, `exports/`, `restore_validation/`, manifest/schema·시험.
- **인터페이스:** `createBackup(context,policy)→BackupManifest`; `exportProject(context,includeSource)→ExportManifest`; `validateRestore(context,backupRef,target)→RestoreReport`; `compareRestoreImpact(context,reportRef)→Impact`; `confirmRestore(context,impactRef,approvalRef)→RestoreResult`.
- **수행:** 문서/원문/지식/상태/관계/증거/승인/감사와 소스·미커밋 포함 여부, hash·참조 무결성. Secret/계정 자체 제외·재연결, 키 별도. 검증용 복원→영향→승인→적용, 자동 실행 재개 금지.
- **RED/GREEN:** `missing_blob_detected`; `tampered_manifest_rejected`; `restore_keeps_cross_links`; `export_readable_without_agent_login`; `restore_does_not_resume_writers`; `retention_does_not_delete_live_references`.
- **검수:** QA 프로젝트를 별도 검증 위치로 반출/복원해 이전 원문·추적·증거 조회. 실제 원본 overwrite는 개발 검증 대상 아님. 실패/키 부재/용량 부족 상태를 화면 계약으로 제공.
- **제출/복구:** 포함/제외·hash·복원검사·실행0 확인. 파일 삭제/retention 적용은 승인 정책과 정확 대상 검증 후. 사용자 백업을 시험 정리로 삭제하지 않는다.

## FN17 중요 알림·모바일 전달

- **왜/설계:** 사용자가 필요한 결정만 제때 처리한다. §11.14~15, INT-39/주요 화면; S08,S13,S14.
- **선행/입력:** FN10,FN11,FN12. 승인/중요 오류/자동 한도/프로젝트 최종 완료 이벤트, 사용자 알림 선택.
- **파일 범위:** `apps/server/modules/notifications/`, `apps/web/src/notifications/`, 지원 브라우저 push 연결·시험.
- **인터페이스:** `publishImportantEvent(event)→NotificationRef`; `listNotifications(actor,cursor)→Page<Notification>`; `getPushSupport(client)→SupportState`; `registerPushPreference(context,preference)→Preference`.
- **수행:** 일반 진행은 프로젝트 내부만, 중요한 동일 사건 중복 알림 방지, 인증된 요청 딥링크. 푸시 지원/허가/미지원·실패 공개, 앱내 조회 대체. 공개 endpoint/비용 서비스 무단 생성 제외.
- **RED/GREEN:** `progress_not_important_push`; `click_not_approval`; `expired_link_requires_auth`; `notification_payload_no_secret`; `denied_push_still_in_app`.
- **검수:** 지원되는 실제 브라우저 전달과 요청 이동/인증 확인. 지원 불가면 앱내 경로 확인과 푸시 미지원 표시만 인정, 실제 push PASS 금지. 최종 완료 알림은 제출 이벤트에 반응하지 않음.
- **제출/복구:** 사건/수신/이동·사용자 선택·미지원. 알림 해제는 실제 작업/승인 삭제 아님, token/구독 정리는 해당 사용자 범위만.

## FN18 Windows 설치형 제품 코드·패키지 산출물

- **TM11 공급망 검수:** P03의 정확 의존 버전/출처·lockfile과 패키지/업데이트 산출물 hash·구성된 신뢰/서명 기준을 소비한다. 변조·출처 불명·필수 검증 불가 입력은 적용 차단/기존 정상본 보존으로 검수하고 IX06에 연결한다. 새 서명 키/인증서·실제 사용자 설치·자동 최신화는 별도 경계이며 이 보완에서 실행하지 않는다.
- **왜/설계:** Windows 설치형과 브라우저가 같은 Anvil 프로젝트를 사용한다. §12.2, INT-35~38; TC11~13.
- **선행/입력:** P02의 설치형 기술 선택, FN08,FN15,FN16. 서버 연결/복구·업데이트 요구.
- **파일 범위:** `apps/desktop/`, `tests/desktop/`, 패키지 metadata·제품 매뉴얼. 실제 사용자 설치·운영 업데이트는 별도 설치/배포 계획.
- **인터페이스:** 브라우저와 같은 서버 명령/조회·제어권 계약. 로컬 실행기는 FN08을 소비하며 별도 프로젝트 DB/독립 이력을 만들지 않는다.
- **수행:** 설정/서버 연결/인증/동일 화면/실행기 상태, 창 닫힘과 완전 종료 구분, 안전 종료·상태 복원·수동 재개, 업데이트 시 백업/호환성·복구 정보, 설치 산출물 생성/검증용 환경 시험.
- **RED/GREEN:** `desktop_browser_same_project`; `close_window_not_cancel`; `full_exit_checkpoint_then_manual_resume`; `update_failure_does_not_remove_user_data`; `desktop_secret_not_in_renderer`.
- **검수:** 격리 검증 환경에서 패키지 기동·동일 서버 자료/제어권·재시작 복원 확인. 패키지 파일 생성만으로 설치 완료 아님. 업데이트/제거 실제 실행은 별도 계획의 시험 항목으로 명시.
- **제출/복구:** artifact hash·build 명령·검증용 실행 증거·설치/설정/관리 매뉴얼과 미실행 경계. 개발 산출물만 되돌리고 사용자 설치/등록/자료를 변경하지 않음.

## 19. 큰 업무의 내부 검수점

새 최종 업무 ID나 임의 파일 수 제한을 늘리지 않고 한 논리 업무 안에 다음 checkpoint를 둔다. 중간 통과는 전체 업무 완료가 아니며 재작업은 실패 경계만 대상으로 한다.

| 업무 | 중간 검수점 |
|---|---|
| FN08 | 인증/범위·중복 명령 거부 → 실제 지시/관측 → spool/ACK/단절·회수 공백 |
| FN09 | 기준/임무·맥락 → 역할/세션 binding·이해 → 하위 권한 부분집합/같은 경로 충돌 |
| FN12 | 증거 등록/실제 자료 조회 → 조건별 검수/누락 → 보완 연결·원인 미확인/실패 분류 |
| FN13 | 상세 checkpoint → 중지 요청/실제 소유 회수 → 실제 상태 대조/사용자 재개 |
| FN14 | 동결 인계본/누락 → 안전·대상 능력 → 이해 근거/확인 → 실제 미완료 재개·손실 |

공통 기준은 설계 본문 §2.3/4.3.1/6.2/7.3~4/9.1.1/10/12.1.1/13.1.1, 배정·위험 책임은 계획 §2.2~3이다. THREAT_MODEL/TRACEABILITY는 보조 상세 조회본이며 이전 실행안전 보완은 이력이다. 실제 파일 수정/시험 명령은 시작 패킷에서 각 checkpoint 범위로 확정한다.
