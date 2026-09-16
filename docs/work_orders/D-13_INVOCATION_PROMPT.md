# D-13 Invocation Prompt

`docs/work_orders/D-13_WORK_INSTRUCTION.md`를 읽고 product exact write scope만 수정하라.

TDD로 전체 학습 E2E를 구현한다. 승인 전 행동 불변, 승인 후 다음 Task snapshot 적용, 선택된 Skill/Hook/Prompt provenance, 필요한 ExampleReference만 로드, source revoke 영향 격리, rollback, no-change review, 조건부 DIR-X 판정을 적대 입력과 함께 검증한다. D-01~D-12 owner 계약을 우회하거나 caller self-attestation을 허용하지 않는다.

focused/전체 knowledge+API/compileall/diff-check를 실행하고 `D-13_COMPLETION_REPORT.md`에 실행 명령·수치·미검증 경계·rollback을 기록한다. control/progress/HANDOFF/Git을 수정하지 않는다.
