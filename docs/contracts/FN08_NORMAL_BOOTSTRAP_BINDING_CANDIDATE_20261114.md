# FN08 최초 교환 근거 전달 보완 후보

상태: 채택(2026-11-14 신산님 직접 A안 응답 계약·source 구현 채택). 승인 대상 원문 SHA256 088F70582AC5666F108AB164804A408BAC2C0B1DD63D1F019F130E2966A36327. 작성 Main 어울, 2026-11-14. 기준 main418d70ca, P3 D1 §3.1 단계3.

## 필요한 변경과 이유
기존 최초 challenge 응답에는 실행 세대·등록·credential 예약 근거가 없다. HUMAN START 응답의 reservationRef는 예산 예약이므로 대신 사용할 수 없다. 현재 source 구현의 보호 저장·사용은 계속하되 caller 선언을 검증된 권위로 승격하지 않는다.

## A안 — 기존 최초 challenge 응답 한정 확장(권장)
새 endpoint/권한을 만들지 않고 기존 normal-exchange-challenge 응답에 bootstrapBinding을 추가한다. 정확 필드는 projectId, connectorId, executionId, executionGeneration, grantRef, credentialGeneration, scopeDigest, registrationRef, reservationRef, publicKeyFingerprint, checkedAt, expiresAt이다. 실제 credential나 HUMAN/session/source 원문은 포함하지 않는다.

- 동일 거래에서 기존 readCurrent와 정확 execution_credentials 예약 행을 검산해 구성한다. caller 필드를 복사하지 않는다. reservationRef는 credential 예약의 id/version/hash이며 예산 예약과 구분한다.
- 해당 challenge/ref·grant·generation·target에만 결박한다. expiresAt은 challenge와 현재성 deadline의 최솟값 이내이며 checkedAt은 서버 검산시각이다.
- native owned host가 고정 origin/TLS 경로로 직접 받은 응답만 사용한다. JS 객체 모양만으로 권위를 부여하지 않는다. 현재 REGISTERED connector/registration/key fingerprint와 정확히 대조한다.
- 서명/교환/보호 저장 전후 peer/root/current/deadline을 유지한다. projection은 실행 허가가 아니다.
- 같은 challenge 재응답은 현재 검산 뒤 동일한 불변 binding을 요구한다. checkedAt은 현재 검산시각으로 갱신될 수 있지만 기한은 원 challenge와 현재 deadline을 넘지 못한다. 불변 binding 변경/기한 역전/누락은 거절한다. 결과 불명 시 자동 재발급하지 않는다.
- 기존 exact schema 소비자와 시험을 함께 변경한다. 일반 GET/POST·발급 once-only·기존 권한은 유지한다. 기존 사용자에게 정책을 부여하지 않는다.

## 다른 선택
B: HUMAN START 응답에 추가. UI→owned host 전달과 오래된 응답의 현재성 검사가 필요하고 변경 범위가 더 크다.
C: 신규 bootstrap 조회 endpoint. 별도 route/proof/rate-limit/replay 계약이 필요해 중복과 검증 비용이 더 크다.

## 구현·검수 범위
서버 normal-exchange-challenge.ts, 현재 조회의 credential 예약 검산 필요분, 최초 challenge 응답 시험/fixture, 신규 bootstrap client/native 검산 및 owned-host dispatch의 코드·합성 시험만. 새 저장표/실제 SQL 적용은 포함하지 않는다. 현재 readonly 조회로 검산할 수 없는 경우 확대하지 않고 보고한다.
정상 최초교환, 다른 실행 세대/credential 예약/등록/fingerprint 거절, 응답 이후 회수·만료, 잘못된 origin/TLS, 누락·추가필드, 재응답 불변결박, 유실/저장불명 UNKNOWN을 검사한다. 검증되지 않은 source를 실제 실행 완료로 표시하지 않는다.

## 제외·복구
실제 DB·권한·키·보호 파일·서비스·Agent·native 컴파일과 동일grant 갱신은 제외한다. 이번 후보는 기존 source 승인에 없던 공개 응답과 권위 전달 의미의 결정만 요청한다. 미채택이면 기존응답을 유지하고 해당 연결은 미완료다. 적용 source의 일반 revert가 복구 수단이며 실제 환경 전환은 하지 않는다.
