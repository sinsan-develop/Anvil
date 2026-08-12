# A-14 Revision 3 Developer Invocation

`docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R3.md`를 유일한 작업 범위로 실행하라.

먼저 권위 문서, progress/HANDOFF, source Tester R3 report와 epoch-3 worker/write lease를 확인한다. exact write paths 밖은 수정하지 말고, 두 Main evidence-only 문서와 제품 불변 경계를 지킨다. R3 각 finding마다 RED를 재현한 뒤 최소 수정으로 GREEN을 만들고, 실제 Codex in-app browser 재검증을 포함한 완료 증거를 제출한다. fixture/static 결과를 production 또는 실제 Provider PASS로 승격하지 않는다. commit/push/deploy/DIR/A-15는 금지한다.
