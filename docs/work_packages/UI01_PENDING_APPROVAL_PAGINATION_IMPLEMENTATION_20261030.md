# UI01 대기 승인 목록 이전 페이지 연결 작업지시서

담당: Main 어울(관리/검수/통합), 기존 Primary 단일 코드 writer, 기존 Reviewer 읽기 검수.
기준 HEAD: a3718a18fe37ed353b3f47b3c27a23effa090717 / codex/av3-stage-b.
설계 근거: docs/design/Anvil_설계서_v3_초안.md §11.2, WORK_PLAN Stage B UI01/FN01/FN11, docs/work_packages/SCREEN_WORK.md UI01 cursor 탐색·필요 결정 조회. 기존 보호 GET 계약을 소비하는 내부 화면 누락 보완이며 새 공개 API/데이터 계약·승인 권한을 만들지 않는다.

## 목표와 현재 증거

현재 ProjectPendingApprovals.tsx는 다음 cursor를 덮어쓰며 다음 페이지 버튼만 제공한다. Main e67d00/독립 읽기 검토로 확인했다. 기존 원문 deep link·PENDING GET 검증·401·관측 시각/전체 건수 미산정·승인 실행0은 보존한다. 기존 제품 파일 SHA256 2FE9C1E50BC2B6DF5DCEC70918C50683318A217794686C6394FFAC31DB50E2E4.

이전 페이지로 돌아갈 때 저장된 정확한 cursor로 서버를 다시 조회한다. 옛 페이지 캐시를 현재 승인/권한 근거로 쓰지 않는다. 성공한 탐색 이력만 확정하며 실패 시 같은 cursor 재시도/복귀가 가능해야 한다. 갱신은 첫 페이지로, 닫기는 폐쇄 상태로 돌아간다. 프로젝트/client/부모 잠금 조건의 이력을 재사용하지 않고 늦은 응답·권한 상실 뒤 과거 자료를 재노출하지 않는다. 프로젝트 현재 단계·다음 행동 DTO 보강은 별도 범위다.

## 정확한 허용 코드 경로 3개

1. apps/web/src/features/projects/ProjectPendingApprovals.tsx — 단일 제품 수정.
2. tests/browser/UI01/project-pending-approvals-pagination.spec.ts — 신규 집중 UI 시험.
3. tests/browser/project-pending-approvals-pagination.config.ts — 신규 집중 QA 설정.

기존 projects.spec.ts/reader/ProjectsPage/API/server/SQL/공통 bundle/의존성/다른 프로젝트 수정0. 코드 외 WI/WORK_STATUS/WORK_PLAN/결과는 Main 소유다. 보호 untracked8 보존. 기존 caller의 props/응답/401 의미 변경0, 새 명령/승인 결정/소비/자동실행0.

## 실행 순서와 검수

- [ ] 현재 HEAD/dirty 소유·기준 코드 지문·신규2파일 부재를 대조한다.
- [ ] 브라우저에서 없는 이전 동작의 RED를 먼저 확보한다. 기존 Node reader 집중시험은 기준 회귀다.
- [ ] 최소 cursor 이력/요청·성공 상태·늦은 응답 장벽으로 구현한다. 상태 유틸 일반화/리팩토링0.
- [ ] 실제 렌더된 카드의 1→2→3→2→1 정확 cursor 재조회, 끝/첫 페이지 경계, 실패와 빈 결과 구분, 실패 재시도/복귀, pending 중 중복 클릭 차단, 갱신·닫기 초기화, 프로젝트/client 또는 부모 잠금 이후 오래된 자료·늦은 응답 배제,401/403을 확인한다. 앱 상위경로 fixture로 client 직접 교체가 불가하면 가능한 정확 prop 렌더 harness 또는 증거 범위를 정직하게 분리한다.
- [ ] Network는 기존 same-origin GET만, POST/외부요청/예상 밖 API/런타임 예외0. 합성 입력의 HTML 실행0. 번호는 실제 조회 페이지 위치이며 전체 건수·전체 승인 상태로 승격하지 않는다.
- [ ] node --test tests/unit/FN01/project-pending-approvals.test.ts; npm run typecheck; npm run build; 한정 신규 config/spec 및 기존 projects.spec.ts 중 대기 승인 직접인접만 선택 실행; git diff --check.
- [ ] Primary가 정확 명령/exit/검증 범위·지문/실패·미실행·회수 결과를 제출하고 writer 해제. Main fresh 최소 검증·독립 C/I 검수 후 정확 allowlist만 게시.

## QA 자원 사전 등록

Windows 로컬, owner Main/단일 Primary. D:/tmp/anvil-v3-stage-b/ui01-approval-pagination-20261030-01 신규 전용 폴더에 temp/results. 이름은 ui01-approval-pagination-20261030-01, 수명 생성 뒤 최대30분. 기존 설치 Edge/Playwright만 사용(설치/다운로드0). 브라우저/QA runner는 자기 PID·시작 증거로 추적하고 정상 종료/자기 자원만 회수한다. 생성 전 부재·realpath/link·기존프로세스 영향 재확인, 회수 전 exact absolute path가 등록 root 안인지 확인. 제품 서비스/서버·포트·DB·네트워크 생성0. 기존 apps/web/dist는 링크 없는 파생 빌드 출력(982572)이며 정상 npm build 대상으로만 갱신하고 임의 기존 dist/남의 QA 삭제0. ANVIL_UI04_QA_DIST=apps/web/dist의 기존 in-process route.fulfill로 HTML/assets·합성 API를 제공한다. 실제 HTTPS/서비스/DB 증거로 세지 않는다. 결과/증거 회수 뒤 자기 QA 폴더 제거·독립 부재 확인. 불명 프로세스 종료/ACL변경0.

## 제외·오류·복구

실제 키·DB·서비스·Agent 호출·제품 원문 FS IO·권한·인증서 변경0. 미채택158E/공유B issuer·ABA/소진P03 R2/보호참조A 미연결 경계를 유지한다. 실제 사용자 served/WSL·DB·전체 UI01/Stage B 인수는 NOT_RUN이다. 3회 같은 근본 오류는 재시도 중단·원인/영향 기록, 무관 작업은 계속한다. 계획 내 내부 보완은 재승인하지 않는다. 안전심사 거절은 정확 원인 기록·안전 대안 대조, 우회0. rollback은 본 단위의 정상 Git revert이며 실제 자료/키/서비스·보호파일 변경0.
