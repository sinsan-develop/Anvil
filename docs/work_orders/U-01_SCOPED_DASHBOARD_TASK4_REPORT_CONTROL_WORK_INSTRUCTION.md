# WI-U01-SCOPED-DASHBOARD-TASK4-REPORT-CONTROL-20261009-001

## 판정·기준선

신산님 승인 계약 B `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md` SHA-256 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`, 승인 기록 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md` SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`, 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` SHA-256 `002977BDB7B634E974E4926F1FA52D6DC520450F92EBE64AB490EE6BD773C8C3`의 Task 4 문서 통제만 보완한다. 기존 단일 branch `codex/u01-dashboard-r2`에서 Task3 H `95d79d9bed1187d1480e3f341984827a19028d40`은 G-05 seq2304 PASS였고, 직접 후손 R `1b732d79780d2ba986530f12db5baa183c690dda`는 정확 6문서의 미실행 결과보고다. R local/private 원격 동일·clean이나 현재 G-05는 `U01_TASK3_CLOSE_GIT_INVALID` exit1이다. U-01 수직 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`다.

## 정확 범위·소유

- Main은 이 WI·invocation, Event·lease·progress/HANDOFF/digest/WORK_STATUS 투영, Git checkpoint·push 및 독립 판정을 소유한다. 새 branch·worktree는 만들지 않는다.
- 단일 Developer `developer-primary-u01-scoped-dashboard-task4-report-control`는 worker/write fencing token과 A 문서의 local/private 동일·clean 확인을 Main에게 받은 뒤에만 정확 2경로 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`를 수정한다. Main은 활성 write lease 동안 같은 경로를 수정하지 않는다.
- 제품/API/UI/DB/브라우저/WSL-server/Secret/배포 write는 이 WI의 범위가 아니다. `design_change.md` 및 R의 결과보고·manifest를 수정하지 않는다. 직접 구현, commit/push, branch 생성은 Developer가 하지 않는다.

## fail-closed successor 계약

1. Task3 기존 active/closed validator와 H 검증을 완화하지 않는다. H→R은 부모가 정확 H인 1커밋, merge 없음, 정확 6문서(`design_change.md`, `docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md`, `docs/WORK_STATUS.md`, `docs/evidence/manifests/U-01_SCOPED_DASHBOARD_TASK4_DEFERRED_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json`)만 허용하고 R의 Git blob과 실제 파일 내용을 역사 입력으로 고정한다.
2. R은 미실행 보고이지 수락이 아니다. WSL-server exact SHA checkout·PG15/OIDC/HTTPS/Chromium·브라우저·DB row·Network·독립 인수·PR/main은 `NOT_EXECUTED` 또는 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`가 유지되어야 한다. 증거 미실행을 PASS/GREEN으로 승격하는 위조를 거부한다.
3. 새 비제품 epoch의 A→통제 C→C 결박 문서 B→write/worker 순차 회수 H를 정확 계보·단일 커밋·허용 경로·원격 ref·clean으로 검증한다. A 이전 Event seq1~2304 원문, H/R의 blob, 기존 완료 lease와 U-01 미수락을 보존한다. 새 worker/write lease는 서로 다른 token, 만료·정확 2경로·제품 scope 0을 요구한다.
4. Event sequence/hash chain, snapshot hash, HANDOFF summary, detached digest, WI·invocation·approval hash, lease timestamp와 회수 순서, branch/upstream/HEAD/remote, U-02 잠금을 위조 음성으로 검사한다. 새 route가 없던 bootstrap RED나 문서 dirty의 Git INVALID를 PASS로 표기하지 않는다.

## TDD·검증·종료

- 먼저 역사 H/R 변조·허용 경로 초과·merge·미게시/dirty·거짓 수락·Event/lease/digest/시각 위조 음성을 RED로 확인한다. 그다음 최소 route만 GREEN으로 만든다.
- 통제 집중 테스트와 인접 회귀, `git diff --check`, 실제 G-05의 종료 코드를 기록한다. 최종 통제 code C는 Main 독립 C0/I0 검토 후 기존 branch/private에 push하고 실원격 동일·clean을 확인한다.
- Main은 C를 B 문서에 결박해 G-05를 확인하고 두 lease를 write→worker 순서로 회수한다. WSL-server 실측은 별도 Task4 실행이며 이 통제 GREEN이 DB·브라우저·사용자 인수를 증명하지 않는다.
- rollback은 새 통제 successor commit만 revert하되 H/R과 승인 계약·제품 코드는 보존한다. 동일 정식 실패 3회면 Main takeover 규칙을 따른다.
