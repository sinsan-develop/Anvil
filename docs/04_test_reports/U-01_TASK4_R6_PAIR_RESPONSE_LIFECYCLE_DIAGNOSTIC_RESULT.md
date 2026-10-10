# U-01 Task4 Foundation R6 PAIR 응답 수명 진단 결과

## 판정

- `WI-U01-TASK4-R6-PAIR-RESPONSE-LIFECYCLE-DIAGNOSTIC-20261011-001`의 비제품 관측·격리 재현·임대 회수는 수행했다. 실제 R6 opt-in은 **FAIL**이다. `U-01 NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`를 유지한다. 본문 대기 인과관계나 제품 결함은 아직 확정하지 않았다.
- 설계 SHA256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획 SHA256 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, WI SHA256 `32542762EF6ABE60F6935445E4153628C90CA85D282644248B662DF5ABC88164`, Invocation SHA256 `AD099FF4BEA1D167BE94366B87A37D7543D137FB5EE64F9E7287400569C8B373`, 부모 승인 SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`.

## 범위·계보

- 단일 branch `codex/u01-dashboard-r2`: W8 `a1962ec6d47f082cdce7d10ce9745c61e4e2a947` → A7 `3b5fb2d1488276ebdedb3dbcf00343e778e40d69` → C7 `edbd8e5de57740b24fc9f7f6393f5c2e9b8821ca` → B7 `81e874c190d5202c41b6a67241fabcd1cd993cd1` → H7 `de4c2afb664327bfc30c87721013f6194bda5920`, 각 직접 부모다. 신규 branch·PR/main 병합·history rewrite·ysna/Production 접근0.
- C7은 검사기, 통제 테스트, 브라우저 하네스, 통합 테스트 정확4 코드 경로의 비제품 진단이다. 독립 재검토 Critical0/Important0/Minor0, 로컬 tooling focused6·integration focused9 PASS, Node 구문/self-test exit0, clean/private 실제 G-05 seq2372 PASS. Windows 전체 비-opt-in integration은 기본 Temp 56 PASS/1 SKIP/3 setup ERROR, 첫 전용 base 58 PASS/1 SKIP/1 기존 Path.resolve WinError5 FAIL, 둘째 별도 등록 단일 escalated 1 PASS/1 warning이다. 전체 PASS로 소급하지 않는다.
- B7은 C7 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4, Event seq2372 불변, 독립 검토 Critical0/Important0/Minor0, local/private 동일·tracked clean·G-05 seq2372 PASS. H7은 B7 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5, Event seq1~2372 raw prefix 보존 뒤 seq2373 write→2374 worker 회수, 독립 검토 Critical0/Important0/Minor0, local/private 동일·tracked clean·G-05 seq2374 PASS. epoch117 active worker/write/agent null, completed 두 lease REVOKED, 제품 write0. 이 보고 tail의 G-05는 게시 뒤 별도 판정한다.

## WSL-server 격리 실측

- `ssh WSL-server` 전용 Git checkout은 C7 exact SHA·사설 `development` remote·branch/owner/realpath·tracked clean이었다. WSL G-05 seq2372 PASS, 비-opt-in Python focused 7 PASS/56 deselected, Node24 `npm ci --ignore-scripts`·Web build20 exit0. `pip install -e`는 flat-layout 다중 top-level package 발견 오류 exit1; venv에 명시 의존성 개별 설치 exit0이며 제품 packaging을 임의 수정하지 않았다. npm high-severity notice 1은 자동 수정하지 않았다.
- 전용 PG15 ID `8dc433d39307ce5b2d650f8c39270c889040ec1b0358d667e07e9d2207b7ddd1`은 등록 이름·scope/SHA label, `postgres:15`, AutoRemove, data tmpfs256MiB, mount0, `127.0.0.1:5545`였다. 비관리자 role/DB `anvil_f20_r3a_edbd8e5`, migration `0019_oidc_sessions`와 일회성 secret/evidence mode를 확인했다. 공유 PostgreSQL·서비스·Secret 변경0.
- 실제 `test_opt_in_r6_oidc_browser_pg15`는 **exit1, 1 failed/1 warning, 22.22초**: `NETWORK_RESPONSE_FACTS/PAIR_LIST_API` 원 브라우저 응답 `status=404 reason=TIMEOUT index=4 capture_stage=BODY requestfinished=PENDING response_finished=PENDING`, `observed_round=1`, `settled_round=3`이었다. ASGI 관측은 pair route 미등록·`4XX`·최종 body `DONE`·disconnect `NONE` 9건이다. 독립 비인증 same-origin probe는 `4XX/DONE/DONE/DONE/CLEAR`, 안정 페이지 요청은 `4XX/DONE/CLEAR`, 원 요청 lifecycle은 `BEFORE_BODY`였다. 404는 R6 host의 `f19a_enabled=false` 상태와 일치하지만 원 Playwright fetch만 본문 대기에 남은 직접 원인·제품 영향은 미확정이다. 다른 요청의 완료를 원 요청 완료로 대체하지 않는다.
- setup 첫 OpenSSL 옵션 순서 오류 exit1은 빈 등록 경로만 남겼다. 수정 setup은 `E117_SETUP_PASS`에 도달했으나 Windows→SSH 파이프 끝 CR 때문에 최종 exit1; 별도 PG/secret/evidence 신원 조회 exit0과 분리한다. cleanup은 exact ID/label/image/mount/port·경로/프로세스를 검사하고 `E117_QA_RESIDUE_ZERO`에 도달했으나 같은 CR로 최종 exit1이었다. 이후 독립 조회 exit0으로 전용 경로5·컨테이너3 이름·loopback5545 잔여0을 두 차례 확인했다. 첫 프로세스 독립 조회 exit1은 조회 명령 자신의 shell 매칭으로 정리 근거에 사용하지 않는다.

## 영향·다음 조치

- DC-U01-019의 미진은 유지한다. ASGI 404 final body·독립 probe·안정 페이지 완료와 원 브라우저 fetch PENDING의 차이를 별도 최소 비제품 WI에서 요청 수명·navigation/cancellation·Playwright capture로 좁힌다. 404 allowlist, timeout 연장, body/Secret 감사 생략, F-19A 임의 활성화로 GREEN을 만들지 않는다. 원인 규명 전 제품 수정·R6 PASS·U-01 인수를 주장하지 않는다.
- 두 정확 Project·Environment pair, 서울 달력일 경계, E-NET/E-API/E-AUD/E-SHOT와 필수 `AV-SAFE-034`·`AV-OPS-027`·`AV-UI-017` 실측은 남아 있다. 동일 branch에서 계속하며, 필요 시 이번 신규 commit만 정상 `git revert`하고 역사 Event·승인·사설 원격 복구 ref를 보존한다.
