# FN06/FN18 고정 native runtime 패키지 소비선 소스 결과

2026-11-03. **NATIVE-RUNTIME-PACKAGE-01 소스 구현·합성 핵심 검수 수용 / FN06·FN18·전체 계획 미완료**.

## 기준과 Git

- WI r2 docs/work_packages/FN06_NATIVE_RUNTIME_PACKAGE_SOURCE_IMPLEMENTATION_20261103.md SHA BCEDE8278264855C570BC8C6131AABA1D172EA4ED034A854E4A97F63E081FBE6. r1 F2AB6377은 Git3c54c1f0에 보존했다.
- 직접 native r2 A 계약5C4AF434 및 trust r5 A 계약F6C8CB66의 source-only 범위. PMO turn01a19d4b-0e0d-7a70-94c2-8c0a345a81eb는 고정 Vite write:false 메모리 JS/TS 생성·검사를 기존 개발 검증으로 확인했다. 실제 C#/helper/OS·파일 산출·설치·서비스·Agent 실행은 포함하지 않는다.
- 코드 **b2178d200a65113a260a3d66f9b47f99254699e8**는 WI r2 게시5725b400756a1ce1801fdf51c8fb866505299419 직접 자식, 소유 코드·시험6+WORK_STATUS 정확7개다. raw/index7 일치·staged diff0 후 commit/private push했다.
- codex/av3-stage-b local/private exact SHA 동일, tracked clean·보호 untracked3 원 SHA 보존. remote main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변, main 병합/배포0. LF→CRLF 경고는 보존하고 설정/ACL을 바꾸지 않았다.

## 실제 연결한 소스

기존 owner가 checkout의 TS signer/HTTPS/authority를 직접 require해 apps/desktop만 포장되는 제품에 경로가 없던 누락을 보완했다. 고정 entry+기존 runtime11의 exact12 closure에서 단일 CJS를 메모리에 생산하고, 실제 fixedDesktopTrustForgeHooks.packageAfterCopy가 복사본의 src/native-proof-runtime.cjs 한 파일을 준비하도록 연결했다. 기본 profile=null에서도 bundle 준비는 생략하지 않으며 원 profile 보호와 postPackage hardening은 보존한다.

exports는 NativePreparationClient / NativePreparationCredentialSlot / NativePreparationHttpsChannel / NativePreparationProofSigner / restrictNativeProofSigningContext / readNativeAuthority의 정확6개다. owner와 REGISTERED 통합 소비가 **같은 생성 bundle instance의 HTTPS private registry**를 쓴다. 다른 bundle의 실제 signing context는 helper/consume/factory0으로 거절한다. owner 변경은 고정 CJS require 한 줄이며 checkout/env/사용자 경로 fallback은 없다.

기존 고정 Vite8.3.4와 lock을 사용하고 config/env/public 탐색·쓰기·minify·sourcemap·추가 chunk/asset을 끈다. 외부 runtime 의존은 node:crypto/node:https뿐이다. 실제 source snapshot 전후 동일·고정 graph/exports·출력2MiB 한도를 검사한다. copy 어댑터는 regular/realpath/root·src inode와 목적/temp 부재를 확인하고 exclusive 생성→sync/readback→덮어쓰기 없는 link 공개→소유 temp 회수→원바이트 재조회를 수행하는 코드다. **이번 copy 실행은 메모리 IO 모델만 사용했다.**

## Main 독립 실행 증거

| 명령/검사 | 결과 |
|---|---|
| node --test tests/desktop/native-proof-runtime-build.test.cjs | 23a3fe, 10 PASS/FAIL0/SKIP0, 832.4915ms |
| node --test --test-name-pattern='원 package 공급자\|실제 Forge copy hook은 원 profile만' tests/desktop/desktop-trust-key-host-build.test.cjs | 23a3fe, 2 PASS/FAIL0/SKIP0, 204.4449ms |
| node --test --test-name-pattern='^native ' tests/desktop/desktop-trust-registration.test.cjs | e684e8, 17 PASS/FAIL0/SKIP0, 1761.6186ms |
| node --test --test-name-pattern='^(ISSUE 실제 IPC\|begin UNKNOWN\|ISSUE 응답유실 UNKNOWN\|최초begin 동일request\|begin 기본보호부재\|ISSUE REGISTERED 재조회)' tests/desktop/desktop-trust-registration.test.cjs | e684e8, 6 PASS/FAIL0/SKIP0, 1292.3613ms |
| root noEmit / desktop typecheck / WI r2의 원 root옵션 동등 entry 명시 noEmit | 008d44, 각각 exit0 |
| 최종6 SHA 앞뒤 / raw-index7 / diff / 옛 신규 .ts 부재 | 동일/exit0 |
| 독립 정적 코드 검토6 | scoped C0/I0, 시작·끝 SHA 동일 |

검증은 실제 Vite write:false 산출물을 제한된 동일 realm CJS loader로 읽어 원 REGISTERED→Client/slot/HTTPS→owner SIGN→consume/합성factory1을 호출한다. 공개 고정 시험키·메모리 HTTPS/helper/journal/current/IO를 사용하며 가짜 exports 성공값으로 실제 bundler를 대체하지 않는다. 수행자 3b1864의 신규10/native·등록선정20/profile2 및 과거 검증과 중첩 합산하지 않았다. 무관한 전체/브라우저/기존 실FS QA는 재실행하지 않았다.

## 오류·보정

854899는 원 fixed hook의 runtime 호출 누락1FAIL RED다. Vite 반환배열·sandbox Git 접근은 준비오류로 분리했다. 신규 JSDoc/readonly/반환union 타입 오류1회는 실제 계약을 좁혀 보정했다. entry .ts의 desktop CommonJS 경계 TS1295와 import=require/export=의 erasableSyntaxOnly TS1294·exports 거절은 같은 module원인2회 후 추가 추정시도를 중단했다. Main은 독립 C0/I0의 비의미 WI r2로 신규 entry 한 경로만 .mts로 대체했다. 기존 root/desktop 검사와 모든 원 root compilerOptions의 명시 entry noEmit를 유지했으며 설정/기준 완화·기존 시험 삭제0이다.

## 미완료·실제 효과·복구

실제 runtime 파일 산출/FS QA·ASAR/설치/Electron/C#/helper/OS·키/권한·DB·서비스·네트워크·Agent·사용자 인수는 **NOT_RUN/제외**다. 새 QA/컨테이너/보호 파일 생성·잔여/live0이다. 소스/test 작성과 제품소스 읽기는 이 source-only 범위이며 실제 사용자 파일 조사는 없다.

보호 current/profile 공급자·NativeOnly 최초 전달/수신/ACK·owner bridge/file journal 전체 배송은 여전히 미완료다. 실제 설치형 실행 또는 전체 배송 완료로 보고하지 않는다. 복구 bootstrap43EBD866도 별도 직접 결정 대기다. 다음은 이 실제 선행 공백의 채택 계약과 공급자를 구체화하며 완료된 단위는 재실행하지 않는다.

복구는 소유 코드 commit의 정확 diff를 정상 Git revert로 검토한다. reset/force/history rewrite·타인 자료 삭제0. 실제 서비스 반영이 없어 운영 rollback은 실행하지 않았다. 작업현황에는 단계/담당자/파일/시험/오류/미검증/다음 조치를 누적했다.

## 최종6 inventory

압축 JSON 배열 {path,sha256,bytes} UTF8 SHA256 **C773FD46664637DB2D3064A7C4E2A67333F8F5D763E6B0F3944C4A4614C0E6EB**.

| 경로 | SHA256 | bytes |
|---|---|---:|
| apps/desktop/src/trust-enrollment-owner.cjs | 07CE69E6E8D683D61BE6B6F81A734C9768078B7C117EDC1823C5A10BEB6E0B64 | 49054 |
| apps/desktop/scripts/desktop-runtime-profile.cjs | 937CE5E4FEA7AA677F8007A98FA8C7ACD129C27F685A30E998D6A792FD0566B4 | 9385 |
| tests/desktop/desktop-trust-registration.test.cjs | 64EA49B66B50DB551F8F8A1BCEDD7B4117F97725DDA8CEF8E3D8A0456927F2A3 | 71068 |
| apps/desktop/scripts/native-proof-runtime-entry.mts | 5605710335CA0CE6601DE5248FAB44563BFE872121DE2497AFB6E9D6809EE1D4 | 553 |
| apps/desktop/scripts/native-proof-runtime-build.cjs | 488DC99D9437F59CCCC68956B0F9DC8269F18629896062B9AE1AE23F6102F58E | 7502 |
| tests/desktop/native-proof-runtime-build.test.cjs | FC121CE80C24944C7B36C0A396FBDDE3C76D45FB8CD1D33A4B5477D7BF85CE82 | 6145 |
