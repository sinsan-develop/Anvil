# U-01 Task4 두 조합 WSL-server 예비 QA 결과

## 판정

`PG15_PRECONDITION_PASS; TWO_PAIR_VERTICAL_NOT_EXECUTED; U01_NOT_ACCEPTED`. 본 실행은 승인된 Task4의 격리 환경 준비와 새 하네스 비-opt-in 검증까지다. 실제 OIDC/HTTPS/Chromium의 `granted → revoked → restored → other` 네 phase를 실행하지 않았으므로 두 조합 수직 인수·E-SHOT/E-NET/E-API/E-AUD, 기존 R6 회귀의 실패 해소를 주장하지 않는다. Release `DEFER`, Production `NOT_EXECUTED`다.

## 정확 기준선과 수행 결과

- 로컬 단일 branch `codex/u01-dashboard-r2`의 하네스 C `0dff0ea73650a8c4d1a5b426f295b1113f6682c1`과 자원 계획 checkpoint `2c3dd55520f4296a6d642d18830a58abfee0acd9`를 개발 원격에 push하고 동일 SHA를 확인했다. `ssh WSL-server`로 전용 checkout `/home/daon/anvil-u01-two-pair-qa-0dff0ea-checkout`에 Git clone; HEAD=원격=`2c3dd555...`, branch 동일, tracked/untracked status 공백이었다. WSL에서 소스 수정·공유 checkout 사용은 없었다.
- 전용 material/browser root는 owner `daon`, 0700. 합성 DB 비밀번호 파일은 0600, 전용 Python venv에는 저장소 고정 runtime 요구사항과 pytest/PyYAML을 설치했다. 최초 난수 생성 명령은 길이 인수 누락으로 exit1, Secret 파일 미생성 상태에서 인수를 바로잡아 성공했다. 최초 base64 비밀번호는 URL 인코딩 위험이 있어 데이터 쓰기 전 **이 전용 tmpfs PG만** ID 대조 후 stop/자동제거하고 hex 비밀번호로 재기동했다. 이는 제품 테스트 실패가 아니다.
- 전용 Docker network ID `1fbf4065ed8ee8fd418216026fa860c2c7627dc1957ccd98ecbce4563459a73f`, PG15 최종 container ID `b6d486102702144f1e2f9699c373a13c58e420357143e272e3c1f57e3a2fda4b`, image SHA `75f676...`, run label `anvil-u01-two-pair-qa-0dff0ea`. PG 데이터 tmpfs, 비밀번호 단일 read-only bind, `AutoRemove=true`, `127.0.0.1:5546`만 publish. 비관리자 DB/user `anvil_u01_qa_0dff0ea`에 migration `0020_f19a_pair_grants` 적용 exit0. SQL 읽기 전용 확인 `server_version_num=150018`, head0020, 등록 project/environment/grant/audit와 operations audit 각 0건.
- 정확 SHA의 WSL 전용 venv에서 `PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/integration/test_u01_scoped_dashboard_browser_pg15.py` → **22 PASS/1 opt-in SKIP**, exit0. Node `--check`·`--self-test` exit0 (`U01_TWO_PAIR_SELF_TEST_PASS`). 이는 진짜 두 조합 DB seed·로그인·화면 실행을 포함하지 않는다.
- 준비 상태에서 실제 네 phase를 실행할 독립 합성 issuer, admin/reader/other OIDC principal seed, HTTPS 앱/화면 build·기동, Playwright 런타임 결박이 현 하네스·WI에 없다. 기존 R6 통합 시험은 자체 단일 host와 다른 DB/name/계약으로 닫혀 있어 자동 재사용할 수 없다. 공유 `anvil-web`이나 DB를 임의 재사용하지 않았다. 후속 로컬 QA runner/fixture 및 정확 통제 successor가 필요하다. 기존 R6 `STORED_ROW` 실패 원인은 이 실행에서 재진단하지 않았다.
- 현재 checkpoint G-05 재실행은 exit1 (`DETACHED_DIGEST_MISMATCH`, `EVENT_EFFECT_MISMATCH`, `GIT_LOCAL_HEAD_MISMATCH` 등 10개). epoch106 A 이후 새 하네스 C/문서 checkpoint를 허용하는 fail-closed route가 아직 없어 예상된 통제 RED이며, 이를 PASS로 표시하지 않는다.

## 정리·영향·다음 조치

- 종료 전 정확 container/network ID·label·AutoRemove·mount와 세 root의 owner/realpath·clean Git을 읽기 전용 대조했다. 전용 PG stop/자동제거→빈 전용 network 제거→정확 세 경로만 제거했다. `U01_QA_RESIDUE_ZERO`: 전용 container/network/path 및 loopback5546/8444 listener 모두 0. 합성 DB·비밀번호·venv는 복구 불가하게 폐기했고 source는 Git에 남았다. 공유 `anvil-web` ID `f0107aada3b2`와 `local-postgres` ID `99f3bf939d40` running 불변; 다른 프로젝트·ysna-server·Production 변경0.
- 다음은 같은 단일 branch에서 QA runner/fixture의 정확 WorkInstruction과 dual lease를 발행해 **로컬에서** 최소 코드를 구현·검증한 뒤 Git push → WSL-server clean exact SHA에서 전용 자원을 재생성하여 네 phase를 실행한다. 병행해 역사 R6 `STORED_ROW` 정확 assertion과 현재 UI 계약을 분리한다. G-05 새 경로와 독립 Tester 판정 전에는 PR/main 병합·새 branch/U-02를 하지 않는다.
