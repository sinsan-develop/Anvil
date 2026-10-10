# U-01 Task4 R6 PAIR pre-navigation 인과 진단 결과

## 판정

- 비제품 진단 WorkInstruction의 C8 구현, WSL-server A/B 격리 실측, B8 증거 결박, H8 임대 회수는 수행했다. 두 실제 R6 opt-in은 모두 **FAIL**이며 `U-01 NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`를 유지한다. 첫 후속 reload 없이도 원 pair 응답 BODY 대기가 관찰됐으므로 이번 한 쌍에서 그 reload는 대기의 필수 조건이 아니다. 원 요청 본문 대기의 직접 원인과 제품 결함은 확정하지 않았다.
- 설계 SHA256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획 SHA256 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, WI SHA256 `546064FA53412E7D2DF8873EB046929B48CC6D60287068AA0D2361A8966FD86E`, Invocation SHA256 `44666EF467BE22EC5D6AF219506BCC65004DDDD2D85FCD0AD053EDEF7392AC56`, 부모 승인 SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`.

## 계보·검증

- 단일 branch `codex/u01-dashboard-r2`: W9 `5914b3ea220122d372844bceda64e350e7ab1f16` → A8 `2e8bb6d1d1a81b88e597dac3ae19ab4da183848e` → C8 `fc80b98e9aca47ff0e81e70ff9becd5d39503002` → B8 `082b0a553e19deeef0f84ff9afea8ae56f244e46` → H8 `99e91e49444ae94cf33e91c9eb03afc95c72cacd`, 각 직접 부모다. 신규 branch·PR/main 병합·history rewrite·ysna/Production 접근0.
- C8은 검사기·통제 테스트·브라우저 하네스·통합 테스트 정확4 비제품 코드 경로다. 독립 재검토 Critical0/Important0/Minor0, 로컬 tooling prenav6·integration11 PASS, Node A/B self-test·구문 exit0, clean/private 실제 G-05 seq2377 PASS. 이 테스트 범위를 R6 전체 PASS로 승격하지 않는다.
- B8은 C8 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4이며 local/private 동일·tracked clean·실제 G-05 seq2377 PASS. H8은 B8 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5, 원문 seq1~2377 보존 뒤 seq2378 write→2379 worker REVOKED, 완료 lease 두 개 보존·활성 agent/lease null·제품 write0, local/private 동일·tracked clean·실제 G-05 seq2379 PASS다. 이 결과보고 tail 자체의 G-05는 게시 뒤 별도 판정한다.

## WSL-server A/B 격리 실측

- A/B는 각각 새 빈 사전등록 Git checkout에서 동일 C8 exact SHA를 수신했다. 각 WSL G-05 seq2377 PASS. A Node24 Web build20 exit0·비 opt-in Python11 PASS/55 deselected. B Node24 Web build20 exit0. 같은 PG15/Node24/Playwright image digest, migration `0019_oidc_sessions`, 비관리자 role/DB, seed/permission contract SHA256 `B1EFC1F00D408D3CD154D042AF379F490E33E4E295CFE5EFC4FB7085D32E9CE2`, harness SHA256 `BBFF51615382D1D70A9C8F2A11C17179345C10D06FEDC98BDA63AE7E5846A88D`, Chromium `151.0.7922.34`, timeout `10000ms`를 비교했다. A 완료·정리 잔여0을 확인한 뒤 B를 생성했다.
- A 기존 R6는 **exit1, 1 failed/1 warning**: 원 `PAIR_LIST_API` status404 BODY/requestfinished/response.finished PENDING, 관측 round1→settled round4, lifecycle BEFORE_BODY. ASGI 4XX final body DONE 9건·독립 무자격 same-origin probe DONE/CLEAR는 원 요청 완료의 대체 증거가 아니다.
- B 첫 pair capture를 최초 후속 reload 전에 기다리는 모드는 **exit1, 1 failed/1 warning**: `PAIR_PRENAV_BARRIER / PRENAV_BODY_PENDING`, 원 pair id4·observed_round1·settled_round1, BODY/requestfinished/response.finished PENDING, 첫 후속 reload `NOT_STARTED`. ASGI 4XX final body DONE 3건·독립 probe DONE/CLEAR. 유효 barrier에 진입해 기존 제한시간 안에서 대기가 재현됐다. 이에 따라 이번 실측에서 후속 reload는 최초 대기의 필수 원인이라는 가설을 지지하지 않는다. 독립 반복·추가 반증 및 원 fetch의 직접 원인 확정은 미실행이다.
- A 첫 migration clean 사전검사, pytest 선택의 SSH pipe CR, 정리 사전검사 오류와 B 첫 single-branch clone의 `development/main` ref 누락은 각각 별도 실패로 보존했다. 정확한 조건 보정 뒤 별도 재검증했으며 최초 실패를 PASS로 소급하지 않았다. A/B 각각 등록 경로·컨테이너 ID/name/label/image/mount/port·프로세스를 확인해 해당 전용 QA 자원만 정리했고 독립 조회에서 경로·컨테이너·loopback5545 잔여0이다. 비밀값·DSN 원문 기록0, 공유 DB/서비스 변경0.

## 미검증·다음 조치

- DC-U01-019를 열린 미진으로 유지한다. 원 브라우저 fetch 404 BODY 대기와 ASGI final-send/독립 fetch DONE 사이의 차이를 별도 최소 비제품 WI에서 좁힌다. 404 허용·timeout 연장·body/Secret/off-origin 감사 생략·F-19A 임의 활성화로 GREEN을 만들지 않는다. 실제 제품 수정·R6 PASS·U-01 인수·main 병합은 주장하지 않는다.
- 두 정확 Project·Environment 조합, 서울 달력일 경계, E-NET/E-API/E-AUD/E-SHOT와 필수 `AV-SAFE-034`·`AV-OPS-027`·`AV-UI-017` 실측은 남아 있다. 실패/미실행을 WORK_STATUS와 design_change에 보존하고 기존 branch에서 승인 범위의 안전한 후속 검증을 계속한다. 필요 시 신규 commit만 정상 `git revert`하되 역사 Event·승인·사설 원격 복구 ref를 보존한다.
