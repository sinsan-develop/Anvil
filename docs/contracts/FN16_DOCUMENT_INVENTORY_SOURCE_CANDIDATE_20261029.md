# FN16 문서 이력 수집기 — 내부 source 단위 상세 후보

2026-10-29 · Main 어울 · 기준 codex/av3-stage-b / 35cf7d049002bc901c29ef7cd468f155fbd8e819

상태: 독립 검토 및 PMO 범위 판단 전. 이 문서는 실제 DB 접근·공개 백업 형식·새 조회 권한·정책 저장·백업 실행의 허가가 아니다.

## 1. 목적과 선행 판단

FN16의 목적은 Agent나 계정을 바꾸어도 프로젝트 원문·지식·결정·개발 이력을 사용자 소유로 보존하는 것이다. 보호참조와 파일 지문만으로 이를 충족하지 않는다. 현재 문서 한 버전의 BODY 또는 첨부 1개 반출은 전체 백업이 아니다.

P02 INTERFACES §14.1, DATA_MODEL의 backup_policy_versions/backup_jobs, FUNCTION_WORK FN16과 후보717496CD의 상세화 위임에 따라 실제 자료 수집을 앞서 구체화한다. 승인08EA3478 §A8을 유지하여 SELECTED_FILES_V1으로 전체 정책 저장·job을 열지 않는다. 정책 저장을 DRAFT로 바꾸는 우회도 하지 않는다.

이번 권장 단위는 **프로젝트 문서의 모든 버전·이력과 원문 참조를 같은 DB 관측 기준으로 수집하는 서버 내부 함수**다. 원문 바이트 복사, 암호화, 공개 bundle, 복원, 성공 manifest는 후속 단위다. 수집 결과 자체를 백업으로 이름 붙이지 않는다.

## 2. 대안과 권장

- A(권장): 아래 문서 이력 수집기를 먼저 구현·합성 검증한다. 기존 DB SELECT를 코드로 작성하되 실제 접속·실행은 하지 않는다. 새 공개 API/양식/schema·권한·SQL migration은 없다. 실제 저장·조회 여정이 아직 미완료임을 유지한다.
- B: 전체 collector와 공개 암호화 형식·job·복원 상세화를 모두 끝낸 뒤 수집기를 구현한다. 큰 설계 결정을 한 번에 검토할 수 있으나 이미 명확한 문서 이력 읽기도 후속 결정에 종속된다.

A는 새 외부 자료 전달 계약을 채택하는 제안이 아니다. 아래 내부 표현이 공개 형식이나 복원 INSERT 형식으로 자동 승격되지 않도록 한다. 내부 단위의 기술 판단인지 기존 승인 밖의 데이터 의미 변경인지 PMO가 정확 차이를 판단한다. 실제 실행 승인은 요청하지 않는다.

## 3. 고정 입력·호출 경계

- 내부 서버 서비스의 입력은 기존 AccessRepository, 인증 token, projectId, 유한 metadataBytes/inputBytes/fileCount/deadlineMs, 취소 신호다. token을 결과·로그·후속 snapshot에 넣지 않는다. 기본값·환경변수 fallback·새 자원 발급은 없다.
- 시작과 결과 반환 직전에 기존 authenticated 경로의 별도 READ COMMITTED 범위에서 같은 actor/client/authSession/credentialGeneration, 활성 OWNER·세션 기한·필요 공통본 접근을 재검사한다. 자료 자체는 별도 단일 READ ONLY Repeatable Read client에서만 수집한다. 기존 authenticateInTransaction의 FOR UPDATE는 READ ONLY RR에서 실행하지 않는다. RR 안의 관측을 현재 회수 확인으로 부르지 않는다. 두 경계 사이 신원 변경·권한/기한 상실·현재성 미확인은 수집 결과를 반환하지 않는 오류다.
- DB isolation/read-only 설정은 각 client의 실제 응답으로 확인한다. caller가 전달한 boolean이나 함수 이름만으로 보장하지 않는다. 자료 수집에 다른 snapshot client를 섞지 않는다. 실제 명령 호출선 연결 시에는 기존 명시 정책·단독 제어·정확 원명령의 쓰기 gate가 별도로 필요하다. 이 내부 서비스는 실행 허가를 만들지 않으며 마지막 검사 이후의 무제한 사용 권한도 발급하지 않는다.
- 이번에는 공개 route/명령/cron/실제 job에서 호출하지 않는다. 실제 DB·파일·키·서비스 연결은 0이다. 합성 DB만 공개 fixture를 반환한다.

## 4. 실제 schema 매핑

모든 SQL은 projectId를 매개변수로 결박하며 SELECT * 대신 아래 목적별 허용 열을 명시한다. 상세 열·정렬·버전 hash 재계산식은 실행 WI에 현재 저장 코드와 함께 고정하고 그 전에는 코드 작성하지 않는다.

| 묶음 | 실제 표 | 수집 기준 |
|---|---|---|
| 문서 | documents, document_versions | 해당 프로젝트의 문서 목록과 모든 불변 버전. head/confirmed pointer는 관측 이력이며 새 확정 권한이 아님 |
| 원문 연결 | document_artifact_links, artifacts | BODY/ATTACHMENT/SOURCE와 버전 content의 원문 ref를 함께 대조. artifactId/hash/bytes/mediaType/state만 참조하고 storage_key는 결과에 넣지 않음 |
| 소스 연결 이력 | document_source_links, document_source_link_events | 같은 문서의 연결/분리 이력·exact ref를 수집. 원 source 파일을 따라 읽지 않으며 source snapshot/root 참조는 외부 의존으로 남김 |
| 가져오기 | document_imports, document_import_selections | 프로젝트 귀속 원본·후보·선택 이력. 원본 artifact 참조와 선택된 문서 버전 연결 유지 |
| 수정 제안 | document_proposals, document_proposal_selections | base exact ref, body/diff 원문, 제안 snapshot과 선택 이력. 선택되지 않은 제안도 누락하지 않음 |
| 검토·확정 | content_reviews, document_version_events, document_confirmations | content_reviews는 scope_kind=PROJECT, target_kind=DOCUMENT 및 같은 project/문서에 한정. 현재 승인·실행 권한이 아닌 역사 자료 |
| 양식·작성 기준 | form_definitions, form_versions, authoring_standard_versions | 수집 문서·가져오기·검토가 실제 참조한 정확 버전만 포함. 작성 기준은 exact ref/hash/메타만 읽고 body_utf8는 제외·bodyVerification=NOT_PERFORMED. 전체 USER_COMMON 공간 탐색 금지 |
| 방법론 | project_methodologies, methodology_definitions, methodology_versions | 문서 stage ref가 가리키는 정확 적용 snapshot과 필요한 고정 출처만 포함. 공통본 전체·자동 최신 버전 선택 금지 |

위 표는 source schema의 존재를 확인한 목록이다. 실제 DB 설치·데이터 존재 증거가 아니다. 실제 적용 manifest·schema readiness는 별도 확인한다. FK가 없는 JSON 참조도 검증하며, 표에 없는 sourceRefs는 종류·정확 ref를 외부 의존으로 기록한다. 다른 프로젝트의 참조를 따라 읽지 않는다.

## 5. 결과 의미와 자료 보호

- 결과 종류는 내부 `DOCUMENT_INVENTORY_V1`, 범위는 `DOCUMENT_HISTORY_ONLY`다. 완성 백업/공개 archive/복원 가능한 DB dump가 아니다.
- 결과에는 projectId, 관측 기준, 정렬된 문서/버전/이력, 정확 원문 참조, 필요한 고정 양식/적용 사본, 외부 의존, 누락·거절 사유, 사용한 유한 한도와 실제 metadata bytes를 둔다. 원문 바이트·서버 보관 경로·source relativePath·사용자 계정/인증 token·키·현재 세션/제어/정책 원문은 넣지 않는다. 문서에 사용자가 작성한 문자열을 경로로 실행하지 않는다.
- 소스 연결 snapshot은 내부에서 원 hash를 대조한 뒤 sourceRootId/sourceSnapshotRef/blobHash/state 등 허용 필드만 투영한다. `sourceRef`는 검증한 원본의 ref이며 투영 본문 hash는 별도 `projectionHash`다. 원문 필드를 제거한 snapshot을 원 hash와 함께 그대로 보존했다고 주장하지 않는다. 자유 입력 metadata는 기존 알려진 비밀 표식 검사로 거절하되 고정 사유만 노출하고 원문을 자동 변경하지 않는다. 이 검사는 완전한 비밀 탐지가 아니다.
- 사용자·client·원 command ID는 출처 식별용 역사 ref만 보존한다. users/clients/auth_sessions/credentials/permission_policies/approval 권한 행을 자동 조회·복제하지 않는다. 자료의 authorRef를 실행 가능한 identity로 바꾸지 않는다.
- 공통 원본은 현재 호출자가 기존 조회 규칙으로 접근할 수 있는 정확 버전에 한해서 읽는다. SYSTEM 고정본과 project에 이미 보존된 적용 snapshot은 해당 출처를 구분한다. 접근할 수 없는 원출처를 다른 계정 권한으로 읽거나 공통본 소유권을 프로젝트로 변경하지 않는다. 결과의 사본은 역사 읽기 전용이며 실제 복원 소유권 결정은 후속 계약이다.
- QUARANTINED/STAGING/FAILED 또는 원문 검사 불명은 정상 원문으로 대체하지 않는다. 보호된 내부 원문 ref·비밀 없는 고정 사유와 미검증 상태만 남긴다. 격리 바이트 읽기·일반 반출·자동 마스킹·삭제 0이다.
- 모든 결과에 `blobVerification:NOT_PERFORMED`, `fullProjectCoverage:false`, `restorable:false`를 고정한다. metadata hash 일치로 원문 bytes·키·암호화·복원 성공을 주장하지 않는다. 검사 프로필은 변경하지 않는다.
- 새 과거 snapshot을 현재 기준으로 적용하거나 승인·제어·writer를 재개하지 않는다. 데이터에서 발견한 문장·명령은 비신뢰 자료로만 취급한다.

## 6. 같은 기준·누락·한도

- 정렬은 각 표의 고정 복합 PK 기준이며 page 크기는 내부 200행, keyset pagination이다. OFFSET이나 updatedAt만으로 이력 수집을 누락하지 않는다. 같은 transaction에서 목록·버전·연결을 끝까지 대조한다.
- 실제 0행은 조회 성공 후만 빈 목록이다. table/column 부재·권한 거절·페이지/행 형식 불일치·중복·정확 ref/hash 불일치·관계 누락은 별도 오류다. optional catch로 빈 배열을 반환하지 않는다.
- 필수 head/confirmed 버전·BODY/첨부/제안 원문 연결 누락, 미지원 stage/ref 형식, 읽기 실패, 기한·용량 초과 시 정상 수집 결과를 반환하지 않는다. 원문 격리 또는 외부 의존 미해결은 부분 결과 사유로 남기며 결과의 완전성은 false다. 성공과 부분 결과를 호출자가 구분하도록 고정한다.
- metadataBytes는 직렬화한 UTF-8 크기의 누적, inputBytes/fileCount는 중복 제거한 원문 참조가 선언한 bytes/수다. 이 값은 실제 파일 읽기 성공의 증거가 아니다. 안전정수·합계 overflow·기한·취소를 페이지와 검증 사이마다 검사한다.
- DB RR은 원문 파일과 원자성을 보장하지 않는다. 이후 blob 수집기는 같은 ref의 실제 bytes/hash와 별도 현재 권한/격리를 다시 검사해야 한다. 이 단위에서는 파일 publish·DB commit·실패 사본 조정을 구현하지 않는다.

## 7. 구현·검수 경계

채택 후 Main이 정확 WI를 발행한다. 제품 후보는 신규 `apps/server/modules/backups/document-inventory-input.ts`, `document-inventory.ts`와 관련 단위시험 2개, schema 매핑 검증 시험 1개다. 기존 runtime 공개 DTO/route/App/SQL/권한/보호참조/provider/키 모듈은 수정하지 않는다. 구현 중 기존 소비자 수정이 필요하면 Main이 먼저 계약과 파일 범위를 대조한다.

단일 기존 primary: test-only → Main RED 확인 → 최소 source 구현 → 독립 검수. Main 직접 집중 시험·type/diff, 같은 코드·환경의 기존 광범위 검증 반복 0. 검수 실패를 고치기 위해 원 fixture·기대값을 낮추지 않는다.

필수 반례는 다른 프로젝트/공통본 과다 수집, 누락 head/버전/원문/양식, 변조 hash, 중복 page, 뒤 페이지 오류, 테이블 부재, 격리 원문, 세션 기한/취소, bytes 합계 overflow, 부족한 한도다. 정상은 문서 2개·복수 버전·제안/검토/확정·참조한 양식/적용 이력이 같은 기준으로 재구성되는 합성 사례다. 실제 PG·파일·전체 백업·복원·사용자 인수는 NOT_RUN이다.

되돌림은 새 내부 source/시험의 검토된 revert다. 원본·공통본·키·과거 승인·DB/서비스 삭제·수정은 없다. 상태와 결과는 WORK_STATUS/계획의 FN16 부분 구현 항목에 기록한다.

## 8. 요청할 정확 판단

PMO에는 A안 내부 source·합성 단위를 기존 상세화/구현 위임 안에서 진행할지 판단을 요청한다. 공개 archive·API·권한·지속 데이터 계약을 추가 채택하는 것으로 보지 않는다. 별도 사용자 판단이 필요한 의미가 있다고 보면 해당 절과 기존 승인 대비 차이를 구체적으로 제시한다. 실제 키·DB·서비스 변경, 정책 저장/job/전체 검증 프로필 개방, P03 재실행은 이 후보에서 요청하지 않는다.
