# U-01 정확 조합·기간 Dashboard 공개 조회 계약 제안

상태: `PROPOSED / HUMAN_DECISION_REQUIRED / PRODUCT_WRITE_NOT_AUTHORIZED` (2026-10-08). 설계 §29.2의 이미 승인된 사용자 동작을 구체화하는 별도 공개 API·인가 계약 제안이며, 이 문서 자체는 승인 기록이 아니다. 로컬 개발·`ssh WSL-server` 검증만 대상이고 Production·ysna-server는 제외한다.

## 판정과 선택지

현재 `GET /api/dashboard/project-environments`는 활성 등록·정확 pair grant 목록을 반환하지만, 기존 `GET /api/dashboard/operations`는 host에 고정된 한 조합의 현재 snapshot만 반환한다. Web에는 조합·기간 필터가 없다. 이 상태를 U-01 수직 완료로 판정할 수 없다.

| 선택 | 결과 | 가역성·위험 |
| --- | --- | --- |
| A. 기존 고정 조회와 `UNAVAILABLE` UI만 유지 | 새 계약 없이 현재 진실성은 유지하지만 U-01 조합·기간 완료조건 미충족 | 낮은 변경 위험, 계획 미완료 |
| B. 아래의 **별도 정확 pair 읽기 API**와 기존 원본의 완전성 검증만 추가(권고) | 기존 GET/ACK 보존, 조합 선택·달력일·현재/발생 분리와 fail-closed 구현 가능 | 공개 API·인가 조립 변경. 새 DB schema는 만들지 않으며 PR revert 가능 |
| C. 기존 Dashboard GET에 임의 query를 추가하거나 불완전 snapshot을 기간 건수로 사용 | route 수는 적지만 기존 소비자 호환성·권한·허위 수치 위험 | 비권고 |

## 권고 B의 정확 제품 계약

1. 기존 `GET /api/dashboard/project-environments`의 경로·권한·응답은 유지한다. 화면은 이 목록의 활성 `projectId`·`environmentId` **한 쌍**만 선택할 수 있다. 목록 재조회 또는 선택 전환 시 이전 조합의 응답·cache를 폐기한다. ID 문자열을 조합 권한의 증거로 취급하지 않는다.
2. 새 읽기 전용 경로는 `GET /api/projects/{projectId}/environments/{environmentId}/dashboard?period=1d|7d|30d`다. `period`는 정확 한 번 필수이며 그 외 query/중복/비정규 값은 400이다. 응답은 기존 API와 같은 `{"data": ..., "request_id": ...}` envelope을 사용한다. 브라우저는 same-origin 상대 경로만 호출한다.
3. 응답 `data`의 고정 상위 필드는 `pair`, `period`, `current`, `occurrences`, `sourceCompleteness`다. `pair`는 서버 등록 원본의 `projectId`, `projectName`, `environmentId`, `environmentName`이다. `period`는 `key`, `timeZone:"Asia/Seoul"`, `startUtc`, `endUtc`, `observedAt`이며 모두 서버가 산출한다. `1d/7d/30d`는 서울 달력일 기준 오늘 포함 최근 1/7/30일의 현지 자정→UTC `[startUtc,endUtc)`이다. 당일 미래 구간을 완료된 이력처럼 세지 않도록 실제 읽기의 상한은 `min(endUtc,observedAt)`이고 이를 `observedAt`으로 명시한다.
4. `current`는 해당 조합의 읽기 전용 Health 6종, Run/Queue/Agent/Provider 상태, 승인 대기·BLOCKED·Gate·비용·baseline 상태, 미해결 Critical과 Next Action의 **현재** projection이다. 기존 고정 GET의 외부 응답을 변경하지 않고 별도 serializer를 사용한다. 항목의 원본·관측시각·scope·완전성 확인 실패는 `status:"UNAVAILABLE"`, 숫자는 `null`, 이유 코드를 포함한다. 미연결·미실행은 성공이나 0이 아니다. 미해결 Critical 전체를 검증된 완전 원본에서 얻을 수 없거나 페이지가 잘리면 조용히 일부만 표시하지 않고 해당 current read를 503/`DASHBOARD_SOURCE_UNAVAILABLE`로 실패-폐쇄한다.
5. `occurrences`는 기간 내 **발생** 자료를 현재 상태와 분리한다. 각 지표는 `{status:"AVAILABLE"|"UNAVAILABLE", count:number|null, source:string, observedAt:string|null, reason:string|null}` 형식이다. 첫 단계에서 기존 append-only Operations audit의 해당 조합 `DETECTED` 사건만 전 구간 완전 조회·중복 제거가 증명될 때 `criticalDetected`를 `AVAILABLE`로 계산한다. Run 시작·Gate 실패·비용 초과·baseline 충돌 등 완전한 기간 원본이 없는 지표는 `UNAVAILABLE/count:null`이며 snapshot 100건·Alert 한 페이지·현재 상태를 기간 전체로 승격하지 않는다. 검증된 원본이 후속 구현에서 발견되면 같은 형식에만 연결하고, 새 지속 원본/schema가 필요하면 별도 승인받는다.
6. `sourceCompleteness`는 current와 각 occurrence의 원본 이름, 조합 범위, 사건 시각 기준, 전체/부분 여부, 마지막 관측시각과 결손 이유를 명시한다. 완전하지 않은 수치에는 0을 쓰지 않는다. 기간 밖에 시작했으나 미해결인 Critical과 Next Action은 `current`에 남아 기간 필터로 숨기지 않는다. 브라우저 로컬 시각은 권위가 아니다.
7. 서버는 매 요청마다 인증된 actor의 `dashboard:read`와 등록 원장의 활성 Project·Environment, **그 정확한 `(actor, project, environment, dashboard:read, active)` grant**를 함께 확인한다. 독립 ID 집합의 교차조합은 인가가 아니다. 철회·비활성·미등록·다른 조합은 같은 403 계열로 거부하며 응답과 원본을 열람하지 않는다. DB 권한 원본 장애는 503으로 실패-폐쇄한다. 요청별 조합 owner는 검증 뒤에만 구성하고 다른 조합의 source/cache/audit을 재사용하지 않는다. 기존 고정 GET 및 Critical ACK의 경로·인가·응답 의미는 불변이다.
8. 이 안의 범위에서는 기존 F-19A 등록/권한 테이블과 기존 업무 원본만 읽고 **새 migration·schema·지속 데이터 변경을 하지 않는다**. 새 원본을 쓰거나 기존 감사 Event를 재작성/삭제하는 것은 이 결정에 포함되지 않는다.

## 완료 검증과 rollback

- 로컬 TDD: 정확 pair/교차조합/철회·비활성·원본 장애, 세 기간의 서울 자정·월말·윤일·UTC 경계, 현재/기간 분리, 오래된 응답 폐기, 페이지 잘림·부분 원본 `UNAVAILABLE`, 기존 GET/ACK 회귀. Web test/typecheck/lint/build와 API·OpenAPI 검증.
- branch의 clean exact SHA를 개발 원격에 push한 뒤 WSL-server가 Git으로 수신한다. 격리 PG15/OIDC/HTTPS/Chromium에서 둘 이상의 조합 선택→철회→재선택, 실제 DB row와 API·화면, same-origin Network, 1920×1080·키보드·오류 상태를 확인하고 전용 자원 잔여 0을 기록한다. 독립 Tester가 계획 §13과 AV-SAFE-034/AV-OPS-027/AV-UI-017을 판정한다. 필요 없는 PG18 RC·Production 결과를 PASS로 표시하지 않는다.
- 승인 전 새 route·인가·DB 제품 write는 하지 않는다. 승인 뒤에도 기존 동작 회귀 또는 완전성 실패가 있으면 PR을 병합하지 않고 branch에서 수정한다. 병합 뒤 복구는 신규 route·UI commit을 revert하되 기존 GET/ACK·등록 원장·감사 Event는 보존한다. 새 DB schema가 없으므로 data migration rollback은 없다.

## 신산님께 필요한 정확한 결정

**권고 B의 새 읽기 API 경로·입출력·요청별 정확 pair 인가 조립과 기존 원본만 사용하는 무 schema 구현을 U-01 범위로 승인할지** 결정이 필요하다. 이 승인은 기존 공개 GET/ACK 의미 변경이나 신규 migration·지속 데이터/Secret/Production 변경 승인으로 확장되지 않는다. 승인 전에도 Main은 postmerge 작업현황 정합·기존 기능 회귀·문서 검토를 계속한다.
