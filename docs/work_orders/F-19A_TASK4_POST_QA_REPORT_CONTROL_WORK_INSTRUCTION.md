# WI-F19A-TASK4-POST-QA-REPORT-CONTROL-20261008-001

## 판정·권한

Main의 F-19A Task4 WSL-server 실측 후 통제 rework다. 승인된 기능 범위·요구사항·중요 위험은 변경하지 않는다. 부모 승인 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md` SHA256 `ADF11125667CA6C374F31462D2ABD7D55C425D7A86019CB7A8D4B9BA8D0A0AF5`, Spec SHA256 `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`, Plan SHA256 `0CD8309E3FD8C7F507281BF6094D6BA696973FB5AA12F27023E57E1DA51CA26E`를 보존한다. 기존 epoch85 lease는 seq2212→2213 회수·활성 null이다. `codex/f18-wsl-ops` 단일 branch만 사용하고 Main이 새 epoch86 worker/write dual lease를 결박하기 전에는 코드 write 금지다.

## 근거와 고정 대상

부모 exact local/private clean `1b6629fa9150eb48d9ed6ebe66a4c6e33b6db8ec`. epoch85 종료 route는 후속 문서 경로를 `docs/WORK_STATUS.md` 등 5개로 한정한다. WSL 실측 보고서 `docs/04_test_reports/F-19A_TASK4_WSL_QA_REPORT.md`를 commit `1b6629fa9150eb48d9ed6ebe66a4c6e33b6db8ec`에서 추가하면서 `F19A_TASK4_ISSUER_CLOSE_GIT_INVALID`가 발생했다. 보고서 SHA256 `5C0D7819BDDBDCE83AB51AF4782BD3501CA240151BFD974614B5A02DA75124CB`, Git blob `103aaa7c4ebececa02caaa3341696a87230bc312`에 정확히 결박한다. 문서 내용·브랜치 clean/private는 보존하고 history rewrite·force push·보고서 삭제로 우회하지 않는다. 기준 Event seq2213 원문과 기존 epoch85 close 증거도 수정하지 않는다. F-19A 미수락, Release DEFER, Production NOT_EXECUTED다.

## Developer 정확 scope

단일 `developer-primary-f19a-pair-grant`의 code path scope는 정확 2개: `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py`. Product write scope는 0이다. Main만 이 WI, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/progress/BUILD_HANDOFF.md`, detached digest, `docs/WORK_STATUS.md`, Git checkpoint·push를 쓴다. Developer는 WSL-server/DB/브라우저/Compose·제품 파일·보고서를 쓰지 않는다.

## 실행·검증 계약

1. 새 epoch86 active/closed G-05 projection에서 부모 exact SHA·원문 seq1~2213·WI hash·분리된 24시간 worker/write fencing token·정확 scope·local/private Git/clean/조상/비merge 이력을 fail-closed로 검증한다. 이번 후속 보고 경로 **한 개**만 기존 종료 문서 목록에 추가하되 그 보고서의 역사적 추가 commit과 내용 SHA를 부모에 결박한다. 임의 `docs/04_test_reports/*`, 다른 보고서·코드 경로, 보고서 교체·삭제·과거 rewrite를 허용하지 않는다.
2. TDD RED→GREEN: 기존 부모 상태가 `F19A_TASK4_ISSUER_CLOSE_GIT_INVALID`임을 먼저 재현한다. 새 active A, code C, docs B, write→worker 종료 후보 각각 정상/위조 fixture를 둔다. 부모 보고서 경로·blob·Git history 불변성을 확인하고, 같은 branch의 무관 dirty/remote 불일치/merge commit/다른 report path와 과거 Event·lease·digest 변조를 거절한다. 역사 epoch85 A/B/closed fixture의 기존 기대를 완화하거나 원문을 수정하지 않는다.
3. `tests/tooling/test_f19a_start_projection.py` 집중·역사 전체, `python scripts/check_project_progress.py`, `git diff --check`, Ruff 신규0 및 인접 통제 회귀를 실행한다. Main의 독립 C0/I0/M0 리뷰와 정확 C checkpoint/private→B 문서 결박/private/clean→write→worker 회수→종료 후 G-05·집중 재실행 전 다음 제품 rework·WSL QA를 시작하지 않는다. 실행하지 않은 검증은 미검증으로 기록한다.

이 WI는 QA 보고 이력의 통제 복구만 수행한다. Worker OIDC head0020 호환성, `other-actor` 브라우저 기대 403 정합화, 기존 GET/alerts/ACK·DB 장애 실제 QA는 이 epoch 밖의 다음 WI에서 다룬다.
