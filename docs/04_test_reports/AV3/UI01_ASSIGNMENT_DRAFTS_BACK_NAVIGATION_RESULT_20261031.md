# UI01 저장 임무 초안 이전 페이지 복귀 결과 — 2026-10-31

## 판정·범위
기존 보호 cursor GET을 사용하는 한정 UI 누락의 source·핵심 동작을 검수했다. 실제 브라우저·HTTP/DB·부모 App 통합·배포·사용자 인수·전체 UI01/WORK_PLAN 완료는 아니다.

- WI UI01_ASSIGNMENT_DRAFTS_BACK_NAVIGATION_WI_20261031.md / SHA E245C29B353655B65D496FBB25930EC0AC96A385E6E4A2419314D15CE1BDC4C9.
- 기준 codex/av3-stage-b / 469d206d4f616dfc35bbb619311909bc19341139. 기존 Primary 구현, Main 검수·통합, 기존 Reviewer 읽기 검수 C0/I0. Main 제품코드 수정0.
- 제품 apps/web/src/features/projects/ProjectAssignmentDrafts.tsx SHA DF4E37F7EA7FAEF076C5ED478A5107A1785100E1320E6636FDCEDB9F3A087A08.
- 신규 tests/unit/UI01/project-assignment-drafts-pagination.test.ts SHA C9E3C5A981677A4976C70ADB9239216C97BB88FD0F9FDA34DA198090050D7F36.
- reader/부모·API·SQL·권한·전역CSS·의존성은 불변. 실제 DB/키/권한/사용자파일조사·서비스·Agent·기존project차단해제0.

## 변경 전·후
변경 전에는 현재 cursor와 번호만 보관해 1→2→3 이후 2페이지로 직접 복귀할 수 없었다. 변경 후에는 요청 대상과 마지막 성공 위치를 분리해 성공한 cursor 이력으로 3→2→1을 조회한다. 실패한 이동은 이력을 확정하지 않으며 명시 재시도는 같은 cursor다. 자동 첫페이지 대체·빈목록/완료 승격0.

닫기·명시 재조회는 이력을 초기화한다. pending 중 중복 요청을 막고, project/client/실 transport·disabled·닫기/이탈·관측한 transport ABA 뒤 늦은 JSON/401을 폐기한다. 현재401만 인증 만료 callback을 호출한다. 기존 limit50·폐쇄응답·관측시간·DRAFT/false flags·고정 fullref 상세 링크를 보존한다. 새 저장·책임자배정·Agent 실행은 없다.

## 검증·오류
- Primary27987a 실제 component+원 decoder로 3페이지까지 도달 후 이전 버튼 부재 RED. 이후02d4da 신규8+직접기존17=25PASS/skip0/type0·메모리build482/detect[]/diff0. 링크 query 오가정1은 원 route /versions/2/hash로 정정했고, 최소 DOM nodeValue 누락1은 표준 text-node 동작으로 보완했다. 두 준비 오류는 제품 RED와 구분한다.
- Main3ff2a0 최종 같은 exact2에서 다음 명령27PASS/skip0/exit0, 이어 type0:
  C:/Program Files/nodejs/node.exe --test tests/unit/UI01/project-assignment-drafts-pagination.test.ts tests/unit/FN01/project-list-results.test.ts tests/unit/FN09/assignment-web.test.ts tests/unit/FN09/assignment-list.test.ts
  C:/Program Files/nodejs/node.exe node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
- Mainc62d61 Vite apps/web/vite.config.ts build write:false 482modules/exit0, target1 impeccable detect --json 결과[]/exit0. Main3fd742 diff check0. 완료된 quota/UI06/UI03 검사는 반복하지 않았다.
- 독립 최종 exact2 지문 대조 C0/I0. Reviewer의 sandbox git diff worktree인식 exit128은 증거에서 제외하고 실제 원문/지문으로 검수했다. Primary sandbox Git 문맥 오류1도 최종 explicitcwd/elevated읽기로 분리했다.
- Main 새 UI01 시험 디렉터리 inventory1은 아직 없는 경로를 조회해 os error2였다. 이후 존재확인된 tests/unit root inventory로 교정했다. 별도 backend 조사에서 추정 stage-queue 경로1 조회실패는 실제 scheduling/stage-queue inventory로 교정했다. 파일/권한/제품 오류가 아니며 같은 추정경로 재시도0.
- 시험은 실제 ReactDOM·ApiClient·decoder를 메모리 DOM/Response 대역으로 실행했다. 시각 레이아웃·브라우저보안·실제HTTP/PG/권한/실서비스·사용자 인수는 NOT_RUN. 새 QA/프로세스/리스너/DB자원0, 시험 자체 MessageChannel과 원 globals 회수.

## 영향·복구·다음
변경은 저장 초안 목록 패널1파일로 한정하며 상세읽기/저장/실행권한을 바꾸지 않는다. 회귀 시 이 단위 제품파일만 기준469d206d로 되돌리는 별도 변경을 검토한다. 기존 사용자 자료/보호3/원5복구본·다른 소유 WIP는 보존한다.

전체 WORK_PLAN 미완료. UI04~08 기존 보호GET·FN16 내부port의 한정조사는 새 독립 구현누락을 찾지 못했으며 완료된 연결을 재작업하지 않는다. 기존 Primary는 FN06/08/09/10/12의 채택 source 경계를 읽기 전용 대조한다. FN14 별도계약은 기존 질문 답변만 확인하고 새 승인요청 반복0.
