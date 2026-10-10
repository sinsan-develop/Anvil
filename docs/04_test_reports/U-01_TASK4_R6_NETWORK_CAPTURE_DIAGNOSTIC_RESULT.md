# U-01 Task4 Foundation R6 Network 응답 capture 진단 결과

## 판정

C5의 새 빈 WSL-server Git exact-SHA 격리 PG15/OIDC/HTTPS/Chromium R6 opt-in은 **exit1, `NETWORK_RESPONSE_FACTS` 실패**다. 비밀 없는 추가 계측으로 실패 요청의 형태가 `PAIR_LIST_API`, 정체 지점이 응답 본문 `BODY`임을 확인했다. 404와 요청·응답 완료 대기의 근본 원인 및 제품 영향은 아직 확정하지 않았다. 전체 R6 `FAIL`, U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`이다. 새 미진은 `design_change.md` DC-U01-019로 분리하며 PR/main 병합·새 브랜치·ysna-server 작업은 하지 않는다.

## 기준·변경·검증

- 승인 설계 SHA-256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획 SHA-256 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, 진단 WI SHA-256 `B6E0B4FF4C637595CE8C4CFACCA7C980BD76BA33EA4D2358A4D6DFF3BEBAFF33`, 부모 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`. 기존 `codex/u01-dashboard-r2`에서 W6 `af2ba067`→A5 `265c7b88`→C5 `f7e6aa4e`→B5 `d5f7cfc7`→H5 `2818112ababaa47ac120d273d1cd58a969326e70` 직접 부모 순서를 유지했다.
- C5는 검사기·통제 테스트·브라우저 하네스·통합 하네스 정확4 코드 경로만 변경하고 제품·API·DB schema·인증·권한·Secret·운영은 불변이다. 비밀 없는 route class/stage/lifecycle marker의 정상·위조를 RED→GREEN으로 검증했다. 독립 재검토 Critical0/Important0/Minor0, Main 새 통제 class 7 PASS/95.36초 및 Node 구문·audit/R48 self-test exit0. 전체 역사 통제 회귀 시도에서는 실패 1건 출력 후 중단하여 그 범위는 PASS가 아니며 단언·원인 별도 분류가 필요하다.
- C5 local/private clean G-05 seq2362 PASS. WSL-server 전용 checkout은 C5 exact SHA·clean이며 첫 G-05의 remote 이름 `origin` 대 정본 `development` 오류는 전용 checkout의 remote 이름만 고친 뒤 같은 SHA G-05 seq2362 PASS로 분리했다. Node24 의존성·Web build20·Playwright, 비관리자 PG15 role/DB·migration `0019_oidc_sessions`를 확인했다. 첫 전용 DB migration이 0020까지 갔으므로 이 빈 DB만 0019로 내린 뒤 실제 R6 opt-in을 실행했다. **1 failed/2 warnings in 21.51s**: `OTHER_API status=404 reason=TIMEOUT index=4 observed_stage=PRE_AUTH_LOADING_DOM observed_round=1 settled_round=3 route=PAIR_LIST_API capture_stage=BODY requestfinished=PENDING response_finished=PENDING request=SEEN response=SEEN status=403 finished=DONE page=BODY_DONE`. 앞선 STORED_ROW 단언 도달을 전체 R6 PASS로 승격하지 않는다. npm high-severity audit notice 1건은 자동 수정하지 않았다.
- 전용 PG exact ID `05550d430e64e49f9fb3813f60ad11b62da2005fbefc17751d2523ab1343b1e7`, image `postgres:15`, scope/SHA label, tmpfs·mount0·loopback5545를 확인해 종료했다. 브라우저·Node는 AutoRemove. 전용 checkout/venv/비밀 저장/evidence의 owner·realpath·link·mount를 확인해 정확 대상만 제거했다. 정리 스크립트는 잔여0 marker를 출력했지만 마지막 CR 때문에 exit1이었으므로 성공으로 세지 않았다. 별도 읽기 전용 조회에서 전용 경로5·컨테이너3·port5545 잔여0을 확인했다. 공유 서비스·다른 checkout·ysna/Production 변경0.
- B5는 실측 실패와 정리를 progress/HANDOFF/digest/WORK_STATUS 정확4문서로 결박해 local/private clean G-05 seq2362 PASS. H5는 Event seq2363 write→2364 worker 순으로 epoch115 임대를 REVOKED, active agent/dual lease null·제품0으로 결박했고 독립 Critical0/Important0/Minor0, local/private clean G-05 seq2364 PASS. 원본 C `3e788ed2` G-05 실패와 C3 STORED_ROW 실패는 불변이다. 이 결과보고 tail의 최신 G-05는 게시 후 별도 확인한다.

## 미충족·다음 안전 조치

별도 최소 WorkInstruction에서 PAIR_LIST_API 404와 BODY 완료 대기의 재현·원인을 분리한다. F19A 경로를 임의 활성화하거나 404 허용·timeout 연장·본문 감사를 생략하지 않는다. 새 exact-SHA WSL-server 격리 재시험, 전체 E-NET/E-API/E-AUD 및 U-01 필수 ID별 독립 판정은 남아 있다. rollback은 새 commit만 정상 revert하고 역사 Event·보고·원격 복구 ref를 보존한다.
