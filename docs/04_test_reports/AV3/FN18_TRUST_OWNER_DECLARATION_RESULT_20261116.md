# FN18 등록 owner 타입 계약 검증 결과

## 판정

`trust-enrollment-owner.cjs`의 기존 진단 43건 중 소스 계약 40건을 해소했다. 고정 desktop 타입 검사는 기준 57건에서 **17건, exit 1**로 줄었다. 파일·진단 코드·전체 메시지의 중복 건수로 대조한 신규 진단은 0건이다. 등록 owner의 남은 세 건은 모두 생성 번들 `./native-proof-runtime.cjs`의 TS2307이다.

| 기준 | 값 |
| --- | --- |
| 브랜치 / 시작 HEAD | `codex/av3-native-connection-followup` / `1ed1dffe16f9e4714862dc9ad61504e69ea4b924` |
| 최초 r5 / 보완 r6 지시서 SHA256 | `C065E535A2FFD357DCDDA9EB8E4E1428E80EDA7D9EFE50ED9436FAC0F7A0FB6A` / `445D48D8F33C09D38BD8FBDC8F798E95223C83A1A69A505348CE0B8B533ADDEB` |
| 직전 수신 client 결과 | `c86a0d`, 57건, exit 1, LF 정규화 SHA256 `07535DC14D2BA4B896E6526B92832C3EAF855778194F23CE4F095DA41202F339` |
| 제품 | `apps/desktop/src/trust-enrollment-owner.cjs` · SHA256 `3FAC1310D466E2948D329E348B3DA1E2DD1FFA41771E4A335EC3478281E85612` |
| 직접 시험 | `tests/desktop/desktop-trust-registration.test.cjs` · SHA256 `CD92B7D2FA4F59E8D652C4BE15C22F7E0ABC7D8CA9E75182ED85063EB04C3F3C` |

## 변경 및 검증 근거

원 receiver 판독 성공의 타입 predicate와 닫힘 콜백, 수신 client·timer·slot·decoder·폐기 대기 secret·signal·영수증 facts의 생성/해제 타입을 명시했다. 공개 receiver·창·자료의 검산 전 입력은 `unknown`으로 유지했다. 수신 client는 실제 CJS factory의 반환 타입을 사용한다. slot·decoder는 기존 번들의 원 생성자를 그대로 호출하며 이 파일에서 사용하는 메서드를 private JSDoc로 표현한다. DELIVERY decoder의 `#readDelivery`와 `readReceiveDelivery`가 ref·authority·원 snapshot을 검사한 뒤 반환하는 필드만 읽는다.

r6가 허용한 실행문 변경은 세 곳이다.

1. snapshot의 symbol 키를 descriptor 사본에서 값을 읽기 전에 거절한다.
2. PHASE의 현재 `AbortSignal.prototype.aborted` descriptor에서 `get`이 함수인지 확인한 후 원 `Reflect.apply`를 호출한다. OPEN은 기존 `signal.aborted`를 사용한다.
3. 서명 전후 `fresh()`는 원 `runtimeStable()`과 주입 시계 호출 뒤 현재 `committed`를 다시 읽고 null이면 거절한다. `credential.expiresAt`은 그 시점의 현재 객체에서 확인한다.

메모리 역치환(`2c0acc`)에서 정적 편집만 되돌린 UTF-8/LF 본문이 원 HEAD에 승인 guard 세 곳만 적용한 바이트와 일치했다(SHA256 `783539B4D4BD66BE51929BDF0C388D4E21F01ACE095EF5B9D5E9CBB16D664556`). guard까지 되돌린 결과는 원 Git LF 109,974바이트 SHA256 `F853911271706EBD34BB2E7493BA536C2868A5B3DF6CCEB42FC1BFF838AFC8C5`, 원 작업 트리 CRLF SHA256 `9AA3F84F5432FEFE66C43A46312B6039240B5488A5AFDF6032C2426CDA7943D4`와 각각 일치했다. 직접 시험의 이번 추가·보완 세 곳만 역치환해 직전 수신 client 시험 SHA256 `3F5CD073C00C800ACF7F741C1DEE03CB9A317531EFC191E7189BCCB9167CF3D7`와 일치함을 확인했다.

## 정확한 명령과 결과

inner checkout에서 실행했다.

```powershell
node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false
node --test --test-name-pattern="REGISTERED phase operation은 strict current|phase 서명 시계 안에서|REGISTERED phase는 위조 AbortSignal|REGISTERED 첫 수신 receiver는 실제 Delivery|원 REGISTERED owner는 보호 원행|REGISTERED 실제 operation은 새 OPEN" tests/desktop/desktop-trust-registration.test.cjs
git diff --check development/main
git diff --no-index --check -- /dev/null docs/04_test_reports/AV3/FN18_TRUST_OWNER_DECLARATION_RESULT_20261116.md
```

- 첫 타입 검사 `1e387b`는 74건, exit 1이었다. 원 TS 클래스 두 개를 JSDoc에서 직접 참조하면 CJS→ESM TS1542 2건과 원 connector/contracts의 전이 TS5097 47건이 desktop에 들어왔다. 설정·원 TS·패키지 변경 없이 owner 전용 소비면을 선언했다.
- 중간 검사 `2eaef9`는 18건, exit 1이었다. decoder의 전체 결과를 `unknown`으로 선언해 이미 검산한 `decoded.metadata.snapshot`에 TS18046이 남았다. 원 decoder가 검산한 DELIVERY 전용 반환형으로 바로잡았다.
- 최종 타입 검사 `a0263d`는 17건, exit 1이었다. 삭제 건수는 TS7006 13, TS7034 8, TS7005 12, TS2538·TS2345·TS8024·TS2532·TS2769·TS2349·TS18047 각 1건이다. 기준 대비 신규 0건이며 잔여는 수신 client 1, 등록 owner 3, 정책 1, shell 12건이다. UTF-8/LF 최종 진단 SHA256은 `087B421CE8391A12928F39C6741D3317270B0182CA6BCAFD9B98CB1BE11235B5`이다.
- 최종 RAM 시험 `eb266c`는 **6 PASS, 0 FAIL, 0 SKIP, exit 0**이었다. 원 REGISTERED controller와 OPEN/PHASE 서명, Delivery decoder→credential slot 수명, 원문 symbol getter 접근 0, PHASE의 aborted descriptor 부재/일반 데이터값 거절과 후속 정상 서명, 주입 시계 안의 owner 문맥 폐기 뒤 키 호출 0을 확인했다. private `committed` 값을 시험에서 null로 강제 변경한 경우는 없다.
- `4e00a5`에서 main 대비 tracked 공백 진단 0건, exit 0이었다. 신규 결과서의 no-index 공백 검사에서 공백 진단은 0건이다. 빈 파일과의 내용 차이는 exit 1로 표시된다.

## 미검증과 인계

전체 desktop 타입 게이트 17건은 미해결이다. 실 Electron 앱·설치/패키징·native/SDK·DB·서비스·실권한은 검증하지 않았다. RAM 결과는 기존 보호 포트의 소스 흐름에 한정된다. 새 공개 API·등록 권한·생성 번들 shim·tsconfig·종속성 변경은 없다.

복구는 owner의 이번 정적 선언·세 guard, 시험의 이번 세 곳 및 이 결과서에 한정한다. 앞서 수용한 수신 client·UI14와 settings/preload 및 Main의 문서 작업은 보존한다. Git 및 작업현황은 Main이 관리한다.
