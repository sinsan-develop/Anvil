# F-20 C30 원장 복구 v2 검증기 Developer 결과

## 판정

- 결과 상태: `COMPLETED` — exact3 중 검증기·테스트·이 보고서 작성과 로컬 기본 검증 완료. 이 판정은 새 Event 원장 세대의 활성화, C30 차단 해제, F-20 수락, Release GO가 아니다.
- 읽기 전용 사전검증 `verify_repository(Path('.'))`: `eligible=True`, `errors=[]`. 이는 현재 고정된 Git 원본과 seq2044 로컬 파일의 검증기 계약 충족만 의미한다. 독립 Tester 및 Main의 세대 시작 판정은 별개다.
- 현재 C30은 `OPEN_BLOCKING`, F-20은 `REWORK_IN_PROGRESS`·미수락, ReleaseDecision은 `DEFER`, Production은 `NOT_EXECUTED`다.

## 판단 이유와 기준선

- Work Package: `F-20/C30-RECOVERY-V2`; branch `codex/f18-wsl-ops`, 시작 HEAD `fe87435a7b2ecd60b9b4efcf3d4c1ce49d4caa60`, upstream `development/codex/f18-wsl-ops`. 시작 시 `scripts/f20_u01_r38b_close_overlay.py`가 Main 소유 dirty였으며 이 파일은 읽기만 하고 보존했다.
- WorkInstruction SHA256 `80B4F6167097D73E61F9953AFAFD1FD488441A8895DC59B69E74B35295DC7FDA`; 복구 설계 SHA256 `168E4E5EEF34693AEAD3A2E827249C0E47F0F9AC02CE7FE714D8FE38EE8072DF`; 복구 계획 SHA256 `20CC2EE71D1AE169F505CC88ECF64127E5FDBA2D14B94C050A93C9C792DCE1D8`. 실제 파일 hash와 일치했다. 상위 설계·작업계획 현재 hash는 각각 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`였다.
- canonical worker/write lease는 `worker-lease-f20-c30v2-c30v2001`/`write-lease-f20-c30v2-c30v2001`, epoch 55, 실행 token `f20-c30v2-execution-fence-epoch-55-c30v2001`, write token `f20-c30v2-write-fence-epoch-55-c30v2001`, 만료 `2026-10-05T09:25:52+00:00`였다. 경로 범위는 이 결과서와 아래 코드·테스트 정확 3개다.
- 정상 Git anchor commit `97adc5cf7070c71b61a5d6902d31cf195329b38f`의 blob `b59ac57228f9b5684b939dc30fc7d7bce5dbbb54`를 실제 Git tree와 원문 SHA256 `2755283A52C6AA384129E516A3EA52D23647DD5E7BF1D68EC63C248A0B0EE36F`로 확인했다. cutover commit `9485465ddb046a48e61ee14c7cdd0e62df0a6e70`의 blob `0f86d09446b40905e9d33e9e6cbe4c1380a63218`도 tree·SHA256 `5167A3AC73E8C914144340F0B1506CE144470657AE75CAAFEF0DAFBB4E5D1DBF`로 확인했다. 현재 Event 객체 1~2040의 원시 bytes는 cutover의 각 객체와 모두 동일했다.
- 사고 commit은 anchor의 직접 자식이었다. 재계산한 기존 의미 변경은 seq1689~1712 정확 24건, 추가는 seq1713~1714 2건, 사고 후 추가 변경은 seq1714 1건이다. 새 `accepted=true` 11건의 sequence는 `1689,1691,1694,1696,1698,1700,1702,1704,1706,1708,1710`이다. 이 11건과 seq1713~1714의 F-20 수락 표시는 복구 권위에 채택하지 않았다.
- seq1715~2040은 326 Event이며 이 중 seq1716~2040은 325 Event다. 모두 sequence·ID·chain을 검증했고, 53개 `WORK_INSTRUCTION_ISSUED`와 1개 `WORK_INSTRUCTION_REVISED`의 WI/invocation 실제 파일 hash, 54개 worker/write lease 쌍의 epoch·fencing·회수, R38B revision의 실제 approval file·subject hash·파생 binding을 대조했다. seq2041~2044의 현행 C30 WI·approval·active dual lease·미수락 상태도 확인했다. 불확실한 항목은 오류로 반환하는 fail-closed API다.

## 조치·변경 전후

| 파일 | 변경 전 | 변경 후 |
|---|---|---|
| `scripts/f20_c30_recovery_v2.py` | 없음 | Git object·원시 Event·후속 WI/lease/approval을 쓰기 없이 검사하는 `verify_repository()` 추가 |
| `tests/tooling/test_f20_c30_recovery_v2.py` | 없음 | 실제 Git 입력과 원본 부재, raw 변조, 거짓 수락, WI/invocation, lease, revision·승인 binding, 현재 재수락 변조 10건 추가 |
| `docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_DEVELOPER_RESULT.md` | 없음 | 이 결과·검증 범위·rollback 기록 |

- 기존 `scripts/check_project_progress.py`와 C30 R5e 감사, Event 원문, progress/HANDOFF, approval 원문은 수정하지 않았다. commit·push·branch 생성·WSL·DB·운영 작업도 하지 않았다.
- historical Git blob에는 과거 legacy Event의 중복 JSON key가 있다. 고정 Git blob SHA와 기존 2040개 객체 원시 byte 비교로 그 역사를 고정하고, seq1715 이후 새 통제 Event는 중복 key를 거부한다. seq1714는 사고 commit 이후 한 번 더 변경된 사실을 별도 delta로 검증한다.

## 실제 검증 명령·종료 코드

Windows PowerShell, 현재 worktree에서 실행했다. 아래 pytest 명령은 `$env:PYTHONDONTWRITEBYTECODE='1'`을 설정하고 `.venv` Python을 사용했다.

1. RED: `& '.\.venv\Scripts\python.exe' -m pytest -q -p no:cacheprovider tests/tooling/test_f20_c30_recovery_v2.py` → exit 1, 새 모듈 import error. 예정한 RED였다.
2. 최초 구현 직후 동일 명령 → exit 1, `4 failed, 1 passed`; 고정된 과거 blob의 legacy 중복 key를 발견하고 원시 blob 검증·새 통제 Event 엄격 파싱으로 분리했다.
3. 보완 직후 동일 명령 → exit 1, `1 failed, 4 passed`; 사고 뒤 seq1714의 단일 변경을 재계산해 계약에 반영했다.
4. GREEN 동일 명령 → exit 0, `5 passed in 8.22s`.
5. 음성 케이스 추가·GREEN 동일 명령 → exit 0, `10 passed in 20.22s`; 현행 통제 Event 길이를 seq2044 정확값으로 제한한 뒤 동일 명령 재실행 → exit 0, `10 passed in 21.29s`.
6. `& '.\.venv\Scripts\python.exe' scripts/check_project_progress.py .` → exit 0, `G-05 project progress contract: PASS sequence=2044 reporting=AUTO_CONTINUE`. 기존 G-05가 현재 통제 기록을 읽은 결과이며 새 세대 독립 감사 PASS는 아니다.
7. `& '.\.venv\Scripts\python.exe' -c "from pathlib import Path; from scripts import f20_c30_recovery_v2 as r; v=r.verify_repository(Path('.')); print('eligible',v.eligible,'errors',v.errors,'evidence',v.evidence)"` → exit 0, `eligible True`, `errors []`, `anchor_events=1712`, `cutover_events=2040`, `validated_followup_events=326`, `validated_work_instructions=54`, `validated_lease_pairs=54`, `revoked_lease_pairs=54`.
8. `git diff --check` → exit 0. 새 파일은 untracked라 이 명령의 검사 범위 밖이며 pytest와 직접 읽기로 검증했다.

환경 명령 탐색 중 `python` 미발견, `py -3` 설치본 미발견, bundled Python의 `pytest` 모듈 부재가 각각 exit 1이었다. worktree `.venv`로 해소했다. 정식 `FAILURE_REPORT` 0회, 같은 근본 원인 연속 실패 3회 0건. RED와 구현 보완 2회는 내부 TDD 단계이며 미해결 오류가 아니다.

## 미검증·잔여 위험·rollback

- 독립 Tester 공격 검증, Main의 Event/manifest·세대 시작/복구 확인 투영, 새 세대 대상 G-05 확대, WSL-server 동일 SHA, 브라우저/API/DB/Production 검증은 `NOT_EXECUTED`다. 이 로컬 preflight가 해당 항목을 PASS로 대체하지 않는다.
- 직접 API 확인 명령 1회에서 `PYTHONDONTWRITEBYTECODE` 설정을 빠뜨려 ignored 파생 파일 `scripts/__pycache__/f20_c30_recovery_v2.cpython-313.pyc` 1개가 생성됐다. exact3 밖이라 Developer가 삭제하지 않고 Main에게 정확 경로와 정리 필요를 전달했다. Git 추적 변경은 아니다.
- WI/invocation의 현재 파일 hash 일치는 검증했지만 역사적 시점의 별도 파일 byte 보존은 개별 Git object로 전량 재구성하지 않았다. 이벤트와 현행 파일이 함께 변경되는 공격을 억제하는 기준은 고정 cutover Git blob이며, Main/독립 Tester가 이 결박의 적정성을 검토해야 한다.
- rollback은 Main이 이 exact3만 범위 지정해 제거하거나, 이후 checkpoint commit이 만들어졌다면 해당 commit을 되돌리는 것이다. 정상/사고/cutover Event 원문 및 approval 원문은 계속 보존하고 C30 `OPEN_BLOCKING`을 유지한다.
- progress/HANDOFF/WORK_STATUS 누적 갱신은 Main 소유라 이 Developer는 수행하지 않았다. 결과서와 코드는 아직 uncommitted이며 Main의 검토·commit·push 대상이다.
