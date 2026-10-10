# U-01 Task4 Foundation R6 STORED_ROW 확인 버튼 단언 보정 결과

## 판정

`STORED_ROW_CONTROLS`의 역사적 하네스 충돌은 승인된 `open` Critical 행의 확인 버튼 계약에 맞게 보정했고, C4 `f4c535771f0f71f3e17e5ae9103976e50f7e71ef`의 새 빈 WSL-server PostgreSQL 15/OIDC/HTTPS/Chromium 실행은 그 단언과 뒤따른 entity/cause 단언을 지나갔다. 그러나 R6 opt-in 전체는 **exit1, `NETWORK_RESPONSE_FACTS`에서 실패**했다. 따라서 `R6 FAIL`, U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`이며 PR/main 병합·새 브랜치·ysna-server 작업은 하지 않는다. 새 실패는 `design_change.md` DC-U01-018로 분리한다.

## 기준·변경·검증

- 승인 설계 SHA-256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획 SHA-256 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, 현 WI SHA-256 `00E4633C779EB8932BD8F98631EA6EF51F55F724D5E6E87F0A53E39B12D56525`, 부모 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`. 시작 W5 `30823b36`→A4 `653f6eea`→C4→B4 `0b7eb53c`→H4 `604921aae97c5927e86009ef64b163afb15bb79a`는 기존 `codex/u01-dashboard-r2`의 직접 부모 순서다.
- C4 변경은 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs` 정확 3경로이고 제품 코드·API·DB schema·ACK 인가/감사/Network 계약 변경은 없다. 저장된 열린 Critical 행에서 확인 버튼 정확 1개·`type=button`·문자 `확인`을 확인하며 비-ACK 링크·입력·선택·추가 버튼을 거부한다. 버튼 활성화나 ACK 클릭 성공을 이 단언으로 대신하지 않는다. Developer RED→GREEN, Main 독립 집중 10 PASS/131 deselected/97.68초, Node 구문·audit/R48 self-test 및 diff check exit0, 독립 검토 Critical0/Important0/Minor0. C4 local/private clean G-05 seq2357 exit0.
- WSL-server의 전용 Git checkout은 C4 exact SHA다. 첫 `--single-branch` checkout에서 `development/main` ref 누락으로 G-05 exit1이었으며 전용 checkout에 이 ref만 fetch한 뒤 같은 SHA G-05 seq2357 exit0을 확인했다. 전용 Node24 `npm ci --ignore-scripts`와 Web build exit0, PostgreSQL 15의 비관리자 role/DB 및 migration `0019_oidc_sessions` 확인 후 `tests/integration/test_f20_u01_oidc_browser_pg15.py::test_opt_in_r6_oidc_browser_pg15`를 실제 실행했다. 결과는 **1 failed, 2 warnings in 21.97s**, 비밀 없는 분류는 `R6_BROWSER_FAILED stage=NETWORK_RESPONSE_FACTS exit=1 class=Error category=OTHER_API status=404 reason=TIMEOUT index=4 observed_stage=PRE_AUTH_LOADING_DOM observed_round=1 settled_round=4 request=SEEN response=SEEN status=403 finished=DONE`이다. 응답 capture의 실제 원인과 제품 영향은 미확정이다. 두 warning은 HTTPX verify 문자열/Starlette TestClient deprecation이고 npm ci high-severity audit notice 1건은 자동 수정하지 않았다.
- 전용 PG exact ID `467d94a4c85d9adf2f96d50e478f5b0f83c2f1876c476b4d8d400b0ad5332d2e`, scope/SHA label, image, tmpfs, mount0, loopback5545를 확인해 종료했다. 브라우저·Node는 자동 종료했다. 전용 checkout/venv/evidence와 일회성 DB 비밀파일은 owner·realpath·link·process·mount를 확인한 정확 대상만 제거했고, pytest base는 생성되지 않았다. 전용 경로4/컨테이너3/port5545 잔여0 `U01_R6_E114_QA_RESIDUE_ZERO` exit0. 공유 서비스·다른 checkout·ysna/Production 변경0.
- B4는 실측 실패와 정리를 progress/HANDOFF/digest/WORK_STATUS 정확4문서에 결박했고 local/private clean G-05 seq2357 exit0. H4는 Event seq2358 write→2359 worker 순으로 epoch114 lease를 REVOKED, active agent/dual lease null·제품 scope0으로 결박했고 local/private clean G-05 seq2359 exit0. 원본 C `3e788ed2`의 G-05 FAIL과 C3 `STORED_ROW_CONTROLS` 실패는 역사 기록 그대로다. 이 보고 커밋의 최신 G-05는 게시 후 별도 확인한다.

## 미충족·다음 안전 조치

`NETWORK_RESPONSE_FACTS`의 `OTHER_API` 404/TIMEOUT capture 원인을 별도 최소 WorkInstruction에서 비밀 없는 재현·원인 분리로 처리한다. 새 exact SHA WSL-server 격리 재시험과 전체 E-NET/E-API/E-AUD·U-01 필수 ID별 독립 판정이 남았다. 이 절편의 통제 G-05나 앞선 단언 도달을 전체 R6 PASS·제품 결함 부재·사용자 인수로 승격하지 않는다. rollback은 새 변경 commit만 정상 revert하고 역사 Event·보고·원격 복구 ref를 보존한다.
