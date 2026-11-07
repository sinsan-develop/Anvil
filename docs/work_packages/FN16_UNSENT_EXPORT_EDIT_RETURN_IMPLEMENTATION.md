# FN16/UI14 미전송 반출 준비 해제·편집 복귀 구현계획

> 현재는 문서2만 작성한다. Main 독립 preflight→TEST_ONLY→Main fresh RED→제품 GO를 순차 적용한다. superpowers:executing-plans의 단계별 증거 기록을 참고하되 별도 작업영역/Git/실환경 실행을 만들지 않는다.

**목표:** 서버로 한 번도 전송하지 않은 본인의 현재 반출 준비만 명시 확인 뒤 해제하고 원선택·이유 입력으로 돌아간다. 이미 시도/불명/승인/확정 상태는 기존대로 보존한다.

**구조:** 기존 `project-backups-api.ts`의 내부 단발 전이 근거와 `ProjectBackupsPanel.tsx`의 명시 확인 동선만 보완한다. App의 현재 CAS/store callback은 그대로 소비한다. 일반 merge/null 거절을 느슨하게 바꾸지 않는다. 서버 취소 명령·POST·새 공개 API/저장 계약은 없다.

**기술/화면:** 기존 React/TypeScript·App 메모리·same-origin API·기존 CSS와 기본 12px. 기존 Operate 화면의 작은 흐름 보완이며 새 공통구조/테마/설정/컴포넌트 파일을 만들지 않는다.

## 기준과 지금 단계

Main 지정 base `ff429762`의 기존 `codex/av3-stage-b`를 기준으로 하며 Main status dirty1은 Main 소유다. 작성자 Git/status/WORK_STATUS·게시0, 보호12 유지. 이번 구현계획 준비는 제품/시험 GO가 아니며 현재 문서2 외 변경·시험·QA/환경 생성0이다.

기존 승인 `docs/work_packages/FN16_SELECTED_ARTIFACT_EXPORT_IMPLEMENTATION.md`의 UI14 동선은 문서/고정 버전/원본 선택→이유·동의→준비 POST0→별도 명시 전송이다. 같은 WI §UI는 App이 actor/client/project·원 command/body/API/transport/CSRF를 결박하고 미확인 명령을 보존하도록 한다. `docs/work_packages/FN16_EXPORT_ONE_TIME_APPROVAL_IMPLEMENTATION.md`의 명확412 이후 일회 승인/원명령 소비와 UNKNOWN 보존은 그대로다. 새 반출/권한/정책 의미가 아니라 미전송 local 준비의 편집 복귀 소비 누락을 보완한다.

현재 API `mergeExportPending`은 receipt 없는 old에서 next=null을 거절한다. panel은 work가 있으면 fieldset을 잠그고, 닫기 버튼은 receipt가 있을 때만 제공한다. 따라서 준비만 한 사용자는 이유/선택을 고치러 돌아갈 수 없다. 이 거절을 전체 삭제 허용으로 바꾸지 않는다.

## 정확 허용7

| 구분 | 경로 | 허용 단계 |
| --- | --- | --- |
| 신규 WI | `docs/work_packages/FN16_UNSENT_EXPORT_EDIT_RETURN_IMPLEMENTATION.md` | 지금 |
| 신규 manifest | `docs/work_packages/FN16_UNSENT_EXPORT_EDIT_RETURN_SOURCE_MANIFEST.json` | 지금 |
| 기존 제품 | `apps/web/src/features/backups/project-backups-api.ts` | Main fresh RED 뒤 제품 GO |
| 기존 제품 | `apps/web/src/features/backups/ProjectBackupsPanel.tsx` | 동일 |
| 신규 unit | `tests/unit/FN16/unsent-export-edit-return.test.ts` | 실제 부재 확인. TEST_ONLY 뒤 |
| 기존 browser | `tests/browser/UI14/project-backups.spec.ts` | TEST_ONLY 기대 보강. 실제 실행은 별도 QA GO |
| 신규 결과 | `docs/04_test_reports/AV3/FN16_UNSENT_EXPORT_EDIT_RETURN_RESULT.md` | 실제 부재 확인. Main 검증 뒤 별도 지시 |

`apps/web/src/App.tsx`는 읽기 전용이다. 현재 changeExport는 동기 store의 old→merge→삭제 CAS를 수행하며 별도 App 수정 없이 내부 근거를 검증할 수 있다. 필수 변경이 드러나면 실제 근거·최소 표면을 Main에 제안하고 승인 전 수정하지 않는다. 기존 server/SQL/정책/권한/다른 시험/공유 API/환경·제품 파일 추가0이다.

## 해제 자격·정확 객체 결박

다음 조건이 **모두** 현재 true일 때만 미전송 해제를 명시 확인할 수 있다.

- 실제 `prepareExport`가 반환해 현재 App store에 들어 있는 **동일 old 객체**다. bindingId/body/그럴듯한 필드를 복사한 위조 객체는 근거가 아니다.
- dispatchState가 미설정, command.approvalRef=null, receipt=null, accessLost가 true 아님, approvalRequest가 없음이다. UNKNOWN/REQUIRED/BOUND 및 승인 준비·결박/전송 이력은 해제하지 않는다.
- 동일 actor/client/project/API 인스턴스/transport/CSRF와 현재 local+App ExportScope, 실제 live buffer identity가 일치한다. 주체/client/project/CSRF/transport 변경·ABA·unmount·늦은 JSON 뒤의 근거는 사용하지 못한다.
- busy=false이고 실제 flight/lock이 없다. 전송·준비·조회/응답 대기 중에는 확인과 해제를 잠근다.
- 사용자가 미전송 준비 해제 확인을 명시하고, 확인 직전에도 위 조건을 다시 검사한다. 새 buffer가 이미 들어왔다면 기존 입력·명령을 그대로 둔다.

최소 내부 방법: 실제 prepareExport가 만든 객체만 기록하는 WeakSet/WeakMap과 현재 old 객체에 결박된 단발 release proof를 같은 API 파일 안에서 관리한다. 임시 이름 `prepareUnsentExportRelease` 등의 내부 함수가 선택/이유 입력과 제한된 해제 근거를 만들 수 있다. 일반 직렬화 필드/사용자 boolean으로 해제권을 만들지 않는다. proof에는 현재 scope 검사와 정확 old identity를 결박하고 merge에서 사용 여부를 한 번만 소비한다.

기존 markExportDispatch가 old를 UNKNOWN으로 전이시키는 즉시 old prepared 객체의 모든 이전 해제 근거도 무효화한다. old proof를 갖고 있어도 새 UNKNOWN 객체·같은 binding의 복사본·새 buffer·다른 context에 사용할 수 없다. 기존 함수가 반환한 적 없는 위조 pristine 객체에도 발급하지 않는다. merge의 보통 `(old,!receipt,next=null)` 거절은 유지하고, 유효한 명시 단발 전이만 예외 통로로 확인한다. 일반 merge 호출·잘못된 expected·재사용 proof·stale proof는 old 그대로다.

App의 onChange(old.bindingId,null)는 그 내부 단발 근거가 성공적으로 확인된 경우에만 삭제를 허용한다. 실제 parent가 가진 old가 바뀌면 CAS는 실패하고 panel은 입력 복귀를 수행하지 않는다. 기존 exportTransitions의 승인/불명 전이·receipt 단조성과 old CSRF 전송 잠금은 그대로다.

## 정확 UX·remount의 원선택 보존

1. 기존 원명령 영역에 자격이 있을 때만 “미전송 준비 해제·편집” 동작을 제공한다. 누르면 원문 전송 전 준비만 해제한다는 작은 확인 영역을 열고 “해제하고 편집으로 돌아가기”/“준비 유지”를 제공한다. 열기·취소·확인 모두 POST0·서버 취소0이다. busy/UNKNOWN/REQUIRED/BOUND/403 접근상실/문맥 불일치에서는 해제하지 않는다.
2. 확인 취소는 같은 command/body/binding/선택/이유를 그대로 유지한다. 확인은 단발 proof와 App CAS가 성공한 뒤에만 work를 제거한다. CAS 실패·이미 다른 buffer·스코프 변화 때는 원명령을 보존하고 다른 입력을 덮지 않는다.
3. command.payload의 정확 selection.documentRef/artifactRef와 원문 reason은 해제 뒤 보존 입력으로 복원한다. 제목·DocumentSummary·artifacts 목록·sourceAvailability/READY·새 hash를 합성하지 않는다. 기존 body/hash/원 command를 새 명령에 재사용하지 않는다.
4. **모든 해제 후** resolved document를 비우고 consent=false로 만든다. 원선택 ID/version/artifact/full hash와 이유를 보존 입력/요약으로 보여 주고 “이전 선택 · 원문 재조회 필요”를 명확히 표시한다. select가 remount 뒤 목록0이라면 별도의 기존 선택 표시 option/metadata만 제공하며 이를 실제 문서 목록 행이나 검증된 원문으로 만들지 않는다.
5. 사용자가 명시적으로 기존 문서 목록 GET과 고정 버전 GET을 수행해야 새 준비를 할 수 있다. 같은 component에서 문서 목록이 이미 적법하게 관측됐다면 그 목록으로 버전 GET을 다시 선택할 수 있으나 원문 재검증/재동의는 생략하지 않는다. remount에서 목록도 없다면 먼저 문서 목록을 다시 조회한다. 자동 GET/POST0이다.
6. 기존 API exportDocument의 실제 hash/고정 버전/첨부 대조 후에만 document 상태를 채운다. 보존한 이전 선택을 다시 쓰는 경우 document fullref와 artifact fullref가 정확히 일치해야 하며 변경/격리/403/실패는 입력을 보존하고 새 준비를 막는다. 다른 문서/버전을 명시 선택하면 기존 편집 동작대로 선택을 바꿀 수 있다.
7. 원선택을 직접 확인하고 이유를 편집·재동의한 뒤 새 “반출 명령 준비”를 누르면 기존 prepareExport가 새로운 commandId로 준비한다. 같은 전송 명령 재확인이 아니며 준비 POST0/별도 전송 원칙을 유지한다. 기존 전송된 원명령은 이 동선으로 버리지 않는다.

remount 전에 준비가 App에 보존된 경우 그 원 객체/선택/이유로 이 흐름을 검증한다. 해제 뒤의 아직 다시 준비하지 않은 일반 local 입력은 기존 화면 입력 수명과 같으며 새 영구/App draft store를 만들지 않는다. 페이지 전체 reload 후 메모리 복구 한계도 기존대로다.

UI 수정 직전 `C:/Users/cyhuh/.codex/skills/impeccable/reference/craft-floor.md`를 읽고 기존 CSS·간결한 버튼/확인 영역·기본12px·명확한 focus/disabled/상태표시를 따른다. planning-only 단계에서 craft-floor/UI/런처·PRODUCT/DESIGN 생성은 하지 않는다. 이번 문서에서는 impeccable의 기존 화면 보존 원칙만 참고한다.

## 필수 RED/회귀 명세

신규 unit은 실제 prepareExport의 가짜 GET/현재 제어 관측으로 발급된 객체를 사용한다. 입력 객체를 직접 만들어 양성과 helper가 같은 오류를 공유하게 하지 않는다. 정확 자격/일회/동일객체·markDispatch 전이와 merge/CAS까지 직접 대조한다.

- 정상 pristine 동기 해제·취소 유지·generic merge null 계속거절·원선택/이유 exact 보존·POST0.
- 위조/복사/같은 bindingId/body 다른 객체와 prepareExport 미발급 객체의 근거 거절.
- proof 발급 뒤 markExportDispatch→UNKNOWN, old proof 재사용/원 객체 복귀 시도 모두 해제 불가.
- receipt/accessLost/approvalRef/approvalRequest·UNKNOWN/REQUIRED/BOUND·busy/flight·active=false와 actor/client/project/API/transport/CSRF 변경·ABA·이미 새 buffer가 된 CAS 거절, 원명령 불변.
- 해제 후 재조회·실제 hash/artifact 대조/재동의 전 새준비 불가, 늦은 JSON/hash가 이전 document를 되살리지 않음.

기존 browser spec의 실제 App에 최소 흐름을 보강한다. 신규 준비→해제 열기/취소/확인→원선택/이유 복귀·consentfalse/검증 원문 숨김→명시 재조회→수정 후 새 command 준비 POST0; 준비 상태 settings 왕복/remount→같은 metadata 복귀/원문 재조회 요구; send in-flight/LOST/승인 필요·결박/권한 거절·주체/CSRF 변경에서는 원명령/body 유지·해제 불가; late 응답/새 buffer CAS도 보존한다. 기존 인증 입력/receipt와 후속 실패·실제 반출 링크/승인 회귀 기대는 유지한다. 기존11 브라우저 흐름을 모사해 임의 timeout/skip을 늘리지 않는다.

## 실행·QA 단계

- [ ] 문서2/hash/허용경로/원raw를 Main에 제출한다. 지금은 여기까지다.
- [ ] Main 독립 preflight 후 TEST_ONLY GO에서 신규 unit1과 기존 browser1 기대만 작성한다. 제품2는 Main fresh RED 전0이다.
- [ ] 첫 unit 동결 hash/정확 명령·기대를 Main에 즉시 제출한다. Main fresh RED를 제품 GO와 분리한다.
- [ ] 제품 GO 뒤 API/panel2만 최소 구현하고 신규 unit/type·필요 직접 기존 export-approval-api 회귀만 기본 확인한다. App/CSS/server/SQL 쓰기0이다.
- [ ] browser 실제 실행은 Main이 **새 전용 QA 경로·owner·수명·정리·현재 부재**를 사전등록한 뒤 별도 한정 GO에서만 수행한다. 기존 QA root/profile을 재사용하지 않는다. 현재 실제 실행에서 old QA를 재사용할 수 없다. 다만 기존 install의 old 등록 literal/기존 시험 경로는 보존하고 Main이 등록한 새 exact QA의 bundle literal1개만 닫힌 허용목록에 추가하는 test-side 변경을 TEST_ONLY 범위에 포함한다. 새 config/harness/패키지를 임의 만들지 않는다.
- [ ] Main fresh unit/type·실제 App 한정 DOM/브라우저·독립 source 검수 후 허용 결과1에 증거와 한계를 기록한다. 필수 finding은 같은 범위로 보완하되 기대를 낮추지 않는다.

향후 unit/type 후보(현재 실행0):

```text
node --test --test-reporter=spec tests/unit/FN16/unsent-export-edit-return.test.ts
node --test --test-reporter=spec tests/unit/FN16/export-approval-api.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

browser 명령/환경변수/새 exact 자원은 Main 등록 후 원 확인 명령으로 고정한다. 현재 spec의 install은 `ANVIL_UI14_EXPORT_QA_DIST`와 기존 등록 literal을 검사한다는 사실을 보존하며 이 문서가 그 옛 자원 재사용을 승인하지 않는다. 실제 QA 전 별도 실행결정이 필요하다.

## 원raw·오류·미검증·rollback

baseline은 manifest에 고정한다. api raw `44616FC8333850878292650726C812F7C620EA3BC4ED0E5DDDE1EF782B7EE058`, panel `0359A536CC54385888C6AE7537E7BC6FE4D4BA236259F23084765E054FADCBAF`, browser `47E4335606928315C538F6AF9F250E32D34D423509E6A0F5B3EB5539A0F28764`, 읽기 전용 App `0694CB2794446EFD35AD2A9C080012E71ED4DFFC465AF6ACBB85B0BD042C65F7`이다.

읽기 조사 오류1: NotificationScope를 잘못 지정한 `apps/web/src/features/notifications/project-notifications-api.ts` rg는 “지정된 경로를 찾을 수 없습니다”로 끝났다. 실제 API import `../../notifications/project-notifications-api.ts`에 따라 `apps/web/src/notifications/project-notifications-api.ts`를 읽어 bind/ticket/current를 대조했다. 파일/환경 영향0이고 제품 또는 정식 FAILURE_REPORT 횟수로 세지 않는다.

미검증: 실제 사용자/권한·DB/SQL·반출 파일·정식 served·운영/Agent·사용자인수·전체 FN16/UI14/계획. 새 사용자 취소 API/서버 상태·실반출·정책 집행·P03 actual 작업은 이 동선에 포함하지 않는다. source rollback은 Main이 정확 제품2/신규시험1/browser 보강/문서의 소유 변경만 선택 복구하고 기존 UNKNOWN/승인·receipt·보호자료를 보존하는 것이다. 보관 반출본·서버 자료 삭제/실행 취소·환경 복구 명령은 없다.

## Main QA 후보 경로 보충

Main ea77a3은 새 전용 QA 후보 `D:/tmp/anvil-v3-stage-b/ui14-unsent-export-edit-return-20261028-01`을 선정 검토 중이다. owner `SINSAN\cyhuh`, 최대30분·생성 전 등록/부재/정상 회수 책임은 Main이다. 아직 등록·부재확인·생성·실행 GO가 아니다. browser install의 기존 `D:/tmp/anvil-v3-stage-b/ui14-project-artifact-export-20261027-01/bundle` 검사는 보존하고, 확정 후 새 `D:/tmp/anvil-v3-stage-b/ui14-unsent-export-edit-return-20261028-01/bundle` exact literal1만 추가한다. 임의 env root/범용경로/무경로 fallback은 허용하지 않는다.
