# F-20/U-01 C30 복구 후 Dashboard 권위 source 감사

## 판정

`READ_ONLY_SOURCE_BOUNDARY / U01_NOT_ACCEPTED`. C30 Event 사고는 seq2048에서 `RECOVERED_WITH_QUARANTINED_HISTORY`로 검증됐고 WSL-server 동일 SHA G-05/집중11건이 PASS했다. 이 판정은 U-01 Dashboard 수락과 별개다. 이번 감사는 설계 §29.2와 작업계획서 U-01의 남은 계약을 현재 코드와 비교했으며 제품/API/DB/Event/브라우저/WSL 상태를 변경하지 않았다.

## 현행 코드에서 확인한 권위 경계

| 요구 | 확인된 owner와 결선 | 아직 충족되지 않은 조건 |
|---|---|---|
| Project/Environment 선택 | `oidc_process.py`의 trust file은 `scope_project_id`와 `scope_environment_id` 한 조합을 고정하고 `authorization_resolver`와 `OperationsService`에 같은 scope를 준다. `OidcPrincipalBinding`과 `SessionPrincipal`은 각각 project ID 집합과 environment ID 집합만 가진다. | 허용 **쌍** 목록 owner와 선택·재조회 계약이 없다. 두 집합의 cross-product 또는 브라우저 전달 ID를 곧바로 인가 조합으로 인정하면 권한 의미가 넓어진다. 현재 한 조합의 읽기를 다중 필터 완료로 표시하지 않는다. |
| 오늘/7일/30일 | 현행 Dashboard는 현재 시점 snapshot; `PostgresOperationsRepository.load`는 고정 scope의 `operations_audit_events`를 읽지만 기간별 완전성·상한 계약이 아니다. | 기간 boundary/timezone, 원본·누락·분모, 정확한 페이지/집계 owner가 없다. 현재 snapshot이나 Alert 일부를 기간 통계로 표시하지 않는다. |
| 6 Health 카드 | F-13 `HealthSignal`은 `component/state/observed_at/stale_after/error_count/evidence_ref/detail_path`를 요구하며 `project_operations`는 실제 주입 신호가 없으면 `UNKNOWN`/`source_gaps`로 둔다. OIDC loader는 Queue/Budget/Provider 등록 source를 연결하지만 `health_signals`를 주입하지 않는다. `/health/ready`는 별도 DB·migration·runtime ref 준비 여부다. | component별 실제 측정 owner와 시각·오류 수·evidence·열리는 상세 경로가 없다. Queue 조회 성공이나 Provider 등록 9행을 전체 Health `HEALTHY`로 승격하지 않는다. |
| 운영 6카드 | UI는 scoped Run 3상태만 집계하고 나머지는 `UNAVAILABLE`로 표시한다. R38 PostgreSQL Budget read는 실제 budget/reservation 원장 상태를 연결했다. | 필수 Gate 미통과의 동일 artifact/environment, 미래 예상 비용 초과의 예측 기준, baseline 충돌의 범위·완전한 원본이 없다. Run `BLOCKED`나 예약 성공을 다른 세 카드 수치로 바꾸지 않는다. |
| Next Actions/Critical Alerts | 같은 snapshot의 저장 Alert와 고유하게 대응한 action 경과시간은 R32에서 연결됐다. Critical Alert는 저장 조회와 F-13 내부 `acknowledge`가 있다. | Critical 확인의 공개 mutation, 실제 승인 객체·권한, CSRF/Origin, idempotency·동시성·재조회 계약이 없다. UI만 바꾸어 성공을 꾸미지 않는다. |

## 다음 안전한 순서

1. U-01의 현재 고정 scope에서 허용 조합의 server-owned source와 인증 수명·권한 철회 시 재조회 경계를 먼저 명세한다. 현행 단일 조합을 노출하는 read-only 계약과 다중 조합 선택 권위를 구분한다. 공개 API/인가·지속 데이터 계약 변경은 구현 전에 정확한 영향과 비확대 조건을 판정한다.
2. Health는 `HealthSignal`의 각 필드에 대응하는 실제 관측 owner가 있는 component부터 별도 절편으로 연결한다. DB readiness를 대용의 전체 건강 판정으로 사용하지 않고, 측정·상세 경로가 없으면 `UNKNOWN`을 보존한다.
3. 기간/Gate/예상비용/baseline은 bounded·scope·완전성 계약이 정의된 후에만 집계한다. Source가 불완전할 때의 화면은 `UNAVAILABLE`이다.
4. Critical 확인은 별도 명령/감사/인가 계약을 fail-closed로 정의하고 독립 검증한다. Local 개발→private Git 정확 SHA→WSL-server PG15/OIDC/HTTPS/Chromium, E-API/E-NET/E-SHOT을 분리해 기록한다.

이번 감사의 신규 테스트와 실제 DB·브라우저 실행은 0건이다. 기존 R41 또는 C30 PASS를 새 U-01 PASS로 계산하지 않는다. F-20/U-01 미수락, ReleaseDecision `DEFER`, Production/`ysna-server` 미검증, 같은 작업 branch 유지.
