# FN06 ISSUE-01 명시 발급·보호 저장 소스 결과

2026-11-03. **승인된 소스 단위 구현·합성 핵심 검수 수용 / FN06 전체 부분 구현**.

## 기준과 보존

- FUNCTION_WORK FN06·설계 §9.1~2/AV3-F13,F14, r5 A 직접 source-only 승인 SHA F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6, 승인기록7B8E5A34D69D85A69FEE2AEA3F69643427B4781BF2454E8B2FA37D2EA9AA75A3.
- WI docs/work_packages/FN06_DESKTOP_TRUST_ISSUE_01_SOURCE_IMPLEMENTATION_20261103.md SHA CB45A313191A753A17499C6AD7AC115644A80F104D0F79A26959596887BE7F58.
- 시작70d237b8508b3715b495a1593fc5176cfe2ebdd0 → 코드 **3e99e04eee4abe93ed82e927952bad814a6dd383**(직접 자식), 기존 codex/av3-stage-b local/private 동일. 소유 소스9+WORK_STATUS 정확10파일, staged diff check0·소유 raw/index 바이트 동일.
- remote main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변·tracked clean·관련 없는 untracked3 원 SHA 보존/미stage. LF→CRLF 경고를 숨기거나 Git 설정을 바꾸지 않았다. main 병합·배포0.

## 연결한 기능

같은 attempt에서 원 HOST_PROOF를 private 메모리에 보유 → 명시 ISSUE → 원키/PUBLIC·HUMAN CONFIRMED·catalogue/원기한 재검산 → ISSUE_PENDING 선내구 → 원 serverNonce 유지·새 clientNonce의 preflight 서명 → 고정 exchange CHALLENGE → 반환 challenge 검산·두 번째 등록 proof 서명 → 최초 ISSUE 응답 검산 → StatusOnly STORE 최대1·digest/MATCH → REGISTERED CAS → CLOSED_CONFIRMED 뒤 성공을 실제 소스 호출선에 연결했다.

REGISTERED는 **상태 조회용 등록정보의 보관 이력**이다. Agent 실행 허가나 실제 설치·연결 성공이 아니다. token은 renderer·mapping·로그·재조회에 남기지 않으며 원 proof/nonce는 private 문맥만 사용한다. 부재·재시작·epoch 폐기에서 proof를 재구성하지 않는다. 유실·저장/종료 불명은 원 attempt/단계를 UNKNOWN으로 보존하고 같은 ID도 새 발급/재저장0이다. UNKNOWN 뒤 새 begin으로 원 시도를 덮어쓰는 추가 우회도 차단했다.

기존 서버/Web·ProtectedStore primitive·preload/shell transport를 재사용했다. 새 공개 API·DDL·키 purpose·bearer 사용 포트는 추가하지 않았다. 기본 보호 공급자 미등록·복구/native/use-without-return 차단은 유지한다.

## 증거 — 실행 범위를 넘겨 해석하지 않는다

| Main 독립 검증 | 결과 |
|---|---|
| node --test tests/desktop/desktop-trust-registration.test.cjs | begin 보정 전 최종52 PASS/FAIL0/SKIP0, 1162.812ms |
| node --test --test-name-pattern='실제 owner→\|실제 preload→shell\|옛 finally' tests/desktop/desktop-trust-owner.test.cjs | 직접3 PASS/FAIL0/SKIP0, 129.2208ms |
| node --test --test-name-pattern='^(begin UNKNOWN\|ISSUE 응답유실 UNKNOWN\|최초begin 동일request\|begin 기본보호부재\|ISSUE 실제 IPC)' tests/desktop/desktop-trust-registration.test.cjs | 마지막 보정 후 선정5 PASS/FAIL0/SKIP0, 428.8103ms |
| node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json | 마지막 보정 후 exit0 |
| 최종9 SHA 앞뒤·raw/index·staged diff check | 일치/exit0 |
| C#3 독립 정적 검수·기한 보정2 재검수 | 원 I1 해소 scoped C0/I0 |
| Node6 독립 검수 후 Main 추가 반례·보정2 재검수 | 정정 I1 해소 scoped C0/I0 |

52에는 앞 ENROLL33이 포함된다. 이전33/52/직접3/마지막5는 중첩 합산하지 않았다. 마지막 변경은 owner의 초기 상태 guard 한 곳과 시험뿐이어서 직접 영향5·타입을 확인했고 불변 전체/verifier/build·기존 정리 QA를 재실행하지 않았다.

메모리 시험은 실제 preload/handler/owner/client·owned helper client가 합성 Session/child/보호 저장 포트를 소비한다. 공개 고정 RFC6979 시험키를 사용했고 실제 키 생성·실사용 키 접근은 없다. C# 시험 source는 실제 Store/Host 메모리 포트의 SIGN2/STORE/MATCH/REGISTERED·중복/유실을 작성했으나 **컴파일·RunAll은 NOT_RUN**이다.

**실제 TLS/cookie·Windows DPAPI/CNG/내구·설치형 앱의 실제 화면·DB/권한·키·서비스·Agent·배포·사용자 인수는 NOT_RUN/제외다.** 새 네트워크·파일 QA·컨테이너를 만들지 않아 이번 자원 생성/잔여는0이다.

## 결함과 판정 정정 이력

- 최초 실제 IPC ISSUE 미지원 RED(d16fb3) 뒤 전체 소스 종단을 구현했다. kind JSDoc 타입 진단1은 정확 union으로 보정했다.
- C# Store와 Node client가 credential 기한≤등록기한을 잘못 강제했다. 원 서버의 credential 기한은 min(now+15분, 정책기한)이므로 정상적으로 등록기한보다 길 수 있다. 정적 I1 및 실제 서버 형태 Node fixture의 ac7b42 RED 뒤 두 원값을 각각 보존하도록 보정했다. 실제 호출 예산은 최소값을 유지했고 서버/SQL·기준을 바꾸거나 기한을 잘라 저장하지 않았다. 등록60초/credential15분의 정상·불명 metadata 시험 source를 추가했다.
- Node6의 첫 C0/I0 뒤 Main88abaf 메모리 반례에서 UNKNOWN→새 requestId begin이 operation2(기대1)·원 attempt/label 소실을 확인했다. Reviewer가 r5 원 불명·pendingKeyId 보존과 대조해 **C0/I1로 정정**했다. 처음 놓친 판정을 지우지 않았다.
- 원 replay/active/기본 PROTECTION_UNAVAILABLE 뒤 IDLE guard 한 곳만 추가해 새 ID/operation 발급 전 거절한다. 새 UNKNOWN·실제 ISSUE 유실 반례를 RED→GREEN으로 검증했다. 기존 최초 replay/기본 오류/KEY_READY와 원 record를 보존한다. 후행 fake CREATE assertion 관측은 실제 효과가 아니며 WORK_STATUS에 분리했다.
- 동일 근본 보정3회나 Main의 제품 코드 인수는 이번 단위에서 없었다. 검사 기대값·합격 기준 완화/기존 시험 삭제0.

## 남은 범위와 복구

다음은 r5의 명시 복구·보호 관계 재확인과 이후 native mapping이다. 재시작 credential 사용·use-without-return은 아직 별도 미구현 범위이며 이번 결과에 숨기지 않는다. 실제 배포/실행 검증도 남아 **FN06·Stage B·전체 작업계획은 미완료**다.

화면 소스의 위치는 설치형 로컬 설정 등록 영역의 명시 발급 버튼이다. 현재는 합성 클릭 검증만 했으므로 실제 사용자 확인 방법/주소를 제공했다고 하지 않는다. 실제 실행 승인 없이 앱/서비스를 임의 가동하지 않는다.

복구는 정확 소유 commit diff의 정상 Git revert를 검토한다. reset/force·타인 변경 삭제0. 운영 반영이 없어 운영 rollback은 실행하지 않았다. 모든 위임·오류·미검증·다음 조치는 WORK_STATUS에 누적했다.

## 최종9 소스 바이트

inventory SHA256 **62778E45B54F7E7FDD862D4208FE0B8CE5AC73E23BE6ECA40F1F761BDDC56604**. 아래 순서 {path,sha256,bytes} 압축 JSON 배열 UTF-8 해시다.

| 경로 | SHA256 | bytes |
|---|---|---:|
| apps/desktop/src/trust-enrollment-owner.cjs | 5D3790F9B6A81929AFA32DD6D7981384CAAF679CD17CCD0DB4F741209BA95812 | 37688 |
| apps/desktop/src/trust-registration-client.cjs | B8090C487B9726EB0EA2616698D301F3924D36C05123BA12E0E12DD83C15E057 | 14791 |
| apps/desktop/src/policy.cjs | FBFB13498DCF707E70D3681BBCBF103E5E3F6575C9299EE45FACCE17250EAEC6 | 4761 |
| apps/desktop/src/settings.html | 07962B4A6F694ACAD82D3EE3E03B2DB26E7217C51A7832CEE9CD77FA898C539F | 3519 |
| apps/desktop/src/settings.js | 60B74EAB81BBBE33332D6F146F918266CAE08CF8ABC001BE7241C0AB86B9046C | 11757 |
| tests/desktop/desktop-trust-registration.test.cjs | 81FF1752793970DCFC24E5EF2B59BADB0A4755DCDD0CDC7C4DA5F2321810C076 | 53884 |
| apps/connector/native/DesktopTrustKeyHostSource.cs | 13AF7D0127742E0D1F884F127764DD3DF899D9DC671413159E4A28198C40EEE4 | 22398 |
| apps/connector/native/DesktopTrustKeyBindingStoreSource.cs | 8993A9D78623547CB2A416036D8C5ADD6076AA231E75BE98AA5A41FFAE68A100 | 20468 |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | 44CB98FD1E491228A155217B73CDF67206DA6EAC6D0B832A308F5751B98DD1FE | 33959 |
