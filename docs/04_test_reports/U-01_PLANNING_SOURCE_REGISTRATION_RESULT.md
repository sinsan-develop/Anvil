# U-01 계획 원본 등록 및 실제 승인 요청 1건 결과

## 판정

**이번 승인 범위: 구현 완료·핵심 동작 확인.** 승인 원본의 제한된 내부 등록 → 정상 Task/계획 저장 → 기존 요청 producer → 요청·감사 영속화 → 인가된 API와 실제 화면 1건 연결을 확인했다. 사람의 승인 결정·Run 실행은 수행하지 않았다. 전체 U-01 인수와 Release는 각각 NOT_ACCEPTED / DEFER다.

## 기준과 변경

- Package: U-01/PLANNING-SOURCE-REGISTRATION, epoch131. 직접 승인: `등록 권한과 기능 추가까지 승인`.
- WI SHA256: `BD0E913B32AD3034DB215A4D7A8849B2E2CD327FFB18E544DC0F8860EE5ADEA6`.
- Invocation SHA256: `E4719CD7DB13C0ED8736CC1034E4AA2F4F400ABBC2F061EBAB8E9BD470F8C33B`.
- 시작: branch `codex/u01-dashboard-r2`, A22 `b8b36b29f1ea5c26a210f36860a28d62cd5a8a40`, tracked clean. C21 `88a56c30ff9eebc726fa1bf390462ab94eb771b7`은 직접 자식 코드9개다.
- 제품 변경: `packages/planning/source_registration.py`, `packages/persistence/planning_source_repository.py` 신규 및 `apps/api/anvil_api/oidc_process.py`의 선택적 내부 callback. 정상 Task repository와 같은 transaction을 사용하고 등록 실패·만료 시 전체 rollback한다. 공개 POST·등록 메뉴·reader 권한 확대는 없다.
- 나머지6: 신규 planning/persistence/integration 테스트3개, API 테스트, checker, control 테스트. 기존 checker bytes 보존 및 additive successor다. 기대값 완화·검사 삭제0.
- M21 `e92bc992ba7c0abd28ff027a52115f362aff09fa`: manifest/STATUS2. B21 `dcba4819f8d51e7f1b9dbf733a35acaea5208cc6`: 증거 문서5. H21 `2bc0b0ac2b66a39681ee41d5056008917ae5ec35`: 종료 통제5. 모두 직접 부모 계보·기존 private branch 게시다.

## 실제 사용할 수 있는 결과

- 화면: https://172.27.253.53:3770/ → 재인증 → `Anvil WSL 개발 / WSL 개발 환경` → `승인 요청 대기` → `요청 목록`.
- Task: `u01-approval-source-qa-20261014`.
- 계획: `plan-u01-approval-source-qa-20261014`.
- 요청: `91237c63-aaac-4a47-b89a-6c87487819d2`.
- 계획 hash: `sha256:85ac57c06e8ad431d977c46381d25bcc27e47ef6eda5c30d4793a914870be6ed`.
- 생성: 2026-10-14 19:28:55 KST. 요청 만료: **2026-10-14 20:28:55.145577 KST**. 만료 후 현재 대기 목록에서 빠질 수 있으며 승인 완료라는 뜻이 아니다.
- 독립 DB 읽기: 요청1 / REQUESTED 감사1, typed 계보와 baseline 참조 일치, source journal3 hash-chain 및 grant REVOKED. 기존 Task1/Run1 지문 불변·사람 approval0·새 Run0. 생성한 Task/요청/감사는 삭제하지 않고 검증 자료로 보존한다.
- 등록 grant `psj-d39234acc5e12f66ac8b778d2269c89e-1`은 회수했다. 별도 기존 C20 요청 생성 authority는 DB 회수한 것이 아니며 1시간 만료(20:28:55.123805 KST)를 유지한다. capability 원문은 host 종료와 함께 폐기했다.

## 실시한 최소 검증

| 범위 | 실제 결과 |
|---|---|
| Primary 로컬 TDD·인접 분리 실행 | 최종134 PASS / 실제PG1 SKIP. 전체 suite 결과가 아님 |
| Main 정상 등록·receipt 실패 rollback 집중 pytest | 2 PASS, 1.78초, exit0 |
| WSL exact C21 새 빈 PG15/0021, 비관리자 role | integration10 PASS / warning2, 3.82초, exit0 |
| 실제 정상 서비스 등록/요청 및 독립 DB postcheck | 각각 exit0, 요청/감사1 및 기존 자료 보존 |
| Chromium151 실제 화면 | exit0, API1건·계획 hash 대조, DOM Task/계획/요청ID·만료값, 기간7d→1d·재조회, 다른 조합403, logout/status false/401·카드 제거 |
| Network/Secret | 선택 auth/기능 응답본문8건 CLEAR·same-origin. 모든 과거 흐름의 전수감사로 확대하지 않음 |
| 독립 코드/문서 리뷰 | 최종 Critical0/Important0/Minor0. B21의 plan hash API/DOM 표현 Minor1은 게시 전 정확히 구분 보정 |
| 게시본 G-05 | C21/M21/B21 seq2442 PASS, H21 seq2444 PASS, 모두 exit0 |

실제 PG 명령은 API와 같은 선행 import를 보존한 `python -B -c 'import packages.api,pytest,sys; raise SystemExit(pytest.main(sys.argv[1:]))' -q -p no:cacheprovider --import-mode=importlib tests/integration/test_u01_planning_source_registration_pg15.py --basetemp=/tmp/anvil-u01-planning-source-e131-pytest --tb=short -rs`다(등록된 전용PG 환경·격리 flag·DSN 환경변수, 비밀 원문 비출력). 로컬 source/host/control별 명령과 RED→GREEN 결과는 WORK_STATUS 및 Primary 인계 기록에 보존했다. Main 운영 명령 생성기 `planning-source-qa-pg.py`, `planning-source-formal-operator.py`, `planning-source-postcheck.py`, `planning-source-browser-operator.py`는 사전 등록·신원 검사 뒤 ssh WSL-server에서 실행했다. G-05 명령은 `python -B scripts/check_project_progress.py <현재 저장소>`다. 이 보고를 위한 실제 요청·브라우저 재실행은 하지 않았다.

## 환경·실패·미검증 구분

- 첫 Windows pytest는 basetemp 부모 부재로 59 PASS/24 setup ERROR였다. 부모 등록 후 host32 PASS, 이전 인접51 PASS는 반복하지 않았다. epoch130 역사 테스트의 현재 입력 혼입1 FAIL은 frozen A21 입력만 공급해 해당 node1 PASS; 합격 기준·위조 음성 불변이다.
- Docker 빌드는 실제 image를 생성했으나 Main operator의 마지막 보존 지문은 Mounts 순서 변동으로 exit1이었다. 모든 필드·중복을 보존하는 정렬 비교와 변조 음성4건 및 별도 읽기 receipt exit0로 확인했다. 최초 exit1은 소급 PASS하지 않고 재빌드0이다.
- Main 운영절차의 따옴표 SyntaxError, API1.41/daemon 최소1.44 create400, temporary host 단일 Internal 망의 DB 연결 거부는 각각 원인과 무변경/잔여0을 확인했다. 마지막은 임시 host만 기존 API와 같은 두 망으로 연결해 읽기 접속 후 정상 실행했다. 기존 서비스·DB 권한·Secret·제품 소스 변경0이다.
- 실제 원본 신뢰경계는 내부 host/DB 권위다. adapter INSERT-only/hash 검증이지 악의적 DB 소유자를 막는 trigger 불변성은 아니다.
- 전체 회귀·모든 브라우저/기기·부하/복구·Oracle·Production은 이번 미실행. 과거 R6/DC-U01-019 실패를 이번 성공으로 덮지 않는다. 승인/반려 및 Run 실행은 이번 범위 밖의 남은 기능이며 단순 ‘추후 테스트’가 아니다.

## 런타임·증거·정리

- 정식 Git M21 clean. host-only image `sha256:292fb9366eefe6cf88ebae17e578abc4019fef7a21031b5296b05c5d6b8f5967`, source C21. 공개 API/Web C20 및 issuer C15 그대로, DB0021·69 tables 불변. 새 schema·기존서비스 교체0.
- manifest SHA256 `850D8472C88FD480312C64CBFEE2AFB31F63E8AFCD4CB7D72D901EF78001BF42`.
- runtime의 신규 root0600 proof3는 생성 전 부재·O_EXCL로 기록: host `40C9A179E1F3AC52C52EFA978EA67952947CE00EC4CA7CA164F5C91BCDE3A6E8`, postcheck `2FF088547BD76C2CCDAFDE2A706826D4F167EDD774EE38D3D8B4922D4970C2A6`, browser `D76C6AE53EDA3A60CAC6A0D2A7D5BA102D92CEE7B4988AB52359BFE1083D9656`. 원문 Secret·DSN은 없다.
- 등록 QA/venv/secret/pytest4경로·PG/host/browser3이름·port5555·로컬 등록 temp는 정확 신원/owner/link/process 대조 후 제거, 독립 잔여0. 기존 서비스3와 backup/rollback은 보존. host image·proof·정상 데이터는 의도적 보존물이다.
- H21은 seq2443 write→2444 worker REVOKED, active agent/worker/write null. progress/HANDOFF/digest 갱신·독립 C0/I0/M0, actual G-05 seq2444 PASS.
- rollback: 공개 API/Web/issuer·DB schema는 변경하지 않았다. 내부 callback 미지정 시 기본 startup 쓰기0. 신규 host image 사용을 중단하고 기존 manifest/runtime을 유지한다. 생성된 검증 row·감사는 임의 삭제하지 않는다. 코드 rollback이 필요하면 C21 정확9의 역변경을 별도 승인·검증하며 history rewrite하지 않는다.

## 다음 조치

신산님은 만료 전 실제 요청 목록을 확인할 수 있다. 이번 등록·요청 생성·표시 절편은 종료한다. 이후 승인 결정/Run 실행 등 별도 남은 기능은 기존 승인 범위와 데이터·권한 계약을 대조한 다음 착수하며, 이번 성공으로 전체 U-01 인수나 main 병합을 주장하지 않는다.
