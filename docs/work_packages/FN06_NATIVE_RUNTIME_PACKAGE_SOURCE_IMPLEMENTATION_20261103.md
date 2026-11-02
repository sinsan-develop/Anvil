# FN06/FN18 NATIVE-RUNTIME-PACKAGE-01 — 고정 native proof runtime 배송 소스 WI r1

2026-11-03. PRE_DISPATCH_REVIEW. 독립 사전 검토·기존 Primary 수행가능성 확인·Main 게시/명시 배정 전 코드 GO0.

## 근거·논리 업무

WORK_PLAN FN06/FN18, FUNCTION_WORK FN06, 설치형 기존 source-only 범위. 직접 승인 native r2 A 계약5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085와 trust r5 A 계약F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6를 유지한다. LIVE-NATIVE 코드08e6cde5/결과64271DF0 뒤 기존 branch codex/av3-stage-b의 기준 ed4448f109dba43aa59e8aa6ffc73b7bf1d81f85에서 이어간다.

현재 owner.createNativeProofSource는 checkout 상대경로의 TS signer/HTTPS/authority를 require한다. Forge는 apps/desktop만 포장해 이 소비선이 패키지에서 누락된다. **원 source closure를 하나의 CJS runtime으로 묶어 Forge 복사 접점에 포함하고, owner와 원 REGISTERED 통합 소비가 같은 exports/WeakMap instance를 쓰게 하는 하나의 업무**다. wrapper/파일 존재만으로 완료하지 않는다. 보호 current/profile·NativeOnly 전달/ACK·owner bridge/file journal 전체 배송·실제 native/Agent 연결 완료는 이 업무 범위가 아니다.

PMO turn01a19d4b-0e0d-7a70-94c2-8c0a345a81eb는 고정 Vite write:false 메모리 JS/TS CJS 생성·검사를 기존 source 개발 검증으로 확인했다. 추가 승인 불필요이며 r5의 실제 C#compile/helper/OS 제외를 JS/TS build 금지로 확대하지 않는다. **실제 파일 산출·설치·Electron/C#·키/권한/DB/서비스/Agent/실자료·실QA FS/P03R3 실행은 계속0**이다. 복구 bootstrap43EBD866은 미채택·별도 직접결정 대기를 유지한다.

## 정확 허용6

| 경로 | 상태·시작 SHA256 |
|---|---|
| apps/desktop/src/trust-enrollment-owner.cjs | 기존 6D4913E51711B3F3C10F33DB98C5CECBA5691266CFD8A2CDC3D2E307CB2E32EA |
| apps/desktop/scripts/desktop-runtime-profile.cjs | 기존 4F1A710856E640519ADDA3AC621CCB7C3805DC65FA5263874EAD4671090860CD |
| tests/desktop/desktop-trust-registration.test.cjs | 기존 0FD9D7EC9B071755CDC8BD810E0BF04891186C952B0D00D16340830C6C08AA11 |
| apps/desktop/scripts/native-proof-runtime-entry.ts | 신규·생성 전 부재 확인 |
| apps/desktop/scripts/native-proof-runtime-build.cjs | 신규·생성 전 부재 확인 |
| tests/desktop/native-proof-runtime-build.test.cjs | 신규·생성 전 부재 확인 |

기존 Primary 단일 code writer, Main 문서/Git/검수, Reviewer 읽기만. Main은 writer가 가진6 수정0. 새 agent/chat/branch/자동화·의존성·lock/Forge config·기존 connector TS 수정0. 보호 untracked3/기존 fixture/타인 변경 보존. 추가 경로가 필수면 이유/최소대안을 반환하고 WI revision 전 쓰지 않는다. 코드/시험 소스 생성은 허용하되 runtime 산출물이나 FS QA를 실제 디스크에 생성하지 않는다.

## 고정 closure·exports·빌드

신규 entry와 아래 **기존11 runtime source만** 입력 closure로 고정한다.

1. apps/connector/runtime/native-preparation-client.ts
2. apps/connector/runtime/native-preparation-credential-slot.ts
3. apps/connector/runtime/native-preparation-factory-consumer.ts
4. apps/connector/runtime/native-preparation-https.ts
5. apps/connector/runtime/native-preparation-local-attempt.ts
6. apps/connector/runtime/native-preparation-proof-signer.ts
7. contracts/canonical.ts
8. contracts/runtime/native-preparation-authority-v1.ts
9. contracts/runtime/project-writer-authority-v1.ts
10. contracts/runtime/source-scope-v1.ts
11. contracts/runtime/validation-v1.ts

entry의 exact6 exports는 NativePreparationClient / NativePreparationCredentialSlot / NativePreparationHttpsChannel / NativePreparationProofSigner / restrictNativeProofSigningContext / readNativeAuthority다. signer와 HTTPS signingContexts registry는 같은 생성 module instance를 공유해야 한다. 시험에서 checkout TS 직접 import로 이 class/registry를 섞지 않는다. 정적 codec fixture는 원 bytes와 검산을 보존한다.

- 기존 설치 Vite8.3.4/고정 lock만 재사용. 신규 설치/프로세스 spawn/외부 조회0. configFile:false, envFile:false, envDir:false, publicDir:false, build.write:false, 단일 cjs·Node24 target·minify:false·sourcemap:false·단일 entry·split chunk/asset0. 기존 사용자 vite/env/config/plugin을 탐색·소비하지 않는다.
- 실제 resolve/load graph의 regular/nonlink/고정 realpath source가 exact12(entry+11)인지 대조한다. 입력 합계2MiB, 출력 UTF8 code2MiB, 출력 chunk1/asset0, 빈/오염/외부 상대경로·잔여TS·동적 import와 예상 밖 graph는 거절한다. runtime 외부 의존은 exact node:crypto/node:https뿐이며 패키지 dependency를 외부 require로 남기지 않는다.
- builder import/함수 정의만으로 build·FS쓰기·네트워크0. build는 명시 호출 시 메모리에만 반환한다. 미해결 build 실패/불명은 빈 runtime/가짜 exports로 통과시키지 않는다. 산출물은 실패면 폐기하며 자동 재시작/재전송0이다.
- Vite API 공식 근거: https://github.com/vitejs/vite/blob/v8.3.5/docs/config/build-options.md 및 docs/guide/build.md의 build.lib.formats/rolldownOptions. 실행 대상은 실제 고정8.3.4이며 최신 문서가 설치 버전을 바꾸는 근거가 아니다. 설치 타입/기존 memory build 사용법을 함께 대조한다.

## 원 Forge·owner 소비

1. 기존 fixedDesktopTrustForgeHooks.packageAfterCopy가 원 hook/플랫폼 검사를 유지하며 copy root의 **src/native-proof-runtime.cjs 한 파일**을 준비하는 코드로 연결한다. profile 기본 부재/기존 보호 producer·postPackage hardening·ASAR 무결성/fuses는 완화하지 않는다.
2. 완성 ASAR·checkout·전역 임의 위치를 사후 patch하지 않는다. 실제 쓰기 어댑터 source는 정규/단일 link/realpath copy root와 고정 src 디렉터리, 신규 목적 파일/전용 임시 파일만 사용한다. 기존 파일/링크가 있거나 hash/경로/현재성이 달라지면 덮어쓰지 않고 실패한다. 검산/원자 저장/원바이트 재조회가 있는 코드로 구현하되 이번 실행은 메모리 IO 대역만 사용한다.
3. owner는 ./native-proof-runtime.cjs를 명시 private REGISTERED source 조립 때만 require한다. checkout·환경변수·CLI·사용자 경로 fallback0. 기본 미등록 호출은 산출물 로드/IO 전에 기존 원오류로 거절한다.
4. 실제 산출물의 exports를 원 owner와 REGISTERED→Client/slot/HTTPS→typed signer→owned helper 합성 종단에서 소비한다. fixed bundle module instance 하나를 사용하며, 별도 bundle instance context 혼합은 helper0으로 거절해야 한다. CJS 번들 로딩은 기본 import 시 네트워크/키/FS/Agent0이어야 한다.
5. 전체 desktop 실제 배송/설치 검증은 NOT_RUN이다. 이번 검수는 원 bundle code의 메모리 생성·실제 exports 실행 및 메모리 Forge copy IO 소비만 증명한다.

## TDD·검수·제출

- 먼저 실제 checkout 소비 누락/기존 고정 hook 미연결을 source/메모리 반례로 RED 확인한다. 준비 오류와 제품 결함을 구분한다.
- 정상: 실제 고정 Vite write:false 산출물 하나 생성→허용 builtin만 있는 CJS loader로 import→원 registered producer/원 context/sign/key 검산/consume/factory1 메모리 종단, Forge hook의 고정 위치 복사/원 hook·기본 profile 미등록 보존을 확인한다.
- 음성: graph 외 파일/변경경로·추가 chunk/asset·외부 import·empty/과대/잘못된 exports·동일 이름 다른 instance·원본/목적 링크·기존 목적/현재성변경·원 hook/build 실패·REGISTERED 없음/UNKNOWN/ABA/만료·원키/기한/중복/보안 guard를 중요 영향 범위에서 확인한다. 실제 권한/FS 조사 대신 메모리 모델만 쓴다.
- root/desktop noEmit·신규 build 단위/변경 native 종단·기존 ISSUE/등록 직접 인접/구문·diff를 선택한다. 무관한 전수/실브라우저·C#/Electron/설치/QA 재실행0. 실제 번들/소스 앞뒤 SHA 및 수행자 명령·exit·시간/개수·미검증을 반환한다.
- 실제 테스트 assertion/합격 기준을 낮추거나 exports fake로 원 실제 생성기를 우회하지 않는다. 같은 원인3회면 작업 중단·정식 fingerprint/증거/원인/남은 작업을 Main에 반환한다.
- 완료보고는 소유6 diff/최종SHA·원 RED/GREEN·핵심/인접 검사·정리 live0·미완료 source 공급자/실제배송 NOT_RUN을 포함한다. Git commit/push는 Main이 독립 scoped 검수와 raw/index 확인 뒤 진행한다. 전체 FN06/FN18/계획 완료로 승격0.
