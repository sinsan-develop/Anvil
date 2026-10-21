# FN10 사람 typed 결정 저장·평가 선행 계약 후보

- 상태: **PROPOSED / NOT_ADOPTED / 문서만**. 2026-10-22 Main 어울.
- 기준: 승인 설계 r8·계획 r7 FN10/UI04, INTERFACES §13.2/§15.3, contracts/methodologies.ts. 작성 기준 commit 21bceb7744fb03bbd9c174b85888b12bd4633d8c.
- 목적: Anvil이 소유한 절차에서 사람의 판단과 이유를 도구와 독립된 불변 자료로 남긴다. 사람 판단은 Agent 완료·검수 합격·실행 허가를 대신하지 않는다.
- PMO의 이번 요청은 후보 문서 작성·독립 검토다. 아래 새 명령/자료/권한은 제안이며 제품·SQL 구현 채택 또는 실제 DB 적용 승인이 아니다.

## 1. 기존 범위와 정확한 delta

기존 graph는 node kind HUMAN/AGENT/DECISION/JOIN, role USER/COORDINATOR/STAGE_OWNER, 조건 field USER_DECISION/REVIEW_OUTCOME을 선언한다. 현재 USER_DECISION 비교값은 string/IN string[]다. INTERFACES는 주체·기준·이유·typed decision 저장 뒤 평가하도록 요구하지만 저장 명령·작성권·불변 원장·현재 선택/소비 결박은 없다.

최소안은 **kind HUMAN 또는 DECISION이고 role USER인 현재 적용 노드**만 다룬다. AGENT/JOIN/COORDINATOR/STAGE_OWNER 판단은 지원하지 않는다. 현재 서버 인증으로 HUMAN을 확인하며 클라이언트 sourceKind/userId 선언을 신뢰하지 않는다. HUMAN 인증은 실제 사람이 화면을 조작했다는 물리적 증명이 아니며 탈취 세션/Agent의 사용자 세션 대리 조작을 자동 탐지한다고 주장하지 않는다.

이번 새 delta는 (1) 명령 recordNodeDecision/revokeNodeDecision, (2) 프로젝트·적용본·노드별 결정 head/불변 버전, (3) 별도 쓰기/회수/보호 조회 정책과 현재 제어 검사, (4) 정확 기준 및 선택 상태 CAS다. 향후 평가 소비 원장은 이번 채택/구현에서 제외한다. 기존 result review ACCEPTED 금지·실행 scope 412·FN14 A 미채택·DD166F 원거절은 변경하지 않는다.

대안: 모든 노드/총괄 판정을 한꺼번에 연결하면 실제 Agent 인증·출처/완료 verifier까지 필요하다. 고정 APPROVE/REJECT enum을 새로 부여하면 사용자 방법론의 값과 충돌한다. 따라서 **현재 graph의 명시 조건에서만 유한 문자열 값을 도출하는 한정안**을 권장한다.

## 2. 값 선언과 고정 범위

- nodeRef는 {applicationRef:{id,version,contentHash},nodeId} 전체 참조다. source definition ref가 아니라 현재 적용 snapshot ref를 쓴다. projectId는 외부 경로와 인증 범위에서 결정한다.
- decisionType은 ENUM_STRING_V1이다. 대상 노드에서 나가는 BRANCH edge의 제한 조건식 중 fieldRef={nodeId:대상,field:USER_DECISION}인 EQ/NE의 string 값과 IN의 string[] 원소를 수집한다. all/any/not 내부도 같은 제한 AST 순회만 허용한다.
- 공백만인 값·제어 문자·위장 prototype key·유효하지 않은 Unicode·비밀 표식은 거절한다. 각 값 1~200 UTF-8 bytes, 중복 제거 후 1~32개, 코드포인트 순 정렬로 고정한다. 입력값을 trim/casefold해 다른 값으로 바꾸지 않는다. 허용값 집합과 대상 edge/조건 전체는 서버 canonical hash로 결박한다.
- IS_PRESENT만 있거나 값 목록을 도출할 수 없는 노드, 숫자/bool·임의 문장·다른 노드 값은 412 NODE_DECISION_DECLARATION_UNSUPPORTED다. 문자열 코드를 eval하지 않는다. 새 graph schema·새 내장 enum·기존 validator 완화0.
- 이 제한은 기존 graph 전체를 무효로 만들지 않는다. 해당 결정 저장/평가만 미지원으로 표시하고 다른 기능은 유지한다.

## 3. 정확 기준·입력·출처

record payload 후보:
{nodeRef,declarationHash,basisRef,decisionBaseRef,value,reason,sourceDocumentRefs}
- basisRef는 같은 프로젝트의 현재 **확정 설계/확정 작업계획 기준 묶음**의 서버 발급 전체 ref다. 현재 기준 선택/무결성 reader가 없거나 기준이 비확정·정정/제외·만료이면 412 DECISION_CURRENT_BASIS_NOT_CONNECTED 또는 BASIS_NOT_USABLE이다. 클라이언트 hash만으로 현재 기준을 인증하지 않는다. 이 reader는 선행 구현/검토 대상이며 지금 존재한다고 가정하지 않는다.
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
