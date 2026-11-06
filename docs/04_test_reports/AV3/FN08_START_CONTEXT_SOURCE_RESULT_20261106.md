# FN08 START 맥락·옵션 원문 공급 r2 소스 검수 결과

판정: 직접 채택된 코드·합성 검증 단위 인수. 전체 FN08·Stage·작업계획서 완료나 실제 사용자 기능 인수가 아니다.
날짜: 2026-11-06. 구현: 기존 Primary. 검수·통합: Main 어울. 독립 검토: 기존 읽기 전용 담당자.

## 기준과 승인

- 기준 HEAD e73fb87ec26375b91e444ea21c76d8651bc7f6d6, branch codex/av3-stage-b. 시작 index 비어 있음, 변경3·Main 현황2·보호 untracked3을 구분했다.
- 계약 r2: docs/contracts/FN08_START_CONTEXT_SOURCE_CANDIDATE_20261106.md / D8AC4D28F9D2C6B27F54D45489DFA86C180CF2AD5E1375D161F3369401338395.
- WI: docs/work_packages/FN08_START_CONTEXT_SOURCE_IMPLEMENTATION_CANDIDATE_20261106.md / 4DAA728B7A4324ABC79A2850F13AF9C418AED6D0C05440A09CECD0D076B4F680.
- 직접 채택 binding: docs/work_packages/FN08_START_CONTEXT_SOURCE_DIRECT_APPROVAL_20261106.md / EDCB72664BB9186CFD23966B749698519E927AF38BCFF06D872EB8689808CD75. 사용자 답변은 r2 계약·코드·합성 구현 채택이다. 후보/WI의 과거 DRAFT 표시는 원형으로 보존하고 이 binding으로 현재 채택을 연결한다.
- 원 r1은 필수 사용자 지시 제외와 정상 공급 모순, Options 참조/현재성 미정으로 반려해 df7776ad에 보존했다. r2는 새 의미를 직접 채택받았으며 과거 승인을 확대하지 않았다.

## 실제 변경과 결과

변경은 제품2·시험1이다.
- ProjectContexts는 원 저장 closure를 공유하는 내부 접점으로 동일 resolve의 metadata/text를 재구성한다. 기존 공개 read DTO·원문 저장/원 manifest hash는 보존한다.
- SyntheticStartContextSource는 고정 Context JSON과 원 Options를 실제 보호 reader로 얻고 양 그룹 Ref3 목적·별도 body SHA/길이·원 actor/fact/Tx·현재 정의/환경·최단 허가 기한을 검산한다.
- 고정 bundle에 이미 선택된 사용자 지시만 기존 내부 readMessage로 재구성한다. 일반 대화 원문 API/DD166F를 추가하지 않는다.
- 필수 fact 상태/WORK 이해 검사를 보호 읽기 전에 적용하고, context/준비/정의/환경을 한 번씩 재관측해 원 fullref/body/current를 비교한다. 이는 유한 전후 관측이며 실제 PG 경합/COMMIT 순간까지 고정 보장이 아니다.
- 실제 current/credential 공급자를 만들거나 기본 app에 등록하지 않았다. 원 fact의 현재성·권위·기한을 새로 발행하지 않는다.

신규 합성은 실제 Contexts/Sources/Knowledge/Conversations/Documents/ArtifactStore·준비/정의/환경 보호 read부터 실제 AccessRepository/초기 queue/registrar 두 그룹, 구체 Challenge/Material Store·P256·기존 E1 예약·proof/receipt binding, receiver.record/startOptions까지 H3/E1로 연결한다. 명시 같은 proof 재조회는 추가 binding0, 만료 후 원 command replay는 artifact IO/원장 변경0이며 fresh 공급은 거절한다.

assignment 확인/draft/current와 실행 current는 명시 합성 포트다. 준비 행·PG 완결 함수는 메모리 원자료/SQL 모델이다. 이를 실제 DB/RLS/권한·실제 current 공급 진위나 Agent 실행의 증거로 승격하지 않는다.

## Main 검증과 독립 검토

Main e1895c:
~~~text
node --experimental-transform-types --disable-warning=ExperimentalWarning --test tests/unit/FN05/context-store.test.ts tests/unit/FN05/context-sources.test.ts tests/unit/FN05/context-manifest.test.ts
~~~
14PASS/fail0/skip0·719.5226ms/exit0. 공개 보호 조회·저장/replay·source/manifest 회귀다. 전후 모듈·시험 hash가 같고 후속 변경도 없어 같은14는 반복하지 않았다.

Main 506c9e → 동일 session1982 수거 f3d7c9:
~~~text
node --experimental-transform-types --disable-warning=ExperimentalWarning --test --test-concurrency=1 tests/unit/FN08/execution-start-material-registration-flow.test.ts tests/unit/FN08/execution-start-context-source.test.ts
~~~
21PASS/fail0/cancelled0/skip0/todo0·11338.6475ms/exit0. 격리 child의 실제 보호 전체 여정은7196.6804ms였다. 내부 child timeout/제품 timeout은 바꾸지 않고 파일 간 시험 병렬도만1로 두었다.

- 위 Main 범위는 중복 없는35개다. Primary의 이전35와 선택1 등을 중복 합산하지 않는다.
- b9ab22 npm run typecheck exit0. 이후 허용8·보호3 raw 불변, HEAD 동일·index 비어 있음을 검산했다.
- 878afc git diff --check exit0. ProjectContexts CRLF→LF 예정 경고1은 보존했고 설정을 바꾸지 않았다.
- 최종 전검산8fca5e의 raw8은 아래 표와 같다.

독립 source 재검토는 기존 I1/I2 해소·추가 C0/I0/M0, 최종 시험44490B/C42A8D6B의 검토도 시작/종료 hash 동일에서 C0/I0/M0다. 실제 클래스/원 snapshot·body·Ref·현재성·UNKNOWN/역사/child 정리를 대조했다. 직접 source의 commandRef 형상 검사를 원 command 완결 검증이라고 확대하지 않으며 실제 결박은 상위 queue/parts의 전후 등록 조회가 담당한다.

## RED·준비 오류·수명 관리

- 85ea68 신규 모듈 부재1FAIL은 구조적 RED이며 실제 행동 반례와 구분했다.
- I1: 유효 UNVERIFIED fact가 보호 조회에 진입한94e388 RED →0afefb 선택1PASS.
- I2: 보호 조회 뒤 CONTEXT 정정을 놓친2bf1cc 선택1FAIL/3121.3875ms/exit1 → 전후 재관측 뒤 e6a9b1 GREEN.
- Primary 최종 직접5파일35PASS는 cea552→a7f240의9722.3416ms/exit0이며 이후 current 부재 음성만281cb4 선택1PASS로 추가했다. Main은 최종 지문에서 신규/인접21을 다시 검증했다.
- UNAVAILABLE enum·합성 assignment baselineRefs·정의 head/역사 version1 SELECT·고정 nonce·없는 DTO flag 등 준비 오류를 실제 제품 RED와 분리했다.
- 시험 저장 EBUSY1 뒤 새 내용이 저장되지 않은 낡은 실행06c283도 새 제품 반례/정식 실패로 세지 않았다. 잠금/권한/서비스 우회 없이 저장을 정착시켰다.
- fs import만 격리 child에서 메모리로 대역화하고 실제 ArtifactStore의 hash/길이·파일 안전 검사를 소비한다. 보호 메서드의 성공 override0, 미등록 artifact IO/쓰기 차단, handle0/mock 회수/child 종료를 검사한다. 허용 소스 모듈 로딩과 실제 artifact IO0을 구분한다.
- 실제 QA 자원 생성/정리 대상0, live/pending0 제출이다. 실제 사용자 자료·키 파일을 만들거나 읽지 않았다.

## 최종 허용8 raw manifest

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/context/project-contexts.ts | 14299 | 0CE60C4DDBF3F9EE8CA50A91EFFC3D6E3D8CC54915E2E0401118D1D46BFB4D61 |
| apps/server/modules/context/context-sources.ts | 8997 | 0E663231D85BD2010781A0CFED4BF081E1AD52883731820E3B1B2428785DBCC4 |
| apps/server/modules/executions/execution-start-material-registration-store.ts | 26598 | 493A3A09CA91DBE6F6BE3A070046F63F06E4D3748183109BC803C0680EF339A1 |
| apps/server/modules/executions/execution-start-context-source.ts | 15749 | 24273B1B1B83314E554EBEB57B0C90D78256B422352F30C92A325019880B240C |
| tests/unit/FN05/context-sources.test.ts | 14740 | E74602D59D9D0ED4A820CBB5CAD79AAEBF1C64906BCBB707D69B75413428A5F9 |
| tests/unit/FN05/context-manifest.test.ts | 5763 | D9BBDC5F0006FD871D082B967BA46F533A783396C5490C3C61E5A8421D4ACA91 |
| tests/unit/FN08/execution-start-material-registration-flow.test.ts | 25313 | 83A59E810A43A278381FBF8DF0140DACFF0468E3031105F1910DF7CB9D92906A |
| tests/unit/FN08/execution-start-context-source.test.ts | 44490 | C42A8D6B993B3991FAA4B543BA2566C673D7DD0F39E20898D3DC8C834474D61E |

실제 변경3은 project-contexts.ts, 신규 execution-start-context-source.ts, 신규 execution-start-context-source.test.ts다. 허용 나머지5와 보호3은 불변이며 다른 변경을 stage하지 않는다.

## 미검증·잔여·복구

- 실제 PG/schema/RLS/trigger·COMMIT, 실제 원문/자료 공급자/current/credential·HTTP/브라우저·서비스·Agent·사용자 인수는 NOT_RUN이다.
- 등록 정의·원문 공급의 코드/합성 범위만 검수했다. FN08 전체는 부분 구현이며 실제 환경에서 사용할 수 있는 기능 완료로 표시하지 않는다.
- 실제 DB·권한/정책 부여·키/서비스·일반 대화 API·실자료 조사·P03/J3·Oracle/운영은 수행하지 않았다.
- private push·remote exact SHA 일치·PR/main 통합·배포도 수행하지 않았다. 기존 원격 오류/차단을 우회하지 않는다.
- rollback은 이번 변경3의 검토 후 정상 revert다. 현재 실행하지 않았으며 과거 소스/SQL/보호 미추적 자료를 보존한다.
- 다음은 이번 공급 구현으로 달라진 선행만 WORK_PLAN과 실제 소비 코드에 대조해, 다음 승인된 미완료 단위를 기존 담당자에게 배정한다. 전체 목표는 active이며 완료로 축소하지 않는다.
