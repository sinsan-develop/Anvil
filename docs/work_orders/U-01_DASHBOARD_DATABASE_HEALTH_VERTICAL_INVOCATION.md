# U-01 DB 건강 상태 수직 구현 호출

기준: 신산님 2026-10-12 기능 우선 직접 지시, `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`, `U-01_DASHBOARD_DATABASE_HEALTH_VERTICAL_WORK_INSTRUCTION.md`.

단일 기존 Primary Developer는 **Main이 발급한 유효 worker/write dual lease와 서로 다른 fencing token을 받은 뒤에만** 지시서의 허용 경로를 수정한다. 시작 HEAD/branch/dirty 상태·정확 WI/승인 hash·lease 만료와 제품 scope를 먼저 확인한다. 기능은 검증된 요청별 DB 신호를 정확 조합 Dashboard API와 화면의 Database 카드에 연결하는 것에 한정한다. 먼저 정상·DB 장애/migration 불일치·다른 조합/권한 철회의 실패 테스트를 작성해 RED를 확인하고, 최소 수정으로 GREEN을 확인한다. 나머지 건강 5개와 전체 health 완전성은 미확인 상태로 유지한다. 변경 파일·검사 명령/종료 코드·실제 결과·미검증·rollback을 Main에 보고한다. W12 all-pair 진단, DB/권한/Secret/운영 변경, 전체 회귀 반복은 실행하지 않는다.
