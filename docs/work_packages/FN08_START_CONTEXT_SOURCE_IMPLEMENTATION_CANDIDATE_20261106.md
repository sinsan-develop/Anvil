# FN08 START 원문 재구성 조건부 구현 WI 후보

상태: DRAFT / WAITING_ADOPTION / PRODUCT_GO0. Main 어울, 2026-11-06.
이 문서는 준비 지시이며 구현 착수 승인이 아니다. 기존 Primary 단일 writer를 위한 조건부 업무다.

## 1. 부모·기준·착수 조건

- 계약 후보: docs/contracts/FN08_START_CONTEXT_SOURCE_CANDIDATE_20261106.md r2, 15093B/SHA256 D8AC4D28F9D2C6B27F54D45489DFA86C180CF2AD5E1375D161F3369401338395. 독립 C0/I0/M0.
- 문서 HEAD: 0b6a35d02dc8e77c69494c4b57f08f93b7ac7d3d. 제품 기준: 16be50b474d43338968d6fcc120cae5e08b54ec9. branch codex/av3-stage-b.
- 실제 사용자에게 보낸 r2 채택 질문은 아직 미응답이다. 이전 START 등록/FN09 준비 승인을 새 공급 계약 승인으로 이월하지 않는다.
- 직접 채택 답변의 정확 대상/범위를 기록하고 부모 hash·현재 Git·허용 파일 raw를 다시 검산한 뒤 Main이 PRODUCT_GO를 별도로 전달해야 착수한다. 답변 경과 시간·PMO 관측·이 WI 존재는 승인이 아니다.
- 기존 지침/설계/WORK_PLAN/FUNCTION_WORK의 FN05/FN08/FN09, FN08 START 채택 부모와 원문 공급 제외, FN09 Options 원문 계약을 먼저 대조한다.
- 계약 의미가 바뀌지 않는 내부 구현은 Main이 조정하되 공개/권한/저장 의미·범위 변경은 임의 결정하지 않는다. 현재는 제품 쓰기0이다.

## 2. 허용 파일과 시작 지문

최대 제품4·시험4. 필요한 파일만 수정하며 아래 외 경로를 수정하지 않는다. Main은 이 경로를 동시에 수정하지 않는다.

| 경로 | bytes | SHA256/부재 |
|---|---:|---|
| apps/server/modules/context/project-contexts.ts | 13017 | 1272053A5885D904EF13722A8F359690809D60CC8200EA0A8EF7D241CEE3E8E4 |
| apps/server/modules/context/context-sources.ts | 8997 | 0E663231D85BD2010781A0CFED4BF081E1AD52883731820E3B1B2428785DBCC4 |
| apps/server/modules/executions/execution-start-material-registration-store.ts | 26598 | 493A3A09CA91DBE6F6BE3A070046F63F06E4D3748183109BC803C0680EF339A1 |
| apps/server/modules/executions/execution-start-context-source.ts | 없음 | ABSENT |
| tests/unit/FN05/context-sources.test.ts | 14740 | E74602D59D9D0ED4A820CBB5CAD79AAEBF1C64906BCBB707D69B75413428A5F9 |
| tests/unit/FN05/context-manifest.test.ts | 5763 | D9BBDC5F0006FD871D082B967BA46F533A783396C5490C3C61E5A8421D4ACA91 |
| tests/unit/FN08/execution-start-material-registration-flow.test.ts | 25313 | 83A59E810A43A278381FBF8DF0140DACFF0468E3031105F1910DF7CB9D92906A |
| tests/unit/FN08/execution-start-context-source.test.ts | 없음 | ABSENT |

새 helper/시험의 존재를 완료로 세지 않는다. 새 dependency/공개 export/route/SQL/기본 app 조립/기존 grant·공통 canonical 변경은 허용하지 않는다. 추가 파일이 필요하면 먼저 실제 이유와 최소 변경을 Main에게 반환한다.

보호 untracked3은 읽기 비교만 하고 수정·stage하지 않는다:
- docs/contracts/FN06_NATIVE_COMPILE_ONLY_CANDIDATE.md: FACFB93816ED7DA02640E86127D9244209E1482C24D9D94219E2FF0F0E9D85B8
- tests/unit/FN04/design-change-conversation-source.test.ts: CFB2969C615EC551A5C83515932F262FE1319B44EB24F36EFC76ADD91C0FB6EF
- tests/unit/FN10/stage-queue-assignment.test.ts.pending: AE1B34C2A592BCDF232D322C5F2205F240DEBF8C54B21D322D7850B3C86FACB6

## 3. 구현할 실제 호출선

원 START authenticated Tx/actor/request·검증된 원 fact/grant
→ ProjectContexts의 기존 저장 closure/보호 read
→ 같은 원 preparationInput을 ProjectContextSources.resolve로 text-bearing 재구성
→ 그 동일 결과를 buildContextManifest에 넣어 원 fullref/manifest exact 일치
→ 계약 §4의 고정 JSON·원 부분/ArtifactRef/UTF-8/SHA 검산
→ ProjectExecutionPreparations의 실제 보호 read·원 Options 재현
→ 실제 ProjectConnectionDefinitions/ProjectEnvironments 보호 read의 현재성 재확인
→ 명시 SYNTHETIC_ONLY source.describe/inspect/readBody
→ 기존 START registrar/저장/부분조회·P256/proof/receiver 소비.

- 같은 resolve 결과의 metadata/text만 사용한다. 서로 다른 조회의 성공값을 섞지 않는다.
- 기존 Context 저장 command/receipt/audit·원문 접근·확정/검토·헌법/정정·격리 guard를 생략하지 않는다. readMessage의 원 HUMAN·conversation/message ref와 불변 body 검산도 그대로 소비한다.
- 공개 ProjectContexts.read DTO에 text를 추가하거나 기존 준비의 false/unverified를 바꾸지 않는다.
- 새 USER_INSTRUCTION 예외는 채택된 원 bundle의 저장된 exact 선택만 내부 재구성한다. 일반 대화 조회·새 선택·DD166F endpoint/UI·우회 provider를 만들지 않는다.
- Options는 보호 read 결과를 원 definition으로 재컴파일해 exact 비교한다. fresh에서는 definition.currentStatus.configurationCurrent===true 및 environment.current.configurationCurrentness==='MATCHED'를 실제 reader 결과로 요구한다. 역사 NOT_RECHECKED를 현재로 전용하지 않는다.
- 양쪽 Ref3의 목적 투영과 원 metadata SHA/재구성 bytes SHA를 구분한다. 원 저장 ref 대신 임의 UUID/version/artifact를 만들지 않는다.
- 논리 자료 범위는 원 fact.intent.contextBundleRef 및 fact.preparationRef exact다. 파일용 sourceScopes를 문서 권위로 해석하지 않는다. 원 current fact/정책·등록·source 검산과 현재 보호 읽기를 모두 요구한다.
- 원 current 공급자가 없으면 거절한다. 새 VERIFIED_CURRENT/checkedAt/grant·예약·권한을 만들지 않는다.
- db/query/txid·actor/client/H·원 grant·범위와 최단기한을 각 await 전후/마지막 callback 뒤에 검산한다. currentReadOnly·H/E 분리·원 Challenge 이전/동일 E1 예약도 유지한다.
- descriptor/body/두그룹 합산/부분 수·연속 offset·UTF-8/SHA/최소기한은 계약 r2대로 검사한다. 누락/제외/불명은 전체 거절하며 조용한 생략0이다.
- 실패 rollback, COMMIT 불명 UNKNOWN, 역사 replay의 source 재생산/등록/전달0, consumed proof 추가효과0을 보존한다.
- API/서비스 기본 등록이나 실제 current/credential/Agent 공급자는 만들지 않는다.

## 4. 합성 검증의 원문 저장소 접점

ProjectDocuments는 실제 ArtifactStore instance를 요구하고 ArtifactStore.read는 fs 검사를 소비한다. 이를 이유로 제품 constructor/보호 guard를 완화하거나 새 test-only 제품 seam을 추가하지 않는다.

신규 시험의 격리 Node child 하나에만 --experimental-test-module-mocks를 사용한다. fs/promises import를 먼저 메모리 대역화한 뒤 원 보호 모듈을 dynamic import한다. 실제 ArtifactStore/ProjectDocuments/ProjectConversations 및 상위 클래스 메서드는 그대로 실행한다. read/authorize/성공 메서드 override0이다.

- 가상 root·정확 project/artifact 경로·stat·open flags·본문·close만 명시 허용하고 미등록 IO/쓰기/네트워크는 throw.
- 원문은 비밀 없는 합성 메모리 bytes만 사용한다. OS artifact 파일/키/DB/서비스/Agent·실자료 조사는0이다. 허용 source 모듈 로딩과 가상 artifact IO를 구분한다.
- lstat/realpath/open/stat/readFile/close를 계측하고 hash/길이·symlink/비정상 metadata 음성을 보존한다.
- 현재 Node types의 mock.module exports 옵션을 사용하고 모듈 mock/child는 시험 수명 안에서 정확 회수한다. 실제 Agent/helper/process launcher를 호출하지 않는다.
- Main6c0dc9는 원 ArtifactStore 정상/틀린SHA·lstat8/realpath6/open2/read2/close2/write0·exit0만 확인했다. 이 probe를 전체 보호 종단 PASS로 확대하지 않는다. 같은 probe를 반복하지 않는다.
- 제품/원문 재구성 미구현 RED를 먼저 기록한다. 단순 import·테스트도구 오류를 제품 RED로 세지 않는다.

## 5. 검수 시나리오와 명령

최초 실제 failing test→최소 구현→직접/인접 검증 순서다. 기존 시험을 삭제하거나 기대값을 느슨하게 바꾸지 않는다.

정상: 동일 원 bundle의 고정7슬롯·선택 사용자 지시·원문 출처/순서, 원 Options를 실제 보호 클래스에서 얻어 원 registrar 두그룹→부분/proof→receiver에 연결한다. 명시 합성 current 이외 제품 성공 override가 없는지 확인한다.

음성: actor/project/client/H/E/fullref/Tx·query 교체, 원문/ArtifactRef/부분 SHA 변조, 원 지시 정정/격리/회수·현재 헌법/정의/환경 변경, current 부재, 누락/빈 부분/초과/잘못된 UTF-8, 조회 중 만료, 예약부재/후행예약, COMMIT 불명, 역사/consumed 재조회 추가효과0. 새로 읽은 자료로 원 과거 descriptor를 바꾸지 않는다.

예상 직접 명령:
~~~text
node --experimental-transform-types --disable-warning=ExperimentalWarning --test tests/unit/FN05/context-sources.test.ts tests/unit/FN05/context-manifest.test.ts tests/unit/FN08/execution-start-material-registration-flow.test.ts tests/unit/FN08/execution-start-context-source.test.ts
npm run typecheck
git diff --check
~~~
가상 fs child의 모듈 mock flag는 시험 자체가 격리 child에 부여한다. 기존 namespace/등록·부분/proof의 직접 영향 회귀만 추가하며 전체/브라우저/부하 시험을 반복하지 않는다. 조건부 초안이라 위 명령은 아직 실행하지 않았다.

## 6. 제출·완료·미검증

제출에는 원/최종 HEAD·branch/status·허용 경로/raw·actual diff·RED/GREEN 정확 명령/exit/건수/skip·미실행·오류 원인/횟수·같은 Tx/원문/현재성·추가효과0·종료/정리·rollback을 포함한다. Main 문서와 보호3은 수정하지 않는다. commit/push는 Main만 판단한다.

COMPLETED 제출은 Main 독립 검수·인수를 대신하지 않는다. 유효 FAILURE_REPORT와 환경/준비 오류를 구분하고 동일 정식 실패3회가 아니면 임의 인수하지 않는다.

이 작업이 검수돼도 실제 PG/RLS/trigger/HTTP·current 공급 진위·실제 사용자 원문·키/서비스/Agent·브라우저/사용자 인수와 전체 FN08/Stage/계획은 미완료다. 실제 DB·권한 부여·키·서비스·Agent 실행·실자료 조사·P03/J3·Oracle/운영·PR/main/외부 공개는 제외한다.

rollback은 허용 소스 변경을 검토한 정상 revert이며 현재 실행0이다. 계약 채택 또는 Main GO가 없으면 문서 후보만 보존하고 제품 쓰기를 시작하지 않는다.
