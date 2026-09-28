# F-20/R5e C30 Event 원장 사고 기록·수락 차단 재작업 결과

## 판정

`COMPLETED` — R5e exact2 제품 범위에서 C30 역사 projection의 조기 수락·lease 거부 검사를 유지하면서, 현재 원장 raw 불일치와 append-only `CRITICAL` 사고 및 F-20 수락 차단을 검증한다. 이는 이미 변조된 과거 bytes의 복원이나 F-20 전체 수락 판정이 아니다.

## 기준·소유권

- 시작 checkout/branch/HEAD: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops`, `a053816699fcf0247dddd8aad1d6adb17ccf7ed7`; 지정 `development/codex/f18-wsl-ops`도 동일 SHA. 시작 tracked dirty/untracked 0, dispatch `55c7730071e6bd99064b4bceb57d1c6e59353ae0`는 HEAD의 선조.
- 시작 G-05 `PASS sequence=1768 reporting=AUTO_CONTINUE`. canonical actor `developer-primary-f20-r5e`, epoch9 worker `worker-lease-f20-r5e-27674f6cecba` / write `write-lease-f20-r5e-27674f6cecba` ACTIVE, 만료 2026-09-29 00:16:47 KST. execution token `f20-r5e-execution-fence-epoch-9-27674f6cecba`, write token `f20-r5e-write-fence-epoch-9-27674f6cecba`; 양쪽 exact2 scope는 이 보고서와 `tests/tooling/test_project_progress.py`이다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 통합검증매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R5e WI `18E727C18AFCC6084403ADC232054B04EC94605A89C1054232EF00BDDF4D9F31`, Invocation `24CE31A6163B88C4CA9747568EA456B8E0359E054417A00DF48144B3E3EAB265`.
- 사용자 승인된 계획의 내부 재작업이다. 제품 writer는 위 두 경로 이외를 수정하지 않았고 Git commit/push, canonical Event·control·status, WSL-server는 Main이 소유한다.

## 판단 이유·변경 전후

- 변경 전 `C30CanonicalReconciliationTests.test_no_early_acceptance_or_lease_revoke`는 역사 생성 1334-event prefix와 현재 raw 원장이 같다고 주장하여 RED였다. C30 역사 원문은 3,994,695 bytes/SHA-256 `BDB3AA36358097923A9DD100E9DEE80B9905B09F590D49CC0F97DC557FBD119B`, 현재 동일 prefix는 4,022,935 bytes/SHA-256 `50195E96FCD9EEA4357DEAD1554AC20ADF3AFF81E916376A10DCA9EA2958DDBC`이고 최초 다른 byte offset은 `3868706`이다.
- 변경 후 기존 역사 projection의 상태 `IN_PROGRESS`, 조기 acceptance/lease 금지, Event tail, human approval·takeover 및 negative completion 검사는 그대로 둔다. 동일 raw라는 거짓 assertion을 각각의 길이·SHA·차이 검증으로 대체하고, 현재 seq1764 `DEFECT_RECORDED`의 `CRITICAL`/blocking/`OPEN_BLOCKING`, 원인 commit `14c8c5743890c4a8a58686b9430144a55b1317e7`, 부모→원인 seq1689~1712 정확히 24개와 원인→현재 seq1714 변경 1개, 원본/current hash 결박을 확인한다.
- 현재 progress의 사고 `OPEN_BLOCKING`, release `DEFER`, F-20 `REWORK_IN_PROGRESS`·미완료와 공개 validator GREEN을 확인한다. 새 음성 검사는 사고 Event 누락·blocking 위조, 원인 Git blob 누락·raw 위조, 현재 raw 위조를 거부한다. 기존 현재 digest/manifest 테스트의 R5d mode·오류 코드 기대만 R5e로 갱신하고 progress/handoff/digest/manifest 위조 입력은 유지했다.
- Event 원장, Git 역사, frozen manifest/hash, checker/overlay, 현재 WI, 제품 runtime을 수정하지 않았고 skip/xfail을 쓰지 않았다. 실제 diff는 위 테스트 파일과 이 결과보고서 exact2이다.

## 실제 로컬 검증

| 명령·범위 | 실제 결과 |
|---|---|
| `.\.venv\Scripts\python.exe scripts/check_project_progress.py` (쓰기 전·후) | 각 exit0, `G-05 ... PASS sequence=1768 reporting=AUTO_CONTINUE` |
| `.\.venv\Scripts\python.exe -m pytest -q tests/tooling/test_project_progress.py::C30CanonicalReconciliationTests::test_no_early_acceptance_or_lease_revoke -o cache_dir=D:/tmp/anvil-f20-r5e-writer-pytest-cache` | 변경 전 `F [100%]` RED 관측. 대형 byte equality 실패 요약/pytest cacheprovider 종료 지연으로 Ctrl-C 중단(exit1), 최종 집계 없음. PASS 아님 |
| 단일 C30과 현재 digest의 직접 `unittest.TextTestRunner` 실행 | 수정 후 2 tests, exit0, `OK` in 31.031s. 별도 C30 단일은 exit0, `OK` in 8.123s |
| 사고 누락·위조 음성 직접 `unittest.TextTestRunner` | 1 test, exit0, `OK` in 17.206s |
| C30CanonicalReconciliationTests + E09 Start/Final 직접 `unittest.TextTestRunner` | 18 tests, exit0, `OK` in 88.780s |
| C09 Start/R3/R4/Main/final + C10~C13 관련 19 class 직접 `unittest.TextTestRunner` | 77 tests, exit0, `OK` in 162.801s. 역사 위조 음성의 예상 거부 메시지는 실패가 아님 |
| `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --import-mode=importlib` + C30 사고 2 node + 현재 digest 1 node `--tb=short` | exit0, `3 passed in 47.84s`; cacheprovider 종료 지연 없이 완료 |
| `git diff --check` | exit0 |

`pytest` 최초 두 실행은 테스트 완료 표시 후 CPU를 계속 사용하며 종료되지 않아 각각 중단(exit1)했다. 정확한 내부 원인은 미확정이며, 두 번째 실행의 `.`도 종료 코드가 없으므로 PASS로 세지 않았다. `-p no:cacheprovider`에서는 동일 핵심 3 node의 확정 exit0을 확보했다. 로컬 `D:\tmp\anvil-f20-r5e-writer-pytest-cache`는 실경로 검사에서 생성되지 않았고 동일 접두 임시 자원 잔류 0이다. ACL·공유 DB/Docker·WSL-server·ysna-server/Production은 변경하지 않았다. 정식 동일 근본 원인 `FAILURE_REPORT` 횟수는 0이다.

## 미검증·다음 조치·rollback

Main이 exact2 diff를 독립 검토한 뒤 같은 branch에 commit/push하고, WSL-server에서 그 정확한 SHA를 Git pull해 G-05·C30/역사 집중·전체 suite를 실행해야 한다. 로컬 전체 suite는 이 writer가 실행하지 않았다. 실제 DB/API/브라우저 Network·11개 메뉴·PG15/PG18RC·backup/restore·rollback 역시 이 fixture 검증으로 입증되지 않는다. F-20 수락·main 병합·다음 branch 생성은 금지 상태다.

회귀 시 Main이 이 exact2 제품 commit을 정상 Git revert하고 G-05·C30/현재 digest/역사군 회귀를 재검증한다. canonical 사고 Event는 append-only 기록이므로 제거·재작성하는 rollback 대상이 아니다. 이 writer는 commit/push나 progress/HANDOFF를 갱신하지 않고 Main에 diff·실측을 인계한다.
