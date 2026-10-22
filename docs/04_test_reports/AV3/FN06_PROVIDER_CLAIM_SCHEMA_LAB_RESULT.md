# FN06 provider claim 미적용 SQL 격리 검증 결과

- 판정: **구문·스키마 COMMIT·최소 권한 한정 확인**. 전체 FN06·정식 적용 준비·실제 Agent 연결 완료는 아니다.
- 담당/일자: Main 어울 / 2026-10-22. 승인: 신산님 A~C 구현 승인과 PMO의 새 exact 후보 1회 lab 위임.
- 원 실패: source `63e731a141b593c821d61d49b8c4145ab4ab8341`, pending `2CD2D7D6BA08C0EBA84A82FBCBC13DE6828F717BE85F90CC72F641FFF5CD671B`, SQLSTATE `42601`, position `14220`, phase `PENDING_SCHEMA_TRANSACTION`, exit1. COMMIT/closure 양성0. 회수 후 독립 잔여0. 이 실패를 소급 PASS하지 않는다.
- 최소 보완: pending128행의 `IS DISTINCT FROM CASE … END OR`를 `IS DISTINCT FROM (CASE … END) OR`로 변경. 괄호2개뿐이며 독립 delta C0/I0/M0·실행0. 별도 lab 준비 검토 C0/I1/M1의 정리 예외/전체열 ACL 누락은 Main 2RED→4PASS158.4095ms·type/diff0로 보완했다.

## 새 실제 실행

- source local/private exact `62d36f75b4b0cca88eb0c75975ec4e5f6545ac2d` / branch `codex/av3-stage-b`.
- pending SHA256 `EB4CC66E8D682F08225823E39BAE5AD40F7AF62B529D3774291E855F34536097`; runner `D7B5EBF0F25397C591257CD4B84487667A605CC3EB5CF3039C54C529BFEDE7C4`; helper `4C73DF92A31B377DFEDFF40F946FD5B4CFB48FF4394AA412CB62833566631247`.
- 기존59 migration/manifest SHA256 `b6ef4ee7cd973736b0ba108479b5e0ecf4429af7ce572d900389dcec3f0cfef5` 불변. pending은 manifest 등록 없이 새 lab의 별도 transaction에서만 소비했다.
- 실행 명령: WSL 새 exact Git root에서 고정 Node24.21로 `ANVIL_FN06_CLAIM_SCHEMA_QA=1 ANVIL_FN06_CLAIM_SCHEMA_SHA=<위 SHA> ANVIL_FN06_CLAIM_SCHEMA_EXPIRES=<유한 epoch-ms> timeout --signal=TERM --kill-after=30 180 /opt/node-v24.21.0-linux-x64/bin/node scripts/provider-claim-schema-isolated-qa.ts --run`. env는 PATH/HOME/LANG 및 이 세 flag만 전달했고 비밀은 프로세스 내부 합성값만 사용했다.
- 원 결과: `phase=DONE`, exit0, `schemaCommitted=true`, `pendingRegistered=false`, `formalApplyReady=false`, `formalDbChanges=0`, `actualAgentCalls=0`.
- 확인: writer NOLOGIN/NOINHERIT·관리/우회 속성0; membership 양방향0·schema CREATE0; 보호함수 고정 owner/search_path, PUBLIC EXECUTE0·app 정확 EXECUTE; table SELECT26/INSERT3 및 전체 열 ACL UPDATE key7; helper8 EXECUTE; app 신규3표 직접 DML9거절; 빈 인자 보호함수42501·claim/감사 잔여0. UPDATE key는 실제 수정 권한이며 무해한 잠금 권한이 아니다.

## 자원·회수

- root `/home/daon/deploy/anvil-v3-fn06-claim-schema-qa-01`; PG `anvil-v3-fn06-claim-schema-pg-01`; internal net `anvil-v3-fn06-claim-schema-net-01`; DB `anvil_v3_fn06_claim_schema_qa_01`; uid1000 daon·owner `AV3_FN06_CLAIM_SCHEMA_QA`.
- PG15 digest `6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`; image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`; tmpfs512MiB, 공개port/영구volume/mount/정식network0.
- PG ID `31c7a571cda3eb8d46a20c6c15dc54cb18708b3982c3dead90e0872a06960b9c`; net ID `68d2440845f18b08749a95e597ef46adc079e0af711c7b8da28f30aa9f905bd3`; run `e910b174baa055ba48dc923357986259`.
- runner `failure=false/cleanupFailure=false`; bootstrap `status=0/safe=1/path_exists=0`. 뒤 독립 SSH exit0에서 exact IDs·runlabel·이름·root·관련 cwd 잔여0, daemon 동일, 정식 PG/API/Web fullID/image/StartedAt/runningfalse 동일 확인.
- source 회수는 exact owner/realpath/nonlink/Git/프로세스 확인 뒤 임시 root만 삭제했다. 새 lab DB/내부 합성 역할은 tmpfs container와 함께 폐기했으며 재생성은 기록된 exact Git으로 가능하다. 정식 DB/데이터·기존 계정/Secret/서비스 변경0.

## 남은 작업

- claim 실제 데이터 COMMIT/멱등·nonce/claim/receipt/감사 원자성, THREAD/TURN 부모 관계: **NOT_EXECUTED**.
- 정식 DB 반영·실제 served 화면·native 보호 저장/OS 소유·실제 Agent 호출·nonOWNER 책임자: 미완료/미검증.
- 다음: 기존 서명·nonce·원 START permit 경로를 재사용하는 새 claim 저장/별도 재조회 시험을 준비한다. 현 lab 한정 PASS를 연결 기능 전체 완료로 승격하지 않는다.
