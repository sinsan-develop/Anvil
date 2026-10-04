# F-20/U-01 R39 Dashboard 현재 범위 계약 검토

## 판정

`CURRENT_SCOPE_OWNER_CONFIRMED / MULTI_PAIR_AUTHORITY_ABSENT / U01_NOT_ACCEPTED`.
기준은 R38B close seq2040, worker/write lease 없음, 기존 `codex/f18-wsl-ops`이다. 이 검토는 read-only이며 제품·공개 API·권한·DB·Event·브라우저·WSL 자원을 변경하지 않는다. C30 `OPEN_BLOCKING`과 ReleaseDecision `DEFER`를 유지한다.

## 확인된 권위와 누락

- 설계 §29.2와 계획 U-01은 Project/Environment 필터, 오늘·7일·30일 기간, 실제 source와 맞는 Dashboard를 요구한다.
- `oidc_process.py`의 trust는 별도 `allowed_project_ids`와 `allowed_environment_ids`, 그리고 **단 하나의** `scope_project_id`/`scope_environment_id`를 검사한다. 현재 OIDC host는 그 한 쌍으로 `AuthorizationScope`, `OperationsService`, Queue·Run·Agent·Budget source loader를 고정한다. 각 loader는 다른 쌍을 거부한다.
- `OperationsPort`는 인증된 요청의 project/environment와 고정 owner가 일치하는지 먼저 검사한다. 현재 `GET /api/dashboard/operations` 응답에는 그 검증된 쌍이 없고, Web `App.tsx`는 `Environment · NOT CONNECTED`를 고정 표시한다. Web의 응답 파서는 정확한 필드 집합을 검사한다.
- principal의 Project ID 집합과 Environment ID 집합은 각각 membership만 표현한다. 허용 **쌍** 목록의 권위 owner는 없다. 두 집합의 곱집합을 선택지로 만들면 미인가 조합을 노출한다. 저장된 Alert의 scope나 `/api/projects/scan` 결과도 전체 인가 조합 목록을 증명하지 못한다.
- `OperationsService`의 current scope 내부 값은 확인 가능하지만, 이를 Web에 전달하려면 기존 공개 Dashboard 응답에 필드를 추가하거나 별도 공개 read endpoint를 만들어야 한다. 기존 문서의 “U-01 API/BFF” 범위 안에서 기능 목적은 같아도, 이는 **공개 API 계약 변경**이다. 새 인증 정책이나 다중 쌍 권한 확장은 이 검토 범위가 아니다.

## 다음 구현 경계

현재 한 쌍을 표시하는 최소 변경이라면 기존 `GET /api/dashboard/operations`의 인증·scope 검사를 통과한 뒤 서버 소유 `authorized_scope={project_id,environment_id}`만 응답에 추가하고, Web의 정확 필드 검증·타입·고정 범위 표시·회귀를 함께 수정할 수 있다. 인증 전이나 401/403/503 응답에는 범위 값을 싣지 않는다. 브라우저가 보낸 Project/Environment ID로 조회 owner를 바꾸거나 허용 집합의 곱집합을 만들지 않는다. 이 결과도 “현재 범위 표시”일 뿐 다중 Project/Environment 필터 완료가 아니다.

이 경로는 공개 API 변경이므로 공통 AGENTS §5의 별도 승인 경계를 따른다. 별도 승인 전에는 제품 write lease를 발급하거나 API·Web 코드를 변경하지 않는다. 안전하게 병행 가능한 다음 작업은 현재 범위·기간·Health/Gate/forecast/baseline 원본의 완전성 계약을 read-only로 좁히고, 이미 계획된 비공개 source의 독립 검증을 수행하는 것이다. 별도 승인 대상은 위 응답 필드 하나와 Web 표시 계약인지, 또는 다중 쌍 선택까지 포함하는지 정확히 구분해야 한다.

## 기간·운영 카드의 현재 완전성

| 요구 | 현재 source | 판정 |
|---|---|---|
| 오늘/7일/30일 | `OperationsService.snapshot()`은 현재 `observed_at` 시각의 값이며 `alert_page()`는 최대 페이지의 저장 Alert만 조회한다. 기간 전체를 선언한 원본·누락/표본/시간대 계약은 없다. | 기간별 수치는 `UNAVAILABLE`. 현재 snapshot을 오늘 집계로 재명명하지 않는다. |
| Health 6종 | `OperationsSources.health_signals`는 선택 입력이고 `oidc_process.py`의 현재 source loader는 이를 넣지 않는다. `project_operations()`는 누락을 `UNKNOWN`과 source gap으로 투영한다. Queue 행 조회나 DB readiness만으로 여섯 컴포넌트의 last check·오류 수를 증명하지 않는다. | 기존 정직한 `UNKNOWN` 유지. 각 컴포넌트의 관측 owner와 freshness/evidence 계약이 필요하다. |
| 필수 Gate 미통과 | `ReleaseGateService`의 현재 in-memory 결과와 EvidenceManifest 단일 객체는 고정 Project×Environment의 전체 대상·기간 source가 아니다. | 완전한 GateResult owner 확인 전 수치 `UNAVAILABLE`. |
| 예상 비용 초과 | R38의 새 PG15 검증된 scoped Budget source는 지속 ledger/reservation의 현재 상태와 원장 격리를 증명한다. 거부된 미래 예상 비용 요청의 지속 영수증·기간별 모집단은 증명하지 않는다. `new_action_allowed=false`도 비용 초과와 quota/미확정 usage를 구분하지 않는다. | R38 PASS를 이 카드의 0건/초과 건수로 승격하지 않는다. |
| baseline 충돌 | `/api/projects/scan`은 단일 설정 repository의 현재 scan이며 Dashboard scope의 전체 baseline 충돌 원장과 완전성 owner가 아니다. | 범위 내 전체 source 전까지 `UNAVAILABLE`. |
| Critical 확인 | 내부 `OperationsService.acknowledge`는 있으나 Web/API의 인증·CSRF/Origin·idempotency·동시성 계약을 통해 아직 노출되지 않는다. | UI 로컬 확인을 원장 write 성공으로 표시하지 않는다. |

따라서 현재 구현에서 **계획 완료 판정은 불가**하다. 위 누락 중 하나를 0이나 정상으로 위장하는 우회는 허용되지 않는다. 다음 비공개 작업은 각 소스의 원본·범위·모집단·시각·오류 경계를 읽기 전용으로 검증해 WorkInstruction을 작게 나누는 것이다.

## 검증·미검증

이번 판정은 설계·작업계획서와 현행 `oidc_process.py`, `OperationsPort`, `OperationsService`, Web `App.tsx`의 정적 대조다. 실제 IdP, Provider, 브라우저, PG18, 전체 U-01, F-20, Production PASS를 주장하지 않는다. 제품 rollback은 불필요하다.

## 전체 회귀 후속 통제 점검 (2026-10-04)

WSL-server exact `f33028b3` 전체 비-opt-in pytest는 `8587 passed/225 failed/123 skipped`(exit1)였다. 격리 clone의 history ref 누락이 실패 다수의 공통 원인이었고, 원격 heads/PR 참조와 정확 C21 sibling commit만 fetch한 뒤 역사 통제 파일 전체는 `689 passed/1 failed`(exit1)로 좁혀졌다. 남은 1건은 현재 R38B CLOSE validator가 위조 progress를 `F20_U01_R38B_CLOSE_PROJECTION_INVALID`로 거부하는데 테스트의 step별 기대 표에 CLOSE 항목이 없어 START 오류를 기대한 것이다. Main 소유 현재 투영 테스트에 CLOSE 기대 3종만 추가했고 로컬 해당 node `1 passed`, 인접 R38B start/close 포함 `7 passed`, G-05 seq2040 PASS를 확인했다. 원장·checker·제품·권한·API 변경은 없다. 이는 전체 suite 재실행의 PASS가 아니다.

A14 browser source 1건은 `App.tsx`가 Alert 입력의 내부 주소를 거부하려는 정규식에 `localhost`/loopback 패턴을 포함한 것을 역사 A14 checker가 실제 내부 API 주소로 오인한다. checker/test의 임시 보완은 새 반례 RED→4 GREEN, 전체 파일 15 PASS였으나, 두 파일이 역사 A14 EvidenceManifest checksum 대상임을 재확인해 **우리 변경을 정확히 되돌렸다**. 되돌린 HEAD 기준 A14 CLI는 기존 `apps/web/server.mjs` 및 역사 테스트 파일 checksum과 현재 오탐으로 FAIL이다. 역사 manifest를 고쳐 PASS로 꾸미지 않으며, 이 경계는 별도 successor authority·보안 회귀를 갖춘 수정 대상으로 남긴다. A14/API/브라우저 인수는 미검증, C30 `OPEN_BLOCKING`·ReleaseDecision `DEFER`, F-20/U-01 미수락이다.
