# P03 R2 제한 복제 단발 실행 결과 — 2026-10-28

## 1. 판정과 작성 범위

**NOT_COMPLETE / create-tools / IDENTITY_UNKNOWN.** 실제 단발 실행 `a08583`은 exit 1로 끝났다. 승인 원장은 소비됐고 R2 volume과 tools helper가 생성됐으나, 복사 및 PostgreSQL 단계에는 도달하지 못했다. 성공으로 소급하지 않으며 전체 P03 기능·작업계획은 미완료다.

후속 별도 PMO 승인에 따라 미시작 tools helper 1개를 정상 rm으로 회수했고 독립 조회로 부재를 확인했다. 현재 잔여 helper는 **0개**다. 원본/R1/R2 volume과 R1/R2 ledger는 의도적으로 보존하는 자원이며 미회수 helper 오류와 구분한다.

이 결과서는 Main이 전달한 실제 실행·후속 읽기 관측과 독립 source 검토를 구분하여 기록한다. 결과서 담당자는 원격 명령·제품 수정·시험·Git 변경을 실행하지 않았다. 작업현황 갱신과 후속 실행 판단은 Main 소유다.

## 2. 승인·실행 결박

| 항목 | 고정 값 |
| --- | --- |
| 직접 승인 SHA256 | `FD568644022D0566482668CC8ACC89E4E697726534E48AD5AD149B6DF2880D35` |
| 승인 근거 | 신산님 원 직접 답변 및 PMO 원 turn; 실행 허용 시간 `2026-10-28T05:07:50Z` 이상, `05:37:50Z` 이내 |
| 실행 packet | `docs/work_packages/P03_R2_LIMITED_COPY_ONCE_EXECUTION_DECISION_PACKET_20261028.md` |
| packet SHA256 | `662FEF2E1913B2CCF770052ED631D5C74A4D76C142A6FB543A379721F6D3A64B` |
| exact source | `8e9292d83c4ebe857919480b0d3468a0f7c1eaa3` |
| controller Git LF SHA256 | `532621070134EC7AE63151DEE3F25EFD7D49456CC7481E4C79401157E1695261` |
| shell Git LF SHA256 | `CF6B604C2EBB3DC8552C9F341934CC00A5F7970AD8B2F17C1435DF6B14C0A9C8` |
| R2 candidate SHA256 | `467A5FFF50C0C22D76F283AF144A312E8BA7D805AA5E5F12AF52870FB63064AF` |
| nonce | `06c4c4d535836be65745a7de63822a8c` |
| R2 QA root | `/home/daon/anvil-v3-pgcopy-20261028-r2-src` |
| R2 ledger | `/home/daon/.local/share/anvil-v3-pgcopy-20261028-r2` |
| R2 volume | `anvil-v3-pgdata-recovery-20261028-r2` |
| tools / init / copy helper | `anvil-v3-pgcopy-tools-20261028-r2` / `anvil-v3-pgcopy-init-20261028-r2` / `anvil-v3-pgcopy-20261028-r2` |

R1 단발 승인·소비 원장을 R2 실행 권한으로 재사용하지 않았다.

## 3. 실행 경과와 원증거

아래 raw tool ID는 Main 실행·관측 증거를 가리킨다. 명시한 offset 외 시각은 UTC다.

| raw tool | 실제 관측·조작 결과 |
| --- | --- |
| `cafb36` | 준비 시 exact 대상 부재와 도구 신원을 확인. |
| `61f073` | 원 Git full fetch는 약11분. local observer의 120초 종료는 remote process 종료가 아니다. 동일 PID를 추적했다. |
| `9bf106` | 취소 조작은 ledger 생성 검사에서 중단. TERM 미실행, 재 fetch 미실행. |
| `39f01b` | `05:21:30Z`, exact source clean, grant 미소비, 추적 대상 4 PID 부재 확인. |
| `a08583` | 단발 실행 exit 1. `NOT_COMPLETE / create-tools / IDENTITY_UNKNOWN`. |
| `5c877c` | `05:22:34Z`, volume·helper·ledger 실제 상태를 읽기 확인. 아래 상세 참조. |
| `137150` | `05:24:57.808Z`, QA exact 소유·링크·관련 프로세스0·Git clean 검사 후 QA root `2902 files / 178 dirs / 234005789 bytes` 삭제, `absent=true`. |
| `21dff0` | exit 0, `05:25:53.400182Z` 독립 후속 조회. QA absent, tools 1개 보존, init/copy helper 부재, volume 3개의 consumers empty, R1/R2 ledger와 기록 파일의 권한·소유·링크 조건 유지 확인. |
| `6598d6` | 읽기 관측 도구의 `KeyError: 'Mounts'`. 제품 실행 실패와 별도인 도구 오류이며, 후속 전체 관측으로 실제 key 부재를 구분했다. |
| `5b91c1` | `05:28:21.767566Z` 전체 관측에서 23 checks 모두 true. 원 `ownLimited` 실패 비교는 정확히 `HostConfig.Mounts` key 부재와 runtime `Mounts=[]`의 두 조건으로 대조했다. |
| `fb3a9b` | `05:35:03.730012Z` 23 checks 모두 재대조 true 확인 후, 승인된 tools full ID 1개에 normal docker rm 실행. force/-v 없이 `05:35:03.841806Z` exit 0. 원본/R1/R2 volume metadata 동일·consumer0 및 ledger 6파일 원 bytes 동일 확인. |
| `b3e337` | `05:35:24.402016Z` 독립 조회 exit 0. tools/init/copy 3이름 및 tools full ID 부재, QA 부재. 원본/R1/R2 instance·Created 보존·consumer0, R1/R2 각각 3파일 regular/0600/uid1000/nlink1 보존 확인. |

최초 실행 receipt 결과는 다음과 같다. 후속 별도 회수 이후에도 이 원 receipt bytes는 변경하지 않았다.

```text
status=NOT_COMPLETE
phase=create-tools
failure=IDENTITY_UNKNOWN
consumed=true
copyCreated=true
receiptFailed=false
pendingIO=false
tools.id=852c2c92cb99a14b365154f9e7ab36f27e03714e5dc69761cd0f72c5d3db8f35
tools.closed=false
tools.removed=false
```

`consumed=true`는 실행 성공을 뜻하지 않는다. 복제 승인은 이 실패한 단발에서 소비됐다. cp·PG 단계 미도달이며 데이터 복제·PG 기동·복구 성공을 증명하지 않는다.

## 4. 실패를 설명하는 source 조건

`scripts/p03-pg-copy-host.ts`의 `ownLimited`(328행 부근)는 tools 요청 mount 배열 `[]`와 `HostConfig.Mounts` 일치 및 구성상 tmpfs를 포함한 실제 mount 배열 일치를 검사한다. `inspect`는 불일치 시 `IDENTITY_UNKNOWN`으로 거절한다.

`5c877c`의 실제 tools inspect는 다음 상태였다.

```text
Id=852c2c92cb99a14b365154f9e7ab36f27e03714e5dc69761cd0f72c5d3db8f35
Created=2026-10-28T05:22:02.108511656Z
State.Status=created
State.Running=false
State.Pid=0
State.StartedAt=0001... (미시작 값)
Config.User=999:999
Image=sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f
Mounts=[]
HostConfig.Mounts=ABSENT (당시 get 결과 null; 실제 key 부재는 5b91c1에서 확인)
HostConfig.Tmpfs={"/var/lib/postgresql/data":"rw,noexec,nosuid,nodev,size=33554432,uid=999,gid=999,mode=0700"}
NetworkMode=none
```

최초 `5c877c` 요약의 get 결과는 `null`로 표현됐지만, 후속 `5b91c1`에서 `HostConfig.Mounts` key 자체가 없음을 확인했다. 기대 `[]`와의 비교 및 미시작 runtime `Mounts=[]`와 기대 tmpfs mount의 비교가 각각 false가 된다.

초기 판정 이력: 두 조건으로 실패를 충분히 설명했지만 다른 predicate 전체 관측이 없어 유일 원인을 확정하지 않았다. 이 판정은 당시 증거 범위에 따른 것으로 보존한다.

후속 판정: `5b91c1` 전체 관측의 23 checks는 모두 true였고 원 `ownLimited`의 실패 비교는 위 두 조건으로 대조됐다. PMO도 실제 출력을 직접 대조했다. `fb3a9b`는 회수 직전 같은 23 checks를 재확인했다. 이 대조는 실제 관측 시점의 신원·상태 증거이며, source 수정이나 복제 재실행 성공 증거가 아니다. `6598d6`의 KeyError는 별도 읽기 도구 오류로 구분한다.

## 5. 잔존 자원과 보존

`5c877c`는 원본/R1 metadata가 종전과 동일하고 R2 volume의 `CreatedAt=2026-10-28T14:22:01+09:00`, labels/nonce, driver `local`, 각 volume consumer가 비어 있음을 확인했다. 이는 metadata·연결 상태 관측이며 내용 동일성이나 DB 정합성 증명이 아니다.

`21dff0` 당시의 보존 이력은 다음과 같다. 아래 잔존 1개는 후속 회수 이전 사실이다.

- 원본 `anvil-v3-development-pgdata`, R1 `anvil-v3-pgdata-recovery-20261027-r1`, R2 `anvil-v3-pgdata-recovery-20261028-r2`. 각 consumers는 empty.
- tools helper full ID `852c2c92cb99a14b365154f9e7ab36f27e03714e5dc69761cd0f72c5d3db8f35` **1개 잔존**. 미시작 `created` 상태로 close/remove되지 않았다. init/copy helper는 부재.
- R1/R2 ledger. directory `0700`, 기록 3파일 `0600 / regular / uid 1000 / nlink 1` 유지.
- QA source root 삭제 완료, 독립 후속 조회에서도 absent.

R2 기록 파일 지문은 다음과 같다. 각 파일은 `0600 / uid 1000 / nlink 1`.

| 기록 | SHA256 | bytes |
| --- | --- | ---: |
| grant | `83e7333ec47938fe507682102834189afd0298677306d22697fa08832b6c5706` | 2322 |
| consumed | `f3e349a8aea1069cc4d6a11fda73a55453e8280678b797b2b896384407ad637d` | 447 |
| receipt | `103252b959f1898b7e3cbe90af2df400fe884845dedf4ec4b95724e7344f2604` | 1272 |

## 6. 별도 승인에 따른 회수와 현재 상태

초기 판단 이력: 원 packet의 정상 종료 helper 회수는 exact identity/full ID와 실제 close, `exited`, ExitCode 0 등의 조건 충족 후 rm을 대상으로 했다. 당시 tools는 `created / Pid 0 / closed=false`로 범위 밖이므로 보존하고 PMO에 별도 exact cleanup 지원을 요청했다.

후속 별도 승인 기록은 `docs/approvals/P03_R2_CREATED_HELPER_EXACT_CLEANUP_PMO_20261028.json`, SHA256 `42A51EC0112BD52E4563F13A689BB36C6CDE556C77D31E8A38F5C349D27E3639`이다. PMO가 실제 출력을 직접 대조한 뒤 exact created helper 1개에 normal docker rm만 승인했다. Main은 `fb3a9b`에서 full ID `852c2c92cb99a14b365154f9e7ab36f27e03714e5dc69761cd0f72c5d3db8f35`를 force/-v 없이 1회 제거해 exit 0을 확인했다. start·TERM·복제 재실행은 하지 않았다.

`b3e337` 독립 확인 기준 현재 QA root와 tools/init/copy helper 3이름 및 tools full ID는 부재하며 잔여 helper는 **0개**다. 원본/R1/R2 volume의 instance·Created 및 consumer0, R1/R2 ledger 각각 3파일의 regular/0600/uid1000/nlink1을 유지했다. `fb3a9b`에서 ledger 6파일 원 bytes 동일, R2 grant/consumed/receipt는 위 표 지문 그대로임을 확인했다. 보존 volume·ledger는 의도된 보존 자원이며 잔여 회수 오류가 아니다.

원본/R1/R2 volume과 소비 기록을 보존한다. 원 R1 단발 소비 이력과 이번 실패를 취소하지 않는다. 재복제 승인은 남아 있지 않다. 동일 계약 안의 source-only 내부 오류 보완은 기존 승인 범위에서 진행하되, 새 grant·실제 재복제는 새 exact source·대상·수명과 별도 실행 결정을 갖춘 뒤에만 진행한다.

미검증은 데이터 복사, PostgreSQL 기동·SQL·복구 및 보존 자원 내용 정합성이다. 실 cp0·PG0과 복제 NOT_COMPLETE·승인 소진은 회수 후에도 불변이다. 이를 PASS로 표시하지 않으며 앞선 source-only 시험 합격이나 이번 회수 성공을 실제 복구 성공으로 승격하지 않는다.

이번 추가는 결과서 1파일에 한정한다. 제품·시험·Git·원격 실행은 결과서 담당자가 수행하지 않았고 WORK_STATUS는 Main이 관리한다.
