# C-21 Post-merge Development Authority Reconciliation Result

## 판정

`COMPLETED`

## 기준선과 범위

- branch: `codex/c21-postmerge-authority-reconcile`
- baseline: `931b32418924de11626949b9303360696d614fb0`
- 변경 허용: WorkInstruction의 exact12
- seq1~699/historical evidence: 불변

## TDD RED

- 명령: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k seq700`
- 결과: exit 1, `3 failed, 306 deselected`
- fingerprint: `SEQ700_BUILDER_COLLECTOR_ABSENT_R1`
- 동일 근본 원인 정식 실패 횟수: 1
- 원인: seq700 metadata/builder/validator/collector/dispatcher가 아직 존재하지 않음

## 미검증·외부 경계

- focused GREEN: `4 passed, 306 deselected`, exit 0
- checker CLI: `G-05 project progress contract: PASS sequence=700 reporting=AUTO_CONTINUE`, exit 0
- 보완 오류: `SEQ700_COMMON_EVENT_HANDOFF_CONTRACT_MISMATCH_R1` 1회; canonical repository payload와 HANDOFF status 정합화 후 해소
- 환경 오류: D:\tmp generated-file write 권한 거부 1회; 시스템 승인된 동일 generator 재실행으로 해소, 정식 failure 미산입
- Provider/Telegram actual: `USER_OWNED_NOT_EXECUTED`
- network/WSL/Docker/DB/deploy/push/PR/merge/branch delete: `NOT_EXECUTED`

## 구현 결과

- seq700 `REPOSITORY_RECONCILED`와 `DEVELOPMENT_MAIN_AUTHORITY_RECONCILED` 상태를 append했다.
- 개발 권위는 `refs/remotes/development/main`으로 전환했고 삭제된 candidate ref 의존은 제거했다.
- baseline merge parent, acceptance feature/record parent 및 ancestor chain을 fail-closed 검증한다.
- precommit exact12, clean direct-child feature commit, exact two-parent development-main merge만 허용한다.
- seq1~699 raw event object prefix와 C-21/C-01/Provider/Telegram 경계를 보존한다.

## 독립 리뷰 재작업 1/5

- finding I1: merged-main upstream이 `origin/main`도 허용됨
- 조치: merged-main은 exact `development/main`만 허용하고 `origin/main`은 `C21_POSTMERGE_AUTHORITY_BRANCH_OR_UPSTREAM_INVALID`로 거부
- finding I2: precommit에서 unstaged/untracked exact12가 cached whitespace 검사 밖에 남을 수 있음
- RED: `1 failed, 3 passed, 306 deselected`, exit 1; `SEQ700_REVIEW_R1_PRECOMMIT_INDEX_INCOMPLETE` 1회
- 조치: cached path exact12, unstaged empty, untracked empty, status path exact12, cached diff-check PASS를 모두 요구
- GREEN: `4 passed, 306 deselected`, exit 0
- review round: `1/5`; Important finding 2건 조치 완료, 독립 재검토 대기
- actual staged checker: exact12 staged, unstaged 0, untracked 0, cached diff-check PASS
- final checker: `PASS sequence=700 reporting=AUTO_CONTINUE`, exit 0
- history prefix: `2155312` bytes / `209446EEDCAE056F25E788701A0E12D76B487EBD20D52644C14D151FAC0C1D83`

## 독립 재검토 재작업 2/5

- finding I1: precommit negative가 여러 조건을 동시에 변조해 각 fail-closed 조건의 독립 증명이 부족함
- 조치: table/subTest로 cached exact12 1개 누락, unstaged nonempty, untracked nonempty, cached diff-check nonzero를 각각 하나만 변조
- 결과: 기존 production collector가 네 조건을 이미 독립 거부하여 production RED 없이 즉시 GREEN, `4 passed, 306 deselected`, exit 0
- 기존 status path mismatch negative는 별도로 유지
- 명령 구성 오류 1회: 최초 실행이 잘못된 workdir/불필요 token으로 중단; 제품·target worktree 파일 mutation 0, 정식 failure 미산입
- review round: `2/5`; Important test-gap 1건 조치 완료, 독립 재검토 대기

## 전체 tooling 재작업 3/5

- Main fresh tooling: `681 passed, 3 failed in 1155.62s`
- focused RED: 세 exact node `3 failed`, exit 1
- F1 fingerprint/count: `SEQ488_HISTORICAL_FIXTURE_CURRENT_REPOSITORY_MIX_R1` / 1회. current seq700 repository copy의 projection residue를 제거하고 explicit frozen seq488 repository fixture로 교체; seq488 production 조건 완화 0
- F2 fingerprint/count: `SEQ700_VALIDATED_BASE_REASON_CODE_REGRESSION_R1` / 1회. seq700 collector 시작에서 projected validated base exact 검증과 `GIT_VALIDATED_BASE_NOT_ANCESTOR` reason을 복원하고 전용 regression 추가
- F3 fingerprint/count: `SEQ699_HISTORICAL_FIXTURE_CURRENT_REPOSITORY_MIX_R1` / 1회. seq699 collector test에 exact historical repository fixture를 명시; seq699 production 조건 완화 0
- 세 exact node GREEN: `3 passed`, exit 0
- seq700 focused: `4 passed, 306 deselected`, exit 0
- checker: `PASS sequence=700 reporting=AUTO_CONTINUE`, exit 0
- exact12 staged/unstaged/untracked: `PASS / 0 / 0`; cached diff-check PASS; determinism/history PASS
- 테스트 node class 이름 오기 1회: collection exit 4, 실행 test 0, 파일 mutation 0, 정식 failure 미산입
- full tooling 재실행: Main 책임으로 미실행
- review round: `3/5`; 독립 재검토 대기

## 최종 독립 검토·전체 tooling 마감

- 독립 review round 3: `PASS`, findings `Critical 0 / Important 0 / Minor 0`
- Main restricted sandbox full tooling은 `D:\tmp` 임시 디렉터리 생성 권한으로 A14 `tempfile.mkdtemp` 노드에서 `61.8분` 정체하여 중단했다. fingerprint/count: `TOOLING_TMP_SANDBOX_PERMISSION_R1` / `1회`.
- 위 정체는 제품·checker·round3 회귀가 아닌 실행 환경 권한 오류다. valid product/checker failure count는 증가시키지 않았다.
- read-only 진단: escalated A14 exact node `1 passed in 5.35s`; A01~A13 `193 passed in 119.04s`.
- Main escalated full tooling: `684 passed in 1113.60s (0:18:33)`, exit `0`.
- Main checker CLI 인자 오류: `python scripts/check_project_progress.py --root .`는 positional root 도구에서 `LOAD_ERROR ...\--root\docs\progress\build-progress.json`로 실패했다. fingerprint/count: `CHECKER_CLI_POSITIONAL_ROOT_INVOCATION_R1` / `1회`; 제품/checker valid failure count는 불변이다. 정확한 `python scripts/check_project_progress.py .`는 `PASS sequence=700 reporting=AUTO_CONTINUE`다.
- 최종 evidence rebind 직후 검증: seq700 focused `4 passed, 306 deselected`; checker `PASS sequence=700 reporting=AUTO_CONTINUE`; deterministic generated5·manifest checksum 11행·seq1~699 raw prefix 보존 PASS; exact12 staged, unstaged/untracked 0, cached diff-check PASS.
- 최종 판정: seq700 구현·회귀 보완·독립 review·전체 tooling이 모두 통과했다. Provider/Telegram actual과 외부 action은 기존 경계대로 미실행을 유지한다.
