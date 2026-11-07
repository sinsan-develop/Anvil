# FN10 저장 판단의 조건 평가·소비 계약 후보

- 상태: DRAFT_DECISION_SUPPORT / SOURCE_GO0 / ACTUAL_EXECUTION0.
- 작성 기준: fc45abea98fedf12d4b56d7be1cbd43a67b4ac07. 제품·시험·SQL 변경을 허용하는 문서가 아니다.
- 부모: `FN10_HUMAN_DECISION_CANDIDATE.md` §6·§8. 해당 절은 후속 요구를 적었지만 평가·소비 구현은 채택에서 제외했다. 이 문서는 그 미정의 다음 선택안이며 기존 승인을 소급 확대하지 않는다.
- 실제 DB·SQL 적용/GRANT·권한·키·서비스·SDK/Agent·실사용자자료·외부 조회·새 실행 권위는 제외한다.
- 보완 이력: r1 20117B/CE5A36C5DDF9FB9E7AD8986CD878420DEF576008889AC4104109878A58D1FE94의 독립 C0/I1은 실제 실행·선행·평가대상 공급자 없이 정상 소비를 제시한 공백이다. 아래 r2는 이를 수정하며 원 부모 §6의 소비 선행을 유지한다. SOURCE_GO0은 그대로다.

## 1. 현재 열렸고 아직 열리지 않은 선행

설계 `docs/design/Anvil_설계서_v3_초안.md:225`는 구조화 결과/사람 판정으로 조건을 평가하고 근거를 저장하도록 한다. `docs/work_packages/FUNCTION_WORK.md:124–134`와 `docs/contracts/INTERFACES.md:947`의 FN10은 실제 단계 진행을 목표로 한다. 이것만으로 새 명령·저장·소비 정책이 확정되는 것은 아니다.

현재 `node-decision-input.ts`의 제한 ENUM 추출, `node-decision-sources.ts`의 실제 보호 원문/방법론/계획 검산, `node-decision-store.ts:19–33`의 불변 version·basis·원 receipt/audit/R 검산, `project-node-decisions.ts`의 현재 인증/정책·저장/조회가 있다. 원 manual decision/basis producer 부재는 해소됐다. ACTIVE/REVOKED와 headRef, 정확 application/node/declarationHash 및 선택된 확정 문서 묶음을 실제 저장으로 읽을 수 있다.

`next-actions.ts:18`의 `evaluateSyntheticNext`는 여전히 SYNTHETIC_ONLY이며 실제 제품 caller가 없다. 그 NodeState는 저장된 결정 snapshot과 다르고, accepted(current)는 COMPLETED/ACCEPTED/completionRef를 함께 요구한다. 새 결정 기록을 이 셋으로 변환하지 않는다. `project-next-action-basis.ts`와 기존 GET은 REWORK/BLOCKED 안내 두 가지뿐이다. FN12 `result-review-input.ts`는 ACCEPTED를 거절한다. 따라서 아래 기능은 사람 판단 조건의 평가 근거를 열지만 node 완료·실 scheduler·자동 전이·queue/dispatch·Agent 실행을 열지 않는다.

## 2. 권장 최소 기능과 사람의 결정 항목

최종 목표는 명시 선택한 USER 판단과 실제 현재 workflow의 실행·선행·평가대상 fullref를 함께 검산해 그 workflow에 조건 평가·소비를 결박하는 것이다. 조건이 유일하게 맞는 것만으로 소비하지 않는다. RECORD_ONLY는 실제 저장 원문으로 조건을 계산·보관하는 부분 기능이며 소비/전체 단계평가 진도가 아니다. 현재 §5.1의 실제 공급자가 없으므로 CONSUME_UNIQUE_MATCH는 412 DECISION_EVALUATION_NOT_CONNECTED이며 정상 소비 구현을 착수할 수 없다. 항상412인 소비 래퍼를 별도 성과로 만들지 않는다. 모든 공개 결과의 completionAccepted/runtimeStateVerified/automaticTransitionPerformed/executionAuthorized/dispatchPerformed는 false를 유지하며, 이것이 내부 필수 현재성 검사를 생략한다는 뜻은 아니다.

| 구분 | 권장안 | 채택 전 정확 차이 |
|---|---|---|
| 공개 연산/조회 | evaluateNodeDecision 명령1·정확 evaluation version GET1 | 기존 명령2/GET2를 변경하지 않고 별도 공개 의미를 추가하는 선택 |
| 쓰기 정책 | HUMAN OWNER·현재 제어 + evaluateNodeDecision 명시 정책 | 기존 recordNodeDecision 정책을 평가/소비 허가로 전용하지 않음 |
| 조회 정책 | readNodeDecisionEvaluations + 원 readNodeDecisions·출처 보호 | 새 정책을 자동 부여하지 않음 |
| 소비 후 수정 | 아래 A안을 권장 | 기존 §6의 제안에는 409가 있으나 §8이 소비 구현을 제외했으므로 이미 채택된 금지로 취급하지 않음 |
| 조건 의미 | §4의 기존 계산기와 같은 3값 논리 | UNKNOWN이라는 단어만으로 진리표 채택을 추정하지 않고 명시 결정 |

소비 후 정정/철회의 **A안**은 같은 decision version의 소비가 확정됐으면 새 record/revoke를 409 DECISION_ALREADY_CONSUMED로 막는다. 평가 기록만 한 경우에는 막지 않는다. 장점은 사용된 근거와 진행 기록의 소급 변경을 막는 것이며, 영향은 기존 정상 정정/철회에 새 거절 조건이 생기는 것이다. 재평가/영향 검토·소비 해제는 별도 후속 계약 전 제공하지 않는다.

**B안**은 결정 정정/철회를 계속 허용하고 과거 평가는 역사 자료로 보존하되 현재 사용 불가로 본다. 이는 후속 실행자가 사용 직전에 원 decision/head와 평가 유효성을 다시 검산해야 하고, 이미 진행된 동작의 무효화/중단을 보장하지 못한다. 이 단위에는 실행자가 없어 B안을 자동 전이의 안전 근거로 쓸 수 없다. 두 안 모두 과거 평가/결정 삭제0이며, 구현 WI 전에 하나를 고정해야 한다.

## 3. 제안 exact 입력·응답·조회

기존 ProjectCommand exact11을 유지한다. 새 issuedAt/expiresAt 키를 추가하지 않는다. 제안 operation은 evaluateNodeDecision, targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null이다. 일회 승인 연결은 이번 후보 밖이며 REQUIRE_APPROVAL이면 명확한 412를 반환하고 저장하지 않는다.

payload exact:

다음 payload는 RECORD_ONLY에 대해 구체화한 후보이며 **성공 소비의 완결된 exact 입력은 아니다**. 소비에는 §5.1의 실제 producer가 발급한 평가대상/실행/선행 fullref 결박이 추가로 필수다. 그 원형이 없는 현재 caller UUID·current boolean·synthetic NodeState를 추가해 공백을 메우지 않는다. 성공 소비의 공개/내부 입력 원형은 해당 producer 계약 뒤 고정해야 한다.

```text
{nodeRef:{applicationRef:VersionRef,nodeId:string},
 decisionRef:VersionRef,basisRef:VersionRef,declarationHash:SHA256,
 conditionSetHash:SHA256,purpose:"RECORD_ONLY"|"CONSUME_UNIQUE_MATCH",reason:string}
```

caller는 값·조건 AST·선택 edge·현재성 boolean을 보내지 않는다. 서버가 실제 decision/basis와 현재 적용 graph에서 도출한다. reason은 기존 결정 reason의 안전 문자열/원문 byte 계약을 재사용한다. 새 임의 건수/기간 cap은 만들지 않는다. 조건/edge의 원 순서는 graph 순서이며 conditionSetHash=H(canonicalJson({applicationRef,nodeId,edges:[{edgeId,toNodeId,kind,condition}]}))로 봉인한다. outgoing BRANCH만 포함하고 caller 임의 부분집합을 허용하지 않는다. edge의 VersionRef를 창조하지 않고 `{applicationRef,edgeId}`를 논리 연결 참조로 쓴다.

공통 APPLIED receipt의 data는 `{ref,snapshot,evaluationRecorded:true,decisionConsumed:boolean,completionAccepted:false,runtimeStateVerified:false,automaticTransitionPerformed:false,executionAuthorized:false,dispatchPerformed:false}`를 제안한다. 새 ref는 서버 발급 불변 evaluation version1의 ref다. commandId/operationId/serverReceivedAt 등 공통 외피는 기존 producer를 소비한다.

snapshot exact 후보:

```text
{schemaVersion:1,purpose:"HUMAN_NODE_DECISION_EVALUATION",projectId,
 nodeRef,decisionRef,basisRef,declarationHash,conditionSetHash,
 evaluationPurpose:"RECORD_ONLY"|"CONSUME_UNIQUE_MATCH",
 branchResults:[{edgeRef:{applicationRef,edgeId},conditionHash,
                 result:"MATCH"|"NO_MATCH"|"UNKNOWN",missingFields:[{nodeId,field}]}],
 outcome:"UNIQUE_MATCH"|"NO_MATCH"|"UNKNOWN"|"AMBIGUOUS",
 selectedEdgeRefs:[{applicationRef,edgeId}],consumedDecisionRef:VersionRef|null,
 actor:{kind:"HUMAN",userId,clientId,credentialGeneration,controlGeneration},
 commandId,reason,recordedAt}
```

conditionHash는 각 원 조건식의 canonical SHA다.

consumedDecisionRef는 실제 같은 Tx에서 소비 결박을 저장한 경우에만 원 decisionRef이며 나머지는 null이다.

GET 후보는 `/api/v1/projects/:projectId/node-decision-evaluations/:id/versions/:version`이며 query/body 없음, HUMAN cookie/host 검사·Bearer 거절·no-store를 기존 GET과 동일하게 적용한다. 목록 API는 정상 최초 기능에 필수는 아니므로 추가하지 않는다.

조회에는 snapshot/ref 외 `historyVerification:"STORED_EVALUATION_VERIFIED"`와 위 false flags를 반환한다. 과거 평가의 consumedDecisionRef는 역사 사실이며 현재 실행권위가 아니다. 현재 decision head가 달라도 과거 평가를 새 결과로 계산하지 않는다. 현재 읽기 권한과 원 출처 접근은 과거 GET/replay에도 적용하며 보호 거절이면 receipt/ref/value/reason을 섞은 부분 성공을 반환하지 않는다.

## 4. 실제 조건 평가와 선택 규칙

`contracts/methodologies.ts:6–9`의 EQ/NE/IN/IS_PRESENT/all/any/not만 사용하며 실제 validateMethodologyGraph를 먼저 소비한다. AST 실행·문자열 eval·임의 evaluator callback은 없다. 이번 입력에서 선택한 node의 USER_DECISION은 실제 ACTIVE 원 값으로 공급한다. 다른 node의 USER_DECISION과 REVIEW_OUTCOME은 현재 신뢰 공급자가 없으므로 missingFields와 UNKNOWN으로 남긴다. REWORK/BLOCKED나 synthetic observation을 ACCEPTED/총괄 판단으로 치환하지 않는다.

기존 계산기의 3값 논리를 권장한다. 값 누락의 EQ/NE/IN/IS_PRESENT는 UNKNOWN, not UNKNOWN은 UNKNOWN이다. all은 false가 하나라도 있으면 false, 나머지에 UNKNOWN이 있으면 UNKNOWN, 모두 true면 true다. any는 true가 하나라도 있으면 true, 나머지에 UNKNOWN이 있으면 UNKNOWN, 모두 false면 false다. ‘UNKNOWN 전파’를 무조건 모든 상위 AST UNKNOWN으로 해석하는 엄격 대안과 다르므로 이 진리표 자체도 채택 대상이다. false/true의 결정적인 원 항은 유지하되 누락값을 false로 채우지 않는다.

분기별 true/false/UNKNOWN을 각각 MATCH/NO_MATCH/UNKNOWN으로 기록한다. MATCH 둘 이상은 AMBIGUOUS, 그 외 UNKNOWN이 하나라도 있으면 UNKNOWN, MATCH 하나와 나머지 NO_MATCH만 있으면 UNIQUE_MATCH, 전부 NO_MATCH면 NO_MATCH다. selectedEdgeRefs는 UNIQUE_MATCH에서 정확 하나, 나머지는 빈 배열이다. 조건 없는 BRANCH/null·평가할 BRANCH 없음은 기존 제한 선언으로 정상 평가 대상이 아니므로 412로 명확히 거절한다. SEQUENCE/JOIN/REWORK·joinRule·retry 횟수를 새로 평가하지 않는다.

CONSUME_UNIQUE_MATCH는 우선 실제 workflow 선행 검산을 통과해야 하며, 공급자가 없으면 계산/예약/소비 전에412다. 그 선행이 구현·채택된 이후에도 UNIQUE_MATCH가 아니면 소비0·분기대기이며, 평가 기록 보관 여부는 해당 후속 입력/결과 계약에서 고정한다. UNKNOWN은 조건 데이터의 미확인이며 전송/COMMIT 결과 불명과 별개다. 동일 평가를 새 command로 자동 반복하지 않는다. 소비 목적과 RECORD_ONLY는 requestHash에 포함되므로 replay 중 목적 변경409다.

## 5. 실제 보호 source·잠금·같은 Tx 생산

| 순서 | 실제 기존 접점/제안 연결 | 실패/경합 경계 |
|---|---|---|
| 1 | AccessRepository.authenticated·원 Session/client/H·project/member 제어 잠금 | 정책 FOR SHARE 전에 project 경계 확보, 현재 OWNER/제어·명시 정책·원 call/Session/policy 최소기한 |
| 2 | 기존 projectReplay와 평가 저장 관계 대조 | 같은 command/hash만 원 결과. replay는 새 head CAS/평가/소비0, 대신 현재 읽기 보호 필수 |
| 3 | NodeDecisionStore.read/head·NodeDecisionSources.read(fresh=true) | 선택 decision/basis/declaration/app exact·ACTIVE 현재 head, 확정 문서/계획/적용본·최신 적합검토·출처 보호 |
| 3a | 실제 workflow producer의 현재 평가대상·원 실행/선행 fullref 보호 읽기 | 소비에 필수. 같은 project/app/node·원 임무/실행 세대·선행 관계·현재 상태·원 권한/최소기한을 전후 대조. 현재 실제 공급자 부재이므로 소비412, synthetic current로 대체0 |
| 4 | 원 graph의 조건 집합/선택 값으로 유한 계산 | client AST/값/선택결과 불신, callback·await 뒤 원 db/query/actor/Tx/current·최단기한 재검산 |
| 5 | 같은 결정 스트림 잠금 아래 평가/소비와 record/revoke 경쟁 | A안이면 소비 먼저 확정 시 수정409, 수정 먼저 확정 시 옛 head 평가409. RECORD_ONLY는 소비 제한을 만들지 않음 |
| 6 | private serverCommandId 먼저 고정→동일 PoolClient quota reserve→공통 receipt/audit+평가/선택적 소비 저장→settle | 원 ID provenance/단발·원 request/Tx 결박. domain/명령/R 누락은 deferred 완결 거절 |
| 7 | 원 callback→COMMIT tag→Pool release 확정 뒤 새 authenticated 보호조회 | 원 actor/client/Session 관계와 저장 원결과 재대조. 응답 직전 보호 상실이면 성공 원문0·원 저장 삭제0 |

현재 실제 보호 서비스의 private 메서드를 공개 성공 포트로 바꾸지 않는다. 필요한 같은 Tx 보호 읽기 코드는 기존 service 내부에 목적 한정 배치하거나 기존 실제 NodeDecisionSources/Store를 재사용한다. exact 클래스·prototype/own-data 함수 정체성·query 포트·alias 사본·원 actor/Tx를 검사한다. 기존 fs/import 메모리 모델로 보호 원문을 소비하며 성공 메서드 override를 하지 않는다.

### 5.1. 실제 소비를 막는 생산자 공백과 성공 재개 조건

| 필요 원자료 | 현재 실제 producer/consumer | 충족/공백 |
|---|---|---|
| 사람 판단·확정 문서 묶음·현재 적용/선언 | 새 NodeDecisionSources/Store 및 ProjectNodeDecisions | 원문/관계/현재 접근은 실제 저장으로 검산 가능. workflow 진행 상태를 발급하지 않음 |
| 현재 평가할 단계/run과 원 임무·실행의 결박 | `stage-queue.ts:25,39,69`는 WAITING/CANCELLED·assignmentRef=null | 실제 stage run→확정 임무→원 execution/current 평가대상 fullref producer가 없음. 새 결정의 nodeRef는 논리 graph 위치이며 현재 실행 참조가 아님 |
| 실제 실행과 원 process/소유권·관측 | `executions/execution-observations.ts:8,53–73`은 SYNTHETIC_ONLY/PROVIDER_CLAIM_ONLY | 저장된 주장/합성 current를 실제 runtime/소유권 확인으로 승격 불가. FN06/07 실제 생성/허가·process 공급과의 원 결박이 선행 |
| 선행 단계의 완료와 완료 근거 | `results/result-review-input.ts:5,13–17`은 REWORK/BLOCKED·ACCEPTED 거절 | 실제 증거에 따른 완료수락/fullref producer 부재. 사람 결정 저장을 완료로 치환하거나 선행을 모두 true로 선언할 수 없음 |
| 평가·소비 후 동일 workflow의 사용 검산 | `next-actions.ts`는 synthetic NodeState만 받으며 제품 caller 없음 | 현재 workflow와 소비를 연결할 실제 사용자가 없음. 새로운 독립 ‘결정 잠금’만 만들면 부모 의미를 축소함 |

실질 선행의 최소 기능은 **원 단계 요청→확정 임무/원 실행→현재 평가대상과 선행 근거의 보호 저장·조회 결박**이다. 이것은 새 reader 이름만 추가하는 일이 아니다. 원 생성 명령·receipt·허가·원 실행/관측에서 단계의 정체성과 변화를 생산하고, 현재 제어/권한/세대·단절/UNKNOWN·종료/취소를 같은 수명에서 확인해야 한다. 필요한 내부 자료는 원 project/application/node, 단계 요청/임무/실행의 실제 fullref, 원 실행 세대와 관측 근거, 평가대상 버전, 선행들의 정확 완료/미완료·출처 참조와 현재성이다. 이 목록은 **필수 의미**이며 현재 존재하는 exact DTO나 새 권위 발급으로 선언하지 않는다. 필드/상태·producer 소유권·저장/권한 변화가 새로 필요하면 별도 정확 계약으로 채택한다.

자동개발 제어의 기존 계획 순서상 먼저 Main이 FN06/07의 actual 생성·process/원허가 producer를 비교해 이 공백의 시작점을 선택하고, FN12의 실제 증거 기반 완료 공급과 연결해야 한다. 이 문서로 실제 생성/권한/SDK 실행을 허용하지 않는다. 한 source-only 시험에서 실제 제품 producer와 원 보호 reader를 메모리 저장 모델로 소비할 수 있더라도, synthetic current 성공 포트만 주입한 시험은 성공 소비 선행 충족 증거가 아니다. 실제 runtime이 아직 없는 범위를 소스 검산/미검증으로 명시하며 실제 권위가 생겼다고 하지 않는다.

성공 소비 재개는 ①현재 평가대상이 원 요청/임무/실행에서 실제 생산됨 ②필요 선행과 현재 권한/실행 상태의 보호 fullref를 실제 producer/reader로 검산함 ③그 원형·기한·UNKNOWN/단절·소비와 수정 경합 계약이 채택됨 ④소비 명령이 그 원 refs를 requestHash/불변 평가/consumption에 결박함 ⑤원 producer→평가→실제 workflow의 사용 전 재검산까지 정상과 stale/철회/취소 음성을 닫음의 조건이다. 이들 없이는 같은 decision을 다른 workflow와 무관하게 잠그는 성공 경로를 제공하지 않는다.

소비 저장은 평가 row의 nullable 소비 관계/유일 인덱스 등으로 표현할 수 있다. 별도 일반 consumption 표가 필수라고 단정하지 않는다. 불변 평가 원문과 소비 fact, 기존 head/원 명령/receipt/audit/R의 양방향 완결을 표현하고 동일 decisionRef의 소비 유일성을 DB가 검산할 수 있는 최소 배치를 WI에서 고정한다. 기존 과거 decision/basis snapshot·hash를 재작성하지 않는다. A안의 기존 record/revoke 소비 검사 추가는 명시 정책 변화의 구현이며 조용히 삽입하지 않는다.

## 6. replay·오류·단절의 결과표

| 상황 | 반환/보존 |
|---|---|
| 동일 command/hash 확정 결과 | 현재 read/출처 보호 뒤 원 receipt와 evaluationRef. 새 평가·소비·비용0 |
| 같은 command 다른 입력/소비목적 | 409, 원 불변 결과 유지 |
| 옛 decision/head/app/basis/조건 봉인 | 신규 평가409, 새 원문을 자동 선택하지 않음 |
| 읽기/쓰기 정책 거절·격리/권한 회수 | 기존 비노출 403/404 의미 유지, 부분 snapshot0 |
| 실제 보호/필수 현재성 공급자 미연결 | 412, 가짜 정상값·항상412 구현으로 정상 경로를 대체하지 않음 |
| 평가값 UNKNOWN/NO_MATCH/AMBIGUOUS | 정상 불변 평가/대기, 소비0·전이0 |
| 소비 유일성 충돌 | 다른 평가 재소비409; 같은 command replay만 원 결과 |
| COMMIT/Pool 반환·HTTP 응답 유실 | 외부 결과 불명으로 원 command/body/ID 보존·자동 재명령0. 실제 미저장/rollback 성공을 단언하지 않음 |
| 확정 receipt 뒤 보호 GET 거절 | 원 receipt 먼저 보존하되 원문 숨김·동일 ref 재조회만, POST 추가0 |
| actor/client/control/app/node/transport 전환·늦은 응답 | 이전 본문/선택 edge 숨김·원 명령을 다른 문맥에 재귀속0 |

구체 오류 literal·status는 위 의미를 기존 AuthFailure/명령 오류와 대조해 WI에서 고정한다. 신규 공개 오류 계약도 채택 대상으로 남기며 이 문서가 실제 응답 producer를 만들지는 않는다.

## 7. 저장량·예약 분모와 기술 선택

기존 project-storage-quota 및 FN09/FN10 동일 Tx 예약/정산 구조를 재사용한다. 현재 10GiB cap·account coverage/세대·기존 U/H/O 의미와 기존 공개 quota RPC allowlist를 보존한다. 새 외부 호출 비용·유료정책·임의 건수 cap·TTL은 없다.

새 연산의 actual A는 불변 evaluation row의 실제 저장 열/JSON·선택적 소비 관계의 실제 행·원 command(C)/authorization receipt(Au)/audit(Ua)·자기 reservation(R)을 한 번씩 포함한다. 원 decision/basis/source 본문은 ref만 저장하므로 중복 계상하지 않는다. 기존 decision head를 그대로 두는 배치면 head 비용 차분0이며 소비 pointer를 추가하는 배치를 택하면 정확 전후 head 차분을 actual과 projection에 포함한다. 독립 소비행과 pointer를 동시에 중복 계상하지 않는다.

canonical-pair 원장 방식으로 projection 비용 P와 reservation 자기비용 costR(r)을 도출하고 최소 유한 고정점 r >= P + costR(r)을 같은 원 command/plan/coverageGeneration에 봉인한다. 기존 U+H와 별도 O를 혼동하지 않고 admission은 원 잠금 아래 U+H+O+r <= 10GiB를 검산한다. 기존 collector가 새 actual을 포함하게 만드는 forward dispatcher/역완결과 전용 RPC만 추가하고 범용 quota_current/reserve/start로 내부 목적을 열지 않는다. SETTLED/held가 기존 무필터 집계에 이미 들어가면 새 subtotal을 또 더하지 않는다.

reserve ID는 원 serverCommandId와 같게 선고정하고 persistProjectReceipt가 그 ID를 같은 Tx에서 단발 소비한다. planHash는 planHash만 제외한 전체 plan의 canonical hash여서 coverageGeneration/actor/원 request/평가 projection을 포함한다. settle은 실제 평가/소비 원행과 원 결과를 다시 읽어 A <= r 및 정확 Tx/ID/관계·현재성/기한을 검산한 뒤 actual로 정산한다. 거절은 같은 Tx 전체 원자성, 확정 replay는 신규 R/charge0이다. 정확 operation/part_kind literal·projection allowlist와 SQL 번호는 기존 최신 migration 목록/원 cost 모델을 대조해 별도 WI에 고정할 내부 기술 선택이다. 새 cap/유료 승인의 사용자 선택으로 되묻지 않는다.

## 8. 화면과 검수·최소 영향

UI04 같은 USER 단계에서 저장된 ACTIVE 결정과 현재 보호된 선택 문서 묶음을 보여준 뒤 ‘조건 평가 준비’와 ‘평가 기록’을 명시 선택한다. 소비는 A/B안 결정과 목적에 맞춰 별도로 명시하며 ‘실행/완료’로 표기하지 않는다. 유일 분기·불명·복수·무선택을 구분하고 아직 허가되지 않은 다음 단계는 버튼으로 자동 시작하지 않는다. 새 GET이 성공하기 전 cached 본문·선택 edge를 노출하지 않으며 같은 stream head 근거와 원문 표시 권한을 분리한다. 브라우저의 조건 preview는 서버 원평가 결과를 대체하지 않는다.

부분 검증은 실제 record producer v1→실제 보호 source→원 AST 계산→RECORD_ONLY 불변 저장/GET 및 명시 UI04 왕복이다. 이것만으로 평가 소비나 자동개발 제어 목표를 완료하지 않는다. 성공 소비의 필수 정상은 **실제 workflow 생성/관측·선행/평가대상 producer→그 원 refs를 같은 Tx에서 보호 검산→원 판단/조건과 결박→UNIQUE_MATCH 소비→동일 evaluation의 실제 workflow 사용 전 재검산/replay**다. 현재는 앞 producer 공백으로 이 정상 종단을 제시할 수 없다. 소비 미연결412 음성만 통과하는 래퍼, 임의 current/runtime 성공값, 독립 결정 잠금으로 정상 소비를 대신하지 않는다.

중요 음성은 EQ/NE/IN/IS_PRESENT·중첩 all/any/not·UNKNOWN 진리표, 다른 node/REVIEW_OUTCOME 미연결, 복수/무선택, caller 값/AST/edge 주입, 원 decision/basis/app/조건 hash 변조·옛 head·REVOKED, 보호 회수/격리/만료·callback alias/포트 교체·시간 역행, 소비 대 수정/철회 직렬화·다른 평가 중복 소비, 원 Tx/ID/plan 세대/actual/역완결 누락, COMMIT 불명·후행 auth0·자동 명령0·늦은 자원 회수, UI receipt 선보존/후행 GET403/주체·선택 전환이다. 실제 PG 잠금·trigger/RLS/ACL/COMMIT와 브라우저/served 검증은 메모리 SQL·DOM·정적 형상 PASS와 분리한다.

최소 영향 후보는 scheduling의 평가 입력/계산·store/service(기존 적합 함수 재사용), 기존 node-decision service의 공통 잠금/소비 검산, project-command의 목적 ID, project-storage-quota의 동일 Tx 목적, projects/routes의 명령1/GET1, UI04의 API/Panel/App buffer와 정책 편집 목록, forward pending migration 및 해당 입력/source/service/schema/quota/route/UI 시험이다. 파일 분리 수는 구현 선택이며 새 API/표가 무조건 필요한 것으로 분류하지 않는다. 위 공개 의미를 택하지 않고 내부 함수만 조립하는 대안은 가능한 source 부분 작업이지만 사용자 평가 저장/소비 기능 완료로 세지 않는다.

## 9. 결정문과 이후 선행

현재 권장 다음 행동은 ‘FN06/07 actual 생성/원허가·process 공급과 원 단계/임무/실행/선행·평가대상 producer 중 실제 시작 가능한 선행을 먼저 고정한다’이다. RECORD_ONLY는 별도 선택 가능한 부분 기능일 뿐 전체 목표를 대신하는 우선 구현으로 권장하지 않는다. 이후 소비 계약의 결정문에는 ‘실제 workflow와 원 실행/선행/평가대상 fullref의 보호 검산을 통과한 유일 분기에만 결정 version을 단발 소비 결박한다. 공급자가 없으면412이며 synthetic current와 무관한 결정 잠금으로 대체하지 않는다’가 필수다. A/B안·§4 진리표·새 명령/조회/정책·원 fullref 입력의 정확 채택은 그 선행 뒤 다시 고정해야 한다.

신산님이 아직 이 문구를 채택한 것으로 기록하지 않는다. B안이면 수정 후 기존 평가의 사용 불가/재검산 의미부터 별도 고정해야 한다. 내부 파일 배치·같은 Tx ID/예약 구현·미적용 SQL 번호/owner/ACL·시험 합성 방식은 그 결정 안에서 Main이 기술적으로 고정한다.

실제 runtime/current·원 평가대상·필요 선행 완료/검수 source는 성공 소비의 **앞 선행**이며 구현 후로 미루지 않는다. 그 이후에도 책임 역할 판단, 자동/건별 범위·승인/한도/예산, queue/dispatch 중복·실행 소유권과 실제 실행 검수는 남는다. 사람 조건의 평가 기록만으로 진행/완료 사실은 생기지 않으며 기존 evaluateSyntheticNext를 실제 scheduler라고 부르거나 false flags를 true로 바꾸지 않는다.
