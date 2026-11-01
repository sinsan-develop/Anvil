# FN06 native factory 일회 ticket 원본문맥 source 결과

2026-11-02 / Main 어울 / **SOURCE 내부 연결 검수·통합**

## 기준·변경

원 r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085, 파생 WI FN06_NATIVE_FACTORY_CALL_CONTEXT_SOURCE_IMPLEMENTATION_20261102.md SHA613F533708525C0E4ACD0D47D9A7E0D5CC401E925AC65CD2888E47CA34C0F162의 정확3경로다. 기존 Reviewer preflight C0/I0 후 기존 Primary 단일 writer가 구현했고 Main 제품쓰기0이다.

시작 branch codex/av3-stage-b/local-private42bb47a6b0790e3e33fe83c2c269f6a4b7f6196b에서 code e12c43779c510448f48fea9decfaff2c4de84451로 정확3/58추가5삭제를 checkpoint했다. Mainc67ecf raw/staged3동일·stageddiff0. 다른 제품/시험·원 SQL/승인/WI·보호untracked3는 수정하지 않았다.

| 경로 | 최종 SHA256 |
|---|---|
| apps/connector/runtime/native-preparation-client.ts | 5A1888082D8718639D1B29B08E2531471A0E85109F4FB211E43418EB62A0DEEE |
| apps/connector/runtime/native-preparation-factory-consumer.ts | 2D908FAEE99D78C780FE3D9F6B3017D55850D757909D55CA742FC5D9B6C139DA |
| tests/unit/FN06/native-factory-call-context.test.ts | 618FFC7D77FB6976E30CCE9FF0638AAC228753F2287C70A594B98A4F84E1784D |

## 연결한 동작

실제 client가 검증한 authority·receipt·consumeRecordRef·permit의 원 fullref/snapshot을 내부 consumer에 전달한다. consumer는 exact shape/hash·원 tuple·factory/false/기한을 재검산하고, 모듈 private WeakMap에 실제 발급 ticket과 정확 factory 객체를 결박한다.

새 helper는 임의 consume 함수/getter·JSON/복제·다른 factory 객체를 실행하지 않고 거절한다. 원 ticket.consume()의 current/기한/receiver·단발 검사를 성공적으로 await한 뒤에만 동결 원본문맥을 반환한다. 동시/선후 소비·head변경·기한·미정착/종료 뒤 늦은 반환을 차단하고 helper 첫진입과 consumer finally에서 entry를 회수한다.

기존 flat consume()·outcome·wire를 보존한다. 완전 문맥 없는 기존 합성 소비자는 flat 경로를 유지하지만 새 helper는 UNAVAILABLE다. 실제 client는 완전 원 문맥을 제공한다. 새 HTTP/DB/credential/key/정책·C# bridge wire/권한을 만들지 않았다.

## 실제 검증

- Primary80374c 실제 기존모듈/client 문맥 소비 UNKNOWN의 행동RED 뒤8b0427 정상GREEN을 확인했다. b07870 신규9+기존client14=23PASS/440.7454ms, 이후 최소기한 음성1을7d350d 1PASS/168.33ms로 분리했다. wrapper 정적 타입1건은 검증된 ref/snapshot 명시 투영으로 보정했고baf53d 최종type/diff0이다.
- Mainfc3125 최종3snapshot에서 신규10+변경 직접영향 client14=24PASS/0FAIL/skip0/427.3111ms·최종type/diffexit0을 확인했다. Primary 수치와 중복합산하지 않는다.

```powershell
node --test tests/unit/FN06/native-factory-call-context.test.ts tests/unit/FN06/native-preparation-client.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

신규10은 실제 client→발급ticket→새helper의 원본문맥/fakefactory1, 위조/getter·복제·다른factory, flat 선소비, 완전문맥부재, 재봉인불일치/false/기한, 동시소비, current await 중 head변경, 미정착 helper의늦은문맥·unhandled0, invoke오류/finally재사용, 원최소기한 소진을 포함한다. 기존 server/UI/App/journal/HTTPS 전수는 불변이므로 반복하지 않았다.

기존 Reviewer 정확3 독립 C0/I0·시작끝3SHA동일. client의 원본 전달, consumer 검산, helper의 원consume await, 미정착/finally 회수 및 flat경로 보존을 읽기 검토했다. Reviewer 시험실행0이다.

## 미완료·복구

이 문맥은 같은 source 프로세스의 ticket provenance 데이터다. raw JSON이나 helper 결과가 native OPEN·Anvil 부모/package·private channel·OS 권위를 입증하지 않는다. C# bridge/peer보호producer·holder OPEN/QUERY/CLOSE/불명수명계약은 미정·미구현이다. PMO도 확인한 범위에서 재사용 가능한 검증된 부모/package/channel producer를 찾지 못했으며 전수 부재로 단정하지 않았다.

실제 C#/compiler/helper/PInvoke/OS·네트워크/TLS·CA/키·파일·DB/권한·서비스/native·Agent·실자료/백업·P03R3 실행0. live handle0/실효과0은 제출·합성검증 범위다. 전체 FN06/FN08/Stage/계획 완료·PR/main병합·배포·인수0. source 복구는 별도 code commit의 정상 revert 후보이며 기존 자료·DB·서비스 복구를 실행하지 않는다.