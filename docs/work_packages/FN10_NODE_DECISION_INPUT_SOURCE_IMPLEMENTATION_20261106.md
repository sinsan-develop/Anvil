# FN10 사람 판단 선언·입력 순수 검증 작업지시서
- 일자: 2026-11-06
- 상위: WORK_PLAN FN10/UI04, 신산님의 확정 문서 묶음 별도 선택·source-only 계속 지시.
- 상세 후보: docs/contracts/FN10_HUMAN_DECISION_CANDIDATE.md
- 후보 SHA256: 462BD4057DB00D566831A6D13B700BC6E2BEE8438516257526C4795A47261C7F
- 시작 HEAD: ebe775979d0647ace993375b377b7f872ee9056a
- 역할: 기존 Primary 단일 code writer, Main 관리·검수·통합. 독립 코드 검토를 제출과 분리한다.
- 범위: FN10 전체 중 순수 선언 추출·봉인과 기존 명령 외피/선택 입력 검증. 저장·현재성·권한·계상은 후속 미완료다.

## 1. 정확 쓰기 경로
1. apps/server/modules/scheduling/node-decision-input.ts
2. tests/unit/FN10/node-decision-input.test.ts

신규2만 작성한다. 기존 graph/validator·명령/route·SQL·auth/정책·quota·Web은 수정하지 않는다. Main 문서와 보호3을 보존하고 다른 작업자 변경을 되돌리지 않는다. commit/push·새 세션/branch/worktree/자동화0이다.

## 2. 실제 기존 검증 재사용
현재 application의 원 snapshot/graph 구조를 실제 ProjectMethodologies.readApplication이 반환하는 형태로 파악하고 원 fullref/hash 관계를 순수 검산한다. applicationSnapshot에 존재하지 않는 필드를 발급하거나 caller의 성공 flag를 권위로 쓰지 않는다. 이 함수는 데이터 검산이며 원 source를 보호 조회했다고 주장하지 않는다.

기존 validateMethodologyGraph(graph,formRefs)와 canonical/ref·assertKnowledgeTextSafe를 재사용한다. 선언된 formRefs를 validator에 공급하고 그래프·노드 역할·제한 AST의 기존 기준을 낮추지 않는다. helper private 필드 공개나 기존 구현 복제0이다. getter/Proxy/오염 prototype·배열은 원 validator 호출 전에 거절한다. 원 값을 trim/casefold/재해석하지 않는다.

## 3. 함수와 닫힌 반환
- deriveNodeDecisionDeclaration({applicationRef,applicationSnapshot,nodeId,formRefs}): 원 snapshot/graph hash·실제 validator 결과를 검사한다. HUMAN 또는 DECISION이면서 role USER인 노드만 허용한다. outgoing BRANCH 중 해당 node USER_DECISION을 참조하는 EQ/NE/IN의 값을 all/any/not 제한 AST에서 수집한다. IS_PRESENT-only 등 유한값이 없으면 후보의 NODE_DECISION_DECLARATION_UNSUPPORTED로 거절한다. 노드·선택 application과 대상 edge/조건 원형 전체·정렬된 값 목록을 canonical hash에 결박한다.
- 값은 유효 Unicode·제어/비밀/위장 prototype key 검사, 각1~200 UTF-8 bytes·중복제거1~32개·Unicode 코드포인트 순 정렬을 따른다. JS UTF-16 기본정렬로 대체하지 않는다.
- readNodeDecisionRecordInput(raw,declaration): exact7 {nodeRef,declarationHash,basisSelection,decisionBaseRef,value,reason,sourceDocumentRefs}. 선언 hash·허용값·application 관계를 검산한다. basisSelection은 exact3 {applicationRef,designRef,planRef}. baseRef null 또는 fullref, reason은 후보의1~20000자·공백만/비밀표식 거절, sourceDocumentRefs1~20의 원 fullref다. actual project/확정/현재성은 후속 source에 남긴다.
- readNodeDecisionRevokeInput(raw): exact3 {decisionRef,basisSelection,reason}. 원 head/application 관계를 가짜로 확인하지 않고 후속 source에 남긴다.
- readNodeDecisionCommand(raw,declaration?): 기존 ProjectCommand exact11 외피의 operation2·target/expectedVersion CAS·빈 baselineRefs·기한 형식을 검사한다. record 최초 targetId=null/expectedVersion0, 후속은 decisionBaseRef exact head; revoke는 decisionRef exact head. REQUIRE/approval는 후보의 미지원 거절을 유지한다. 실제 정책 허용을 판정하거나 토큰을 발급하지 않는다.

기존 오류 원형을 재사용해 INPUT_INVALID와 선언 미지원을 구분한다. 정확한 command 외피 필드·application snapshot 구조를 코드에서 확인하고 후보와 다르면 임의 값을 만들지 말고 Main에게 차이를 반환한다. 입력을 복사·고정하고 외부 객체 변이로 봉인이 바뀌지 않게 한다. output은 순수 declaration/검산된 입력이며 recorded/accepted/current/authorized를 true로 만들지 않는다.

## 4. TDD와 인수
원래 export 부재 RED는 구조적 준비로 따로 기록한다. 실제 기존 validator가 수락한 그래프의 양성에서 출발해 실제 동작 반례를 확보한다.
- HUMAN/DECISION USER, EQ/NE/IN/all/any/not, form bindings·원 application·branch hash, 최초/정정/revoke 양성.
- 역할/다른 node/application·변조 snapshot/ref/hash/branch·허용값 외·IS_PRESENT-only·숫자/bool·한도32/33·200/201 UTF-8 경계·잘못된 Unicode·중복/무변형·정렬.
- getter/Proxy/배열 오염·입력/반환 alias 변이·비밀표식/공백만·CAS/기한/approval·다른 operation/extra key.
- 기존 methodology graph/조건의 필요한 인접 시험과 typecheck/diff. 완료한 bootstrap/profile69를 반복하지 않는다.

시험은 메모리 데이터와 실제 순수 validator만 소비한다. 실제 사용자 원문/파일 조사·DB/SQL/권한/키/서비스·SDK/Agent/OS process 실행0이다. 합성 입력 검증을 실제 저장/조회/UI PASS로 승격하지 않는다.

## 5. 제출과 다음 단계
Primary는 정확 신규2·시작/끝HEAD/rawhash·명령/exit/fail/skip·준비오류와 실제RED·live/pending0·미검증을 제출하고 writer를 반환한다. Main 독립 검토·fresh 직접 검사 뒤 정확 소유 파일만 checkpoint한다. rollback은 신규2의 정상 revert이며 실제 환경 변경0이다.

후속 저장량 계산과 원 보호 source/같은Tx 저장·후행 보호조회·미적용 SQL·화면은 별도 정확 WI로 이어간다. 이 일부 구현을 FN10/Stage/전체 계획 완료로 보고하지 않는다.
