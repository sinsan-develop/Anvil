# C-21 Workbench UI historical fixture reconciliation 보고서

## 판정

`READY_FOR_INDEPENDENT_REVIEW / MAIN_TAKEOVER_COMPLETED`

## 원인

- seq578 전체 tooling 19건 중 collector 1건은 seq578에서 해소됐다.
- 나머지 18건은 과거 checker를 current root에 적용한 시간결합이었다.
- Developer 실행은 16 → 4 → 2 failures로 감소했으나 동일 lineage 3회째 Phase-G 2건이 남아 Main이 인수했다.

## Main 인수

- checkpoint manifest는 commit 직전 raw report 선언을 보존하나 clean `57703ff`에는 그 transient report bytes가 존재하지 않는다.
- current declaration validator로 checkpoint manifest 자체의 signed declaration을 검증한다.
- 108-package 재계산은 `e59c4a105dab0faae31f43fd75e3ac53f1992ffe`, fenced A-02 start는 `2bd88123e93550db5874b479c82d78d4733fd53f` frozen snapshot을 사용한다.
- Main targeted 결과: Phase-G 2/2 PASS, exact4 historical modules 177/177 PASS.
- canonical full tooling 1차는 current-root에 남은 과거 projection/status 테스트 2건을 검출했다. 두 테스트를 해당 historical bundle/generated artifact view로 고정한 뒤 targeted 2/2 PASS를 확인했다.
- canonical full tooling 2차는 `587 tests in 1126.738s`, `OK`, exit0이다.
- 최종 재결박 후 historical exact4는 `177 tests in 102.320s / OK`, seq584와 두 회귀 targeted는 `4 tests in 12.061s / OK`다.
- live checker sequence584, deterministic regeneration, diff-check, direct compile, dirty exact16/path hash가 모두 PASS다.

## 경계

seq584 exact16 커밋과 독립 Reviewer 판정 전에는 통합 완료가 아니다. Provider·Telegram·WSL·ysna·main·push는 실행하지 않는다.
