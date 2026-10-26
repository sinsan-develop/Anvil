# FN03/UI03 과거 공통 양식 복사·편집·저장 검수

2026-10-27 · Main 어울 · 기준 checkpoint `561b00470a84caeb68ed7f87d5dcbafb991da02a`.

## 판정

이 소비 기능의 소스 구현·합성 API 기반 실제 App/Edge 핵심 동작을 검수했다. 전체 FN03/UI03·Stage B·작업계획 완료가 아니다. 실제 DB·정식 서비스 반영·사용자 인수는 미확인이다.

기존 화면은 과거 양식을 조회·비교할 수 있지만 복사 원본으로 선택할 수 없었다. 변경 후 명시적으로 선택한 과거 버전의 정의·양식 코드·작성 기준을 기존 copyForm 명령으로 새 ID/v1에 복사하고, 편집·saveFormDraft·v2 재조회로 연결한다. 현재 원본과 기존 편집·신규 작성·검토는 유지한다. 새 API·SQL·권한·Secret·서비스·실제 Agent 변경은 없다.

## 범위와 근거

- WI: `docs/work_packages/UI03_HISTORICAL_COMMON_FORM_COPY_IMPLEMENTATION.md`, SHA256 `59C3F20C63045781C9C5C19B0F18F52C5593994E27745189A28D9C88C963C056`.
- 단일 구현 담당: `ui03_historical_form_copy`. Main 제품 수정 0.
- 제품 3경로와 신규 browser spec 1경로만 변경했다. 정확 지문은 연결 source manifest에 보존한다.
- 기존 서버의 exact 과거 sourceRef 지원을 소비한다. 과거 선택은 POST 0이며 현재 FormBuffer를 교체하지 않는다.
- 미저장 확인 취소·원명령 pending·검토 pending을 보존한다. session·API/transport·원본·비교 세대가 달라지면 늦은 응답을 적용하지 않는다.

## 실행 증거

1. 제품 3파일 불변·초기 spec `D8CDC234AA5C2920952E1A489E82660B890101CB752F1579B795038BAAC7DA4F`에서 기존 App 실행. `a682f3` exit1: 과거 비교 성공 후 spec73의 정확 선택 버튼 부재 1 FAIL, 11 NOT_RUN. setup 실패가 아닌 기능 누락 RED다.
2. 최종 동결 후 Main `446a84`: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json`, `git diff --check` 모두 exit0, 제출 4지문 일치.
3. `350d30`→session32494→`b45d80`: Vite write:false 444모듈/301ms 후 `node node_modules/@playwright/test/cli.js test --config <등록 QA root>/config.mjs`, 실제 headless Edge **12 PASS / 9.9s**, FAIL·SKIP 0. 합성 API로 정상 과거 복사·새 ID/v1·편집/save/v2 재조회, 현재본 편집, dirty 취소, 입력/해제, hash/403, 비교 ABA, 응답 유실, POST 수락 후 첫 사본 GET 실패, 재인증 중 늦은 응답, 닫기/현재본 복사·신규 작성, 검토 pending을 확인했다.
4. JS `index-B1SpRqP_.js` SHA256 `3AA6E64F5676ECCC8C8459541F6535FD0B5FB482665646580021206CED2A9A10`; CSS `index-BHDH6qmX.css` SHA256 `BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87`.
5. 독립 WI 사전 검토와 최종 정적 검수 모두 C0/I0/M0. 검수자는 실제 4파일 지문을 대조했다. 검수자 Git 읽기는 sandbox Permission denied이므로 Git 상태는 Main 실제 확인 근거를 사용한다.

API 인스턴스·동일 인스턴스 transport 직접 교체와 사본 GET 진행 중 문맥 전환은 정적 근거만 있으며 직접 DOM 시험 PASS로 계산하지 않는다. 실제 DB·served·다른 기기·사용자 인수도 미실행이다. 이미 완료된 방법론 복사나 전수 회귀를 다시 실행하지 않았다.

## 오류·정리·복구

- 개발자 초기 nullable 타입 진단 5건은 한 수정 묶음으로 정정해 최종 type0. spec 변경은 실패 복구에서 원본 재조회 후 비교 버튼 활성화를 기다리는 동기화이며 12건 기대조건은 유지했다.
- Main 추정 설정 경로 읽기 2건과 개발자 추정 경로 읽기 오류는 기능 실패와 분리해 WORK_STATUS에 기록했다. 이후 실제 파일 목록 기반으로 전환했다. 권한/ACL 수정은 없다.
- 사전 등록 QA root: `D:/tmp/anvil-v3-stage-b/ui03-historical-form-copy-20261027-01`. owner `SINSAN\cyhuh`, 각 생성 최대 30분, dist/results/temp/config만 생성.
- RED: 2026-10-26T22:35:17.920Z 생성→22:35:59.794Z 소유 25항목 정리(`551f90`), 독립 부재 확인 `211394`.
- 최종: 22:39:17.366Z 생성→22:39:49.674Z 소유 21항목 정리(`7ae025`), 독립 부재 확인 `622890`. 두 번 모두 realpath/nonlink/owner 및 해당 Node/Edge 프로세스 0 확인 후 exact 경로만 제거했다.
- 보호된 기존 untracked 8개는 보존한다. 변경 소스는 후속 revert로 복구 가능하며 서버 자료를 변경하지 않았다.

다음은 계획상 핵심 수직 기능의 기존 승인·미채택 delta를 분리해 진행한다. PMO 자체 대기를 Anvil 전체 대기로 확대하지 않는다.
