# FN16 수동 백업 정책 저장 r2 — 한정 결정안

2026-10-31 / Main 어울 / NOT_ADOPTED. 제품 GO 아님. 기존 후보 docs/contracts/FN16_MANUAL_POLICY_STORAGE_CONTRACT_CANDIDATE_20261029.md SHA158E10BC019C2647E488703865C12FA16AE008997CEF34CEBB431BF1C8D165D7의 저장·조회·UI 계약을 유지하고 아래 두 미정을 닫는 제안이다. 기존 원문 후보는 수정하지 않는다.

## 판정·선택

현재 saveBackupPolicy와 정책 GET2·정책표는 미구현이다. 기존 선택 원문1개 exportProject와 다른 기능이다. 기존 Primary의 실제 caller 대조와 Reviewer C0/I2에서 승인 후보 원문/보호조회와 누적 한도가 미정임을 확인했다.

- A안 권장: 아래 r2와 기존 후보를 합쳐 코드·화면·미적용 SQL·합성 검증을 채택한다. 새3표이며 기존 일회 승인 절차를 사용한다. 실제 전체 coverage 공급자가 없어 생산 저장412는 유지하므로 실제 백업 사용 완료가 아니다.
- B안: 현재 미채택을 유지하고 전체 backup/job/키 보호/복원 계약까지 함께 결정한 뒤 정책 저장을 구현한다. 한 번에 실제 여정을 정할 수 있으나 이번 source 구현도 늦어진다. 기존 선택 원문 반출은 그대로 유지한다.

어느 안도 실제 DB·권한·키·사용자 파일 조사·서비스·Agent 실행이나 기존 프로젝트 차단 해제를 승인하지 않는다. A는 기존 계획 재승인이 아니라 새 저장/조회·승인 후보·누적 상한 계약 차이의 채택이다.

## 1. 승인 후보 보관·보호 조회·소비

기존 requestApproval의 {details,candidatePayload} 패턴을 사용하되 prepareExecution용 표·분기·validator를 정책 보관에 그대로 쓰지 않는다. 새 backup_policy_approval_candidates에 별도로 보관한다. 기존 승인 요청/결정/소비 API와 현재 사용자·client·제어 세대·명시 정책·기한·CSRF·DENY를 유지한다. saveBackupPolicy만 기존 consumable operation에 추가하며 다른 연산의 승인 가능 범위를 넓히지 않는다.

candidatePayload는 기존 후보의 닫힌 저장 payload={policy,previousRef,reason} 전체다. raw 경로·키/Secret·handle·평문 백업 자료를 넣지 않는다. details.actionScope는 operation=saveBackupPolicy, 정확 project·요청 HUMAN user/client/control·candidateCommandId·payloadHash와 target/expectedVersion을 결박한다. 최초 targetRef=null/expectedVersion0, 개정 targetRef=previousRef 전체/version=expectedVersion이다. 사용하지 않는 sourceScopes/baselineRefs는 빈 배열, environmentRef/limitsRef는 null로 닫는다. policy의 네 ref·선택 자료·maxBytes는 payload hash에 포함되고 기존 최초/개정 CAS 규칙을 그대로 사용한다.

requestApproval의 현재 command와 details·candidatePayload canonical hash/크기·후보 원명령 ID/개정 fullref가 일치해야 capture한다. 현재 사용자 소유·같은 project의 보호 조회에서만 새 후보 원문을 반환한다. 기존 승인 상세 GET의 operation별 후보 DTO를 확장하여 {candidateCommandId,payloadHash,payload}를 제공하며 새 별도 공개 endpoint는 만들지 않는다. 정확 부모 request/원 requestApproval command·request hash·작성자/client/control·policy·scopeDigest를 재조합 검산한다. 다른 project/사용자·변조/누락 후보는 성공/빈 후보가 아니라 거절한다.

UI08은 hash만 표시하지 않고 자료 포함/제외, sourceSelection NONE, MANUAL, maxBytes, 네 보호 ref의 정확 버전·이전 ref·변경 이유를 모두 확인할 수 있어야 한다. 조회·검토가 저장이나 결정으로 이어지지 않는다. 승인 후 UI14로 돌아와 같은 고정 원명령을 사용자가 별도 저장한다. 편집·개정 fullref/세대 변경·만료는 옛 승인을 재사용하지 않는다.

REQUIRE_APPROVAL만 같은 transaction에서 정확 원명령/내용/버전/기한에 한 번 소비한다. AUTO는 별도 승인을 임의 생성하지 않고 기존 명시 정책대로 저장한다. 같은 원형 replay는 현재 접근과 원 receipt/후보/소비 근거를 재검산하고 추가 버전·후보·소비를 만들지 않는다. 다른 내용/명령 재사용·UNKNOWN 새명령 자동전송은 금지한다. 저장 전/commit 전의 참조·coverage·한도 재검사는 원 후보대로 유지한다.

## 2. 새3표와 누적 보존 한도

기존 후보의 backup_policies/backup_policy_versions에 위 backup_policy_approval_candidates를 추가한 정확 새3표다. 기존 적용 SQL/부모표를 재작성하지 않는다. 번호·허용경로는 채택 후 실제 부재 확인과 WI에서 고정한다. 실제 SQL 적용·GRANT 실행은 없다.

후보 표는 project_id/request_id/request_command_id/candidate_command_id/payload_hash/payload_json/created_by/client_id/control_generation/policy_ref를 보관한다. 원 request의 PK·서버 command FK를 실제 기존 DDL와 대조하고 fullref·scope·원문 hash·원 receipt/audit의 양방향 완결을 검산한다. 불변 후보/버전의 UPDATE·DELETE·TRUNCATE를 허용하지 않는다. head는 정확 원명령·이전 버전·승인/receipt/audit를 검산한 CAS 갱신만 허용한다. 원래 일반 승인·DRAFT·다른 operation은 보존한다.

권장 상한은 프로젝트별 새3표 합산10000행·67108864bytes다. 자동 삭제/만료 이력 제외/한도 초기화는 없다. 기존0059 원본 용량에 임의 kind를 추가하지 않으며 전체10GiB coverage나 SQL물리 bytes를 증명한다고 하지 않는다.

행 수는 head·모든 불변 버전·모든 후보의 합이다. bytes는 서버가 만든 닫힌 보관 DTO의 canonical JSON UTF-8 합으로 계산한다. head 투영={projectId,id,headVersion}; 버전 투영은 기존 PolicyView의 ref/snapshot/previousRef/createdAt/commandRecordId/clientCommandId에 projectId/createdBy/clientId를 포함하며 재생성 current/preview는 제외한다. 후보 투영은 projectId/requestId/requestCommandId/candidateCommandId/payloadHash/payload/createdBy/clientId/controlGeneration/policyRef다. 입력 charge를 신뢰하지 않는다. 정확 저장 열·projection codec/hash를 WI/신규 SQL에 동일하게 고정한다.

새 head/버전/후보는 전량 추가한다. head 갱신은 기존 투영 bytes를 빼고 새 투영 bytes를 더하며 행 수는 늘리지 않는다. 같은 원형 replay는 추가 charge0이다. project 잠금 뒤 기존+변경후 총량을 계산해 cap까지 허용하고 초과는 승인 요청/후보/정책/receipt/audit/소비 전체 transaction을 실패시킨다. 후보와 정책 저장이 별도 command이면 각 command의 원자 범위만 주장한다. 기존 보관 후보를 새 저장 성공 때 삭제하지 않는다.

## 3. 범위·검수·미검증

기존 GET2/입출력/UI14와 보호 참조·SELECTED_FILES_V1 거절/실제 공급 부재412는 원 후보대로 유지한다. 새 source-only 정상 시험은 명시 메모리 coverage 포트를 사용하며 제품 app의 실제 프로필·키·한도 근거를 발급/주입하지 않는다. 키 가용성 표식이 실제 키 읽기 증거라는 주장은 하지 않는다.

최소 반례는 후보 원문/hash/fullref/다른 project·세대·기한/일회 중복·UNKNOWN·누락 receipt/audit, 같은 원형 replay0, cap-1/cap/cap+1/누적 이력/head bytes 차액/상한 대기 뒤 변화, 현재 coverage/참조 회수·SQL reverse 분류/무관행 보존, UI 편집/늦은 응답/승인복귀와 별도 저장이다. 실제 PG구문·FK/trigger·원자성/경합, 실제 서비스/UI·키/파일/backup/job/복원/Agent는 미검증이다.

기존 Primary 단일 writer·Main 검수통합·기존 Reviewer 독립검수를 유지한다. 채택 전 코드/SQL/화면 GO0. Main은 채택 후 정확 허용 파일·시작지문/WI를 고정하고 구현을 위임한다. rollback은 새 source commit 일반 revert이며 실제 DB/자료/키 삭제는 없다. 전체 FN16/계획 완료로 source 합격을 승격하지 않는다.
