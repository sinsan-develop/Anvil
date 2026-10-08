# WI-F19A-INTEGRATION-R48-HISTORY-20261008-001

## 판정·기준

F-19A는 seq2254에서 로컬·WSL-server 범위 수락되었으나 같은 브랜치의 필수 통합 게이트는 아직 통과하지 않았다. 출발 branch `codex/f18-wsl-ops`, HEAD/private `c9c0c415e6a7a31b2996dd26cb80c8733cafc103`, clean, G-05 seq2254 PASS다. R48 close 역사 회귀 2건은 당시 `BASE=718e2da8326e985bc29b0b292eaf8ad842eba8eb`의 authority 23경로를 후속 개발된 현재 checkout과 비교하여 `R48_CLOSE_AUTHORITY_INVALID`로 실패한다. 실제 guard 결함이 아니라 테스트 시점 혼용이다.

이 WorkInstruction은 승인된 F-19A 통합 검증을 위한 **비의미 테스트 fixture·검사기 통제 보완**이다. 기능·요구사항·중요 위험·공개 API·DB·인가 계약·제품 동작을 바꾸지 않는다. 설계서 SHA-256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획서 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, 검증매트릭스 `9EE200DCE480497C4DE068963B546129F73679745C27846D593688455B2D38E8`, 테스트계획서 `C9C208709E71DB7F8769757AD77B5B51E854B0AB3AECAE89C39298C0C2615C8A`를 고정한다.

## 소유·허용 경로

- Main 소유: 이 WI와 invocation, Event/progress/HANDOFF/detached digest/WORK_STATUS, Git checkpoint·private push, 독립 판정, lease 회수. 문서와 Developer 코드 파일은 동시에 수정하지 않는다.
- Developer actor `developer-primary-f19a-pair-grant`: 제품 write scope `[]`, 통제 코드 **정확 두 경로** `tests/tooling/test_f20_u01_r48_close_projection.py`, `scripts/check_project_progress.py`만 허용한다. overlay `scripts/f20_u01_r48_close_overlay.py`, 제품 코드, 설계·계획, DB, WSL-server, 브라우저, 다른 작업 브랜치·worktree 수정 금지. Developer commit/push/merge 금지.
- Main은 닫힌 seq2254·clean/private/G-05를 확인한 후 epoch94의 `WORK_INSTRUCTION_ISSUED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED`를 canonical Event에 순서대로 추가하고, 서로 다른 24시간 execution/write fencing token을 발급한다. WI hash와 정확 두 경로를 양 lease·progress에 결박한다. Main A 문서-only checkpoint의 private 동일·clean 확인 전 Developer write 금지.

## 실행·검증

1. Developer는 기존 R48 2 FAIL을 RED로 보존한다. R46 선례와 같이 worktree 내부의 소유권이 분명한 일회성 임시 경로에 `git clone --shared --no-checkout`로 로컬 저장소의 Git object를 참조하고, detached `BASE` checkout·HEAD·clean을 확인한다. 브랜치·관리 worktree를 새로 만들지 않고 remote/계정에 접근하지 않는다. `overlay.project`·`validate_outputs`·`_authority_match`의 양성 case와 backdated clock/no-write 음성 case만 역사 root로 옮긴다. 임시 clone은 테스트 후 정확 삭제하고 잔여0을 확인한다.
2. `overlay._authority_match`와 운영용 fail-closed guard는 그대로 둔다. 현 checkout에서 역사 BASE authority가 다름을 숨기거나 mock으로 무력화하지 않는다. 고의로 역사 authority 1바이트를 변조하면 거부되는 음성 회귀를 추가한다.
3. G-05 검사기는 seq2254 Event prefix·F-19A 수락·U-01 잠금·Release DEFER·Production NOT_EXECUTED를 보존하면서, epoch94 A→C(정확 두 코드 경로)→B(docs-only)→close(docs-only)를 검증한다. 새 경로 밖 diff·dirty, 누락·잘못된 token/시간/hash, 조기 수락·U-01 write, 다른 branch/remote를 fail-closed 거부한다.
4. Developer는 RED→GREEN 집중 회귀, 인접 F-19A/R48 회귀, `git diff --check`, Ruff 변경 구간, G-05 active route를 실행하고 명령/종료 코드/결과·미검증을 보고한다. Main은 독립 검토와 필수 통합 gate를 재실행한다. 전체 Ruff 기존 진단은 새 위반 0과 별개로 exit1이면 GREEN으로 주장하지 않는다.
5. Main이 C·B를 순서대로 local/private Git에 게시하고 G-05·clean을 확인한 뒤 write→worker 순서로 lease를 회수한다. 종료 통제/G-05/게시 확인 전 `main` 병합, 현재 branch 삭제, 신규 branch, U-01 제품 write 금지다.

## 완료·rollback

R48 역사 회귀와 현재 F-19A 통합 게이트가 각각 실제로 통과해야 한다. 이 WI는 R48 실제 운영 권한 guard의 계약을 변경하거나 F-20/U-01·Release·Production을 수락하지 않는다. 문제 발생 시 변경된 통제 두 파일만 새 checkpoint에서 되돌릴 수 있으며 Event와 기존 Git history는 재작성하지 않는다. 같은 원인의 정식 Developer `FAILURE_REPORT` 3회일 때만 Main 직접 인수한다.
