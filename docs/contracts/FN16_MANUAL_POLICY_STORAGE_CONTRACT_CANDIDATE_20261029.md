# FN16 수동 백업 정책 저장·조회 한정 계약 후보

2026-10-29 / Main 어울 / 기준 codex/av3-stage-b 86711e00 / NOT_ADOPTED — 상세 검토용, 제품 GO 아님.

## 1. 기존 근거와 새 변경점
기존 P02 INTERFACES §14.1의 saveBackupPolicy와 BackupPolicyVersion, FUNCTION_WORK FN16/UI14의 사용자가 소유하는 원본 보존을 구체화한다. 717496CD 후보 전체나 createBackup/job/암호화 archive/복원까지 채택하지 않는다. 기존 보호 참조 CA777, 설치 자원5A6819, 검사 프로필08EA A8을 유지한다.
새 delta는 저장 명령의 닫힌 payload/결과, GET 2개, 불변 정책 영속 구조와 저장 시 전체 coverage 조건이다. 실제 키·DB 적용·GRANT 실행·사용자 정책 부여·서비스·Agent·P03·외부 비용은 제외한다. 코드/화면/미적용 forward SQL/메모리 합성 시험 후보이며 아직 구현하지 않는다.

## 2. 저장 입력과 의미
기존 PROJECT 명령 외피의 operation=saveBackupPolicy를 사용한다. payload={policy,previousRef,reason}. reason은 기존 backupText 1~2000자로 비어 있거나 제어문자/알려진 비밀 표식이면 거절한다. previousRef는 최초 null, 개정은 같은 프로젝트 정책의 현재 정확 VersionRef다. 최초 targetId=null/expectedVersion=0, 개정 targetId=previousRef.id/expectedVersion=previousRef.version. 새 논리 정책 ID는 서버가 발급한다.
policy 필드는 P02와 동일하게 targetProtectedRef,include,schedule,maxBytes,retentionPolicyRef,encryptionKeyRef,verificationPolicyRef만 허용한다. 네 ref는 보호 참조 ReferenceView의 정확 ref이며 raw 경로/키/설치 handle/환경변수 입력이 아니다.
include는 documents,conversations,knowledge,decisions,plans,results,artifacts의 명시 boolean과 sourceSelection으로 닫는다. 하나 이상의 자료군을 선택해야 한다. 최초 sourceSelection={kind:NONE}만 지원하는 후보이며 실제 소스 포함은 미지원으로 명확히 표시/거절한다. 이 필드 형태는 신규 delta다. 미선택 자료군은 영향 preview에 명시하고 선택 자료의 필수 관계 누락을 선택 해제로 숨기지 않는다.
schedule=MANUAL만 허용, 자동 실행/삭제를 생성하지 않는다. maxBytes는 양의 안전정수로 입력하되 서버의 승인된 설치/프로젝트/검사 공급 한도의 최솟값 이하일 때만 저장한다. 현재 정책 기본 10GiB를 백업 한도로 자동 전용하지 않으며 실제 한도 설정/발급은 이번 범위가 아니다. 유효 한도 근거가 없으면 412다. 본문 상한은 기존 서버 2MiB를 유지한다.
저장 성공은 불변 설정 보관일 뿐 파일 생성·backup 준비완료·전체 FN16 완료가 아니다. 그러나 '설정만 저장'을 이유로 아래 coverage 검사를 생략하지 않는다.

## 3. 저장 전·commit 전 필수 검사와 미정 범위
현재 로그인·OWNER·프로젝트 보관상태·단독 client/control 세대·명시 정책·원명령/기한/CSRF·정확 이전 ref를 기존 경로에서 검사한다. DENY/정책부재는 거절하고 REQUIRE_APPROVAL은 같은 transaction에서 정확 후보/명령/기한의 일회 검증·소비를 연결한다. 실제 사용자 정책을 자동 부여하지 않는다.
선택 ref 네 종류 TARGET/ENCRYPTION_KEY/RETENTION/VERIFICATION의 종류·프로젝트·불변 hash·회수·현재 적합성을 검사한다. RETENTION은 automaticDeletion=false여야 한다. 유효한 과거 exact 버전을 단지 최신이 아니라고 거절하지 않되 현재 새 정책에 사용 가능한지 공급자가 확인해야 한다. 키 원문은 읽거나 응답하지 않는다.
08EA A8에 따라 SELECTED_FILES_V1은 전체 정책 저장에 불충분하여 반드시 412 BACKUP_POLICY_COVERAGE_UNAVAILABLE다. DRAFT/저장전용 이름으로 우회하지 않는다. 문서 collector 같은 개별 내부 합성 PASS도 전체 프로필 발급 근거가 아니다.
필요한 검증 능력은 선택 자료군과 그 필수 교차참조의 DB/schema·역사 무결성, 불변 원문 bytes/hash와 격리 상태, 키 가용성, 암호화 bundle 인증/형식, 검증 복원 비교다. 이 목록은 요구사항이며 새 공개 checks ID·실행 가능 프로필을 발급하는 정의가 아니다. 전체 프로필의 구체 checks/지원 버전·한도·출처 근거 계약은 아직 미정이므로 기본 실제 공급자는 거절한다.
후속 source 검증을 위한 내부 신뢰 포트는 정확 project/actor/client/control·정책 canonical hash·네 ref·include·한도·공급 세대를 결박한 관측과 재대조 기능을 갖춰야 한다. 클라이언트가 이 포트를 선택하거나 READY/boolean을 넣을 수 없다. 메모리 합성 포트로만 정상 저장을 검증하고 실제 설치 프로필로 등록/발급하지 않는다. 실제 전체 공급자 계약이 미정인 상태의 생산 저장은 차단 유지한다.
쓰기 직전과 성공 receipt/audit 저장 후 commit 직전에 동일 ref/coverage·한도·공급 세대·현재 권한을 재검사한다. 회수·바뀜·검증 불명은 transaction 실패로 처리한다. 외부 공급과 DB commit의 원자성을 주장하지 않으며 저장 뒤 상태 변화는 조회 current에 표시한다. job이 별도 도입될 때 실행 직전 다시 검증해야 한다.

## 4. 결과·조회 API 후보
P=/api/v1/projects/:projectId. 기존 cookie 로그인, 상대 URL, OWNER/민감 자료 접근, no-store, 다른 프로젝트 404를 유지한다. 조회에는 제어권을 요구하지 않으며 connector credential로 접근하지 않는다.
- 기존 POST P/commands의 saveBackupPolicy: 기존 command receipt data={status:BACKUP_POLICY_STORED,ref,previousRef,backupCreated:false,executionAuthorized:false}. 동일 원명령/같은 본문은 현재 접근 재검사 후 동일 receipt를 반환하고 두 번째 승인 소비/버전을 만들지 않는다. 같은 ID/다른 본문은 기존409 COMMAND_CONFLICT다. UNKNOWN이면 새 명령 자동 생성/재송신0.
- GET P/backup-policies: query={limit?,cursor?}만. 기본50/최대200, cursor4096자/30분은 기존 backup reference 규칙 재사용. 별도 domain/project/actor/client/limit/order와 마지막 ref.id ASC/version DESC를 서명에 결박한다. 동일 id/version의 다른 hash는 저장 손상으로 거절. 전체 시점 snapshot을 보장하지 않는다.
- GET P/backup-policies/:id/versions/:version: query 없음, 정확 고정 버전만.
PolicyView={ref,snapshot:{policy,reason},previousRef,createdAt,commandRecordId,clientCommandId,current,preview}. current={eligible,reasonCodes,observedAt}; preview={includedGroups,excludedGroups,sourceIncluded:false,backupCreated:false,executionAuthorized:false}. 새 reasonCodes 후보: BACKUP_POLICY_REFERENCE_UNAVAILABLE, BACKUP_POLICY_COVERAGE_UNAVAILABLE, BACKUP_POLICY_LIMIT_UNAVAILABLE. 성공 저장 뒤 회수된 과거 본문은 삭제하지 않고 current.eligible=false로 조회한다. 과거 저장 사실과 현재 사용 가능성은 분리한다.
새 저장 입력400, 인증401, 정책403, 다른 project/부재404, CAS/명령충돌409, 공급/coverage/한도미확인412, 저장 손상·회수불명503. 원 SQL/경로/키/내부 오류 메시지는 공개하지 않는다. 최종 reasonCode 기존도메인 재사용 여부는 구현 전 route/mapper 대조로 고정한다.

## 5. 미적용 영속 구조 후보
신규 forward SQL만 작성하고 기존 SQL·manifest 적용목록은 변경하지 않는다. 정확 번호는 실제 전체 migration 목록에서 미점유를 확인한 뒤 고정한다.
- backup_policies: project_id/id/head_version, PK(project_id,id). head는 명령 CAS에서만 변경.
- backup_policy_versions: project_id/policy_id/version/content_hash/snapshot_json/previous_ref/command_id/created_by/client_id/created_at. PK(project_id,policy_id,version), 정확 ref UNIQUE, server command ID UNIQUE 및 같은 프로젝트 commands FK. version1 previous null, 후속은 같은 id의 직전 exact ref. snapshot은 닫힌 policy/reason이며 hash=canonical({projectId,id,version,snapshot,previousRef}).
모든 행은 기존 OWNER RLS 강제, immutable version UPDATE/DELETE 금지, head의 허용 열만 명령·현재 control/명시 policy/승인·receipt/audit 귀속 검증을 통과해야 변경 가능. app 기본 CRUD는 회수하고 필요한 SELECT/INSERT/head update만 미적용 SQL에 명시한다. 실제 GRANT 실행은0. 다른 사용자/프로젝트를 자동 등록하지 않는다.
기존 authorization receipt/approval consumption/audit를 같은 transaction에 결박하고 원문 policy/hash 및 성공 receipt와 대조한다. 재생성 가능한 현재성 관측을 영구 승인 증거로 바꾸지 않는다. 목록은 역사 이력이며 활성 policy 포인터/스케줄/job을 새로 만들지 않는다.

## 6. UI14와 검수 단위
기존 선택 원문 반출·보호 참조·설치 자원 화면을 보존한다. 별도 '수동 백업 정책'에서 네 종류 참조 목록→정확 버전 명시 선택→포함/제외·수동/용량 입력→준비→필요한 별도 승인→원명령 명시 저장→고정/과거 조회를 연결한다. 선택/편집/조회만으로 POST/승인/키 입력/실행0. 미지원 전체 검사 프로필이면 이유를 표시하고 저장을 막는다. 합성 지원 포트를 실제 선택 목록으로 만들지 않는다. 응답 유실은 같은 원명령 재확인으로만 진행한다. sourceSelection NONE과 전체 백업 생성 미구현을 화면에서 숨기지 않는다.
검수: 정상 불변 저장/개정·고정·목록/replay, SELECTED_FILES 거절, 네 ref 종류/프로젝트/hash·회수·동시 head 변경·commit 전 coverage 변화, 정책없음/옛 세대/만료/중복소비, SQL 원자rollback/회수불명, 민감 응답 비노출, UI edit→승인복귀→별도 저장→재조회/UNKNOWN·인증세대/화면이탈 반례. 기본 실제 공급 부재에서 저장412 유지도 필수다. 시험은 메모리/합성 HTTP·브라우저이며 실제 DB/키/서비스/backup·복원은 NOT_RUN이다.

## 7. 채택 전 남은 결정·복구
현재 정책 저장·GET·영속 계약을 위와 같이 source 범위에서 채택할지 검토가 필요하다. 전체 프로필 실제 어댑터/checks·nonce/archive·job·복원 계약은 미정으로 남긴다. 이 후보가 그 범위 승인이나 운영 준비를 대신하지 않는다.
Main은 독립 검토 후 정확 허용 파일/변경 전 hash·WI를 고정하고 기존 primary에만 순차 위임한다. 미채택인 동안 제품/SQL/화면 변경0, 현재 baseline collector는 계속한다. rollback은 해당 source의 검토된 revert이며 기존 데이터·키·권한·백업 삭제0. 실제 적용 후 rollback 정책은 별도이며 이미 적용한 migration을 지우는 방법을 제안하지 않는다.
