# A-14 Main Takeover Packet R4

- package: `A-14`
- actor: `main-agent-eoul`
- trigger: third valid failure for `BLK-A14-002`
- source report: `docs/test_reports/A-14_RETEST_REPORT_R4.md`
- source report SHA-256: `10D591A1D87AD760BFACD7FCA70FD7A020DA87589DB12F035A8A59C6F207A2D9`
- baseline: `main = origin/main = 66b967d12cc0e57107dead56d5d47a65804f6863`
- prior state: `seq168 / A-14 TEST_REVIEW / R4_PENDING / leases null`
- takeover status: `MAIN_AGENT_TAKEOVER_REQUIRED`

## 판단

동일 계보의 세 번째 유효 실패다. Developer 재작업은 중단하고 Main이 기존 승인 범위 안에서 순차 인수한다. 기능 범위, 요구사항, 중요 위험은 변경하지 않는다.

## 고정 원인

`scripts/check_a13_repository_scan.py::_revision2_completion_successor`의 A-14 R3 completion 선택 조건이 committed clean checkout을 허용하지 않아, 유효한 completion successor raw bytes/hash를 후보에 넣지 못한다. 이로 인해 정상 current checkout과 clean clone이 false reject된다.

## Main 허용 경로

- `scripts/check_a13_repository_scan.py`
- `tests/tooling/test_a13_repository_scan.py`
- `docs/work_orders/A-14_MAIN_TAKEOVER_PACKET_R4.md`
- 후속 Main progress/HANDOFF/events/ledger/evidence manifest와 phase-aware checker/test 경로

## 변경 경계

- `current_a14_r3_completion`에서 committed clean 또는 exact dirty projection을 허용한다.
- predecessor manifest SHA와 live raw bytes/hash의 fail-closed 검증은 유지한다.
- A-14 UI 제품 파일은 수정하지 않는다.
- 실제 browser R4에서 닫힌 UI findings를 다시 열지 않는다.

## 필수 검증

- original failing A-13 successor tests RED→GREEN
- predecessor/successor hostile tamper rejection
- A-13+A-14 targeted `29/29`
- full tooling `271/271`
- A-13/A-14/project/G07/PhaseG standalone
- exact diff, `git diff --check`, clean clone

