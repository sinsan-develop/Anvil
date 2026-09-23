# E-04 실행

E-04_WORK_INSTRUCTION.md를 읽고 그 exact12 제품 및 exact9 control 범위에서만 단일 writer로 수행한다. baseline/seq1091/dual fence 확인 후 append-only start control을 RED→GREEN으로 생성하고 제품 TDD를 수행한다. E03 Minor2는 historical 수정 없는 successor correction, Minor1만 제품 선행 보완이다. 기존 queue/lease owner를 재사용하며 실제 DB 증거와 contract 테스트를 구분한다. 공유 DB migration apply, worker/Provider/UI 실행, commit/push/acceptance/E05는 금지한다. 질문으로 지연하지 말고 허용 범위 구현·검증·완료보고 후 구조화 결과로 반환한다. scope/권위 충돌이나 실제 DB blocker는 Main에 정확히 보고한다.
