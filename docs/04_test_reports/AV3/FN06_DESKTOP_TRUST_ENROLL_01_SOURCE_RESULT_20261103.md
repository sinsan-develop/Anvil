# FN06 ENROLL-01 소스 구현·합성 검수 결과

2026-11-03. 판정: **승인된 등록 연결 소스 단위 구현·합성 핵심 검수 수용 / FN06 전체 부분 구현**.

## 기준·Git

- 계획: FUNCTION_WORK FN06, 설계 §9.1~2·AV3-F13/F14. r5 A 직접 source-only 승인 SHA256 F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6; 승인기록7B8E5A34D69D85A69FEE2AEA3F69643427B4781BF2454E8B2FA37D2EA9AA75A3.
- WI: docs/work_packages/FN06_DESKTOP_TRUST_ENROLL_01_SOURCE_IMPLEMENTATION_20261102.md r2, SHA25608716073072ED73802ABF482E0B394AFA0A9B6D5A6B1E1680E2618EEEB1DE794.
- 시작 ba778d3266fe7f6236e79bb03ad90dfd3b852065 → 코드 **6f8a8ebf1c34af58a25e6eadfa8d91d797df28d3**, 직접 자식. 기존 codex/av3-stage-b local/private 정확 일치. commit은 소유 코드10+WORK_STATUS 정확11파일이며, 허가11 중 기존 owner 시험1은 불변이다.
- staged diff --check exit0, raw/index 소유11+현황 바이트 동일. Git LF→CRLF 경고는 남겼고 설정·기준 변경0. 원격 main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변. tracked clean, 관련 없는 untracked3은 원 SHA 그대로 보존·stage 제외.

## 실제 구현된 소스 흐름

설치형 로컬 설정에서 기존 KEY_READY 키를 PUBLIC_KEY로 재확인 → 원 hint/등록ID 선보관 → 현재 소유 remoteSession의 고정 HUMAN GET → 원 scope/ref/hash·지문·등록기한 대조 → enroll → 기존 정확8필드 등록 proof 서명/prove → HUMAN_PENDING 내구 보관·사람 확인 대기 표시를 연결했다. 명시 CHECK_CURRENT는 원 CONFIRMED/REJECTED/REVOKED/EXPIRED를 검산해 표시한다. READY_TO_ISSUE는 사람 확인 관측일 뿐 발급 실행 성공이 아니다.

기존 Web 등록/확인/회수와 서버 계약은 재사용했다. 실제 dependency factory의 main app.getVersion 고정 배송값·32바이트 nonce 공급을 소비하며 시험에서 임의 값을 넣어 생산 누락을 가리지 않는다. 고정 경로/receiver·own data·16KiB wire·ref/hash·최소기한·epoch/ABA·동시 requestId·효과 뒤 UNKNOWN을 유지한다. renderer의 cookie/CSRF·키/원시서명·root 선택과 비밀 반환은 없다. 기본 보호 배송 공급자 미등록은 계속 UNAVAILABLE이다.

## 검증 증거와 한계

| 범위·정확 명령 | Main fresh 결과 |
|---|---|
| node --test tests/desktop/desktop-trust-registration.test.cjs | 최종33 PASS / FAIL0 / SKIP0, 841.1718ms, exit0 |
| node --test --test-name-pattern='실제 owner→\|실제 preload→shell\|옛 finally' tests/desktop/desktop-trust-owner.test.cjs | 직접 영향3 PASS / FAIL0 / SKIP0, 167.5313ms, exit0 |
| node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json | exit0 |
| 동결11 SHA 앞뒤 대조 | 일치 |
| 독립 C#3 정적 재검수 | 원 I1/I2 해소 scoped C0/I0 |
| 독립 Node8 후 보정2 정적 재검수 | 원 I1~I5 해소 scoped C0/I0 |

보정 전 Main의 등록27+owner21+policy5=53 PASS/672.6508ms는 당시 선정 범위의 증거로 보존했다. 최종33/직접3과 중첩 합산하지 않았다. 불변 verifier/build·QA01/02·전수 검증을 반복하지 않았다. 시험은 실제 preload/handler/owner/Session.fetch adapter/owned helper client 소스가 메모리 대역을 소비하는 합성 검사다. 공개 RFC6979 고정 시험키를 메모리에서 사용했으며 실제 키 생성·실사용 키 접근은 없다.

**실제 C# compile/RunAll·Windows CNG/DPAPI/내구·실제 TLS/cookie·설치형 앱의 실제 화면·실DB·권한·서비스·Agent·배포·사용자 인수는 NOT_RUN/제외다.** C# 시험 source 존재와 Node 통과는 실제 C# 동작을 증명하지 않는다. 새 FS QA·네트워크·컨테이너를 만들지 않아 이번 자원 생성/잔여는0이다.

## 발견 결함·보정

- 최초 실제 IPC pair가 미지원으로 거절되는 RED를 먼저 확인했다. fetch getter 실행·prove 구버전 재봉인 수용도 실제 반례 후 원 descriptor/증가 version 검산으로 보정했다.
- C# 정적 I1 다중 var 선언은 [Microsoft CS0819](https://learn.microsoft.com/en-us/dotnet/csharp/misc/cs0819)와 대조해 개별 선언으로 보정했다. 실제 compiler 오류를 실행한 것은 아니다. I2 PROOF_PENDING의 검산 EXPIRED/REJECTED/REVOKED 전이를 추가했고 원 Record/fullref/불변키/세대·sidecar/UNKNOWN 보호와 원 partial primitive를 유지했다.
- Node I1 생산 nonce/버전 누락, I2 abort 선행·close 결과 무시, I3 지역/ticket 효과 표식 분리, I4 기지 등록기한 초기 예산 누락, I5 SIGN 직전 catalogue current 누락을 독립 검수로 찾았다. 새 유한 반례6 RED 뒤 생산 factory 소비·원예산 종료 확인·공유 효과·기지기한 최소값·서명 직전 회수 재검산으로 보정했다.
- fixture/newline·편집 스크립트 const 재할당·후행 정착 관측·JSON import 타입 준비 오류는 WORK_STATUS의 원 계보에 분리했다. 기한 반례의 기대100ms/실9600ms 등 실제 RED는 지우지 않았다. 타입 설정/기대값/합격 기준 완화·기존 시험 삭제0. 동일 근본 보정3회로 Main 인수한 일은 이번 단위에서 없다.

## 남은 작업·확인 방법·복구

다음은 같은 r5의 명시 ISSUE와 StatusOnly 보호 저장 연결이며, 이후 명시 복구/native mapping이 남는다. 새 ISSUE·복구·native 권위는 현재 계속 차단한다. FN06·Stage B·전체 작업계획은 미완료이며 실제 배포/사용 가능이라고 보고하지 않는다.

화면 소스의 확인 위치는 설치형 로컬 설정 아래 등록 영역이다. 현재 단위는 합성 클릭으로만 확인했으므로 실제 설치/서버 반영 후 사용자 확인은 별도 미검증이다. 실제 설치가 승인되기 전 임의 실행하지 않는다.

복구는 코드 commit의 소유 diff를 검토한 정상 Git revert로 수행하며 reset/force·타인 변경 삭제를 하지 않는다. 실제 DB/서비스 반영이 없어 운영 rollback은 실행하지 않았다. 작업·오류·위임·미검증·다음 조치는 WORK_STATUS에 누적했다.

## 최종 허가11 소스 바이트

inventory SHA256 **81D44F2571CFDCCE4F4C12E1623B58225D14EB5E421C5FBE2649C0B2EC7AA48C**. 아래 순서의 {path,sha256,bytes} 압축 JSON 배열 UTF-8 해시다.

| 경로 | SHA256 | bytes |
|---|---|---:|
| apps/desktop/src/trust-enrollment-owner.cjs | 42237E776E1A3C5C3E48D0EB874CCFF2F1C85EAEE1243A128B9887FF864AF3EE | 33719 |
| apps/desktop/src/shell.cjs | D4ECCE1BAA0E2257A469BF6C20F1A789D839A39BBDFD7438F6AC076E269722C2 | 13641 |
| apps/desktop/src/policy.cjs | 89338B232EA26398F94354C8DD599A8B2C2897CDCDC99585B9C8195C1408E9E8 | 4732 |
| apps/desktop/src/settings.html | 015488D44D76A0DB614371F46C1879718CD1FC4D3D0E9B6464D266F6A8875B98 | 3280 |
| apps/desktop/src/settings.js | F5C810DCBC37D2BA1BE988E7D9DAC0B5407D234022E7F5503F033D78063EE623 | 10987 |
| tests/desktop/desktop-trust-owner.test.cjs | 19BD7864AF9E71069D89340BBB308F7AFC6E8C273634398A50AFAFCF3A4980FE | 34532 |
| apps/desktop/src/trust-registration-client.cjs | 4767228A52C31BBA052BFAB579446C6355E7210D00C35192CC1C80D68845B28A | 12695 |
| tests/desktop/desktop-trust-registration.test.cjs | 4BBE062A2D630A1E9A55081A920EB97FF4B0C7D241AB4912FCD08CCB4F19862F | 36931 |
| apps/connector/native/DesktopTrustKeyHostSource.cs | 0B055234694FE6AF030432AEDA7A42EA0D4CBA1772720640FF7CF0375AB214A9 | 18201 |
| apps/connector/native/DesktopTrustKeyBindingStoreSource.cs | 01CC167BC9ACA745EB705BC81B7917D0EF0D61049F8B3CA6A142A9C0B12434C0 | 19193 |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | DD95CCBE36687DB41B9CFEBF9259808091C3F4733C16ADAA1D89EB476E2E79A9 | 26705 |
