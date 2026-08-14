# B-03 R3 WorkInstruction — A13 inner-clone LF determinism

- artifact_id: `WI-B-03-20260814-003`
- package/status: `B-03 / REWORK_IN_PROGRESS`
- executor: `developer-primary-b03`
- baseline_git_commit: `03c0d131693f5479f16aababcce385ca1c46aee6`
- source_tester_report: `docs/test_reports/B-03_RETEST_REPORT_R2.md`
- source_tester_report_sha256: `D41F9D21BF3C92D6BD6C2FDEBDB80C2504E63745103D8655C78DC4F9A978E1C5`
- failure_fingerprint: `BLK-B03-R2-001-CURRENT-CHECKOUT-A13-INNER-CLONE-PORTABILITY`
- valid_failure_count: `1`
- environment: `ENV-LOCAL / TOOLING_ONLY`

## 판정 → 판단 이유 → 조치

**판정: R3 좁은 tooling portability 보완.** 실제 B-03 browser/service/security 증거는 PASS이며 byte-frozen이다. 결함은 current checkout에서 A13 test의 내부 `git clone`이 system `core.autocrlf=true`를 상속하여 successor raw/diff가 달라지는 것에 한정한다.

**판단 이유:** explicit LF clone에서는 tooling `282/282`가 PASS하고, 기능 범위·요구사항·중요 위험은 변하지 않는다. 따라서 system/global Git 설정이나 제품 코드를 바꾸지 않고 clone 호출 자체에 LF checkout 정책을 명시하는 것이 가장 좁은 수정이다.

**조치:** 내부 clone 생성 시 clone-local `core.autocrlf=false`와 `core.eol=lf`를 명시하고, system 설정이 true인 hostile 환경에서도 동일 bytes/hash/diff가 유지됨을 회귀 테스트로 고정한다.

## Developer exact file-level write allowlist (5)

- `scripts/check_a13_repository_scan.py`
- `tests/tooling/test_a13_repository_scan.py`
- `docs/validation/B-03_A13_INNER_CLONE_PORTABILITY_VALIDATION_R3.md`
- `docs/evidence/manifests/B-03_EVIDENCE_MANIFEST_R3.json`
- `docs/completion_reports/B-03_COMPLETION_REPORT_R3.md`

그 밖의 B-03 R1/R2 제품·runtime evidence·Tester report·authority·progress/HANDOFF·Git refs/index는 Developer 수정 금지다.

## 구현·검증 경계

1. baseline/report hash, epoch-3 worker/write fencing token, exact5를 먼저 검증한다.
2. system `core.autocrlf=true`를 상속하는 내부 clone에서 현재 four-code raw/diff mismatch를 RED로 재현한다.
3. clone-local 설정만으로 수정하며 system/global 설정을 쓰거나 제품/runtime를 재구현하지 않는다.
4. default current checkout tooling `282/282`와 explicit LF clean clone tooling `282/282`를 모두 실행한다.
5. design14/domain14/persistence7/browser actual evidence와 R1/R2 manifest/report bytes가 불변임을 확인한다. actual browser/service/security는 재실행하지 않으면 기존 PASS evidence 보존으로 명시한다.
6. exact/raw/self-reference/diff-check와 명령·exit code를 보고한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push/progress/HANDOFF는 수정하지 않는다.

B-03 acceptance와 B-04 시작, API/UI/runtime/provider/WSL/production/deploy는 금지한다.
