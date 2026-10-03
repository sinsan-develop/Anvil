# F-20/U-01 R37 이후 Dashboard 잔여 계약 감사

## 판정

`READ_ONLY_SCOPE_AUDIT / U01_F20_NOT_ACCEPTED`. 기준 작업 branch `codex/f18-wsl-ops`, R37 종료·WSL 통제 현황 checkpoint `1a76b144bc0dd38dbe44c68498c698d6bc50cd8e`, canonical seq2028, worker/write lease 없음. 설계 §29.2와 계획 U-01을 현재 host·F-13 source·Console과 비교했다. 이 감사는 제품, 공개 API, DB, Event, 서버 상태를 변경하지 않는다. C30 원장 사고 `OPEN_BLOCKING`과 ReleaseDecision `DEFER`는 유지한다.

## 확인된 현재 경계

| 요구 | 현재 확인된 자료 | 수락 전에 필요한 계약 |
|---|---|---|
| Project/Environment | OIDC host는 하나의 `AuthorizationScope`에 결박되고 Operations port가 principal과 동일 scope를 확인한다. Console 헤더는 `Environment · NOT CONNECTED`다. | 인가된 선택 가능 조합의 권위 owner, 선택 후 동일 조합으로 재조회하는 server-side 결박, 다른 조합·권한 철회 거부. 임의 browser ID나 Project scan의 ID를 인가 근거로 사용하지 않는다. |
| 기간 오늘/7일/30일 | Dashboard snapshot은 현재 관측 시점이다. Alert GET은 저장 기록의 페이지이며 전체 기간 원본이 아니다. | 기간별 원본·집계 owner, 표본/누락/완전성, 경계 시각과 timezone 계약. 현재 snapshot이나 부분 Alert 페이지를 기간 통계로 승격하지 않는다. |
| Run/Agent/Provider | 범위 내 Run 3상태 요약은 응답·화면에 연결됐다. R36 Agent owner 요약은 명시적 내부 읽기만 가능하다. R37은 현재 host 설정의 Provider 등록 9행을 Dashboard source에 연결했고 실제 WSL PG15/OIDC host를 검증했다. | Agent 공개 상태와 실제 Provider health/모델/한도는 미결선이다. 등록은 연결 성공이 아니며 `NOT_CHECKED`/Health `UNKNOWN`을 유지한다. |
| Health 여섯 카드 | 화면은 기존 `health`와 `source_gaps`를 정직하게 구분한다. OIDC host는 Queue read와 Provider 등록 source를 공급하지만 실제 HealthSignal owner는 공급하지 않는다. 별도 readiness는 DB 정보의 독립 보조 자료다. | 컴포넌트별 관측 단위, 오류 집계 기간, 신선도, 근거 ref, 상세 경로의 권위 owner. Queue read 성공만으로 Worker/Queue 전체 정상이나 오류 0건을 만들지 않는다. |
| 필수 Gate·예상 비용·baseline 충돌 | 현재 F-13 projection에 GateResult, 기간별 미래 비용 예측, 범위 내 baseline 충돌의 완전한 owner가 없다. Run BLOCKED와 예약 성공은 각각 Gate 미통과/예상 초과 건수가 아니다. | 실제 owner의 범위·완전성·동일 artifact/environment 결박 후 카드 수치 연결. 그 전에는 `UNAVAILABLE`로 둔다. |
| Critical 확인 | 저장 Alert 조회와 내부 `OperationsService.acknowledge`는 있지만 공개 명령/권한·승인 객체·CSRF/Origin·idempotency·동시성·재조회 계약은 없다. | 서버가 실제 원장 write와 권한을 검증한 결과만 화면에 표시. UI 로컬 상태 변경으로 확인 성공을 위장하지 않는다. |

## 다음 안전 순서

1. 기존 계획 U-01 범위의 Project/Environment와 기간·카드별 owner 계약을 분리한다. 우선 현재 OIDC trust/DB principal의 **인가된 조합**이 실제로 어디서 결정되는지 읽기 전용으로 추적하고, cross-product 추정·권한 확대 없이 단일 current scope부터 계약을 정의한다. 같은 조사를 통해 각 집계의 원본·완전성·시간 경계를 식별한다.
2. 공개 API 또는 인증·권한 계약의 변경이 필요한 절편은 설계/위험 영향을 명시적으로 분류한다. 계획에 있는 U-01을 새 요구로 꾸미지 않되, 승인된 범위 밖의 권한 확대나 데이터 계약 변경을 내부 구현이라고 처리하지 않는다. 영향을 받지 않는 read-only owner 조사와 기존 계약 회귀는 계속한다.
3. 실제 owner가 확인된 절편만 단일 writer의 정확한 WorkInstruction/dual lease로 RED→GREEN 구현한다. 로컬 관련 회귀 후 동일 commit을 private Git→`WSL-server`로 가져와 격리 QA와 정식 WSL 통합/E-API/E-NET/E-SHOT을 구분한다. C30 `OPEN_BLOCKING`, 미검증 Provider/IdP, PG18, 브라우저, 11메뉴/최종 F-20을 수락으로 승격하지 않는다.

## 변경·검증 경계

이 파일은 읽기 전용 source 감사 산출물 1개다. 실제 테스트/브라우저/DB 조회는 이 감사에서 실행하지 않았으며 기존 R37 QA 증거를 재사용해 새 PASS를 주장하지 않는다. 제품 rollback은 불필요하다. 다음 문서화/제품 절편에서도 Event 원시 prefix나 C30 사고 상태를 소급 수정하지 않는다.
