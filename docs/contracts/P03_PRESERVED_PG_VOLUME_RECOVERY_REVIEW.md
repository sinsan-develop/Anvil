# P03 개발 PG 보존 복구 검토본 r1

2026-10-27 · Main 어울 · 현재 실행 승인0/실행0.

## 판정과 관측 기준

PMO는 신산님 직접 응답에 따라 Anvil의 결정·지원만 재개했다. 실제 DB/서비스 복구·copy/mount/network/PG 생성·기동·정지·Secret 읽기는 이 지시의 범위가 아니다. 권장안은 유일한 원볼륨을 직접 RW로 기동하기 전에 비가동 사본을 보존하고 격리 검증하는 것이다.

2026-10-27 관측은 daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e, 등록 PG container/network 없음, 원 volume anvil-v3-development-pgdata 보존/소비자0, volume labels project=v3/owner=P03/instance dc22a0629e79f259dcd935845e88e58e이다. 이미지594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f, digest postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425가 캐시에 있었다. 실행 전 모두 fresh 대조해야 하며 과거 관측은 실행 허가가 아니다.

이전 읽기 전용 QA는 PG_VERSION 정규파일/비link/3bytes의 PG_MAJOR15만 확인하고 정확 QA를 회수했다. cluster 완전성/schema/migration/DB접속은 미확인이다. 정식 WSL Git ff0fcd13695ae0affa2fd773dc96667e1d7c88f8도 현재 private와 달라 API/Web을 임의로 시작하지 않는다.

## 후보 비교

| 안 | 실제 영향 | 한계 |
|---|---|---|
| 비가동 원볼륨 RO 복사→새 사본 PG 격리 검증→전환 별도 결정 | 원본 RO 읽기, 새 사본에 전체 DB/인증자료 복제, recovery 쓰기는 사본에 한정 | 용량·사본 보호/정확성 검증 필요. 사본 검증/전환은 별도 단계 |
| 원볼륨 RW 직접 기동 | WAL recovery·control/statistics·entrypoint 소유권 처리 가능 | 유일한 보존본 변경. 사전 사본 없으면 시작 전 byte 상태 rollback 보장불가 |

두 안 모두 기존 provision --create는 사용하지 않는다. 그 도구는 새 Secret/역할/schema 초기 생성 경로이며 기존 자원 guard 제거0이다.

## 권장안의 구체 단계·자원 후보

아래 이름은 검토용 신규 literal이며 생성/예약하지 않았다. 충돌/기존존재 시 사용하지 않고 재결정한다.

- 보존 사본 volume: anvil-v3-pgdata-recovery-20261027-r1. owner Project Main, source instance와 원volume 이름/ID·image fullID를 별도 label/receipt로 결박한다. 원본과 사본은 성공/실패 모두 자동삭제하지 않는다. Secret 원문을 label/name/로그에 넣지 않는다.
- 일회 복제 helper: anvil-v3-pgcopy-20261027-r1. 캐시 exact image/pullnever, entrypoint는 postgres 초기화 대신 검토된 복제 전용 명령. network none, 원volume는 /var/lib/postgresql/data RO/volume-nocopy, 사본은 /anvil-recovery-copy RW/volume-nocopy. 이미지 선언 volume의 암묵 익명본이 생기지 않게 모든 선언을 대조한다.
- 사본 검증 PG: anvil-v3-pgverify-20261027-r1. 같은 exact PG15 image, 사본만 PGdata RW, 원volume mount0, network none/port공개0, API/Web 연결0. initdb/default 초기화 entrypoint를 우회하고 기존 cluster를 직접 여는 postgres 경로를 검토한다. PG 사용자 UID/GID와 사본owner를 실제 image/metadata 증거로 고정해야 하며 과거 QA user999를 그대로 추정하지 않는다.
- 복제/검증 helper의 최대수명과 데이터 크기·복제시간·CPU/memory/PID/여유공간 한도는 실행안에서 유한 값으로 정한다. 아직 알 수 없는 원볼륨 크기를 0/무제한으로 대체하지 않는다. 격리 PG의 readiness 관측은 최대120초·기동1회·자동재시도0이다.

### 1. 실행 전 guard와 비밀 보호

fresh daemon/원volume labels/consumer0·imagefullID·새이름부재·3830/5546 및 신규자원 영향0을 확인한다. 원 보호 root0700/uid1000와 bootstrap파일0600 정규/nonlink/realpath를 metadata로만 대조한다. Secret값/DSN·원DB본문은 stdout/Git/대화0이다. 복제는 DB 전체에 인증자료가 포함되는 행위이므로 단순 공개파일 복사라고 설명하지 않는다.

### 2. 비가동 복제·사본 검증

원볼륨은 먼저 소비자0/PG비가동을 확인하고 RO mount만 허용한다. symlink/외부 tablespace·특수파일/다른mount·예상owner/파일구조가 나타나면 현재 복사 범위만으로 완전한 사본을 만들 수 없으므로 중단하고 별도 영향안을 작성한다. 외부경로를 자동 따라가지 않는다.

복제 도구·정확 argv/hash·UID/capability·원본/사본rootowner·mode·숫자UID/GID·파일/디렉터리·hardlink 처리·NUL 안전 상대경로/내용hash manifest를 검토해 고정해야 한다. 파일명/원문을 로그에 덤프하지 않고 집계/최종지문만 공개한다. 원본과 사본의 전체 내용 및 필요한 metadata 일치와 원본 RO를 검증한다. 단순 cp exit0은 일치 증거가 아니다. 예상과 다른 자료는 누락한 채 성공처리하지 않는다.

### 3. 격리 PG 단일 기동·관측

사본에서 PG_MAJOR15·구조/owner·설정/외부참조 경계를 다시 확인하고 원 초기화가 실행되지 않도록 직접 postgres 경로와 기존 데이터필수 guard를 고정한다. Secret/역할/schema/migration을 생성·변경하지 않는다. default entrypoint를 사용할 경우 그 소유권 변경/초기화 분기를 먼저 증명해야 하며 검토 없이 사용하지 않는다.

기동1회 뒤 최대120초의 container state/새ready marker만 확인한다. raw server log 전체/SQL·비밀 원문은 출력하지 않는다. 이 단계 성공 표기는 RUNNING_WITH_READY_LOG / DB_ACCESS_UNVERIFIED이며 DB무결성·최신schema·기능 복구완료가 아니다. 실제 읽기 DB 검사는 허용역할/접속보호참조/정확SQL·상한·트랜잭션/정리 범위를 별도 실행안으로 제시한다.

### 4. 보존·실패·다음 전환

사본 PG 정상/실패 여부와 관계없이 원volume/사본은 보존한다. 최대수명 종료나 실패 때 이번 exact ID/image/labels/mount의 소유 PG에 정상 SIGTERM stop 단1회만 허용하는 실행 범위를 고정한다. 강제종료/반복기동/원volume삭제/백업자동정리0. stop도 사본 WAL/checkpoint 쓰기가 있을 수 있으며 원본 rollback으로 부르지 않는다. 일회helper 삭제는 정확소유/관련process0·mount/volume보존 확인 후에만 하고, sa본PG의 보존/삭제는 실행안의 성공/실패 계약대로 구분한다.

정식 서비스로 전환하려면 검증된 사본을 실제 PGdata로 채택할지, 원본에서 별도복구할지 정확 데이터손실/새변경 보존 한계와 함께 다시 결정한다. 새 정식network/원포트5546·컨테이너/보호bind·API/Web/현재Git/TLS/앱접속은 이번 격리 검증에 포함하지 않는다. 글로벌Docker FORWARD·기존relay·다른서비스 변경0이다.

## 남은 실행안 조건·필요 지원

이 문서는 실행 스크립트가 아니다. PMO가 clone 우선/보존 원칙을 검토한 뒤, Main은 정확 명령파일/hash·새resource/owner/lifetime·최대용량/공간/시간·image 사용자/entrypoint 근거·복제검증·DB관측 범위·실패stop/정리·비밀취급을 고정한 하나의 검토 가능한 실행안을 작성한다. 실제 생성/copy/mount/start/stop/DB·Secret 소비는 그 실행안의 별도 사용자 승인 전 수행하지 않는다. 기존 단발허가나 PMO의 지원 재개만으로 실행하지 않는다.
