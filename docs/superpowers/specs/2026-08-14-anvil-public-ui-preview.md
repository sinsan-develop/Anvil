# Anvil 공개 UI 프리뷰 설계

## 1. 목적과 승인 근거

신산님의 2026-08-14 명시 지시에 따라 `anvil.sinsan.kr`에서 Anvil의 최종 운영 화면 구조와 모든 메뉴의 기능 위치를 직접 확인할 수 있는 읽기 전용 UI 프리뷰를 제공한다. 이 프리뷰는 기능 구현 완료나 Production Release를 뜻하지 않으며, 실제 API·DB·Agent·Provider·배포 제어를 수행하지 않는다.

승인된 공개 경로는 다음과 같다.

```text
https://anvil.sinsan.kr
  -> Nginx Proxy Manager
  -> http://anvil-web:3770
```

기존 B-04 제품·진행 산출물과 `shared-db`는 변경하지 않는다.

## 2. 범위

### 포함

- 1920×1080 기준 운영형 애플리케이션 셸
- 설계서 §15.2의 최상위 메뉴 11개 상시 표시
- 모든 최상위 메뉴의 직접 클릭과 선택 상태
- 각 메뉴에서 핵심 기능의 위치·상태·다음 행동을 확인할 수 있는 읽기 전용 화면
- Workbench에서 어울과의 대화, 작업 지시, 진행 현황, 결과 보고, 승인 요청, 작업 기록 위치 표시
- 모든 화면에서 열 수 있는 전역 `어울` 대화 패널
- `UI PREVIEW`와 `NOT CONNECTED` 상태를 명시해 실제 실행 기능과 구분
- same-origin 정적 자산과 `/healthz` 상태 확인
- Git 승인 commit 기반의 `ysna-server:~/deploy/anvil` 지속 실행
- Nginx Proxy Manager를 통한 HTTPS 실제 브라우저 검증

### 제외

- 실제 LLM 호출과 대화 저장
- 실제 작업 지시 실행, Agent 생성, 코드 변경, 배포 실행
- 실제 API·DB·Queue·Worker·Provider·Secret 연결
- `shared-db` schema·role·data mutation
- 인증·사용자 관리의 실제 구현
- 메뉴별 최종 업무 로직
- 기존 B-04 완료 projection 재개 또는 변경

## 3. 정보 구조

좌측 Sidebar에는 다음 11개 최상위 메뉴를 설계서 순서대로 표시한다.

1. Dashboard
2. Workbench
3. Projects
4. Runs
5. Reviews
6. Quality
7. Knowledge
8. Agents & Automation
9. Environments
10. Operations
11. Settings

Sidebar는 1920×1080에서 스크롤 없이 모든 메뉴가 보여야 한다. 각 메뉴는 아이콘, 한글 보조명, 선택 상태를 제공한다.

### Workbench와 LLM 소통 위치

LLM 소통은 별도 최상위 메뉴를 추가하지 않고 제품의 중심인 `Workbench`에 둔다.

- Conversation: 신산님과 Main Agent 어울의 대화
- Instructions: 작업 지시 작성, 범위와 첨부자료 확인
- Progress: 현재 단계, 담당 Agent, 실행 상태, 중단·재개
- Reports: 완료·실패·중단 보고
- Approvals: 승인 요청, 영향 범위, 승인·반려
- History: 대화·지시·결과·결정의 시간순 기록

화면 우측 상단의 `어울` 버튼은 어느 메뉴에서도 대화 Drawer를 연다. Drawer의 `전체 작업실 열기`는 Workbench의 Conversation으로 이동한다.

## 4. 화면 구성

### 공통 셸

- 좌측: 224px Sidebar
- 상단: 현재 환경, 프로젝트, 검색, 알림, `어울` 버튼, 사용자
- 중앙: 선택한 메뉴의 업무 화면
- 우측 Drawer: 설명, 증거, 대화처럼 필요할 때만 열리는 보조 인터페이스
- 기본 폰트 12px, 작은 설명 10px, 보조 9px, Sidebar 제목 14px, 화면 제목 16px
- 상시 설명 박스를 두지 않고 `i` 아이콘, Tooltip, Popover를 사용

### 메뉴별 프리뷰 내용

| 메뉴 | 프리뷰에서 확인할 위치 |
|---|---|
| Dashboard | 시스템 상태, 프로젝트 상태, 승인 대기, 경고, 다음 행동 |
| Workbench | 대화, 지시, 단계 Rail, 현재 작업, 증거, 결과 보고 |
| Projects | 저장소, baseline, 정책, 보호 경로, 환경 연결 |
| Runs | 실행 목록, 상태, 담당 Agent, 중단·재개 위치 |
| Reviews | 계획·범위·적용·배포 승인 대기열 |
| Quality | Tests, Benchmarks, Prompt·Model 평가 |
| Knowledge | Learning Studio, Sources, Memory, Code Patterns, Rules, Skills, Retrieval |
| Agents & Automation | Subagents, Hooks, Plugins, 실행 정책 |
| Environments | Local, Docker, WSL, SSH, Cloud 상태 |
| Operations | Alerts, Audit, Worker, Queue, 비용, Deployment Monitoring |
| Settings | LLM Providers, Routing, Policy, 사용자·권한 |

## 5. 상호작용 계약

- 모든 최상위 메뉴는 마우스 클릭과 키보드로 선택 가능하다.
- 선택한 메뉴는 URL fragment와 화면 제목에 반영한다.
- 새로고침 후에도 fragment에 해당하는 화면을 다시 표시한다.
- 실제 mutation 버튼은 `미연결 기능` Popover를 열며 외부 요청을 만들지 않는다.
- `어울` Drawer, Workbench 탭, 상태 카드, 승인 카드가 실제로 열리고 닫혀야 한다.
- 메뉴 이동 시 브라우저 콘솔 오류가 없어야 한다.
- 브라우저 코드에는 `localhost`, `127.0.0.1`, Docker 내부 hostname, 내부 API 절대주소를 넣지 않는다.

## 6. 런타임과 배포

- 서비스명: `anvil-web`
- 컨테이너 수신 포트: `3770`
- 프로세스는 컨테이너 내부 `0.0.0.0:3770`에서 수신한다.
- NPM과 `anvil-web`은 공용 proxy Docker network에서 서비스 이름으로 통신한다.
- 브라우저 공개 주소는 `https://anvil.sinsan.kr` 하나뿐이다.
- 컨테이너 restart policy는 `unless-stopped`로 한다.
- 배포는 승인된 full Git SHA와 ReleaseManifest만 사용한다.
- 서버 직접 patch와 `scp` source overwrite를 금지한다.
- 배포 checkout은 `~/deploy/anvil/repo`, runtime은 `~/deploy/anvil/runtime`, evidence는 `~/deploy/anvil/evidence`로 분리한다.
- `/healthz`는 정적 UI 프로세스의 생존 상태만 반환하며 제품 기능 PASS를 주장하지 않는다.

## 7. 보안과 실패 처리

- CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`을 적용한다.
- 화면에 Secret, token, 내부 endpoint, DB connection string을 표시하지 않는다.
- API·DB·LLM이 연결되지 않은 상태를 숨기지 않고 `NOT CONNECTED`로 표시한다.
- 잘못된 fragment는 Dashboard로 안전하게 이동한다.
- 정적 자산이 없으면 404를 반환하고 디렉터리 목록을 노출하지 않는다.
- NPM의 `Online` 표시를 실제 UI 정상 동작 증거로 사용하지 않는다.

## 8. 검증과 완료 조건

다음 항목을 모두 실제 실행 결과로 확인해야 한다.

1. UI 단위 테스트에서 메뉴 11개, Workbench 탭 6개, 전역 어울 Drawer 계약 PASS
2. 정적 서버 테스트에서 `/`, 자산, `/healthz`, 404, 보안 헤더 PASS
3. 1920×1080 실제 브라우저에서 11개 메뉴를 각각 클릭하고 화면 제목·기능 위치 확인
4. Workbench의 대화·지시·진행·보고·승인·기록 탭 클릭 확인
5. 브라우저 Network에서 same-origin 요청만 존재하고 내부 hostname·localhost 노출 없음
6. 콘솔 오류 0건
7. 컨테이너 빌드와 Compose config PASS
8. Git 승인 commit과 ysna 배포 checkout full SHA 일치
9. `https://anvil.sinsan.kr` HTTPS 접속, 메뉴 클릭, 화면 캡처 PASS
10. `shared-db` 및 기존 컨테이너의 ID·상태가 배포 전후 동일

실행하지 않은 API·DB·Agent·LLM·Provider·업무 기능은 `NOT_EXECUTED`로 기록한다.

## 9. Rollback

- 배포 전 full SHA를 evidence에 기록한다.
- 문제가 생기면 Anvil Compose project만 중지하고 직전 승인 SHA로 checkout·재빌드한다.
- NPM과 기존 서비스, `shared-db`, 기존 volume·network를 삭제하거나 재생성하지 않는다.
- rollback 후 도메인 HTTPS, 이전 UI health, 기존 컨테이너 불변성을 다시 확인한다.
