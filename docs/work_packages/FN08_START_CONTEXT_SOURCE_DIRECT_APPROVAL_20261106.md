# FN08 START 맥락·옵션 원문 공급 r2 직접 채택 기록

- 날짜: 2026-11-06. 사용자: 신산님. Main: 어울.
- 실제 답변: “r2 계약·코드·합성 구현 채택”.
- 질문 식별: call_56aab131636f4275b02018c46fcb408b의 첫 질문.
- 승인 대상: docs/contracts/FN08_START_CONTEXT_SOURCE_CANDIDATE_20261106.md r2, 15093B/SHA256 D8AC4D28F9D2C6B27F54D45489DFA86C180CF2AD5E1375D161F3369401338395.
- 실행 WI: docs/work_packages/FN08_START_CONTEXT_SOURCE_IMPLEMENTATION_CANDIDATE_20261106.md, 10529B/SHA256 4DAA728B7A4324ABC79A2850F13AF9C418AED6D0C05440A09CECD0D076B4F680.
- 승인 전 HEAD: 33d50abcbba3cb0884da55f4952ff64ffe8a0e48. 제품 기준: 16be50b474d43338968d6fcc120cae5e08b54ec9. branch codex/av3-stage-b.
- 후보와 조건부 WI의 DRAFT/미채택 표시는 당시 원형으로 보존하고 이 정확 직접 답변을 외부 binding으로 연결한다. 후보 hash를 바꿔 소급하지 않는다.

채택 범위는 원 bundle에 이미 선택된 USER_INSTRUCTION의 기존 내부 보호 읽기 예외, 원 fact의 정확 bundle/preparation 논리 자료 범위, CONTEXT/OPTIONS 두 그룹 Ref3 목적 해석·원 metadata SHA와 bytes SHA 구분, 고정 JSON과 현재 보호 재조회·최단 허가 수명이다. 기존 current/권한·원문 closure·Tx·H/E·상한·회수/격리/만료·UNKNOWN 검사를 유지한다.

허용 최대 제품4/시험4:
- apps/server/modules/context/project-contexts.ts: 13017B / 1272053A5885D904EF13722A8F359690809D60CC8200EA0A8EF7D241CEE3E8E4
- apps/server/modules/context/context-sources.ts: 8997B / 0E663231D85BD2010781A0CFED4BF081E1AD52883731820E3B1B2428785DBCC4
- apps/server/modules/executions/execution-start-material-registration-store.ts: 26598B / 493A3A09CA91DBE6F6BE3A070046F63F06E4D3748183109BC803C0680EF339A1
- apps/server/modules/executions/execution-start-context-source.ts: 신규 부재 / ABSENT
- tests/unit/FN05/context-sources.test.ts: 14740B / E74602D59D9D0ED4A820CBB5CAD79AAEBF1C64906BCBB707D69B75413428A5F9
- tests/unit/FN05/context-manifest.test.ts: 5763B / D9BBDC5F0006FD871D082B967BA46F533A783396C5490C3C61E5A8421D4ACA91
- tests/unit/FN08/execution-start-material-registration-flow.test.ts: 25313B / 83A59E810A43A278381FBF8DF0140DACFF0468E3031105F1910DF7CB9D92906A
- tests/unit/FN08/execution-start-context-source.test.ts: 신규 부재 / ABSENT

Main은 시작 지문을 대조한 뒤 이 기록과 정확 WI를 기존 Primary에게 전달한다. 해당 제품/시험은 단일 writer만 수정하며 Main은 동시 수정하지 않는다. 독립 검토·Main fresh 직접/인접 검증·지문과 diff 대조 후 소스 인수 여부를 판정한다.

실제 사용자 원문 조회/전송·실제 DB/권한 부여/키/서비스/Agent 실행·일반 대화 원문 API/DD166F endpoint/UI·실자료 조사·P03/J3·Oracle/운영·PR/main/공개는 이번 승인에 포함되지 않는다. 명시 합성 current와 메모리 DB/가상 artifact FS만 사용하고 실제 제품 보호 클래스의 성공 메서드를 override하지 않는다.

보호 untracked3·관련 없는 변경은 수정/stage하지 않는다. 기존 승인·불변 hash·완료된 검증은 보존하며 같은 검사를 불필요하게 반복하지 않는다. 이 승인은 전체 계획의 완료·실제 실행·실환경 인수 승인이 아니다.
