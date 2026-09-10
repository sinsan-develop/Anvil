# C-21 Post-merge Development Authority Reconciliation WorkInstruction

- Work Package: `C-21`
- Step: `POSTMERGE-DEVELOPMENT-AUTHORITY-RECONCILIATION`
- Executor: `developer-primary`
- Baseline: `931b32418924de11626949b9303360696d614fb0`
- Status: `ACTIVE`

## 목적

병합 후 삭제된 작업 브랜치를 활성 Git 권위로 요구하는 seq699 checker 결함을 append-only seq700 successor로 교정한다. 개발 정본은 `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 `main`이며, 병합된 작업 브랜치는 재생성하지 않는다.

## 불변 경계

- seq1~699 event object bytes와 historical evidence를 변경하지 않는다.
- C-21 `MAIN_PACKAGE_ACCEPTED`, C-01 `READY_FOR_WORK_INSTRUCTION`, DIR-2 `NOT_REACHED`를 유지한다.
- Provider와 Telegram 실제 외부 검증은 `USER_OWNED_NOT_EXECUTED`로 유지한다.
- 네트워크, WSL, Docker, DB, 배포, push, PR, merge, branch 삭제를 실행하지 않는다.

## 구현·검증

- seq700 event type은 canonical `REPOSITORY_RECONCILED`, status/decision은 `DEVELOPMENT_MAIN_AUTHORITY_RECONCILED`다.
- baseline merge와 acceptance lineage를 exact commit/parent/ancestor로 검증한다.
- precommit, feature direct-child postcommit, development-main merge 상태만 허용한다.
- 삭제된 candidate ref 존재는 요구하지 않는다.
- exact12 외 경로 변경을 거부한다.
- TDD RED, focused GREEN, checker CLI 결과와 미실행 범위를 기록한다.
