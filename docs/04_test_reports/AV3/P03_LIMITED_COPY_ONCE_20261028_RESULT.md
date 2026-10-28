# P03 보호 사본 실제 단발 실행 결과 — 2026-10-28

## 판정

**NOT_COMPLETE / 복제 미완료 / 단발 승인 소진.** 고정 실행의 exit code는 1이며 create-volume 단계의 COPY_VOLUME_IDENTITY로 중단했다. 새 volume은 생성됐지만 helper 생성·실제 cp·PG 시작에는 도달하지 않았다. 원본과 새 volume 및 원장은 보존했고 정상 종료한 QA checkout만 회수했다.

독립 원인 대조에서 유일한 거절 조건은 Docker CreatedAt의 시각 문자열 표현이었다. 실제 신원·epoch·승인 기한 위반으로 판정하지 않는다. 그렇더라도 원 실행은 실패이며 복제 성공으로 바꾸지 않는다. 승인 창이 남아 있어도 같은 승인으로 재실행할 수 없다. 코드 교정은 별도 업무이며 새 실제 run은 새 정확 승인을 받기 전까지 금지한다.

이 문서는 Main의 실제 실행 raw와 별도 확인 결과를 문서 담당이 대조·보존한 것이다. 문서 담당은 추가 원격 조회·코드/시험/DB/SQL 실행을 하지 않았다.

## 승인·고정 기준선

- PMO 전달 직접 답변: call_aaf9066224b948f9a0d45f64e56e0308 / item0, “위 잔여 위험을 이번 run에 한정 수락하고 복제 1회 승인”.
- 실제 효과 결정 SHA256: 337E26F75B85F4F04EB9901F899BB5EF87B0631E86A3F834A6EE9933DF6F07D0.
- 결정안: docs/work_packages/P03_LIMITED_COPY_ONCE_EXECUTION_DECISION_PACKET_20261028.md, SHA256 C2B1C99294DA62308FAC4378F2C4F9333D783C459D0EC3AAE79C44D7F36F7147.
- 고정 source commit: 367d9d49daeee08a319431853006db0647129910. 최신 HEAD로 대체하지 않았다.
- controller Git LF SHA256: 605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8.
- shell Git LF SHA256: 04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC.
- 최초 승인 관측 2026-10-28T02:37:32Z, 절대 만료 2026-10-28T03:07:32Z. grant issuedAt/expiresAt은 각각 같은 시각의 .000Z 표현이다.
- runInstance/copyInstance: cef316aec47f84f6d3e0f27f1e1c939a.
- 실제 진입 명령: /usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /opt/node-v24.21.0-linux-x64/bin/node /home/daon/anvil-v3-pgcopy-20261027-r1-src/scripts/p03-pg-copy-host.ts --apply-limited-risk
- 전체600초/source500초·단1회·강제 재시도/창 연장/force 회수 0의 승인 경계를 유지했다.

## 준비·실제 실행 증거

| raw 참조 | 실제 확인 결과 |
|---|---|
| e134bb | 02:41:34Z 사전 확인. 고정 도구·daemon·image·원 volume 신원 일치, QA/ledger·새 volume/helper3 부재, 원 volume 소비자0. |
| 504b47 | 새 QA 0700 생성·private Git exact367d/clean·controller/shell LF 대조. ledger0700 및 grant0600을 O_EXCL/fsync로 신규 생성했다. grant2322bytes, SHA256은 아래 원장 표와 같다. |
| 61f9ae | 별도 JSON 읽기로 같은 nonce/지문/기한·JSON valid, consumed=false/receipt=false의 미소비 준비를 확인했다. |
| fbe8b8 | 실제 고정 entry 단1회. exit1, status=NOT_COMPLETE, phase=create-volume, error=COPY_VOLUME_IDENTITY. consumed=true, consumeAttempted=true, copyCreated=true, helpers={}, pendingIO=false, receiptFailed=false, postgresStarted=false, copyResult=null. |
| d9fa9e | 새 volume CreatedAt=2026-10-28T11:44:26+09:00. labels5/nonce/name/driver/options/scope/mount 일치. 원 volume 신원도 일치, 양 volume 소비자0/helper3 부재/controller PID0, QA exact Git/clean 확인. |
| 51a0ab | 독립 고정 predicate 대조. 유일한 false는 instant의 canonical 문자열 비교이며 위 시각은 2026-10-28T02:44:26.000Z와 같은 epoch·승인 창 안이다. 신원/epoch/기한 위반이 아니다. |

실제 도구 지문은 Git eb54b535467e0975c1284d4c4d08eea779aeb248a5d34b02e2ee171382e22201, Docker 7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b, Node 7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c로 대조됐다. daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e와 image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f가 고정 기준이다.

원인은 Docker가 반환한 유효한 시각 표현과 grant용 canonical 시각 문자열 검사를 혼용한 것이다. 실제 오류·exit1·단발 소비 기록은 그대로 유지한다. 이번 결과를 실패 후 재시도나 source 교정 실행의 권한으로 사용하지 않는다.

## 회수·보존 확인

cf052a는 QA root dev2096/ino4212859, uid1000:1000/mode0700, 자손2830files/177dirs/52840418bytes·자손 owner/link/escape 위반0, Git clean/controller PID0을 확인한 뒤 등록 QA만 회수했다. 원/새 volume과 원장은 삭제하지 않았다.

1fa379의 별도 SSH 읽기(2026-10-28T02:48:02Z)는 QA 부재/helper3 부재, 원·새 volume의 동일 metadata 및 양 소비자0을 확인했다. ledger uid1000/mode0700, 다음 세 파일 mode0600/nlink1과 지문이 보존됐다.

| 보존 대상 | 정확 경로·신원 |
|---|---|
| 원 volume | anvil-v3-development-pgdata, instance dc22a0629e79f259dcd935845e88e58e, CreatedAt 2026-10-16T03:53:33+09:00 |
| 새 volume | anvil-v3-pgdata-recovery-20261027-r1, copyInstance cef316aec47f84f6d3e0f27f1e1c939a, CreatedAt 2026-10-28T11:44:26+09:00 |
| ledger | /home/daon/.local/share/anvil-v3-pgcopy-20261027-r1 |
| grant.json | SHA256 263864d5ea021ef9a1f124492a7c65225a410514ea068ee28e281e847dc21c1f, 2322bytes |
| consumed.json | SHA256 42b273c87648af15973c18bb081b03ce0f971e34bc42863d37c4f6648dcbe898 |
| receipt.jsonl | SHA256 b34eb206d02ac657107634c630e65eda99c36a837b4744926b626cc95872c1c5 |
| 회수한 QA | /home/daon/anvil-v3-pgcopy-20261027-r1-src, 별도 확인에서 부재 |
| 부재 확인 helper3 | anvil-v3-pgcopy-tools-20261027-r1 / anvil-v3-pgcopy-init-20261027-r1 / anvil-v3-pgcopy-20261027-r1 |

## 미검증·다음 조치

우리 고정 controller가 helper/cp 단계에 도달하지 않았다는 실행 결과와, 외부 writer 부재·원내용 불변의 증명은 다르다. Docker 소비자0과 신원 metadata 대조는 다른 직접 writer가 없었다거나 원본 내용이 바뀌지 않았다는 보장이 아니다. 개별 원내용/Secret/개별 hash/SQL은 조회하지 않았다. 복사 bytes·선정 metadata 일치 결과는 null이며 PG 기동·복구·DB 무결성·서비스/API/UI는 미검증이다.

기존 91건 합성 PASS는 source/합성 검증 증거이며 이번 실제 복제 PASS나 실PG 검증으로 승격하지 않는다. 전체 P03·Stage·작업계획은 미완료다. Main 제품 write0, 본 담당은 결과 문서 한 파일 외 변경0·Git 변경0이다.

원본·새 volume·소비 원장/영수증은 Main 관리하에 보존한다. 자동 삭제·원본 복원·강제 회수·같은 승인 재실행은 하지 않는다. canonical 시각 판정의 source-only 교정은 별도 업무로 관리하고, 후속 실제 복제는 새 run·새 exact source 및 별도 정확 승인 전에는 시작하지 않는다. 이번 문서 작성은 그 교정이나 새 실행의 착수 승인이 아니다.
