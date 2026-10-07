# F-19A Task1 저장 원장 통제 bootstrap handoff

```json anvil-recovery-summary
{
  "event_sequence": 2156,
  "last_event_id": "evt_f19a_2156_task1_write_lease_issued",
  "status": "ACTIVE",
  "current_work_package": "F-19A",
  "active_agent": "developer-primary-f19a-pair-grant",
  "worker_lease": "worker-lease-f19a-task1-3109d00f63784eeeaa7435fd2660e1a2",
  "write_lease": "write-lease-f19a-task1-587fa29e9fcf4813b46f0f2d55cc0975",
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F19A_TASK1_PRODUCT_RED_TESTS_ONLY",
  "repository_head": "26935fc4b078ffd8583042bd3643a14af7dfbcd8",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Task1 저장 원장 WSL 실증: exact private Git SHA `a2669849c45c4c1848e86929e0460f329979b7ff` clean으로 WSL-server 전용 PG15에서 0020·복합 FK·철회·audit 불변·데이터 존재 downgrade guard 2 PASS(exit0), native pg_dump 212219 bytes/SHA `e36dc402...`→전용 restore DB pg_restore 완료·0020 동일·네 테이블 데이터 해시 동일/건수 2:2:1:6. 시험 전용 container/익명 volume/loopback 포트/checkout/venv/backup 파일은 신원 확인 후 제거해 잔여0이다. 앞선 잘못 적은 기대 SHA·editable pip flat-layout·checkout 안 venv의 clean 검사 exit1은 각각 정정했고 PG test 실패가 아니다. F-19A 전체 미수락, Task1 임대 종료·final checkpoint/closed G-05는 아직 미실행이다.

- Task1 제품4 local 후보: 기존 I1 존재 노출을 RED 2 FAIL→GREEN 2 PASS로 해소했다. 최종 신규4파일 SHA는 migration `649B5AE3...`, repository `A8BBF664...`, unit `93D18D8C...`, PG opt-in `A1583886...`; Developer·Main 최종 104 PASS/2 PG15 SKIP, Alembic 0020 head, G-05 seq2156 PASS, diff0, 독립 C0/I0/M0이다. PG15 실측/backup-restore·제품 후보 commit/private push는 아직 미실행, F-19A 미수락이다. 다음은 정확7파일 local checkpoint→private exact SHA→WSL-server 격리 PG15 검증이다.

- Task1 제품4 첫 독립 리뷰는 I1 REWORK: 비소유자의 숨김 등록 대상에 대해 existing 403/missing 404로 존재 노출이 가능하다. 같은 epoch74 Developer에게 정확4파일 내 RED 음성 테스트·최소 보정을 재지시했고 Main은 제품 checkpoint/WSL을 중지했다. 첫 로컬 102 PASS·PG15 2 SKIP은 이 결함과 실제 DB/backup/restore를 증명하지 않으며 F-19A는 ACTIVE·미수락이다.

- B 승격 사전검증: 같은 seq2156과 control anchor `26935fc4...`에서 실제 G-05 PASS·인접5파일 62 PASS/339.57초·diff0이다. 현재 dirty는 Main 통제 문서4뿐이고 제품4/DB/WSL write0이다. B 문서 checkpoint/private 원격 SHA·clean G-05는 아직 미실행, 제품 RED 착수는 잠금이다.

- Task1 통제 checkpoint/private 일치: Main 독립 인접5파일 62 PASS/374.69초·active G-05 seq2156 PASS·독립 C0/I0/M1·제품4 변경0·staged 정확8파일 diff0을 확인해 기존 branch commit `26935fc4b078ffd8583042bd3643a14af7dfbcd8`를 정상 fast-forward push했고 실제 원격 SHA와 동일하다. 직후 A 상태의 G-05는 기록 HEAD가 옛 `29dc...`라 `F19A_TASK1_GIT_INVALID`(exit1)였고 PASS로 승격하지 않는다. 이 B 투영은 `control_checkpoint=26935...`와 제품 RED 준비 상태를 같은 seq2156에 결박하며 제품 코드·DB/WSL write는 아직0이다. B precommit/clean G-05와 B control 문서 checkpoint/private push는 아직 검증 전이다.

- epoch74 통제2 코드 동결: Developer 정확2파일 SHA checker `3388E80E...`, test `D596545D...`; 첫 인접 61 PASS/1 FAIL 역사 collector 위임 보정 후 최종 62 PASS/363.11초, Main 독립 62 PASS/374.69초, 실제 G-05 seq2156 PASS, diff check0이다. 독립 C0/I0/M1은 checkpoint 허용, M1 제품4 잠금이 WI·사후 dirty 검사에 의존함을 남긴다. 제품4 변경0, 통제 checkpoint/private push·clean 재검증은 아직 미실행이고 다음은 정확8파일 checkpoint다.

- Task1 승인 범위 인수: 실제 local/private `29dc2071be8f5cae4ba68a727c5e89d4ad8a12d4` 동일·clean G-05 seq2153 PASS·인접5파일 57 PASS/307.54초를 확인했다. 새 WI SHA `30C688A...`와 seq2154 WI→2155 worker→2156 write epoch74를 정확6파일(통제2/제품4)로 append-only 투영했다. 새 route 부재의 bootstrap G-05는 미통과 예상이며 이 시점 제품4 write는 잠금이다. Developer가 통제2 RED→GREEN을 완료하고 Main의 독립 C0/I0·active G-05·정확 control checkpoint/private 동일 SHA 전 제품4를 수정하지 않는다. F-19A 전체 ACTIVE·미수락, F-20/U01 REWORK, Release DEFER, Production NOT_EXECUTED, WSL/ysna 작업0.

- 실제 종료 precommit 검증: seq2153 G-05 PASS, 인접5파일 57 PASS/326.58초, 독립 control C0/I0/M0, diff0이다. Event/완료 lease는 유효하고 dirty는 종료 control5만 남는다. 아직 final close commit/private push 및 그 후 clean G-05/회귀는 미실행, 제품 Task1 lease0이다. 다음은 정확 control5 checkpoint→actual remote SHA 동등 확인→clean G-05·57건 재검증이다.

- R2 epoch73 통제 종료: existing branch/private clean code checkpoint `d4ecfdc824a5289810c00d652ee24c058782675e`와 실제 원격 동일 SHA·G-05 seq2151 PASS를 확인한 뒤 seq2152 write→2153 worker revoke를 append했다. 두 active lease는 null이고 완료 lease는 REVOKED로 보존, 제품 write scope0이다. 종료 전 인접5파일57 PASS·독립 C0/I0/M0이며 실제 종료 후 G-05/인접 회귀와 close commit/private push는 이 기록 시점에 미실행이다. F-19A 전체 ACTIVE·미수락, Task1 제품 lease 아직0, F-20/U01 REWORK·Release DEFER·Production NOT_EXECUTED. 다음은 종료 precommit G-05·전체57·독립 control 확인→close checkpoint/private push→clean G-05·회귀다.

- R2 code 동결 검증: Developer exact2 코드/테스트 동결, focused19·인접5파일57 PASS, Main 독립 57 PASS/363.87초, actual G-05 seq2151 PASS(절대 worktree 경로), diff0, 독립 C0/I0/M0이다. 상대 `.` 경로의 로컬 venv 실행은 Python real-location 진단과 중복 경로 LOAD_ERROR(exit1)였고 절대 경로로 재검증했다. 실제 seq2152/2153 종료는 아직0, 제품 Task1 lease0. 다음은 기존 branch/private code checkpoint→clean G-05 후 write→worker 회수와 closed 회귀다.

- 역사 Git fixture R2 재작업: seq2148의 NON-GREEN WIP 종료를 clean/private `67d20aaf334679929cd8f929b1821ac307fcbebd`로 보존했고 실제 원격 SHA·G-05 seq2148 PASS를 대조했다. clean에서 기존 4 FAIL의 정확 재실행은 3 PASS/1 FAIL이며, 남은 실패는 역사 seq2141 Git collector 테스트의 현재 후속 WI 혼합이다. Main WI SHA `145EE476...`를 seq2149 발행하고 epoch73 worker seq2150→write seq2151을 서로 다른 token·24시간·정확2파일·제품 scope0으로 발급했다. 현재 다음 행동은 `F19A_TASK0_GIT_FIXTURE_R2_ONLY`; 새 route 전 bootstrap G-05 RED는 PASS가 아니다. Developer는 역사 Git fixture와 seq2151/2153 active/close 검증을 같은 임대 안에서 준비한다. F-19A 전체 ACTIVE·미수락, 제품 Task1 lease0, F-20/U01 REWORK, Release DEFER, Production NOT_EXECUTED.

- 종료 후 회귀 NON-GREEN: 실제 seq2148의 precommit G-05와 독립 control C0/I0/M0은 통과했지만 인접 5파일 54건에서 50 PASS/4 FAIL(exit1)이다. `test_f19a_start_projection.py` 역사 fixture의 live Git 참조 3건 및 역사 Task0 collector의 후속 WI 경계 1건으로 재현했으며 제품/DB 오류로 단정하지 않는다. 현재 제품 Task1 권한0. 정확 control5를 실패 명시 WIP checkpoint로 보존한 뒤 새로운 비제품 exact2 lease로 역사 Git fixture만 보정하고, postclose 전체 GREEN 전 제품 dual lease를 발급하지 않는다.

- F-19A Task0 fixture epoch72 종료: Developer 최신 인접 5파일 54 PASS, Main 독립 54 PASS/303.72초, active G-05 seq2146 PASS, diff check0, 독립 C0/I0/M0이다. 기존 branch/private clean code checkpoint `eccbc2a78064a8538c135c10b328e2dddcd548f4`를 실제 원격과 대조한 뒤 seq2147 write→2148 worker revoke를 append하고 두 lease를 REVOKED로 보존했다. 제품 write scope0, F-19A 전체 ACTIVE·미수락, Task1 제품 dual lease 아직 미발급이다. 종료 G-05 및 final close commit/private push는 이 기록 시점에 미실행이며, 다음은 종료 검증·정확 checkpoint 후 별도 제품 lease 발급이다. F-20/U01 REWORK, Release DEFER, Production NOT_EXECUTED, WSL/ysna 작업0.

- F-19A Task0 종료 후 RED gate 보정: clean checkpoint `a5c39b1863647a10e5ce8cf70a6d9e10cc3a6f51`의 seq2143/no-lease에서 Main 비의미 WI SHA `B1429921...`를 seq2144 발행하고 epoch72 seq2145 worker→2146 write를 서로 다른 token·정확2파일·24시간·제품 scope0으로 발급했다. machine 다음 행동은 `F19A_TASK0_TEST_REVALIDATION_ONLY`이며 제품 dual lease/Task1은 금지한다. 새 successor route 부재의 bootstrap G-05 RED는 PASS가 아니다. Developer는 역사 seq2141/2143 fixture와 현재 seq2146을 분리해 집중4 FAIL을 RED→GREEN하고 인접 전체를 재실행한다. F-19A 미수락, F-20/U01 REWORK, Release DEFER, Production NOT_EXECUTED다.

- F-19A Task0 통제 종료: 기존 branch/private 코드 checkpoint `d6960b95b7eb9afcfe801190eaa762485b387d3f`의 clean G-05 seq2141·전체 46 PASS와 독립 C0/I0/M0을 확인한 뒤 seq2142 write→2143 worker 회수를 원문 뒤에 append했다. 두 lease는 `REVOKED`, active worker/write와 제품 write scope는 빈 상태다. Task0 전용 binding만 종료이며 F-19A 전체는 `ACTIVE`·미수락, 다음은 새 제품 dual lease 발급 후 Task1이다. 종료 투영 G-05 seq2143 PASS·diff check0을 확인했고 최종 private checkpoint는 아직 미실행이며 Release DEFER·Production NOT_EXECUTED, WSL/ysna 작업0이다.

- 종료 후 발견한 통제 예외: 집중 8건 중 4건은 live seq2141을 가정한 fixture 때문에 FAIL이며, machine `next_safe_action=F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1`는 이 RED gate에 비춰 아직 실행 가능한 행동이 아니다. 제품 dual lease/Task1을 발급하지 않는다. 이 종료 투영은 복구 가능한 WIP checkpoint로만 보존하고, 별도 non-product 통제 lease에서 fixture와 machine next action을 재결박한 뒤 전체 회귀·독립 검토를 재실행한다.

- F-19A 독립 제품 Package의 신산님 직접 승인 계약을 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`에 결박했다. 비의미 통제·역사 테스트 호환성 재확정 Plan SHA `0CD8309E3FD8C7F507281BF6094D6BA696973FB5AA12F27023E57E1DA51CA26E`, WI rev3 SHA `2D2CED73D8EFFD7E92AD3E34D0725C5AF8B3302129A2ACB615C383727E5C90A9`, frozen seq2138/base `abeab9f4...`, clean private dispatch `53feab5f...`다. seq2139 WI→2140 worker→2141 write를 epoch71의 서로 다른 token/단일 Developer **활성 exact4·제품 scope0**/24시간으로 append-only 투영했다. WI 전체 경로 상한 exact21은 후속 lease의 자동 권한이 아니다. 현재 exact4에는 checker/신규 테스트와 인접 41건 실패의 과거 fixture/시각만 보정할 역사 test 두 파일이 포함된다. 새 checker route와 독립 검토/G-05/정확 control checkpoint를 통과하고 Task0 lease를 회수한 후 별도 제품 dual lease를 발급하기 전에는 제품 write를 시작하지 않는다. 인접 41건은 38 PASS/3 FAIL 상태이고 F-19A 미수락, F-20/U01 REWORK, Release DEFER, Production NOT_EXECUTED다.

- epoch70 exact3 Developer 최종 bytes의 역사/현재 분리 38건 PASS(exit0, 142.953초), active G-05 seq2135 PASS(exit0), diff check0이다. 독립 검토 C0/I0/M0 및 frozen 진행현황/임의 `head_relation` 위조 거절을 확인했다. seq2136 handoff→2137 write revoke→2138 worker revoke를 제품 변경 없이 기록하고 dual lease를 회수한다. 실제 closed clean G-05·38건·원격 동일성은 checkpoint 이후 별도 검증하며, F-20/U-01 전체 미수락·Release DEFER·Production NOT_EXECUTED를 유지한다.

- PMO 조건부 epoch70 test/control successor는 기존 branch clean/private 동일 `b2a44badbec1bb28305870102fc6fd2ee0cac2b3`의 seq2132를 frozen predecessor로 둔다. WI `WI-F20-U01-EPOCH70-POSTCLOSE-FIXTURE-20261006-001` SHA `3FAF9DF456783C331A9EFCFE849E8FA2ECC5557297D5CBBAD39FD49F5DE971AF` 아래 seq2133 WI→2134 worker→2135 write를 별도 token/24시간 만료/Developer exact3·제품 scope0로 발급했다. 직전 closed 38건 중 2 FAIL은 현재 seq2129 하드코딩 테스트 가정이며, 단순 2132 허용으로 우회하지 않는다. 새 mode 구현 전 G-05 RED는 PASS가 아니다. 역사 seq2120·2126·2132 원문과 branch를 보존한다. F-20/U-01 미수락, Release DEFER, Production NOT_EXECUTED.

- epoch69 역사 검증 호환성 절편은 단일 Developer exact4 중 실제 코드3파일만 변경했다. Main 독립 최신 active 동일27+F19A11=38 PASS(exit0, 141.537초), G-05 seq2129 PASS(exit0), diff check0, 독립 C0/I0/M0이다. 추가 음성 테스트의 import 누락은 첫 결합38에서 1 ERROR(exit1)였고 같은 파일 1줄 보정 후 전체 최신 재실행으로 대체했다. 종료 Event는 seq2130 handoff→2131 write revoke→2132 worker revoke로 투영한다. 실제 closed clean G-05/동일38/실원격 equality는 후속 확인 전까지 미검증이다. F-20/U-01 전체 미수락, Release DEFER, Production NOT_EXECUTED.

- PMO 조건부 승인 epoch69 test-only successor는 기존 branch clean/private 동일 `76d71374a80792fd5ffc1150b2fa8c4c1293f5e9`의 seq2126을 frozen predecessor로 둔다. WI `WI-F20-U01-EPOCH67-TEST-COMPAT-20261006-001` SHA `AE545FE4A5854CE4926987C4EEC2497ED70A0D8B8D03CBFAB20B459ADF843653` 아래 seq2127 WI→2128 worker→2129 write를 서로 다른 token/24시간 만료/Developer exact4·제품 scope0로 발급했다. 기존 epoch67 27건 중 26 FAIL은 현재 F-19A 투영을 역사 투영으로 오인한 fixture fingerprint이며, 이 새 route 구현 전 G-05 RED는 PASS가 아니다. 과거 `afa49d2c` seq2120과 `76d71374` seq2126 원문, F-19A closed G-05/17 PASS 증거를 보존한다. 현재 F-20/U-01 미수락, Release DEFER, Production NOT_EXECUTED이며 제품·서버/WSL·main·새 branch 작업은 없다.

- F-19A 문서 control 절편은 local G-05 seq2123 PASS, 신규 focused 11 PASS, R48 인접 6 PASS, 독립 C0/I0/M0로 검증했다. 공통 무결성 누락은 snapshot/참조/handoff 위조 RED→GREEN으로 보완했다. 그러나 이전 epoch67 집중+인접 27건은 현재 새 mode에서 26 FAIL(`EPOCH67_TEST_CURRENT_PROJECTION_ASSUMPTION`)이며 후속 test-only 호환성 작업이 필요하다. 따라서 F-20/U-01 전체 수락과 문서 successor 전체 완료를 주장하지 않는다. 종료 후 seq2126 clean G-05와 원격 동등성은 별도 실측한다.

- PMO 조건부 비제품 종료 fixture successor이다. **과거 handoff의** `repository_head`=`8d5e1bda...`는 계약 문서 successor의 역사적 기준이며 당시 dispatch HEAD는 `7e6978b9af8b5b3205f9b4df0a6d96eea4ab8a42`였다. seq2114까지 Event 원문/hash와 epoch65/66 회수는 동결한다. WI `WI-F20-U01-CLOSED-FIXTURE-20261006-001`/hash `2E08AAB56E051B06F1F6D6EF624EEEBE2A7EA3F836A395F2121E6C78D06B3927` 아래 seq2115 WI→2116 worker→2117 write→2118 handoff→2119 write 회수→2120 worker 회수로 종료한다. Developer exact2 overlay/test 변경은 local `b251bab5`에 기록됐고 제품 scope는 비어 있다.
- 현재 F-19A 문서 revision 전용 control successor는 predecessor clean HEAD `afa49d2c31194c20df653273344116125bc11fda`, WI `WI-F19A-DOC-SUCCESSOR-20261006-001`/SHA `2281621C33C4AD9D3030F4A871F87A18D137BDEE3301487426ECC49FB3D0FD91`에 결박한다. seq2121 WI→2122 worker→2123 write를 별도 epoch68/정확 control code3/제품 scope0으로 발급했고 만료는 `2026-10-07T01:24:31+00:00`이다. 문서4+WORK_STATUS+WI·통제 projection dirty는 승인된 bootstrap 상태이며 G-05 `PRG_REFERENCED_HASH_MISMATCH`/`SUCCESSOR_GIT_INVALID`가 아직 RED다. 단일 Developer가 새 route를 구현하기 전·후 결과를 구분한다. seq1~2120 원문/old binding·AV255 불변, F-20/U-01 미수락·Release DEFER·Production NOT_EXECUTED를 유지한다.
- epoch65·66에서 두 번 반복된 현재 null lease의 과거 active fixture 오용을 실제 seq2114 frozen blob/issued Event로 고쳤다. 회수 전 집중+R48 인접 27건은 Developer/Main 각각 PASS, active G-05 seq2117 PASS, 독립 Critical0/Important0/Minor0이다. 실제 현재 closed seq2120의 같은 27건·clean G-05·private equality는 후속 검증으로 별도 판정한다. 이 증거 전에는 F-20/U-01 수락·Stage GREEN이라 하지 않는다. C30 quarantine history accepted=false, Release `DEFER`, Production `NOT_EXECUTED`.
