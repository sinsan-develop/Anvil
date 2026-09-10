# C-21 A13 historical module isolation validation

## 검증 계약

1. 기존 seq1~596 raw event prefix를 byte-identical로 보존한다.
2. historical checker node 2개를 같은 process에서 순차 실행한다.
3. 각 node 종료 후 `packages` 및 `packages.repository_intelligence*` module identity와 `sys.path`를 exact 복원한다.
4. context 내부 강제 예외 후에도 동일 상태를 exact 복원한다.
5. 변경은 test harness와 successor evidence에 한정하며 제품 코드를 수정하지 않는다.
6. exact13, validated-base cumulative exact201, parent direct-child 및 clean postcommit을 검증한다.

## 판정

- A13 suite: `65 passed`.
- 전체 tooling: `597 passed`.
- C-21 acceptance, C-01, DIR-2 상태는 변경하지 않는다.
