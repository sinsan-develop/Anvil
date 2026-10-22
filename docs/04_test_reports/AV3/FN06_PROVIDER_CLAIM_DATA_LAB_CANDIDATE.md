# FN06 claim 실DB 원자성 시험 — 한정 실행 후보

- 상태: source 준비·실제 실행 미실행. 전체 FN06/Agent 연결 완료가 아니다.
- 계획: Stage C / FN06. 실DB 원자성과 명시 합성 source/OS 전제를 구분한다.
- 부모: ae466b4300985a5e47644adeb7232e06fa09c085. 게시 exact commit은 Git으로 별도 전달한다.

## 1. 이번에만 새로 확인할 내용

기존 정상 프로젝트/내용 확정 임무를 선행으로 재사용한다. 정상 API로 후보·역할·예약과 host 등록·서명 증명·합성 HUMAN 확인·새 nonce의 status-only 교환을 저장한다. 정상 정책/한도·context/preparation·grant/queue와 서명 START permit 소비 후 원 claim 서비스를 호출한다.

1. 보호 함수가 실제로 flush된 뒤 의도적으로 실패하면 nonce/claim/proof mapping/receipt/감사 원장 전체가 rollback되는지 확인한다.
2. 같은 proof로 정상 저장 후 별도 app-role 연결에서 정확한 원문/hash를 읽는다.
3. 같은 proof 재확인은 추가 행이 없고, 새 proof는 원 claim/receipt를 유지하면서 자기 nonce·proof mapping만 추가하는지 대조한다.

완료한 schema-only closure case나 기존 결과제출 case는 반복하지 않는다. base59와 pending SQL 준비는 이 새 폐기형 cluster의 필수 선행일 뿐 새 schema 성공 보고가 아니다.

## 2. 고정 source·제외

|대상|SHA256|
|---|---|
|tests/integration/FN06/provider-claim-data-case-qa.ts|A66A308DBE2B39A903D2BDE349B623D359F5F39035662860F02DDDE2EB370767|
|tests/integration/FN06/provider-claim-data-lab-qa.ts|0C93A316CB4053B8D2FCC083C16F485E5A934E3F6B74AE83C66DA26F1296E7D5|
|scripts/provider-claim-data-isolated-qa.ts|1774517A4FFC5A3F48541E04434B32F4F2A73D41F58D4C8C9DB2C5FB312CE0B7|
|0037_provider_session_claims.sql.pending|EB4CC66E8D682F08225823E39BAE5AD40F7AF62B529D3774291E855F34536097|

기존 base59 manifest는 불변이며 pending은 schema_migrations에 등록하지 않는다. 제품 current fallback을 추가하지 않는다. 원 challenge store의 HUMAN/session/client/current policy/budget/revocation 검사와 실제 writer 원장을 소비한다. source/OS/capability·Provider 응답·암호문 metadata는 명시 합성 전제이며 실제 관측/DPAPI/Agent 실행 증거가 아니다.

정식 DB/기존 역할·정책·계정/Secret/cert·서비스/native/실 handle/실제 Agent·외부 비용·Oracle·P2/P3 및 기존 특정 거절 범위는 제외한다.

## 3. 생성 전 등록 자원

|항목|정확한 대상|
|---|---|
|서버/실행자|WSL-server / daon UID1000|
|새 빈 Git 경로|/home/daon/deploy/anvil-v3-fn06-claim-data-qa-01|
|일회성 원문 경로|같은 root/.av3-data/fn12-raw 및 빈 parent .av3-data|
|컨테이너|anvil-v3-fn06-claim-data-pg-01|
|internal network|anvil-v3-fn06-claim-data-net-01|
|폐기 DB|anvil_v3_fn06_claim_data_qa_01|
|owner/run label|AV3_FN06_CLAIM_DATA_QA / 새 무작위 32hex|
|Docker daemon|e3349f1d-dbfc-478a-96d9-295bf6c6839e|
|PG15 image|postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425|
|image ID|sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f|
|저장/접속|tmpfs512MiB / 공개port·volume·hostmount·정식net0|
|Node|/opt/node-v24.21.0-linux-x64/bin/node / SHA256 7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c|

실제 생성 전 root/link/realpath/소유자/부재, daemon/image/정식3 metadata를 다시 대조한다. private Git exact SHA만 clone하고 같은 lock bytes의 기존 node_modules를 읽기 참조한다. Windows source 복사·서버 patch0.

## 4. 합성 키·등록 비밀 수명과 정리

새 cluster 안에서만 migrator/app·NOLOGIN claim-writer와 합성 사용자/정책을 만든다. app은 비관리자다. 기존 fixture의 app/admin 접속은 새 cluster의 같은 무작위 password를 쓰되 실제 역할·권한은 분리한다. 기존 계정/비밀은 읽거나 바꾸지 않는다.

child가 새 P256 키·one-time code·status-only credential을 정상 protocol로 생성한다. 전부 새 lab 메모리/tmpfs에만 있으며 Git/파일/원문 로그·반환값에 넣지 않는다. status-only는 실행 grant가 아니다. child 기한 최대100초 내 유효창을 부여하고, 종료 후 프로세스와 새 tmpfs cluster를 회수한다. JS 문자열의 완전 메모리 소거를 보장하지 않는다.

전체 자원 수명 최대10분, source 외부 bootstrap240초/TERM 후50초, runner 외부180초, child최대110초/기존시험90초, 정리25초. clone 전에 EXIT/TERM/INT trap을 둔다. timeout/failure를 PASS로 바꾸지 않는다.

정리는 exact fullID/owner/runlabel/image/net/tmpfs/port·mount와 경로 owner/realpath/link/process를 확인한 등록 대상만 수행한다. child 원문 root는 기존 hash/owner 검사로 정리하고 빈 parent만 제거한다. 잔여/guard 실패면 source를 보존하고 cleanupFailure를 남긴다. pool close 실패가 PG/net 정리를 건너뛰지 않게 개별 정리한다. 끝난 뒤 별도 SSH로 exact ID/label/path/process 잔여0과 정식 metadata 불변을 확인한다.

## 5. 확인된 것과 다음 판정

- 신규 guard7PASS321.3289ms·type/diff0. 신규 실제 PG/등록/START/claim 실행0.
- caller 독립 C0/I0/M1·실행0. M1은 Main이 정확 거절 상수 검사로 보완했으며 독립 clean으로 소급하지 않는다.
- 신규 runner 한정 독립 C0/I0/M0·실행/수정0이다. timeout/SIGKILL 실제효력·PG/credential수명·정리/별도잔여는 실행 전 미판정이다.
- PMO에 정확 게시 commit·위 source·새 자원/credential 수명을 제출해 이번 1회 실행 범위를 판정받는다. 원본 schema lab 허가나 단위 PASS를 실제 새 실행 허가·결과로 소급하지 않는다.

