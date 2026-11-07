# UI11 쓰기 제어 기록 수동 조회 — source 검수 결과

2026-11-02 / Main 어울 / 기존 Primary 구현·기존 Reviewer 독립 검토

## 판정과 기준

source 소비 검수 합격이다. 기능 상태는 **구현했지만 실제 서비스 동작 미확인**이며, UI11/FN06/FN08/Stage B·전체 계획 완료가 아니다. 실제 서버 등록·DB·권한·키·서비스·Agent·실자료·P03 R3는 변경하거나 실행하지 않았다.

- WI: docs/work_packages/UI11_WRITER_AUTHORITY_CURRENT_READ_IMPLEMENTATION_20261102.md SHA256 6D7CD4C15055E9116919C2A91FC7B3B63C4085A5D574191CCCC298C0B34F760D.
- 기존 UI11의 권한/범위·기한·미확인 조회와 직접 채택 B §5의 current GET을 소비한다. 범위 대조·정확 WI preflight C0/I0, 새 공개 API·승인·권한 계약 추가0.
- 코드458345a38f496dc9bc183f15938530325bd6b4b8는3d5f14a59b60a2188043045fb2e202e4758606de 직접 자식, 정확5경로·119추가다. 기존 branch codex/av3-stage-b를 사용했다. 문서/게시의 후속 exact SHA는 WORK_STATUS에 기록한다.

## 실제 바뀐 동작

기존 ‘도구·환경·권한’ 화면에 ‘쓰기 제어 기록 열기 → 쓰기 제어 기록 확인 → 닫기’를 연결했다. 열기/진입은 GET0이고 명시 확인만 기존 상대 GET /api/v1/projects/:projectId/writer-authorities/current를 사용한다. POST/자동 조회·폴링/정책 변경·서버 활성화0이다. 실제 반영과 연결이 승인된 뒤 위 화면에서 확인할 수 있으며 현재 실행 중 서비스에 반영했다고 보고하지 않는다.

정확7 응답·head fullref/hash·요청 project·lease/null·tip·expired 및 권위4false를 검산한다. WebCrypto/브라우저 기존 canonical을 사용하고 서버/node:crypto를 runtime import하지 않는다. 현재 기록 없음은 작업 없음이 아니며 ACTIVE도 저장된 원장 단계다. 기한은 응답 기준으로 표시하고 실제 실행·쓰기 허용·전달·회수 완료를 확인할 수 없다는 한계를 표시한다. 제공되지 않은 source 경로·원 사건 진위나 tip 소속을 추론하지 않는다.

프로젝트/사용자/client/CSRF/API/transport·요청 세대 변경, A→B→A, 닫기/unmount 및 늦은 JSON/hash 뒤 이전 결과·오류/401을 버린다. 현재401만 기존 인증 상실 callback을 호출한다. 403/404/503은 오류/미연결·미확인으로 남기며 자동 복구나 성공 대체를 하지 않는다. 기존 후보/환경/승인 작성 버퍼와 목록 왕복은 보존했다. 부모 diff는 import와 패널 mount 두 줄뿐이다.

## 검증과 독립 판정

| 실행 | 결과 | 한계 |
|---|---|---|
| 최초 Primary91cd4a 실제 ConnectionsPage memory ReactDOM | 0PASS/1FAIL, 버튼0≠1, exit1 | 누락된 실제 소비 진입 RED이며 loader/fixture 실패 아님 |
| Main d8b67d: node --test tests/unit/UI11/writer-authority-current-api.test.ts tests/unit/UI11/writer-authority-current-panel.test.ts tests/unit/UI11/connection-candidate-pagination.test.ts | 신규8+직접인접7=15PASS, exit0/skip0, 1478.9463ms | 실제 ReactDOM 클릭/effect·모의 GET·메모리 DOM, 실제 browser/서버 아님 |
| Main f9f574: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 및 git diff --check | exit0 | source 타입/diff |
| Main6490c4: App Vite configFile:false/envDir:false/write:false IIFE build | exit0, chunk1·4,090,559바이트, browserServerImports=[] | 메모리 build, 배포/served/실브라우저 검수 아님 |
| 최종 한국어 문구 Primaryf56706 표시case1 및 Mainfcdbd8 표시영향2case | 각exit0, Main2PASS/865.375ms | 불변 전체 검사 반복0. Main은 test-name-pattern ‘수동 열기 GET0 또는 실제 ACTIVE 표시’만 선정, Panel의 다른3case는 미선정이며 Node 출력skip0과 구분 |
| Main051e6c 실제 파일/staged blob5경로 대조 | 일치5·불일치0·diff0 | 코드 checkpoint의 정확 범위 |
| 기존 Reviewer | 구현5경로 C0/I0, 문구 변경2경로 scoped C0/I0 | source 정적 독립 검토, 직접 시험 재실행/실환경 검수 아님 |

동일 시험을 합산해17건이라고 하지 않는다. 15건의 기능 증거와 이후 문구만 바뀐2건의 영향 증거를 구분한다. 최종 표시 보완은 검산·GET·세대·상태 보호 코드 변경0이며 동등한 미확인 표현을 유지했다.

준비 오류: Primary의 잘못 지정한 읽기 leaf1, Python UTF-8 미지정1, sandbox Git 문맥 exit128 각1은 실제 기능 RED와 분리했다. UTF-8은 파일 읽기 단계에서 실패한 뒤 명시하고 재검증했으며, Git은 승인된 정확 환경에서 read-only diff0으로 확인했다. ACL/Git 설정 변경0. Main의 경로 추측/구문 준비 오류와 교정은 WORK_STATUS에 별도 보존했다. 미해결 Critical/Important0이며 동일 정식 실패3회에 따른 Main code 인수는 없었다.

## 정확 변경 파일·최종 SHA256

| 경로 | SHA256 |
|---|---|
| apps/web/src/features/connections/ConnectionsPage.tsx | C0B32563F26FD6F249551A2E8F73BC457824165BBBB61801D33F405C0991032A |
| apps/web/src/features/connections/writer-authority-current-api.ts | 3DD87506A29D8A2A6F0BCAC6387C2171A905C2DD2BC8B54331C78510284F8FB6 |
| apps/web/src/features/connections/WriterAuthorityCurrentPanel.tsx | 375719C5FF9DF1B85C0CF0A191AF4038FBF92BE573422233EEBF13A85726CCC3 |
| tests/unit/UI11/writer-authority-current-api.test.ts | FB03D8213D0A1F59564BE0C1AE80DADB3CE885A4738DA13DD28E3E6823156059 |
| tests/unit/UI11/writer-authority-current-panel.test.ts | FE497E62C08C9B59077E2C811CAF6F76B854D9A457DDE3CE7D6E631400745875 |

## 미검증·복구·다음 작업

실제 browser 보안/Network/시각/기기·served HTTP/PG·실제 사용자 인수는 NOT_RUN이다. 기존 GET은 기본 미등록이며 연결되지 않은 실제 화면에서는404/503일 수 있다. 합성 정상 응답을 현재 서비스의 결과로 만들지 않는다. 실제 writer/provider/OS·코딩 Agent 연결이나 actual fact/grant/permit은 여전히 미구현/미검증이다. 이 읽기 화면으로 해결했다고 하지 않는다.

새 dependency·package/lock·설정·SQL/서버·QA root/서비스 생성0, 실제 계정/등록키·실자료 조사0. Node 검사 종료와 명시 root/global/MessageChannel 회수 코드를 확인했고 Primary는 live handle0으로 writer를 반환했다. rollback은 정확5경로의 정상 revert 검토이며 서버/DB/데이터를 삭제하거나 복원하지 않는다.

다음은 남은 actual 실행 소비 계약의 namespace·원 writer/준비/관측 결박·허가/permit/current 생산자와 저장 제약을 구체화한다. 기존 합성 v1/0017을 actual로 승격하거나 새 계약 없이 실제 실행을 열지 않는다. PMO에는 필요한 결정·지원만 요청하고 독립 구현은 계속한다.