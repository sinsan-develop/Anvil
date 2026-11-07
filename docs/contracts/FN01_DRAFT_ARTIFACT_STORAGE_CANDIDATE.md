# FN01 프로젝트 생성 전 자료 원문 보관·귀속 계약 후보

- 상태: **PROPOSED / NOT_ADOPTED**. 제품·SQL·실제 파일 저장은 변경하지 않는다.
- 작성: 2026-10-26 Main 어울. 기준 branch `codex/av3-stage-b`, commit `70faf1415c7986666114078780ae144af080ef11`.
- 개정 r3: r1 C0/I3/M2를 상세화한 r2의 독립 검토는 C0/I0/M1이다. 남은 M1인 완료 업로드 replay와 초안 버전 검사의 순서를 §4에서 분리했다. r1 SHA256은 `5461DC87DF9083099FCA90209D41D12BC00FBEAEF656447A771EC8B35BAD0CD8`, r2는 `81E11E70F5D41D66500D5281A0CC180313E0C3A0D9B395903CACE78E16421F86`이며 r3 재검수 전 해소를 주장하지 않는다.
- 부모 요구: WORK_PLAN Stage B/FN01/UI02, SCREEN_WORK UI02, INTERFACES §9.2, DATA_MODEL §6.4~6.6. 자료 첨부 요구 자체를 새 기능으로 재승인받는 문서가 아니다.
- 목적: 사용자가 프로젝트 생성 전에 넣은 원문을 초안에 저장하고, 생성 후에도 **같은 artifact ID·바이트/hash와 명시적으로 선택한 관계**로 조회한다. 빈 배열·가짜 프로젝트 ID·다른 자료 ref로 대신하지 않는다.

## 1. 확인한 현재 상태와 추가 결정

| 구분 | 현재 근거 | 이번 후보의 추가 상세 |
|---|---|---|
| 입력/생성 | INTERFACES §9.2는 artifactRefs 저장과 생성 시 자료 귀속을 요구한다. repository의 비어 있지 않은 배열은 412다. | 초안 전용 업로드/보호 조회와 정확한 첨부 ref 검사를 연결한다. |
| 파일 | ArtifactStore는 projectId와 blobs/projectId만 받는다. | draft-blobs/draftId와 별도 staging, 프로젝트 귀속용 복사·검증/재확인을 추가한다. |
| DB | 0003_project_artifacts는 draft_id 열을 갖지만 app INSERT guard는 PROJECT/READY만 허용하고 UPDATE/DELETE를 금지한다. | DRAFT 명령/감사·원문 등록과 생성 명령에 한정된 귀속을 새 forward migration으로 보호한다. 일반 UPDATE/DELETE 권한은 주지 않는다. |
| 가져오기 | 현재 document_imports는 project_id 필수이고 프로젝트 정책을 요구한다. | 이번 원문 보관은 importDocument 권한을 초안으로 옮기지 않는다. 생성 후 기존 문서 가져오기에서 원문을 명시 선택한다. 생성 전 자동 파싱/공식 문서 확정은 이번 보관 기능의 완료로 주장하지 않는다. |

따라서 추가 판단 대상은 **초안 소유 범위의 새 전송/receipt·보호 조회, 제한된 자료 귀속/복구와 미적용 SQL의 상세**다. 프로젝트 uploadArtifact 일회 승인을 초안에 재사용하지 않는다.

## 2. 대안과 권장안

1. **권장: 별도 DRAFT 명령·저장 경계.** 현재 로그인/작성자/쓰기 client와 정확 초안 버전을 확인해 원문을 보관하고, 생성 transaction에서 선택 ref를 프로젝트로 귀속한다. 기존 PROJECT 정책·승인 경계를 유지하지만 신규 상세 계약과 forward SQL이 필요하다.
2. 생성할 때까지 브라우저 메모리에만 파일을 둔다. 구현은 짧지만 새로고침/세션 교체 시 원문을 잃고 중간 저장 요구를 충족하지 못한다. 완료안으로 채택하지 않는다.
3. 임시 프로젝트를 먼저 만들어 기존 업로드를 쓴다. 프로젝트 생성 의미·권한/감사·취소 처리가 달라지므로 기존 요구의 내부 구현으로 취급하지 않는다.

## 3. 사용자 동작과 범위

1. UI02에서 먼저 초안 ID를 저장한 뒤 자료를 선택한다. 업로드 전에 원문 이름·형식·크기와 보관 대상을 보여준다.
2. 명시 업로드는 원문 저장 결과를 반환한다. 업로드만으로 초안 버전·현재 선택 목록을 자동 변경하지 않는다.
3. 사용자가 선택한 정확 ref를 기존 saveProjectDraft로 저장한다. 새로 연 초안은 같은 목록과 보호 원문을 다시 조회한다.
4. 별도 최종 생성에서 정확 draftVersion의 선택 ref만 귀속한다. 생성된 프로젝트에서 기존 자료 조회/가져오기 경로로 이어진다.
5. 목록에서 제외한 업로드·격리/불명 자료는 자동 삭제하지 않는다. 생성 시 몰래 포함하지 않고 소유 초안의 보존 자료로 남긴다.

이 단위는 원문 보관·첨부/귀속이다. 생성 전 파서/대화 작성과 공식 문서 생성·검토·확정의 별도 미완료는 계획에 남기며, 원문 첨부를 해당 기능 완료로 바꾸지 않는다.

## 4. 제안하는 DRAFT 전송·권한

- POST `/api/v1/project-drafts/:draftId/files`: `X-Anvil-Command`의 명령은 `schemaVersion,commandId,clientId,expectedVersion,payload:{bytes,contentHash,mediaType}`이며 body는 원문 바이트다. metadata는 UTF-8 **8000 bytes 이하**의 단일 엄격 JSON으로 고정하고 중복 키/추가 필드·유효하지 않은 Unicode를 거절한다. operation은 `uploadProjectDraftArtifact`로 서버에서 고정한다. projectId/controlGeneration/PROJECT approvalRef는 받지 않는다. 기존 PROJECT 업로드 헤더 제한은 바꾸지 않는다.
- GET 같은 prefix `/:artifactId`: 현재 인증된 초안 작성자의 원문만 반환한다. 같은 사용자 다른 client의 읽기는 기존 readonly 초안 조회와 일치시키고, 쓰기는 원래 작성 client만 허용한다.
- 현재 로그인/CSRF·원 작성 client/초안 소유를 확인한 뒤 기존 FINALIZED intent의 같은 요청 replay를 먼저 분기한다. 완료 replay는 현재 초안 버전 일치를 요구하지 않으며 현재 원문 접근·격리/무결성과 같은 요청 body를 검사해 원 불변 receipt만 반환한다. 업로드 v1→선택 저장 v2 뒤에도 v1의 같은 완료 명령을 재확인할 수 있어야 한다. 소비/귀속 뒤에는 아래 현재 프로젝트 접근 규칙을 함께 적용한다.
- 신규·미확정 intent에만 쓰기 전·body 수신 전·최종 receipt 확정 전의 미소비/정확 초안 버전·유한 한도/파일 상태 검사를 적용한다. 인증/CSRF·원 작성 client/소유의 현재성은 모든 분기에서 유지한다. 클라이언트가 보낸 userId/path/storage_key는 받지 않는다.
- 명령 유일 키/전체 request hash·DRAFT receipt/audit를 결박한다. request hash는 서버 고정 operation/경로 draftId·명령 전체·body의 선언 bytes/hash/mediaType를 포함한다. replay도 제한된 body의 실제 bytes/hash를 확인하며 새로 쓰지 않는다. 다른 metadata/본문이면409이고, 단절은 UNKNOWN이다. 새 command/artifact ID 자동 재발급은 하지 않는다.
- 다른 사용자/초안 자료는 존재를 드러내지 않는404, 다른 쓰기 client는403, 오래된 버전은409, 소비된 초안의 신규 쓰기는412다. 실제 프로젝트로 옮긴 자료는 초안 GET으로 읽지 못한다. 프로젝트 GET은 현재 프로젝트 권한을 별도로 검사한다.
- 원문은 기존 알려진 비밀 표식 검사를 적용해 의심 자료를 격리 보존한다. 격리는 일반 원문 조회·첨부·Agent 전달을 차단하며 자동 해제/삭제하지 않는다. 완전한 비밀 탐지를 주장하지 않는다.
- 소비 후 원 업로드 POST replay는 **원 작성 client만** 요청할 수 있다. 이전 DRAFT receipt를 수정하지 않고, 현재 artifact가 귀속된 프로젝트의 회원·원문 조회 권한/격리를 먼저 재검사한 뒤 원문 bytes/hash와 같은 request를 확인해 원 불변 receipt만 반환한다. 회수/격리 시 성공 여부/ref/hash/receipt를 숨기고403/404로 거절한다. 다른 client의 readonly GET 권한을 POST replay 권한으로 확대하지 않는다. 미귀속 보존 자료는 여전히 원 초안 소유 범위로 조회한다.

## 5. 입력·용량·선택 ref

- 기존 ArtifactRef의 artifactId/bytes/contentHash/mediaType 전체를 대조한다. ID/hash만 같다는 이유로 다른 초안/프로젝트 자료를 연결하지 않는다.
- 기존 파일당20MiB를 유지한다. 새 DRAFT 헤더는 위8000 bytes이며 일반 JSON2MiB 정책과 혼동하지 않는다. MIME/확장자는 실행 허가가 아니며 HTML/스크립트/외부 URL을 실행하지 않는다.
- 아직 없는 초안 한도는 **제안값**으로 초안별 보존/예약 원문20개·선택 원문 합계100MiB, 사용자 소유 초안 원문/잔류 복사분 합계500MiB·200개를 둔다. consumed 초안의 미선택·격리·UNKNOWN·고아/중복 바이트도 이 한도에 계속 산입한다. 기존 프로젝트10GiB는 별도로 유지하며 사용자 전체 한도로 바꾸지 않는다. 값과 범위 모두 채택 전 적용하지 않는다.
- 소유 사용자별 quota 행을 잠그고 파일 생성 **전에** intent와 최악의 물리 사용량을 원자 예약한다. upload의 staging+게시 두 복사분, 생성 귀속의 새 프로젝트 복사분을 미리 포함한다. 동일 intent 재확인은 예약을 중복 증가시키지 않는다. 새 프로젝트 기본 quota에도 귀속 예정 바이트를 예약하며, 실제 복사본을 검증·정리하기 전에는 단순 상태값만으로 원 예약을 해제하지 않는다.
- byte/개수 기준에 예약·staging·READY·QUARANTINED·실패/UNKNOWN·미참조 게시 파일을 모두 포함한다. 알려진 body 미수신 실패의 미사용 예약만 사실에 맞게 해제한다. 부분/불명 파일과 intent는 보존/산입하고 자동 TTL 삭제로 한도를 맞추지 않는다. 0-byte 파일도 개수에 산입한다. 최종 귀속된 주 복사본은 프로젝트 quota로 옮기고, 남은 초안 복사분은 실제 회수할 때까지 사용자 초안 quota에 남긴다.
- saveProjectDraft는 같은 미소비 초안의 READY·비격리 원문만 선택한다. 중복 ref·다른 소유·변조/파일 누락은 거절하고 원 입력/명령은 보존한다.

## 6. 파일/DB 경계와 생성 시 귀속

파일과 DB는 별개다. 다음 intent/선택/귀속 기록은 **새 forward 상세 후보**이며 현재 존재하는 표라고 주장하지 않는다.

### 6.1 업로드 intent와 재시작

- 파일 생성 전 짧은 DB transaction에서 현재 세션/client·작성자·미소비 초안/정확 버전과 quota를 확인하고 `draft_upload_intents`를 예약한다. 유일 키는 `(draft_id,actor_id,client_id,external_command_id)`이며 request hash·처음 수락한 draftVersion·서버 artifact UUID/server command UUID/operation UUID·bytes/hash/mediaType·서버 생성 staging/final key·quota 예약을 고정한다. 같은 키의 다른 요청은409이며 같은 요청에 새 ID/key를 배정하지 않는다.
- 상태는 RESERVED→BYTES_VERIFIED→FINALIZED, 불명 중단은 UNKNOWN이다. 파일을 전혀 만들지 않았음이 확인된 거절만 REJECTED로 끝낸다. FINALIZED는 기존 artifact/command/receipt/audit가 같은 최종 transaction에 확정된 상태다. 상태 전이는 불변 사건으로 남기며 중간 상태를 업로드 성공으로 반환하지 않는다.
- 같은 intent의 동시 실행은 DB 잠금/시도 fencing과 독점 파일 생성으로 하나만 허용한다. 재시작은 기존 intent/실제 파일 상태를 읽고, 이미 게시한 파일은 같은 bytes/hash와 닫힌 이전 쓰기 소유를 확인한 뒤 새 쓰기 없이 재확정한다. 일부 파일·writer 종료 미확인·불명 key/지문이면 UNKNOWN을 유지한다. lease 만료만으로 덮어쓰기·truncate·새 ID 발급을 하지 않는다. 동일 root를 공유하는 다중 서버 운용은 이번 기본 범위가 아니다.
- 저장 순서는 초안 전용 staging→close/fsync·bytes/hash 검사→draft-blobs 독점 게시/재검증→READY 또는 QUARANTINED와 원 명령/receipt/audit의 최종 DB commit이다. publish 뒤 DB rollback도 intent와 원 파일을 남기므로 같은 명령이 같은 artifact ID를 되찾을 수 있어야 한다.
- 미확정 업로드를 마무리할 때도 현재 세션/client·초안 상태/버전을 다시 검사한다. 버전 변경·소비·권한 회수면 새 효과를 만들지 않고 불명 원문/예약을 보존한다. 현재 조회가 허용된 소유자에게만 복구 필요 상태를 표시한다. 완료된 원 receipt의 replay는 §4의 별도 규칙을 따른다.

### 6.2 선택과 원 provenance

- 초안의 원문 업로드 fact는 원 DRAFT command/receipt/audit와 영구 결박한다. `artifacts.id/created_by/client_id/command_id`는 귀속 때 바꾸지 않는다. 특히 `artifacts.command_id`를 createProject command로 대체하지 않는다.
- `draft_artifact_selections`는 초안 버전별 선택 snapshot이다. `(draft_id,draft_version,artifact_id)`와 정확 ArtifactRef·해당 버전을 만든 command/receipt를 결박한다. 초안 버전을 발급하는 기존 명령은 선택이 같아도 같은 transaction에서 그 버전의 선택 snapshot을 보존한다. 과거 초안/업로드 receipt는 수정하지 않는다.
- `draft_artifact_adoptions`는 원 draft/버전/선택 snapshot·upload intent/원 server command·artifact ID/bytes/hash/mediaType·원/새 storage key·target project·생성 intent/create server command·actor/client/시각의 불변 귀속 사건이다. 한 artifact의 최초 귀속은 한 건이며 같은 생성 명령 replay로 사건을 중복 추가하지 않는다. 과거 선택 ref는 이 사건을 통해 원 출처와 현재 소유를 구분한다.
- 선택하지 않은 READY/격리/불명 원문은 원 초안 소유로 보존하고 현재 프로젝트에 연결하지 않는다. 소비된 초안의 미귀속 원문도 현재 초안 소유자에게만 보호 조회하며 quota에 계속 산입한다. 귀속된 원문은 프로젝트 권한으로만 읽는다.

### 6.3 생성 intent와 원자 귀속

- `draft_creation_intents`는 원 external command/request hash·actor/client·정확 draftVersion/선택 snapshot hash·target project UUID·선택 ref 전체/원·새 key·복사 예약을 파일 복사 전에 저장한다. `(draft_id,actor_id,client_id,external_command_id)`는 유일하며 같은 초안 버전의 미확정 생성 intent는 하나만 허용한다. 다른 생성 명령은409로 거절한다.
- 상태는 RESERVED→COPIES_VERIFIED→COMMITTED, 불명은 UNKNOWN이다. COMMITTED는 프로젝트/소유 참여·초기 제어·방법론 snapshot·초안 소비·선택 원문 귀속/사건·명령/receipt/audit가 **같은 최종 DB transaction**에 확정된 상태다. 같은 명령 재확인은 기존 target project UUID와 receipt만 사용한다.
- 새 프로젝트 위치에 원문을 독점 복사·sync·재검증하되 원 바이트는 유지한다. 최종 transaction 직전에 현재 세션/client·초안 버전·선택 ref·intent·원/새 파일 지문과 quota를 다시 확인한다. 파일·DB 중 하나만 준비됐으면 일부 프로젝트/자료 귀속을 공개하지 않는다.
- 귀속 함수는 새 createProject 명령/현재 인증된 DRAFT actor·exact intent/선택 snapshot·원 upload fact·새 프로젝트 소유/초기 제어·현재 artifact 상태/원·새 key를 검사한 뒤 `project_id/draft_id/storage_key`만 제한 전환한다. 원 command FK/내용/원본문 지문은 불변이며 별도 귀속 사건을 추가한다. 일반 app UPDATE/DELETE는 계속 금지한다.
- 한정 함수가 definer 권한을 쓰면 고정 `search_path`·완전 수식 객체명·동적 SQL 금지·PUBLIC 실행권 회수·정확 app 경로만 실행 허용을 고정한다. GUC의 actor 문자열만 신뢰하지 않고 기존 DRAFT 인증/명령 guard가 확인한 세션/client·원 command/receipt와 대조한다. 최종 FK/지연 제약과 실제 직접 DML 거절을 검수한다.
- 이 경로의 공통 잠금 순서는 현재 인증 세션/client gate→owner quota→draft→같은 명령/intent→정렬한 artifact/선택 행→새 프로젝트/관계다. 관련 초안 수정·소비·귀속/정리도 같은 순서와 현재성 검사를 소비한다. 실제 PG 경합/권한 회수 시험 없이 직렬화를 입증했다고 하지 않는다.

### 6.4 장애/잔류와 quota 해제

| 지점 | 보존/재확인 | 공개 효과·예약 |
|---|---|---|
| 예약 후 body 미수신 | 같은 upload intent·명령으로 상태 확인 | 미생성 확인 시만 미사용 예약 해제; 원문 성공0 |
| 부분 쓰기/publish 불명 | 같은 ID/key·지문·이전 writer 종료를 대조, 확인 안 되면 UNKNOWN | 새 ID/덮기/자동삭제0; 실제/불명 예약 유지 |
| 게시 후 최종 DB rollback | intent의 같은 게시 원문을 검증해 동일 명령으로 재확정 | 새 artifact0; receipt 전 정상 조회/첨부0 |
| 생성 복사 중 실패 | 초안 원문·creation intent·부분 복사분 보존 | 프로젝트/부분귀속0; 복사 예약 유지 |
| 생성 COMMIT/응답 유실 | 현재 권한과 같은 intent의 원 receipt/target project 조회 | 새 프로젝트/귀속 사건0; 현재 주 복사분은 project quota |
| 귀속 후 이전 중복 바이트 | 현재 DB 귀속·새 주 원문의 bytes/hash·같은 intent의 원 key·현재 권한을 재확인한 정확 중복분만 회수 | 마지막 원문 삭제0; 회수 실패/권한 불명은 보존·owner 초안 quota 산입 |

자동 보존기간 만료·백업 삭제·임의 고아 청소는 추가하지 않는다. 미선택/실패 원문의 제거는 별도 사용자 선택/권한·자료 보존 정책 범위이며 이 후보의 자동 용량 맞추기 수단이 아니다. 실제 소유·잠금·intent/receipt·관계/파일 검증이 미연결이면 저장/귀속 불가로 남긴다.

## 7. 검수와 완료 증거

- 정상: 파일 선택→명시 업로드→초안 중간 저장→새 조회→정확 버전 생성→같은 ID/bytes/hash·관계의 프로젝트 원문 조회.
- 타 사용자/다른 초안/client·오래된 초안·격리/변조/누락·중복 선택·body와metadata 불일치는 원자료 보존/전송·부분귀속0을 확인한다.
- 같은 업로드/생성 명령의 정상 replay·다른 payload409·응답 유실/재시작의 동일 intent·명령 유지와 중복 프로젝트/원문0을 확인한다.
- staging/write/sync/publish/DB commit/응답 경계 실패 및 동시 생성/초안 수정에서 원문 보존·일부 귀속 비공개·현재 권한 재검사를 확인한다. 실제 PG·파일·프로세스 재시작 증거와 fake/메모리 시험을 분리한다.
- 기존 자료 없는 생성·방법론 선택/검토/확정·기존 소스 선언·PROJECT uploadArtifact/일회 승인/문서 원문 경로는 직접 영향 회귀로 보존한다.
- 실파일/DB/브라우저 증거 전에는 소스 구현 상태다. 실제 사용자 권한 자동 부여·Agent 실행·복원/운영/Oracle 검증은 포함하지 않는다.

## 8. 필요한 정확한 판단

이 후보의 DRAFT 원문 전송/보호 조회·receipt/audit·제한 귀속/intent와 제안 한도를 **source·미적용 forward SQL·합성/격리 개발 검수의 상세 기준으로 채택할지** 판단한다. 정확한 실제 DB 적용·정식 경로/자원/정책 변경·서비스 반영·사용자 권한·실Agent는 별도다. 기존 계획 전체/FN01 전체 재승인이나 이미 거절된 다른 SQL의 재시도를 요청하지 않는다. 채택 전에는 기존 412·PROJECT 권한/승인 경계를 유지한다.
