# U-01 Agent 소유권 상태 결과 / 2026-10-14

## 판정

구현 완료·핵심 동작 확인. 기존 정확 조합 API의 owner 행 수를 전체/ACTIVE/EXPIRED/REVOKED 관측 상태 요약으로 연결했다. 실제 WSL DB는 0건이며 API·화면·빈 안내가 일치했다. 동일 session의 복수 assignment를 잘못 제거하지 않는다. ACTIVE는 관측 상태이지 현재 권한·실행 Agent 수·Worker 건강이 아니다.

전체 U-01은 NOT_ACCEPTED, Release DEFER다. 과거 전체 R6 FAIL/DC-U01-019를 PASS로 바꾸지 않는다. 개별 owner 식별·Worker 건강·Health/Gate/cost/baseline/승인 대기 원본 미연결은 미구현/부분 구현이지 추후 테스트로 숨길 항목이 아니다. 비영 실제 DB, 외부 SSO, 전체 본문·R6·클라우드 정밀 검증은 미확인이다.

## 판단 이유와 변경

- WI `U-01_DASHBOARD_AGENT_OWNER_STATUS_WORK_INSTRUCTION.md` SHA256 `6BEA2DE7A7DE53C825474687D597CF1F3171D724487E6599347C2C6D0BBB8099`, Invocation `76B38BFDE1558F5D4F0B0CE9B7DFAC2DE6052FBC674D134A9158EC314C848E46`. 부모 승인 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`와 기존 WSL 개발 runtime 승인 범위다.
- 시작 A18 `2ec646792fc510f14359bdebf7e6a460470128c5`, 기존 `codex/u01-dashboard-r2`, tracked clean/private 동일에서 단일 Primary가 exact4를 수정했다. Main 동일 소스 쓰기0, 정식 FAILURE_REPORT0.
- C18 `7967246da7468ee1463ded3665d6e110c878e776`은 A18 직접 자식 exact4/822삽입·7삭제다. `App.tsx`의 generic agent 총수→상태별 요약·신선도 소거, 웹 테스트, additive checker, 통제 테스트만 변경했다. API/DB/schema/권한/Secret/기존 Queue·Run 계약 변경0. API가 assignmentId를 생략하므로 UI의 독립 복합 identity 검증을 주장하지 않는다.
- M18 `fd552dd877151ccb1477700136a967ade66dbcd2` 직접 자식 exact2는 실측 Web image/4 source hash·M17 retained·기존 APIissuer·rollback을 결박한다. B18 `4337a6d356cdd7fd7366efd6a85fafcb39f1a594` 직접 자식 exact5가 runtime 증거를 투영했다.
- H18 `35804d843561b4770c7849c764a76a5d66599433`은 B18 직접 자식 exact5, Event1~2422 원문 보존 뒤2423 write→2424 worker REVOKED, active worker/write/agent null. 각 C18/M18/B18 actual clean/private G-05 seq2422 PASS, H18 seq2424 PASS다. 이 보고 tail의 게시본 검사는 별도 실행한다.

## 실시한 최소 검증

웹 cwd `apps/web`, Python은 저장소 기준이며 아래 실제 실행 범위만 PASS다.

| 명령/범위 | 실제 결과 |
|---|---|
| `node --import tsx --test --test-name-pattern="Agent owner status" tests/f15-console.test.mjs` | 최초0P/5F RED→5P, 경계 보강 뒤 최종 Main fresh7P/0F/0S exit0 |
| `npm run test:console` | 전체 한 번130P/0F/0S exit0 |
| `npm run typecheck`, `npm run lint`, `npm run build` | 최종 각각exit0; 내부 type/lint 최초 실패 각1은 보완 후 결과와 구분 |
| `python -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_u01_postmerge_control_projection.py::U01DashboardAgentOwnerStatusEpoch127Tests tests/tooling/test_u01_postmerge_control_projection.py::U01DashboardQueueItemsEpoch126Tests tests/observability/test_f20_u01_r36_agent_owner_summary.py --tb=short` | 신규7F RED→7P, 묶음 최초49P/1F→최종50P/0F/0S exit0/88.43초 |
| `git diff --check`, Python compile/기존 checker prefix·tail byte 비교 | exit0; 기존 source 검사 기대/위조 음성 유지 |
| `python -B scripts/check_project_progress.py <저장소 절대경로>` | private 게시 후 C/M/B seq2422·H seq2424 PASS exit0 |
| Main Git-only Web build / exact manifest fetch / Web-only swap | 각각exit0, 타입/build20 PASS·ready0020 |
| Main 등록된 일회성 Chromium151.0.7922.34 browser | 8단계 PASS exit0, 아래 실제/주입 범위를 분리 |
| Main 독립 보존·자원 부재 조회 및 정식 Git HEAD/status | exit0, M18 detached clean/서비스3/ready0020·one-use0 |

독립 spec/quality C0/I0/M0. B/H 문서 초안의 이전 단계명 M1은 게시 전 바로잡고 detached digest 재계산·좁은 재검토 C0/I0/M0로 닫았다. epoch126 최초 실패는 역사 C17 mock이 현재 A18 문서를 읽은 fixture 혼입으로, 입력만 A17 frozen Git bytes로 공급했고 기존 기대값/위조 음성/collector는 바꾸지 않았다. sandbox Git 관리영역 쓰기 거부1은 승인된 elevated 실행 성공과 구분하며 ACL 수정0. Main patch 생성 출력에 Python warning이 섞인 최초 apply 거부1은 미변경 종료 후 patch 경계만 분리했다. 기존 cache 접근/legacy Docker builder 경고는 별도 도구정비 항목으로 남긴다.

## 실제 WSL과 시험용 반례

- URL `https://172.27.253.53:3770/`, 재인증 팝업→`Anvil WSL 개발 / WSL 개발 환경` 선택→Agent 소유권 상태 실제 API AVAILABLE/count0/items0·전체/세상태0·등록 없음 안내가 일치했다. 30d 변경·다시 실제 원본 복원·Queue 유지·실제 UI 로그아웃/session false/보호 API401/두 카드 제거를 확인했다.
- 동일 session의 세 상태3행, 동일 session·상태2행, ID HTML문자열 비노출, client clock5분 초과 수치 소거, invalid state UNAVAILABLE는 브라우저 주입 반례다. 이를 실DB 비영·독립 개별 owner 식별·현재 권한 증거로 승격하지 않는다. 정식 DB에 가짜 owner/assignment 생성0, Worker Health UNAVAILABLE 유지.
- 모든 브라우저 요청 same-origin, Secure/HttpOnly/Strict cookie·DOM token 미노출, 선택 auth/기능 본문10개의 서버 비밀 감사 CLEAR. 전체 background body·전체 R6 감사는 이번 범위가 아니다. 선택 본문 원문/Secret/DSN은 Git·보고서에 기록0.
- 실측 Web image `sha256:dddc1f7a589e4cf7da0f2a521cc306280f16f6c2015f62d825c2dc9bf0bc09cf`, ID `988cb3591fc9c61c0476e09984f030e6acff1ce261203d7b15686d310083cd41`, source C18/M18. Git archive573440bytes/SHA256 `202D304BCC81DC23277B908CA209926F8D5447B1213E4C49EBA2E8897C052003`.
- API `3c52b542…`·issuer `e2667673…` ID/image/source C15, DB0020/권한/Secret/cert/망 설정·보호 hash 보존. env raw 순서만 달랐고 고유 전체 키값/bind/entrypoint/cmd는 일치했다. 정식 서비스3과 정지 rollback4를 구분한다.
- 일회성 `anvil-u01-agent-owner-status-browser-7967246d`는 등록 image/UID1000/RO/capdrop/nohostmount/nohostport/tmpfs 한정 실행 후 exact ID 정리·독립 부재0. 개발 proof4개는 root0700 runtime 아래 root0600으로 개발/복구 수명까지 유지한다. Primary 자체 dist만 검증 후 정리/부재0. 기존 backup·rollback 삭제0.

## 조치·잔여 위험·다음 기능

즉시 기능을 막는 이번 변경 오류와 확인 범위의 인증정보·권한·데이터 위험은 남지 않았다. 기존 full R6 하네스 실패·전체 통합/다기기·성능/복구 검사는 클라우드 정밀 검증 항목으로 유지하되, 실제 사용 오류가 확인되면 해당 범위는 즉시 처리한다. 합격 기준/기존 기대값/검증하지 않은 항목을 PASS로 바꾸지 않는다.

다음은 기존 승인 범위의 미연결 승인 대기 원본을 읽기 대조해 실제 UI/API/저장 원본 연결 여부부터 판단한다. 현재 `scoped_dashboard.py`는 approvalPending을 NO_VERIFIED_CURRENT_SOURCE/UNAVAILABLE로 반환하므로 승인 객체 수가 구현되었다고 보지 않는다. 새 공개계약·권한·지속데이터 영향이 필요하면 별도 승인 경계로 분리하며 관련 없는 기능 구현까지 정지시키지 않는다.

Rollback: 직전 Web `38857059689f441dbe6a52a71bfb76d5d9e3620d17dc14b1d28bb6e883666f29`/M17 image는 `anvil-u01-agent-owner-status-rollback-20261014`에 정지·망분리 보존했다. 복구 시 현재 exact ID·manifest·보호파일/망을 재대조하고 Web만 이전 image/profile로 전환한다. 기존 compose.env로 전체 Compose 재생성하지 않는다. API/DB migration·권한 rollback은 이번에 필요하지 않다. Oracle/ysna/Production/예약/PR/main/새 branch/history rewrite/force/타프로젝트 변경0.
