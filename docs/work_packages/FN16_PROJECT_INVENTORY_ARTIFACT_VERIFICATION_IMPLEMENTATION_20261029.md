# FN16 조합 원문 현재상태·바이트 검증 연결 작업지시서 — 2026-10-29

## 목적·선행
FUNCTION_WORK FN16/설계 §10.4의 원문 무결성 검증을 위해 d80946a32e109094611c933b449b567bfcd5ee38의 고정19 조합과 기존 현재권한/바이트 검증을 연결한다. 실제 사용자 백업/API/정책/복원 구현을 대신하지 않는다. Main 관리·검수·통합, 단일 구현자만 TDD, 독립 읽기 검수. 이 문서는 Main/독립 preflight 전 제품 GO가 아니다.

## 정확 허용3경로
- apps/server/modules/backups/artifact-current-verification.ts: composeProjectInventory import와 verifyProjectInventoryArtifacts(access,token,value,reader,signal) 내부 진입 함수 추가만. 기존 currentScope·기존3자료군/단일 함수와 그 normalizer는 변경하지 않는다.
- tests/unit/FN16/project-inventory-artifact-verification.test.ts: 실제 조합/기존 바이트검증과 메모리 SQL·reader를 통한 신규 연결 시험.
- tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts: 실제 호출·명시 SELECT·새 쓰기/공개 API/기존 helper 변경 없음 대조.
기존 조합/collector·다른 source/시험·SQL은 수정하지 않는다. 보호8/사용자 변경 보존, Git은 Main만. 실제 키·DB·서비스/PG·파일/Agent 실행0. reader는 메모리 합성만 사용한다.

## 계약·호출 순서
1. 입력은 기존 readDocumentInventoryInput의 projectId/finite limits와 신뢰한 기존 ArtifactByteReader·signal뿐이다. 외부 inventory/result/provider 선택 주입0. 새 의존성/설정/정책/API/SQL/migration0.
2. 기존 currentScope를 한 번 만들고 boundary([])로 시작 신원을 고정한다. 그 guardedAccess와 남은 기한·metadata 한도로 실제 composeProjectInventory를 한 번 호출한다. 전체 최소 actor/client/credentialGeneration/authSession·만료/기한을 공유한다. 조합 원관측·원hash·scope·선언/미수집을 수정하지 않는다.
3. composition.references의 ARTIFACT exacttuple을 artifactId 중복 없는 대상으로 사용하고 CONVERSATION_MESSAGE의 id/contentHash 및 scope.conversationId를 명시 경로로 읽는다. 다른 namespace를 추정하지 않는다. 선언 tuple/총 fileCount/inputBytes를 조합 usage와 대조한다.
4. 조합 초기 issues의 ARTIFACT_NOT_READY/ARTIFACT_INSPECTION_UNKNOWN exacttuple을 해당 원문 차단에 보존한다. MESSAGE_QUARANTINED의 sourceRef는 아래 현재 RC에서 원hash와 bodytuple을 결박한 뒤 차단 원문에 합친다. 최초 blocked는 현재 상태가 바뀌어도 NOT_VERIFIED/고정 사유·IO0이며 Document/Knowledge/Context와 같은 원문을 공유해도 차단이 우선한다. 최초 상태 원값이 없으면 null/미제공으로 남기고 현재 READY로 꾸미지 않는다. 알려지지 않은 issue를 지우거나 전체 문제 없음으로 바꾸지 않는다.
5. currentMessages는 guardedAccess.authenticated의 별도 RC에서 OWNER/nonarchived·isolation·clock·유한 statement_timeout을 검사한다. 명시 열 project_id,conversation_id,id,sequence,content_hash,body_artifact_id,message_json,redaction_state만 사용한다. 정확 프로젝트·id ANY 최대200건 묶음, SQL CTE의 JSON row_bytes/cap과 전체 metadata 잔여한도, 정확 행집합/중복·누락/추가 거절. 재조회 snapshot canonical hash/readConversationInput 실제 형식과 sourceRef hash, conversationId, serverSequence, body artifact exacttuple을 대조한다. 원 author/client/body 본문을 결과/오류로 반환하지 않는다. 모든 수집 대화 메시지가 조합 ARTIFACT에 정확히 연결돼야 하며 연결 부재/변조는 고정503이다.
6. 최초 조합에서 차단되지 않은 메시지가 현재 QUARANTINED/변조/누락이면 전체 실패다. 이미 최초 차단된 메시지는 재결박 후 IO 없이 NOT_VERIFIED를 유지한다. 최초 수집 후 새 메시지를 모두 탐지했다고 주장하지 않는다. 첫 RC 후 실제 원문 읽기 전에도 해당 원문을 참조하는 모든 최초 eligible 메시지를 재대조하고, 마지막에는 VERIFIED 원문에 연결된 모든 최초 eligible 메시지를 한 번 더 대조한다.
7. 각 eligible ARTIFACT는 scope.verify로 정확 한 번만 검증한다. 원문 IO 중 DB client/transaction 보유0. 실제 open/read/close는 기존 byte검증에 위임하고 전역 physical open1회/원문으로 계수한다. 새 plaintext cache/원문 복사 결과0. 같은 원문에서 뒤현재상태·hash·검사 변경은 전체 실패이며 초기 skip으로 낮추지 않는다. 마지막 currentMessages와 scope.boundary(VERIFIED 전부)를 기다린 뒤 취소/기한을 검사한다. 파일 재읽기0.
8. 전체 metadata는 composition의 실제 usage.metadataBytes+추가 RC payload UTF8+검증 DTO+최종 반환 DTO를 누적한다. 이중 표현을 작업량에서 차감하지 않는다. 반환계수 자리수 포함 고정점 계산, file/input 안전정수·한도 유지. 남은 기한/최소 세션기한은 후속 관측으로 연장하지 않는다. 진행중 query/reader를 Promise.race로 떼어내 정상 회수했다고 하지 않는다.
9. 결과 PROJECT_INVENTORY_ARTIFACT_VERIFICATION_V1은 projectId, 원 compositionHash/관측·원 제한·고정 notCollected/요약, exacttuple별 VERIFIED와 기존 CurrentArtifactVerification 또는 NOT_VERIFIED/명시 사유, 전역 usage를 보존한다. 원문/raw message/actor·client·token/storage 경로는 노출하지 않는다. atomicSnapshotVerified/fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed=false. '검증된 원문 일부'와 전체 성공을 분리한다.
10. 새 함수의 composition 호출 구간에서만 정확 PROJECT_INVENTORY_CANCELLED409/DEADLINE413/LIMIT413/REFERENCE_CONFLICT503/FAILED503 및 INPUT_INVALID400/AUTH_REQUIRED401/NOT_FOUND404를 새 고정 오류로 복제한다. 기존 normalize 코드표/기존 함수 동작은 바꾸지 않는다. 중첩 guard에서 원인/회수 구분이 사라진503은 기한/취소로 추정해 낮추지 않고 고정503으로 보존한다. 안전하게 식별 가능한 기한·취소는 기존 코드로 유지한다. raw cause/SQL/DB 원문 노출0. 실제 강제 시간상한/PG RLS/OS 안정성 보장은 미검증이다.

## TDD·검수
- 실제19 조합 호출→문서/대화/지식/Context 중 최소 두 출처 공유 exacttuple→메모리 reader open1회→마지막 전대상 현재성 정상.
- 최초 MESSAGE_QUARANTINED/원문 blocked/검사 UNKNOWN의 다른 자료군 공유도 IO0; current 대화/원문 격리·변조·누락은 실패, 권한/신원 변경·최소만료·전체기한·COMMIT 뒤 취소/metadata초과·DB/reader 회수불명503을 분리한다.
- 소스 없는 빈 조합도 전체 성공이 아니며 미수집/원제약 유지. 이후 새 메시지/모든 시점/실제 파일 안정을 증명하지 않는다는 제한을 시험/보고에 명시한다.
- 신규2시험 RED→동일 담당 GREEN, npm run typecheck, diff/신규 LF/EOF·지문, Main fresh 신규2시험 및 독립 C/I0. 기존 helper 변경0이면 완료된 전체 collector/기존 helper 전수 반복0. helper 변경이 꼭 필요하면 GO 전 Main에 정확 diff/영향을 보고한다.
- Main만 WI/결과보고/WORK_STATUS/WORK_PLAN 및 허용3을 정확 checkpoint한다. rollback은 검토된 함수/import/신규시험 revert이며 자료/백업 삭제0. 실제 DB/원문FS·키·서비스·archive/복원/UI/사용자 인수 NOT_RUN, 전체 계획 미완료.
