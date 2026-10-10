# U-01 Task4 R6 Network tail 통제 fixture 복구 결과

## 판정

승인된 비제품 통제 fixture 복구는 기존 `codex/u01-dashboard-r2`의 H6 `7b9a0f1f6de9d096560cf0e47121f1d6b1f767a7`까지 구현·검증했다. C6의 로컬·WSL-server Git exact-SHA G-05와 집중 통제 시험, B6/H6의 게시본 G-05는 각 해당 SHA에서 통과했다. epoch116 write→worker 순서로 임대를 회수했고 활성 임대는 없다. 실제 Foundation R6 opt-in은 이번 WI에서 재실행하지 않았다. 이전 C5의 `NETWORK_RESPONSE_FACTS/PAIR_LIST_API status404 BODY PENDING` exit1은 `design_change.md` DC-U01-019에 남아 있으며 전체 R6 `FAIL`, U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`다.

## 기준·변경

- 승인 설계 SHA-256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획 SHA-256 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, WI SHA-256 `D07EDDB35BDD26033205779FB3F57BD7E46632F5610CA4DC33751EDC1D68FFD0`, Invocation SHA-256 `8AFE46776914BE35DE2526DC056D8F17E334612C0D5487B57EE0D6C66C2A8545`, 부모 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`다. 기능·요구사항·중요 위험·제품·공개 API·DB·인증·Secret·운영은 변경하지 않았다.
- W7 `1fbaf1c1`→A6 `266e27cc`→C6 `4a1e96fe35d026e91c067aac4e510312dc6224c9`→B6 `6573f4e195f46d706e6493c3c76f92f30df39f05`→H6 `7b9a0f1f6de9d096560cf0e47121f1d6b1f767a7`은 각각 직접 부모다. C6는 검사기와 통제 테스트 정확2경로만 변경했다. B6는 progress/HANDOFF/digest/WORK_STATUS 정확4문서, H6는 Event/progress/HANDOFF/digest/WORK_STATUS 정확5문서만 변경했다.
- H6는 Event seq1~2367 raw prefix를 보존하고 seq2368 write→2369 worker를 `REVOKED` 처리했다. 활성 agent·worker/write lease는 null, 제품 write scope는 0이다. 독립 리뷰 Critical0/Important0/Minor0, local/private clean G-05 `PASS sequence=2369` exit0이다.

## 실행한 검증·환경 오류 분리

- Developer는 신규·epoch115 집중 12 PASS/386.01초, epoch114·113 인접 18 PASS/226.98초, `git diff --check` exit0을 보고했다. Main의 fresh `python.exe -B -m pytest tests/tooling/test_u01_postmerge_control_projection.py::U01Task4R6NetworkTailFixtureRecoveryTests -q --capture=sys -p no:cacheprovider`는 exit0 `5 passed in 150.07s`; 독립 코드 리뷰 Critical0/Important0/Minor0이다. 실제 C6 clean/private G-05 `PASS sequence=2367` exit0이다. 첫 Main sandbox 실행은 SSH 원격 접근 오류와 `U01_TASK4_R6_TAIL_GIT_INVALID` exit1이므로 PASS로 소급하지 않는다.
- WSL-server 전용 `/home/daon/anvil-u01-r6-e116-tail-fixture-qa`는 Git C6 exact SHA·owner daon·realpath 일치·tracked clean이었다. 첫 single-branch clone에는 `development/main` 추적 ref가 없어 G-05 exit1이었고, 같은 checkout에 기준 ref만 Git fetch한 뒤 G-05 `PASS sequence=2367` exit0을 확인했다. `python3 -B -m pytest tests/tooling/test_u01_postmerge_control_projection.py::U01Task4R6NetworkTailFixtureRecoveryTests -q --capture=sys -p no:cacheprovider --basetemp /home/daon/anvil-u01-r6-e116-tail-fixture-qa/.pytest_tmp_u01_r6_tail_e116`는 exit0 `5 passed, 31 subtests passed in 26.38s`다. 이는 임시 격리 통제 QA이지 PG/OIDC/HTTPS/Chromium R6 실측이 아니다.
- 전용 checkout은 종료 전 exact SHA·clean, owner·realpath, symlink0, 별도 mount0, 관련 프로세스0을 확인해 그 경로만 제거했다. 이후 경로·link 부재와 관련 프로세스0을 독립 재확인했다. PG·Node·브라우저 자원은 생성하지 않았다. B6 local/private G-05 seq2367 exit0, H6 seq2369 exit0이다. 이 결과보고 tail 자체의 G-05는 게시 후 별도 확인한다.

## 미충족·다음 조치

전체 R6 opt-in, `PAIR_LIST_API` 404와 BODY 완료 대기의 정확 원인, E-NET/E-API/E-AUD 및 U-01 필수 ID의 같은 scope·SHA 결박은 미검증이다. 별도 최소 WI·유효 dual lease에서 비밀 없는 재현·원인 분리와 안전한 RED→GREEN 보정 후 새 사전등록 WSL-server Git exact-SHA 격리 PG15/OIDC/HTTPS/Chromium R6로 재시험한다. 404 무조건 허용, timeout 연장, body/secret 감사 생략, F19A 임의 활성화는 하지 않는다. 그 전 PR/main 병합·기존 branch 삭제·새 branch/U-02·ysna/Production 작업은 실행하지 않는다. Rollback은 이번 신규 커밋만 정상 revert하고 역사 Event·보고·사설 원격 복구 ref를 보존한다.
