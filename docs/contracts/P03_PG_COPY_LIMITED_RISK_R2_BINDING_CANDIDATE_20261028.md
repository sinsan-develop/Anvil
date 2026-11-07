# P03 보호 사본 — R2 고정 리소스 결박 후보

2026-10-28 · Main 어울 · **source-only 채택 후보 / 미채택 / 실제 실행 승인 아님**

## 목적과 결정 경계

원 R1 실제 실행은 NOT_COMPLETE/create-volume/COPY_VOLUME_IDENTITY로 끝났고 단발 승인은 소진됐다. R1 copy volume과 grant/consumed/receipt 원장은 보존한다. 시각 교정 source가 완료돼도 기존 고정 R1 경로로 다시 실행하거나 R1 사본·원장을 비워 재사용할 수 없다. 이 후보는 같은 보호·위험 조건 아래 별도의 R2 고정 리소스에 결박할 source 계약과 자료작성·제품2/직접 기존시험3의 한정 변경 범위를 제안한다.

이번 결정 대상은 아래 source-only 계약·코드/시험 허용 범위의 채택이다. Main은 후보 검수 뒤 PMO에 위임 범위 판정을 요청할 예정이며, 현재 문서 작성 자체가 채택이나 구현 GO는 아니다. 실제 QA/Git checkout·원격 관측·grant/nonce·container/volume·cp/TERM·권한·PG/SQL·서비스 실행은 새 명시적 실제 실행 승인 전까지 0이다. 새 actual 질문도 Main 후보 검수 전에 발행하지 않는다.

## 부모·보존할 사실

- 부모는 P03_PG_COPY_LIMITED_RISK_DELTA_CANDIDATE_20261027.md, SHA256 FFC3F2A2979A7845C48B61946A32F0B142C698ED7C6E8004D3038BAD777670D3이다. 부모의 R1 literal을 수정하거나 R2 승인을 받은 문서로 바꾸지 않는다.
- 원 실제 1회 결정 337E26F75B85F4F04EB9901F899BB5EF87B0631E86A3F834A6EE9933DF6F07D0와 source 승인 5398/54922 계보는 각 원래 대상·범위만 증명한다. 새 R2 source 채택 또는 새 실제 run 승인으로 승격하지 않는다.
- 원 실제 실행 source는 367d9d49daeee08a319431853006db0647129910이며 fbe8b8의 단발 소비·새 R1 volume 생성·helper0/cp 미도달 실패를 보존한다. 결과는 docs/04_test_reports/AV3/P03_LIMITED_COPY_ONCE_20261028_RESULT.md, SHA256 7E365AC623FF97700C91BDA2F8A8CFB0DDF5899581BC92342914FB46CB89272C이다.
- 시각 source 교정 checkpoint 9bb9780e02b31620309109249b0ea33a54a027fc의 Main48 PASS/type0·독립 C0/I0/M0는 source/합성 증거다. 원 actual 실패를 성공으로 바꾸거나 R2 실제 동작을 증명하지 않는다.
- 이 문서의 SHA256은 확정 후 외부 기록으로 관리한다. 채택되면 새 candidate SHA를 controller/shell의 닫힌 결박에 연결할 예정이며 자기 hash를 본문에 넣지 않는다. 구현 이후 exact commit/controller/shell hash는 별도 actual packet에서만 확정한다. 현재 값이나 미래 실행 nonce·기한을 만들지 않는다.

## R2의 정확한 대상 차이

| 대상 | 이번 source 후보의 고정 literal |
|---|---|
| 새 QA sourceRoot | /home/daon/anvil-v3-pgcopy-20261028-r2-src |
| 새 ledgerRoot | /home/daon/.local/share/anvil-v3-pgcopy-20261028-r2 |
| 새 copyVolume | anvil-v3-pgdata-recovery-20261028-r2 |
| 새 toolsName | anvil-v3-pgcopy-tools-20261028-r2 |
| 새 initName | anvil-v3-pgcopy-init-20261028-r2 |
| 새 copyName | anvil-v3-pgcopy-20261028-r2 |

현재 대상 부재·소유·용량을 관측했다는 뜻이 아니다. 실제 승인 후 생성 직전에 exact 부재/owner/realpath/link·도구·daemon/image·원본 신원을 다시 확인하고 충돌하면 사용·삭제·대체하지 않는다. R1 copy/ledger는 이 대상표에 포함하지 않고 계속 보존한다. R2가 실제 승인·실행된다면 보존 중인 R1에 더해 **새 volume 총1개가 추가**되고 실패/부분 사본도 공간을 차지하며 자동 삭제되지 않는다. 이 실제 효과와 보존 책임은 별도 actual 결정에 명시해야 한다.

고정 원본은 anvil-v3-development-pgdata / instance dc22a0629e79f259dcd935845e88e58e / CreatedAt 2026-10-16T03:53:33+09:00 그대로다. daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e, image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f, Node /opt/node-v24.21.0-linux-x64/bin/node 및 SHA256 7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c도 유지한다. source instance·source CreatedAt literal 검사를 느슨하게 하지 않는다.

## 최소 source 변경 표면

| 파일 | 채택 후 허용할 정확 변경 |
|---|---|
| scripts/p03-pg-copy-host.ts | FIXED_COPY의 위 6개 literal 및 limited candidate SHA 결박만 R2로 정합. 시각 교정·나머지 조건 보존 |
| scripts/pg-recovery-copy.sh | strict/limited 결과 두 곳의 copyIdentity.name을 R2 copyVolume으로, limited parser/결과의 candidate SHA를 새 후보로 정합 |
| tests/unit/P03/pg-recovery-copy-host.test.ts | 독립 fixed 객체·grant/metadata/report의 R2 fixture 정합 |
| tests/unit/P03/pg-recovery-copy-docker-time.test.ts | 독립 fixed 객체·candidate/report의 R2 fixture 정합, 시각 기대/거절 보존 |
| tests/unit/P03/pg-recovery-copy-preparation.test.ts | 기존 parseCopyResult가 직접 소비하는 copyIdentity.name fixture 등 해당 결박 정합 |

controller 한 곳만 바꾸면 shell 두 결과가 R1 이름을 반환하여 R2 결과 검증에 실패한다. 시험도 FIXED_COPY를 모두 동적으로 따르지 않으므로 기존 기대를 없애는 대신 정확 fixture만 맞춰야 한다. 기존 시험·부정 기대·원 R1 거절 이력을 보존하고 R1 metadata/grant 불일치 반례를 유지한다. 임의 새 제품파일·의존성·범용 경로/환경변수/외부 입력 선택기를 추가하지 않는다.

프로토콜 식별자 P03_PROTECTED_COPY_R1, P03_PROTECTED_COPY_LIMITED_RISK_R1, 정책 P03_COPY_LIMITED_RISK_POLICY_R1_20261028 및 기존 mode/carrier는 유지한다. 이 R1 접미사는 프로토콜 버전이며 리소스 재사용 허가가 아니다. grant/evidence/결과의 닫힌 key 집합·scope·enum·단발 consume·receipt·최초/후속 신원 대조·원본 RO/nocopy·network none/포트0·init의 새 빈 root1곳 CHOWN만·기존 cap/UID·보존 조건을 확대하지 않는다. 새 candidate SHA는 부모의 위험 delta와 이번 고정 대상 차이를 함께 가리키며 새 실제 승인 자체를 인증하지 않는다.

## 유지할 위험·한도

위험4는 그대로다. 모든 writer의 완전 통제·시점 일관성은 미입증이고 Docker 소비자0은 다른 writer 부재 증명이 아니다. filesystem hardquota는 미강제이며 검사 사이 증가/공유 공간 고갈·즉시 중단 불가가 남는다. ACL/xattr는 도구 미설치/필요 기능 미지원일 때만 미확인 수락 대상이고 속성 존재·조회 오류·보존 실패는 계속 거절한다. Node numeric owner1001 및 owner/loader/hash→실행 경합의 잔여 위험도 새 exact run별 별도 판단 대상이다. 기존 수락을 자동 승계하지 않는다.

최초 실제 승인부터 최대30분·전체600초/source500초/회수reserve25초, source 시작 잔여525초 이상을 유지한다. 논리256MiB/entries100000/관측 할당512MiB guard, 예상 max(logical,allocation)+32MiB와 free reserve128MiB/inodes entries+100, 관측 최대10초 간격·audit tmpfs32MiB·stdout16KiB/control256KiB를 유지한다. 각 role create/start1회·전체 volume1/helper3, 제한 TERM·부분 사본 보존, SIGKILL/force/retry/창 연장0이다. kernel/daemon/IO 불명까지 기한 내 강제 회수를 보장하지 않는다.

## 검증·rollback·후속

채택 뒤 별도 WI/manifest에서 위 정확 표면을 고정하고 TEST_ONLY→Main fresh RED→제품 GO 순서로 진행한다. 새 R2 정상 합성 흐름과 원 R1 이름/경로/candidate/grant의 정확 거절·첫 mutation 전 차단, source literal/nonce/labels/closed keys·단발 소비·오류/보존 조건을 확인한다. shell의 strict/limited 결과 이름 두 곳과 controller 결과 parser가 같은 R2를 소비하는지 대조하고 기존 timestamp 경계/직접 인접 시험·type 및 필요한 shell 구문/합성 검증만 수행한다. 원 실제 실패와 과거 합성 PASS는 지우거나 재분류하지 않는다.

source rollback은 새 R2 결박 변경만 Main이 일반적인 소유 변경 복구로 되돌리는 것이다. R1 source를 다시 선택해도 소비된 원 승인이 되살아나지 않는다. 물리 rollback을 이유로 R1/R2 volume·원장 삭제, 원본 복원이나 재실행을 하지 않는다.

이 후보만으로 실제 부재/권한·복제 bytes/metadata·PG 복구·DB 무결성·서비스/API/UI·전체 P03/작업계획 완료를 증명하지 않는다. source 구현·독립 검수·게시가 끝난 뒤에만 새 exact source/새 run·기한·도구 지문·실제 대상/추가 공간·위험·보존/회수 책임을 묶은 별도 actual packet을 준비한다. 새 명시적 실제 승인 전 QA/checkout/원격/grant·nonce/helper/volume/cp/TERM/권한/PG/SQL/서비스/Secret/Agent 효과는 모두 0이다.
