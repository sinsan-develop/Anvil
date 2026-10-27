# P03 보호 사본 — 한정위험 경로 계약 후보 r1

2026-10-27 · Main 어울 · **문서 검토 후보 / 미채택 구현 / 실행 승인 아님**.

## 목적과 근거

원 개발 PG volume을 보존하고 새 사본에서 후속 복구를 검증하기 위한 준비다. PMO는 기존 strict source의 실제 evidence producer 부재를 대조한 뒤, 별도 1회 복제용 한정위험 경로의 계약 후보 상세화만 채택했다. strict gate 완화·risk-acceptance 코드·grant·probe/copy/권한 실행은 승인하지 않았다. 기존 source 준비 I1(stderr) 보완과 독립 검수는 별개로 계속한다. 이 문서를 실제 사용 가능한 복구 기능·실행안 승인으로 표시하지 않는다.

부모는 P03_PG_COPY_PREPARATION_SCOPE_20261027.md(009EA669), SOURCE_PREPARATION WI(DC5A3B33), 결정 D394B4와 strict 실행안 검토본83F50DF01BB1B031BFC9892ACD7C134A806821E8E511FFDE157901B5DCC98026이다. 후속 I1 개정은 현재 source 준비 계보이며, 이 후보가 바꾸려는 의미 경계는 아래에 한정한다. 옛 R2 metadata 조사·UID1001 수락·소비 기록은 새 권위로 재사용하지 않는다.

## 엄격안과 후보의 정확한 차이

| 항목 | 현재 strict 계약 | 별도 한정위험 후보 |
|---|---|---|
| writer | 외부 producer의 CONTROLLED·exact run/대상/decision/유효창 근거 없으면 첫 mutation 전 거절 | 해당 완전 통제는 미입증임을 유지. 관측된 Docker 소비자·volume identity 및 원본 전후/사본 내용 대조만 수행. 원본의 일관된 시점 사본·모든 writer 부재를 보장하지 않는 위험을 이번 run에 한해 별도 판단 |
| quota | 검증된 allocation512MiB/reserve128MiB 강제한도 근거 요구 | 실제 filesystem hardquota 미검증/미강제. 아래 fresh free-space/inode·논리/할당 사전 범위·관측 주기와 중단 조건만 제안. 512MiB 강제한도·128MiB 보장이라고 부르지 않음 |
| ACL/xattr | 두 속성의 NONE_VERIFIED 아니면 cp0 | 도구 미설치/필요 조회 기능 미지원으로 **조회하지 못한 경우만** basic 선정 metadata로 범위를 한정하는 위험수락 후보. 조회 실패/권한 오류·이미 확인된 속성 존재/보존 실패는 포괄 수락하지 않음 |
| 결과 | PROTECTED_COPY_VERIFIED + 외부 CONTROLLED/ENFORCED facts | 별도 COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY 의미. writerFullyControlled=false, hardQuotaVerified=false, pointInTimeConsistencyProven=false, postgresStarted=false. 미확인을 PROVEN/CONTROLLED/ENFORCED로 승격하지 않음 |
| 권위 | strict grant 및 독립 evidence | strict와 혼용하지 않는 새 scope·정책 버전·정확 delta·run/원본/새 사본 identity·기한·최종 소스/명령/한도·사람 결정의 별도 binding 필요. 내부 digest/파일은 외부 사람 승인 자체를 인증하지 않음 |

이 후보를 채택하더라도 현재 strict 시험·enum·default·게이트를 수정해 통과시키지 않는다. 별도 경로와 음성 시험의 정확 구현 범위를 먼저 대조하고 그 뒤 구현·검수·게시·실행 결정을 분리한다. 지금은 코드 변경0이다.

## 후보에서도 거절하는 사실

원본 identity/CreatedAt/daemon/image/새 대상 귀속 불일치, 기존 사본·이름 충돌, owner999:999 불일치, 링크/특수파일/hardlink/외부 mount, 원본 RW·예상 밖 mount/권한, 알려진 ACL/xattr 존재 또는 조회/보존 오류, tool 실패/exit0+stderr/부분·중복·누락 출력, 내용·선정 metadata 불일치, 새 grant/최초 소비/감사 불명·만료는 계속 거절한다. 미확인을 알려진 위반으로 바꾸거나 알려진 위반을 일반 위험수락으로 덮지 않는다.

원본의 Docker 소비자가 새 자기 helper 외에 관측되면 copy0이다. 전후 소비자 조회가 비어도 호스트 프로세스·다른 방식의 접근이나 조회 사이의 writer를 배제한 증거로 부르지 않는다. service 정지·권한 변경으로 통제를 강제하는 새 행위는 이 후보에 없다.

## quota 대체 관측의 수치 후보와 잔여 위험

아래는 **설계 후보 수치**이며 현재 측정값/성능 보장/구현 완료가 아니다.

- 원본 사전 scan: 일반파일 논리 합계256MiB(268435456bytes) 이하·entry100000 이하, 관측 할당 blocks 합계512MiB 이하. 이는 순간 관측·범위 guard이고 복제 중 총 쓰기 강제한도가 아니다. sparse/metadata/동시 증가 때문에 사본 실할당은 다를 수 있다.
- 사본 예상 필요량은 max(원본 사전 논리, 관측 할당)+metadata 여유32MiB로 산정한다. 사본 filesystem의 fresh available bytes가 그 값+reserve 임계값128MiB 이상이고 available inodes가 원본 entries+100 이상이어야 시작한다. audit tmpfs32MiB는 별도 한도이며 디스크 quota와 혼동하지 않는다. 다른 공유 저장소의 사용을 예약하거나 막지 않는다.
- 실제 사본 mount의 free bytes/inodes를 preflight·원내용 시작 전·cp 직전·복제 중 최대10초 간격 후보·복제 종료 직후 관측한다. 잘못된 mount/짧은 출력/조회 실패·관측 기한 초과는 계속 진행하지 않는다. 관측은 최초 단일600초 예산에 포함하고 새로운 기한을 만들지 않는다.
- free bytes가 reserve128MiB 미만이거나 inode 임계값 미달, 조회 불명/지연이 되면 확인된 자기 cp/helper에 정상 TERM 최대1·유한 종료 관측 후 부분 사본을 보존한다. SIGKILL/force 삭제·자동 재시도0이다. 감시·중단 호출선 자체의 구현/합성 검증은 후속 범위다.
- **남는 위험:** 검사 사이 다른 writer와 공유 저장소 사용량이 증가할 수 있다. 파일이 사전 scan 이후 커지거나 cp가 즉시 중단되지 않으면 논리/예상량을 넘고 공유 저장소가 고갈될 수 있다. reserve는 관측 임계값이며 보장된 여유 공간이 아니다. kernel/daemon/IO 불명 때600초 내 강제 회수도 보장하지 않는다. 사본을 보존하므로 실패 후 공간은 자동 반환되지 않는다. 이 위험이 수락되지 않으면 실행하지 않고 실제 강제 quota/격리 저장소를 제공하는 대안을 택한다.

## ACL/xattr의 분리된 판정

도구 존재·canonical/hash·필요 기능을 동일 immutable image에서 확인하는 준비는 유지한다. getfacl/getfattr가 존재하지 않거나 필요한 기능이 없어 조회를 시도하지 못한 경우는 UNVERIFIED_TOOL_UNAVAILABLE로 남긴다. 이 경우에만 사람이 basic 선정 항목(원 bytes·경로·종류·UID/GID·mode·mtime nanosecond·일반파일 길이)의 일치까지만 비교하고 ACL/xattr 보존을 주장하지 않는 후보를 선택할 수 있다.

실제 조회가 성공해 속성 없음이 확인되면 NONE_VERIFIED다. 속성 존재는 PRESENT로 구별하고 현재 후보에서는 중단한다. 조회를 시도했으나 오류/permission/부분 출력이 있거나 복사 도구의 속성 보존이 실패하면 ERROR/PRESERVATION_FAILED로 중단한다. cp 경고를 버리거나 preserve 옵션을 제거해 합격시키지 않는다. 도구 미관측·미설치와 존재하는 민감 속성의 손실을 같은 허용 사유로 묶지 않는다.

## 한 번의 실제 실행 결정을 위한 묶음

대상은 기존 후보와 같은 정확 literal이다: source volume anvil-v3-development-pgdata(instance dc22a0629e79f259dcd935845e88e58e, CreatedAt2026-10-16T03:53:33+09:00), 새 사본 anvil-v3-pgdata-recovery-20261027-r1, tools/init/copy helper 이름3·고정 image594290e9·daemon e3349f1d, 새 Git QA/원장 경로는 strict 실행안의 정확 표를 참조한다. 이미 존재하면 사용·삭제하지 않는다. 최종 구현/실행안에서 이 literal과 raw hash·exact private commit을 다시 고정한다. 현재 이름 부재/지원·무결성을 확인했다는 뜻이 아니다.

실제 복사는 DB·인증자료를 포함할 수 있는 원 volume 전체의 bytes를 읽고 새 보호 사본에 쓴다. stdout/Git/대화로 본문·개별경로·개별hash·Secret를 내보내지 않는다. 원본RO/nocopy, 새 사본RW/nocopy, 임시진단0700/0600·제한tmpfs, init의 새 빈root 하나999:999/0700만 변경·CAP_CHOWN만, networknone/publish0, 원본/기존서비스·사용자/Secret/인증서·다른project 변경0을 유지한다.

새 source/ledger의 정확 owner/canonical/hash/inode·Git/Node/proc 대조와 단발 O_EXCL 소비/receipt는 유지한다. Node의 numeric owner1001·loader·hash-실행 경합 미해결은 새 run에서 별도 한정 결정할 항목이다. 내부 grant·옛R2 acknowledgement로 수락됐다고 하지 않는다. 최초 승인창 최대30분·전체600초/원내용500초/회수reserve25초·각helper1번을 정확 묶고, 새 시작·기한 연장·자동 반복0으로 한다. 명령과 모든 실제 파일/이미지 hash는 미래 최종 검수본에서만 확정한다.

정상은 같은 fullID/nonce/role/mount의 정상 close가 확인된 helper만 rm하고 임시 민감자료는 tmpfs와 함께 회수한다. source+새/부분 사본 volume은 성공/실패 모두 보존한다. 신원·close·receipt 불명 helper도 강제 삭제하지 않고 정확 잔여·필요 조치를 보고한다. rollback은 미적용 source의 정상 revert이며 volume/consume 삭제·원본 복원·데이터 불변 rollback을 약속하지 않는다. PG 시작/SQL/schema/서비스 복구·운영/Oracle/Agent 실행은 별도다.

## 검수와 다음 결정

1. 이 후보의 strict 대비 delta·수치/관측 한계·실행권한0을 독립 검수한다.
2. PMO에 문서 판정과 권장안을 전달한다. 실행경로가 필요하면 정확 code/test/결과 enum·원strict 보존 범위를 따로 대조한다. 문서 검토를 gate 완화/구현 채택으로 해석하지 않는다.
3. 별도 경로 source가 구현·독립 검수·게시된 뒤, 정확 source/행위/자원/새 owner 위험과 위 미확인 수락·대안을 사람이 판단할 수 있는 1회 실행 결정을 요청한다. 지금 추가 사용자 질문·별도 probe·실grant 작성/소비는 하지 않는다.

원본 전후/사본의 세 번 내용·선정 metadata 일치도 DB 일관성/복구 가능성이나 완전한 시점 사본을 증명하지 않는다. 결과는 **선정 항목 일치/잔여 위험 수락 여부/복제 단위의 종료와 회수**를 각각 표시하며, PG 기동·기능 사용·전체 WORK_PLAN 완료로 승격하지 않는다.
