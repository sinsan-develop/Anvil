# UI11 native 준비 r2 A — 화면·승인 연결 source 검수 결과

2026-11-02 / Main 어울 / **SOURCE 부분 검수·통합, 실제 사용·전체 계획 미완료**

## 기준과 변경

- 채택 계약: FN06_NATIVE_PREPARATION_AUTHORITY_CURRENT_CONSUME_CANDIDATE_20261102.md SHA256 5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085. 직접 승인 기록과 WI3905A46EEE54AF75C1971C66A51A8D1AB5E6F2EA439462F4192F53FDA151C1F6의 정확27경로 안이다.
- 시작 local/private d1c058e4a63a5fdc340efd6b6529b0a5fae58868, branch codex/av3-stage-b. 기존 Primary 단일 writer가 UI9를 구현했고 Main은 제품 코드 쓰기0이다.
- 코드 checkpoint d910590528bb0d64a3e9fcdfdb940d34f6d2e796: 정확9경로·203추가/20삭제. Main b0b937에서 raw/staged blob9 일치·diff0을 확인했다. protected untracked3와 서버/SQL은 수정하지 않았다.

## 연결한 화면 동작

- UI11 기존 연결 화면의 접힘 진입은 GET/POST0이며 명시 조회로만 서버 options를 가져온다. 검증된 등록·도구·scope를 선택하고 이유/확인을 입력한 뒤 원 head1·정확 원명령을 준비한다. 임의 actor·물리 경로 입력이나 수동 ID 대체는 없다.
- 저장은 별도 명시 행동이다. 승인 필요 시 UI08 요청→별도 결정→동일 원명령 결박→명시 저장을 거친다. AUTO/REQUIRE_APPROVAL/DENY와 기존 공통 오류 의미를 보존한다. 저장은 실제 Agent 실행·쓰기 허가·회수 성공 표시가 아니다.
- UNKNOWN은 원 body/command를 보존하고 같은 원결과만 명시 재확인한다. 저장 영수증 뒤 고정 GET 오류는 저장 실패로 뒤집지 않는다. 조회 응답의 exact fields/hash/typed 사건을 검산하며 보호 비밀·digest를 표시하지 않는다.
- project/user/client/session/CSRF/API/transport 문맥·닫기/unmount·늦은 JSON/hash/승인 응답을 분리한다. 부모 CAS는 기존 미완료 원버퍼를 보존하고 새 문맥의 적법한 버퍼만 교체한다.
- 기존 준비 정책10행동에 새 준비2만 추가해 정확12×3처리를 표시한다. 기본미선택·별도 확인·원규칙 보존을 유지하고 실제 사용자 정책/권한을 부여하지 않았다.

## 실제 검증과 한계

1. Main 7994e5→088d00→068e62: `node --test tests/unit/UI11/native-boundary-preparation.test.ts tests/unit/UI11/preparation-policy.test.ts` — 메모리 React13+정책4=17PASS/0FAIL/skip0/8110.5174ms, type/diff exit0. 마지막 I1 보완 전 snapshot이다.
2. 독립 첫 검수 C0/I1: 별도 결정 control/POST pending 중 문맥교체의 lock/busy 회수 ticket이 빠져 현재 화면이 옛 Promise 정착까지 잠겼다. Main 0dc6ba도 소스에서 확인했다. Primary ceafc1 실제 React RED 후 native 결정에만 소유 ticket·현재성·finally 검사를 연결했다. 비-native 분기는 불변이다.
3. 보완 후 Main 1fffdd: `node --test --test-name-pattern='^native 별도 결정 control 대기의' tests/unit/UI11/native-boundary-preparation.test.ts` — 해당1PASS/0FAIL/skip0/1588.0965ms, 최종 `tsc --noEmit -p tsconfig.base.json`·diff exit0. transport/session ABA 뒤 현재 조회 복구·옛 finally의 새 latch 해제 방지를 검증했다. 전체18을 최종 단일 실행했다고 주장하지 않는다.
4. Main 8167ba: 기존 `tests/unit/UI08/approval-api.test.ts` 직접6PASS/0FAIL/skip0/242.31ms. Primary 자체17/6/보완1 결과와 합산하지 않는다.
5. Main 8167ba 최종 Vite 메모리 빌드: configFile:false/envDir:false/write:false/lib IIFE/minify:false. Panel150227B SHA6E59D4CDA6855262F9EFA12253AFAD284C7EE5CA0BB4226FAF470A86B56F7EFF, runtime server/Node/external imports0. App4145088B SHA7894573EE06276A26BD4CCE71ACA357209929356ED73D474D59B918A8FF81CAB, Node/external imports0이나 기존 server modules2(plan-dependencies/document-diff)는 포함된다. App전체 server0은 PASS가 아니다. 기존 chunk.imports0와 modules0은 다른 검사다. Main27646d로 기존 Web 호출2를 확인했고 무관 import 정리는 하지 않았다.
6. 독립 scoped 재검수: I1 ADDRESSED·C0/I0. Page0B5CA61E…9CA5FD/시험772D0935…8CE62D 시작끝 일치, 제품 보완 역치환 hash는 직전 Page와 일치해 비-native 불변을 확인했다. Main은 직접 새 음성과 타입을 별도 확인했다.

메모리 React 검증은 합성 부모에서 실제 Page·이벤트·effect를 실행한 범위다. App 본체 클릭·실브라우저·레이아웃·실 HTTP/DB·실제 권위/사용자 인수를 확인한 것이 아니다. App은 소스 검토와 메모리 빌드만 수행했다.

## 오류·미확인 기록

- typed 사건 reason 검산 누락 ac26c4 RED→1d8c79 GREEN, 타입 unknown 좁힘4건 실패→81612f type0을 구분했다. 출력 미회수1은 NOT_OBSERVED다.
- I1 첫 보완 f358ef는 기능 단언이 통과했지만 load/list 정착 전 시험 환경 회수로 비동기 window 오류·exit1이었다. 경고 억제나 기대값 완화 없이 후속 정착을 기다리는 cleanup으로 보완한 뒤 72cc84 및 Main1fffdd를 확인했다.
- Main37f631은 Vite 반환을 단일 object로 가정해 output.filter에서 준비 오류·exit1이었다. 배열 반환 정규화만 보정한 8167ba가 실제 빌드/인접6 검증 결과다. 제품 빌드 실패로 혼동하지 않는다.
- 실제 DB·권한·키·CA/TLS·서비스·native/helper/compiler·Agent·실자료/백업 조사·P03 R3 실행0. 실제 공급자 미등록/지속 journal·factory·실 START/SEND/STOP·물리 강제는 여전히 미구현/미연결이며 단순 추후 테스트로 숨기지 않는다.
- 전체 FN06/FN08/UI11·Stage/계획 완료, PR/main 병합·배포·사용자 인수는 아니다. live handle0/QA자원0은 제출 범위 기록이다. source rollback은 해당 code commit의 정상 revert 후보이며 실제 DB 미적용으로 down migration/자료 삭제0이다.

## 최종9 SHA256

| 경로 | SHA256 |
|---|---|
| apps/web/src/App.tsx | 219A24F9FA656D34C03BF9979D2C768BF39D735C4092DD409FF096315C666E7A |
| apps/web/src/features/connections/ConnectionsPage.tsx | A58329600F4A36DD198524B5D8DA567FB2F68FCCA0D89DF1A26A3AF2ECE45B30 |
| apps/web/src/features/connections/policy-editor-profile.ts | 922DC51AAC0D356666E7E7BBB67DBC37B498AFD2984E108E10A6F1EA975FE71A |
| apps/web/src/features/decisions/ApprovalsPage.tsx | 0B5CA61E9DEFC85FCF94CD91DB98CBA6FBFAACFE9F167E88048F496B119CA5FD |
| apps/web/src/features/decisions/api.ts | D6D19F23C2992D58F32862460919B9B0A5CC02B3209C9761CA8E0D96750B86F7 |
| apps/web/src/features/connections/NativeBoundaryPreparationPanel.tsx | 9D292B7D5B289C521FB3CF84ED44CCF99CE94D6E7F5CDD7D6D12FFD97F721AF6 |
| apps/web/src/features/connections/native-boundary-preparation-api.ts | 096A02F9E3C17A1FD68CFD20CA688FC5799304547FE490D59502FD3AF76848E9 |
| tests/unit/UI11/native-boundary-preparation.test.ts | 772D09355DDD64D31D158C6E92BDF47B2228E70A63720B690E2D359BCE8CE62D |
| tests/unit/UI11/preparation-policy.test.ts | 8E045C88A8EED438C59A2D39BCA6468416B7D3A7785D28B49D5DCF005F30EDB8 |