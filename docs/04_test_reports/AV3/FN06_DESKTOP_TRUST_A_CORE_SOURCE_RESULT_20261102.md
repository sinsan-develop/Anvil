# FN06 설치형 신뢰 연결 A안 — 첫 소스 단위 결과

- 판정: **코드 구현·합성 핵심 검수 완료 / FN06 전체 부분 구현**. 실제 설치형 사용·사용자 인수·Stage 완료를 의미하지 않는다.
- 기준: r5 계약 SHA256 F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6, 직접 승인 기록 7B8E5A34D69D85A69FEE2AEA3F69643427B4781BF2454E8B2FA37D2EA9AA75A3, WI r2 352F2ED8D67D27D3FA53E4083DC9ABD16109E3EF7D7AE20B17DA82B027B0B949.
- branch: codex/av3-stage-b. 시작 checkpoint 404960c54fce2c077ea882035606f7fcce40479f. 최종 코드 checkpoint **f9346d1dd0bdecec6c5ffab48b58a87c4d920b8a**, local/private 동일. 이번 commit은 나머지 코드21+WORK_STATUS 정확22경로다. 앞서 보존한 native/codec/verifier를 포함한 전체 허가 소스는30경로다.
- remote main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변. main 병합·배포하지 않았다. 관련 없는 untracked3은 보존·stage 제외했다.

## 구현한 범위

전용 host/root/binding 소스 → 고정 compiler/PE 검산 → 보호 catalogue 생산·조회 → package profile → local preload/IPC/main → 내구 KEY_PENDING → CREATE 최대1 → KEY_READY를 연결했다. 기본 공급자는 미등록/null이며 renderer·환경변수·raw JSON을 설치 권위로 인정하지 않는다. 기존 connect/종료/숨김·remote preload 차단·CSP는 유지했다.

정상 종단은 실제 소스의 Forge hook·공식 FN18 reader·서버 inject·owner/client를 소비하지만 compiler·보호 저장·키·child는 합성이다. **MODEL_ONLY**이며 실제 Windows 보호 동작을 증명하지 않는다.

## 검수 증거

| 명령/검수 | 실제 결과 | 한계 |
|---|---|---|
| node --test tests/unit/FN06/desktop-runtime-catalogue.test.ts | 36 PASS, FAIL/SKIP 0, 3917.8802ms | 합성 IO/서버 inject |
| node --test tests/desktop/desktop-trust-owner.test.cjs tests/desktop/shell-policy.test.cjs | 최종 LF 소스 26 PASS, FAIL/SKIP 0, 346.0697ms | 메모리 DOM·IO, 실제 Electron 미실행 |
| node --test --test-name-pattern='원 package 공급자\|실제 Forge copy hook' tests/desktop/desktop-trust-key-host-build.test.cjs | 2 PASS, FAIL/SKIP 0, 209.1467ms | 메모리 profile/hook |
| compiler I1 후행 wall 관측 한정 시험 | 1 PASS, FAIL/SKIP 0, 142.7765ms | 실제 compiler/파일 IO 없음 |
| 등록 QA02 정상+sync 경합 Main 독립 fresh | 2 PASS, FAIL/SKIP 0, 1939.507ms | 등록 합성 PE/ASAR 파일만, 바이너리 실행0 |
| root tsc --noEmit -p tsconfig.base.json | exit0 | 타입 검사 |
| desktop tsc -p apps/desktop/tsconfig.json | exit0 | 타입 검사 |
| staged diff --check / 30경로 raw-index blob 대조 | exit0 / 전부 동일 | 소스·Git 바이트 검산 |

중첩된 이전19/25/부분 시험과 합산하지 않았다. codec/verifier/native/server/UI/compiler의 독립 scoped review는 최종 C0/I0이며 실제 C# 컴파일·RunAll은 NOT_RUN이다.

## 발견 오류와 조치

- C# store/host: 관측했던 record 소실·sidecar·기존 root 무기록을 UNKNOWN으로 보존하도록 보완했다. 정적 같은 계보 미해소3회 뒤 Main이 좁은 범위를 인수했다. 실제 C# 시험 실패3회라고 기록하지 않는다.
- server catalogue: CAS 뒤 만료와 wall/mono 대기의 유효 기한을 재검사·축소했다. 정적 같은 계보3회 인수 후 새 음성2 FAIL→수정 후 통과했다.
- peer/owner/compiler: 후행 wall 전진이 미정착 대기의 timer도 앞당기게 했다. 저장 효과 후 응답 불명은 시도와 UNKNOWN을 보존하고 자동 재호출하지 않는다.
- 화면: 시도 없는 접기 성공 때 같은 generation의 실제 panel도 숨긴다. public KEY_PENDING을 효과 표식으로 미리 표시한 중간 오류는 private 표식으로 보정했다.
- Git 준비: 혼합 CRLF4파일과 CSS1줄은 LF로, 신규 profile 공백행36바이트만 제거했다. 역치환으로 의미 바이트 불변을 확인했고 Git/검사 기준은 변경하지 않았다. 상세 실패·재작업 계보는 WORK_STATUS에 보존했다.
- route inject가 trailing '?'를 정규화했으므로 raw wire '?' 경계는 미검증이다. 임의 PASS 처리하지 않았다.

## 합성 QA 자원 회수

QA01 D:/tmp/anvil-v3-desktop-trust-key-host-parent-20261102-01: 원 TTL 13:39:07.529Z~14:09:07.529Z, marker 6510E9825B845D9BEA0D93B383D5836ED0A0A7FF2BCBB624B042CD507617FD0E. 소유 fixture5/빈 case를 개별 정리한 뒤 Main이 marker/빈 root만 비재귀 회수했다(13:44:59.486Z). 별도 잔여0 조회 13:46:40.894Z.

QA02 D:/tmp/anvil-v3-desktop-trust-key-host-parent-20261102-02: 원 TTL 14:05:10.088Z~14:35:10.088Z, marker 3A06C14133AD45076F42B1653F3BB283DBD833D2A07D4149D7E800FD9225C062. Main fresh 뒤 owner/dev/ino/hash/nonlink와 유일 marker를 확인해 14:09:52.354Z 비재귀 회수, 14:10:03.606Z QA01 포함9 literal 대상 잔여0. TTL 연장/재생성/재사용0. 실제 서비스·컨테이너·DB·키 생성0.

## 남은 범위와 복구

ENROLL/PROOF/HUMAN/ISSUE·명시 복구·native mapping·실제 보호 배포 공급자와 설치 권위가 남아 있다. 실제 C# 컴파일/RunAll·CNG/DPAPI/Windows 내구·TLS·실제 Electron 화면·Agent·DB·서비스·배포는 **NOT_RUN/제외**다. FN06 전체와 작업계획은 미완료다.

소스 복구는 보존된 checkpoint 이력의 정확 diff를 검토한 정상 Git revert로 수행하며 다른 변경을 reset하지 않는다. 운영 반영이 없어 운영 rollback은 실행하지 않았다. 다음은 기존 r5의 pair→proof→HUMAN 연결을 실제 기존 계약과 대조해 업무 단위로 구현한다.

## 최종 소스 바이트 목록

inventory SHA256 **6B8FD4B8F49CA94C3968620A926C7106494C513EA377CC0FF284235092B1881A**. WI 순서의 {path,sha256,bytes} JSON 배열 해시다.

| 경로 | SHA256 | bytes |
|---|---|---:|
| apps/server/app.ts | B58BDDAF824DD61CD77615052FEAA0753F01A3BEB251CB42679D344C5CB056C9 | 5340 |
| apps/desktop/forge.config.cjs | 7B35AE26CD6DF10FF297343E964D0A7BD311B0E1A93F85CBD3E01DD82BD0C140 | 1446 |
| apps/desktop/src/shell.cjs | 686EA797C7E1429538BBEFF23943EE292537911B444500775838329E66AFDE7A | 12377 |
| apps/desktop/src/preload.cjs | C2843A657D98559B3DC41770CFD9C0859D78BD78D9B8D7C20692EEB26F1C947E | 1698 |
| apps/desktop/src/policy.cjs | 345704AB29430AB99C92FBE09876D85D149B45FE60F3B632C5A202AED12EE376 | 4629 |
| apps/desktop/src/settings.html | 1C6BABC6AE2B65C32018C5C06F7097850FEC9B0A898FA71361E7D060D1116BB9 | 2548 |
| apps/desktop/src/settings.js | 12F7E7BA6B28D00AD06E42E5E487A4CA8856521B0438D4E979E3223EF45CB62A | 8681 |
| apps/desktop/src/settings.css | 2896CF1540F462D18E886C528B326B2C7B6BEEDEB99957AF7A25623F2BE99699 | 1391 |
| apps/connector/native/ProtectedStore.cs | 62A348E7FB5C7C524C0E03FD377FDCE77DB4539AFE6C9C0B4B023220FF8664E3 | 8869 |
| contracts/runtime/desktop-runtime-catalogue-v1.ts | 1CEC58C2449347EB0D4F13CE8F7999630DC1DF431BF7170D69EEDCD871CAA052 | 6056 |
| apps/server/modules/runtime-catalogue/desktop-runtime-catalogue-source.ts | 9D087FD6E8A36C2C90940207946C4D01AB32F9AA687D08F223ABC6E2AE8514F3 | 9684 |
| apps/server/modules/runtime-catalogue/desktop-runtime-catalogue-routes.ts | 2E87941E7BDCA48D163661DCC6AE1D9D6E64B3E495B7541B543A742E6519A6E0 | 1359 |
| apps/desktop/scripts/desktop-trust-key-host-build.cjs | 7F2C7BEC3C8454006541F0D0271618385BFE8D82EFCB53E19192B5A8109A10C2 | 8958 |
| apps/desktop/scripts/verify-desktop-trust-key-host.cjs | CD7DD3ABA0074F36170965CC462258CFC8E024A51C016BA5078DE7502A911E7E | 11606 |
| apps/desktop/scripts/desktop-trust-key-host-compiler.cjs | 6CE13EF2A5D3763F790AADD177FFF83886C1AB9CAD4F83D859B0EF7730AA7C38 | 16961 |
| apps/desktop/scripts/desktop-runtime-catalogue-publisher.cjs | 59CCAAC74C1F2794EB7427AABD272E175F5C5688BEAFB0525650FE7A49BB6BA0 | 8422 |
| apps/desktop/scripts/desktop-runtime-profile.cjs | 4F1A710856E640519ADDA3AC621CCB7C3805DC65FA5263874EAD4671090860CD | 9258 |
| apps/desktop/src/runtime-catalogue-profile.cjs | 833C4AA68A9C8CA3B505571693526C1D158A61709B156CE981071A695E67980E | 10409 |
| apps/desktop/src/runtime-catalogue-client.cjs | 3B0161F2F7666792910A0713806880DBD406AE6270DD5809B1CF8D9ADFD1818C | 7994 |
| apps/desktop/src/trust-key-host-client.cjs | C3C9B04C2664F528F3B9D65C0E33F3866A34C63315232BCA0361688145B2CC1A | 9658 |
| apps/desktop/src/trust-enrollment-owner.cjs | F9A61ACA296D7D803B7027849F912D373C03008DD5BB8F4449F83B307F2A98A1 | 21177 |
| apps/connector/native/DesktopTrustKeyHostSource.cs | E4D03ECCC9B61F88F8A4627B14427216CF0D526BEA235C20271172C656C238B3 | 16031 |
| apps/connector/native/DesktopTrustKeyParentBasisSource.cs | CA93086B03890FBB03D8637A02130AC7AE02106BAE96C340FDC0B7DD28956221 | 3553 |
| apps/connector/native/DesktopTrustKeyPeerSource.cs | 9F5334EA275F340D14A4F4BD521995E1102D329D64C77887F5408AE0DA855042 | 17121 |
| apps/connector/native/DesktopTrustKeyRootSource.cs | EDAAED3E763946447E3337C25323B3534F6C6D6961367EABB95249F1EB13330A | 9034 |
| apps/connector/native/DesktopTrustKeyBindingStoreSource.cs | 6063E3781D1E3128509306A66146F3C0A4933549D3EF87A7FD1DC36D1A54BD3F | 14537 |
| tests/unit/FN06/desktop-runtime-catalogue.test.ts | 5F0A419FA3116182D84B0204B8FBC77A382771F81160A6DC35DD502F42D74831 | 17603 |
| tests/desktop/desktop-trust-key-host-build.test.cjs | 337D81D3EA0AE74034C85C2EDA48334180C0806728227A1BA843420C7ED0A674 | 31779 |
| tests/desktop/desktop-trust-owner.test.cjs | 19BD7864AF9E71069D89340BBB308F7AFC6E8C273634398A50AFAFCF3A4980FE | 34532 |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | 33A1F8FB756BF978D65B4BBD5429AD6E5A70232FF6532F1314A7AF1FE80A24B4 | 20192 |
