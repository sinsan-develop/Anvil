# F-03 merged-main canonical reconciliation

- 판정: `IN_PROGRESS`; PR #18 merge commit `950bc8375fb19a76788f24e492112d68043ed596`의 구조적 검증을 추가한다.
- 원인: F-03 final checker가 work branch post-commit만 허용해 정상 2-parent merged main을 거부했다.
- 검증: first parent=pre-merge main, second parent=exact feature head, base ancestry, exact9 reconciliation paths, feature/main tree equality. SHA는 최종 feature commit으로 하드코딩하지 않는다.
- 제품·Provider·DB·WSL·browser·deploy 변경 및 재실행은 없다.
