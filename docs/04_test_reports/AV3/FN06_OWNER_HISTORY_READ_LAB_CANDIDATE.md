# FN06 OWNER 인증 조회 — 한정 실행 후보

- 상태: source 준비·실제 HISTORY_READ 실행 미실행. 기존 원자성 검증과 다른 조회 소비 공백만 다룬다.
- 기준 부모: c7c9bd98642e14d3ddaab54d48069fc777ba5368. 게시 exact commit은 별도 Git 증거로 전달한다.

## 1. 변경과 검증 범위

기존 OWNER receipt/list GET·current HUMAN/session/member 검사·원30초반환창·ApiClient/Webreader는 수정하지 않는다. 신규 test-only HISTORY_READ는 정상 예약·서명 등록·합성 HUMAN 확인·정책/한도·context/preparation·grant/서명 START 뒤 정상 claim을 단1회 저장하고 조회 선행으로만 사용한다.

- 정상 OWNER 쿠키로 기존 Webreader의 목록·정확 receipt GET를 소비해 원 claimRef/hash/receipt와 비교한다.
- 다른 합성 HUMAN은403, 무쿠키는401이며 기존 오류 DTO의 정확6키·고정message/허용code·빈details·targetnull만 허용한다. 보호receipt/목록/claimRef가 거절본문에 섞이면 실패다.
- 조회 전후 claim 관련6원장의 전체 snapshot을 비교한다. GET를 허가·갱신·실Agent/Provider 증거로 승격하지 않는다.
- ATOMIC의 fault/replay·완료schema-only 검사는 호출하지 않는다. 정상1회 저장·기존 임무 준비는 새 조회 시험의 필수 선행이지 별도 반복 진도가 아니다.
- 실제 브라우저 DOM·정식 served 로그인은 이번 API→Webreader 결과와 구분한다.

## 2. 고정 source

|대상|SHA256|
|---|---|
|tests/integration/FN06/provider-claim-owner-read-qa.ts|88EA17CB054337699560B2D3E8C40E2669ECAE2E3875CDD22619EFDF2588AD4C|
|tests/integration/FN06/provider-claim-persistence-qa.ts|132E1FBE89E97A19E08260FB7766B06F4D49060B93C8248308692DC894A0858D|
|tests/integration/FN06/provider-claim-data-case-qa.ts|1EB191019196B28A30B91DADDEC3B7D747019DD8D1087F5EEBF80050A3CD06F2|
|tests/integration/FN06/provider-claim-data-lab-qa.ts|1F8B6EFFB24DA0E6910482DD80C8835CAC3FEA37F5A8D616D2119EC7AA53592F|
|tests/integration/FN12/result-submission-isolated.test.ts|364BBC26898936B207A52D4B366DC06E1652B9B990C83FF70E12452BDD1B092B|
|scripts/provider-claim-data-isolated-qa.ts|9F0DB605FC2E7B823B3C8FAA01C9AE25EE2C5732D2A7BDD31A73726B5C723F67|

ANVIL_FN06_CLAIM_DATA_CASE=HISTORY_READ를 정확 지정한다. 알 수 없는 case는 거절하고 default ATOMIC과 필수 성공 표식을 분리한다. --plan은 해당case/actualExecutedfalse/base59를 표시한다. 원59manifest와 pending0037 EB4CC66E8D682F08225823E39BAE5AD40F7AF62B529D3774291E855F34536097은 불변·pending등록0이다.

## 3. 자원·수명·비밀·정리

이전 FN06_PROVIDER_CLAIM_DATA_LAB_CANDIDATE.md §3~4와 같은 literal에 새run/새빈1회만 사용한다.

- WSL-server UID1000 daon, root /home/daon/deploy/anvil-v3-fn06-claim-data-qa-01 및 .av3-data/fn12-raw.
- PG anvil-v3-fn06-claim-data-pg-01, internalnet anvil-v3-fn06-claim-data-net-01, DB anvil_v3_fn06_claim_data_qa_01, owner AV3_FN06_CLAIM_DATA_QA·새random run.
- daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e, PG15 digest6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425/image594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f.
- Node /opt/node-v24.21.0-linux-x64/bin/node / SHA7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c.
- tmpfs512MiB, 공개port·영구volume·hostmount·정식net0. private Git exact clean·동일lock의읽기deps만.
- 새lab 내부 합성사용자/정책/역할 및 P256/one-time/status-only credential만 정상 protocol 선행으로 생성한다. child100초유효·원문키/code/cookie/Git로그/반환0. JS문자열 완전소거보장은 없다.
- 최대10분/bootstrap240초+TERM50/runner180/child110·기존test90/회수25. clone전trap·생성전 부재/owner/link/daemon/image/정식3metadata를 다시 확인한다.
- 종료 exactID/label/image/net/port/mount·owner/realpath/link/process를 대조해 등록 대상만 회수하고 별도 SSH의 ID·label·root/cwd 잔여0·정식3불변을 확인한다. 잔여/guard거절이면 source보존·cleanupFailure이며 우회하지 않는다.

## 4. 증거와 제외

consumer/seed/case 반례를 먼저 RED로 확인했다. 최초 독립 C0/I0/M1은 상태만으로 거절을 통과시키는 시험 공백이며, Main이 정상 오류 DTO+receipt(403/401 각각)·nested details.receipt 음성 RED→GREEN으로 보완했다. 실제 제품 누출 발견이나 독립 clean 소급이 아니다.

source/OS/capability·Provider 응답/암호문 metadata는 명시 합성이다. 정식 DB·기존계정/권한/정책·Secret/cert·서비스/native/실Agent·비용·Oracle·nonOWNER 현재HUMAN책임관계·P2/P3·기존 특정 거절은 제외한다. 실제 조회 성공/원장불변/정리·정식불변은 새 실제출력 전 미검증이다. 전체 FN06/Stage·작업계획 완료 주장이 아니다.
