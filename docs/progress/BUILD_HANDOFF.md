# F-19A 최소 등록·정확 pair grant Task0 통제 시작 handoff

```json anvil-recovery-summary
{
  "event_sequence": 2141,
  "last_event_id": "evt_f19a_2141_write_lease_issued",
  "status": "ACTIVE",
  "current_work_package": "F-19A",
  "active_agent": "developer-primary-f19a-pair-grant",
  "worker_lease": "worker-lease-f19a-pair-bf64f25d31de4da7944fc4acce11ba77",
  "write_lease": "write-lease-f19a-pair-6c6eed1906634a51ba4478a7f6abf50f",
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F19A_TASK0_CONTROL_ROUTE_RED_GREEN_ONLY",
  "repository_head": "53feab5fa6ad0755c5c308117c756eafd371cb8c",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-19A 독립 제품 Package의 신산님 직접 승인 계약을 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`에 결박했다. 비의미 통제·역사 테스트 호환성 재확정 Plan SHA `0CD8309E3FD8C7F507281BF6094D6BA696973FB5AA12F27023E57E1DA51CA26E`, WI rev3 SHA `2D2CED73D8EFFD7E92AD3E34D0725C5AF8B3302129A2ACB615C383727E5C90A9`, frozen seq2138/base `abeab9f4...`, clean private dispatch `53feab5f...`다. seq2139 WI→2140 worker→2141 write를 epoch71의 서로 다른 token/단일 Developer **활성 exact4·제품 scope0**/24시간으로 append-only 투영했다. WI 전체 경로 상한 exact21은 후속 lease의 자동 권한이 아니다. 현재 exact4에는 checker/신규 테스트와 인접 41건 실패의 과거 fixture/시각만 보정할 역사 test 두 파일이 포함된다. 새 checker route와 독립 검토/G-05/정확 control checkpoint를 통과하고 Task0 lease를 회수한 후 별도 제품 dual lease를 발급하기 전에는 제품 write를 시작하지 않는다. 인접 41건은 38 PASS/3 FAIL 상태이고 F-19A 미수락, F-20/U01 REWORK, Release DEFER, Production NOT_EXECUTED다.

- epoch70 exact3 Developer 최종 bytes의 역사/현재 분리 38건 PASS(exit0, 142.953초), active G-05 seq2135 PASS(exit0), diff check0이다. 독립 검토 C0/I0/M0 및 frozen 진행현황/임의 `head_relation` 위조 거절을 확인했다. seq2136 handoff→2137 write revoke→2138 worker revoke를 제품 변경 없이 기록하고 dual lease를 회수한다. 실제 closed clean G-05·38건·원격 동일성은 checkpoint 이후 별도 검증하며, F-20/U-01 전체 미수락·Release DEFER·Production NOT_EXECUTED를 유지한다.

- PMO 조건부 epoch70 test/control successor는 기존 branch clean/private 동일 `b2a44badbec1bb28305870102fc6fd2ee0cac2b3`의 seq2132를 frozen predecessor로 둔다. WI `WI-F20-U01-EPOCH70-POSTCLOSE-FIXTURE-20261006-001` SHA `3FAF9DF456783C331A9EFCFE849E8FA2ECC5557297D5CBBAD39FD49F5DE971AF` 아래 seq2133 WI→2134 worker→2135 write를 별도 token/24시간 만료/Developer exact3·제품 scope0로 발급했다. 직전 closed 38건 중 2 FAIL은 현재 seq2129 하드코딩 테스트 가정이며, 단순 2132 허용으로 우회하지 않는다. 새 mode 구현 전 G-05 RED는 PASS가 아니다. 역사 seq2120·2126·2132 원문과 branch를 보존한다. F-20/U-01 미수락, Release DEFER, Production NOT_EXECUTED.

- epoch69 역사 검증 호환성 절편은 단일 Developer exact4 중 실제 코드3파일만 변경했다. Main 독립 최신 active 동일27+F19A11=38 PASS(exit0, 141.537초), G-05 seq2129 PASS(exit0), diff check0, 독립 C0/I0/M0이다. 추가 음성 테스트의 import 누락은 첫 결합38에서 1 ERROR(exit1)였고 같은 파일 1줄 보정 후 전체 최신 재실행으로 대체했다. 종료 Event는 seq2130 handoff→2131 write revoke→2132 worker revoke로 투영한다. 실제 closed clean G-05/동일38/실원격 equality는 후속 확인 전까지 미검증이다. F-20/U-01 전체 미수락, Release DEFER, Production NOT_EXECUTED.

- PMO 조건부 승인 epoch69 test-only successor는 기존 branch clean/private 동일 `76d71374a80792fd5ffc1150b2fa8c4c1293f5e9`의 seq2126을 frozen predecessor로 둔다. WI `WI-F20-U01-EPOCH67-TEST-COMPAT-20261006-001` SHA `AE545FE4A5854CE4926987C4EEC2497ED70A0D8B8D03CBFAB20B459ADF843653` 아래 seq2127 WI→2128 worker→2129 write를 서로 다른 token/24시간 만료/Developer exact4·제품 scope0로 발급했다. 기존 epoch67 27건 중 26 FAIL은 현재 F-19A 투영을 역사 투영으로 오인한 fixture fingerprint이며, 이 새 route 구현 전 G-05 RED는 PASS가 아니다. 과거 `afa49d2c` seq2120과 `76d71374` seq2126 원문, F-19A closed G-05/17 PASS 증거를 보존한다. 현재 F-20/U-01 미수락, Release DEFER, Production NOT_EXECUTED이며 제품·서버/WSL·main·새 branch 작업은 없다.

- F-19A 문서 control 절편은 local G-05 seq2123 PASS, 신규 focused 11 PASS, R48 인접 6 PASS, 독립 C0/I0/M0로 검증했다. 공통 무결성 누락은 snapshot/참조/handoff 위조 RED→GREEN으로 보완했다. 그러나 이전 epoch67 집중+인접 27건은 현재 새 mode에서 26 FAIL(`EPOCH67_TEST_CURRENT_PROJECTION_ASSUMPTION`)이며 후속 test-only 호환성 작업이 필요하다. 따라서 F-20/U-01 전체 수락과 문서 successor 전체 완료를 주장하지 않는다. 종료 후 seq2126 clean G-05와 원격 동등성은 별도 실측한다.

- PMO 조건부 비제품 종료 fixture successor이다. **과거 handoff의** `repository_head`=`8d5e1bda...`는 계약 문서 successor의 역사적 기준이며 당시 dispatch HEAD는 `7e6978b9af8b5b3205f9b4df0a6d96eea4ab8a42`였다. seq2114까지 Event 원문/hash와 epoch65/66 회수는 동결한다. WI `WI-F20-U01-CLOSED-FIXTURE-20261006-001`/hash `2E08AAB56E051B06F1F6D6EF624EEEBE2A7EA3F836A395F2121E6C78D06B3927` 아래 seq2115 WI→2116 worker→2117 write→2118 handoff→2119 write 회수→2120 worker 회수로 종료한다. Developer exact2 overlay/test 변경은 local `b251bab5`에 기록됐고 제품 scope는 비어 있다.
- 현재 F-19A 문서 revision 전용 control successor는 predecessor clean HEAD `afa49d2c31194c20df653273344116125bc11fda`, WI `WI-F19A-DOC-SUCCESSOR-20261006-001`/SHA `2281621C33C4AD9D3030F4A871F87A18D137BDEE3301487426ECC49FB3D0FD91`에 결박한다. seq2121 WI→2122 worker→2123 write를 별도 epoch68/정확 control code3/제품 scope0으로 발급했고 만료는 `2026-10-07T01:24:31+00:00`이다. 문서4+WORK_STATUS+WI·통제 projection dirty는 승인된 bootstrap 상태이며 G-05 `PRG_REFERENCED_HASH_MISMATCH`/`SUCCESSOR_GIT_INVALID`가 아직 RED다. 단일 Developer가 새 route를 구현하기 전·후 결과를 구분한다. seq1~2120 원문/old binding·AV255 불변, F-20/U-01 미수락·Release DEFER·Production NOT_EXECUTED를 유지한다.
- epoch65·66에서 두 번 반복된 현재 null lease의 과거 active fixture 오용을 실제 seq2114 frozen blob/issued Event로 고쳤다. 회수 전 집중+R48 인접 27건은 Developer/Main 각각 PASS, active G-05 seq2117 PASS, 독립 Critical0/Important0/Minor0이다. 실제 현재 closed seq2120의 같은 27건·clean G-05·private equality는 후속 검증으로 별도 판정한다. 이 증거 전에는 F-20/U-01 수락·Stage GREEN이라 하지 않는다. C30 quarantine history accepted=false, Release `DEFER`, Production `NOT_EXECUTED`.
