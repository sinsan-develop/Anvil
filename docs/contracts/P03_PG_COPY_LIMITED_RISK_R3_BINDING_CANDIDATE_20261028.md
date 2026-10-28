# P03 보호 사본 — R3 고정 리소스 결박 후보

2026-10-28 · 어울 · **DRAFT / NOT_ADOPTED / source-only 결박 제안 / 실제 실행 승인 아님**

## 목적과 결정 경계

R1·R2 실제 단발 복제 승인은 모두 소진됐다. R2는 `NOT_COMPLETE/create-tools/IDENTITY_UNKNOWN`으로 끝났으며 cp·PG 단계에는 도달하지 않았다. 기존 원본/R1/R2 volume과 grant/consumed/receipt 원장을 보존하고, 그 이름이나 원장을 비워 재사용하지 않는다. 이번 후보는 같은 보호·위험 조건 아래 별도 R3 고정 리소스에 결박할 최소 source 변경 범위를 제안한다.

현재 허용 작업은 이 후보 문서 한 파일의 작성뿐이다. Main 검토 후 PMO source 채택 지원을 요청할 수 있으나 문서 작성·검수는 채택 또는 제품 GO가 아니다. source-only 채택도 실제 실행 승인이 아니다. actual packet 작성·질문 발행·nonce·issuedAt/expiresAt·grant 생성 및 QA checkout·원격 관측·volume/helper·cp·신호·PG/SQL·권한·서비스·Agent 실행은 이번 문서 범위에서 모두0이다.

## 부모와 보존할 증거

- 직접 부모는 `P03_PG_COPY_LIMITED_RISK_R2_BINDING_CANDIDATE_20261028.md`, SHA256 `467A5FFF50C0C22D76F283AF144A312E8BA7D805AA5E5F12AF52870FB63064AF`다. 원 R2 문서와 그 부모 FFC3 원문은 수정하지 않는다.
- R1 실제 승인 `337E26F75B85F4F04EB9901F899BB5EF87B0631E86A3F834A6EE9933DF6F07D0`, 원 source 승인 5398/54922 계보는 원 대상·범위의 이력이다. R1 결과 `P03_LIMITED_COPY_ONCE_20261028_RESULT.md` SHA256 `7E365AC623FF97700C91BDA2F8A8CFB0DDF5899581BC92342914FB46CB89272C`의 소비·사본 생성·실패를 보존한다.
- R2 실제 승인 `FD568644022D0566482668CC8ACC89E4E697726534E48AD5AD149B6DF2880D35`도 소진됐다. R2 exact source `8e9292d83c4ebe857919480b0d3468a0f7c1eaa3`와 packet SHA256 `662FEF2E1913B2CCF770052ED631D5C74A4D76C142A6FB543A379721F6D3A64B`는 과거 실행 결박으로 보존한다.
- R2 결과 `P03_R2_LIMITED_COPY_ONCE_20261028_RESULT.md` SHA256 `F17CE24081D0A06241820B27316445FD6FE06F3B7EFEA2D6AAA6A6D2128F0A2E`를 따른다. created tools 1개는 별도 exact cleanup 승인에 따라 정상 rm 후 독립 부재 확인됐다. 이 회수 성공을 복제 성공이나 R3 실행 권한으로 바꾸지 않는다. 원 receipt bytes도 보존한다.
- created/started 내부 교정의 최초 WI59F1/source3088/62PASS/C0I0는 합성 fixture의 잘못된 tmpfs 가정을 발견하여 미해결 I1로 정정됐다. 현재 WI `P03_CREATED_HELPER_IDENTITY_SOURCE_WI_20261028.md` SHA256 `C1C7F56EEF3E281E54C1793996FFE7A83C437FC290384EDA968E43809F3D5B1F`의 제품2/시험3 보완은 최종 Main 직접122PASS/0FAIL/0SKIP/0CANCEL/0TODO14569.3845ms·type/Bash/diff0·독립 C0/I0/M0로 소스 한정 검수됐다. checkpoint `102269453d3a0d7524458737528e68de025b4b19`는 local/private 동일이며 controller Git LF `E900E1C38D405ADF3B9723437E43D93437102060E6FD0F168D48022FFB6E28D8`, shell raw=LF `76952702BA93E48ACE81A879C19D0190A7CE3D4EA5A7374B0E494AD650335271`이다. 결과서 `P03_CREATED_HELPER_IDENTITY_SOURCE_RESULT_20261028.md` raw SHA256 `13980FE50C149E3462A68C758CF6EC5ED4EBB35F35979AC84811A1A9A6532DBE`에 원 I1/LF 실패를 보존했다. 이는 R2 literal source의 검수이고 R3 결박 source나 실제 실행 준비 합격은 아니다.
- 이 문서의 hash는 확정 후 외부 기록에서 관리한다. 자기 hash를 본문에 넣지 않는다. 채택 후 controller/shell의 닫힌 candidate 결박에 연결하되, 최종 실행 source commit/controller/shell SHA는 **Main checkpoint 후 별도 고정할 미정 항목**이다. 현재 임의 값을 만들지 않는다.

## 제안하는 R3 대상 6개

| 대상 | source-only 제안 literal |
| --- | --- |
| sourceRoot | `/home/daon/anvil-v3-pgcopy-20261028-r3-src` |
| ledgerRoot | `/home/daon/.local/share/anvil-v3-pgcopy-20261028-r3` |
| copyVolume | `anvil-v3-pgdata-recovery-20261028-r3` |
| toolsName | `anvil-v3-pgcopy-tools-20261028-r3` |
| initName | `anvil-v3-pgcopy-init-20261028-r3` |
| copyName | `anvil-v3-pgcopy-20261028-r3` |

이는 실제 대상 부재·소유·공간 관측이나 생성·승인이 아니다. 별도 실제 승인을 받은 경우 생성 직전에 exact 부재/owner/realpath/link·도구·daemon/image·원본 신원을 대조하고 충돌·불명이면 사용·삭제·대체하지 않는다. 보존 중인 R1 `anvil-v3-pgdata-recovery-20261027-r1` 및 R2 `anvil-v3-pgdata-recovery-20261028-r2`와 각각의 ledger는 계속 보존한다. 실제 R3가 별도 승인되어 실행되면 원본/R1/R2에 더해 **새 사본 volume 총1개**가 추가되며 성공·실패·부분 사본 모두 공간을 차지하고 자동 삭제되지 않는다.

원본은 `anvil-v3-development-pgdata` / instance `dc22a0629e79f259dcd935845e88e58e` / CreatedAt `2026-10-16T03:53:33+09:00`로 고정한다. daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e`, image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, Node `/opt/node-v24.21.0-linux-x64/bin/node` 및 SHA256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`의 기존 계약을 변경하지 않는다. source identity 검사를 느슨하게 하지 않는다.

## 채택 후 제안할 최소 source 표면

| 파일 | 제안 변경 |
| --- | --- |
| `scripts/p03-pg-copy-host.ts` | FIXED_COPY의 위 6개 literal과 limited candidate SHA만 R3로 정합. 최종 검수된 시각·created/started 교정과 모든 보호 조건 보존 |
| `scripts/pg-recovery-copy.sh` | strict/limited 결과 두 곳의 copyIdentity.name과 limited parser/결과 candidate SHA만 새 결박으로 정합 |
| `tests/unit/P03/pg-recovery-copy-host.test.ts` | 독립 fixed/grant/metadata/report fixture를 새 exact 결박으로 정합. 기존 부정 기대와 단계·cleanup 검사 보존 |
| `tests/unit/P03/pg-recovery-copy-docker-time.test.ts` | 독립 fixed/candidate/report fixture 정합. timestamp 경계 및 단계 검사 보존 |
| `tests/unit/P03/pg-recovery-copy-preparation.test.ts` | 실제 parser가 소비하는 copyIdentity.name 등 해당 fixture만 정합 |

제품2와 기존 직접 시험3의 결박 정합만 제안하며 지금 이 파일들을 수정하지 않는다. controller만 바꿔 shell 결과나 독립 fixture의 불일치를 방치하지 않는다. 기존 R1/R2 이름·경로·candidate/grant 거절을 제거하거나 기대를 완화하지 않는다. 새 제품파일·의존성·범용 args/env·외부 입력 선택기나 자동 fallback을 추가하지 않는다.

protocol `P03_PROTECTED_COPY_R1` / `P03_PROTECTED_COPY_LIMITED_RISK_R1`, policy `P03_COPY_LIMITED_RISK_POLICY_R1_20261028`, mode `--apply-limited-risk` 및 기존 mode/carrier/schema 의미는 유지한다. R1 접미사는 protocol 버전이며 과거 물리 리소스 재사용 허가가 아니다. grant/evidence/결과의 closed keys·enum, 단발 consume·receipt, 최초/후속 신원·nonce·labels·기한 검사도 불변이다.

## 단계별 보호·위험·한도 보존

created/started는 호출부가 명시한다. tools 요청 volume0에서만 HostConfig.Mounts key 부재/정확 []를 구성상 동치로 받고 null·다른 형식·추가 mount는 거절한다. 현재 --tmpfs API는 HostConfig.Tmpfs를 별도로 제공하므로 inspect.Mounts는 양단계 모두 정확 volume-only(tools[])로 검사한다. 시작 상태/호출 단계는 별도로 대조하며 shell 첫 쓰기 전 실제 mountinfo의 정확 tmpfs·보호 flags/size 및 stat owner/mode를 검증하는 보완의 최종 검수가 선행이다. init/copy의 exact HostConfig 및 runtime volume·원본 RO/사본 RW·NoCopy·경로 검증은 start 전부터 유지한다. 시작 후 created 재등장이나 신원 교체를 거절한다. 실제 init/copy/started 관측 형태를 확인했다고 주장하지 않는다.

cleanup은 fullID/name/nonce/image/설정·실 close·exited/ExitCode0/FinishedAt을 대조한 자기 정상 종료 helper의 정상 rm만 허용하는 기존 기준을 유지한다. created 수락은 자동 rm 권한이 아니다. 불명·부분 실패는 보존하고 정확 후속 판단을 요청하며 SIGKILL/force/-v·무제한 재시도는 추가하지 않는다. 원본 RO/nocopy·network none/포트0·read-only rootfs·UID/caps·init 새 빈 root1곳 CHOWN만/재귀0도 불변이다.

위험4는 원 의미 그대로다. writer 완전통제·시점 일관성 미입증, hardquota 미강제와 검사 사이 증가·공유 공간 고갈·즉시 중단 불가, ACL/xattr 도구 미설치/기능 미지원 때만 미확인 수락, Node numeric owner1001 및 owner/loader/hash→실행 경합의 잔여 위험이다. Docker consumer0을 writer 부재 증명으로 바꾸지 않는다. 속성 존재·조회 오류·부분출력·stderr·보존 실패는 계속 거절한다. 위험 수락은 새 exact run별 별도 결정이며 과거 수락을 자동 승계하지 않는다.

최초 실제 승인부터 최대30분, 전체600초/source500초/회수 reserve25초·source 시작 잔여525초 이상을 유지한다. 논리256MiB/entries100000/관측 할당512MiB guard, 예상 max(logical,allocation)+32MiB와 free reserve128MiB/inodes entries+100, 최대10초 관측 간격·audit tmpfs32MiB·stdout16KiB/control256KiB도 유지한다. role별 create/start1회·전체 volume1/helper3·제한 TERM·부분 사본 보존을 유지하며 기한 내 강제 회수를 보장하지 않는다.

과거 Git full fetch 등 source 준비에 약12분이 걸린 사실은 **선행 준비시간 위험**이다. 이를 이유로 최초 승인부터의30분 창이나 controller 한도를 재시작·연장하지 않는다. 이 문서는 승인 전 선행 checkout/원격 준비도 허가하지 않는다.

## 검증·rollback·후속 경계

채택 후 Main이 정확 WI/허용 범위·기준선을 고정하고 TEST_ONLY→Main fresh RED→제품 GO 순서로 진행한다. 새 R3 정상 합성 흐름, 원 R1/R2 결박의 consume/첫 mutation 전 거절, 생성 후 old metadata 거절과 사본 보존을 구분한다. shell 결과2와 controller parser의 결박 일치, 기존 timestamp·created/started·mount·cleanup·단발 소비 반례 및 직접 인접 시험/type·필요한 shell 구문/합성 검사만 수행한다. 합성 결과를 실제 Linux/Docker/cp/PG PASS로 승격하지 않는다.

source rollback은 R3 결박 diff만 소유 변경 범위에서 되돌리는 것이다. 최종 검수된 내부 신원 교정과 다른 기능을 함께 되돌리지 않는다. 예전 source를 선택해도 소비된 승인은 복구되지 않는다. 물리 rollback을 이유로 원본/R1/R2/R3 volume·원장을 삭제하거나 원본 복원·재실행하지 않는다.

최종 source 검수·Main checkpoint 후 새 exact source/대상6·추가 공간·위험4·수명·정상 회수/불명 보존·별도 실행 후 읽기 검증 책임을 갖춘 **별도 actual 결정**이 필요하다. 이 후보만으로 실제 부재·권한·bytes/metadata 복제·PG/DB 복구·서비스/API/UI·전체 P03/작업계획 완료를 증명하지 않는다. 현재 상태는 NOT_ADOPTED이며 제품·시험 변경, actual packet·nonce·grant·원격·복제·환경 실행은0이다.


### r1 내부 정정 이력
최초AF8FF4A3 문서 작성 뒤 발견한 Docker tmpfs backend I1을 반영했다. 기존검수완료를정정하고최종 source 검수선행을유지한다. source/actual 채택 상태는 계속NOT_ADOPTED이며제품/환경변경0이다.


### 2026-10-28 내부 source 검수 상태 갱신
이전30072A74 후보의 최종검수 대기 상태만10226945의 실제 게시·검수 증거로 갱신했다. R3 literal6·source5·위험/한도와 NOT_ADOPTED·실제 실행0 경계는 불변이다. 독립 이전후보 검토C0/I0/M0이며 새 actual/source 채택을 뜻하지 않는다.
