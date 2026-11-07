# FN08 구체 START 관측 결합 작업지시서

## 목적과 선행

기준 HEAD는 3f21170bcb68103373411714e0559409df700642, 작업 branch는 codex/av3-fn09-origin-decision-storage다. WORK_PLAN FN08의 START 원문 전달과 직접 회귀 보완이며 PMO가 지시한 동일 보호 의미의 내부 구현 범위다. 기존 canonical 할당 후보는 실패·철회됐으므로 재적용하지 않는다. 전체 계획은 미완료다.

기존 실제 START의 current→readPart→current가 보호 source를 반복 재구성하는 원인을 줄인다. 한 읽기의 첫 관측→실제 body→fresh 마지막 관측을 결합한다. 권한 결과를 다음 요청에 재사용하는 cache, 일반 성공 대역, 검사 생략은 금지한다. 관측 시점 사이의 모든 순간적 변화를 기존과 동일하게 포착한다고 주장하지 않는다. 계약상 before/after·잠금·본문 권위 보호를 아래 반례로 입증해야 한다.

## 단일 writer와 허용 경로

기존 Primary만 아래 제품5와 시험3을 수정한다. Main은 본 지시서·WORK_STATUS만 기록한다. 다른 writer, commit/push/PR/병합은 맡기지 않는다.

- apps/server/modules/executions/execution-start-material-parts.ts
- apps/server/modules/executions/execution-start-material-basis.ts
- apps/server/modules/executions/execution-instruction-material-store.ts
- apps/server/modules/executions/execution-authenticated-materials.ts
- apps/server/modules/executions/execution-materials.ts
- tests/unit/FN08/execution-materials.test.ts
- tests/unit/FN08/execution-start-material-registration-flow.test.ts
- tests/unit/FN08/execution-start-context-source.test.ts

실제 DB·권한·키·서비스·Agent·실자료/백업 조사·SSH·새 dependency·HTTP/DTO/SQL 변경은 제외한다. 다른 backend10/UI4와 canonical 원본을 보존한다.

## 필수 구현 경계

1. 실제 parts/basis/repository/source의 동일 조합·원 transaction/query/xid·actor/client/Session/세대·scope·command/material에만 내부 단발 관측을 결박한다. private WeakMap과 실제 생성자 출처를 사용하며 caller가 등록하는 setter, 검증완료 boolean, 임의 optional readVerified 포트를 만들지 않는다. 모듈 간 내부 조회/소비가 필요하면 opaque 출처만 전달하고 raw db/actor/source 조립 권한을 공개하지 않는다.
2. 첫 inspect로 기존 actor/Session 검산·기한 축소·basis exact8을 구성하고 기존 execution-materials 전체 proof/target/command/material 검산을 본문 읽기 전에 실행한다. 실패하면 readBody 호출0이다.
3. 같은 관측 업무에서 실제 readBody를 수행하고 전체 source/Options/부분 bytes·길이·hash·UTF-8·비밀 검사와 buffer 정리를 유지한다.
4. 원 등록을 재조회해 정확 동치를 확인하고 새 inspect·clock·actor/Session·기한 검산과 동일 전체 proof 검산을 수행한다. 기존 binding은 checkedAt만 제외한다. expires와 writerState를 제외하지 않는다. before/after binding 동치와 최종 시각이 양쪽 최단기한보다 앞섬을 요구한다.
5. checked의 query/xid·E↔H 매핑·등록/회수·기한 및 마지막 await 뒤 검사를 유지한다. 메서드/descriptor 변조·위조·교차 조합을 성공 경로로 인정하지 않는다.
6. authenticated materialFor 두 호출, 실제 challenge journal/result의 proof descriptor, nonce/result/binding·두 consume·COMMIT UNKNOWN·동일 proof 재조회 알고리즘은 유지한다. 일반 SEND/구조적 합성 포트는 기존 current/readPart/current fallback과 결과를 유지한다.

## 검증과 인수

- 기존 실패 RED와 원10초 gate를 인수한다. 코드가 바뀌기 전 동일 집계를 재실행하지 않는다.
- 본문 전 proof/actor/target 실패 시 body0, 본문 중 expiry/writerState/source head/Session·회수/query/xid 변경, 마지막 await 뒤 만료, 위조/교차 concrete 조합의 거절을 검증한다. expiry 연장·축소도 binding 불일치로 거절한다.
- 기존 wrong grant/target·orphan consumption·UNKNOWN 재조회·SEND/fallback의 결과 및 중요 호출 경계를 유지한다. 기존 기대값·skip·timeout을 완화하거나 삭제하지 않는다.
- 시험3의 필요한 직접/인접 사례와 npm run typecheck, git diff --check를 수행한다. 원 aggregate 본문과 timeout10000·기대값은 그대로 보존한다. 새 반례는 같은 파일에 추가할 수 있다.
- 변경 후 원 명령 node --experimental-test-module-mocks --test --test-name-pattern='실제 보호 Context/Options→원 START queue/구체 proof/receiver' tests/unit/FN08/execution-start-context-source.test.ts 로 실제 통과를 확인한다. 동일 후보 실패를 변경 없이 반복하지 않는다.
- 정확 diff·전후 raw hash/bytes·실행 명령/exit/실제 PASS/FAIL·오류 횟수·미검증·살아 있는 handle을 반환한다. source/synthetic 통과는 실제 DB/브라우저/Agent 인수가 아니다.
- Main 독립 검수 C/I 미해소0 및 원 gate PASS 전 병합하지 않는다. 성능 미달 또는 보호 의미 차이가 드러나면 구현 완료로 채택하지 않고 후보 diff와 결과를 보존해 다음 판단을 받는다.

## rollback

본인8경로의 변경 hunk만 기준 HEAD와 비교해 분리 철회한다. 기존 backend/UI·다른 파일·Git 이력·사용자 자료는 복구 대상으로 삼지 않는다. 실패 기록은 지우지 않는다.
