# FN16 복원 시 역사 주체·원형과 현재 자료의 분리 — 결정 후보

2026-10-31 / Primary 어울 / Main 검토용.

**상태: NOT_ADOPTED / 실행 GO0.** 이 문서 작성만 승인됐다. 새 형식·역사주체 저장·계정·권한·복원 동작을 채택하거나 구현하지 않는다. 코드·시험·SQL·Git 변경 및 실제 DB·키·사용자 파일 조사·서비스·Agent·백업/복원 실행은 없다.

## 1. 결정할 문제

백업에서 계정·Secret 자체를 제외하면서 원자료의 UUID/FK·불변 snapshot hash를 보존하려면, 과거 자료의 주체와 현재 로그인 사용자를 분리해야 한다. 원문 안의 주체 UUID를 현재 사용자 UUID로 치환하면 일부 snapshot hash와 원승인·receipt·감사 연결이 달라진다. 반대로 원UUID 행을 현재 anvil 표에 그대로 넣으면 users/clients FK가 요구되는 곳이 있다.

권장안은 **A의 비권한 원이력을 보존한 뒤, 재사용할 업무 자료만 B의 새 현재 자료로 명시 파생하는 결합 방식**이다. 원본 검산과 현재 작업 재개를 별도 결과로 다룬다. 이 권장안은 아직 신산님이 채택한 계약이 아니다.

동일 Anvil에서 Agent·LLM·세션을 교체하는 것은 이 복원 문제가 아니다. 이미 남아 있는 프로젝트·헌법·지식·원문을 현재 권한으로 다시 조회해 인계하는 흐름이며, 백업 복원이나 계정 재생성을 Agent 교체의 필수 선행으로 만들지 않는다.

## 2. 정본과 확보한 실제 근거

- 설계 `docs/design/Anvil_설계서_v3_초안.md` §10.4/§10.5, `docs/work_packages/FUNCTION_WORK.md:199` FN16: 원본/관계 보존·제외 이유·별도 키 이전·검증 복원 선행, 민감 원문과 대체본의 별도 식별.
- `docs/contracts/INTERFACES.md:1059~1068` §14.1: 별도 검증 위치에서 manifest/hash·자료/참조·본문·schema를 검사한다. 실제 적용은 영향/승인과 현재 상태 재검증을 거치며 인증 token·초대·기존 승인/writer 권한을 자동 복원하지 않는다. 과거 실행/승인은 조회 이력이다.
- A1 `docs/contracts/FN16_FULL_BACKUP_DATA_MAPPING_CANDIDATE_20261031.md:79~84,162~167`: 계정/credential/key 자체 비반출, source hash와 익명/제외 투영 구별, 역사 FK 및 현재 권한 row 처리는 후속 대조 대상이다. A1 자체는 부분 후보다.
- A3/A4 `docs/contracts/FN16_ENCRYPTED_BUNDLE_RESTORE_FORMAT_CANDIDATE_20261031.md:15,32~38,49~55`: originProjectId, source hash/export projection hash 구분, 비활성 출처 이력 원칙과 별도 검증 대상이 제안돼 있다. 역사주체 namespace/FK·현재 로그인 매핑의 정확 codec·정책은 정해져 있지 않다.
- 아래 근거는 실제 source 읽기 기준 `6c643577b4a09f1be37094a33b0412c0ab9da65d`에서 대표 계열만 확인한 것이다. 전체 schema 전수 대조나 실제 적용 DB 확인이 아니다. `.sql` 원문 존재를 DB 적용 증거로 삼지 않는다.

| 대표 자료 | 실제 FK와 주체 저장 | producer/reader의 hash·관계 결박 |
| --- | --- | --- |
| 문서 head/버전 | `db/migrations/0003_project_documents.sql:4,14~15`: documents.created_by→users, document_versions.client_id→clients 및 command FK. 버전에는 author_ref_json도 있다. | `apps/server/modules/documents/project-documents.ts:185,189,204`: 문서 contentHash는 title/formRef/stageNodeRef/content를 대상으로 하므로 author_ref_json이 직접 hash 안에 있는 것은 아니다. 그러나 원 author/client는 명령·receipt·감사 및 이벤트에 남는다. 주체 치환의 영향이 모든 contentHash에 동일하다고 단정하지 않는다. |
| 임무 내용확정 | `db/migrations/0013_assignment_confirmation.sql:10~17`: assignment_versions의 (created_by,client_id)→clients(user_id,id), 원 draft/command FK. | `apps/server/modules/assignments/project-assignment-confirmations.ts:196~200`: confirmedBy.userId를 포함한 snapshot 전체 hash. reader `:94,121~124,215`는 원행/원command·receipt·감사 주체를 대조한다. |
| 승인 요청/결정 | `db/migrations/0011_authorization.sql:32~49`: created_by/decided_by→users, 결정의 user/client 복합 FK. `0011_one_time_approval_requests.sql:2~7`: 요청의 user/client 복합 FK와 원command·request_json 추가. | `apps/server/modules/approvals/project-approvals.ts:88,110,157`: 요청 snapshot에 requestedBy user/client·requiredDecider·actionScope 주체, 결정 snapshot에 decidedBy user/client가 포함된다. 원주체 치환은 hash·scopeDigest·원요청/결정 참조에 영향을 준다. |
| 명령/receipt/감사 | `db/migrations/0011_authorization.sql:17~30,58~80`: commands.actor_id→users 및 (actor_id,client_id)→clients, audit_events.client_ref→clients와 command FK. actor_ref/subject_ref는 JSON이다. | `apps/server/modules/access/project-command.ts:113~116`: scopeDigest에 actorId/clientId·controlGeneration·requestHash·정책/대상 ref가 결박된다. `apps/server/modules/backups/project-control-ledger-inventory.ts:72`는 저장된 scope를 재검산한다. audit_events에는 독립 content_hash 열이 없으므로 이를 snapshot 전체 hash라고 부르지 않는다. |

`db/migrations/0001_projects_access.sql:1~12`의 users는 로그인명·표시명·상태·credential generation/server owner를 가진 계정이고 clients.user_id는 users FK다. 이 구조의 users/clients 행을 과거 FK 충족용으로 임의 생성하는 것은 계정 자체 비반출 문제를 해결하지 않는다.

일부 양식·방법론에는 origin_ref_json이 있고 A3/A4에는 originProjectId가 있지만, 이 필드들이 전체 역사주체를 현재 계정으로 매핑하는 계약은 아니다. 확보한 정본/소비선에서 A/B 중 하나나 전역 주체 변환 방식이 이미 채택됐다는 근거는 확인하지 못했다.

## 3. 공통으로 지킬 조건 — 제안

1. **역사 주체 식별과 계정을 구별한다.** 과거 user/client UUID를 허용한다면 비활성 역사 참조의 opaque ID로만 취급한다. 로그인명/암호·인증/세션·credential·계정 상태/권한 자체를 동반하지 않는다. opaque ID라는 표기만으로 익명화·식별 가능성 제거가 보장되는 것은 아니다. 원UUID의 이 한정 보존 허용 여부도 이번 채택 대상이다.
2. **출처와 현재 권한을 분리한다.** 원UUID·원작성자·과거 OWNER·동일 표시명/같은 UUID·번들 소지·매핑 값은 현재 접근/소유 권한이 아니다. 검증 대상/현재 프로젝트의 접근·소유·적용 가능 여부는 현재 인증과 명시된 권한으로 별도 확인한다. 과거 주체를 현재 actor로 위장해 기존 인증/RLS 검사를 통과하지 않는다.
3. **원형은 원형대로 보존한다.** 허용된 원 snapshot/원 UUID·ref/hash는 변경하지 않는다. 비밀 제외 투영은 별도의 projection hash와 제외 이유를 가진다. 원문이 제외됐다면 hash만으로 원문 복원을 완료했다고 하지 않는다. 원문 내 Secret 발견은 기존 §10.5의 제한/격리·별도 대체 절차 대상이며 조용한 마스킹/재봉인으로 없애지 않는다.
4. **원승인·원명령을 재사용하지 않는다.** 과거 APPROVED/CONSUMED/APPLIED, 제어 generation, grant/permit/writer, credential, quota VERIFIED/예약, outbox는 조회 사실이다. 이를 현재 권한·승인·실행·재전송으로 활성화하거나 원명령을 재전송하지 않는다. 새 현재 작업은 현재 계약에 따른 별도 명령·필요한 승인/기한/기준 검사를 거친다.
5. **이력 연결만으로 현재 실행하지 않는다.** 현재 사용자와 역사주체 사이의 연결을 나중에 확인하더라도 원기록의 작성자를 바꾸거나 그 사람의 과거 승인 권한을 현재 사용자에게 이전하지 않는다.

## 4. 방식 A — 원UUID·원형을 비권한 역사로 보존

### 보존 범위와 필요한 계약

- 원 project/자료 ID·버전·원주체 ID·snapshot·원 hash·원참조·원명령/receipt/감사 관계를 검산 가능한 역사 집합으로 남긴다. 계정/Secret 자체와 활성 권한은 포함하지 않는다.
- source/history namespace는 원자료 출처와 현재 대상의 식별을 분리해야 한다. 어떤 출처 식별/고정 관측/번들 근거를 신뢰할지, 그 식별을 어떻게 결박할지는 A1/A2/A4의 추가 계약이다. originProjectId나 번들 내부 자기주장 하나만으로 출처의 진위를 증명하지 않는다.
- 최소 충돌 규칙 제안: 같은 namespace·자료종류·ID·버전의 다른 hash는 충돌로 거절하고 자동 덮기/병합하지 않는다. 다른 namespace의 동일 UUID는 같은 자료/사람으로 자동 합치지 않는다. 동일 hash 재수입의 중복/재개 처리도 별도 유한 규칙이 필요하다.
- 역사 참조의 논리적 FK와 원 graph를 검산하되, 현재 users/clients FK를 만족시키려고 가짜 계정을 만들지 않는다. 별도 비활성 역사 보관/조회 영역과 그 참조 검산 방식이 필요하다. 구체 schema/table/API·정렬·exact codec·행/bytes 상한은 아직 미정이다.
- 기존 author/UUID를 현재 로그인 사용자와 연결하는 절차는 역사 원문 밖의 별도 정보여야 한다. 누가 어떤 근거로 연결/철회할지, 읽기 범위와 충돌/다중출처를 어떻게 처리할지는 미정이다. 연결이 없어도 허용된 역사 검산/조회와 현재 소유권 검사는 분리한다.

### 실제 결과와 한계

원본의 역사·hash 검산을 보존하기 좋고, 원주체를 바꿔 새 승인을 만든 것처럼 오인할 위험을 줄인다. 그러나 비활성 archive만 생겼다면 현재 편집·계획·연결 화면에서 작업을 재개할 수 있다는 뜻은 아니다. 현재 원문 조회·참조 탐색 기능 자체도 실제 구현/검수가 필요하다. 기존 active anvil 표의 FK·현재 reader를 그대로 쓸 수 있다고 가정하지 않는다.

## 5. 방식 B — 현재 쓸 자료를 새 ID/hash로 파생

### 파생 범위와 필요한 계약

- 재사용할 문서/지식/계획 등 업무 자료를 명시 선택한 뒤 현재 자료로 새로 만든다. 대상 project/ID·현재 작성 주체·버전·hash·참조가 원본과 달라질 수 있다. 과거 계정을 되살리는 방식이 아니다.
- 원문에 있는 ID/주체/참조를 바꾸면 해당 snapshot뿐 아니라 이를 가리키는 ref·선택검토·결정·scope digest 등 연쇄 관계가 달라질 수 있다. 자료종류별 변환 순서·의존성 폐쇄·변환 불가/외부 참조·실패 처리와 reader 호환을 고정해야 한다. 일괄 UUID 문자열 치환이나 기존 hash 재사용은 허용하지 않는다.
- 원본 출처는 원 namespace·ref/hash·허용된 원문과, 별도 파생 ref/hash·변환기 버전·변환/제외 이유로 구분해야 한다. 이 필드들의 정확 형식과 검산/보관 계약은 미정이다. source hash와 derived/projection hash를 하나로 취급하지 않는다.
- 새 현재 자료의 작성/편집/확정·권한 부여·적용은 현재 사람의 명시 작업과 현재 정책을 따른다. 원래 승인/감사/APPLIED 명령을 새 사람·새 명령의 승인 이력으로 변환하지 않는다. 원서명/증빙도 파생본의 진위를 자동 보증하지 않는다.
- 원문을 별도 출처로 보관한다고 해도 계정/Secret 비반출 원칙은 유지한다. 원문을 보관할 수 없는 자료는 그 사실과 검증 공백을 남기며 원 hash만으로 전체 원형을 복원했다고 하지 않는다.

### 실제 결과와 한계

현재 도구의 새 자료로 연결할 수 있는 방향이지만, 지원하는 자료종류/관계의 실제 변환기와 편집·조회 소비선이 필요하다. 현재 실제 identity와 별도 적용 권한 없이 이를 자동 생성하지 않는다. 파생만 남기고 원형을 버리면 원본 전체 보존이라는 목적을 만족하지 못한다. 원 source 자료와 다른 새 결과임을 사용자에게 명확히 표시해야 한다.

## 6. 결합 권장안 — 최소 손실과 실제 재개의 분리

1. 먼저 계정/Secret을 제외한 **허용된 원이력과 원 관계를 A로 검산·보존**한다. 출처가 불명하거나 원문/필수 참조가 빠지면 검증 공백으로 닫는다. 모든 원UUID를 현재 사용자에게 강제 배정하지 않는다.
2. 현재 소유/읽기 권한을 확인한 사람이 재사용할 업무 자료를 명시 선택한다. **지원된 종류에 한해 B의 새 현재 graph를 만든다.** 원권한/승인·제어·Agent 세션은 재개 대상이 아니다. 선택되지 않은 자료는 역사로 남으며 누락과 명시 제외를 구분한다.
3. 원형과 파생형의 참조 대응·hash·제외/변환 이유를 비교 가능한 결과로 남긴다. 원본/현재 자료를 화면과 API에서 혼동하지 않도록 하는 소비 계약이 필요하다. 역사주체의 별도 현재 로그인 연결은 이 결과의 설명 보조이며 과거 권한의 이전이 아니다.
4. 재개 판정에는 실제 현재 조회·편집·계획/원문 참조 흐름과 필요한 현재 재검토·재확정·연결이 포함돼야 한다. 단순 archive 복호화/해시 일치나 새 wrapper·자가선언으로 full restore 완료를 발급하지 않는다.
5. 전체 복원 완료의 필수 자료군·역사/현재 graph·artifact 원 bytes·schema/관계 및 현재 소비선이 모두 지원/검산돼야 한다. 일부만 변환할 수 있다면 그 지원 범위만 보고한다. 미지원 kind·원문/참조 충돌·계정 제외 때문에 생긴 공백을 암묵적으로 성공 처리하지 않는다.

이 결합은 A1~A6 전체 여정의 한 선행 선택이다. 현재 수동 정책 저장/collector 보완이나 선택파일 검증이 전체 복원·사용자 인수 완료로 바뀌지 않는다. 현재 프로필·coverage412·실공급 부재 차단도 해제하지 않는다.

## 7. 결정이 필요한 정확한 차이

| 결정 항목 | 현재 정해진 원칙 | 이번에 추가로 채택할 내용 |
| --- | --- | --- |
| 역사주체 | 계정/Secret 자체 비반출, 현재 권한 자동 복원0 | 원 user/client UUID를 계정이 아닌 비활성 역사 opaque 참조로 보존할지와 그 범위/비반출 열 |
| 출처·충돌 | 원 ref/hash와 파생/제외 투영 구별 | 신뢰할 source/history namespace·출처 결박·동일 UUID 충돌/재수입 규칙 |
| FK·보관 영역 | 현재 users/clients/command FK가 실제 존재 | 가짜 계정 없이 원 graph를 검증/조회하는 역사 참조 저장·codec·접근 구조. 현재 표로 단순 재삽입하지 않음 |
| 현재 주체 연결 | 현재 인증/소유/권한을 별도 확인 | 연결/철회 주체와 근거·범위·검수. 원UUID/동일 이름만으로 현재 계정 연결0 |
| 파생 활성 graph | 원승인/실행권한은 과거 조회 이력 | 어떤 업무 종류를 새 ID/hash로 변환할지, 참조 재작성·순서·원형/파생 대응·현재 정책/검토·실제 소비 계약 |
| 완료 판정 | 검증 복원과 실제 적용/승인은 별개 | 역사 보존/파생 생성/현재 작업 재개/전체 복원의 각각의 필수 범위·실제 증거·미지원 처리 |

선택지는 A만 우선 구현(역사 조회까지), B만 우선 파생(원형 손실/공백 위험을 별도 수용), A+B 결합이다. **권장은 A+B이며, 원형 보존을 현재 작업 재개로 오인하지 않는 조건**이다. 구체 active graph 변환/codec/정책·현재 계정 연결 절차가 미정인 동안 실제 parser/저장/적용 GO로 해석하지 않는다.

## 8. 채택 전에 고정할 최소 형식·접근·변환·rollback

다음은 논리 항목 제안이며 exact key/type/codec·상한·표/API는 아직 미정이다. PMO의 결합안 권장은 상세 후보 작성 방향이며 새 데이터 계약 채택이나 제품 구현 승인이 아니다.

| 항목 | 최소 후보 내용 / 남은 확정 |
| --- | --- |
| 원이력 형식 | 출처 namespace·자료 kind/schema 버전·원 ref/hash·원 관계·opaque 주체 참조·허용 원문 또는 제외 이유/projection hash를 구별한다. 출처 신뢰 근거와 비반출 필드별 exact codec·정렬·상한은 미정이다. |
| 파생/매핑 형식 | 원 출처/ref/hash와 새 대상 project/ref/hash·변환기 버전/규칙·변환/제외 이유·정확 결과 상태를 연결한다. 역사주체↔현재 로그인 연결은 원 snapshot 밖의 별도 기록이다. idempotency/부분 결과/매핑 불변성의 구체 계약은 미정이다. |
| 접근 | 현재 인증·대상 소유/읽기·파생/적용 권한을 각각 확인한다. 과거 주체나 archive 매핑으로 현재 권한을 얻지 않는다. 누가 역사 연결을 만들고 읽고 철회할지, 보존/감사와 최소권한 모델은 미정이다. |
| 참조 변환 | 명시 선택 자료의 필수 의존성 폐쇄를 검산하고 자료종류별로 원형과 파생 ref를 구별한다. 누락/충돌/미지원은 실패·미지원으로 남긴다. 현재 graph 종류별 변환 순서·순환 관계·외부 참조 처리와 편집/조회 소비 codec은 미정이다. |
| 검증 | 원이력 hash/관계 검산, 파생 대응/새 hash 검산, 실제 현재 조회·편집/필요 재검토·재확정, 원승인 재사용0을 분리해 보고한다. 미지원 graph나 archive만의 성공을 full restore 완료로 표시하지 않는다. 종류별 필수 항목·비교기·상한과 전체 판정 기준은 미정이다. |
| rollback | 검증/파생 준비와 현재 반영을 분리하고, 반영 시 정확 사전 상태·대상/생성 ID·결과를 추적해야 한다. 후속 변경이 생기면 옛 head 강제복구/다른 작업 덮기0, 현재 권한·상태를 다시 확인한 별도 복구만 검토한다. 원이력은 rollback으로 재작성/삭제하지 않는다. 반영 결과 UNKNOWN이면 원결과/매핑을 보존하고 자동 재적용·삭제0이다. 실제 원자 경계·보존 공간·부분 반영 보상·복구 명령/승인 정책은 미정이다. |

## 9. 검수·실행 경계

후속 WI의 필수 반례 후보는 다른 출처 동일UUID·동일 ref 상반hash·누락/고아 FK·미지원 주체/자료kind·원UUID 치환 후 원hash 재사용·다른 현재 사용자/소유권·권한 없는 역사 연결·원승인/소비 재사용·원본/파생 혼동·일부 archive만으로 전체 성공 표시·필수 원문/bytes 누락·실패 뒤 결과불명/중복 파생이다.

이 문서는 후보 비교만 수행한다. 대표4계열 밖의 모든 schema/codec 변환은 확인하지 않았다. 기존 collector의 비식별 projection이 원문 전체의 대체가 아님을 유지한다. 새 users/clients·credential·권한·DB schema/API·비밀탐지 기준을 만들지 않으며 실제 실행은 승인하지 않는다. Main 독립 검토와 정확 채택 결정을 거친 뒤 최소 WI를 별도로 고정해야 한다.
## 10. r2 — DOCUMENT_VERSION 한정 논리봉투 후보

이 부록은 §8 중 대표 문서 버전 1종의 형식·접근·검증·멱등을 구체화하는 **신규 계약 제안 / NOT_ADOPTED**다. 앞선 A/B 비교 이력은 보존한다. 아래 형식은 기존 구현으로 존재한다는 뜻이 아니며 schema/API/SQL·제품 구현 GO는 0이다. 임무·승인 등 다른 자료, 전체 active graph, 자동 파생·현재 계정 연결은 범위 밖이다.

### 10.1 출처와 두 hash의 분리

모든 객체는 명시된 키만 허용하고, 생략과 null을 구분한다. `UUID`·`Hash`·`VersionRef`·`ISOms`는 각각 기존 `uuidV1`·`hashV1`·`refV1`·`isoV1`의 검증 의미를 재사용하는 제안이다. `Hash`는 소문자 64자리 hex, 버전·순번은 해당 원형에 맞는 양의 안전정수다. 임의 UUID 정규화·시각 반올림·원문 치환은 하지 않는다.

```text
namespace = {kind:'ANVIL_DOCUMENT_HISTORY_NAMESPACE_V1', originProjectId:UUID, sourceManifestHash:Hash}
namespaceHash = contentHash(canonicalJson(namespace))
historyRef = {kind:'ANVIL_DOCUMENT_HISTORY_REF_V1', namespaceHash:Hash,
              originalRef:VersionRef, recordHash:Hash}
envelope = {kind:'ANVIL_DOCUMENT_HISTORY_ENVELOPE_V1', namespace, namespaceHash,
            recordSchema:'DOCUMENT_VERSION_PROJECTION_V1', originalRef:VersionRef,
            originalRecord, recordHash:Hash, principals, evidenceRefs, derivation}
```

`sourceManifestHash`는 **이 봉투 생성 전에 확정된 원 source manifest**의 hash다. 봉투를 포함할 산출 manifest나 봉투 자신의 hash를 다시 입력하지 않는다. 외부 산출물 hash는 별도로 계산한다. 원 manifest의 정확 bytes/hash 결박과 출처 검증은 별개다. manifest 자기주장·자체 hash 일치만으로 진짜 원 서버/사람/권한을 보증하지 않는다.

역사 키는 `(namespaceHash, 'DOCUMENT_VERSION', originalRef.id, originalRef.version)`이다. 다른 project/manifest의 동일 UUID는 다른 namespace이며 자동 합치지 않는다. 같은 원 project의 서로 다른 manifest도 자동 동일 역사로 승격하지 않는다. 출처 간 대응은 별도 채택 계약 없이는 미지원이다.

`originalRef.contentHash`는 기존 문서의 `{title,formRef,stageNodeRef,content}` 4필드 canonical hash다. `recordHash`는 아래 **허용 projection 전체**의 canonical hash이며 author/client/관계를 포함한다. 원 DB 행의 물리 bytes hash나 기존 문서 contentHash와 동일하다고 표시하지 않는다. 제외열 때문에 원 DB 행 전체 보존을 주장할 수도 없다.

### 10.2 원형 projection과 역사 주체

`originalRecord`의 exact 최상위 키 후보는 `projectId, documentId, version, formRef, stageNodeRef, bodyArtifactId, title, sourceRefs, content, contentHash, sections, authorRef, validation, reason, clientId, commandRecordId, createdAt`이다. 이는 `document-inventory.ts:21`의 선택열과 문서 버전 DDL의 논리 대응이며 새로운 원형 codec 제안이다. `commandRecordId`는 내부 `commands.id`이고 외부 commandId로 대체하지 않는다. `projectId`는 namespace의 originProjectId, id/version/contentHash는 originalRef와 정확히 일치해야 한다.

`content`는 기존 `{body,attachments,sections,sourceRefs}` 원형을 유지한다. ArtifactRef는 `{artifactId,bytes,contentHash,mediaType}`다. `formRef`는 기존 원 ref/decoder 의미를 유지한다. `stageNodeRef`는 실제 원형인 `null | {applicationId:UUID,nodeId:string}`이며 nodeId는 기존 `readStageNodeRef`의 비어 있지 않은 well-formed 문자열(length<=200, 제어문자 금지)로 UUID가 아니고 `implement` 같은 기존 값도 허용하며, application 버전을 자체 필드로 갖지 않는다. `authorRef`는 이 한정안에서 `{kind:'HUMAN',userId:UUID}`만 허용하며 다른 원형을 HUMAN으로 변환하지 않는다. `validation`은 기존 저장 JSON을 보존하되, 이를 현재 유효 판정으로 다시 해석하지 않는다. 중첩 원형의 등록 codec이 없거나 원 저장 형식과 다르면 `UNSUPPORTED`다. 단지 JSON 파싱 성공을 의미 검증 성공으로 세지 않는다.

`principals`는 exact `{user,client}`이고 다음 키 외 계정 필드를 허용하지 않는다.

```text
user   = {kind:'HISTORICAL_USER_REF_V1', namespaceHash:Hash, userId:UUID}
client = {kind:'HISTORICAL_CLIENT_REF_V1', namespaceHash:Hash, userId:UUID, clientId:UUID}
```

userId는 원 authorRef.userId와, clientId는 원 record.clientId와 일치해야 한다. client.userId는 user.userId와 일치해야 한다. **그 값의 일치만으로 원 client↔user 관계를 증명하지 않는다.** 원 source manifest에 결박된 해당 관계 증빙 및 관련 command/receipt/audit의 주체 대응을 별도 검산해야 한다. 관계 증빙의 exact export codec은 채택·구현 전까지 미지원이다.

사용자명·표시명·이메일·상태·role·serverOwner·password/hash·credentialGeneration·session/token/CSRF·키·client 이름/기기정보 등은 이 주체 봉투의 비반출 필드다. 원 users/clients 행을 수입하거나 fake 계정/FK 대체행을 생성하지 않는다. opaque UUID는 비권한 식별자이며 익명성이나 현재 사용자 동일성을 보증하지 않는다. 허용키/제외열 검사와 본문 내 기존 비밀 검사 범위도 별개다. 새 비밀 탐지 기준을 이 후보에서 만들지 않는다.

### 10.3 증빙 참조 폐쇄와 현재 접근 분리

`evidenceRefs`는 exact `{kind:'SOURCE_HISTORY_EVIDENCE_REF_V1',namespaceHash,recordKind,key,recordHash}`의 유한 배열이다. `recordKind`별 `key`는 다음 제안만 허용하며, key 배열은 순서·길이·타입이 고정된다. 다른 namespace를 숨겨 연결하거나 임의 VersionRef로 위장하지 않는다.

| recordKind | key 후보 | 필수 검산 |
| --- | --- | --- |
| DOCUMENT_HEAD | [documentId] | 원 document 귀속·원 작성 주체 및 버전 관계 |
| FORM_VERSION | [formId, version] | 원 formRef 전체 hash·필수 항목 |
| METHODOLOGY_APPLICATION | [applicationId, version] | stageNodeRef가 nonnull일 때만 필수. sourceManifest에 고정된 정확 application snapshot VersionRef와 원행의 application_version/snapshot_hash 관계를 검산해 version을 결정하고 원 노드 귀속을 검산. caller 추정·최신 조회 금지 |
| ARTIFACT_METADATA | [artifactId] | 정확 bytes/hash/mediaType·원 상태/검사 정보 |
| DOCUMENT_ARTIFACT_LINK | [documentId, version, artifactId, linkKind] | BODY/ATTACHMENT/SOURCE별 정확 귀속·중복·누락 |
| PROJECT_COMMAND | [internalCommandRecordId] | 원 operation/대상/주체/결과·원 receipt/audit 대응 |
| AUTHORIZATION_RECEIPT | [receiptId] | 원 PROJECT scope/명령/주체/시각·결과 결박 |
| AUDIT_EVENT | [sequence, eventId] | 안전정수 순번·원 command/operation/주체·정확 cardinality |
| PRINCIPAL_LINK | [userId, clientId] | 원 관계의 source 결박; 실제 계정행 반출0 |

stageNodeRef가 nonnull인데 고정된 exact application snapshot/관계 증빙이 없으면 `MISSING`, 해당 원형/관계 codec이 지원되지 않으면 `UNSUPPORTED`다. null이면 application evidence는 불필요하며 임의 생성하지 않는다. 이 경우에도 form 검산은 항상 필수이고, `formStageRelations`는 form 검산과 원 stageNodeRef가 실제 null임을 확인한 결과로 판정한다. null을 이유로 form 검산을 생략하거나 수행하지 않은 application 검산을 성공으로 세지 않는다.

이 표는 새 논리 참조 형식 후보다. 비버전 원행의 `recordHash`는 각 등록 projection codec의 hash이며 기존 표에 그 hash 열이 있다고 주장하지 않는다. source link 등 원 content의 추가 관계가 있으면 원 참조별 필수 폐쇄 항목으로 포함해야 한다. 표의 참조만 존재하고 해당 원문·관계 codec/검산이 없으면 폐쇄 성공이 아니다. 원 command 전체 서명·서버 진위 검증이 기존 문서 hash 검사로 제공된다고 주장하지 않는다.

읽는 현재 주체는 현재 인증·대상 역사 보관영역의 OWNER/읽기 보호를 매 요청 확인한다. 역사 author/client·originProjectId·bundle 소지만으로 접근을 허가하지 않는다. 현재 조회자 정보는 원 record에 삽입하거나 원 주체로 위장하지 않는다. 이 보관영역의 실제 접근 저장 모델/endpoint는 아직 미채택이다.

`derivation`은 exact `{kind:'DOCUMENT_DERIVATION_SLOT_V1',sourceHistoryRef:historyRef,currentAccountLink:null,derivedRef:null,state:'NOT_CREATED_UNSUPPORTED'}`로 고정한다. 이는 계보 슬롯일 뿐 현재 계정/권한 연결이 아니다. writer를 실행하지 않으며 현재 graph를 생성하지 않는다. 원 승인·소비·APPLIED 상태를 현재 허가로 재사용하지 않는다. 단순 archive 성공은 full restore/작업 재개 완료가 아니다.

### 10.4 닫힌 검증 결과와 재사용 근거

결과 후보는 exact `{kind:'DOCUMENT_HISTORY_VALIDATION_V1',historyRef,checks,historyState,currentGraphState:'NOT_CREATED_UNSUPPORTED',currentAccountLink:null,derivedRef:null,fullRestore:false,executionAuthorized:false}`다. `checks`의 exact 키는 `sourceBinding,recordHash,documentContentHash,principalRelation,formStageRelations,artifactLinks,commandReceiptAudit,artifactBytes`이며 각 값은 `NOT_RUN|VERIFIED|MISSING|UNSUPPORTED|MISMATCH` 중 하나다. 미수행·미지원·누락을 같은 성공 값으로 뭉개지 않는다.

`historyState`는 아래 우선순위에서 **처음 해당하는 한 행만** 선택한다. 구조상 잘못된 봉투(키/타입/enum/필수 필드 위반)는 validation 결과 생성 전에 `REJECTED`하며 잘못된 결과 객체를 만들지 않는다. 구조상 유효한 결과의 각 check는 앞서 정한 5값만 허용한다. `recordHash`도 필수 검산이며 sourceBinding만 별도로 분리한다.

| 우선순위 | 배타 판정 조건(앞선 행에 해당하지 않을 때) | historyState |
| --- | --- | --- |
| 1 | checks 중 MISMATCH가 하나라도 있음 | INVALID |
| 2 | recordHash의 실제 검산이 VERIFIED이고, 다른 7개 check가 모두 NOT_RUN인 순수 봉투 검산만 수행됨 | ENVELOPE_ONLY |
| 3 | sourceBinding을 제외한 나머지 필수 check 중 NOT_RUN/MISSING/UNSUPPORTED가 하나라도 있음 | INCOMPLETE |
| 4 | sourceBinding 외 모든 필수 check가 VERIFIED이고, sourceBinding만 NOT_RUN/MISSING/UNSUPPORTED | SOURCE_UNVERIFIED |
| 5 | sourceBinding을 포함한 모든 필수 check가 VERIFIED | HISTORICAL_DOCUMENT_VERIFIED |

따라서 순수 봉투 검산의 ENVELOPE_ONLY는 일반 미수행의 INCOMPLETE보다 먼저 분류하며, 일부 semantic 검산만 수행했다면 INCOMPLETE다. recordHash 미수행/누락/미지원도 INCOMPLETE이며, 어떤 단계의 불일치도 INVALID가 우선한다. sourceBinding만 미확인인 경우는 나머지 필수 검산 전부가 VERIFIED일 때에만 SOURCE_UNVERIFIED다. 유효한 5값의 모든 조합은 위 표로 닫히며 알 수 없는 값은 구조 거절한다. HISTORICAL_DOCUMENT_VERIFIED도 문서 1종에만 해당하고 `VERIFIED_FULL`은 발급하지 않는다. 원문·참조·실bytes 미지원 상태에서 hash 자기일치만으로 승격하지 않는다.

| 실제 재사용 심볼·근거 | 재사용 가능 범위 / 제공하지 않는 것 |
| --- | --- |
| `contracts/canonical.ts`의 `canonicalJson`, `contentHash`; `contracts/runtime/validation-v1.ts`의 `recordV1`, `uuidV1`, `refV1`, `hashV1`, `isoV1` | 닫힌 키·유한 JSON·정확 ref/ISOms·canonical UTF-8 hash. 출처 진위/권한/관계 증명은 아님 |
| `project-documents.ts:185,204` 및 `document-inventory.ts:145~157` | 문서 4필드 hash, 원 content/별도 열 일치, artifact 선언/링크 관계의 기존 검산 근거. source 계정 복원이나 command 전체 서명 검증 아님 |
| `document-stage.ts`의 `readStageNodeRef`, `document-validation.ts`의 `validateDocumentConfirmation` | 기존 stage 원형 및 문서 검증 의미의 재사용 접점. 현재 DB/원문·관계 의존성을 제거한 독립 bundle decoder가 이미 있다는 뜻 아님 |
| `project-documents.ts:160~185`의 저장 검산 | body UTF-8·sections/form 필수·첨부 중복 등 별도 의미 검산 필요 근거. 과거 저장 validation JSON만 믿어 이를 생략하지 않음 |
| `artifact-byte-verification.ts`의 `verifyArtifactBytes` | 공급받은 bytes의 유한 읽기/정확 hash·크기 검산 접점. 원 source/현재 store 전체성·복원 가능성·실제 공급을 보증하지 않음 |

`ProjectDocuments.read`와 `collectDocumentInventory`는 현재 DB/회원/원문 저장소 보호를 포함하므로 bundle용 순수 decoder라고 호출하거나 보호를 우회하지 않는다. 현재 코드가 수행하는 문서 검산과 이 후보에서 새로 필요한 관계/export codec·sourceBinding은 별도 구현/검수 대상이다.

기존 ArtifactRef bytes 상한은 20MiB(20,971,520), mediaType 길이는 200이며 이를 근거로만 재사용 제안한다(`project-documents.ts:32`, `document-inventory.ts:150`). 문서 조회 batching의 200은 전체 봉투 참조 상한이 아니다. `readDocumentInventoryInput`의 `InventoryLimits`는 양의 안전정수 `metadataBytes,inputBytes,fileCount,deadlineMs`를 받지만 고정 최대값을 정의하지 않는다. 이 후보는 시험 수치를 제품 상한으로 채택하지 않는다. 새 봉투 총 bytes/행수/증빙수·원자 준비 공간의 고정 최대값은 **채택 전 새 결정 항목**이며 미설정이면 수입 시작 불가다. 기존 수동정책/원장 한도가 자동 적용된다고 주장하지 않는다.

### 10.5 논리 저장·재수입·취소·비파괴 rollback

다음은 구현 전 채택할 논리 원자 경계의 제안이다. 검증 준비는 비공개이며, 공개 역사 행+필수 참조+불변 결과를 하나의 논리 commit으로 확정해야 한다. 실제 저장 매체/transaction·crash 복구 구현이 없는 현재 이를 원자성 검증 완료로 부르지 않는다.

| 결과 상태 | 정확 조건과 허용 후속 행동 |
| --- | --- |
| PREPARED | 고정 namespace/키/recordHash·유한 입력과 검증 결과를 결박했으나 공개 행0. 미지원 검증은 그대로 기록하며 검증된 원형으로 표시0 |
| COMMITTED | 원자 commit 및 정확 결과 ref/readback이 확인됨. 저장 결과와 의미 검증 결과는 별도이며 ENVELOPE_ONLY 저장을 VERIFIED로 승격0 |
| REPLAY_EXISTING | 같은 역사 키·원 contentHash·recordHash 및 결정적 봉투/참조가 정확 동일하고 현재 읽기 보호가 통과. 기존 ref 반환·새 역사/매핑 행0·새 권한0 |
| CONFLICT | 같은 키에서 상반 hash/원형/참조. 덮기·새 버전으로 자동 해결·출처 합치기0. 다른 namespace는 별도이고 자동 중복 제거0 |
| REJECTED | 형식/크기/주체 허용키/명확 관계 불일치 등 commit 전 명확 거절. 원 source/기존 역사 변경0 |
| CANCELLED_BEFORE_COMMIT | commit이 없고 원자 rollback·본 시도의 비공개 준비 회수가 확인된 경우만. 이미 COMMITTED면 취소로 삭제하지 않음 |
| UNKNOWN | commit/결과/정리 여부 불명. 고정 시도·키·hash·관측을 보존하고 자동 재수입·새 시도·삭제0. 같은 시도의 보호된 결과 확인으로만 확정 상태로 이동 |

멱등 확인은 동일 키의 불변 원형/증빙 일치까지 포함하며 한 번의 빈 조회만으로 미commit을 단정하지 않는다. COMMITTED 이후 취소 요청은 확정 결과를 보존하고 자동 삭제하지 않는다. rollback은 본 시도 소유의 **미공개 준비**만 회수하며 원 source/기존 역사/다른 시도를 재작성·삭제하지 않는다. 회수 결과가 불명이면 UNKNOWN이다. 현재 graph는 생성하지 않으므로 그 rollback을 구현했다고 주장하지 않는다. 향후 B의 실제 파생/현재 head 반영·후속 변경 보상은 별도 미채택 계약이다.

### 10.6 정확 채택에 남은 결정

이 부록의 namespace/projection/opaque 주체/증빙 키·결과 상태·멱등 원자 경계는 모두 신규 제안이다. 채택 전에는 (1) DOCUMENT_VERSION 및 각 필수 관계/PRINCIPAL_LINK의 export codec과 제외열 검산, (2) 원 source 진위·manifest 결박 근거와 미지원 처리, (3) 역사 보관영역의 현재 접근·불변 저장/UNKNOWN 조정·취소 권한, (4) 봉투/관계/행수/공간의 유한 수치와 실제 crash 복구 경계를 확정해야 한다. 현재 계정 연결·active graph 변환·다른 자료 종류는 미지원으로 남기며 이 부록을 근거로 새 users/clients·권한·현재 자료를 생성하지 않는다. 실제 DB/키/파일·서비스/Agent/복원 실행 및 제품 구현 승인은 0이다.