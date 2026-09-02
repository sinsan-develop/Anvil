# C-21 progress reconciliation Main takeover

- 일시: 2026-09-03 KST
- 담당: Main Agent 어울
- 상태: `WAITING_EXPLICIT_HISTORY_REPAIR_APPROVAL`
- 기준 브랜치: `codex/c21-progress-reconcile`
- 기준 HEAD: `52fa9f56c94a950056385fdb844b23e08e40f820`
- 반복 오류: 동일 append-only projection 관리 오류 3회. Developer Subagent 추가 지시를 중단하고 Main Agent가 인수했다.
- 독립 검증: JSON Schema PASS, project progress checker PASS(sequence 385), progress tests 82 PASS. 다만 checker 밖 의미 검토에서 병합 차단 3건을 확인했다.
- 병합 차단:
  1. 후속 R3 작업에서 sequence 380의 `exact_allowed_paths`가 소급 변경됐다.
  2. top-level reporting reason code가 실제 승인 대상보다 넓다.
  3. WorkPlan non-semantic binding이 실제 한 줄 교체를 세 줄로 잘못 기술한다.
- Main 조치: sequence 380을 이미 검증된 commit `8a1815f`의 byte-equivalent payload로 복원하는 patch를 시도했으나, append-only 이력 mutation 안전 정책이 사용자 직접 승인을 요구하여 중단했다. 우회 편집은 수행하지 않았다.
- 필요한 승인: 아직 main에 병합·push되지 않은 작업 브랜치의 sequence 380 payload를 `8a1815f` 상태로 정확히 복원하고, 나머지 두 문구를 정정한 뒤 새 sequence로 reconciliation을 append하는 작업.
- 미검증/미수행: main 병합, push, Stage4 main projection, 배포, 외부 호출 모두 미수행.
- 승인: 2026-09-03 신산님이 미병합·미push 브랜치의 sequence 380을 `8a1815f` 상태로 복원하고 승인 경계·WorkPlan 설명을 정정한 뒤 새 reconciliation Event를 append하는 작업을 명시 승인했다.
- 인수 조치: Main Agent가 sequence 380을 `8a1815f`와 byte-equivalent payload로 복원하고, reporting reason code를 실제 lifecycle runtime·production side-effect 승인 범위로 한정했으며, WorkPlan diff 설명을 실제 1개 상태 문구 교체로 정정했다.
- 다음 조치: 이 복원 기준을 커밋한 뒤 새 append-only repository reconciliation Event와 manifest/digest/HANDOFF를 결박하고 checker/schema/82 tests/독립 리뷰를 재실행한다.
