# FN02 명시 forward helper 실제 등록 결과

2026-10-20 / Main 어울 / 한정 격리 PASS. 정식 DB 적용·서비스 반영·전체 FN02 완료가 아니다.

## 정확 후보·변경 이유

실행 SHA `0bc01ce61cb9f56aa41a0ecf48f3548979c73f25`, 기존 private `codex/av3-stage-b` exact. SQL E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6·helper190441A5756967F535A911EADDAECCDEB8B01D6CD15226AF7BA86ABDBC8F6A9D는 code-only 채택2b105481과 같다. 새 시험 F73C7F0E04FB4EE18879F90C60ED81C84263CF58AA06798868AA91E0D7711D6D / runner8A5550A24B4EDB75E97E0366B82B446E772A34B42148D7EEC20744C21ABC1BE4 / 범위6D0872AAB840ACCC62A5FC3DFE0689FF9BD2CD1AC8B4CA09CE8F75CF333A082C를 실행 전 동결했다. 기존 manifest53 파일92C6489DEBEF44DC978AAA5654F161349D8349303D7D48B60B7FD6BBC80ED7AE에서 이번 parent는0031 이전의52만 구성한다.

원 독립 C0/I1/M0은 실패 정리에서 follower rollback 뒤 helper가 재개되어 TX 밖 DDL을 계속할 수 있다는 지적이다. 실제 PG 실행 전에 종료 flag·query/COMMIT 직전 검사·leader rollback→pending 수렴→follower rollback/release로 보완했고 scoped C0/I0/M0다. 실제 잠금 관찰 뒤 강제 실패 음성을 추가했다. 원 지적/초기1842 지문은 보존한다.

같은 원인인 이전 history 시험도 source A72CC9B1로 좁게 보완하고 별도 scoped C0/I0/M0를 받았다. 이전15e436ad 정상 경합 결과를 새 history 실패 경로 PASS로 소급하지 않는다. 이번에 history는 실행하지 않았다.

## 실제 명령·결과

생성 전 QA01 경로/PG/network 부재·부모 실경로/nonlink/owner·UID1000·daemon/image·정식PG/포트 불변을 확인했다. 새 빈 Git의 exact SHA/clean·6개 지문 일치, Node24.21.0/npm11.19.0·등록 전용 cache의 `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/anvil-v3-fn02-empty-application-01/npm-cache` exit0/102packages를 확인했다. npm12 알림은 업그레이드하지 않았다.

등록 SHA/SQL hash/20분 만료 아래 `node --experimental-strip-types scripts/qa-fn02-empty-application.ts --registration`: **exit0/DONE**, failure·cleanupFailure·diagnostic null. parent52 actual/expected 일치·checksum 차이0.

- `EXPLICIT_HELPER_DDL_ROLLBACK_RESTORES_52`: 호출자 BEGIN/advisory lock 아래 실제 helper의0031 DDL/metadata가 TX 안에서53이 된 후 rollback, 별도 조회52/column0 복원.
- `ABORTED_OBSERVATION_FOLLOWER_DDL_COMMIT_ZERO`: 실제 advisory lock 대기 관찰 후 강제 관찰 실패를 주입, leader DDL1은 rollback·follower helper 시작/DDL/COMMIT 각각0, 별도52/column0·기존 metadata 복원.
- `CONCURRENT_EXPLICIT_HELPER_COMMIT_SINGLE_DDL_REPLAY_NO_DDL`: 새 정상 TX에서 첫 helper 적용1DDL/COMMIT, 같은 advisory lock 대기 SQL 관찰 후 후속 명시 호출 applied=false/DDL0·COMMIT. 실제 전달되는 SQL을 계수했고 단순 상수 보고가 아니다.
- `EXACT_53_OLD_GUARD_UNCHANGED_NO_SEED`: 최종 정확53 ID/hash·과거52행·초기 guard 정의 불변·column1, users/projects/methodology catalog/QA fixtures0. parent도 최종53 hash/old guard 재조회.
- formalCliExecuted=false, 실제 Agent0, 정식DB 변경0.

이는 helper와 caller transaction 패턴의 실제 검수다. 정식 CLI의 대상/config를 QA DB로 위장하거나 정식 CLI가 실제 실행됐다고 주장하지 않는다. 기존 모든 기능 시험도 다시 돌리지 않았다. 신규 Pool.connect ReturnType overload의 type 오류1은 PoolClient 명시로 보완/type0, Windows 시험 FN02_EXACT_REGISTRATION_QA_REQUIRED·runner FN02_QA_PATH_INVALID exit1은 기대 환경 거절/자원0으로 분리한다.

## 정확 정리·복구

- PG fullID `4e175ed2de182b646788af56bba8aebe08f5905cd7ee8acb44b6e1507dea17ab`, network `00cb9557f0a75d62a8967d41b0421859209ec0e14078654ac4f6535a53626022`, instance `612f584c84af9737c451fca86ae3a423`.
- owner AV3_FN02_EMPTY_APPLICATION_QA/newinstance/동일 daemon·PG15 image594290/internal/tmpfs256MiB/publish0·mount0·정확 ID/label 검사 후 runner finally 회수.
- 등록 Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`, tmp/cache `/tmp/anvil-v3-fn02-empty-application-01`의 exact SHA/clean·소유·링크·process0/hash/inode/dev 확인 후 개별 파일/빈 dir로 회수했다. 7382files/1058dirs/13links/360169313bytes, 목록 지문 `b0fa3b16d37904f16ab23dd0c28a8c401b331e06b6f9b2b4e96a135a9395658c`.
- 별도 SSH exit0: 등록2경로/PG/network 잔여0. 정식PG e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba의 exited/Runningfalse/Pid0/Exit0/OOMfalse·Started2026-10-18T15:25:12.085069883Z/Finished2026-10-19T12:56:52.490883698Z·image594290/127.0.0.1:5546 정의 불변. Windows3830/5546 listener0.
- source는 private exact commit으로 복구 가능하며 정식 데이터·기존 SQL을 되돌리거나 down migration을 실행하지 않았다. PMO 전달1회는 UI의 `Cannot steer conversation ... without an active turn id`로 실패했으나 실행 승인 거절이나 Git/PG 실패가 아니며 우회하지 않았다. 이후 실제 결과를 따로 전달한다.

## 남은 실제 연결

정식 DB의 최신 live schema는 조회0이고 마지막 보존 기록은46·현재 컨테이너는exited다. 현재 helper는 정확52 선행이 아니면 거절하므로 정식46→53을 자동 실행하지 않는다. 누락6개 선행의 기존 승인/검수·정식 채택, 정식 현재 ID/manifest/백업·지속자료 영향/복구·실행 명령·서비스 반영 범위를 별도로 대조해야 한다. 보완 history의 실패 경로 actual, 실제 grant/완료 실행 이력·NEW_PROJECT_DRAFT 전체·비RC 정상 호환·정식 served/사용자 인수도 이번 PASS의 범위가 아니다.
