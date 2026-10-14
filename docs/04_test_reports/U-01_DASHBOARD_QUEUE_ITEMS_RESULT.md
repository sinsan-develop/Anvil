# U-01 Queue 작업 목록 결과 / 2026-10-14

## 판정

Queue 작업 목록 **구현 완료·핵심 동작 확인**. WSL 실제 API/화면은 현재 빈 원본 0건이며 기간 변경·다시조회·로그아웃까지 확인했다. 비영 목록과 5분 만료는 시험용 응답·브라우저 가상시계로 별도 확인했으며 **실제 DB 비영 경로는 미확인**이다. Queue Health와 나머지 미구현 기능은 완료가 아니다. 전체 U-01 NOT_ACCEPTED / Release DEFER / 역사 R6 FAIL을 유지한다.

## 판단 이유·기준

- WI `docs/work_orders/U-01_DASHBOARD_QUEUE_ITEMS_WORK_INSTRUCTION.md` SHA256 `6F0C1A69BF6189C36832EAD6CDB575A74699081DE714A09BA6D2FEDD9BC92BF6`, Invocation SHA256 `BBBCECCA3F4864CB6B5A2F15205E417992E54C284E812712FF971914A8BE18A9`.
- 부모 승인 scoped 계약 SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`; WSL 실행은 기존 `APPROVAL-20261014-U01-WSL-DEVELOPMENT-RUNTIME-001.md` 범위. MAIN_RECONFIRMED_NON_SEMANTIC이며 새 API·DB schema·권한·Secret 의미 변경0이다.
- 시작 기준 `801a2d79711d44bac9573e0271b5766eb729a1d6` local/private동일·tracked clean·seq2414·lease0. 단일 기존 branch `codex/u01-dashboard-r2`만 사용, main/다른 branch·타 프로젝트·예약 변경0.
- 계보: W18 `dcbe1580cbaa2edce320a28722638a4d80296f6b`→A17 `fce0b98851b4603ef465a8896d4e570be3bc94c2`→C17 `17c17e59a016ef007fddc0e71fdcaeebc8251977`→M17 `2ab227a74cee181c607eaa115a4fb124288293dd`→B17 `cc87f21e1be0958493e4a65b0990b93b60f66eca`→H17 `97b027b72054ed6ded158679ba949002d412b766`。각 직접부모·정확경로를 검증했다. 이 문서는 H17 직접자식 신규 보고+WORK_STATUS 정확2의 첫 보고 후보이며 게시본 G05는 commit/private 게시 후 별도로 확인한다.
- W18/A17/C17/M17/B17/H17 독립 검토 C0/I0/M0. C17/M17/B17 실제 clean/private G05 seq2417 PASS, H17 seq2419 PASS. A17 generic RED를 PASS로 소급하지 않았다.

## 변경과 최소 검증

단일 Primary exact4: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`; diff 813추가/6삭제. 제품 UI는 기존 `current.queue`의 총수·출처·관측시각과 펼침 목록의 jobId/원 상태만 표시한다. PENDING/CLAIMED/SUCCEEDED/QUARANTINED를 구분하고 총수를 대기 수로 바꾸지 않는다. 최대100건·중복/빈ID·enum·count·정확 pair/source/evidence/time을 확인하며 불완전·5분 만료는 목록을 숨기고 UNAVAILABLE로 표시한다. 새 요청·claim/retry/cancel·상세 API0, Main 동일 코드 write0.

| 실행(명시되지 않은 경로는 정본 루트) | 실제 결과 |
|---|---|
| `node --import tsx --test --test-name-pattern="Queue items" tests/f15-console.test.mjs` (apps/web) | Primary RED5F→GREEN5P→만료 보강6P; Main fresh6P/0F/0S, 385.91ms |
| `npm run web:test` | 최종124P/0F/0S, 723.05ms |
| `npm run typecheck` (apps/web), `npm run web:lint`, `npm run web:build` | 각 최종exit0, build20 modules |
| `python -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_u01_postmerge_control_projection.py::U01DashboardQueueItemsEpoch126Tests tests/tooling/test_u01_postmerge_control_projection.py::U01DashboardLogoutEpoch125Tests --tb=short` | 신규 RED7F→7P, 최종 신규+인접14P/0F/0S·89.88s |
| checker/test `compile(...,"exec")`, `git diff --check` | exit0; 기존 checker prefix 보존 |
| C17 Git archive 기반 WSL Web typecheck/build | exit0, 20 modules; 서비스 교체 전 별도 manifest 게시 |
| 실제 Chromium151, 1920×1080 | 재인증→정확 조합→Queue API/화면0건→7d 현재 상태→실제 재조회→UI logout/sessionfalse/API401/이전정보 제거 PASS |
| 명시적 client 주입·가상시계 | 네 상태·ID HTML escape·5분 만료/목록 제거·잘못된 enum 거부 PASS; 실제 DB 입력/실제 경과시간 시험으로 승격하지 않음 |

기존 웹1실패는 옛 Queue 제목·시각의 양성 fixture를 새 표시/정합 관측시각으로 맞췄고 기존 missing/count/빈ID 음성은 유지했다. epoch125 인접2실패는 현재 A17 입력 누출이어서 A16 Git 원문/registry hash 입력만 고정했다. lint dependency1은 보정했다. 정식 FAILURE_REPORT0, 기준 완화·테스트 삭제0, 자체 생성 dist만 신원 확인 후 정리했다.

## 실제 반영·보존·정리

- URL `https://172.27.253.53:3770/`; 정식 Git M17 detached/clean. Web source C17, image `sha256:f0d91461b391a915f0c1195f9de17ece6bbe8be901e8c15079770786955c8256`, container `38857059689f441dbe6a52a71bfb76d5d9e3620d17dc14b1d28bb6e883666f29`. archive573440bytes/SHA256 `4B2C6C018EAEE5000E44F63EABFAB3F752FEF951E613F434AFFF6B16EA67B91B`.
- 기존 API `3c52b542…`/issuer `e2667673…`의 exact ID/image 유지. Web만 같은 UID101/RO/capdrop/포트3770/RO mount/두 망 제약으로 교체, strict CA ready=`0020_f19a_pair_grants`. env 배열 순서는 false, 중복 없는 전체 키/값·bind/entrypoint/cmd는 true로 구분했다.
- DB schema·업무 데이터 직접 변경·가짜 Task/Run/Queue 생성0. 정상 테스트 로그인/세션 폐기 요청은 기존 API로 수행했다. 권한/Secret/cert/보호파일 hash·망 설정은 생성 전후 및 별도 최종 조회로 보존 확인했다. migration/백업 복원 반복0.
- 선택 인증/기능 응답본문10건을 Main 메모리에서 서버 비밀과 대조해 CLEAR, same-origin·Secure/HttpOnly 유지. 전체 Network/모든 본문·외부 SSO·실 Provider 검증은 아니다.
- 일회성 `anvil-u01-queue-items-browser-17c17e59`의 exact ID/image/label/mount/port 확인 후 정리 및 별도 조회 부재0. 정식3서비스·기존 내부망·root0700 runtime/0600 proof4개는 개발·복구용 유지 자원이다.
- 직전 Webc9f67787를 `anvil-u01-queue-items-rollback-20261014`로 정지·망 분리 보존, 기존 rollback5d6a1f82/f0107aad도 보존했다. 복구는 먼저 최신 manifest·현재/기존 exact ID/image/config를 대조한 뒤 해당 Web만 회수·이전 name/IP/alias/start를 복원한다. DB를 덮어쓰거나 옛 Compose env를 전체 재배포하지 않는다.
- epoch126 seq2418 write→2419 worker REVOKED, active worker/write/agent null. Event1~2417 객체 원문 보존, progress/HANDOFF/digest 갱신 완료.

## 오류 분류·남은 작업·직접 확인

| 분류 | 판정·조치 |
|---|---|
| 실제 기능을 막는 오류 | 이번 Queue 목록 범위에서 확인된 잔여 오류 없음. 비영 실제 DB 연결은 미확인이지 실패 또는 완료로 추정하지 않음 |
| 즉시 확인할 보안·데이터 위험 | 새 권한/DB/Secret 계약0, 로그인·로그아웃·정보 제거·same-origin·선택본문/문자열 보호·보존 확인. 새 확정 중대 위험 없음, 전체 보안 인수 판정 아님 |
| 클라우드 정밀 검증으로 남김 | 전체 R6/회귀·다중 브라우저/기기·부하·장애복구·전수 Network/보안·AV-SAFE-034/AV-OPS-027/AV-UI-017 인수 증거는 이번 결과로 통과시키지 않음. 역사 R6 실패는 해당 SHA에 보존 |
| 기능 자체 미구현·부분 구현 | Queue/Worker/Provider/Backend/Artifact Health와 Gate·cost·baseline·승인 객체 등 미연결은 기능 누락으로 유지. ‘추후 테스트’로 숨기지 않음 |

초기 일반 사용자 Git ownership 거부는 기존 root 읽기로만 대조했고 global 설정 변경0. 상대 `.` G05 LOAD_ERROR, stdout 인코딩·리뷰 출력 경로·운영 helper envelope/selector 보정은 제품 실패/실제 서버 시험과 분리했다. legacy Docker 경고는 설치·도구 변경 없이 기록했다. `.pytest_cache` 접근 경고는 별도 보존하며 tracked clean 판정과 구분한다. 운영 helper 구문5/recovery8 반례는 도구 안전 증거이지 배포 PASS가 아니다.

신산님 확인: 화면 새로고침→재인증→`Anvil WSL 개발 / WSL 개발 환경` 선택→현재 `Queue 작업`. 현재는 실제 0건이며 작업이 있을 때 목록을 펼쳐 ID·상태를 본다. 다음은 기존 U-01의 남은 실제 상태 원본/카드 연결이다. Oracle/Production·PR/main·새 branch/history rewrite/force·예약·타 프로젝트 변경0.
