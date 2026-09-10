# C-21 Workbench UI historical fixture reconciliation 검증

- 기준 HEAD: `d059e043ff642c9f5eb50da8dda8aaa8f4ed8408`
- 변경 범위: test-only 4경로 + append-only record/checker 12경로
- historical evidence/scripts/constants/product mutation: 0
- Developer 동일 lineage: run1 16 failures, run2 4 failures, run3 2 failures; Main takeover
- Main Phase-G focused: 2 tests / OK
- Main historical exact4 focused: 177 tests / OK
- 전체 tooling 1차: `587 tests in 1072.914s / FAILED (failures=2)`; historical temporal test 보완으로 해소
- targeted 재검증: `2 tests in 9.478s / OK`
- 전체 tooling 2차: `587 tests in 1126.738s / OK`, exit0
- 최종 historical exact4: `177 tests in 102.320s / OK`
- 최종 seq584+회귀 targeted: `4 tests in 12.061s / OK`
- live checker: `PASS sequence=584 reporting=AUTO_CONTINUE`
- deterministic regeneration, `git diff --check`, direct in-memory compile: `PASS`
- dirty 경로: exact16 일치; Windows/ordinal hash `4B6FB5B5AEFD4A7CF943A191437A3A31F8EEADED1C96A47A6B8934AAFAB3F4F0` / `E6A1C5BB1C6004DFA22E3342FC41A5C4B455A86EA7A3866549258E5056A95C90`
- postcommit/direct-child/clean: `PENDING`
