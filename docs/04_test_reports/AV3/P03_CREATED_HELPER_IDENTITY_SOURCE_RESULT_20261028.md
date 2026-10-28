# 현재 판정 — P03 created helper / tmpfs I1 후속 정정

2026-10-28 · 담당 fn05_share_request_impl · **source-only 한정 보완 및 Main 직접검증 완료 / 실제 새 복제 NOT_RUN**.

이 절이 아래 과거 결과서의 현재 판정·최종 지문보다 우선한다. 원 결과서 SHA256 **0A2ABDD2C31088DD37673CD4645A73F567597E700B6F738A7ED353F07C187484**의 본문은 아래에 이력으로 그대로 보존했다. 최초 62PASS와 당시 독립 C0/I0/M0는 잘못된 started tmpfs 합성 fixture를 포함한 당시 검수 결과다. 공식 Moby 근거로 I1이 확인된 뒤 현재 actual 준비 합격 근거로 사용하지 않았으며, 원 FAIL을 소급 PASS로 바꾸지 않는다.

## 권위·한정 변경

- 최신 WI: `docs/work_packages/P03_CREATED_HELPER_IDENTITY_SOURCE_WI_20261028.md`, SHA256 **C1C7F56EEF3E281E54C1793996FFE7A83C437FC290384EDA968E43809F3D5B1F**. 시작 HEAD4482cf099b1095f6f5f463c946411f31e03828cd와 기존 branch를 유지했다. 후속 I1은 기존 controller/host·time 시험3에 shell/preparation 시험2만 추가한 제품2·시험3 범위다.
- `--tmpfs`의 HostConfig.Tmpfs와 inspect.Mounts를 구분했다. controller는 created/started 양쪽에서 정확 volume-only Mounts를 검사하고 HostConfig.Tmpfs exact 검사를 유지한다. start 뒤 tmpfs를 append하던 두 fixture를 제거했다. 시작후 HostConfig 누락/옵션 변경, volume 누락·추가 runtime mount·created 재등장 음성을 보존·강화했다.
- shell은 strict/limited tools·init·copy 실제 함수의 첫 쓰기 전에 tmpfs guard를 호출한다. mountinfo를 control256KiB+1까지만 메모리로 읽고 cap 초과/NUL/읽기불명을 거절한다. separator 전 rw/noexec/nosuid/nodev와 이후 tmpfs/size33554432(32768k 동치)를 구분하며 누락·중복·잘못된 형식/escaping·overflow·모순 owner/mode를 거절한다. stat의 정규 directory/nonlink·정확 uid/gid·700을 별도 확인한다. init uid/gid0 super옵션 생략은 stat0 0 700 확인을 대신하지 않는다.
- State 단계, init/copy 시작전 원·사본 volume exact, tools HostConfig absent|[] 한정 동치, startedHelpers·closed/exited/ExitCode·TERM/rm 조건은 유지했다. 고정 R2 이름·원본 identity·프로토콜·argv·기한·consume 단발·보존·grant/decision 닫힌키는 변경0이다. 신규 의존성/실행권한은 없다.

WI의 근거는 [Moby TmpfsMounts/GetMountPoints](https://github.com/moby/moby/blob/v28.5.2/container/container_unix.go#L371), [inspect](https://github.com/moby/moby/blob/v28.5.2/daemon/inspect.go#L43), [volume 구성](https://github.com/moby/moby/blob/v28.5.2/daemon/volumes.go#L171), [Docker tmpfs](https://docs.docker.com/engine/storage/tmpfs/), [kernel tmpfs](https://docs.kernel.org/filesystems/tmpfs.html), [mountinfo 형식](https://man7.org/linux/man-pages/man5/proc_pid_mountinfo.5.html)이다. 자료 버전은 실제 host Docker 버전 확인을 뜻하지 않는다.

## I1 TDD·오류 이력·최종 검증

| 증거 | 실제 결과·해석 |
|---|---|
| author e98e99, 제품3088/shellCF6B 기준 | volume-only time 선택1=0P1F, start-tools/IDENTITY_UNKNOWN. preparation 신규2=0P2F: guard 부재91, 실제 tools 함수 guard0/capture1. 실제 환경 포트 없이 I1 RED 확인 |
| author a0555d 저장 오류 | controller의 expectedMounts2곳 저장 뒤 shell 메모리 patch의 replacement 특수치환으로 anchor 중복. shell/test 추가 저장0에서 중단. callback 치환으로 교정. 기능 FAIL·실환경 실행 실패와 분리 |
| author 515983 | 신규 guard2PASS/2618.8229ms/exit0 |
| author c274d6/session91526→45981a | 직접3=122PASS/0FAIL/0SKIP/0CANCEL/0TODO,14333.2092ms/exit0. 아래 마지막 malformed flag 보완 전 source 시점의 결과 |
| author b1c7a7 | malformed rw=값 음성2개를 기존 I1에 추가한 뒤 I1 선택4PASS/3930.4506ms/exit0. 부분검사이므로 LF 필수 회귀를 발견하지 못함 |
| Main a2383e/session7559→4896c1 | 직접3 exit1. preparation 첫 shell LF 필수 assertion FAIL. 정확 전체 count는 원 도구 결과를 따른다. source rawC59와 LF769의 차이는 마지막 보완에서 삽입한 CR2개였음. author 앞선122PASS를 이 시점의 최종 전체 PASS로 승격하지 않음 |
| author 0f4755 | shell CR2→0, 동작 변경 없이 LF 정합. hosttest133의 “start 뒤 materialize” 낡은 주석을 volume-only/HostConfig 별도 검사 설명으로 정정. 독립 spec C0/I0/M1의 M1 대응 |
| author 868855/0e703e/9fcfc3/1af415 | LF 필수 선택1PASS/310.8476ms/exit0, type0, Bash-n0, 정확5 diffcheck0. EOL 예고 외 오류0 |
| Main 77dbe2/session51925→5b9360 | 최종 직접3 **122PASS/0FAIL/0SKIP/0CANCEL/0TODO**,14569.3845ms,exit0 |
| Main d57c0e | 최종 type/Bash 구문/diff 검사 exit0 |

최종 직접3은 host/time의 공개 strict/limited 가짜 ports와 preparation의 합성 Bash를 포함한다. mountinfo/stat 포트만 mock하며 실제 /proc를 읽지 않았다. guard 거절 뒤 실제 mode 함수의 capture/parse 등 후속 진입0을 관측했고, bounded reader는 stdin으로 cap 경계와 NUL을 검증했다. directory/nonlink 실패는 stat 포트 거절 음성으로 검사했으며 실제 helper 파일시스템 검증이 아니다. 원 security 기대·timeout·권한·cleanup 기준 완화0이다.

정확 명령(cwd는 등록 source 참조):

```text
node --test --test-reporter=spec --test-name-pattern=I1 tests/unit/P03/pg-recovery-copy-preparation.test.ts
node --test --test-reporter=spec --test-name-pattern="created actual|created.*정상|created/started" tests/unit/P03/pg-recovery-copy-docker-time.test.ts
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts
node --test --test-reporter=spec --test-name-pattern="shell source 존재/LF" tests/unit/P03/pg-recovery-copy-preparation.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
"C:/Program Files/Git/bin/bash.exe" --noprofile --norc -n scripts/pg-recovery-copy.sh
git diff --check -- scripts/p03-pg-copy-host.ts scripts/pg-recovery-copy.sh tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts
```

## 최종 동결5 지문

| 저장소 상대경로 | raw SHA256 | LF SHA256 |
|---|---|---|
| scripts/p03-pg-copy-host.ts |AF61BAF27184529505689B5BAE68ACDDFBF2E0B4406DF5D8486312F636449ABC|E900E1C38D405ADF3B9723437E43D93437102060E6FD0F168D48022FFB6E28D8|
| scripts/pg-recovery-copy.sh |76952702BA93E48ACE81A879C19D0190A7CE3D4EA5A7374B0E494AD650335271|76952702BA93E48ACE81A879C19D0190A7CE3D4EA5A7374B0E494AD650335271|
| tests/unit/P03/pg-recovery-copy-host.test.ts |29902D848B7CBDF45649DAD924EF006914074BA5EF8365CC10BC682AA2DCF05F|49355D2773604BCBAAD32AD12A18DA48081A65956429F9F23E24E8AE1CC20D1D|
| tests/unit/P03/pg-recovery-copy-docker-time.test.ts |95A87C0A3B922D92DF6B7701C7183A3D75D8D27340C3781DDFA8EBA9B756D270|95A87C0A3B922D92DF6B7701C7183A3D75D8D27340C3781DDFA8EBA9B756D270|
| tests/unit/P03/pg-recovery-copy-preparation.test.ts |40E275DBBB57F4018CEFD61682C1580FD6685BD5D84E5CC1F1C8A9411F35E782|0AE9F88BEF6C965CA908E9059574A8236B7E063568028D0DC9D1D128FEB1A0E1|

shell 실제 CR byte0을 확인했다. 원 actual source8e9292d8/controller GitLF532621… 및 I1 전3088 지문은 각각 그 시점의 이력이며 새 source로 대체하지 않는다.

## 미검증·다음 조치·rollback

실제 Docker/WSL/helper/runtime mount/원내용cp·신호·chmod/chown·volume/원장·DB/SQL/PG·권한/서비스/Agent·새 grant/실제 재복제는 **NOT_RUN/실효과0**이다. 실제 host Docker 버전 및 init/copy/started kernel mount shape는 미확인이다. R2 actual의 원 FAIL/NOT_COMPLETE와 승인 소진, R1/R2 사본·원장 보존은 그대로다. source PASS는 실행 허가가 아니며 소진된 grant를 재사용하지 않는다. 전체 P03·복구·작업계획 인수는 미완료다.

Main의 checkpoint·통합 뒤 새 exact source/resource 후보와 별도 실행 승인이 필요하다. rollback은 Main이 허용5파일의 source diff만 선택 복구하는 범위다. 원 actual 이력·소진 승인·보존 사본/원장을 되돌리거나 지우지 않는다. 작성자는 결과서1 외 추가 수정·검사·Git 작업 없이 동결한다.

---

## 이전 결과서 원문 보존 — SHA256 0A2ABDD2C31088DD37673CD4645A73F567597E700B6F738A7ED353F07C187484

아래의 “최종/완료”, started tmpfs fixture 설명과3파일 범위는 최초 검수 당시 표현이며 현재 효력은 위 I1 후속 정정을 따른다.

# P03 created helper 신원 검사 source 보완 결과

2026-10-28 · 담당 fn05_share_request_impl · **source-only 한정 검수 완료 / 실제 새 복제 미실행**.

## 판정·권위

Main의 정확 허용3파일에서 strict/limited의 created/started 신원검사를 분리했다. Main fresh 직접시험62PASS·type/diff0, 독립 quality **C0/I0/M0**로 필수 보완0이다. 합성 ports의 결과이며 실제 Docker/WSL/helper/cp/신호/volume/원장/PG/DB/서비스/Agent·새 grant 실행은0이다. 전체 P03·복구·작업계획 완료가 아니다.

- WI: docs/work_packages/P03_CREATED_HELPER_IDENTITY_SOURCE_WI_20261028.md, SHA256 **59F1B667F4ED88D28FE231DE3BA712CB2D5BCDD493C28E45B9D30B4AE9617C12**. 원 발행 A698에서 tools/request volume0 구성 동치의 단계무관 적용을 Main이 명확화했다. 실제 실행 승인으로 바뀐 것이 아니다.
- 실제 시작 HEAD: **4482cf099b1095f6f5f463c946411f31e03828cd**, 기존 codex/av3-stage-b. WI의625f4255는 발행 당시 이력이다. Main이 tracked clean/protected untracked8 보존과 기존3 raw 일치를 확인했다. 작성자는 commit/push/상태문서를 변경하지 않았다.
- 기존 R2 actual은 source8e9292d8에서 create-tools/IDENTITY_UNKNOWN으로 끝났고 승인은 소진됐다. Main의 원 actual 결과 F17CE240 및 원·R1·R2 사본/원장 보존을 유지한다. 이번 source PASS로 당시 FAIL/NOT_COMPLETE를 소급 변경하지 않는다.

## 변경 전후·보존 경계

기존 own/ownLimited는 create 직후에도 runtime tmpfs가 이미 존재하는 전체 mount를 요구했고, 요청 volume0인 tools의 HostConfig.Mounts key 부재를 거절했다. 실제 관측은 created tools의 해당 key 부재/runtime []였다.

변경 후에는 호출부가 HelperStage를 명시한다. created는 정확 요청 volume만 runtime에서 검사하고 started는 기존 volume+tmpfs 전체를 검사한다. init/copy의 원·사본 volume 이름·관측 source mountpoint·destination·RO/RW·NoCopy와 HostConfig.Tmpfs 구성 검사를 시작 전부터 유지한다. started 호출이 created 상태로 돌아오면 거절한다. 실제 state를 보고 느슨한 mode를 자동 선택하지 않는다.

HostConfig의 absent|정확[] 동치는 **tools/request volume0**에만 created/started 양쪽 적용한다. null·비배열·추가 mount는 거절하고 init/copy에는 동치를 적용하지 않는다. 이는 실 started 관측을 주장하는 것이 아니다. 실제 init/copy/started mount shape는 미관측이다.

start 호출을 발행한 role은 내부 startedHelpers Set으로만 추적한다. 미시작 created helper의 판정이 자동 TERM/rm 허가가 되지 않도록 막고, 기존 helpers/receipt 반환 형식에 stage 필드를 추가하지 않았다. 기존 closed/exited/ExitCode0/FinishedAt·TERM/rm 각1회 상한·fullID/nonce/Created·단일 기한·보존 조건은 유지한다.

shell·고정6resource·candidate·원 source literal·Node/image/daemon·grant/decision의 닫힌키·consume 단발·600초/원내용500초/회수 reserve·위험 수락·cleanup 승인 범위는 변경하지 않았다. 기존 FN16 코드와 다른 시험/설정도 수정하지 않았다.

## TDD·오류·독립 증거

| 구분 | 결과 | 해석 |
|---|---|---|
| author f10ca4 새 단계7 |0PASS/7FAIL,201.1972ms,exit1|실제 created shape가 create-tools/IDENTITY_UNKNOWN으로 막히고 후속 음성이 목표 단계에 미도달하는 RED. created 불요 tmpfs가 기존 경로에서 start되는 반례도 실제 실패|
| 저장 전 ef2306 |anchor:v=await inspect(r); 보호 거절1|const v와 겹친 문자 anchor가4회여서2회 기대에 불일치. 메모리 patch에서 중단, 해당 controller write0. 정밀 ;v= anchor로 교정. 기능 FAIL/환경 실행 실패와 분리|
| author 1e6863 첫 구현 |5PASS/2FAIL,297.8218ms,exit1|limited copy 결과 직전의 추가 inspect1에 started 인자가 빠짐. 정확 호출1곳 보정, 기대 완화0|
| author 4360f3 직접 host/time |62PASS,876.584ms,fail/cancel/skip/todo0,exit0|기존55+새7 합성 ports. 실제 Docker 동작 증명 아님|
| author 17f22a |type exit0|위 직접 실행 당시 타입 결과|
| 최종 내부 Set 보완 후 c12863/2ae4f7/8d1145 |동일 직접62 dot PASS/type0/정확3 diff check0|기존 helpers 결과 형식 보존 assert 포함. 기존 CRLF→Git index LF 예고만 있음|
| Main d356ea fresh |정확 host/time spec62PASS,600.1882ms,fail/cancel/skip/todo0,exit0|동결 최종3파일의 독립 직접 실행|
| Main 141f97 |type0/정확3 diff check0|기존 CRLF→LF 예고 외 오류0|
| 독립 quality |C0/I0/M0·필수 미해결0|4482 기준 diff/3 raw, 단계별 조건·미시작 회수 차단·receipt 형식·음성 오류/횟수 적합. 실제 Docker 형태는 NOT_RUN|

시험 fixture는 created runtime에서 아직 없는 tmpfs를 제외하고 start 포트에서만 구성한다. 기존 기대는 유지했다. 원본검사를 뒤로 미루거나 fixture만 바꿔 양성으로 만들지 않았다. 정상/거절은 strict와 limited의 실제 공개 진입을 호출한다.

새 반례는 tools HostConfig absent/[] 정상 및 null/비배열/추가 mount/잘못된 Tmpfs, init/copy의 volume 누락·NoCopy 변경·원본RW·사본RO·source/destination 변조, started runtime 누락/추가·created 재등장, fullID/nonce/Created 변경, close불명/비정상 종료·TERM/rm 횟수를 다룬다. time 시험은 실제 volume +09 관측과 nano Created/FinishedAt의 기존 엄격 시각 검증을 단계 분리 뒤에도 보존한다. nano container 시각과 init/copy/started 형태를 실제로 관측한 것은 아니다.

원7RED·중간5P2F·최종62PASS를 별도로 보존한다. 원 actual 실패와 source 시험 실패·저장전 anchor 오류를 혼합하지 않는다. 동일 근본 오류3회 반복은 없었다.

## 정확 검증 명령

cwd는 등록 source 기준이며 내부 worktree 절대 경로는 본문에 기재하지 않는다.

```text
node --test --test-reporter=spec --test-name-pattern="created 관측|created tools의|created init/copy|started는 정확|단계분리는 fullID|created 허용은|created/started 분리는" tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts
node --test --test-reporter=dot tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --no-ext-diff --check -- scripts/p03-pg-copy-host.ts tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts
```

Main d356ea는 위 직접 spec 명령으로 fresh 실행했다. diff는 읽기 전용이며 stage/commit/push는 수행하지 않았다. 다른 preparation/Bash/전체P03/실행 환경 검사를 반복하지 않았다.

## 최종 지문

| 경로 | 시작 raw SHA256 | 최종 raw SHA256 |
|---|---|---|
| scripts/p03-pg-copy-host.ts |082D36D58438723117B4F68A4471D67B1733DD45CADEA345A2B4F48EDC30E5F4|3088264F3BD9FE2A5D47FD72A7826CC35AA60E018D6B67F6995DACDC27F15E92|
| tests/unit/P03/pg-recovery-copy-host.test.ts |F269C0889DEFB07CB5F823BC6B5FA712D42F12ACDEA603C24CCF6E80F3A2006F|6978559A9A147CFA7811DA1F4A731A417C565ABA978F4721BF495D56F4E24236|
| tests/unit/P03/pg-recovery-copy-docker-time.test.ts |5A254445588BE50468DBA734527CDE3D1A21A4DDF19B7FC1EA7225E05E388778|E78FE1C3D0F13C0C8E6222246052CB64E9EFFD3BAE8B4B56AEFBE543DE3E0284|

최종 LF SHA256:

- controller: 907F051D1CE3E39B2D55A59A297A1F93A69C4BB78628F5CB51CBB44DC5C604FE
- host 시험: 7533ADB4955C7A3E708DF24238739B6C6B44B909824EDAF8C91B5D221EB04A73
- time 시험: E78FE1C3D0F13C0C8E6222246052CB64E9EFFD3BAE8B4B56AEFBE543DE3E0284

원 actual8e9292d8의 controller Git LF532621070134EC7AE63151DEE3F25EFD7D49456CC7481E4C79401157E1695261은 그 실행의 고정 이력이다. 이 새 source 지문으로 대체하지 않는다.

## 미검증·다음 조치·rollback

실제 Docker/WSL/helper 생성·시작·TERM/rm/cp·volume/원장 변경·PG/SQL/DB·권한·서비스·Agent·새 actual grant는 NOT_RUN/실효과0이다. created tools의 원 관측만 근거이며 실 init/copy/started 검증이 완료됐다는 주장은 없다. 실제 재복제는 하지 않았다.

Main이 이 source 단위를 checkpoint한 뒤 새로운 exact 실행 후보가 필요하다. 새 commit/Git LF 지문·고정 대상과 기존 R1/R2 보존 자원·기한·1회 권한을 별도로 대조해야 하며, 기존 R2 소비된 승인이나 원 grant를 재사용하지 않는다. 기존 사본/원장이 점유한 고정 resource를 실행 가능으로 간주하거나 충돌 guard를 우회하지 않는다. 후속 exact 후보·새 실제 승인 전까지 실행0이다.

rollback은 Main이 본3파일의 source diff만 선택 복구하는 것이다. 기존 actual 실패/승인 소진/원·사본·원장을 삭제하거나 되돌리는 의미가 아니다. 결과서 외 source/test 추가 수정·검사·Git 작업은0으로 동결한다.
