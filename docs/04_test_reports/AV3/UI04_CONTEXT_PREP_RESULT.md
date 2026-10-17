# UI04 프로젝트 주 작업 원본 조회 연결 — 한정 결과

Main 어울, 2026-10-18. **부분 구현·새 번들/합성 API의 핵심 조회 확인**. 실제 served 반영·DB 여정·Agent 작업·전체 UI04 완료가 아니다.

## 의도·범위·변경

- 승인 S04/WORK_PLAN UI04·SCREEN_WORK UI04의 착수 선행 UI00/P01과 기존 프로젝트 detail GET을 소비했다. 프로젝트 목록의 workspace 링크가 미연결 안내로 끝나는 공백을 Main이 다음 미완료로 선정했다. PMO 다음 업무 배정을 기다리지 않았다.
- 기준 branch codex/av3-stage-b / local-private1707cd49035fcc34e4a1900ac0437632e2917076. 단일 writer Main, 실제 runtime은6781703a/N4이고 이 후보를 재시작·반영하지 않았다.
- 제품4: `apps/web/src/features/workspace/api.ts`(기존 GET의 ID·원본·적용 참조·읽기 권한/제어·준비 부족 검증), `WorkspacePage.tsx`(절차 참조/총괄 미연결/자료의 3영역), 기존 `apps/web/src/App.tsx`의 import·workspace 분기, `styles/app.css`의 국소 반응형 레이아웃이다. 다른 기존 화면·server/SQL/권한/설정·native는 불변이다.
- 직접 `tests/unit/UI04/context-api.test.ts`, `tests/browser/UI04/{bundle.ts,workspace.spec.ts}`. 기존 UI01 목록의 workspace 이동에 필요한 기존 detail 응답 fixture와 전용 bundle 선택만 추가했으며 기존 기대값/예상 밖 API 거절·비GET0 기준은 유지했다.
- 원본 이름·목적·원하는 결과·변경 버전, 고정 적용 **참조**·참여/원본 편집 제어, 준비 부족, 문서/방법론/지식/승인/도구 탐색을 표시한다. 원본 조회의 HELD/준비 부족 없음은 실행허가/READY가 아니다. 총괄/책임자 세션·graph/단계 순서·지시 전달·Agent/실행 결과는 미연결로 표시하고 전송 버튼을 비활성화한다. 새 API나 가짜 세션/상태를 만들지 않았다.
- 로그인/프로젝트/client 키로 화면을 분리하고 현재 effect가 폐기되면 지연 응답을 무시한다. 새 조회부터 이전 원본을 제거하고 401/403/404/503을 빈 성공·현재 원본으로 바꾸지 않는다.

## 최소 검증

1. 최초 `node --test tests/unit/UI04/context-api.test.ts`는 새 module 부재 `ERR_MODULE_NOT_FOUND`/exit1이다. **7개 행동 case가 실행된 RED는 아니다.** 구현 후7PASS, 인접1을 합친 아래 최종8PASS와 구별한다.
2. `node --test tests/unit/UI04/context-api.test.ts tests/unit/FN01/project-list.test.ts`: **8PASS/FAIL0/SKIP0/335.0044ms/exit0**. same-origin GET·잘못된 ID/타프로젝트·불완전 제어/적용hash/권한·만료/거절/네트워크 실패를 확인했다. transport만 가짜이고 실제 DB 접근/인증/정책 검증은 아니다.
3. `npm run typecheck`, `git diff --check`: exit0. 전체 회귀는 실행하지 않았으며 기존 코드 불변의 A3 35검사도 반복하지 않았다.
4. 전용 `vite build --config apps/web/vite.config.ts --outDir D:/tmp/anvil-v3-stage-b/ui04-context-01/dist`:124module/초기286ms·harness 보완 뒤262ms/exit0. >500kB 경고1은 최적화 작업으로 확장하지 않았다.
5. 명시 전용 `ANVIL_UI04_QA_DIST`로 새 bundle을 same-origin route.fulfill하고 기존 API 응답 fixture만 연결한 Edge Playwright UI04 3/UI01 2: **최종5PASS/FAIL0/SKIP0/4.1s/exit0**. 목록→원본, 자료 href/disabled 전송, 조회 거절 시 제거, 다른 프로젝트 이동 후 늦은 원 응답 미표시를 확인했다. UI04 직접 검사에서 예상 밖 API/비GET/off-origin/pageerror0이다. 실제 서비스/API/사용자 DB 여정 PASS로 승격하지 않는다.
6. 초기 browser5PASS 뒤 전용ENV 없는 일반 served 검사에서도 static이 차단되는 harness 문제를 발견했다. API 거절/off-origin 감시를 유지하면서 static 제공만 선택하게 보완한 뒤 최종5건을 재확인했다. 제품 불변이지만 시험이 변경됐으므로 이 재확인은 필요한 검증이었다. NO_COLOR/FORCE_COLOR 도구 경고1도 제품 실패와 분리한다.

## 시험 자원·정리

- 사전등록한 Main/현재사용자 소유 `D:\tmp\anvil-v3-stage-b\ui04-context-01`의 dist/temp/results만 사용. worker child TEMP/TMP는 전용 temp, OS 지속환경/ACL·현재 service dist/Node/relay/DB/Secret 변경0이다.
- build3파일/index **95F6917CD3D2B2170B5C3B9629F7B959B89B04B385F689BA65811943EFB219E9**, JS **7D5F4D9F5D3ECB865CB311924697D335682542A95B74C5EF54B5AC4F2693A09A**, CSS **1FFC9B57199672473A5E3D572A73E4F36AECF4413E97F49C44C19D8C1E342D11**. 결과 JSON·브라우저 debug log2파일과 빈폴더5를 정확 실경로/전체목록·현재사용자 owner/nonlink/비reparse·hash·QA프로세스0 확인 후 제거했다. 최초/보완후 모두 별도 Test-Path false. 기존 실패 자료/런타임/보호 자료는 건드리지 않았다.
- 초기 추정 시험/모듈 경로 읽기3건과 PowerShell glob os123은 실제 파일 검색으로 정정, ACL/권한 변경0. 새 module 부재 외 제품 실행 실패0이다.

## 검수·미완료·다음

- 원 독립 검수 C0/I1/M0: waitForResponse가 헤더만 보므로 원 본문/JSON 처리 전에 부재 검사가 참일 수 있는 시험 결함이다. 제품 오노출을 확인한 판정은 아니다. Main은 실제 Client.get→json→동기 검증→effect와 대조해 수용하고 시험만 한 번 보완했다. body finished/실JSON 보류·명시 해제/이후 event-loop barrier·2 render frame 뒤 원 프로젝트 부재와 현재 프로젝트 유지를 검사했다. **보완 후 최종5PASS/6.6s/type/diff0·격리 build124module/255ms**. 위4.1초는 보완 전 증거다. 새 독립 C0/I0로 승격하지 않는다.
- 판단 유보별 Main 분류: 실제 user/client 인증 교체·실API/DB는 후속 고위험 연결 검증에서 확인하고 key/cleanup 코드 검토를 actual 증거로 부르지 않는다. EXISTING 소스 상세는 현재 표시하지 않는 선언이며 실제 경로 접근을 추론하지 않는다. served 반영·시각적 배치·단계/세션/Agent·전체 UI04는 미완료/미검증으로 유지한다. 이번 최종 검사 후에도 정확5파일/빈5폴더·QA process0 정리/독립 root부재를 확인했다.
- 실제 served/사용자DB·graph/단계 선택/대화·임무/FN09·시작/중지/FN08~13·전달/실제 Agent·IX02/Stage/사용자 인수는 미완료다. 경로는 향후 해당 후보 반영 뒤 `#/projects/<허용 프로젝트 ID>/workspace`, 목록의 ‘프로젝트 열기’다. 현재 서비스에서 이 새 화면을 사용할 수 있다고 보고하지 않는다.
- Main은 독립 finding을 대조하고 필요한 한정 보정/최소 검증·안전 checkpoint를 진행한다. 그 사이 native compile-01은 PRECHECK_BLOCKED, 고정3 OS HardLink 예외/new compile-only 결정은 별도이며 UI04로 덮거나 재시도하지 않는다. rollback은 이 후보만 정상 후속 commit에서 되돌리는 방식이며 DB/서비스 rollback은 필요 없다.
