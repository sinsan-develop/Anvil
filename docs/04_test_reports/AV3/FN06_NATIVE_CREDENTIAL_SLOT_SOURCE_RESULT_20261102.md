# FN06 native 준비 credential private 휘발 slot source 결과

2026-11-02 / Main 어울 / **SOURCE 비밀 수명·HTTPS 내부 연결 검수**

## 기준·변경

원 r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085, 파생 WI FN06_NATIVE_CREDENTIAL_SLOT_SOURCE_IMPLEMENTATION_20261102.md 최종SHA6DAA7189E88A7A57C5DA19A6250764FA3B4535C29965E9BE1BB8544379172BD5를 따른다. 초안의 식별/expiry 일치 문구 I1을 식별5 exact·더 짧을 수 있는 전달 최소기한 고정으로 보완한 뒤 preflight C0/I0를 확인했다. 원 r2/wire/권한은 변경하지 않았다.

기존 Primary 단일 writer·Main 제품쓰기0. 시작 branch codex/av3-stage-b/local-private1b2e3018ebfcd9bcc86dcc6982cc05bdd1e0ec9c에서 codee85911d5dde12210e8b05c8af49810d17fe6b746 정확신규2/81추가로 checkpoint했다. Main14c064 raw/staged2일치·stageddiff0. 기존 제품/시험·SQL·StatusOnly 보호 저장/서명·보호untracked3는 수정하지 않았다.

| 경로 | 최종 SHA256 |
|---|---|
| apps/connector/runtime/native-preparation-credential-slot.ts | BD999A1B5D69D1AB7EC31B62BC2F35A0EFDA57A8DDE5EC6574560222F58A28C7 |
| tests/unit/FN06/native-preparation-credential-slot.test.ts | 634FC7D576D99AEED9CDD826ABCE63DFBE971E9062D4845246A878E43C1778FB |

두 파일 8742B/20084B·UTF-8 LF·CR0·후행공백0이다.

## 구현한 기능과 제한

정확 delivery6metadata와 별도 native opaque43 bytes를 원 authority/identity에 묶어 private 복사본으로만 보관한다. 식별5값은 exact이며 expiresAt는 authority 이내의 유효한 전달 최소기한으로 고정한다. 같은6+비밀 중복은 기한/channel/단조 예산을 갱신하지 않고 다른 tuple/비밀은 원 값을 덮지 않는다.

private protection closure로만 기존 HTTPS channel에 bearer와 원 credential 기한을 공급하며 같은 slot은 같은 channel을 반환한다. 새 raw getter·plaintextRead API·일반 결과/로그·기존StatusOnly 파일/키 연산을 만들지 않았다. 부재·만료·UTC/단조 후퇴·회수/종료·await 뒤 변경은 새 사용을 막는다. 재시작 후 비밀이 없으면 UNAVAILABLE이고 자동 복구·재전달/재발급·factory 재호출0이다.

**accept는 void인 내부 데이터 수용이며 ACK·ackRef·CONFIRMED·보호된 수신자 인증·native OPEN 권위가 아니다.** source 프로필/current·등록 signer·보호 전달/수신자/ACK producer는 여전히 없으며, 임의 CA/선언값을 검증된 보호 source로 승격하지 않는다. 완전 메모리 소거·진행 중 network 취소·서버 revoke를 보장하지 않는다. 이 휘발 보관은 서버 DELIVERY_ATTEMPTED와 local attempt journal의 내구성을 대체하지 않는다.

## 실제 검증·독립 검수

- Primaryadf549 모듈부재는 준비실패다. f0135c 실제 Client→기존 HTTPS의 UNKNOWN 행동RED 후a83711 정상1PASS를 확인했다. 최종0c6f32 신규10PASS/336.0086ms·ff3714 HTTPS정상1PASS/319.9382ms·d66674 type0·한정diff0을 제출했다.
- Maind45bee는 모든 시험 생성지점의 명시 request 대역과 동결지문을 읽은 뒤 Main995b7e에서 신규10PASS/0FAIL/skip0/241.798ms와 HTTPS 직접 정상1PASS/0FAIL/skip0/189.3073ms·최종type/diffexit0을 확인했다. Primary 수치와 합산하지 않는다.

```powershell
node --test tests/unit/FN06/native-preparation-credential-slot.test.ts
node --test --test-name-pattern='^실제 NativeClient→HTTPS adapter' tests/unit/FN06/native-preparation-https.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

신규10은 실제 client→slot→기존HTTPS→원journal/fakefactory1·ACK0, alias/정확중복, 충돌tuple/비밀·기한, 짧은정상/authority초과, 생성/부재/재시작, timer/UTC/단조후퇴, 동일channel/원10초, getter·source회수, pending read/sign/response 중dispose/late, profile/signer만료·변경을 포함한다. 각 시험 finally dispose와 timer0을 단언했다. 모든 실행 시험은 명시 request 대역이고 default 실제 request0이다.

기존 Reviewer 신규2 독립 C0/I0·시작끝2SHA동일. exact metadata/expiry와 private복사·cachedchannel·보호closure·종료/await·한계를 읽기 검토했다. Reviewer 시험실행0이다. 기존 server/UI/App/journal/client/HTTPS 전수는 불변이므로 반복하지 않았다.

## 잔여·복구

실제 보호 sender/recipient·ACK/profile current·등록 signer/issuer·native factory/bridge·holder·journal 제품등록은 미구현/미정이다. 실네트워크/TLS·CA/키·Secret파일/저장·DB/권한·C#/helper/compiler/PInvoke/OS·서비스/native·Agent·실자료/백업/P03R3실행0. knownlive0·QA0는 제출·합성검증 범위다.

전체 FN06/FN08/Stage/작업계획 완료·실제 지원·PR/main병합·배포·사용자인수0. source 복구는 code commit의 정상revert 후보이며 실제 자료/키/DB/서비스 변경·삭제는 수행하지 않는다.