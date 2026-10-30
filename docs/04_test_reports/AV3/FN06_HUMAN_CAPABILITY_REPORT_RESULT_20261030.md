# FN06 HUMAN r2 능력보고 보관·고정조회 source 검수 결과 — 2026-10-30

## 판정·근거
승인된 **source·화면·미적용 SQL·합성 검수 단위**를 검수했다. 최종 독립 검수 C0/I0이며 확인된 미해결 Critical/Important는 없다. 전체 FN06/UI11·Stage B·WORK_PLAN 완료나 사용자 인수가 아니다.

- 직접 승인: `docs/approvals/FN06_HUMAN_CAPABILITY_REPORT_SOURCE_DIRECT_APPROVAL_20261030.json`, SHA256 `7B22897F025CCEEE434C1923B80E2EC1D00EED5AFE5D1AE69D040AFA7255FA36`.
- 채택 r2: `docs/work_packages/FN06_CAPABILITY_REPORT_HUMAN_STORAGE_CANDIDATE_R2.md`, SHA256 `6546808480650288302FB6AAF674AE35D7A72744E2C85A693D6BB13AA2E6B7F8`.
- WI: `docs/work_packages/FN06_HUMAN_CAPABILITY_REPORT_IMPLEMENTATION_20261030.md`, SHA256 `7A95F469BBB3B3BDEB5CCED0ADEB0E6E962254ECFA78BAD79859D026EBA08CDB`.
- 시작 HEAD `64642dfbbb2e76b3b6fb36a365c3719bbebcb11e`, branch `codex/av3-stage-b`. Main 소유 WORK_STATUS 변경과 보호 untracked8을 보존했다. 기존 Primary만 제품 writer였고 최종 제출 뒤 해제했다. Main은 관리·검수·문서·통합을 담당했다.

## 실제 구현·변경 전후
이전에는 HUMAN 능력보고를 프로젝트 자료로 보관·고정 조회하는 연산과 UI11 소비선이 없었다. 이제 현재 로그인/OWNER·단독 제어·기존 재인증·명시 AUTO 정책을 검사한 `recordCapabilityReport`가 사람의 6능력 주장·근거 참조를 불변 snapshot으로 보관하고 정확 버전 GET으로 조회한다. 실제 능력 실측이나 실행 허가는 만들지 않는다.

- replay도 현재 인증/제어/재인증/정책 뒤 원 claim·snapshot·command·receipt·audit·근거색인 정합을 다시 대조한다.
- 사람의 VERIFIED/DIRECT 주장은 원문에만 남고 서버 판정은 6능력 UNVERIFIED, CANDIDATE_ONLY/HUMAN_CLAIM, 실행/dispatch false다. C1 및 실제 실행 차단은 유지한다.
- UI11에서 실제 보호 조회한 두 후보를 선택하고 6주장·원문 참조·이유를 입력해 명시 보관→반환 정확 ref GET 검산으로 이어진다. App 소유 편집/원명령 buffer, raw JSON 중간 입력, 불명 결과의 동일명령 확인과 명확 거절 후 명시 수정 이력을 보존한다.
- 기존 원문 보호는 `ProjectDocuments.originalText`를 재사용한다. 원문 bytes/storageKey를 보고 DTO에 복제하지 않는다. 근거 열기는 기존 보호 file URL의 수동 링크만 제공한다.
- 신규0057은 두 새 표와 원명령→보고 누락·근거 양방향 완결·영수증/감사·변경/삭제 방어를 작성한 **미적용 SQL**이다. 실제 DDL/GRANT는 실행하지 않았다.

변경한 정확15경로:
```text
apps/server/modules/access/project-command.ts
apps/server/modules/projects/routes.ts
apps/server/modules/connections/capability-report-input.ts
apps/server/modules/connections/project-capability-reports.ts
apps/web/src/App.tsx
apps/web/src/features/connections/ConnectionsPage.tsx
apps/web/src/features/connections/policy-editor-profile.ts
apps/web/src/features/connections/capability-report-api.ts
apps/web/src/features/connections/CapabilityReportsPanel.tsx
db/migrations/0057_capability_reports_human_claim.sql.pending
tests/unit/FN06/capability-report-input.test.ts
tests/unit/FN06/capability-reports.test.ts
tests/unit/UI11/capability-report-api.test.ts
tests/browser/UI11/capability-reports-dom.test.ts
tests/browser/UI11/capability-reports-dom-harness.tsx
```
Main4844d1은 최종15 지문과 기존 보호8 지문 총23개를 대조해 불일치0을 확인했다. 기존 tracked 변경은 위 기존5와 Main 문서뿐이다. 기존 적용 SQL·storage 검사기·Authority/실행 resolver·다른 보호 파일은 변경하지 않았다.

## Main 실제 검증
각 행은 별도 실행이며 중복·소스 assertion을 단일 전수시험이나 실제 DB 동작으로 합산하지 않는다. 모든 행 exit0/0 SKIP.

|증거|정확 명령/범위|실제 결과|
|---|---|---|
|78bf61|`node --test tests/unit/FN06/capability-report-input.test.ts` 당시 동결 입력|5 PASS, 277.2646ms|
|1d6c6e|`node --test tests/unit/FN06/capability-reports.test.ts` 당시 저장 동결|6 PASS, 509.1649ms|
|ea467e|같은 저장 파일 `--test-name-pattern='현재정책과 제어회수\|정정은 같은 full쌍\|과거 head변경\|선택 근거색인'`|추가 행동4 PASS, 363.6025ms|
|3c45f3|`node --test tests/unit/UI11/capability-report-api.test.ts`|5 PASS, 244.5739ms|
|e11d74|`node --test tests/unit/FN06/candidate-input.test.ts tests/unit/UI11/candidate-api.test.ts tests/unit/UI11/candidate-policy.test.ts tests/unit/UI11/candidate-profile.test.ts`|기존 직접 인접19 PASS, 784.944ms|
|10c210|입력 파일 `--test-name-pattern='근거20고유\|자유문자 UTF16'`|추가 입력2 PASS, 208.8316ms|
|10c210|저장 파일 `--test-name-pattern='미적용0057'`|SQL **소스 assertion**1 PASS, 354.7816ms, SQL 실행 아님|
|1c81b8/059fa0|`ANVIL_FN06_CAPABILITY_REPORT_DOM_QA=1 node --test tests/browser/UI11/capability-reports-dom.test.ts`, CASE 미설정|실제 Edge 6자식+부모 Node7 PASS, 8835.586ms|
|1a1ad6|`npm run build`(내부 `npm run typecheck`), `git diff --check`|type/build/diff0, 479 modules/415ms, 기존 큰 chunk 경고 보존|

DOM 번들 SHA256 `65b9ed23feb9783b57d98143a4864704dbc6e38ac1d2c20864dbb6fd4e55cec7`. 실제 Panel·부모 보존 buffer·ApiClient/native crypto를 사용하되 API는 메모리 Response 대역이다. 정상 저장/정확 조회, raw 중간입력 닫기·재진입, 유실·읽기실패 후 동일명령, 거절 후 수정, 변조/401/404 본문 숨김, 현재성 분리, 같은 인스턴스 ABA·실제 client 객체/clientId/project 교체·late JSON/native digest 뒤 POST0과 새문맥 조작 회복을 확인했다. 전체 App이나 실제 HTTP/DB 증거는 아니다. 근거는 정확 href/초기 자동 GET0까지이며 실제 파일 클릭·읽기는 미검증이다.

## 지적·오류 처리
- primitive enum 배열 우회와 공개 입력 오류코드를 실제 RED→GREEN으로 보완했다. 서버 receipt 시각 단독변조, await 중 재인증 만료도 각각 실제 반례 후 최소 수정했다.
- UI는 원주체/receipt 결박, 첫 await 이전 복사, raw JSON 보존, 명확 거절의 명시 수정, 문맥 전환 busy/lock 회복을 보완했다. native digest 시험은 깊은복사 임시 제거 시 RED를 확인한 뒤 원본 지문 복구·동일 조건 GREEN으로 검증했다.
- SQL/browser의 새 민감 regex를 **기존 검사기 자체를 바꾸지 않고** 기존3패턴과 일치시켰다. SQL UTF16/JS.trim 검산을 정합화했다. 실제 PostgreSQL 정규식/locale 동등성은 미검증이다.
- 수행자 타입 narrowing2회 및 class/test 타입 각1회, 추가근거 fixture1회, 고정시각 fixture1회는 보정 후 기록했다. Main의 잘못 추측한 후보 파일 읽기1회, 수행자의 부재 Leaf1/잘못 축약0056 읽기1회는 본문0·재시도0으로 실제 inventory 경로에 복귀했다. 동일 유효 제품실패3회는 없다. 권한·검사기준·hook 우회0.

## QA 회수·미검증·다음
등록 QA `D:/tmp/anvil-v3-stage-b/fn06-capability-report-20261030-01`은 Main 검사 직전 부재/전용 Edge0이었다. 2026-10-30T11:18:53.206Z 생성 후 약9초 내 종료, TEMP/TMP 원형 복원true/QA_EXISTS false. ce0f2f의 별도 조회에서도 전용 경로false/Edge0이다. 확인된 소유 자원만 회수했고 불명 프로세스 강제 종료는 없었다.

**NOT_RUN:** 실제 DB/SQL 해석·DDL/GRANT/RLS/COMMIT/경합, 실제 인증·권한·제품 원문 FS IO, 실제 HTTP/served, 실제 Agent/Job/키/서비스, 물리 회수 불명, 전체 App 여정·사용자 인수. 등록된 연결/실측/전체FN06·Stage·전체 계획 완료로 승격하지 않는다.

rollback은 이번 한정 source checkpoint의 정상 revert다. 실제 적용 SQL·자료 삭제·자동 down migration은 없다. 다음은 이 한정 소스를 기존 branch/private에 게시·exact SHA를 확인하고 남은 계획의 실제 공급자/승인 선행과 독립 구현 단위를 구분해 이어가는 것이다. 필수 실제 gate 미달이므로 PR/main 병합은 하지 않는다.