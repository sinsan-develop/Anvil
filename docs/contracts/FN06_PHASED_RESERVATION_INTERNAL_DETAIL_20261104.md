# FN06 불변 계획과 단계별 선예약 내부 상세 판정

2026-11-04 · Main 어울 · source-only 상세 보완
부모 직접 채택: FN06_NATIVE_FIRST_RECEIVE_SOURCE_ADOPTION_20261104.md
부모 계상 f8667e17830b60791d769a288ec77c82e34649a952bff9faf4ae688bb32c1597
부모 wire 6d1a727fb60298c4adcc37ce5066b4032f144e6f42b8a0b74f023d8af56e83f4
SOURCE_GO1 / ACTUAL_EXECUTION_GO0

## 판정과 근거

Main은 불변 plan.items의 maxBytes를 수명 전체의 서버 typed ceiling으로, 수치 reserved summary를 현재 단계에서 검산한 actual+필요 remaining으로 구분한다. reserved=sum(plan 전체 ceiling)이라는 등식은 채택 계약에 없으며 새로 강제하지 않는다.

근거는 계상 3절의 실제 fixed intent 기반 N 선예약, wire의 Window 이전/Offer·ARM/native Tx 예약 접점 구분, 계상 11.5의 불변 plan과 별도 가변 수치 summary, 5절의 자기비용 전이다. Primary와 독립 읽기 담당이 같은 단계별 해석을 제시했다. 새 공개 입력·응답·표·열·권한·기한·보관 정책을 추가하는 결정이 아니다. 부모 원문과 hash는 보존한다.

## 전이 계약

1. Window: 원 HUMAN 인증 Tx와 project/account 잠금에서 닫힌 최대 83개 typed slot의 plan/hash를 고정한다. 현재 실제 Window/head/ticket/공통 원장과 종료·거절·불명 유지에 필요한 미래 비용을 효과 전에 확보한다. 아직 없는 원 command/intent의 정확 N 비용을 계산했다고 주장하지 않는다.
2. Offer/ARM: 원문과 실제 서버 current가 확정하는 추가 R/L 복제 및 후속 필요량을 원 인증 Tx에서 추가 확보한다. 공간이 부족하면 실제 행과 효과를 모두 rollback한다. plan/hash는 변경하지 않는다.
3. 원 native Tx: 원 명령/receipt와 writer의 기존 생산 순서를 보존한다. 실제 fixed intent 기반 AUTHORITY/CREATED 및 후속 5개 N 비용을 같은 인증 Tx/project·account 잠금에서 원 native 명령/receipt·writer·credential producer 전에 확보한다. 실제 producer 반환과 현재성이 확보 범위를 벗어나면 거절한다.
4. append/정산: 실제 물리 projection 증가와 해당 slot의 remaining 감소를 동일 Tx에서 처리한다. 불변 행이 채워진 뒤 그 slot의 미발생 비용은 0이며 정상 확정 시 최대치와 실제량의 차이도 정산한다. 가변 행의 미래 표현 증가와 예약행 자기비용은 별도 기존 식으로 남긴다. namespace 전체 ceiling에서 actual만 빼 불필요 hold를 영구 보존하지 않는다.
5. UNKNOWN: 결과 불명은 새 확정 사건으로 꾸미지 않는다. 해당 확보량·실제 원행을 보존하며 재전달·재발급·자동 회수·재실행하지 않는다.

## 구현 검수 조건

- 단계는 실제 Window/Offer/ARM/Binding/terminal 원형과 관계에서 유도한다. caller flag나 새 활성화 열로 선언하지 않는다.
- 불변 ceiling은 각 slot의 가능한 typed 정상 형상을 덮는 식과 테스트 근거를 제시한다. 기존 2MiB command/4MiB event 방어 cap은 그대로 유지하되 이를 모든 slot의 즉시 예약량으로 대체하지 않는다.
- 후속 5개 N의 기존 원식과 ACK v1 차분, 실제 고정 AUTHORITY/CREATED, 실제 복제·escaping·private digest 1547B·자기비용을 누락하거나 중복 계상하지 않는다.
- Window가 준비·종료·거절되거나 연결이 끊겨도 필요한 terminal/audit/hold를 쓸 수 있는지 초기 확보 집합을 닫힌 표로 제출한다. 각 단계 효과 전 부족 거절, 충족 시 동일 Tx 전이, actual/held 역완결 반례를 합성 검증한다.
- plan 고정 후 가능한 producer가 ceiling을 넘으면 기존 입력을 몰래 잘라내거나 ceiling을 덮어쓰지 않는다. 실제 반례와 최소 차이를 Main에 반환한다.
- 기존 collector는 실제 행과 현재 단계에서 계산한 remaining을 대조한다. 오염 account를 전체 재계산 덮어쓰기로 정상화하지 않는다. 단일 writer와 56개 허용 경로를 유지한다.

실제 PG/DDL/RLS/잠금 경합·TLS·native·Agent 검증은 이 판정으로 실행하거나 PASS 처리하지 않는다.