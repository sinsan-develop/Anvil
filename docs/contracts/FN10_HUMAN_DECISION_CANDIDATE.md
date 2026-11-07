# FN10 사람 typed 결정 저장·평가 선행 계약 후보

- 상태: **별도 확정 묶음 선택 방향 직접 결정 / 상세 계약 후보 r2 / PRODUCT_GO0 / 실제 실행0**. 원안 2026-10-22, 상세 보완 2026-11-06.
- 기준: 승인 설계 r8·계획 r7 FN10/UI04, INTERFACES §13.2/§15.3, contracts/methodologies.ts. 작성 기준 commit 21bceb7744fb03bbd9c174b85888b12bd4633d8c.
- 목적: Anvil이 소유한 절차에서 사람의 판단과 이유를 도구와 독립된 불변 자료로 남긴다. 사람 판단은 Agent 완료·검수 합격·실행 허가를 대신하지 않는다.
- 이력: r1 SHA256 4DC5269C1D3A77073AF07DD19E15B736A6D60638C58DDFEBB70173530668807B. 신산님 최신 지시는 활성화와 분리된 확정 문서 묶음의 명시 선택 및 source-only 계속 진행이다. §1~8의 사람 기록/정정/철회/보호조회 후보를 보존하고 §9~15에서 방향을 상세화한다. 새 명령명·정책·저장/계상 배치·수치가 직접 지시로 정해졌다고 보지 않는다. 이 파일만 보완하며 제품/SQL/시험 쓰기는 상세 패킷 검토와 별도 구현 GO 전까지0이다.

## 1. 기존 범위와 정확한 delta

기존 graph는 node kind HUMAN/AGENT/DECISION/JOIN, role USER/COORDINATOR/STAGE_OWNER, 조건 field USER_DECISION/REVIEW_OUTCOME을 선언한다. 현재 USER_DECISION 비교값은 string/IN string[]다. INTERFACES는 주체·기준·이유·typed decision 저장 뒤 평가하도록 요구하지만 저장 명령·작성권·불변 원장·현재 선택/소비 결박은 없다.

최소안은 **kind HUMAN 또는 DECISION이고 role USER인 현재 적용 노드**만 다룬다. AGENT/JOIN/COORDINATOR/STAGE_OWNER 판단은 지원하지 않는다. 현재 서버 인증으로 HUMAN을 확인하며 클라이언트 sourceKind/userId 선언을 신뢰하지 않는다. HUMAN 인증은 실제 사람이 화면을 조작했다는 물리적 증명이 아니며 탈취 세션/Agent의 사용자 세션 대리 조작을 자동 탐지한다고 주장하지 않는다.

이번 새 delta는 (1) 명령 recordNodeDecision/revokeNodeDecision, (2) 프로젝트·적용본·노드별 결정 head/불변 버전, (3) 별도 쓰기/회수/보호 조회 정책과 현재 제어 검사, (4) 정확 기준 및 선택 상태 CAS다. 향후 평가 소비 원장은 이번 채택/구현에서 제외한다. 기존 result review ACCEPTED 금지·실행 scope 412·FN14 A 미채택·DD166F 원거절은 변경하지 않는다.

대안: 모든 노드/총괄 판정을 한꺼번에 연결하면 실제 Agent 인증·출처/완료 verifier까지 필요하다. 고정 APPROVE/REJECT enum을 새로 부여하면 사용자 방법론의 값과 충돌한다. 따라서 **현재 graph의 명시 조건에서만 유한 문자열 값을 도출하는 한정안**을 권장한다.

## 2. 값 선언과 고정 범위

- nodeRef는 {applicationRef:{id,version,contentHash},nodeId} 전체 참조다. source definition ref가 아니라 현재 적용 snapshot ref를 쓴다. projectId는 외부 경로와 인증 범위에서 결정한다.
- decisionType은 ENUM_STRING_V1이다. 대상 노드에서 나가는 BRANCH edge의 제한 조건식 중 fieldRef={nodeId:대상,field:USER_DECISION}인 EQ/NE의 string 값과 IN의 string[] 원소를 수집한다. all/any/not 내부도 같은 제한 AST 순회만 허용한다.
- 공백만인 값·제어 문자·위장 prototype key·유효하지 않은 Unicode·비밀 표식은 거절한다. 각 값 1~200 UTF-8 bytes, 중복 제거 후 1~32개, 코드포인트 순 정렬로 고정한다. 입력값을 trim/casefold해 다른 값으로 바꾸지 않는다. 허용값 집합과 대상 edge/조건 전체는 서버 canonical hash로 결박한다.
- 유효 graph에서 IS_PRESENT만 있거나 해당 노드의 유한 값 목록을 도출할 수 없으면 412 NODE_DECISION_DECLARATION_UNSUPPORTED다. 숫자/bool 등 기존 graph schema를 위반한 조건은 원 validator 기준의 422 INPUT_INVALID를 유지한다. 기록 입력이 선언된 허용값/노드와 맞지 않아도 422 INPUT_INVALID다. 문자열 코드를 eval하지 않는다. 새 graph schema·새 내장 enum·기존 validator 완화0.
- 이 제한은 기존 graph 전체를 무효로 만들지 않는다. 해당 결정 저장/평가만 미지원으로 표시하고 다른 기능은 유지한다.

## 3. 정확 기준·입력·출처

record payload 후보:
{nodeRef,declarationHash,basisRef,decisionBaseRef,value,reason,sourceDocumentRefs}
- basisRef는 §9의 별도 명시 선택된 확정 설계/작업계획/방법론 적용 묶음의 서버 발급 전체 ref 제안이다. §9가 r1의 caller basisRef를 명시 basisSelection으로 보정하며 기존 record/revoke의 같은 Tx에서 발급·보관한다. 전역 current basis pointer나 별도 선택 명령/API를 만들지 않는다. 신규 저장은 §10의 선택 refs 현재 보호 재조회를 요구하고 역사 응답은 §12로 분리한다. 원문에 없는 만료시각은 만들지 않는다. 현재 묶음 producer는 미구현이며 가짜 current나 항상412를 정상 구현으로 세지 않는다.
- sourceDocumentRefs는 1~20개 기존 문서 불변 VersionRef다. 현재 프로젝트 귀속·본문 hash·보호 조회 가능/비격리·확정 및 최신 적합 검토를 서버에서 검사한다. 근거 누락/자료 계약 미연결은 412이며 임의 path/URL·원문 다운로드 endpoint 신규 추가0이다.
- reason은 유효 Unicode 1~20000자, 공백만/알려진 비밀 표식 거절. 근거 문서를 연결했다는 사실은 의미적 판단·실제 시험 PASS 증명이 아니다. 원문은 복제하지 않고 ref만 저장한다.
- 최초 decisionBaseRef=null과 expectedVersion=0, 후속은 현재 head 전체 ref와 정확 version을 요구한다. 외피는 기존 project command의 commandId/clientId/controlGeneration·targetId/expectedVersion·유한 기한·payloadHash를 따른다. 최초 targetId=null, 후속 targetId=decisionBaseRef.id.
- 서버가 생성할 snapshot은 projectId/nodeRef/declarationHash/basisRef/decisionType/value/reason/sourceDocumentRefs/previousRef/status/actor/commandId/recordedAt이다. actor는 현재 HUMAN user/client/controlGeneration·실제 감사 sequence에 결박한다. id는 해당 project/application/node 스트림의 고정 ID, version은 1부터 단조 증가하고 contentHash는 공통 canonical codec으로 계산한다.

## 4. 누가 기록·정정·철회·조회하는가

| 동작 | 최소 후보 권한과 제약 |
|---|---|
| 기록/정정 | 현재 활성 HUMAN OWNER·현재 로그인/client/단독 제어 세대·정확 project, 별도 recordNodeDecision 명시 AUTO 정책과 DENY 우선. 정책 부재/만료는 거절. REQUIRE_APPROVAL/approvalRef는 NODE_DECISION_APPROVAL_NOT_CONNECTED 412로 닫음 |
| 철회 | 같은 현재 HUMAN OWNER 조건과 별도 revokeNodeDecision 명시 AUTO 정책. 본인 과거 결정만이 아니라 현재 프로젝트 OWNER가 exact head를 철회할 수 있으며 원작성자와 철회자/이유를 모두 보존. 권한 인수만으로 과거 결정을 자동 변경하지 않음 |
| 원문/이력 조회 | 현재 HUMAN OWNER·별도 readNodeDecisions 명시 허용·현재 프로젝트 회원 검사. 쓰기 정책은 조회 허가가 아님. 첫 후보는 OWNER 조회만 지원하며 VIEWER는 메타데이터/존재 집계도 반환하지 않고 403으로 거절한다. VIEWER 집계 공개는 별도 정책/응답 계약 채택 전 미지원이다 |
| 세대/권한 회수 후 | 과거 작성자라도 현재 회원/조회 권한 없으면 404/403으로 차단. 신규 저장 응답과 POST exact replay에도 현재 readNodeDecisions 정책·응답에 포함될 모든 출처의 현재 접근/격리 검사를 적용한다. OWNER/write 정책만으로 과거 receipt/snapshot을 노출하지 않음 |

타 프로젝트/자료 귀속은 존재를 드러내지 않는 404, 현재 접근 상실은 403, 옛 제어·version/적용본/기준/head는 409로 거절한다. 보관 자료의 권한 회수는 원장 삭제가 아니라 현재 조회 차단이다. 실제 사용자 정책 자동 부여0.

## 5. 원자성·동시성·정정·철회

- project 단독 제어 잠금→현재 인증/HUMAN OWNER·client/제어 세대·해당 연산의 현재 쓰기 정책 및 별도 readNodeDecisions 정책 검사→기존 commandId/hash의 내부 exact 대조 순서다. replay이면 **원 영수증/snapshot에 반환할 모든 sourceDocumentRefs의 현재 보호 조회·격리 상태**를 같은 GET 기준으로 다시 검사한 뒤에만 원 영수증을 반환한다. 현재 head/basis/app 변경 때문에 신규 CAS를 다시 요구하지는 않는다. 쓰기권이 남아도 읽기권/출처 접근이 회수됐으면 반환하지 않는다.
- **신규 command에만** 현재 적용/기준과 결정 스트림·출처/검토의 관련 잠금을 정해진 공통 순서로 잡고, 정확 기준/출처의 현재 보호 조회·확정/최신 적합 검토·참조/head CAS를 최종 재검사한다. 이 재검사는 source 격리/조회권 회수·검토 개정·기준 전환의 실제 변경 경로와 공통 잠금/세대 검사로 직렬화해야 한다. 해당 현재 reader/관련 변경 경로와의 직렬화가 미연결이면 412 DECISION_PROTECTION_NOT_CONNECTED이며 stale snapshot으로 대체하지 않는다. 검사 후 공통 command/receipt/audit와 새 불변 version/head를 같은 transaction에서 COMMIT한다. 정책/제어/적용 전환도 같은 project 잠금과 current version 검사를 소비해야 한다.
- 신규 응답/POST replay/GET 모두 같은 보호 검사를 응답 직전까지 적용한다. 현재 readNodeDecisions 또는 출처 접근 거절/격리이면 403 DECISION_READ_UNAVAILABLE, 검사 공급자/직렬화 미연결이면 412 DECISION_PROTECTION_NOT_CONNECTED만 반환한다. 오류에는 기존 receipt 존재/성공 여부·ref/hash·value/reason/sourceRefs/snapshot을 넣지 않고 임의 마스킹 영수증으로 바꾸지도 않는다. 이미 저장된 원 receipt/자료는 불변 보존하며 오류를 미저장/실패 확정으로 해석하지 않는다. UNKNOWN 클라이언트는 원명령을 유지하며 새 명령 자동 재발급0이다. COMMIT 후 응답 전 보호가 변경되었어도 성공 원문을 노출하지 않는다.
- 최초 기록 ACTIVE v1, 정정은 새 ACTIVE vN+1, 철회는 REVOKED vN+1이다. revoke payload는 {decisionRef,basisRef,reason}; 현재 head/기준 exact를 요구하고 이전 값/근거 원문은 불변 이력에 남긴다. REVOKED를 다시 ACTIVE로 만들려면 새 별도 record 명령·현재 기준/출처·정확 revoked head가 필요하다. delete/update 과거 원문0.
- 같은 command/hash의 최종 재확인은 원 영수증만 반환하며 새 version/감사/소비를 만들지 않는다. 다른 payload 재사용409, 다른 동시 명령의 같은 head 수정은 하나만 성공·나머지409. 성공 시각/결정 의미가 같아도 별도 command를 자동 병합하지 않는다.
- timeout/단절 UNKNOWN은 본인/client/project 메모리에 원명령/정확 payload를 보존하고 같은 ID로만 재확인한다. 새 명령으로 자동 대체·자동 철회0. 세션/제어/권한 변경 후 replay 거절을 성공/실패 추측으로 바꾸지 않는다.
- 불변 version/head/명령/영수증/감사의 양방향 deferred COMMIT guard와 직접 DML 거절을 요구한다. fakeDB/구문 검사는 실제 PG COMMIT/경합 증명이 아니다.

## 6. 향후 평가 소비와 분기의 경계 — 이번 채택·구현 범위 밖

이 절은 후속 공급자 연결의 금지선/요구사항이며 이번 저장 후보 채택에 평가 API·소비 원장·node 완료·전이·queue 변경의 코드/SQL 구현 권한은 포함되지 않는다. 이번 구현 후보는 결정 저장/정정/철회/보호조회 및 해당 receipt/audit만이다.

- 저장/조회 응답에는 humanDecisionRecorded 여부만 표시하고 completionAccepted/runtimeStateVerified/automaticTransitionPerformed/executionAuthorized/dispatchPerformed=false를 고정한다. 결과 검수/Agent 완료/노드 완료를 생성하지 않는다.
- 현재 FN10 evaluateNext의 실제 runtime·완료·기준 공급자는 미연결이다. 따라서 **첫 저장 후보 구현에서도 평가 소비·node completion·branch 전이·queue 변경·dispatch는 412 DECISION_EVALUATION_NOT_CONNECTED**다. 순수 계산/안내에 hash를 넣는 것을 소비 증명으로 세지 않는다.
- 향후 소비는 단일 transaction에서 현재 project/적용 fullref·node/declarationHash·확정 basisRef·ACTIVE head/version·권한 및 현재 실행/선행/평가 대상 fullref를 다시 검사한다. 권한/기준/선행을 확인할 provider가 없으면412이며 과거 ref로 대체하지 않는다.
- 평가 기록은 evaluationRef·사용 decisionRef·basisRef·applicationRef·조건식 hash·각 분기 MATCH/NO_MATCH/UNKNOWN·실제 선택 edgeRefs를 불변 결박한다. 선언 값이 여러 분기를 만족하거나 어떤 분기도 없으면 AMBIGUOUS/NO_MATCH로 판단 대기한다. 미확인 field를 false로 바꿔 not/NE가 통과하지 않도록 UNKNOWN은 논리 AST 전체에 전파한다.
- 평가에서 채택된 결정 소비는 해당 head에 immutable consumption ref를 만들고 같은 evaluation replay만 같은 결과를 반환한다. 다른 evaluation의 재소비409. 소비 후 정정/철회는 409 DECISION_ALREADY_CONSUMED이며 새 영향 검토·명시 재평가 계약 전 우회0. 따라서 소비 뒤 뒤늦은 정정으로 진행 이력을 소급 변경하지 않는다.
- 소비 잠금과 기록/철회 잠금은 동일 스트림에 묶어 경합을 직렬화한다. read snapshot만 만들었으면 소비가 아니다. 과거 평가 조회는 역사 표식이며 현재 유효 결정/실행 허가로 재사용하지 않는다.
- 총괄 Agent 판단은 별도 인증된 실제 source/임무/typed 제출 계약 전412 COORDINATOR_DECISION_NOT_CONNECTED다. 기존 synthetic observations/REWORK·BLOCKED 검수를 대신 읽어 결정으로 승격하지 않는다.

## 7. 화면·조회 후보와 검수 인수점

- UI04 현재 적용 HUMAN/USER 또는 DECISION/USER 단계 상세에서 값 목록·기준/근거 문서·이유·현재 head를 표시한다. ‘결정 기록 준비’와 ‘명시 저장’을 분리하고 저장/조회/정정/철회 이력을 보여준다. 자동 실행/완료 버튼으로 표기하지 않는다.
- 아직 새 HTTP endpoint/command를 등록하지 않는다. 후속 채택안은 기존 project commands의 위2연산 및 보호 GET node-decisions(정확 application/node·최대50·서명cursor), exact version 조회로 제한한다. URL/query의 값/reason/Secret0, same-origin/no-store·주체/선택 변경 때 앞 원문 숨김·늦은 응답 폐기.
- 현재 적용 전환은 이전 이력을 남기되 현재 선택/수정 대상으로 사용하지 않는다. historical 조회는 원 app/node를 명시하고 현재 읽기권한·출처 보호를 다시 검사한다. 조회 불가 출처 본문/ref는 노출하지 않으며 역사 결정 value/reason도 OWNER 원문 정책이 없으면 반환하지 않는다.

| 검수 묶음 | 필수 사례 / 실제 증거 경계 |
|---|---|
| 순수 선언 검사 | HUMAN/DECISION USER만, EQ/NE/IN/all/any/not·IS_PRESENT-only412, 유한 문자열/중복/32개/Unicode·다른 노드/코드실행 차단 |
| 현재 공급자/권한 | 누락 기준reader412·현재app/hash/기준/head CAS·HUMAN OWNER 외 거절·정책없음/만료/DENY·VIEWER 원문0·회수 후 replay/조회 노출0 |
| 영수증/저장 | record v1→정정v2→철회v3→별도v4, same command 재확인/다른payload409·UNKNOWN 같은ID, receipt/audit/원장 누락COMMIT rollback·직접DML 거절 |
| 동시성/향후 소비 분리 | 이번 후보: 같은 head 두명령 1승/1충돌·보호 회수 대 응답 직렬화. 후속 별도 채택 시만: 소비 대 철회 직렬화·소비 후수정409, 옛적용/기준/결정 재소비 차단·UNKNOWN/복수분기 대기 |
| 화면 | 값/이유·기준 준비→별도저장/재조회, 권한상실/전환/늦은응답·UNKNOWN 보존, false flags, 자동완료/Agent0 |
| 실제 경계 | 코드/forward SQL 파일·합성검증 채택과 실제 신규PG·정식DB 적용/사용자 정책·served/Agent/비용 승인은 별개. 실제검사 미수행은 미검증 |

## 8. 채택 요청과 남은 선행

권장 채택은 위 **사람 전용 저장/보호조회·정정/철회/receipt·audit 계약**, 제한 ENUM_STRING 선언뿐이다. §6의 향후 평가/소비 원장·API·분기/전이·node 완료·queue 변경은 이번 코드/SQL 구현 채택에서 제외하고 공급자 미연결412를 유지한다. 새 명령2·읽기 계약·결정 불변 자료·현재 OWNER/별도정책 경계의 정확 delta만 판단받는다. 전체 FN10 또는 기존 계획 재승인을 요청하지 않는다.

채택되어도 현재 확정 기준 묶음 reader와 출처 보호/최신검토 reader를 실제로 연결·검수하기 전에는 저장 양성 구현이라고 주장하지 않는다. 구현은 순수 선언 검사→현재 기준/권한 adapter→transaction/미적용 forward SQL→명시 화면→한정 합성검수 순이다. 실제PG/정식정책·서비스/Agent/비용·운영 변경0, 독립 검토/후보 hash는 WORK_STATUS에 별도 기록한다.


## 9. r2 상세안 — 원 기록 transaction 안의 명시 선택

### 9.1 방향과 이력

신산님의 최신 결정은 **활성화와 분리해 확정 설계/계획의 정확 버전을 사람이 명시 선택하고 판단 근거에 고정**하는 것이다. 실제 Agent 실행·기준 활성화·node 완료·평가/분기/queue/dispatch를 허용한 것이 아니다. 원 r1 4DC5269C는 부모 이력이다. 작성 중 초안89EE3A81의 별도 선택 명령·전역 pointer 제안은 Main 보완 지시로 철회했으며 채택/제품 구현된 적이 없다.

이 상세안은 새 사전 발급 API 없이 기존 recordNodeDecision/revokeNodeDecision의 **원 authenticated transaction**에서 refs 검산→불변 basis 발급→decision version/원receipt/audit와 함께 저장하는 최소 접합이다. 선택 UI와 저장을 분리하되 UI가 값을 준비한 것만으로 서버 basisRef가 존재한다고 표시하지 않는다. 별도 select 명령·현재 basis 전역 head·새 기준 활성화는0이다. 아직 제품/SQL/시험 GO가 아니라 상세 패킷·허용경로를 검토할 문서1이며 새 수치/필수 정책을 임의 채택하지 않는다.

### 9.2 정확 refs와 공개 입력 delta 제안

basisSelection exact={applicationRef,designRef,planRef}.

| ref | 실제 원 목적·검산 |
|---|---|
| applicationRef | ProjectMethodologies.readApplication의 현재 적용 fullref. source definition ref를 전용하지 않음 |
| designRef | 같은 project의 확정 AF02 DOCUMENT VersionRef. ProjectDocuments.version의 id/version/contentHash·form/확정·최신 적합 검토·현재head를 검산 |
| planRef | ProjectWorkPlans.read가 반환한 원 작업계획 VersionRef. AF04 DOCUMENT ref와 다름 |
| planDocumentRef | 원 plan.documentRef로 서버가 도출하는 AF04 DOCUMENT ref. caller 입력 키 추가0 |

plan.designRef=선택 designRef의 exact 관계를 실제 reader로 대조한다. 기존 TaskCard에는 applicationRef/nodeId 필드가 없으므로 계획 업무와 방법론 노드가 이미 대응한다고 추정하지 않는다. applicationRef를 기준 묶음에 함께 고정하는 것은 이번 명시 문맥 연결 제안이며 task-node 자동 매핑·실행선행 충족을 만들지 않는다. nodeRef.applicationRef=basisSelection.applicationRef와 현재 적용을 검사한다.

r1 §3/§5의 요청 원형 중 basisRef 부분을 다음과 같이 **명시 변경하는 제안**이다. r1의 나머지 상태/CAS/권한/조회 조건은 보존한다.

- record payload exact={nodeRef,declarationHash,basisSelection,decisionBaseRef,value,reason,sourceDocumentRefs}.
- revoke payload exact={decisionRef,basisSelection,reason}. node/application은 실제 원 decision head에서 읽고 선택 application과 대조한다.
- caller가 아직 발급되지 않은 basisRef·basis hash·current=true를 선언하지 않는다. 신규 명령마다 실제 선택 refs를 검산하고 해당 불변 basis를 생성한다. 과거 decision의 basis를 현재 선택이라고 자동 채택하지 않는다.
- 기존 project command 외피의 commandId/clientId/controlGeneration/targetId/expectedVersion·payloadHash와 한정 호출 예산을 유지한다. record 최초 targetId=null/expectedVersion=0, 후속은 decisionBaseRef exact head, revoke는 decisionRef exact head다. approvalRef/REQUIRE_APPROVAL의 기존 NODE_DECISION_APPROVAL_NOT_CONNECTED 거절은 유지한다.

이 입력의 basisRef→basisSelection 변경과 response의 basis snapshot 추가는 새 공개/저장 상세 의미이므로 정확 delta로 검토받는다. 별도 명령/정책을 추가해야 정상인 것처럼 만들지 않으며 기존 후보 정책3개 recordNodeDecision/revokeNodeDecision/readNodeDecisions 외 자동 권한 부여0이다.

### 9.3 비순환 발급·동일 저장 제안

권장 basis snapshot exact:
{schemaVersion:1,purpose:'HUMAN_NODE_DECISION_BASIS',id,version:1,projectId,applicationRef,designRef,planRef,planDocumentRef,actor,commandId,recordedAt}.
actor={kind:'HUMAN',userId,clientId,credentialGeneration,controlGeneration}는 서버 authenticated actor/원 command에서 도출한다. server UUID/원 Tx 시각은 **신규 command당1회만** 만들고 replay에서는 재생산하지 않는다. basisRef={id,version:1,contentHash:H(canonicalJson(basisSnapshot))}이며 자기ref/hash를 snapshot에 넣지 않는다.

이후 decision snapshot의 basisRef에 그 ref를 넣어 decision hash를 계산한다. basis는 decisionRef를 거꾸로 포함하지 않아 순환hash가 없다. actor에 아직 미생산 audit sequence를 선언하지 않고 실제 audit row의 sequence·원command/operation/scope를 관계 검산한다. 원 id/version/hash·previousRef/status/actor/command/time은 §3/§5의 불변 조건을 따른다.

별도 basis pointer/표/API 없이, **각 node decision immutable version row에 basisSnapshot과 basisRef를 보호 보관**하는 배치를 권장한다. 물리 row의 basis id 유일성과 H(body)=basisRef.contentHash, decision.basisRef exact 관계를 검사한다. 원 receipt에는 같은 basis/decision snapshot과 ref가 실제로 복제될 수 있으므로 비용도 복제대로 센다. 이 보관열·원형 배치는 상세 채택 제안이며 이미 존재하는 SQL이라고 쓰지 않는다.

새 명령의 같은 refs/값이라도 다른 command면 별도 version/발급이다. 같은 원 command/hash replay는 저장된 basis/receipt만 반환하고 새 UUID/시각/version/charge0이다. 원 actor/client/command 바꾸기·다른 project/ref 해시·결과/관계 손상은 거절한다.

## 10. 실제 보호 producer·현재성·수명

하나의 실제 AccessRepository와 원 routes의 ProjectDocuments/ProjectWorkPlans/ProjectMethodologies를 같은 db/actor/project로 소비한다. caller 성공flag나 성공 메서드 override로 권한/current/확정을 대신하지 않는다.

| 실제 함수·경로 | 재사용할 원 검산 | 추가 FN10 결박 |
|---|---|---|
| methodologies/project-methodologies.ts readApplication | 원 application fullref·snapshot/source graph hash | 현재 적용과 선택 application/node의 동일Tx·전후 관측 |
| traceability/work-plans.ts read/decision | 원 planRef·designRef/documentRef·relational projection·확인원장·최신검토·currentConfirmationValid | 선택 plan/design exact와 현재head/confirmed·문서 접근 잠금 아래 재검산 |
| documents/project-documents.ts version | project/member·fullref/hash·UTF8·실ArtifactStore·격리 거절·확정/validation | AF02/AF04 목적, 현재 문서head/confirmed와 최신 적합 검토 확인 |
| documents/project-content-review.ts documentReviews | 원 감사 sequence 순서의 실제 검토 | 과거 ACCEPTED 하나가 아닌 원 target의 최신 적합 HUMAN 검토 |
| traceability/design-activation-stored-relations.ts | 설계/계획 exact ref 관계 중 가능한 순수 부분 | activation/change/impact의 실제 안전선행을 HUMAN 기록에 전용하지 않음 |
| access/project-command.ts | currentProjectController/authorizeMaterial/projectReplay/persistProjectReceipt | 새 source 전체 current/응답 보호·실제 비용은 별도 접합 |

ProjectBaselineActivations.current의 pointer는 쓰지 않으며 activate의 실제 안전선행 미연결을 기록 선행으로 만들지 않는다. 문서/계획의 최신 head·confirmed_version와 sourceDocumentRefs의 원 body/hash/접근·격리를 실제 reader/행으로 검사하고 유한 전후 재관측한다. 같은 fact/ref/hash만 재읽어 원 source 현재성을 대신하지 않는다. source 계약에 없는 정정/제외 flag를 만들지 않고 실제 원 버전·사건·격리/접근 상태를 소비한다.

**원 문서/계획에는 새 expiresAt/TTL을 만들지 않는다.** basis는 recordedAt의 불변 선택 증거이며 영구 현재 권위가 아니다. 각 신규 record/revoke에서는 명시 선택이 원 current/확정/검토 조건을 만족하는지 재조회한다. 호출 end는 원 호출 시작 예산과 실제 Session idle/absolute·해당 현재 policy/원 명시 유효기한의 min이며 await 뒤 늘리지 않는다. 없는 만료값은 창조하지 않고 더 짧은 실제 기한만 보존한다. 기존 공통 명령에 없는 새 재인증 필수0이다.

역사 GET/replay는 현재 read정책·원 source 접근/격리와 저장관계를 검사하지만 최신head/새app/새기준 때문에 fresh CAS를 소급하지 않는다. 과거 basis를 현재 판단·평가/실행 허가로 반환하지 않는다. 현재 source 접근 불가면 value/reason/sourceRefs/basis를 포함한 **응답 전체를 닫고** 원 저장은 불변 보존한다.

## 11. 동일 Tx 생산·공유 잠금표

새 logical stream은 decision=(project,application fullref,nodeId)의 head/불변version이며, basis는 해당 version의 불변 필드다. 별도 basis head0이다. 원 current/auth→선택 원자료 잠금/검산→비용 admission/필요동일Tx예약→basis발급→decision hash→원receipt/audit·version/head→실측정산→양방향 deferred 완결 순서로 연결한다. 원 AccessRepository authenticated의 같은 PoolClient를 쓰고 reserve 별도Tx를 중첩하지 않는다.

| 근거/변경 | 기존 실제 접점 | 필요한 최소 조정/미확인 |
|---|---|---|
| project/member/control | currentProjectController의 projectMember(...,true) FOR UPDATE OF p,m→project_control FOR UPDATE | 원 인증·OWNER·client/세대 유지. JOIN잠금을 개별project→member 순서 증거로 과장하지 않음 |
| policy | currentPolicy/authorizeMaterial·ProjectPolicyRepository version/head 저장 | 원 명령 정책과 별도 read정책 모두 검사. 변경writer의 동일project 직렬화 참여를 확인 |
| methodology application | readApplication의 최신 적용행·apply의 controller 뒤 INSERT | 현재application exact·부재 포함 같은project 경계에서 전후재검산 |
| work plan 확인/검토 | work-plans.ts #current FOR UPDATE OF w·readiness의 documents FOR SHARE | 선택plan head/confirmed·confirmation/최신review 검산. 기존 중첩 잠금순서와 충돌을 확인 |
| DOCUMENT 원문/확정/검토 | ProjectDocuments 저장/확정·writeDocumentReview FOR UPDATE OF d | 관련문서 id정렬 잠금·head/confirmed/최신review 재조회. 기존writer 참여 없이 새잠금만으로 완료 주장0 |
| artifact/출처 보호 | ProjectDocuments.#artifact의 실제 artifacts·격리 검사, project-files.ts 업로드 상태/receipt | 실제 UPDATE·격리/출처 회수 producer의 유한 목록·행/권한을 추가대조. 전체참여가 이미확인됐다고 하지 않음 |
| 새 decision head | 신규CAS/불변version·첫head 부재 | 같은stream 첫생성도 project경계에서 직렬화·같은head 두명령1승/1충돌 |
| 응답전 보호 | authenticated의 원COMMIT/release 뒤 반환 | §12의 같은원요청 최종 보호관측. 원Tx잠금을 반환후 계속 보유한 것으로 주장0 |

실제 구현 WI에서는 기존 producer별 획득순서·키·잠금모드·현재성 재검산을 한 **유한표**로 닫는다. 필요하면 해당 기존 생산자만 정확 허용경로에 추가하고 광범위 auth/문서 리팩터링0이다. 현재 조사에서 전 생산자 직렬화를 완결했다고 보지 않는다. source/비용/직렬화 미연결은 패킷 미완결로 보고하며 항상412를 정상 저장 구현으로 대체하지 않는다.

## 12. 저장 응답·GET·replay·UNKNOWN

- 명령은 기존 후보 record/revoke **2개 유지**다. UI의 basisSelection 준비는 메모리 입력이며 명시 저장1회에서 실제서버발급/보관까지 정착한다. 준비 중 발급된 것처럼 fake ref를 만들지 않는다.
- 후보 GET2(서명cursor 최대50의 application/node별 목록, exact version)를 유지하고 각 원 version의 basisRef/basisSnapshot을 함께 반환하는 상세확장이다. 별도 basis 발급/현재선택 GET0이다. 원문URL/query의 value/reason/Secret0, same-origin/no-store·주체/선택전환 숨김·늦은응답폐기를 유지한다.
- 신규 저장응답/POST exact replay/GET 모두 현재 readNodeDecisions와 포함된 design/AF04/sourceDocumentRefs의 원 접근/격리를 검사한다. WRITE AUTO만으로 원문을 읽거나 다른OWNER 원source에 자동권한을 부여하지 않는다. HUMAN OWNER만·DENY우선/REQUIRE412·실제정책자동부여0을 보존한다.
- 원 Tx 안에서 최종검산 후 COMMIT하고, **확정 COMMIT/release 뒤 응답 직전** 원 actor·request/command·결과/basis/source refs를 고정해 같은요청의 새authenticated 보호read 경계를 소비하는 최소접합을 제안한다. 원receipt가 이미있어도 source접근이회수됐으면 반환원문0이다. 이 후행관측의 실제 auth수명·query/actor/Tx 결박과 종료정리를 구현전닫는다.
- 마지막 유한 보호관측 이후 HTTP 마지막byte까지 동시회수를 원자적으로 막았다고 주장하지 않는다. 관측경계/보장한계를문서화하고 현재판정이불명이면 성공본문을 반환하지 않는다.
- COMMIT후 최종보호거절/timeout/단절은 원receipt/새version을 삭제·reset·자동철회하지 않는다. 클라이언트는 원명령/body/header/외피ID를 보존하고 새record/revoke를 자동발행하지 않는다. 명확한전송전거절, POST유실, POSTreceipt뒤GET실패를 구별하고 원ref로만 재조회한다.
- 역사replay는 현재인증·원operation접근/read/source보호를 유지하되 최신application/head/선택refs의fresh적격성을 소급요구하지 않는다. 원receipt/basis/decision/감사 관계손상을 빈결과로 숨기지 않는다.
- 결과 humanDecisionRecorded는 저장사실이다. completionAccepted/runtimeStateVerified/automaticTransitionPerformed/executionAuthorized/dispatchPerformed=false를 고정하고 평가·분기·node완료·queue·Agent를 만들지 않는다.

## 13. 원 bytes·예약·역완결의 필수 미정

이 절은 기존 저장량·project quota 계약에 새 결정 행의 실제 비용을 정확히 귀속하는 내부 접합이다. SDK/외부 호출 비용·새 유료 정책·임의 건수 cap·사용자 정책 자동 부여는 추가하지 않는다. 기존 10GiB 등 원 상한을 바꾸거나 원 계정 분모를 줄이지 않으며, 새 목적의 정확 projection/예약식 선택을 새 금전 승인으로 혼동하지 않는다.

새상한/건수/TTL수치를제안하지않는다. 기존quota가새목적을자동계상하지않으므로 원 account의 actual/held/별도소계와 FN10목적을 명시해야 한다. 비용projection은 decision version의 실제 snapshot/basisSnapshot/ref/관계열, 실제head 생성/변경, commands에복제된원result, authorization_receipts, audit_events, 필요reservation자기비용을 포함해야 한다. 원source body는복제하지않으므로 원문전체bytes를refmetadata와혼동해중복계상하지않는다. 알림추가0이다.

기존collector와행단위귀속을대조해canonical-pair/기존실제열비용식중하나를명시채택하고 새part_kind/key/id·projection/hash/coverage세대·유한선예약/정산/R자기고정점·같은PoolClient·양방향완결을정한다. 기존FN09목적으로위장하지않는다. replay신규bytes0·감사/비용/완결누락의전체rollback·COMMIT불명UNKNOWN을유지한다. 이정확비용계약은미정이며기존직접선택만으로채택됐다고하지않는다.

SQL원형은 원command/actor/receipt/audit와decision/basis hash관계를모두재검산하는BEFORE/deferred와직접DML거절을요구한다. caller GUC/boolean을완결권위로쓰지않는다. 실제PG/권한/trigger/경합/COMMIT검증은source/메모리형상과별도미실행이다.

## 14. 제안 파일·정상/중요 음성

아래는 **아직쓰기허용목록이아닌최소배치안**이다. 새명령·basis전역pointer·사전발급API가필요한파일은없다.

- 신규server4: apps/server/modules/scheduling/node-decision-input.ts, node-decision-sources.ts, node-decision-store.ts, project-node-decisions.ts. input은기존validateMethodologyGraph를재사용해제한ENUM추출/봉인만추가; sources는원실제클래스/같은access/db/actor와refs·원수명을검산; store는decision head/version+동일row불변basis·원관계; service는기록/철회/보호조회·최종반환을소유한다.
- 신규forward: db/migrations/0080_node_decisions.sql.pending. 현재최대0079·착수전중복재검산, 기존migration직접수정0이다.
- 기존접합: apps/server/modules/access/project-command.ts, apps/server/modules/control-handoff/control-grant.ts, apps/server/modules/projects/routes.ts, apps/server/modules/projects/project-storage-quota.ts.
- Web신규2: apps/web/src/features/session-detail/node-decision-api.ts, NodeDecisionPanel.tsx. 기존apps/web/src/App.tsx·apps/web/src/features/session-detail/SessionDetailPage.tsx·apps/web/src/features/connections/policy-editor-profile.ts를접합하고원buffer/CSRF/same-origin·UNKNOWN·원선택guard를재사용한다.
- 공유잠금생산자의추가경로는§11표를닫은뒤정확히고정한다. 현재기존reader의성공메서드override·private공개·권한완화는0이다.
- 시험제안: tests/unit/FN10/node-decision-input.test.ts, node-decision-sources.test.ts, node-decision-store.test.ts, node-decision-routes.test.ts, node-decision-schema.test.ts, tests/unit/UI04/node-decision-flow.test.ts. 새공유fixture가필수면쓰기전경로를제안한다.

| 검수단위 | 정상·필수중요음성 |
|---|---|
| 선언 | 원HUMAN/DECISION USER와EQ/NE/IN/all/any/not→값/봉인; IS_PRESENT-only/다른node/과다값/오염prototype/getter/잘못된Unicode거절 |
| 실제보호선택 | 실제문서·plan검토/확정·원methodology apply원행→UI명시refs→원record의같은Tx에서basis발급; 비확정/다른project/다른목적ref/최신검토불량/원body·hash손상·격리거절 |
| 실제기록여정 | record ACTIVEv1→정정v2→revoke REVOKEDv3→명시recordv4, 각version의basis/원작성자/현재OWNER·이력보존; 별도발급요청/활성화0 |
| 원자성/비용 | 같은Tx domain/command/receipt/audit·basis/비용대응; 원proof/실비누락·다른actor/Tx·상한초과·감사/역완결/COMMIT응답불명·직접DML거절·replaycharge0 |
| 잠금/응답 | 동일head두명령1승/1충돌; apply/plan-confirm/review/권한·격리전환과고정잠금/유한전후관측; 저장뒤최종보호거절은원receipt보존/전체본문0 |
| 메모리UI/transport | 확정설계/계획·원적용명시선택→값/근거/이유준비→원명령저장/고정조회/정정/철회; 전송전거절·POST유실·POSTreceipt후GET실패/UNKNOWN원ID구분·주체/선택ABA/late폐기 |
| 비권한 | 저장/선택이평가소비·branch/node완료/queue/dispatch·실Agent허가를만들지않음; 기존후보/기존methodology/문서/queue회귀유지 |

정상합성은실제보호클래스/원ArtifactStore를소비하고OS의실제fs import만격리메모리대역으로공급할수있다. 제품성공메서드override/원guard완화0이다. 실제사용자원문조회/전송·DB/권한/키/서비스/SDK/Agent·실artifactIO·설치/배포0이며메모리/형상PASS를실제PG/경합/운영인수로승격하지않는다.

## 15. 남은 최소 결정과 제출 경계

직접결정된별도명시선택방향은유지한다. 추가선택명령/전역basis pointer는제안하지않는다. 아직정확히닫을것은①basisSelection공개입력과동일versionrow의불변보관/응답원형②권한/원자료producer공유잠금·최종반환보호③새quota귀속/예약식과실제허용경로다. 이것들이미정인데정상공급을약속하거나전체FN10/계획을완료로표시하지않는다.

후보1의최종raw를동결해Main기록·독립검수뒤정확WI/TEST_ONLY·PRODUCT_GO를받는다. 본문서보완만으로제품/SQL/시험쓰기·실제환경이승인된것이아니다. 사용자의선택은“실행기준을활성화하지않아도, 내가명시선택한확정설계와계획을원판단과같은저장으로보관한다”는방향이며구현완료/실제Agent허가가아니다.
