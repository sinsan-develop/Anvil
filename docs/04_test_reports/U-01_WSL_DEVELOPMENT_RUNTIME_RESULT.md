# U-01 WSL 개발 화면 반영 결과 / 2026-10-14

## 판정

이번 Work Package의 개발 화면 반영·핵심 사용 확인은 완료했다. 전체 U-01은 NOT_ACCEPTED, Release는 DEFER다. 전체 R6 과거 FAIL을 변경하거나 이번 선택 검증으로 대체하지 않는다.

- 사용 주소: `https://172.27.253.53:3770/`.
- 화면 아래 `재인증` → 개발 테스트 SSO 팝업 허용 → `Anvil WSL 개발 / WSL 개발 환경` 선택.
- DB 상태·BLOCKED·실행 중 Run 카드가 실제 API 조회와 연결된다. 해당 조합에 Run이 없어 두 건수는 실제 0건이다. 가짜 Task/Run은 넣지 않았다.
- 개발 self-signed 인증서(30일) 경고는 이 개발 주소에 한해 확인한다. 전역 CA를 설치하지 않았다. 테스트 토큰은900초이며 실제 외부 SSO·사람 인증·운영 계정이 아니다.

## 기준과 변경

- WI: `docs/work_orders/U-01_WSL_DEVELOPMENT_RUNTIME_WORK_INSTRUCTION.md`, SHA256 `97A837280AD755895758638D475D07180BAA9803A2B8BFE367B68AB1A12B189B`.
- Invocation SHA256 `EB21E91727F0B241964B290DCC5C4A3A9AD840D41378CF7DB05D10CCB4E93915`.
- 직접 승인 SHA256 `171D1524C2B20CF774076C8278F766721BB21E45BBC7A34C599437B27C9E7145`.
- 시작 branch `codex/u01-dashboard-r2`, HEAD/private `4b75c87f395ded6e48b0074b1d8c21f364061730`, tracked clean·active lease0.
- W16 `f942a949e37fb7b820c15e9fb5e643725c5b783f` → A15 `b2d0b14204909c7aaf2aee19408a2d6f10ec5f51` → C15 `87aa6c5e8edf1e2e890c3cb69a74bdf5f4b94a84` → M15 `e8da726a949a2a47ee2423bfc1045319a921572b` → B15 `d8e37d1ed0c29bea8f06af2a5a341bf9dd70a7a4` → H15 `b93caed5ff4bce55b6330ae3fd9db4557742529b`.
- C15 exact8: WSL Compose/nginx/issuer/manifest template, deploy contract/issuer test/checker/control test. 제품 API·UI·migration source 변경0. 단일 Primary TDD, Main 운영/백업/배포/실측. 독립 최종 C0/I0/M0.
- M15 신규 actual manifest+WORK_STATUS2, B15 progress/HANDOFF/digest/WORK_STATUS/DEVELOPMENT_ENVIRONMENT5, H15 Event 포함 통제5. 본 첫 보고는 H15 직접자식 신규 report+WORK_STATUS2다.
- diff 확인: `git diff --stat b2d0b142 87aa6c5e`, `git diff --check`. manifest blob SHA256 `2BB90C4AC7C29B23DD998B1538412BF77287D3423D88E83161B2DFE9921A148E`.

## 실제 확인과 명령

로컬 pytest 공통 실행은 `C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib`다. 실제 결과를 범위별로 구분한다.

| 실행 범위·인자 | 종료·실제 결과 |
|---|---|
| `tests/deploy/test_f18_oidc_qa_issuer.py` (등록 전용 basetemp) | RED 신규 인자 부재22실패 → GREEN exit0 47 PASS |
| `tests/tooling/test_u01_postmerge_control_projection.py::U01WslDevelopmentEpoch124Tests tests/deploy/test_u01_wsl_development_contract.py --tb=short` | 신규/위조 음성 RED 후 GREEN exit0 23 PASS |
| epoch123 B14/H14/dispatch 인접3시험 | exit0 3 PASS; Developer 합계73 PASS |
| Main fresh `tests/deploy/test_u01_wsl_development_contract.py` | exit0 16 PASS; 실제 서버 증명과 구분 |
| C15 Git archive 기반 WSL pinned image 빌드·Web typecheck/build | exit0, Web build20 PASS; 서버 source patch0 |
| 원본 암호화 dump→새 빈 PG15.18 실제 복원→복사본0020 | 최종 exit0, 기존50table 이전컬럼 값/행수/키 보존 |
| 원본0013→0020·고정 QA 등록 | exit0, 이전컬럼 fingerprint 불변·reader 한 조합/한 권한·bootstrap OIDC binding0 |
| 기존 `/usr/local/bin/docker-compose` v5.1.1 config·정식3서비스 전환 | exit0, exact source/image/UID/RO/port 확인 |
| strict private CA HTTPS `/api/health/ready`·index | exit0, ready/0020·index200 |
| 실제 Playwright1.62.1/Chromium151.0.7922.34/1920×1080 선택 기능 | exit0, 실제 팝업 로그인·3카드/API 일치·reload·다른pair403·CSRF403·API logout200/정보제거 |
| 최종 독립 신원·보호자료·잔여 조회 | exit0, 정식3 running/임시자원 부재/old rollback 정지/backup 권한 확인 |
| 각 게시본 `python -B scripts/check_project_progress.py .` | C15/M15/B15 seq2407 PASS, H15 seq2409 PASS; 각 당시 clean/private SHA 한정 |

서버 운영 명령은 Main의 생성 전 등록된 일회성 Python orchestration을 `ssh -o BatchMode=yes WSL-server sudo -n python3 -`로 전달했다. 제품 source는 사설 Git exact C15/M15에서만 소비했다. 실제 실행 프로그램·단계·exit 및 비밀 없는 요약은 WORK_STATUS에 누적했으며, 원본 proof JSON/실패 stderr는 `/srv/anvil-wsl/runtime/u01-development-20261014`와 아래 보호 backup에 보존한다. secret/DSN/인증 body 원문은 보고·Git에 넣지 않았다.

브라우저는 전체 요청 same-origin·Secure/HttpOnly/Strict cookie·DOM credential 미노출을 확인했다. 인증/선택 기능 성공 응답13건 및 명시적401/403 body의 서버 비밀 검사는 Main 메모리에서 수행했다. 전체 background 응답·전체 R6 감사라고 주장하지 않는다. UI 로그아웃 버튼은 아직 없어 **API 로그아웃만 확인**했다.

## 데이터·환경·복구

- 정식 `/srv/anvil-wsl/repo`는 M15 detached/clean, 이미지 source는 C15. Web `7a10d7e3…`, API `b0872180…`, issuer `cefb8b27…`의 전체 immutable ID는 actual manifest와 DEVELOPMENT_ENVIRONMENT에 있다.
- 기존 anvil/PG15.18에 승인된 migration만 적용했다. 이전50table 컬럼 fingerprint `A64D6369CD4E7180466B0C83E1F98E09FFDC586639DC3C2AF484C1BAEDF16942`는 원본/복원/복사본0020/원본0020에서 같다.
- `/srv/anvil-wsl/backups/u01-development-20261014-4b75c87f/attempt04`의 암호화 dump SHA256 `F879160CD7357E08225FC569B5068DCF726715C30C895FD68AE15358B1061A08`. root0700/파일0600, 인증 key 개별UID0400. 기존 `.env`·SSH·전역 CA·공유 proxy 설정 불변.
- raw schema 문자열 hash 차이는 FAIL로 보존했다. 동일 typed TEMP 관계의 PG parser 재해석23표현과 나머지 metadata exact 비교로 native 동등 hash `420DC5F4208DD34AE7C9EE4AD7A9E8E9AB481B13C49EEFDF788610B8930B8622`를 확인했다. 함수/trigger/ACL 등 수집 밖 전체 운영 동등성은 미확인이다.
- 기존 container `f0107aad…`/image `c0254177…`는 `anvil-u01-rollback-f0107aad-20261014`로 정지 보존했다. 복구 시 새 사용자 데이터와 exact ID/config/schema부터 대조한다. 새0020에 옛 이미지를 무검증 시작하거나 무조건 restore하지 않는다.
- restore PG/net/dbcheck/dump/material-check/browser와 로컬 전용 basetemp는 정확 신원 확인 뒤 정리·잔여0. 정식3서비스/internal망/private runtime·backup/정지 rollback은 목적 있는 유지 자원이다.

## 실패·미검증·남은 기능

- 초기 Windows Temp/UTF8/조회 권한·프로세스 정리 보류는 환경 오류이며 전용 base 정리 완료. 정식 Developer FAILURE_REPORT0.
- backup attempt01 DSN driver의 psycopg2 부재, attempt02 초기 SQL 원인 미확정, attempt03 PG16 dump/PG15 restore 형식 불일치, attempt04 raw schema 문자열 차이를 각각 보존했다. 최종 성공으로 최초 실패를 소급 변경하지 않는다.
- PG15.18 일치만으로 raw 차이가 없어지지 않아 버전 가설은 원인 확정하지 않았다. 이후 native 의미 비교에서도 나머지 metadata/data 기준을 생략·완화하지 않았다.
- root Compose plugin 부재 exit125는 기존 standalone 동일 버전 사용으로 해결, 패키지 설치0. seed 순환 import 위험은 원본 mutation 전 기존 bootstrap import 순서로 확인했다. 본문/source 직접 수정0.
- 전체 R6/PG18/외부 Provider·SSO/부하·여러 기기/Oracle/ysna/Production 미실행. 전체 U-01·E-NET/E-API/E-AUD/E-SHOT 및 필수 인수 ID 완료로 승격하지 않는다.
- 사용 가능: DB·BLOCKED·실행 중 Run 3카드와 테스트 로그인. 부분/미구현: 나머지 health5·Gate·cost·baseline·approval 객체, UI 로그아웃. 미구현을 추후 정밀 테스트로 숨기지 않는다.

## 조치

epoch124 seq2408 write→2409 worker REVOKED, active lease/agent null. progress/HANDOFF와 개발환경 안내를 갱신했다. PR/main 병합·새 branch·자동예약·공개/운영 전환0. 다음은 기존 승인 기능 중 UI 로그아웃과 남은 실제 연결 기능을 최소 WI로 이어가며, 반복 전수검증을 개발 진도로 대체하지 않는다.
