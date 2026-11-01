# FN15/UI12 인수 요청 목록 페이지 탐색 source 검수

판정: **한정 source 구현·핵심 합성 동작 확인**. 실제 인수 수락·제어 이전과 전체 FN15/WORK_PLAN은 미완료다.

- 기준 control/private e14ead4555e53f1de2a4304c1cd9d3580dcc473e, codex/av3-stage-b. WI FN15_CONTROL_REQUEST_PAGINATION_SOURCE_IMPLEMENTATION_20261101.md SHA256 A950E5B45ADE89F0537EF25364A422338E082AE88487E54E37C6F6DB934B234B, 사전 독립 C0/I0.
- 기존은 OWN/CONTROLLER의 다음 페이지만 제공했다. 실패 시 현재 제어 상태와 목록/상세/요약을 지우는 보호 때문에 실패한 동일 view/cursor 재조회도 할 수 없었다. 성공 이력/위치와 실패 target을 분리해 이전 페이지·같은 실패 페이지의 명시 재조회를 연결했다.
- 기존 fail-closed는 유지한다. 재조회는 최신 state GET을 먼저 검산하고, CONTROLLER의 OWNER/HELD 조건을 잃으면 목록 GET을 보내지 않는다. cached HELD·목록 receipt로 현재 권한을 복원하지 않는다. 성공 뒤에만 위치를 확정하고 OWN/CONTROLLER 이력을 섞지 않는다.
- 페이지/view/문맥 전환은 원문·요약을 즉시 숨기며 명시 재선택한다. 주체/API/CSRF·실transport·관측 ABA/unmount·늦은401을 폐기하고 현재401/403은 기존 의미를 유지한다. 첫 null cursor 복귀는 새 관측일 수 있으며 동일 snapshot을 보장하지 않는다.

## 변경2·검증
| 파일 | 최종 SHA256 |
|---|---|
| apps/web/src/features/control-handoff/ControlAccessPage.tsx | 255F78157F6593E5315A0AA96440BA09EABC1D7B9E04402DFD24B52AA2376847 |
| tests/unit/UI12/control-access-pagination.test.ts | 444010CB2F6C0AEC022923003D763D293CC79AAF9305477D95B51F0DC62814BA |

기존 Primary가 위2만 구현하고 writer를 반환했다. API·서버·SQL·App/ControlBuffer/ControlScope helper·CSS·기존 시험은 변경하지 않았다. Main은 제품write0, Reviewer는 읽기만 수행했다.

- genuine RED22650c: 실제 React 현재 제어 HELD→OWN 첫/다음 목록을 기존 decoder로 정상 조회한 뒤 이전 버튼0≠1,0PASS1FAIL/716.8706ms. loader/fixture 실패가 아니며 35a1f0 첫 GREEN 뒤 주요 음성을 보강했다.
- Primary9ea2d3 신규8+기존 순수 control-api7=15PASS/1129.1481ms·정확 root type0. Main aad63f 같은 정확2시험파일 fresh **15PASS**,0FAIL/CANCEL/SKIP/TODO,761.8452ms·type/diff exit0·시작끝2지문 동일. 이름 필터 없이 아래 파일만 실행했다.
```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/UI12/control-access-pagination.test.ts tests/unit/UI12/control-api.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```
- 실제 React/기존 ControlApi decoder·Vite configFile:false/envDir:false/write:false·메모리 DOM/응답으로 왕복/실패→fresh state/제어 상실·view 분리/원문 숨김/관측 ABA·현재401/403·무렌더 transport·UNKNOWN 버퍼 bytes/binding 보존을 확인했다. **목록 경로 POST·onChange0**이며 인접 API의 합성 POST 계약 시험은 실제 HTTP/권한 변경이 아니다.
- 최종 exact2 독립 C0/I0, 시작끝지문 동일. Main fa6bc7은 실제 diff를 읽어 기존 send/prepare 흐름을 재작성하지 않았음을 대조했다. 수행자313b99와 Reviewer의 sandbox git diff 조회는 worktree 인식 오류로 실패했고 그 출력을 diff 증거로 쓰지 않았다. 같은 조회 재시도·Git/ACL 설정 변경0이며 Main의 승인된 source 조회/diff검사와 구분한다.

## 미검증·복구·다음
실브라우저/레이아웃·실서버 cursor 서명·실API/PG·실수락/제어 전환·사용자인수는 NOT_RUN. 기존 미구현 수락 버튼·수집/이전 false 의미를 유지하고 실제 DB·권한·키·서비스·Agent·프로젝트 차단 해제0이다. 메모리 번들/채널·React root는 회수했고 수행자/Main 도구 종료/live0, QA 디렉터리 생성0이다. protected untracked3과 완료 코드 보존, main 병합0이다.

복구는 한정 제품2 commit의 정상 revert이며 부모 UNKNOWN 원명령이나 사용자 dirty/DB를 reset하지 않는다. FN16 새 보호 함수/NOLOGIN 소유자와 FN06 ConnectionDefinition 후보의 채택은 별도 결정으로 남는다. 전체 기능 인수·계획 완료를 source 검수로 대체하지 않는다.
