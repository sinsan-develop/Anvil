# FN03/UI06 단계 산출물 항목 귀속 후보

**미채택 · 제품 구현 전.** 결정할 사항은 사람이 선택한 방법론 산출물 항목을 문서의 **그 저장 버전**에 결박하고 기존 버전 상세 GET에서 확인할 수 있게 할지다. 현재 제품 기준은 main `8776fe90`이다. 기존 Stage 문서 계약과 UI06 목표는 유지한다. [INTERFACES §문서, 249·673~677행](INTERFACES.md) · [UI06 업무 카드](../work_packages/SCREEN_WORK.md)

## 현재 잃는 정보

`prepareStageDocumentDraft`는 현재 프로젝트 적용본의 fullref, 노드, 선택한 `outputs[].itemId`, 정확한 `formRef`를 확인한다. 빈 초안에는 `stageNodeRef={applicationId,nodeId}`와 `formRef`만 반환한다. `ProjectDocuments.save`와 기존 DB guard는 노드의 입력·출력 중 같은 양식이 있음을 검사한다. 그래서 같은 노드의 산출물 A·B가 같은 양식을 쓰면 B를 선택하고 저장해도 원 버전 상세에서 A와 B를 구별할 수 없다. `content.sections[].itemId`는 양식 정의의 항목과 본문 줄 위치를 연결한다. 이 값을 방법론 산출물 선택으로 해석하면 두 독립 식별자가 뒤섞인다.

Main의 기존 RAM 재현 `44b42a`에서 같은 양식에 연결된 `METHOD_ARTIFACT_A`와 `METHOD_ARTIFACT_B`를 각각 선택했다. 두 반환 초안 모두 선택 ID가 없고 stage/form은 동일했다. mock GET 10회, 실네트워크·쓰기 0회다. 이 결과는 선택값 소실의 근거다.

## 권장 결정 A — 기존 저장 영수증에 버전별 귀속

| 경계 | 채택할 값과 판정 |
| --- | --- |
| 저장 요청 | 기존 `saveDocumentDraft.payload`에 선택 키 **`stageOutputItem`** 1개를 허용한다. 값은 exact `{applicationRef:{id,version,contentHash},itemId:string}`이다. node와 양식은 기존 필수 `stageNodeRef`, `formRef`에서 얻는다. 명시 null, 빈 itemId, 추가 키, stage가 null인 결박을 거절한다. 과거 형상은 키를 생략한다. |
| 원자료 검산 | 서버는 회원·현재 HUMAN/client·제어세대·정책을 원 거래에서 확인한다. 같은 project의 적용 행을 읽고 `applicationRef.id/version/contentHash`를 `id/application_version/snapshot_hash`와 전부 비교한다. 기존 `document-stage.application`의 sourceRef/graph hash/snapshot hash 검사를 사용한다. `stageNodeRef.applicationId`가 같고, 고정 graph에 nodeId가 정확히 하나이며 그 **outputs** 안에 같은 itemId가 정확히 하나여야 한다. 그 항목의 formRef 세 필드와 저장 formRef 및 재검산한 실제 양식 버전이 일치해야 한다. 같은 itemId가 두 번 나오면 양식이 달라도 거절한다. |
| 내구 정본 | 기존 `document_versions.command_id`가 가리키는 **원 생성 명령**의 `commands.result_ref.data.stageOutputItem`에 검산값을 한 번 기록한다. 같은 거래의 기존 `data.ref/stageNodeRef/stageBinding`, 문서 버전·형식, 인증 영수증과 결박한다. 행의 project/document/version 세 좌표 및 command_id를 사용한다. 문서 전체의 가변 속성이나 최신 명령을 읽지 않는다. 새 표·열·역할이 필요하지 않다. 문서 내용 해시의 정본 `{title,formRef,stageNodeRef,content}`를 그대로 유지한다. 항목까지 확인하려면 보호된 원 영수증과 버전행 대조가 필요하며 contentHash 단독으로는 이를 증명할 수 없다. |
| 읽기 | 기존 `GET documents/:id/versions/:version`에서 동일 프로젝트의 해당 버전과 원 APPLIED/saveDocumentDraft 명령을 결합한다. 원 명령 ID·scope/project·actor/client·결과 target/version/fullref·저장 stage/form 및 원 인증 영수증의 관계를 대조한다. 고정 당시 application을 읽어 위 node/output/form 검사를 수행한다. 결박이 있는 버전만 상세 응답에 같은 `stageOutputItem`을 추가한다. 정상 원 명령의 키 부재는 **항목 미기록(UNKNOWN)** 이다. 원 명령 자체의 부재·다른 project/operation/ref·명시 null·형상손상·고정 graph 불일치는 기존 무결성 실패로 종료하며 미기록 표시는 하지 않는다. 현재 적용본이 바뀌어도 정상 과거 버전을 원 적용본으로 읽는다. |
| 호환성과 개정 | 일반 양식·단계만 연결된 기존 문서/초안은 종전 생략형 저장·읽기를 유지한다. 설령 그 단계에 출력 하나만 있어도 추정하지 않는다. 이 후보에서 선택 귀속은 명시적인 새 단계 산출물 초안에서 시작한다. 결박된 문서의 후속 개정 및 제안 반영은 정확 이전 head와 **같은 결박**을 요청에 명시하고 CAS한다. 구 client가 결박을 누락하거나 A→B, 단계/양식을 바꾸면 충돌로 원 버전·입력 보존. 이전 미기록 문서에 대한 소급 배정, 재배정·해제·일괄 backfill은 별도 기능이다. |
| 공개 의미 | 저장된 특정 버전이 B에 귀속됨을 상세 화면에서 표시한다. A/B의 작성 완료·미작성, 프로젝트별 유일 문서, 검토·확정, 현재 단계 통과, 다음 실행 권위는 별개다. 기존 stage-options/단계 목록 GET·cursor·필터에는 항목 분류를 추가하지 않는다. |

**적용본 교체 후의 개정 제한.** 기존 저장 경로는 쓰기 시점의 현재 적용본을 요구한다. 이 후보는 결박된 버전의 개정·제안 반영에 원 귀속을 그대로 유지할 조건을 더한다. 따라서 B 저장 뒤 적용본이 교체되면 과거 B의 상세는 원 적용본으로 읽을 수 있지만, 새 적용본에 같은 이름·같은 양식의 B가 있어도 기존 문서의 개정·제안 반영은 409로 거절하고 편집 입력을 보존한다. 새 적용본의 항목으로 자동 이식하거나 원 귀속을 해제하지 않는다.

### 저장 시점·승인·불명

- 기본/작성틀 경로에서 선택값을 복사해 원 사용자·client·프로젝트·초안과 묶고, 업로드 전 pending 생성부터 같은 saveCommandId·요청에 유지한다. 선택/주체/문맥 변경, 재진입이나 늦은 응답으로 이전 B를 현재 선택 A에 붙이지 않는다. 빈 작성틀의 section 항목을 수정해도 선택 귀속은 바뀌지 않는다. 단계 selector 변경 시 B를 새 단계에 이식하지 않는다. 새 초안은 명시적으로 다시 준비하며 기존 결박 버전에서는 귀속 변경 저장을 거절한다.
- 쓰기에는 **현재** 적용본이 필요하다. 서버의 보호 명령 거래에서 방법론 적용 writer와 동일 프로젝트 직렬화 경계를 확보한 뒤 현재 fullref와 기준 head를 재검산하고 버전·영수증까지 한 거래로 저장한다. 화면에서 준비한 뒤 방법론이 바뀌면 409로 원 초안을 보존한다. 검산과 INSERT 사이 현재성이 바뀌도록 허용하는 독립 SELECT 두 번은 완료 증거가 아니다.
- 기존 승인 정책과 명령 해시를 사용한다. save의 `request_hash`와 해당 연산이 일회 승인을 요구할 때의 `payloadHash/scopeDigest`에는 item까지 들어간다. A 승인으로 B 저장 불가. UI의 기존 upload 승인은 업로드 바이트에만 적용되고 save의 `approvalRef:null`로 승계하지 않는다. 업로드 승인 준비와 승인 소비 사이에는 pending의 원 선택값도 재대조한다. 본 후보는 현재 지원하지 않는 save 승인 모드를 새로 열지 않는다.
- 동일 commandId·동일 원 요청 replay는 동일 버전/결박을 반환한다. 같은 명령의 item을 바꿔 재시도하면 기존 conflict, 추가 버전·승인 소비 0. 응답 유실·COMMIT 불명은 기존 reconcile-first를 지키고 새 명령 자동 발급 0. 독립적으로 완료된 업로드의 기존 회수/보존 절차를 유지한다. 성공 응답에서 B가 누락되거나 A로 바뀌면 저장 성공으로 채택하지 않는다.

### 원 요청으로의 역검산과 저장량

- 결박을 가진 새 저장만 기존 audit_events.reason_code에 전용 값 `EXPLICIT_DOCUMENT_DRAFT_STAGE_OUTPUT`을 쓴다. 이것은 감사 소비자에게도 관측되는 **새 이유 값**으로 이번 결정에 포함한다. 원 `EXPLICIT_DOCUMENT_DRAFT`와 결박 키 부재가 함께 확인된 버전만 미기록 처리한다. 새 감사 값인데 키가 사라졌거나 원 감사가 없으면 503이다. 이전버전 전체를 새 키로 재작성하지 않는다.
- 결박 저장은 `baselineRefs:[]`, `schemaVersion:1`, `proposalRef`는 생략 또는 원 제안 UUID만 허용해 저장 시점 원 요청을 재구성 가능한 닫힌 형상으로 한정한다. 상세 판독은 버전행의 title/form/원문 content/stage/reason, 해당 version의 import·proposal 선택(없으면 null/생략), 원 command 행의 project/commandId/client/controlGeneration/expectedVersion, 원 audit.approval_ref(null 포함), 신규 결박으로 원 save envelope를 복원한다. 신규이면 targetId=null, 개정이면 해당 문서 id다. canonical 해시가 commands.request_hash와 같아야 한다. 기존 `persistProjectReceipt`의 공식으로 scopeDigest를 재산출해 원 authorization_receipts와 HUMAN/APPLIED audit의 command·operation·project·subject·targetRef·policy·digest를 검산한다. 일회승인이 있으면 payloadRef.payloadHash/decisionRef와 원 consumption도 대조한다. 같은 양식의 A↔B 변조는 내용 해시가 같아도 원 요청 해시에서 거절된다. 이 확인은 서버 내부에서 수행하고 상세 응답에 감사 원문·자격정보를 전송하지 않는다.
- 기존 저장량 계약은 본문을 재보관하지 않는 `saveDocumentDraft` 참조 쓰기의 파일 delta를 0으로 취급한다. 이 후보에서 본문·양식·감사 본문을 별도 복제하지 않는다. 기존 receipt에 유계 applicationRef/itemId를 넣는 DB 메타데이터와 기존 감사 reason 값의 길이는 늘어난다. 이를 새 ARTIFACT 원문 bytes로 계상하거나 새 R 예약·별도 관리 quota를 묵시적으로 만들지 않는다. 백업의 `document-inventory.ts` 문서 행 투영은 원 save의 request_hash/result_ref/audit를 완비하지 않는다. 그 내역만 있는 백업에서는 항목 UNKNOWN이며 원 영수증 복원까지 보증하려면 별도 백업 계약이 필요하다. [기존 참조 저장량 기준 §105행](PROJECT_STORAGE_QUOTA_RESERVATION_SOURCE_CANDIDATE_20261031.md)

## 구현 범위와 증거

기존 `0003_document_stage_bindings.sql`은 그대로 두고 다음 미적용 forward `db/migrations/0099_document_stage_output_item.sql.pending`을 제안한다. 버전 INSERT의 원 app/GUC·명령·결과 fullref·원 project·고정 graph/현재 적용·OUTPUT item/form 관계를 확인하는 추가 invoker guard다. 신규 결박 저장 시 원 요청 검산·원 영수증 정착을 서버에서 선행한다. 개정에서는 이전 head 명령의 결박을 읽어 누락/교체를 막는다. 기존 문서/저장 명령의 불변 보호, 강제 RLS, 기존 권한을 유지한다. SQL에 없는 원 요청 본문을 GUC나 DB 결과만으로 재생산했다고 주장하지 않는다. 신규 백업 포맷은 범위 밖이다. 기존 inventory/export가 원 command 결과를 포함하지 않으면 그 자료로 항목을 복원하거나 검증했다고 표시하지 않는다.

| 구현 시 한정할 경로 | 변경 목적 |
| --- | --- |
| `apps/server/modules/documents/{document-stage,project-documents,project-proposals}.ts` | 원 적용본/항목 검사, 저장·버전별 영수증 조회·제안 반영의 원 base 결박. 기존 membership 및 보호 읽기 모드별 권한을 유지하고 필요한 원명령의 최소 필드만 동일 거래에서 읽는다. |
| `apps/web/src/features/design-trace/{stage-document-draft,editor-api,api,document-upload-approval,conflict-api,proposal-api}.ts` | 선택값 보존, 기존 save/GET/approval/pending·복구·제안의 same-binding 검산. form-document-outline은 기존 준비 함수를 호출하고 그 값을 그대로 보존하는지 시험한다. |
| `apps/web/src/features/design-trace/{DocumentEditor,DocumentsPage}.tsx` | 고정 버전의 검산된 항목/미기록 표시, 단계 변경·충돌/개정에서 묵시적 귀속 이동 방지. |
| 위 forward SQL 및 `tests/unit/FN03/document-stage.test.ts`, `tests/unit/UI06/{stage-document-draft,editor-api,document-upload-approval,conflict-api,proposal-api}.test.ts`, `tests/integration/FN03/document-stages.test.ts` | 순수·RAM 제품 경로, SQL 정적 대조 및 실제 DB 통합 시험 소스. 이 후보의 채택 범위는 source·RAM과 미적용 SQL이며 실제 PG/승인/권한·served UI 검증은 미실행으로 보고한다. |

**최소 수용 사례**

1. 한 노드의 A/B가 같은 form fullref를 쓰고, 양식 본문의 section도 A와 같은 이름을 쓴다. 사람이 B를 선택해 빈 초안/작성틀 준비→원 업로드·저장→정확 버전 재조회. 원 save payload·receipt·상세에서 B 하나만 확인하고 원 section은 그대로 A다. 동일한 두 후보 중 첫 항목을 고르는 구현은 이 시험에서 실패한다.
2. 과거 stage만 있는 버전과 일반 문서에는 키가 없다. read→기존 호환 개정으로 과거/새 버전 미기록을 확인한다. 결박된 v1→v2는 B를 보존하고, v1의 fullref/본문/영수증은 그대로다. 같은 내용이라도 새 버전 ID·순번과 원 명령으로 읽는다.
3. 교차 프로젝트, 오래된 application·같은 ID의 다른 snapshot hash, 입력 항목만 존재, node/item 중복, 같은 form ID의 다른 version/hash, 결박된 버전의 무키 개정, 선택 후 변경·늦은 응답·권한 회수, CAS 충돌을 거절한다. 신규 자료·연결·target version 및 승인 소비 0을 관측한다. 경쟁 적용/저장의 실제 PG 직렬화는 RAM으로 입증했다고 처리하지 않는다.
4. 같은 command replay/응답유실, 다른 item에 승인/제안 재사용, 원 명령의 다른 fullref 또는 명시 null을 검산한다. 선택 저장을 실패시킨 경우 이전 버전과 검토/확정 이력은 보존한다. 기존 단계 목록 조회·본문 해시와 sourceRefs·baseline/backup 소비의 기존 보증은 회귀 검증한다.

5. B를 저장하고 적용본을 같은 이름·같은 양식의 B가 있는 새 적용본으로 교체한다. 저장된 버전의 상세 GET은 원 적용본의 B를 반환한다. 원 문서의 개정과 제안 반영은 각각 409로 끝나며 작성 중 입력과 원 버전이 보존되고 신규 버전은 0건이다.

**결정 요청의 범위**는 선택 키, 원 영수증에서의 버전별 귀속·상세 응답, 결박 개정과 미기록 호환 규칙 및 위 forward guard다. 보류하면 현재 단계/양식 조회는 가능하고 산출물 항목 귀속은 미확인으로 남는다. 적용 후 복구 시 먼저 새 결박 쓰기를 닫고 이미 저장한 B를 판독하는 reader/guard는 보존한다. 과거 행 수정·원 영수증 삭제로 되돌리지 않는다. 이 문서 작성에서 제품·시험·SQL 변경 및 실제 DB/권한/서비스 실행은 0회다.
