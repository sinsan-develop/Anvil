# P03 RO 구조 metadata 조사 실행 후보 — 실제 실행 미승인

2026-10-27 · 담당 p03_discovery_preparation · Main 검수 전 동결 후보.

## 판정과 기준

**SOURCE_PREPARATION / NOT_EXECUTION_READY.** 정식 DB 복구·기능 완료가 아니다. 새 helper 생성, 원 volume metadata 접근, SSH/WSL/Docker, PG binary·SQL·복사·서비스·Agent 실행은 이번 준비에서 모두 0이다. 기존 PG_VERSION 관측은 반복하지 않는다.

- source 기준 HEAD: `f3d5357c099e6ef0edb79e7aa89d0eb888b319f3`, branch `codex/av3-stage-b`.
- 범위 R2 SHA256: `6FC9A7CB0F6421944C60E7E8987DDF9579B9599F1844935381A58FC7CBE5E860`.
- WI SHA256: `6C3BF818632322F2D235AD571C601597F1C109F85CE096889836C38CE4E0BE50`.
- 신규 shell raw SHA256: `156867EF53948C2A18CF439EBA8DB46ECF461AB11FD86116239B2E5FEC9A480B`.
- 신규 unit raw SHA256: `B90F8D8799ABF4DB877227BDEBE48CBAD5CBDF80BA7F015EB1AD13EE7E8A96FB`.

위 기준 HEAD에는 신규 shell이 아직 없다. Main의 검수·게시 뒤 실제 shell을 포함하는 정확 commit과 raw bytes를 다시 결박해야 한다. 현재 기준 HEAD를 신규 shell의 게시 commit이라고 주장하지 않는다. 실행 시에는 승인에 결박된 정확 Git commit의 `scripts/pg-recovery-discovery-readonly.sh` blob만 메모리로 가져와 위 raw SHA와 대조한다. 작업 폴더 파일·임시 복사·서버 직접 patch·미결박 최신 HEAD로 대체하지 않는다. 줄바꿈 차이도 재대조 대상이다.

## 고정 자원과 아직 모르는 사실

| 항목 | 고정 후보 |
|---|---|
| helper 이름/owner/runid | `anvil-v3-pgdiscovery-20261027-r2` / `project-main` / `anvil-v3-pgdiscovery-20261027-r2` |
| image full ID | `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f` |
| daemon 역사 신원 | `e3349f1d-dbfc-478a-96d9-295bf6c6839e` — 실행 전 fresh 일치 필수 |
| volume/instance | `anvil-v3-development-pgdata` / `dc22a0629e79f259dcd935845e88e58e` |
| mount | `/var/lib/postgresql/data`, readonly, volume-nocopy, 정확히 1개 |
| 조사 uid/gid | `999:999` — 실제 postgres 계정 uid/gid는 미실측 |
| isolation | network none, publish 0, rootfs RO, cap drop ALL, no-new-privileges |
| 한도 | pids 32, memory 128MiB, CPU 0.2, 전체 60초/내부 55초, stdout+stderr 합계 8192 bytes, entry 100000 |

`/usr/bin/timeout`, `/bin/bash`, `/usr/bin/find`, `/usr/bin/stat`, `/usr/bin/sha256sum`, `/usr/bin/id`, `/usr/bin/readlink`, `/usr/bin/awk`, `/usr/lib/postgresql/15/bin/postgres`는 **image 안의 미실측 literal 후보**다. awk canonical 허용 대상은 `/usr/bin/awk`, `/usr/bin/mawk`, `/usr/bin/gawk`뿐이며 호출 주소는 `/usr/bin/awk` 하나다. GNU 옵션 지원, 실제 파일/canonical 대상/hash, NSS postgres 숫자 계정, 원 root 종류/권한/용량을 조회한 적 없다. image fullID 고정은 개별 도구 hash 사전검증이 아니다. bootstrap timeout/bash가 없으면 script조차 시작하지 못할 수 있고 Docker 오류 원문을 공개하면 안 된다. 다른 주소/image/UID/tool 자동 대체·검색·설치는 0이다.

도구 hash는 이미지 도구 파일에만 한정한다. 원 volume 파일의 내용·hash·filename·symlink 대상은 읽거나 출력하지 않는다. find는 metadata 열 `%y %D %i %U %G %m %s %b`만 출력해 private pipe로 보낸다. device/inode별 중복을 제거하고 entry 종류 수와 고유 inode 수를 구별한다. regular logical bytes와 blocks×512는 정식 자료 무결성, filesystem 전체 실제 점유 또는 미래 복사 필요 공간을 보장하지 않는다. hardlink 상충 metadata·부분 순회·권한/필드/정수/entry 실패는 complete false다.

## 검토용 정확 create argv

다음은 실행을 지시하는 명령이 아니라 검수할 고정 argv다. 현재 실행하지 않는다. host의 Docker 주소/도구 지원도 검증하지 않았으며 새로운 daemon 연결을 자동으로 찾지 않는다.

```text
docker create --name anvil-v3-pgdiscovery-20261027-r2 --label anvil.project=v3 --label anvil.owner=project-main --label anvil.runid=anvil-v3-pgdiscovery-20261027-r2 --pull=never --network none --read-only --user 999:999 --cap-drop ALL --security-opt no-new-privileges --pids-limit 32 --memory 128m --cpus 0.2 --mount type=volume,source=anvil-v3-development-pgdata,target=/var/lib/postgresql/data,readonly,volume-nocopy --env BASH_ENV= --env ENV= --env PATH=/usr/bin:/bin --env LC_ALL=C --interactive --entrypoint /usr/bin/timeout sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f --signal=TERM 55 /bin/bash --noprofile --norc -s -- --discover-p03-metadata-r2
```

profile과 BASH_ENV/ENV의 자동 실행을 차단하고 HOME/CODEX_HOME은 다른 용도로 설정하지 않는다. source volume 또는 현재 폴더를 PATH에 추가하지 않는다. rootfs RO와 명시 mount1만 허용하며 추가 tmpfs/bind/Secret/익명 volume이 없다. `--discover-p03-metadata-r2`는 실조사 진입 구분자일 뿐 사람 승인 증명은 아니다.

## 순서와 고정 실패 경계

1. **fresh preflight**: exact daemon, helper literal 부재, image fullID/cache·Config.Volumes가 `/var/lib/postgresql/data` 하나뿐인지, 원 named volume의 driver local/project v3/owner P03/instance 위 값과 소비자 0을 확인한다. 불일치/사전 존재/관측 실패면 create 0이다. 자료 내용은 읽지 않는다. 관측과 create 사이 경쟁을 해소했다고 주장하지 않는다. 새로운 소비자가 보이면 start 0으로 닫는다.
2. **create 1회**: 위 argv만 사용한다. 반환값은 in-memory `helperId`로 받고 `^[a-f0-9]{64}$`인 fullID만 허용한다. 이 값은 실행 중 관측 식별자이지 사람이 채우는 placeholder가 아니다. 이름으로 삭제하거나 기존 이름을 재사용하지 않는다.
3. **inspect 1회**: `docker inspect --type container`에 검증된 `helperId` 하나만 argv로 전달한다. fullID/image/name·위 세 label/entrypoint·argv·UID·명시한 4개 환경변수·network none/port0/rootfsRO/capdropALL/securityopt/pids32/memory134217728/NanoCPUs200000000·Mounts1의 named volume/source/목적지/RWfalse·상태created를 모두 대조한다. image 자체의 기본 Env도 상속되므로 Env 전체가 4개라고 가정하지 않는다. 상속 Env의 허용 집합과 shell 자동실행 hook 부재는 현재 미실측이며 실행 전 정확히 결박해야 한다. 예상 밖 interpreter hook·mount/추가 volume·정의 불일치는 start 0이다. inspect 원문/전체 Env·Mount source 실제주소를 외부 출력하지 않는다.
4. **start 단1회**: `docker start --attach --interactive`에 동일 검증 fullID 하나만 전달한다. 승인된 exact Git blob bytes만 stdin으로 보낸다. script는 stdin `-s`의 정확 한 인자에서만 조사에 진입한다. source/import와 인자 없는 기본 실행은 도구 호출/metadata 읽기/FS 쓰기 없이 PREPARATION_ONLY다. 재시도·다른 UID start·새 helper 대체는 없다.
5. **종료 확인**: 동일 fullID inspect로 running false/종료 code를 관측한다. stdout의 JSON 한 건/8KiB 내/닫힌 status·허용 toolpath/hash·숫자만 채택한다. stderr 원문은 공개하지 않고 비어 있지 않으면 고정 실패로 분류한다. timeout/OOM/비정상 종료/부분 결과는 완료 true로 승격하지 않는다.
6. **정리**: 정상 종료와 exact fullID/image/labels/mount RO 신원을 다시 확인한 경우에만 `docker rm`에 동일 fullID 하나를 전달한다. `-f`, `-v`, volume 삭제는 0이다. 자신의 helper 부재와 원 named volume 보존은 별도 관측한다. 원 volume은 후속 단계에서도 자동 폐기하지 않는다.

위 순서의 전체 예산은 시작 전 preflight부터 cleanup까지 60초 제안이다. host controller가 stdout/stderr 합산 8192 bytes를 넘는 즉시 수집을 중단하고 원문을 내보내지 않아야 한다. 내부 timeout은 TERM만 요청하고 KILL fallback이 없다. 전체 제한에 도달했거나 종료가 확인되지 않으면 **확인된 자신 helper에만 정상 SIGTERM 단1회**와 남은 예산의 유한 관측을 제안한다. 강제 kill/강제 rm·재시작은 없다. 60초 안에 kernel 대기까지 강제 종료·정리가 끝난다고 보장하지 않는다. 종료/신원 불명이면 STOP_UNCONFIRMED로 보존하고 exact 식별 증거만 인계한다.

## 검증과 정확한 미충족

- Main fresh RED: 신규 명시 unit이 `PREPARATION_SOURCE_MISSING`으로 exit1. source 작성 전 확인을 전달받았다.
- local Node v24.22.1, Git Bash literal `C:/Program Files/Git/bin/bash.exe` 존재/46992 bytes는 읽기로 확인했다. Node syntax check exit0.
- 신규 파일만 `node --test tests/unit/P03/pg-recovery-discovery-preparation.test.ts` 실행: 8 FAIL/0 PASS/skip0, 2121.0343ms, exit1. sandbox Git Bash 초기화 `NtCreateDirectoryObject` 접근거부/첫 exit3221225794 및 마지막 stdin EOF였다. shell 집계 동작에 도달한 증거가 없으며 제품 집계 실패나 PASS로 계산하지 않는다. 같은 명령 재시도·설정/ACL 변경·다른 shell/WSL/도구 우회는 0이다.
- HOME 제거 이후 신규 unit `node --check` exit0. Main의 추가실행 중지 지시 뒤 새 검사 0이다.
- Main이 동일 신규8건을 허용 환경에서 실행한 결과 7 PASS/1 FAIL/15906.5842ms였다. 실패 지문은 `ENTRY_100000_BASH_LOOP_DEADLINE`: entry100000 정상 입력 집계가 기존 spawnSync 15000ms를 넘은 ETIMEDOUT이다. sandbox 초기화 거부와 다른 집계 성능 결함 1회로 기록한다.
- Main 보완 GO에 따라 `C:/Program Files/Git/usr/bin/awk.exe` 존재/779620 bytes를 읽기로 먼저 확인하고, 고정 `/usr/bin/awk` 한 프로세스의 stream 집계로 행별 Bash 정규식/분리 비용을 제거했다. 동적 명령·system/getline·임시파일은 없다. entry100000/timeout15000ms·숫자/합산 상한·기존8건 기대값은 그대로다. import/default는 도구를 실행하지 않으며 집계함수를 호출할 때만 awk가 시작된다. image내 awk와 정규식 지원은 여전히 미실측이고 지원불명은 TOOL_SUPPORT_UNKNOWN으로 닫는다.
- 담당 보완 후 정확 동일 명령 `node --test tests/unit/P03/pg-recovery-discovery-preparation.test.ts`를 플랫폼 허용 환경에서 1회 실행했다: **8 PASS/0 FAIL/skip0, exit0, 2059.0538ms**. entry 상한 정상/초과 사례는 609.6188ms다. 이 증거는 로컬 합성 numeric 집계와 import만 증명한다. Bash `-n`과 기본 무인자 실행 가드의 별도 동적 검증은 NOT_RUN이다. 기존 시험 filter·실pwsh/컴파일 시험은 사용하지 않는다.
- 독립 검수 C0/I1/M0의 `PIPE_PRODUCER_STDERR_UNCLOSED`는 producer의 find만 stderr를 닫고 END printf를 닫지 않아 조기 consumer 종료 시 원 Bash/script 경로가 나올 수 있는 별도 source 결함이다. fix-round1에서 producer 블록 끝 한 줄을 `} 2>/dev/null | p03_aggregate`로 보완했다. 집계함수·unit raw B90F8D87·기대값은 불변이다. Main fa6611의 8 PASS/2059.8609ms와 99f2fc의 `-n`/기본 PREPARATION_ONLY 성공은 수정 전 증거이며, 수정 후 8건은 불필요하게 반복하지 않았다.
- redirection 보완 후 담당은 고정 `C:/Program Files/Git/bin/bash.exe --noprofile --norc -n scripts/pg-recovery-discovery-readonly.sh`를 Node spawnSync의 BASH_ENV/ENV 비활성·최소 환경·15000ms/8192 bytes 한도로 플랫폼 허용 환경에서 문법만 확인했다. 결과 exit0/error null/stdout0 bytes/stderr0 bytes다. 실제 함수·main·metadata는 실행하지 않았다. producer 조기종료 고장주입은 NOT_RUN이며 원 경로 stderr 차단은 독립 정적 재검수 대상이다. 동일 원인 3회 누적은 없다.
- 실제 image/coretools/GNU/NSS/postgres uid/gid/source 구조·권한/용량·완전한 metadata·복제·사본 PG/정식 DB·API/Web/사용자인수는 NOT_RUN이다.

**실행 준비의 남은 필수 조건:** 독립 source 검수와 Main 허용 환경에서의 명시 신규 unit/Bash 문법 확인, 최종 게시 commit/blob 지문 결박, fresh preflight를 수행할 정확 호스트/도구 신뢰 결박, 전체60초·stdout/stderr 합계8KiB·유한 종료/보존/정리 controller의 구현·독립 검수, 신규 RO 효과에 대한 정확 직접 실행 결정이다. 이번 허용3파일에는 별도 host Docker controller 구현이 없으므로 위 검토용 argv/절차만으로 안전한 실행가능안이라고 주장하지 않는다. 이 미진은 추측한 image 지원이나 placeholder를 숨겨서 메우지 않는다. 실제 main 호출은 0이다.

rollback은 이번 소유 신규3파일을 후속 검토된 revert로 되돌리는 것이다. 보호8·기존 PG provision/native/approval/marker·원 자료·Secret·권한은 변경하지 않았다. 이 담당은 WORK_STATUS/WI/기존계획에 쓰기 권한이 없으므로 Main이 이 증거와 오류/미진을 현황에 기록한다.
