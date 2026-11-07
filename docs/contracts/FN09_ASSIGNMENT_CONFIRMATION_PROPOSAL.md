# FN09 임무 내용 검토·별도 확정 상세안
상태: PROPOSED · 2026-10-18 · Main 어울. 기존 작업계획 FN09 / INTERFACES §13.1의 구체화 제안이며 승인·구현·DB 적용 기록이 아니다.

## 목적과 선행 사실

Anvil이 만든 임무를 Agent에게 넘기기 전에, 사용자가 정확한 임무 내용과 완료/검수·허용 범위를 검토하고 불변 확정본으로 남긴다. 내용 확정과 실제 실행 준비·허가를 분리한다.

- 현재 제품 후보에는 prepareAssignment와 불변 assignment_drafts/assignment_draft_versions만 있다. 정식 개발 DB는 마지막 실제 확인 46 migrations/새2표 미적용이며 실행 안전 직접승인 차단 상태다. 이 문서 작성 중 DB를 재조회하거나 적용하지 않았다.
- 기존 DRAFT snapshot/hash/ready=false/executionAuthorized=false/dispatchPerformed=false와 0012 SQL은 변경하지 않는다.
- 확정 임무·ContextBundle·현재 위치 checkpoint·예산 원본은 아직 구현되지 않았다. 초안/호출자 ref를 해당 실제 원본으로 대신하지 않는다.
- 현재 제안 승인도 기존 미답변 FN09 schema-only 직접승인이나 만료된 실행창을 대체하지 않는다.

## 제안 계약 — 결정 전 API·SQL 구현 금지

### 1. 임무 내용 검토

새 project command reviewAssignmentContent: targetId=draftRef.id, expectedVersion=draftRef.version, payload={draftRef,criteriaVersion:1,items,outcome,reason}. baselineRefs=[]/approvalRef=null. 입력은 정확 키, 유효 Unicode·유한 목록/길이·알려진 비밀 표식을 검사한다.

- 기준 6개: PURPOSE_SCOPE(목적·할 일/하지 않을 일), BASELINE_TASK(정확 설계·확정 계획/업무·적용 단계), INPUT_OUTPUT(필요 자료·산출·책임), COMPLETION_VERIFICATION(완료·검수/미실행 구분), BOUNDARIES(소스/환경·능력·예산 제한과 미확인), RECORD_RECOVERY(상세 기록·실패/재개·완료 작업 반복 방지).
- 각 항목 {criterionId,outcome,reason,evidenceRefs:[]}을 사람이 작성한다. outcome은 ACCEPTED/REWORK/BLOCKED/NOT_EXECUTED. 기본 자동 적합·LLM 자기 합격·실제 능력/예산 검증 대체는 없다.
- 기준은 위 6개가 정확히 한 번씩 있어야 한다. 각 이유와 전체 이유는 공백 제외 비어 있지 않은 유효 Unicode·최대20000 UTF-16, 전체 canonical UTF-8 본문은2MiB 이하다. 종합 ACCEPTED는 6항목이 모두 ACCEPTED일 때만 선택 가능하며, 이유/증거를 자동 생성하지 않는다. 추가 증거 종류는 현재 evidenceRefs=[]로 제한하고 미연결을 표시한다.
- 정확 draft 현재 head/hash, 확정 계획·설계/적용 단계와 기존 초안 basis를 다시 확인한다. 빠진 내용/실행 미확인을 숨기지 않는다. 본문 완결성과 아직 없는 실행 준비 상태는 별도 목록이다.
- REVIEW는 새 불변 판단 이력만 저장한다. 최신 판단 순서는 프로젝트 감사 순번이며 사용자 시각으로 선택하지 않는다. 같은 작성자/검토자 여부를 표시하고 독립 검수라고 꾸미지 않는다.

### 2. 별도 내용 확정

새 project command confirmAssignment: targetId=draftRef.id, expectedVersion=draftRef.version, payload={draftRef,reviewRefs,reason,acknowledged:true}. 현재 head/hash·모든 내용 필수 항목과 최신 ACCEPTED 검토·참조 정확성·현재 권한을 다시 확인한다.

- 빈 purpose/goal/입출력/완료·검수/포함·제외/책임 같은 내용 누락이나 계획/적용 단계의 실제 불일치는 확정 거절이다.
- allowedScopes 자체가 비어 있는 것은 내용 누락으로 거절한다. 유효 FILE 선언이 있어도 실제 소스 관측/접근 권한·단일 writer 회수는 별도 미검증이다. reviewRefs는 같은 프로젝트·정확 초안/기준1·실제 저장 HUMAN 검토를 조회해 확인하고, 최신 판단이 적합하지 않으면 과거 적합 참조로 확정할 수 없다.
- 환경/능력/예산/기록 정책/소스 관측·맥락 이해·OS 소유·실행 허가 미검증은 그대로 보존한다. 내용 확정을 전체 ready나 실행 승인으로 승격하지 않는다. 기존 검사·등록/승인 우선순위는 느슨하게 바꾸지 않는다.
- 결과는 새 불변 AssignmentVersion: ref(id=draft ID,version=draft 버전,contentHash=확정 snapshot SHA256), draftRef, definition, reviewRefs, reason, confirmedBy, confirmedAt, contentConfirmed:true, readinessIssues, ready:false, executionAuthorized:false, dispatchPerformed:false. draftRef와 확정 ref는 저장 종류와 hash가 다르며 화면/소비자에서 구별한다.
- 같은 초안/버전의 확정은 한 번이며 같은 commandId 재확인은 원 영수증이다. 다른 명령 중복/옛 head·다른 hash는409, 내용 누락/부적합 검토422, 없는/교차 자료404다.
- 초안 ref와 확정 ref는 공통 VersionRef에 종류를 덧붙이지 않는다. 소비 연산의 draftRef/assignmentRef 의미와 전용 조회 경로로 종류를 고정하고 id/version만으로 조회·치환·캐시하지 않는다. 캐시 key는 주체·project·종류·전체 ref(id/version/hash)를 포함하며, 확정 snapshot의 draftRef와 반환 확정 ref를 각각 전체 대조한다. UI는 ‘초안 원본’과 ‘내용 확정 임무’를 별도 표기한다. 다른 hash를 같은 원문으로 취급하거나 확정 ref를 초안 GET에 자동 fallback하지 않는다.
- 새 초안을 만들더라도 과거 확정/검토는 삭제·덮어쓰지 않는다. 역할 binding/Agent 세션·실행/기준 전환/부모·하위 임무는 만들지 않는다.

### 3. 읽기·저장·보안

- 기존 draft GET/응답은 그대로 둔다. 새 GET assignment-drafts/:id/versions/:v/decision은 정확 초안·기준6/검토·내용 유효성·확정 ref/미확인을, assignments/:id/versions/:v는 불변 확정 snapshot을 반환한다. no-store·현재 회원/주체 검사·교차 프로젝트 거절을 유지한다.
- 새 forward migration 후보에 assignment_content_reviews / assignment_versions 2표만 제안한다. 후자는 draft(project,id,version) FK·확정 snapshot/hash·검토 refs·actor/client/command·confirmation ID를 불변으로 저장한다. 기존 SQL/초안 표·프로젝트/원문을 고치지 않는다.
- 두 표 INSERT는 현재 명령/허가 영수증·별도 명시 연산 정책·OWNER/current client/control·세션/정책 기한·감사·정확 draft/hash·검토/영수증 결박을 DB guard까지 검사한다. app에는 필요한 SELECT/INSERT만 주고 UPDATE/DELETE는 주지 않는다.
- 실제 사용자에게 정책을 자동 부여하지 않는다. REQUIRE_APPROVAL 미연결 연산은 거절하고 AUTO로 바꾸지 않는다. 임무 내용 확인 checkbox는 외부 실행 일회 승인을 대신하지 않는다.
- 기준6 항목의 의미 적합은 사람 판단이다. 구조/참조 검사가 그 의미 판단의 정답이나 Anvil 헌법 준수/Agent 전달을 증명하지 않는다.

## 화면·최소 검증과 경계

UI04 고정 임무에서 ‘내용 검토 준비→6항목 판단 저장→별도 확정 확인→확정 원본 재조회’를 연결한다. 원입력/미확인 command·주체/client/project 경계·정확 버전/유실 후 같은 명령·권한 거절 시 이전 원문 제거를 유지한다. 내용 확정과 미검증 실행 조건을 함께 표시한다.

필수 후보 검증은 누락/구버전/교차 프로젝트·잘못된 판단/자동 적합·명령 재사용/응답 유실·위조 영수증/직접 무권한 INSERT 거절, 불변 과거 버전, 정확 참조와 현재 세대, 인접 초안 동작이다. 새 빈 격리 QA만 이름/소유/수명/정리를 먼저 등록한다. 후보 unit/fixture·격리 PG 결과를 정식 DB·실제 Agent·served/사용자 인수로 승격하지 않는다.

권장 결정 범위 A: 이 상세 계약 검토·필요 보완 후 코드/API/forward SQL/화면·격리 후보 검증까지만 허용. 정식 DB 적용·계정/정책/Secret·서비스·Agent 호출/전달·비용은 별도다. B: 상세 계약만 보존하고 해당 새 API/저장 구현 보류. 이는 다음 작업 배정 요청이 아니라 새 데이터/API 경계 결정이다.

후속 FN05 buildTaskContext에는 확정 AssignmentVersion·실제 목적/헌법·최신 관련 지시·현재 위치/완료·미완료와 예산 원본이 더 필요하다. 이 제안 하나로 그 선행 전체를 충족했다고 하지 않는다.
