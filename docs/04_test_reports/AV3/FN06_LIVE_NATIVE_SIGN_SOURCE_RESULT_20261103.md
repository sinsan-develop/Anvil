# FN06 LIVE-NATIVE-SIGN-01 소스 검수 결과

2026-11-03. **승인된 소스 단위 검수 수용 / 전체 FN06·작업계획 미완료**.

## 기준·정확 변경

- 코드 08e6cde57a729067aca81e7e7c818408005558bf는 998a7ae6c2b8d1fe25f9330aea644a4a5922d4bb 직접 자식이다. 기존 codex/av3-stage-b에서 코드·시험5+WORK_STATUS 정확6개를 commit/private push했다.
- local/private exact SHA 동일, tracked clean·보호 untracked3 원 SHA 보존, main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변. main 병합·배포0.
- WI docs/work_packages/FN06_LIVE_NATIVE_SIGN_SOURCE_IMPLEMENTATION_20261103.md SHA BC4F29C0FA4A9BE8C0F7B5471AE8493091EB5F87B7C9538612DD1D2976E74DA9.
- native r2 A 승인 계약 SHA 5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085, 승인 기록 9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567.
- desktop trust r5 A 승인 계약 SHA F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6, 승인 기록 7B8E5A34D69D85A69FEE2AEA3F69643427B4781BF2454E8B2FA37D2EA9AA75A3.

## 실제 소스 연결 범위

같은 실행의 private REGISTERED 원행 → 기존 NativeClient/slot/HTTPS private context → 기존 typed signer의 원 context 일회 소비 → 보호 mapping.resolve/exchange → owned helper → 같은 기존 키 Load → 기존 NativePreparationProofSource.Sign → 원 request/P256 서명 검산을 연결했다.

별도 native 권위/current/profile·원 등록/installation/project·원키·helper 지문을 대조한다. 동적 잔여시간과 최초 고정 끝시각은 좁히기만 하며 Load 뒤에도 다시 확인한다. raw JSON/verified 선언·등록 없는 owner·위조 context·다른 signal/bytes·재사용·문맥 ABA·CLOSE/EXPIRE 뒤 늦은 서명을 거절한다. HUMAN GET은 등록 관계 확인이고 NativeAuthority 생산자가 아니다. 기본 보호 공급자는 미등록/UNAVAILABLE다.

새 공개 API/DB/IPC·일반 목적 서명·키 purpose·상태조회 credential의 native bearer 사용을 추가하지 않았다. 공개 고정 RFC6979 시험키와 명시 메모리 helper/current/network 대역으로 검사했으며 실제 키 생성이나 실사용 키 접근은 없다.

## Main 독립 실행 증거

| 명령/검사 | 실제 결과 |
|---|---|
| node --test --test-name-pattern='^native ' tests/desktop/desktop-trust-registration.test.cjs | eeada0, 16 PASS/FAIL0/SKIP0, 1436.7299ms |
| node --test --test-name-pattern='^(ISSUE 실제 IPC\|begin UNKNOWN\|ISSUE 응답유실 UNKNOWN\|최초begin 동일request\|begin 기본보호부재\|ISSUE REGISTERED 재조회)' tests/desktop/desktop-trust-registration.test.cjs | 2c9e69, 6 PASS/FAIL0/SKIP0, 344.6999ms |
| node --test --test-name-pattern='^(실제 client→\|등록 owner 없는)' tests/unit/FN06/native-preparation-proof-signer.test.ts | 2c9e69, 2 PASS/FAIL0/SKIP0, 249.096ms |
| node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json | bc68cb, exit0 |
| node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json | bc68cb, exit0 |
| 동결5 SHA 검증 전후·raw/index 동일·staged diff check | 일치/exit0 |

실제 실행 Node v24.22.1. 위 변경16/인접6/typed2는 서로 다른 필터이며 수행자 검증과 중첩 합산하지 않는다. 과거 불변 전체·브라우저·이미 정리된 QA는 재실행하지 않았다. C#2와 Node/TS3의 독립 정적 검토는 각각 C0/I0, 시작·끝 SHA 동일이다. C# 시험은 작성만 했고 **컴파일·RunAll은 NOT_RUN**이다. LOAD_ELAPSED는 주입 port 모델이며 실제 Load/CNG/primitive 시험 결과가 아니다.

## 오류·보정 이력

- 884467 실제 등록/발급 REGISTERED 뒤 원 owner의 typed SIGN 생산자가 없는 genuine RED(exit1/121.2155ms)에서 시작했다.
- f5d120 preload VM의 structuredClone 누락은 준비 오류로 분리했다. 2b2fc1 함수 port의 JSON codec 검사, c7cbe5 exchange object/string 원인터페이스 불일치는 각각 구현 보정했다. 기존 검사 기준 완화·기존 시험 삭제0, 동일 원인3회0이다.
- sandbox Git 4083b0의 work tree 접근 오류는 elevated 읽기81a7f2로 확인했다. 설정·ACL 변경0이며 LF→CRLF 경고는 보존했다. 정상 raw/index 바이트 동일 확인 뒤 commit했다.
- Primary 단일 writer가 구현·시험, Reviewer 읽기 검토, Main 독립 검사·문서·Git 통합을 수행했다. 동시 제품 writer0.

## 미완료·미실행·다음 작업

실제 보호 current/profile 공급자, NativeOnly 전달·원 수신확인 생산자, desktop TS 전체 배송 조립은 미완료다. 실제 Windows/CNG/TLS/보호 저장 내구·설치형 화면·키·권한·DB·서비스·Agent·배포·사용자 인수는 NOT_RUN/제외다. 이번에 새 네트워크·파일 QA·컨테이너를 만들지 않아 자원 생성/잔여0이다. 실제 사용자에게 사용 가능한 설치형 연결 완료라고 보고하지 않는다.

복구 bootstrap 후보43EBD866은 별도 직접 결정 대기다. r5 동일 승인 재확인을 해당 후보 채택으로 해석하지 않는다. Main은 기존 승인 안의 다음 공급자/소비선 공백을 이어 확인하며 완료된 단위는 반복하지 않는다.

복구는 소유 코드 commit의 정확 diff를 정상 Git revert로 검토한다. reset/force/history rewrite·타인 변경 삭제0. 실제 배포가 없어 운영 rollback은 실행하지 않았다.

## 최종5 소스 바이트

아래 순서 {path,sha256,bytes} 압축 JSON 배열 UTF-8 지문을 WORK_STATUS에 결박한다.

| 경로 | SHA256 | bytes |
|---|---|---:|
| apps/desktop/src/trust-enrollment-owner.cjs | 6D4913E51711B3F3C10F33DB98C5CECBA5691266CFD8A2CDC3D2E307CB2E32EA | 49223 |
| apps/connector/native/DesktopTrustKeyHostSource.cs | DC4C71B78546B85CB1AD71FF83A668336FF944696B237E36DCA7B2FE99DA0E8A | 27631 |
| tests/desktop/desktop-trust-registration.test.cjs | 0FD9D7EC9B071755CDC8BD810E0BF04891186C952B0D00D16340830C6C08AA11 | 69494 |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | 86542BB11E8112ADB8B5626922161BA1F04063E8209F0BFC98C5B4332A0964C5 | 39686 |
| tests/unit/FN06/native-preparation-proof-signer.test.ts | 10BAB8AEE6601104CD9F3BD7BDEBFB74B42E617BB9140C6802A008AB048917A2 | 28017 |
