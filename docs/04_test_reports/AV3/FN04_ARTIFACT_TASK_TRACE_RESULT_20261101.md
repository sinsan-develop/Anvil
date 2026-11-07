# FN04/UI05·UI06 산출물–고정 업무 추적 소스 검수 결과

- 일자: 2026-11-01. Main 어울, 기존 Primary 구현·독립 Reviewer 검토.
- 판정: 기존 승인 미구현 분기의 서버·화면·미적용 SQL 연결을 소스 범위로 검수했다. 실제 DB 적용·사용자 사용 가능·전체 FN04/UI05/UI06/Stage/WORK_PLAN 완료는 아니다.
- 기준: codex/av3-stage-b 부모5aef968e8037b4ff4651dd9c603baaa8b7f8978b, WI FN04_ARTIFACT_TASK_TRACE_IMPLEMENTATION_20261101.md SHA256 F60AC44D236C19172EAC2A3719540A59A11C0BDBD6164CF393C2498FB40BFDB2.

## 변경과 사용자 흐름
이전에는 ARTIFACT가 TRACE_SOURCE_NOT_READY/412로 거절되고 결과 산출물에서 고정 업무 추적을 저장할 화면이 없었다. 이제 UI05 선택 결과의 등록 산출물과 같은 확정 임무의 고정 계획 업무를 대조하고, 사용자의 명시 선택·사유·준비·저장으로 기존 linkTrace 명령을 보낸다. App 메모리 buffer에 원명령을 보관하며 UI06에서 같은 edge/hash의 정·역방향을 조회한다.

추가 관계는 ARTIFACT→PLAN_TASK/IMPLEMENTS뿐이다. ref는 artifact id/version1/원본 bytes hash를 사용하며 metadata 검산을 파일 bytes 검수·Agent 산출물 출처·구현 완료·실제 실행/시험 합격으로 표현하지 않는다. 기존 로그인/소유·제어/정책/영수증·미연결 실행/시험 evidence를 보존한다. READY/격리·정확hash·V1 inspection metadata 모순을 검사하고 legacy null은 허용한다. 원0004 SQL·권한/GRANT·기존 보호3·package/lock은 변경하지 않았다.

## 검증
- 실제 RED: Primary8803ee 및 Main ef05cc는 기존 실제 ProjectPolicyRepository.command→ProjectTraces.resolve의412를 확인했다. Main 1FAIL493.6245ms는 구현 전 증거로 보존한다.
- Main 최종90a557: 아래 정확 명령의 신규15+직접 인접10=25PASS, fail/skip/cancel/todo0,870.0649ms. typecheck/diff 각각exit0.
- Main51e5df: 실제 apps/web를 Vite configFile:false/envDir:false/build.write:false로 메모리 빌드 exit0(출력3개), 파일 배포/서비스 시작0.
- 독립: WI C0/I0, 서버 metadata 보완 후 C0/I0, 최종 UI C0/I0. SQL 최종80BAF8B4는 LF→CRLF 역변환으로 이전8BB7B0CF 검수본과 정확 일치하여 의미 변경0이다.
- Main 합성 브라우저: ego-browser space22의 오프라인 HTML과 실제 Panel+상위buffer 대역. 명시 준비 전POST0/저장POST1·IMPLEMENTS 표시(54342c/f5fe7c), 같은 edge의 FORWARD/REVERSE 표시와 추가POST0(ce9f4a), LOST 후 이탈복귀·동일 원명령 명시 확인, transport 교체 busy 회복, 같은 주체 새CSRF의 옛401 폐기/인증소실callback0(60d7e0)을 확인했다. 페이지 error/unhandled rejection0. 실제 App route 종단·서버 API·DB가 아니다.
- Main bundle b53a7b: harness SHA26D96990B2FDAAA0000A231B57A3A14005AD3D8B71D8B1D0D6083152DAA56E4D, 내장HTML668415B/SHA BC732480246D3B13CD829678565BE2E0A4807B93E3AEDB5F476FB7023BD0D7A4. seed는 명시 합성 자료이며 실제 사용자 파일 접근0.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN04/artifact-trace.test.ts tests/unit/FN04/artifact-trace-sql.test.ts tests/unit/UI05/artifact-task-trace-api.test.ts tests/unit/FN04/trace-plan-task.test.ts tests/unit/UI05/assignment-plan-original.test.ts tests/unit/UI06/trace-api.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

## 변경 12경로·최종 raw 지문
| 경로 | SHA256 |
|---|---|
| apps/server/modules/traceability/traces.ts | 9ECF6E4848185BB550C7BB0C2EF32786F7F2C8771A259F2348A9FFE3DF462779 |
| db/migrations/0064_trace_artifact_links.sql.pending | 80BAF8B4C58F6BCCDEA77AF8381AC5FE655246E5F1991C31A28BE9A6E2E1368A |
| apps/web/src/features/design-trace/trace-api.ts | 8C4AF0F4715549B9561C7CD0AA456BC245D292163C4469C2C1BAF58E51F77913 |
| apps/web/src/features/design-trace/TraceViewer.tsx | F6BCD38C69A17DCD4393552E57F42A030A83CB4D8662158B40735178202E9A95 |
| apps/web/src/features/session-detail/SessionDetailPage.tsx | D426835C5DB994A3E942B23033FCD1F2A12A8AACDF0D34F91077DE961FA9618A |
| apps/web/src/App.tsx | 37E84C63C0F05F22AA978A63A35CB01D86BF6F2EB30383AFDC725DC716EC076C |
| apps/web/src/features/session-detail/ArtifactTaskTracePanel.tsx | 4BF40A816C7554C55ED94FC67A85985B3DBF246D42E35EB6C0080D04CEC13F4A |
| apps/web/src/features/session-detail/artifact-task-trace-api.ts | 592942562F3C61FBE5449A5AED94C886D7ED90EEF49D17D40A4BA9AC4E6D65D3 |
| tests/unit/FN04/artifact-trace.test.ts | 43DE0F702263606D26DEA07915687C42D39FA7218AE3E25AABE0371B5AFEEF19 |
| tests/unit/FN04/artifact-trace-sql.test.ts | C6F8A2CEDC2D299A1AC879E460477AC1A8BD082425A94BC538542CB2B0BC44C4 |
| tests/unit/UI05/artifact-task-trace-api.test.ts | 2F601B96E9C767B129907E67E0FC1436E7D977CCBAA43442E66C3763D22463F9 |
| tests/browser/UI05/artifact-task-trace-dom-harness.tsx | 26D96990B2FDAAA0000A231B57A3A14005AD3D8B71D8B1D0D6083152DAA56E4D |

기존 tracked5개는 원CRLF를 유지했고 Git index 정규화가 있을 수 있다. 게시 전 raw→LF 정규화 bytes와 index를 대조하며 실제 시험 raw 지문은 위 표로 보존한다. 설정을 바꾸거나 논리 불변 시험을 재실행하지 않는다.

## 오류·보완과 미검증
- 제품 반례: 원412, READY/inspection 모순 수용, transport 교체 busy 잔류, 새CSRF 뒤 옛401 callback 오염. 각각 반례 후 최소 보완했으며 기존 원명령/세대·UNKNOWN 의미는 보존했다.
- 수행자 준비 오류: fixture2·타입2묶음·Vite entry1·외국어 commentary1, 보정 후 최종 증거를 구분했다. Main의 추정 경로 읽기/Git sandbox/QA 경로구분자 오류와 한국어 현황 정정은 WORK_STATUS에 보존한다. 같은 원인3회 추정 경로 읽기는 중단하고 정확 목록 기반으로 전환했다.
- 미검증: 실제 PG/migration·CHECK/trigger·원자성·경합, 실제 등록 artifact producer/파일 bytes/비밀 탐지, 실제 App route·로그인·권한·WSL·서비스·Agent·실사용 인수. 합성 fixture/브라우저 통과를 이 범위의 PASS로 승격하지 않는다.
- 실제 DB·권한·키·사용자/백업 자료·서비스·Agent 실행0. 기존 프로젝트 차단 해제0.

## 정리·복구·다음
사전등록 QA root D:\tmp\anvil-v3-fn04-artifact-trace-20261101-01의 owner/marker/realpath·비링크와 정확6파일을 검사했다. 브라우저22는ab0803 정상finish, 폴더는8328a3에서수명내정리했고독립fcb6c3에서부재를확인했다. 임시자료재생성·완료된space재개0이다.

실DB 미적용이므로 데이터 rollback은 없으며 문제가 있으면 이 논리적 source commit을 정상 revert하고 원 checkpoint로 검수한다. 다른 변경 reset·history rewrite0. Main은 정확 변경만 private checkpoint로 게시하고 계획의 다음 미완료 연결을 선정한다. 신규 HTTPS 공개 형식은 기존 한정 결정과 분리하며 승인 전 해당 source 구현0이다.

### Git 게시 bytes 대조
Main70655e는 최종 raw 지문12개·보호3·정확 stage14경로를 대조했다. index는 모든 파일에서 raw 또는 CRLF→LF bytes와 정확 일치했다. 기존5파일의 index SHA256는 다음과 같고, 실제 시험 raw SHA256는 위 표를 유지한다. 논리/설정 변경이 없어 동일 시험을 반복하지 않았다.

| 파일 | Git index SHA256 |
|---|---|
| traces.ts | 88D2CFF27156521B7E65142AD489448D77E8C9CD2BDFB5C0A92FB89E5EA8E638 |
| App.tsx | 6E192302AE8A79F03364A5938CDE122F6BDC1FF6759105CAD92FA9F4E69194F6 |
| TraceViewer.tsx | 18BD796033A79161C9CBA3957550EAFF32F8318886DDE155867E6AFFE95ACE89 |
| trace-api.ts | B4AE976136B39AC2999F6D6889089AD8DEF34266F3054B4BE6D88C8EC3BE651C |
| SessionDetailPage.tsx | 417EC7A6B034E70B71C1FEE3AA5F4F008623A1811115549FB7EFF2F28C5A8E8F |
