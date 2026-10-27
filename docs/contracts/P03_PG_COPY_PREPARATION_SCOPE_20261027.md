# P03 원 PG 보호 사본 — 실행 준비 범위 후보 r1

2026-10-27 · Main 어울 · **지원 검토 후보 / 실제 실행 승인 아님**.
목적은 정식 개발 DB 복구의 선행 사본을 만드는 것이다. 새로운 제품 기능·백업 상품 계약을 추가하지 않는다. FN04 source/UI는 2f5963b2 및 현황 tail7b633d92에 게시됐고 실제 DB/서비스는 아직 복구되지 않았다.

## 현재 증거와 이번 경계

정본은 P03_PRESERVED_PG_VOLUME_RECOVERY_REVIEW.md와 P03_PG_DISCOVERY_METADATA_R2_ACTUAL_RESULT_20261027.md다. 기존 R2 조사·QA 회수는 완료·소진됐으므로 재실행하지 않는다. 당시 원본은 anvil-v3-development-pgdata, local, CreatedAt2026-10-16T03:53:33+09:00, instance dc22a0629e79f259dcd935845e88e58e, root999:999/0700, 1846파일/27디렉터리·link/special0, logical75529846bytes였다. 하위 소유/ACL/xattr·현재 무결성·현재 writer 부재의 증거는 아니다.
복제는 DB와 인증자료 전체를 읽어 새 사본에 쓰는 **새 외부 효과**다. 기존 metadata 승인·UID1001 위험수락·PMO 지원 재개를 재사용하지 않는다. source 준비·합성 검수와 실제 생성/복제/권한/PG 실행을 구분한다. 아래는 아직 실행 가능한 명령파일/hash가 없으며 사람 실행 승인을 요청하는 완성안이 아니다.

## 순서 선택과 권장안

1. 권장 준비안은 **한 복제 실행안 안에 제한된 사전검사→신규 사본 초기화→복제/일치검증**을 분리해 작성하는 것이다. immutable image/정확 경로를 범위로 승인받고 도구의 실제 hash·기능을 복제 전에 수집/검사한다. 미지원·범위 초과·승인되지 않은 미확인은 원내용 복제 전에 닫는다. 아직 알 수 없는 hash/owner/quota를 검증됐다고 채우지 않는다.
2. PMO 검토에서 위 결박으로 부족한 사실이 확인되면, 그 사실에 한해 **metadata-only 사전검사**를 별도 실행안으로 분리한다. 이미 한 R2 전체 재조사는 하지 않는다. 새로운 실제 probe 실행 역시 정확 소스/명령/기한/효과 결정 전0이다.

두 안 모두 PG 기동·SQL/DB 접근·정식 서비스 전환은 포함하지 않는다. 복제 성공만으로 DB 무결성·복구 완료를 주장하지 않는다.

## 후보 자원과 구별된 효과

이름은 준비 후보이며 예약/생성/부재 관측을 하지 않았다. 이미 존재하면 사용·삭제하지 않는다.

| 후보 | 범위 |
|---|---|
| source Git QA | /home/daon/anvil-v3-pgcopy-20261027-r1-src, private exact 승인 commit만 |
| 단발 감사 원장 | /home/daon/.local/share/anvil-v3-pgcopy-20261027-r1, 0700/0600·grant/소비/비밀 없는 receipt 보존 |
| 보존 사본 volume | anvil-v3-pgdata-recovery-20261027-r1, local/새 owner·instance/source identity label, 성공·실패 모두 자동 삭제0 |
| 도구 사전 helper | anvil-v3-pgcopy-tools-20261027-r1, 원본/사본 mount0, 선언 PGdata는 제한 tmpfs로 덮어 익명 volume0 |
| 사본 root 초기화 helper | anvil-v3-pgcopy-init-20261027-r1, **새 빈 사본만 RW**, 원본 mount0. 초기 owner/mode를 관측하고 필요한 새 root999:999/0700 변경을 별도 명시 |
| 복제/일치검증 helper | anvil-v3-pgcopy-20261027-r1, 원본 PGdata RO/nocopy·사본 /anvil-recovery-copy RW/nocopy, 보호 audit tmpfs·원본 RW0 |

캐시 image fullID594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f/pullnever·daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e는 실행 직전 fresh 대조한다. 새 image/tool 설치·network/publish·Secret bind0. 이미지 선언 VOLUME 전체와 실제 mount를 대조하고 예상 밖 익명 volume·source RW는 start0이다.

## 준비에서 고정할 사전검사

- host/controller: exact Git/source/shell hash와 실행 환경·Node/Git/Docker canonical/owner/부모·hash를 고정한다. UID1001 교체·loader·hash-실행 경합 미해결은 **새 실행의 한정 위험 결정 없으면 실제 apply0**이다. 옛 acknowledgement 문자열을 새 권위로 사용하지 않는다.
- 복제 도구는 cp 하나를 후보로 삼는다. /usr/bin/cp 및 필요한 /usr/bin/sort·/usr/bin/cmp·/usr/bin/df의 존재/canonical/일반파일/이미지 귀속·raw hash·필요 기능을 확인해야 한다. 이 네 도구는 앞선9개 관측에 없다. 기존 shell/find/stat/sha256sum 지문도 실제 helper에서 대조한다. 도움말/합성 tmpfs 시험 실행과 바이너리 hash 읽기를 각각 효과로 표시한다.
- 원본 새 metadata: numeric UID/GID/mode의 유한 분포·filesystem 경계·link/special·고유 inode를 이름 없이 집계한다. 소유가999:999와 다르거나 외부 mount/link/special/hardlink를 다룰 계약이 없으면 권한 상승/누락 복사 없이 중단한다. 이전 link0 관측을 미래 보장으로 쓰지 않는다.
- 공간: **새 사본이 실제 mount된 저장소**의 available bytes/inodes와 적용 가능한 quota를 관측한다. 아직 없는 volume의 초기 owner/공간은 미리 확정할 수 없다. quota 미관측은 무제한이 아니라 UNVERIFIED다. 별도 한정 수락 없으면 copy0, 수락한다면 최대 할당/잔여 reserve와 EDQUOT/ENOSPC 시 부분 사본 보존을 명시한다.
- ACL/xattr: 조회/보존 지원·선정 범위를 명시한다. unknown을 없음/일치로 바꾸지 않는다. 기본 내용·UID/GID/mode/mtime/일반파일 길이와 ACL/xattr의 완전 보존은 같은 판정이 아니다. 실제 적용 전에 선정 범위와 남는 위험을 결정하고, 사본 PG 시작은 별도 gate로 남긴다.

- 원내용 단계 전체(원본 전 hash→복제→원본 후 hash/사본 대조)의 writer 통제 근거·작업창·소비자 재확인 시점을 준비에서 고정한다. 통제가 증명되지 않으면 이 미확인을 잔여 위험으로 새 실행에서 별도 결정받기 전 copy0이다. RO mount/전후 hash 일치만으로 동시 쓰기 부재·일관된 시점 사본을 보증했다고 표시하지 않는다.

## 내용·선정 metadata 비교의 준비 설계

원본 전 내용 hash와 선정 metadata → 새 빈 사본에 복제 → 원본 후/사본의 같은 비교를 수행한다. 파일명/개별 hash/원문은 stdout·stderr·Git·대화·receipt에 출력하지 않는다. NUL-safe 상대경로를 그대로 포함한 정렬 record를 보호 tmpfs 안에서 처리하고 최종 집계·완료 여부·전체 지문만 내보낸다. manifest 자체가 민감 자료라는 전제로 uid999/0700·파일0600·유한 tmpfs 상한/수명과 폐기를 정한다. PGdata 안에 manifest를 쓰지 않는다.

내용 후보는 상대경로별 sha256sum --zero record, metadata 후보는 종류·숫자 UID/GID/mode·mtime와 파일 길이/상대경로를 포함한 NUL record다. directory 할당 크기·inode 번호·읽기로 달라질 atime은 복사 전후 동일성 항목으로 오인하지 않는다. LC_ALL=C·정확 sort -z/cmp의 실제 지원을 확인한 후 사용한다. 정렬이 path 순이어야만 일치하는 것은 아니지만 동일 record 형식·순서 규칙·중복/누락·최종 count와 byte 상한을 고정해야 한다. source 전후·사본의 바이트/선정 metadata가 다르면 PARTIAL/INCONSISTENT이고 PASS0이다.

GNU coreutils의 archive 옵션은 속성 보존을 시도하는 도구 동작일 뿐 이번 이미지에서 모든 metadata가 보존됐다는 증거가 아니다([배포자 cp 설명](https://manpages.debian.org/bookworm/coreutils/cp.1.en.html)). NUL 출력/정렬 방식은 [sha256sum](https://manpages.debian.org/bookworm/coreutils/sha256sum.1.en.html), [sort](https://manpages.debian.org/bookworm/coreutils/sort.1.en.html)의 후보 기능을 참조했으며 **실제 image 버전·지원은 미관측**이다. 위 내용은 실제 검증된 실행 argv가 아니다.

## 유한 한도·실패·소비

source 준비 제안 상한은 전체600초/원내용 단계500초·회수 reserve, entry100000·일반파일 logical256MiB·audit tmpfs32MiB·출력metadata16KiB·control256KiB, helper당 pids32/memory256MiB/CPU0.5다. 이는 후보 수치이며 기존60초를 자동 연장한 것이 아니고 새 실제 실행 결정에 포함해야 한다. 현재75529846bytes 관측만으로 처리시간/공간을 보장하지 않는다.

새 grant는 exact scope/commit/hash·이름·상한·최초 시작시각/최대30분·nonce에 결박하며 최초 Docker mutation 전에 단1회 소비한다. 내부 grant가 외부 사람 승인을 인증한다고 표시하지 않는다. 각 helper create/start1·원본/사본 소비자·자기ID/image/labels/mount를 대조하고, 정상 exit/close 확인 뒤 helper만 정확 rm한다. deadline에서 정상 SIGTERM1/유한 관측만, kill/force/자동 재시도0. unknown 종료/신원/IO·원장 실패는 원본·부분 사본·확인되지 않은 자원을 보존하고 필요한 정확 조치를 보고한다.

## 다음 업무와 종료 조건

Main이 PMO 검토의 필요한 결정을 정본에 기록한 뒤, 단일 subagent에게 **실행하지 않는 controller/shell·합성 포트 시험·정확 실행안**을 한 업무로 배정한다. 기존 소진 R2 script/controller/hash·grant/소비·복구 검토 원문은 수정하지 않는다. source 준비 완료는 실행 허가나 환경 ready가 아니다. 실제 실행은 검토된 정확 commit/소스·행위·남는 위험의 새 결정 후에만 수행한다.
