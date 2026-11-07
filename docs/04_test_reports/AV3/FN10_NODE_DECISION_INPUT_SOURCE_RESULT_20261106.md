# FN10 사람 판단 선언·입력 검증 소스 결과
- 일자: 2026-11-06
- 판정: 입력 소스 단위 인수. FN10 저장/조회/화면과 전체 계획은 미완료.
- 역할: 기존 Primary 구현, Main 직접 검증·통합, 기존 읽기 담당자 독립 검토.
- 시작 HEAD: 46bba6748b0e3aead21b31c95e691da9634cb96e
- WI: docs/work_packages/FN10_NODE_DECISION_INPUT_SOURCE_IMPLEMENTATION_20261106.md
- 실행 기준 WI SHA256: 78C47D4C923F4A9533C57CFCF008021AEBD2942541F68883121176E2E3A0D98A
- 실행 기준 후보 SHA256: 462BD4057DB00D566831A6D13B700BC6E2BEE8438516257526C4795A47261C7F

## 구현
기존 실제 validateMethodologyGraph·application snapshot 형식·canonical/ref·비밀 표식 검사를 소비한다. HUMAN/DECISION USER의 해당 outgoing BRANCH EQ/NE/IN·all/any/not에서 제한 ENUM을 추출하고 원 application/조건·edge 전체와 봉인한다. 원값 무변형·Unicode 코드포인트 순·200 UTF-8 bytes·32개 경계를 유지한다.

명시 basisSelection과 record/revoke exact 입력·원 ProjectCommand exact11·target/version CAS·빈 baselineRefs·approval 미지원 경계를 검산한다. getter/Proxy·오염 prototype/배열·순환·alias 변이는 차단한다. 이 순수 검증은 원 source 접근·현재성·확정·정책·저장·계상을 수행하거나 실행 권위를 발급하지 않는다.

## 최종 변경2
| 파일 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/scheduling/node-decision-input.ts |9935|6A7221E288604641260D31B04B82838E728A9B2B13993F3463C823766CB9E48C|
| tests/unit/FN10/node-decision-input.test.ts |16254|BC2C83C0CACCE870ACB737B4A7AEF083A718E3B1551C67941DFFAE72BC5D91A2|

기존 graph/validator·route/SQL/auth/quota/Web 제품 수정0이며 관련 없는 보호3은 보존했다.

## 실제 RED와 준비 오류
- 신규 export 부재는 구조적 준비 RED로 따로 분류했다.
- 7660e2: 재봉인 선언의 condition extra-key가 수락되는 실제 반례. 선택 시험1FAIL을 뒤 type 명령의 전체exit0으로 가리지 않는다. f9999b에서 닫힌 조건 원형 검사로 GREEN.
- 56aeaf: C1 U+0085 선언 추출 및 재봉인 선언/record의 Missing expected exception, 0PASS/2FAIL/exit1.
- ee9d9d: C1 최소 보완 뒤 직접3PASS/exit0. 소스의 C0/DEL 정규식에 C1만 추가했다. Cf·정상 Unicode·정렬/무변형·byte 경계는 유지.
- 8dc38e: 시험 target 변경이 원 terminal을 도달 불가로 만든 준비 오류1. 원 validator 거절이 정당했고 reason 변경 fixture로 정정해7b0f4e의 해당1PASS를 확인. 제품 실패로 세지 않는다.
- 원 exact11에 issuedAt/expiresAt이 없음을 확인해 새 기한키를 만들지 않았다. 실제 Session/policy/call 기한은 후속 보호 source 소유다.
- Main의 추정 source 경로 부재와 메모리 결과서 제목 초안 준비는 제품/파일 쓰기0으로 구분했다.

## 독립 검수와 문구 정합화
초기 읽기 C0/I0/M1은 숫자/bool graph 오류의 후보412와 실제 원 validator422 차이였다. Main은 원 validator를 유지하고 malformed graph422, 유효 graph의 IS_PRESENT-only 등 유한 선언 미지원412로 구분했다. 최종 독립 C0/I0/M0는 C1 보완·기존 양성/actual application reader·정렬/경계·trap0·skip/only0을 확인했다. 독립 시험 실행 수를 Main 검사에 합산하지 않는다.

후보의 해당 문구만 기존 기준에 정합화한 fd5811은37860B/7DF8D313243A7F98B4A8CC99D2673C41B35811423D4C4DAB8449C82125A5F76E다. Main은 부모462BD405와 신산님 직접 선택을 보존해 이 분류 보정을 MAIN_RECONFIRMED_NON_SEMANTIC으로 기록한다. 기능/역할/권한/기존 schema를 확대하거나 기존 graph 기준을 낮추지 않았다. 실행 WI 원문과 지문은 이력으로 유지한다.

## Main 최종 검증
```text
node --test tests/unit/FN10/node-decision-input.test.ts tests/unit/FN02/graph.test.ts tests/unit/FN02/graph-relations-missing-node.test.ts
npm run typecheck
git diff --check
```

13384d:46PASS/fail0/cancel0/skip0/todo0/499.7232ms/exit0, typecheck/diff0.
5cd406: 최종2 지문 불변·indexempty·보호3 지문 동일.
Primary의 최종344402·type c26730·diff40ef72도 통과했지만 Main46에 중복 합산하지 않는다. 이전43은 보완 전 지문 증거로만 보존한다. 불변 bootstrap/profile 검사는 반복하지 않았다.

## 미구현·미검증·다음
원 보호 source·명시 확정 묶음 발급/불변 보관·record/revoke Tx·quota/projection/예약·양방향 완결·후행 인증 보호 조회·route/Web는 후속 구현이다. 내부 기술 접합은 docs/work_packages/FN10_NODE_DECISION_STORAGE_INTEGRATION_TECHNICAL_20261106.md E4016AE3에 별도 보존했다.

실제 DB/SQL·권한·키·서비스·SDK/Agent·실사용자 원문/파일 조회/전송·브라우저/배포·사용자 인수는 NOT_RUN이다. 이번 결과를 실제 사용 가능 기능이나 전체 FN10/Stage/계획 완료로 승격하지 않는다. push/PR/main/배포0이다. rollback은 신규2와 소유 문서만 정상 revert하며 실제 환경 복구 대상은 없다.
