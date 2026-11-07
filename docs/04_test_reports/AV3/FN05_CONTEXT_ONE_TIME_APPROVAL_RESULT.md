# FN05/FN11/UI04 맥락 준비 일회 승인 연결 검수

2026-10-27 · Main 어울 · 기준 branch `codex/av3-stage-b` / `1364817c5379f1551be84dc45782e19a23953ae5`.

## 판정

기존 buildTaskContext의 명확한 승인 필요 응답에서 일회 승인 요청→UI08 별도 결정→UI04 보호 조회·명시 결박→같은 원명령의 준비본 저장·고정 조회까지 연결한 소스 단위를 검수했다. 실제 DB 적용·정식 서비스·사용자 인수와 전체 FN05/FN11/UI04·Stage·작업계획 완료는 아니다.

신산님은 현재 대화의 질문 `call_10da08f49b2746928a4d23cee05b6d25`에 ‘위 범위 코드·화면·미적용 SQL 구현 승인’으로 직접 답했다. 대상 WI SHA256 `4318AFA6A9144CA19661F021CA23F1629F13A7D50321CF6A2850CD0BB0C9C985`의 16경로이며, 기존 로그인·회원·제어·정책·기한·일회 소비를 유지한다. 앞선 자동심사 거절2회는 새 직접 응답을 인정한 e09fac 이후 해소됐고 우회하지 않았다. 실제 DB 적용·정책/사용자 권한 부여·GRANT·서비스·Secret·Agent 실행은 제외한다.

## 변경·보존

- 단일 writer `fn05_context_one_time_approval`, Main 제품 수정0. 정확 경로와 raw/index 지문은 `FN05_CONTEXT_ONE_TIME_APPROVAL_SOURCE_MANIFEST.json`에 보존한다.
- 기존 operation·payload·ActionScope를 소비한다. null/0 봉투, 원 commandId·전체 payload hash·슬롯 원순서·actor/client/control/policy를 결박한다. 파싱 후 순서로 원 hash를 재구성하지 않는다.
- 기존 context_bundles.request_payload를 보존하며 새 후보 표·영구 원문 저장·공개 DTO를 추가하지 않는다. 원 transaction-local payload 대조와 승인 소비·자료·receipt·감사를 결합한다.
- 현재 source/헌법/원문 격리·정정·제외·확정 임무/예산 검사는 유지한다. 역사 조회는 현재 실행 승인과 분리하되 현재 회원·조회권한을 유지한다.
- 승인 준비/요청/결정/결박만으로 저장0. 원명령 UNKNOWN 후412는 새 승인으로 우회하지 않는다. 저장 후 조회 실패는 영수증과 원본을 보존하고 명시 재조회한다.
- 무소비가 확인된 거절·수정·만료와 같은 현재 owner/client/control의 정책 개정으로 회수된 요청은 보호 GET을 재확인한 명시 로컬 종료로 입력에 복귀한다. 원명령·요청·종결 이력은 보존하고 자동 POST0. 현재 제어·주체 변경/불확실성/소비 상태는 해제하지 않는다. 실제 실행·승인 결박의 현 정책 검사는 완화하지 않는다.
- ready/executionAuthorized/dispatchPerformed=false 유지. 실제 Agent 전달·이해·실행 허가는 연결하지 않는다.

## 실행 증거

| 구분 | 실제 근거·결과 |
|---|---|
| 기존 제품 guard RED | Main af4dc0: 신규 소비 시험1 FAIL 229.6965ms. CONTEXT_APPROVAL_NOT_CONNECTED와 기대 APPROVAL_REQUIRED/412 불일치. 제품8 불변/SELECT-only fake |
| 입력 반례 | Main7a7b3c: 2 PASS/1 FAIL198.109ms, nonnull targetRef/version1 수용 반례 |
| 서버·직접 인접 | Main ec965f: FN05 input/store/sources/manifest/routes/web/edit·FN11·기준선/반출의15파일,73 PASS1160.7782ms/FAIL·SKIP0. UI 최종 보정 전 증거이며 SQL 문자열 검사 포함 |
| UI 최종 직접/인접 | Main b32638: `node --test tests/unit/UI04/context-approval-api.test.ts tests/unit/UI04/context-api.test.ts tests/unit/FN05/context-preparation-edit.test.ts` 28 PASS281.6125ms. 앞선73과 별도 실행·중복 포함 |
| 실제 App4모드 | Main80729a→74348→4b0585: NORMAL/LOST_CONTEXT/LOST_REQUEST/GET_FAIL4 PASS, REJECTED1 FAIL/REVOKED_POLICY1 NOT_RUN, 실행 총17.8s |
| 실제 App 종결2모드 | Main2b8c15: `--grep 'CONTEXT_ONE_TIME_APPROVAL (REJECTED|REVOKED_POLICY)'` 2 PASS6.1s. 앞선4와 나누어 실행했으며 최종6 일괄 실행이라고 하지 않는다 |
| 최종 타입·diff | Main d4e914: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json`·`git diff --check` exit0 |
| Web build | 실제450modules317ms, JS `index-BVHAxrpz.js` SHA256 `C3939997291D5A55F32D6F12073E3E707B9A3F3E39F1D5AC38E7E6F74C249CA8`, CSS `BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87` |

실제 App은 제품 번들을 Edge에서 실행하되 API·저장은 합성 fixture다. 실제 PG/정식 API의 저장·조회 증거로 승격하지 않는다. 모든 검증 명령·오류와 도달 범위는 WORK_STATUS에 누적했다.

## 독립 검수·오류

- SQL 최초 C0/I1/M0: 승인 receipt만 남은 완결성 검사 회피. 모든 승인 흔적 NULL, command/scope 혼합, UPDATE/DELETE 흔적 삭제까지 같은 writer가 보정했다. 최종0046 SHA256 `40F3DF39BD9D7073BD0DE1038566BABA135AB889B0D4103D8C1B2B940DCCA2FD`, 독립 정적 I1/확장 ADDRESSED·새 C/I0. 기존0014/0045는 불변이다.
- UI 최초 C0/I1/M0: 종결 요청 뒤 입력 영구 잠금. round1 뒤 정책 개정 시 잠금 잔여를 round2에서 보정했고 독립 I1 ADDRESSED·새 C/I/M0다. 개발자 helper 정책 개정3 RED→API15 GREEN은 Main28과 분리한다.
- 첫 App REJECTED RED1 FAIL30.1s(e669fb)는 종결 버튼 부재였다. 이후 실제 App3ff64c/8655c3는 복귀 후 기존 확정 임무 원본 재조회 누락 및 중복 alert strict 오류를 별도 식별해 시험1파일만 보정했다. 동일 조건 반복을 중단했으며 REJECTED 중단/REVOKED 미실행을 PASS로 바꾸지 않는다.
- 후속 REJECTED의 입력 조회1 FAIL은 정확 label 텍스트에 textarea child 초기값이 포함된 시험 원인이다. 실제2b8c15 DOM에서 region1/textboxRole1/exactLabel0, label=`준비 이유승인 후 원명령 저장`, disabled=false·원값 보존을 확인했다. 고유 textbox role로 같은 활성화·값 기준을 검사했고 제품 변경0이다.
- 최종 browser spec `B3D18921C28B3CB90AA9D4D1269D6CFD0958C4AE290110D11BB45CB9E07C8680`, fixture scoped C0/I0/M0. 원명령 동일성·POST 횟수/순서·UNKNOWN 보호·수동 조회 기대와 timeout은 유지한다.
- Python cp949 읽기 오류는 쓰기0에서 UTF-8 명시로 해결했다. Main 현황 append 줄바꿈 오류는 소유 경계만 보정했다. Git CRLF 정규화 경고는 별도 지문에 기록한다. 개발자 정식 FAILURE_REPORT0.

## 자원·미검증·다음

등록 QA `D:/tmp/anvil-v3-stage-b/ui04-context-approval-20261027-01`의 dist/results/temp/config.mjs만 사용했다. owner SINSAN\cyhuh, 생성별 최대30분, 기존 브라우저/리스너/DB0. 생성 전 부재·부모 owner/nonlink, 삭제 전 모든 항목 owner/nonlink/절대경로·해당 Node/Edge process0을 확인했다.

- 첫 RED: 00:08:09.263Z→00:11:16.033Z 정리44항목, 독립6ed955 rootFalse.
- 중단한 App: 00:19:50.427Z→00:22:21.143Z 정리297항목(f174fa), 별도999744 rootFalse.
- 최종4+2: 00:23:27.699Z→00:26:55.356Z 정리51항목(d4e914), 별도 부재 확인은 WORK_STATUS에 기록한다.

실제 SQL compile/DML/COMMIT/RLS/경합·정식 PG/HTTPS 서비스 반영·다른 기기/Agent/native·사용자 인수는 NOT_RUN. API/session/transport 교체·ABA 실제 DOM의 모든 음성 조합을 이번6모드로 인증하지 않는다. 기존 보호 untracked8·다른 작업/과거 실패·미채택 계약은 보존한다. 소스 rollback은 후속 revert이며 실제 데이터 복원/삭제는 실행하지 않는다. 다음은 기존 FN10/UI05 startStage의 WAITING 요청 저장에 대한 미완료 승인 연결을 계획·선행과 대조해 진행한다.
