# U-01 Task4 두 조합 WSL-server R3 수직 QA 결과

## 판정

`GRANTED_PASS; REVOKED_HARNESS_FAIL; FOUR_PHASE_NOT_ACCEPTED`. 기존 단일 branch의 clean exact SHA `56b66b513b378b0f7865f4801ac8acae6da87128`을 WSL-server 전용 Git checkout에서 받아 PostgreSQL 15/OIDC/HTTPS/API/Web/Chromium을 실제 기동했다. 새 빈 DB의 `granted`는 `2 passed, 30 deselected`(exit0, 38.97초)이고 두 조합·6기간 읽기와 화면·same-origin·합성 503 복구의 screenshot/network 증거를 남겼다. 이어진 `revoked`는 등록·철회·감사 원장 검사 후 브라우저 `FAULT_TRIGGER`에서 실패했다(`1 passed, 1 failed, 30 deselected`, exit1, 15.13초). `restored`와 `other`는 실행하지 않았다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`다.

## 정확 환경과 실행 경계

- WSL-server 전용 run label `anvil-u01-two-pair-qa-r3`, network ID `68905caf4799a63545a73caabe5666dedfcbc6e6969a1ee64cf2e56a370bfd8c`, loopback PG `127.0.0.1:5546`, HTTPS `127.0.0.1:8444`, 브라우저 내부 전용 Web IP `172.30.239.10`. PG15 서버 `150018`, Alembic head `0020_f19a_pair_grants`, 등록/환경/grant/등록감사/운영감사 원장 `0|0|0|0|0`에서 시작했다. API/Web/issuer image의 revision label은 위 exact SHA다. 기존 공유 Web `f0107aada3b2`, PG `99f3bf939d40`은 사용·변경하지 않았다.
- 최초 기동 진단: API의 필수 합성 Telegram 환경값 3개 누락으로 즉시 종료, 전용 컨테이너에만 값을 넣어 정상화했다. 계획의 임시 DB 이름 `anvil_u01_qa_r3`은 하네스의 정확 `anvil_u01_qa_<SHA12>` guard에서 거절되어, 데이터 주입 전 전용 PG를 `anvil_u01_qa_56b66b513b37`로 재생성했다. WSL checkout에 `development` remote alias가 없어 source guard가 거절되어 동일 승인 Git URL로 alias를 추가했다. 첫 실제 `granted`는 합성 issuer subject를 admin으로 둔 설정 오류로 `SESSION`에서 실패했다; 전용 DB의 합성 행 `2|2|2|6|5`를 확인하고 issuer를 reader로, PG를 다시 빈 상태로 재생성했다. 이 준비 실패를 제품 PASS/FAIL로 승격하지 않았다. 초기 원장 조회 SQL 두 건도 컬럼/따옴표 선택 오류로 exit1이었고, 올바른 표 조회로 재확인했다.
- 최종 `granted`는 reader subject `f19a-qa-reader`와 새 빈 PG에서 `python -B -m pytest -q -p no:cacheprovider -k opt_in tests/integration/test_u01_scoped_dashboard_browser_pg15.py --basetemp=<전용 경로> --tb=short` exit0이었다. 직후 등록/환경/grant/등록감사/운영감사 `2|2|2|6|5`; 화면 캡처와 네트워크 JSON을 생성했다.
- 같은 DB의 `revoked`는 preflight와 철회 후 등록감사 7건을 통과했으나 브라우저 `U01_QA_BROWSER_FAILED stage=FAULT_TRIGGER class=AssertionError code=U01_QA_BROWSER_FAILED`에서 exit1. 코드상 `expected.length===1`일 때 UI 기간 순회는 `30d`로 끝나지만 stale 블록은 2조합에만 실행되며, FAULT_TRIGGER는 무조건 `7d`를 요구한다. 따라서 하네스의 현재 phase 경로 불일치가 확인됐다. 실제 제품의 철회 UI 전체 인수나 `restored`/`other` PASS는 아니다. 동일 DB를 빈 상태로 가장해 `revoked`를 재실행하지 않았다.

## 증거·정리·다음 조치

- 로컬 보존: `docs/evidence/u01-task4-two-pair-r3/u01-granted-1920x1080.png` SHA-256 `E2137AD3CA62AF8E99551C1C153A71BEAEF3F43B8E6511EC3525E333DB71C9D9`; `u01-granted-network.json` SHA-256 `22C0671742C9E4EE52D0CBEDBB75A2EDC95DF8A87F42E10A313E11D2C1835FF8`. 원본과 로컬 hash 일치. JSON은 `phase=granted`, API response 29건, 관측 6건, 합성 fault 실행 true이며 token/Secret/DSN 표식0. 이 두 파일은 `revoked` PASS 증거가 아니다.
- 정확 label·container ID·network ID·image revision·세 root owner/realpath·checkout clean을 확인한 뒤 전용 browser/Web/API/issuer/PG 컨테이너, network, 세 image tag와 checkout/material/browser root를 제거했다. R3 label container/network, 세 root, loopback 5546/8444 listener 잔여0; 공유 Web/PG 원래 ID와 running 불변. 캐시 원본 PG/Playwright 이미지는 보존했다.
- 기존 epoch106 dual lease의 정확 두 하네스 파일에서 위 phase 기간 단언을 최소 보완하고 로컬 검증→새 clean SHA push→WSL-server 새 빈 전용 DB에서 `granted→revoked→restored→other`를 순서대로 재실행한다. 기존 R6 `STORED_ROW` 정확 원인 분리, E-SHOT/E-NET/E-API/E-AUD 완결, G-05 최신 successor, 독립 Tester 판정 전에는 PR/main·branch 삭제·새 branch/U-02를 진행하지 않는다. Rollback은 하네스 보완 commit만 정상 revert하고 공유 서비스와 기존 branch 이력은 보존한다.
