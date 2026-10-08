# F-20/U-01 R10 Dashboard 읽기 API 계획

## 목적과 현재 경계

승인된 U-01 Dashboard 수직 구현 중 실제 Operations read model을 인증된 same-origin API로 전달하는 한 단위다. R9의 `OperationsService.snapshot()`은 내부 host에서만 호출되고 공개 Dashboard route는 아직 없다. 이 계획은 UI·다른 Project/Run/Agent/Provider source 연결과 전체 U-01 수락을 주장하지 않는다.

## 계약

- `GET /api/dashboard/operations`를 기존 canonical API registry와 `OperationsPort`에 읽기 route로 추가한다. 새 `dashboard:read` 최소권한 permission을 요구하며 기존 alert/audit permission만으로는 확대된 snapshot을 읽지 못한다. 요청의 인증된 project/environment를 trusted owner와 정확히 대조한다. 브라우저는 same-origin 상대 경로만 쓴다.
- 응답은 현재 `OperationsService.snapshot()`의 명시적 필드(`observed_at`, `health`, `queue`, `quarantine`, `worker`, `budget`, `reservations`, `providers`, `deployments`, `source_gaps`, `alerts`, `next_actions`)에 한정한다. 실제 연결되지 않은 source는 `UNKNOWN`/gap이며 빈 배열을 건강·성공으로 해석하지 않는다. payload·credential·fencing token 및 SQL/driver 오류를 노출하지 않는다.
- Queue legacy NULL, 100건 초과, DB 장애 또는 owner 오류 시 완전한 빈 성공 응답을 내지 않고 안정 코드의 503으로 fail closed한다. GET는 `detect()`나 audit/Queue mutation을 실행하지 않는다. 기존 GET `/api/operations/alerts`·`audit` 계약은 유지한다.

## 구현·검증 단위

예상 제품 범위는 `packages/api/registry.py`, `packages/api/operations.py`, API/ASGI 계약 테스트, R10 결과보고서다. 착수 전 Main이 정확한 WorkInstruction·제품 경로·canonical dual lease와 G-05를 확정한다. 단일 Developer는 로컬 TDD RED→GREEN 및 registry/authorization/오류/secret/GET 무변경 회귀를 수행하고 Main은 diff 독립 검토, 사설 push, WSL-server 동일 SHA 실제 PG15/API 검증을 수행한다. 정식 브라우저 E-SHOT/E-NET과 Dashboard UI는 다음 U-01 단위로 남긴다.

## 제외

기존 권한의 암묵적 확대, DB schema/migration, Secret 변경, Worker/Budget/Provider source 신규 연결, UI, ysna-server/Production, main 병합/신규 branch는 제외한다. R10 내부 API PASS는 U-01/F-20 수락이나 C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER` 해제를 뜻하지 않는다.
