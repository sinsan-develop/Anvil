# FN16 지식 공유요청 보호 수집 source 계약 초안 — 2026-10-29

## 1. 결정과 현재 판정

PMO는 결정안 `docs/work_packages/FN16_KNOWLEDGE_SHARE_PROTECTED_INVENTORY_DECISION_PACKET_20261029.md` SHA256 `023B6BDFDF9D45DBE04667B885CA88940019AEC5141919C4EF99E34B9644CB3E`의 B를 이번 대화에서 한정 채택했다는 Main 전달을 기준으로 한다. 그 파일의 NOT_ADOPTED 문구는 결정 전 원본 이력이며 이 초안이 파일을 소급 수정하지 않는다. 현재 HEAD는 `7b2498e53280a8f69a3b907b9696406b61b5f151`이다.

이 문서는 보호 조건과 실현 가능성을 상세화하는 **검토 초안**이다. Main·독립 검토 전 제품 코드 GO가 아니며, 실제 DB/대상/원문 IO·키·서비스·Agent·공유/전송 실행 승인은 없다. 코드와 합성 시험도 이 문서 작성 단계에서는 0이다.

**판정:** 기존 검증 권위만으로 RO 동등성이 입증된 eligible 원형 수집 경로는 현재 없다. B의 원형·증빙 보존은 `NOT_COLLECTED / NOT_IMPLEMENTED`이며 이를 구현된 함수나 mock 성공으로 대체하지 않는다. 안전한 하위 단위인 본인 고정 요청의 최소 봉투 보존은 별도 Main GO 후 구현 후보로 한정할 수 있다. 이것만으로 B 완료 또는 전체 KNOWLEDGE_SHARE_REQUESTS 완료를 보고할 수 없다.

## 2. 확인한 실제 source와 경계

| source | 지문/근거 | 판단 |
|---|---|---|
| project-knowledge-share-requests.ts | `36AA657584D72EA5E5FD6D3CBD9417210B9AC324E3FC50320E064BE991C8EB34` | #row/list는 created_by=현재 actor. #projected는 현재 source/target/knowledge 재검사 후 eligible 또는 최소 unavailable |
| knowledge-share-targets.ts | `E3B9833FF44A9EC8B1D12D576B84F53A2FCE2EE0DCD45DA546E79B78C2C8AA62` | lockShareProjects는 FOR UPDATE OF p,m. checkShareKnowledge(lock=true)는 head FOR UPDATE. lock=false도 knowledge.read를 통해 원문을 실제 검증함 |
| knowledge.ts | `4E2C33F1557102E4A62F0485B83EDEBA8CFAC4511DD1AC0F97C0EC56B6FD8B2F` | read→#verify→ProjectDocuments.originalText·문서/대화 출처 검증. metadata 존재만 확인하는 함수가 아님 |
| artifact-current-verification.ts | `1CD54C6F937D5CB432B879AC9B45FB89BAB5D3F6006F6BE0168525EA9FCBA3A4` | 기존 owner·원문 bytes/current 검증. 공유 대상 회원/프로젝트 세대와 전체 지식 현재성의 권위를 발급하지 않음 |
| 0051_knowledge_share_requests.sql.pending | source-only·manifest 미등록 | FORCE RLS read는 본인. 실제 DB 존재/적용/RLS 작동 NOT_RUN |

FN05의 기존 unavailable 반환은 아래 8필드뿐이다. 본인 확인 불가를 구체 원문/대상 사유로 세분화하지 않는다. source 접근 상실·타인·미존재는 동일 404이며 타인 존재·건수는 0이다. 현재 로그인 자체가 무효하면 기존 401을 유지한다.

```text
{requestRef, state:'RECORDED_ONLY', currentCheck:'UNAVAILABLE',
 reasonCode:'SOURCE_OR_TARGET_UNAVAILABLE',
 transferPerformed:false, sharedEventCreated:false,
 approvalConsumed:false, executionAuthorized:false}
```

불가 행에는 snapshot, versionRefs, explicitTargets, purpose, 내용/대상/증빙 개수, 기록 시각, 정책, 원주체/client, 명령/영수증·감사 상세, 상세 hash·길이·검사 사유를 덧붙이지 않는다. 이 제한은 envelope뿐 아니라 component rowCounts·declarations·issues·dependencies·usage·로그에도 적용한다. 기존 조합의 자동 배열 rowCounts를 그대로 적용해서는 안 된다. 이번 하위 단위는 조합에 연결하지 않는다.

## 3. eligible 원형 수집에 필요한 실제 권위와 현재 공백

eligible은 다음 전체를 서버에서 실제 검사한 경우만 가능하다.

1. 같은 유효 actor/client/authSession/credentialGeneration, 출발 프로젝트 접근·본인 작성, 정확 request id/version/hash.
2. 현재 source/target 프로젝트와 회원 접근, target의 저장된 버전, 정확 knowledge ref/hash·현재 head·미제외/미대체 상태.
3. 관련 원문 bytes의 실제 hash, 격리/민감 검사, 지식과 문서·대화·첨부의 정확 출처 결박.
4. 최초와 최종 현재성 확인 및 **중간 회수/변경 뒤 원상복구(ABA)를 놓치지 않는 근거**. 단순 시작·끝 Boolean만으로 대체하지 않는다.
5. actor/project/request/hash와 관측 세대·기한을 결박하고 검증이 끝난 서버 실행 구간 안에서만 결과를 소비. 전체 한도/최소 세션 만료·취소·회수 불명을 함께 검사.

현재 원형 경로는 #projected의 FOR UPDATE 및 실제 원문 reader를 사용한다. 잠금을 삭제하거나 lock=false로 호출하는 것만으로 위 조건이 RO에서 성립하지 않는다. RR은 그 안에서 이후 회원 회수를 보지 못하며, RC 시작/끝만으로 중간 회수 ABA를 증명할 수 없다. 기존 원문 bytes 검증기도 대상 회원의 불변/세대 권위를 제공하지 않는다. 현재 source에서 이 전체를 발급하는 별도 RO issuer/세대 원장/검사 공급자를 확인하지 못했다.

따라서 `provider.verify()->true`, 외부 caller가 만든 결과, 과거 METADATA_ELIGIBLE, 명목 brand/서명 없는 proof, 새 WeakMap 토큰 발급만으로 eligible을 만들지 않는다. 새 권위나 공급자를 상상해 코드 허용 경로에 넣지 않는다. 실제 server issuer/RO 동등성의 근거가 추가될 때 별도 상세 검토로 고정한다. 현 계약은 그 issuer의 wire·테이블·API를 발명하지 않는다.

UNKNOWN·공급자 없음·동등성 미증명은 원형 미수집이다. 검증 불가가 결과 성공·복원 가능·실제 공유 허가로 승격되지 않는다. 통신/rollback/release/reader close 불명은 503 우선이며 취소/기한으로 숨기지 않는다.

## 4. 현재 가능한 최소 하위 단위 — 검토 대상

### 4.1 범위

현재 로그인·활성 source OWNER이며 해당 요청 작성자인 사람이 고정 requestRef 하나를 알고 있을 때, 기존 최소 unavailable 봉투 하나만 보호 보존하는 내부 함수 후보다. target 조회·knowledge 조회·원문 IO는 0이다. 다른 사용자/요청/프로젝트의 존재를 탐색하거나 전체 목록·건수·cursor를 제공하지 않는다. 외부 API와 기존 FN05 read/list는 변경하지 않는다.

내부 입력 후보는 `{projectId,requestRef,limits}`이며 requestRef는 기존 VersionRef 문법, limits는 기존 유한 inventory 한도 검사와 같은 의미다. caller가 전달한 ref는 허가 증거가 아니며 DB의 own predicate로 다시 결박한다. 함수명 후보는 `collectOwnKnowledgeShareRequestEnvelope(access,token,value,signal)`이다. 이는 전체 수집 함수나 eligible 공급자의 stub가 아니다.

### 4.2 실제 최소 SQL·권한

READ COMMITTED 양끝에서 같은 actor/client/credentialGeneration/authSession·현재 OWNER/nonarchived source 접근·DB clock/최소 만료를 검사한다. 요청 row는 별도 RO RR에서 다음 6열만 읽는 bounded 단건 SELECT 후보다.

```text
project_id,id,version,state,content_hash,created_by
WHERE project_id=$pid AND id=$id AND version=$version
  AND content_hash=$hash AND created_by=$authenticatedActor
LIMIT 2
```

SELECT *·join 원문·snapshot_json/request_json·target 목록·타인 count·created_at·policy_ref를 읽지 않는다. 0행은 404, 2행/잘못된 shape는 고정503. version=1/state=RECORDED_ONLY/UUID/hash·project/actor 일치를 검사한다. 실제 0051이 없거나 SQL/권한 조회가 실패하면 고정503이며 빈 성공/404로 바꾸지 않는다. schema/RLS/권한은 바꾸지 않는다.

**추가 무결성 경계:** 기존 FN05는 unavailable을 만들기 전에도 integrity()로 snapshot·request·선택 증빙을 검산한다. 따라서 이6열안은 같은503 무결성 경계를 보존한다고 증명되지 않았고, 원ref의 선언값만 읽어 기존 보호조회와 동등하다고 주장할 수 없다. 이 차이를 그대로 둔 구현은 아직 승인된 안전 최소단위라고 확정하지 않는다. Main·독립 검토가 원형 상세의 비노출 검산을 기존 권위/한도 안에서 수행할 방법까지 확인하지 못하면 **최소봉투 코드도 미착수**로 남긴다. 검사 생략을 단순 metadata 기능으로 이름만 바꾸어 우회하지 않는다. 현재 확정적으로 가능한 작업은 이 사실·재개 조건을 문서화하는 것뿐이다.

반환은 §2의 정확 최소 봉투다. 원content_hash는 **선언된 원ref**이며 snapshot을 읽고 재계산한 검증이 아니다. 원형 검산·원문·현재 대상·지식 검증은 수행하지 않는다. 이를 숨기기 위해 envelope에 검사 완료 flag나 새로운 hash/ref를 만들지 않는다. 운영/검수 기록에는 원형 NOT_COLLECTED를 별도로 유지하되 per-row 정보나 비공개 건수는 기록하지 않는다.

6열 raw payload 및 최종 DTO UTF-8 크기는 내부에서 누적 계상하여 한도 초과413을 검사하지만 반환 usage에 상세 길이·개수·시각을 노출하지 않는다. IO inputBytes/fileCount는 0. SQL 전후/외부 COMMIT 이후/응답 직전 기한·취소를 검사한다. 알 수 없는 BEGIN/ROLLBACK/release 결과는503 우선이다. 불필요 권한·제어/정책 변경은 0이다.

### 4.3 시간과 hash

이 최소 단위는 DB 시각 열을 수집하지 않는다. DB clock은 기존 Date 검증/세션 기한에만 사용한다. 향후 원형 경로에서 DB timestamp를 수집할 경우 검수된 private PG parser(양의4자리연도·명시timezone·최대6fraction·micro 보존)를 재사용하는 상세 계획을 따르며 프로토콜 원문 .sssZ·원hash/equality는 완화하지 않는다. 최소 봉투 구현을 이유로 원형 hash 또는 projectionHash를 발명하지 않는다.

## 5. 향후 원형 경로의 보존 대상 — 현재 실행 금지

RO 동등성과 실제 issuer가 입증된 뒤에만, 기존13열 knowledge_share_requests와 선택 commands21/receipts9/audit16의59열을 정확 허용 목록으로 삼는 후속 WI를 검토할 수 있다. 그때도 본인 조건, 최초/최종·중간 상태 변화, 민감 원문·대상 보호와 현재 판단 권위를 먼저 대조한다.

원 snapshot9필드의 H==content_hash, 저장 request_json의 H==command.request_hash, 주체/세대/정책·순서·정확 입력·기록 시각, receipt/primary audit 일반 scopeDigest를 검산한다. 원snapshot과 익명 projection hash는 구별한다. 과거 승인/정책을 현재 권한으로 복원하지 않는다. 현재 확인 실패 행에는 검증용으로 읽은 상세도 DTO·조합 요약에 남기지 않는다. 현재59열 안은 활성 허용 목록이 아니다.

## 6. 제출·미검증·재개 조건

이 초안과 대응 WI 두 문서만 작성한다. eligible 원형 경로는 현재 구현 불가 근거를 그대로 남기며 최소 봉투 하위 단위의 착수도 Main·독립 검토 뒤 별도 정확 GO가 필요하다. 전체 KNOWLEDGE_SHARE_REQUESTS와 다른 actor·현재 접근 상실 원형은 계속 미수집이다. 실제 DB/RLS/원문/target·서비스·키·현재 UI·archive/restore는 NOT_RUN이다.

원형 경로 재개에는 실제 issuer 위치·권한·허용 읽기·원문 reader·현재성/ABA 대조의 근거와 범위, exact proof 소비/기한/회수 결과, 타인/불가 정보 비노출 반례가 필요하다. 그 전에는 보호 경계를 우회하지 않는다.
