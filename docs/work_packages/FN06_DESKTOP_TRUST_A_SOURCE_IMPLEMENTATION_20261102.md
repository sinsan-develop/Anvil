# FN06 desktop trust A source 구현 WI — 첫 인수 단위

2026-11-02. 상태: PRE_DISPATCH_REVIEW_R2 / 제품 GO 아직 없음. 이 신규 문서 작성만 허용됐다. Main의 독립 검토·게시·명시 dispatch 후 제품 writer로 전환한다.

## 1. 승인·기준선·책임

직접 승인 `docs/04_test_reports/AV3/FN06_DESKTOP_TRUST_A_SOURCE_APPROVAL_20261102.md`, SHA256 `7B8E5A34D69D85A69FEE2AEA3F69643427B4781BF2454E8B2FA37D2EA9AA75A3`. 채택 계약 `docs/contracts/FN06_DESKTOP_TRUST_ENROLLMENT_OWNER_CANDIDATE_20261102.md` r5, SHA256 `F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6`. 후보의 당시 DRAFT는 이력이며 직접 승인이 source-only 채택 경계다. B의 별도 release 검증키는 채택하지 않았다.

승인시 제품 checkpoint `121a50c23d02ee69f6375ed799f8e68e6f11f612`, 기존 branch codex/av3-stage-b. 작성시 HEAD `27504f1bf69f71240191995df55a6944d20b9577`; 두 HEAD 차이는 승인기록/WORK_STATUS/FN16/FN17 문서 네 경로뿐이었다. 실제 dispatch HEAD/시작 SHA는 Main이 고정한다.

제품 단일 writer는 기존 Primary. Main/Reviewer 제품 동시쓰기0. 타인 dirty/untracked·보호3·원SQL·SDK/archive·역사 fixture bytes를 되돌리거나 수정하지 않는다. 새 agent/chat/branch/worktree0. docs/현황/Git/commit/push는 Main 소유다.

## 2. 첫 업무의 의미있는 완료 경계

전용 key-host source→고정 compile 입력/최종 PE·CLI·resource 검산→보호 catalogue producer/read→desktop profile/current 소비→실제 local preload/IPC/main→KEY_PENDING 선내구 기록→최대1 키생성 호출→KEY_READY 원결과 검산을 한 source 인수 단위로 한다.

codec/GET만의 미사용 slice·실제없는 source를 verified:true로 채운 wrapper는 완료가 아니다. 기존 owner helper는 entry/namespace가 달라 signer 산출물로 이름만 바꿀 수 없다. 실제 설치 profile/build receipt/보호 공급자 부재의 제품 기본값은 미등록/UNAVAILABLE이다. 명시 합성 조립은 source 호출과 순서만 검산하며 실제 publish-ready·키생성·C# parity를 증명하지 않는다.

## 3. 첫 업무 exact30 — 기존9·신규21

신규21은 실제 경로 부재를 확인했다. 이 밖 쓰기가 필수면 정확 원인/대안을 Main에 반환하고 revision 전 쓰지 않는다. 아래 목록은 이 첫 업무만이며 후속 등록/복구/native 파일을 혼합하지 않는다.

### 기존9

| 경로 | 책임 | 시작 SHA256 |
|---|---|---|
| apps/server/app.ts | catalogue read의 명시 내부 조립·기본미등록·기존 auth/route 보존 | 68FD4BA9CC6C1FCD6AE72550B6D4BFA40AE28491D657DEB12C679CA0124EDA46 |
| apps/desktop/forge.config.cjs | 고정 profile의 package 입력/복사 검산·SDK/fuses/ignore 보존 | 730BDB755C805B533DD9D642C5DFD4BB93CA2FD1B2F92A354BCAF2EBD7C1B5AA |
| apps/desktop/src/shell.cjs | createShell의 실제 owner/네 IPC·layout·현재성 조립 | DB550B57C176D2EEE85D8FBD67AEE34620660F6F2006E79D329E85A23D006FB4 |
| apps/desktop/src/preload.cjs | r5 네 trust method만 local settings에 노출 | 345828085A6895659F0957B84714A6A75791640FD5219D93EEB025E6D3B4E488 |
| apps/desktop/src/policy.cjs | exact sender/input·local bounds 순수계산·기존3동작 보존 | E0A0D700A22A34AA230955C5B50BB73CA93F2D56CC90D14EA29A4EB297383A18 |
| apps/desktop/src/settings.html | 기존 연결/종료 아래 접힘 trust·지문/상태·스크롤 영역 | F2BDA1747EDB9E0C63C8D78235F9D5D9D0D4609D196A7E2A36B62EE0C9C54F79 |
| apps/desktop/src/settings.js | 명시 클릭/버퍼·epoch·공개결과·resize 표시 | 0C25983DE82D2581E1CB4062C8FA99CC3E34F6A969EEF7EACC3726292C316698 |
| apps/desktop/src/settings.css | 접힘 등록 영역·고정 local 높이/overflow·작은 창 배치, 기존 CSP/12px 보존 | D9F420E25A1B53C67CD81BED2AFEADC0581EE73997AF77352FD4E63AD109EAC9 |
| apps/connector/native/ProtectedStore.cs | 전용 소유 entry용 최소 internal 키연산 접점·원 Main/Run/DPAPI/SIGN_PROOF 보존 | 142DDCF34FFEEE1A64C759734972BD43CC6252B972B1084327B582AE792465B6 |

### 신규21

| 경로 | 실제 책임 |
|---|---|
| contracts/runtime/desktop-runtime-catalogue-v1.ts | r5 profile/release/entry exact codec·hash/한도/관계 |
| apps/server/modules/runtime-catalogue/desktop-runtime-catalogue-source.ts | 보호 배포 원증거/bytes 검산→불변개정/CAS·회수/current |
| apps/server/modules/runtime-catalogue/desktop-runtime-catalogue-routes.ts | r5 정확 GET 하나·오류/한도·기본 미등록 |
| apps/desktop/scripts/desktop-trust-key-host-build.cjs | 전용 closure/도구/참조/cwd·FN18 부모snapshot→compile입력 |
| apps/desktop/scripts/verify-desktop-trust-key-host.cjs | 실행/load 없이 전용 PE/CLI/entry/resource·전체bytes 검산 |
| apps/desktop/scripts/desktop-trust-key-host-compiler.cjs | 원 producer→명시 단발 driver→실제 verifier·원기한/UNKNOWN |
| apps/desktop/scripts/desktop-runtime-catalogue-publisher.cjs | 원 build/검수증거·최종bytes→보호 catalogue 생산, 가짜 게시자격0 |
| apps/desktop/scripts/desktop-runtime-profile.cjs | package 전용 고정profile/parent release identity 입력·복사 |
| apps/desktop/src/runtime-catalogue-profile.cjs | 배송 runtime profile entry·저장소 기본 null/미등록 |
| apps/desktop/src/runtime-catalogue-client.cjs | 배송 CJS 검산·고정 TLS GET·원예산/current/high-water |
| apps/desktop/src/trust-key-host-client.cjs | owned child/overlapped IO·고정image/env/cwd·pending소유 |
| apps/desktop/src/trust-enrollment-owner.cjs | 실제IPC 상태기계→pendingKeyId선보관→키호출→KEY_READY |
| apps/connector/native/DesktopTrustKeyHostSource.cs | 전용 bounded entry→부모/peer/root→고정키연산·EOF/finally |
| apps/connector/native/DesktopTrustKeyParentBasisSource.cs | 정확 자기 embedded resource·purpose/namespace/parentbasis |
| apps/connector/native/DesktopTrustKeyPeerSource.cs | Windows pipe/process-instance/image/ASAR 관측·미정착보존 |
| apps/connector/native/DesktopTrustKeyRootSource.cs | KnownFolder/SID·고정root/nonlink/owner/ACL·handle검산 |
| apps/connector/native/DesktopTrustKeyBindingStoreSource.cs | r5 container/CAS/한도·pendingKeyId내구·DPAPI·UNKNOWN |
| tests/unit/FN06/desktop-runtime-catalogue.test.ts | 실제 codec/producer/buildApp read와 거절/회수·위조증거 |
| tests/desktop/desktop-trust-key-host-build.test.cjs | 실제 build/verifier/명시compiler 대역·변조/기한 |
| tests/desktop/desktop-trust-owner.test.cjs | actual preload→실IPC handler→main owner·fakeElectron/IO·KEY 상태/layout |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | 실제 C# 로직+fake관측/IO의 시험 source, compile/실행 NOT_RUN |

TS server codec과 배송 CJS 검산은 동일 r5 고정 벡터로 parity를 확인한다. desktop runtime은 server 모듈/desktop scripts/임의 TS loader를 import하지 않는다. Forge scripts제외를 유지한다. package 소유복사본에만 고정profile을 생산하고 source파일을 실제값으로 덮어쓰지 않는다. 새 dependency/도구/일반 구조개편0.

## 4. 재사용과 실제 새 producer

읽기 재사용은 `apps/desktop/scripts/verify-package-hardening.cjs:verifyPackageHardening`와 동일 원snapshot, 기존 Maker검산, `native-physical-factory-build.cjs:createCompileInput/produceCompileInput`의 비순환 입력, `native-physical-factory-compiler.cjs:runNativePhysicalFactoryCompiler`의 owned IO/120초/UNKNOWN, `verify-native-physical-factory.cjs`의 PE/CLI data판독 방식과 기존 resedit/pe-library/ASAR/fuses다. 기존 owner hardcoded entry/namespace를 범용으로 느슨하게 바꾸지 않는다.

C# 원 NativePreparationProofSource.Sign·OwnerParentBasis/Peer/Bridge·ProtectedStore 키형식은 읽기 기준이다. 새 signer closure는 실제 사용 source/namespace/reference inventory를 고정하고 /main:DesktopTrustKeyHostSource 및 /resource:Anvil.Desktop.TrustKeyHost.ParentBasis.v1,private를 결박한다. 기존 owner14를 signer closure로 가정0. 실제 의존때 추가파일 수정필요면 반환한다.

반드시 새로 생산할 것은 고정 설치 authority profile·전용 helper build/검수provenance·보호 배포catalogue/head·KnownFolder/SID/root와 metadata내구성·main등록조립이다. constructor/일반파일hash·connect URL·project HUMAN/Agent명령이 이producer가 아니다. 실제배포주체/원receipt 공급자가 없으면 미등록을 유지한다.

## 5. 실제 source 연결 순서

1. profile producer는 승인 설치/build 입력의 고정 publisher/profile/origin/TLS·parent release identity를 결박한다. 실제 설치 provenance 부재면 profile null. profile에 미래helperhash를 넣지 않는다.
2. 실제 FN18 부모snapshot을 먼저 고정하고 새 resource/compile 입력을 만든다. source/tool/reference/cwd를 원입력hash에 묶고 실행 전후 검산한다. 동일 closure/id/version에서 다른bytes 재발행0.
3. 명시 단발 compiler driver→최종 helper PE/CLI/resource/전체hash 검산. 실제 driver 기본 미연결. fake process는 MODEL_ONLY이며 actualbuild/검수 receipt로 승격0.
4. publisher는 보호 build/검수 **원행**·정확inventory/bytes를 교차검산한다. caller JSON/actual:true/모양맞는fullref는 게시자격이 아니다. private 원context·receiver·수명/현재원행으로 결박한다. model evidence는 합성 조립에만 쓰며 제품 upstream이나 배포가능을 발급하지 않는다.
5. server source는 immutable snapshot/hash/sequence/previousRef·parent/role·기한/한도를 검사한다. 게시/개정/회수는 배포담당 경계 CAS이며 프로젝트 정책/command·공개write route0이다. buildApp 명시 source없음은 기본미등록. 서비스 actual등록0.
6. GET `/api/v1/runtime-catalogue/desktop-trust/v1/:profileId/:parentReleaseId`만 제공한다. 성공 DTO는r5그대로·cookie/credential/query/body/임의path0. 없는profile/parent·unknown값·부재producer는 고정오류/비밀없는실패이며 빈성공/가짜entry0.
7. desktop client는 고정profile의 systemchain/hostname/TLSv1.2이상/rejectUnauthorized/agentfalse·redirect/retry0·2MiB/64entry/24시간/entry16KiB를 검산한다. parent실관측·고정role/fileName/helper전체bytes·high-water/current를 대조한다. projectorigin으로publisher교체0·같은sequence다른hash/낮은개정/회수/오래된캐시 거절.
8. 명시 trust-begin은 별도epoch/정확sender→catalogue현재성→전용ownedhelper startup/peer/root→보호metadata current를 대조한다. metadata/high-water조회는키연산보다먼저다. 실제근거없음은KEY_PENDING/키호출0이다.
9. main pendingKeyId→KEY_PENDING sync/readback/CAS 성공→CREATE_KEY 최대1→동일ID/P256/SPKI/지문·원image/current/budget 검산→KEY_READY내구보관. 생성/보관불명은원ID UNKNOWN·자동같은ID/새ID키생성0. renderer응답은공개지문만이다.
10. close/epoch회수는진행권위폐기이며 원pending/UNKNOWN을지우지않는다. 미정착IO의lease/handle/buffer는정착까지보유하고늦은결과성공채택0. 실제C#실행/실키생성은미수행이다.

## 6. local IPC/UI·주입·레이아웃

r5 trust-status/trust-begin/trust-pair/trust-act 네exact원형만 노출한다. 첫단위 status/begin/CLOSE를 실제 소비하고 pair/ISSUE/RESTORE_VERIFY는미구현사유로닫는다. 기존get-state/connect/client-quit의반환/의미를보존한다. localSession/remoteSession분리·remotepreload0·localCSP connect-src none·Node비활성/격리를유지한다.

시험은 **실제 preload 등록함수→실제 ipcMain handler→main coordinator**를 fakeElectron에 연결한다. 복사handler/합성부모/웹UI00fixture로대체0. `tests/desktop/fixtures/qa-main.cjs`는참고만, `shell-electron-qa.cjs`는실Electron/프로세스/QA이므로실행금지다.

createShell의현재fs/userData읽기를시험에서실제호출하지않도록한정내부IO포트를주입한다. 제품기본기존동작을유지하고명시시험대역누락시실FSfallback하지않는다. actual source함수를통과하되새외부주입API/일반fswrapper개편0. profile/current/ownedchild도모든시험에서명시대역만쓴다.

main 별도 trust epoch는 origin ABA·remoteView교체·인증관측변경을계속추적한다. 매await/새IO직전/응답/finally에서동일epoch·포트·origin을검사하고옛finally가현재latch를변경하지못한다. connect/quit/beforeunload거부/닫힘UNKNOWN·창닫기숨김과trustCLOSE를구분한다. origin편집buffer를상태응답으로덮지않고취소quit은IPC0이다.

remote y128고정으로새폼을가리지않는다. 새치수IPC/renderer좌표권위0. main 소유 view요청상태와phase로고정local높이를예약한다. 접힘기본은128px안의시작/열기버튼만, 명시trust-status로local영역을열때는IO0·키0이며main내부표시상태만갱신한다. IDLE/UNAVAILABLE/RESTORE요약은상한320px, KEY진행/KEY_READY/UNKNOWN폼은상한520px, 항상 `localTop=min(예약상한,max(128,contentHeight-160))`로remote y/height를계산한다. CLOSE는표시접힘을허용하되원pending/UNKNOWN삭제0이다.

local신뢰폼은기존연결/종료128px아래부터localTop까지overflow:auto,작은창은스크롤로접근한다. settings의같은phase/resize계산과main setBounds가대표창/최소창에서일치함을검산한다. 접힘을열기만해서begin/network를자동호출0. 실제DOM클릭/effect와fakeElectron bounds·포커스/스크롤호출을대조한다. 텍스트존재/SSR로실제화면PASS0. 실Electron pixel/hit-test·시각/접근성인수는NOT_RUN이다.

## 7. 시간·UNKNOWN·키/저장 보호

build/compiler는원120초와더짧은기한, runtime명시요청은총10초와profile/catalogue/lease최소기한을min-only로유지한다. 같은요청의helper/exchange/await에서새window0. 고정wall상한·동적단조remaining·clock후퇴거절, 각source/FS/currentawait뒤와키호출전후의현재성재검산을지킨다.

원SIGN_PROOF와DPAPI형식·nativecanonical8을보존한다. rawDEK/credential평문getter·범용서명0. root/키/ACL코드는작성하되실호출0. r5container/CAS/한도·포화회수기록거절·원행조회·lock탈취0·자동삭제/권한수리0를보존한다. 실제antirollback/TOCTOU/OS전체주입방어를source만으로PASS하지않는다.

키응답유실후원pendingKeyId보존·자동재생성0. 전송/COMMIT/저장/종료불명은UNKNOWN이며자동retry0. 미정착open/write/read/childcallback의실정착전handle반환/close/release0,늦은query/후속키효과0이다. 필요최소정리와진행권위만료를구분한다. 원자료/기존키자동삭제0.

## 8. TDD·명령·실제검증 한계

의미있는첫RED는기존buildApp의실route부재/거절 또는actualIPC/main의생산행동누락이다. module/loader부재·JSDoc/fixture준비는별도다. 제품역패치로억지RED0.

정상합성은actualbuild입력→명시fakecompiler→실PE/CLI검산→모델보호원행/최종bytes→actualproducer/buildApp.inject→actualdesktopclient/preload/handler/owner→명시fakechild/store→pending선저장/CREATE1/KEY_READY까지다. fakeC#상대를C#실행이라부르지않는다.

필수음성: wrongprofile/parent/role/hash/resource·초과/duplicateJSON·동일id/version다른bytes·source/tool/parent변경·위조buildreceipt/fakecompile게시0, current회수/후퇴·late/abort/clock/최소기한, sender/ABA/동시requestId·원latch회복, pending내구실패key0·키응답불명추가key0·저장실패원행보존, root/link/SID/ACL불명, import/constructorIO0·기본미등록, Secret/경로노출0,실제layout와기존연결/종료/beforeunload보존이다.

실제 dispatch 뒤 정확 기본 명령(지금 미실행):

```powershell
node --test tests/unit/FN06/desktop-runtime-catalogue.test.ts
node --test tests/desktop/desktop-trust-key-host-build.test.cjs tests/desktop/desktop-trust-owner.test.cjs
node --test tests/desktop/shell-policy.test.cjs
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json
git diff --check
```

기존키생성/실서비스 integration시험은NOT_RUN. 새키/실FS/native를필요로하는기존fixture는무단수정0. C#testsource는실로직+fake관측을작성하지만compile/실행은NOT_RUN이며NodePASS로parity대체0. 배송runtime의server/scripts import0·기존Forge SDK/fuses보존을정적검사한다. 새모듈설치/전수native서버/UI/App/journal/HTTPS반복0이다.

기존FN18 getCurrentFuseWire/getRawHeader는memoryio밖실FS를읽는다. actualFN18정상을fakeverifier true로대체0. 지금새QA생성0/기존회수root재사용0. 필수라면시험준비뒤literal새root·owner·filecount/bytes·최초TTL/정리계획을Main에반환하고별도사전등록GO전생성0. 실제FN18통합NOT_RUN을메모리PASS로덮지않고Main인수범위에서분리한다. 실compiler/PE/helper실행은QA등록과도별개로계속제외다.

## 9. 같은 승인 안의 후속 순서 — 첫30와 혼합 금지

첫단위검수뒤Main이정확후속WI로연결하며같은source계약재승인질문으로대기하지않는다.

1. 등록/HUMAN/ISSUE: projectIdHint/원ID/code→고정HUMAN GET→enroll/prove→UI11별도확인→명시ISSUE→StatusOnly보관. 원REJECTED/fullref·UNKNOWN/등록기한null보존. cookie export/일반fetch0.
2. 명시재시작복구: 원pendingKeyId PUBLIC만·HUMAN current·원키/등록/세대·container/CAS/한도. ISSUE_PENDING/UNKNOWN자동발급0·StatusOnly실사용복구미구현경계유지.
3. native mapping/exchange: 현재등록/지문/profile↔원localkeybinding→기존typed signer privatecontext→보호entry Sign→원P256검산. 원10초/minexpiry·consume뒤ticket순환0.
4. actualmain부모의UI11왕복/발급/복구/native합성전체소비. 실제설치provenance/키/OS/컴파일/서비스/Agent지원은계속별도NOT_RUN이며전체FN06/계획완료아님.

첫KEY_READY를전체등록완료라표시0. 후속단계를임의제외하지않고첫단위미구현행동은UNAVAILABLE로닫는다.

## 10. 동결·검수·실패·제외

제품/시험writing은명시dispatch뒤정확30에만. 실제키/보호파일/ACL·DB/권한·서비스·OS/helper/native/컴파일/Agent·실자료/P03R3·QA생성·새dependency는지금금지다. 문서작성은이WI한개뿐이다.

의미있는경계에서exact파일/SHA·명령exit/정상/음성·준비오류/원인별실패·livehandle/QA·남은supplier를반환한다. 부분동결후검수중동일파일쓰기0. 같은근본정식실패3회는추가수정/실행중단·FAILURE_REPORT/정확30지문·원pending자원·writer반환이다.

최종은실제변경/미사용30·rawSHA/줄끝·diff·기본미등록/실publish·키·OS·compile·DB·서비스·사용자인수NOT_RUN을구분한다. Mainfresh선정/type/diff와Reviewer독립C/I후Main통합한다. 개발자COMPLETED는자동수용이아니며commit/push는Main소유다.

## 11. r2 비의미 작업지시 보완

부모 WI SHA256 `7F634F9C0AB542AD566B6B2BE6B731D36F6C6A7AF4051777E003AD5AEB120415`의 Main/독립 predispatch C0/I1은 settings.css 허용 누락이다. Main은 기존 CSS 한 경로를 추가해 기존9+신규21=정확30으로 바로잡았다. 접힘/스크롤/작은 창을 기존 style-src self 안에서 구현하는 기술 보완이며 승인 r5의 기능·공개 계약·보호 범위·실행 제외는 바꾸지 않는다. 새 승인 요청은 필요 없다. 관련 시작 SHA는 위 표와 같다.

git diff 명령의 설명용 placeholder는 실제 실행 가능한 `git diff --check`로 정리했다. Main은 별도로 실제 제품/시험 변경 경로가 위30 안에만 있는지 검산한다. 독립 scoped 확인 후 Main의 명시 dispatch가 제품 GO다. 그 전 제품·시험 쓰기는 계속0이다.
