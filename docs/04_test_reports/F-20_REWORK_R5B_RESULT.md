# F-20/R5b C09 역사 권위 테스트 재작업 결과

## 판정

`COMPLETED` — 지정된 C09 시작 5건, R3 3건, R4 2건의 로컬 RED를 재현하고 GREEN으로 보완했다. 이는 F-20 전체 수락이나 C09 전체 역사 검증 합격을 뜻하지 않는다. Main의 독립 검토, commit/push 및 WSL-server 동일 SHA 검증이 남아 있다.

## 기준·권한

- 담당 `developer-primary-f20-r5b`, Work Package `F-20/R5b`, 기존 branch `codex/f18-wsl-ops`; 시작 HEAD와 `development/codex/f18-wsl-ops` 모두 `bbc2190466d1566016da009fe3f8092aa8677588`. 시작 Git status clean.
- 정본 G-05 Event seq1749 PASS, actor `developer-primary-f20-r5b`, epoch6 worker/write ACTIVE, 실행 token `f20-r5b-execution-fence-epoch-6-2c8cd368`, write token `f20-r5b-write-fence-epoch-6-2c8cd368`, exact2 경로와 만료 `2026-09-28T10:01:29+00:00` 확인. lease dispatch SHA `d8a7e2dd4ce2a144c53607242b326a9afd16c468`는 Main의 seq1749 control commit 이전 기준이다.
- 현재 기준 문서 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R5b WorkInstruction `B1C0121A3CA19777FDBF4753D46878AEC96FF34EF3310941B3CCEB59CAEB6E65`. 문서 전체 bytes를 UTF-8로 EOF까지 읽어 hash·종료 행을 확인하고 F-20/C09·lease·검증 조항을 대조했다. 모든 문장의 개별 의미 재검토를 주장하지 않는다.
- 단일 제품 writer의 변경은 `tests/tooling/test_project_progress.py`와 이 결과보고서 두 경로뿐이다. Main의 동시 `docs/WORK_STATUS.md` 변경은 이 writer 결과가 아니다.

## 판단 이유와 변경 전·후

- 이전 C09 역사 fixture는 `08aae12fdc4f8bd2d38b455f23408796ab4b8c82` Git tree에서 설계·계획·매트릭스·테스트계획 4개 blob을 가져와 in-memory로 격리했으나 운영규칙만 현재 정본 bytes를 읽었다. 현재 운영규칙 SHA `BFDF50…`와 당시 blob SHA `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`가 다르므로 세 builder의 `*_AUTHORITY_HASH_INVALID`가 공통 발생했다.
- 기존 fixture의 역사 Git blob 목록에 `docs/governance/ANVIL_OPERATING_RULES.md`를 추가했다. 현재 승인 문서나 checker의 역사 SHA 상수, Event 원장, 검증·승인 계약은 변경하지 않았다.
- 운영규칙 역사 bytes가 비거나 위조되면 C09 Start/R3/R4 builder가 각각 기존 `C09_START_AUTHORITY_HASH_INVALID`, `C09_R3_AUTHORITY_HASH_INVALID`, `C09_R4_AUTHORITY_HASH_INVALID`로 거부하는 음성 검사를 추가했다. 승인서·선행 manifest/WI·raw Event·lease·scope 변조 거부는 기존 C09 테스트에 보존했다.

## 명령과 실제 결과

- `git status --short; git branch --show-current; git rev-parse HEAD; git rev-parse development/codex/f18-wsl-ops` → exit 0, clean / `codex/f18-wsl-ops` / 두 SHA `bbc2190…` 일치. Git global ignore 접근 경고는 있었으나 조회 결과와 G-05에는 영향 없었다.
- `.\.venv\Scripts\python.exe scripts/check_project_progress.py .` → 수정 전·후 모두 exit 0, `G-05 project progress contract: PASS sequence=1749 reporting=AUTO_CONTINUE`.
- RED: `.\.venv\Scripts\python.exe -m pytest -q tests/tooling/test_project_progress.py -k 'C09StartProjectionTests or C09R3ControlTests or C09R4ControlTests' --basetemp=.pytest_tmp_f20_r5b_writer` → exit 1, `10 failed, 8 passed, 663 deselected in 73.60s`. 실패 10건은 Start 5/R3 3/R4 2이며 모두 해당 역사 authority hash 불일치로 분류했다.
- GREEN: `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k 'C09StartProjectionTests or C09R3ControlTests or C09R4ControlTests' --basetemp=.pytest_tmp_f20_r5b_writer` → exit 0, `19 passed, 663 deselected in 73.58s`. 19건은 기존 대상 10, 기존 양성·음성 8, 신규 운영규칙 누락·위조 음성 1이다.
- 신규 음성 단독 재실행도 exit 0, `1 passed in 2.23s`. `git diff --check -- tests/tooling/test_project_progress.py` → exit 0.
- 변경 파일 전체 `tests/tooling/test_project_progress.py` 로컬 실행은 시작했으나 기존 C30 raw Event 사고 FAIL 1건을 출력한 뒤 장시간 실행을 중단했다(exit 1, 부분 출력). 완료된 파일 전체 또는 전체 프로젝트 PASS/FAIL 집계로 사용하지 않는다. Main의 동일 SHA WSL 전체 suite가 필요하다.

## 미검증·영향·rollback

- 범위 밖 C30 audit raw prefix, C21 WSL 역사 객체, C09 takeover/final, C10~C13, E09 실패는 수정·skip·xfail·PASS 처리하지 않았다. 기존 WSL 전체 suite `8137 passed, 38 failed, 116 skipped`는 R5a SHA 결과이고 R5b 새 SHA의 결과가 아니다.
- 새 제품 SHA의 WSL-server 동일 SHA, 전체 suite, 실제 DB/API/브라우저·11개 메뉴·Provider, PG15/PG18RC, Monitoring·backup/restore·rollback은 이 writer가 실행하지 않았다. ysna-server/Production과 main 병합도 실행하지 않았다.
- rollback: Main commit 전에는 이 exact2의 diff만 역방향 적용한다. commit 후에는 해당 제품 변경 commit을 안전한 역방향 commit으로 되돌린다. 현재 문서·역사 Event·approval·사용자 dirty 파일은 건드리지 않는다.
- progress/HANDOFF와 Git commit/push·WSL 검증은 Main 담당이며 이 writer는 수정하지 않았다. 동일 근본 원인의 정식 Developer `FAILURE_REPORT`는 0회다. 위 10 RED는 의도적 재현이고 C30 FAIL은 기존 별도 사고다.
