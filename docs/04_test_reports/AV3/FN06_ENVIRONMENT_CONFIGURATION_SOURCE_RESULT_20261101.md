# FN06 환경 정의 r4 — 소스 부분 구현·검수 기록

## 1. 판정

**허용된 소스 변경을 부분 수용한다. 전체 FN06·작업계획·실제 환경의 완료/인수는 아니다.**

- 코드 checkpoint: `a1398da511946540f05ee6c8d4ac7ae9e10cd2fb`, 부모 `3d3d1d16511216942c0fb24c7a8fc8b9289096f6`, branch `codex/av3-stage-b`.
- 직접 승인 기록 SHA256 `E56BC7DC86998BAF7E40668E8687DEAA84F1F57994D8D972BD352EDCCD721579`.
- r4 계약 SHA256 `BA002F75E66D2A07374F1919F241AB1F843E839AF0D6F9CBEEB0603951DD1EBA`.
- 현재 WI SHA256 `AACE847CA6010B1FCEEF2EE7B6FBF0ED9487A352CEB9E9A0014DA0D10FC715A8`(부모 `66503F67…`, 공유 Node fixture 한 경로 추가의 비의미 재확정).
- Main 어울은 관리·검수·Git 통합을, 기존 Primary는 제품·시험 단일 쓰기를 수행했다. 기존 Reviewer는 읽기 전용으로 검토했다.

| 기능 | 이번 소스 상태 | 실제 환경 상태 |
|---|---|---|
| 호스트 선언·명령 프로필·비밀 논리 참조 | 버전/개정/회수·보호 조회·현재성·metadata 6명령 별도 승인/일회 소비 구현, 합성 핵심 확인 | DB 미적용·실동작 미확인 |
| 원형 9필드 환경 설정 | AUTO 저장·목록/고정 조회·출처/관계/원증빙·현재성 분리 구현, 합성 확인 | DB/OS/현재 등록 진위 미검증 |
| 환경의 연결 정의 결박 | 보호 선택→환경 저장→명시 정의 준비/저장/fixed GET의 소스·합성 흐름 확인 | 실제 App/WSL 여정 미확인 |
| 완성형 환경 REQUIRE_APPROVAL | **미구현·412 차단 유지**. 새 승인 원문 저장/조회/소비 계약 507B 미채택 | 실행 불가 |
| 실제 Agent·키·서비스·DB/권한 적용 | 이번 범위 제외, 실행하지 않음 | NOT_RUN |

미채택 보완: `docs/contracts/FN06_ENVIRONMENT_APPROVAL_PAYLOAD_BINDING_ADDENDUM_20261101.md`, SHA256 `507B6E34B2C6C8D46CE2E57AF8CFCC562A64F07FB4DD2B1A916A57BA4AAF93BE`. 문서 후보만 보존하며 이를 구현 승인으로 사용하지 않았다. 기존 후보 승인도 완성형 환경 승인으로 재사용하지 않는다.

## 2. 판단 이유와 검증 증거

### Main이 최종 동결에서 실행한 검사

| 검사 | 실제 결과 | 증거 경계 |
|---|---|---|
| 새 화면 정상·승인·관측 ABA 직접 영향 | 17894e: 4PASS, native0, 4034.5684ms | 실제 React Host·buildApp.inject·합성 저장. 실제 App 본체/브라우저/DB 아님 |
| 기존 정의·보고 직접 인접 | 25db32: 정확 5PASS, native0, 1416.8723ms | null/auto·replay·used/held/보고 합산·초과 rollback |
| TypeScript noEmit | 97552a: exit0 | 최종 소스 타입 |
| App 메모리 IIFE build | 762757: exit0, 1 chunk 4,060,560B | configFile/envDir/publicDir false, write:false, execute:false |
| diff 검사·범위 | d76f2a: diff --check0, 허용 밖 제품 변경0 | 코드 28파일 변경, 기존 Panel/API 2파일 유지 |
| 검사 전후 지문 | 30파일 동일 | 실제 검사된 파일과 최종 동결 동일 |
| commit blob 대조 | 60138d: 코드·시험30 + WI1, 불일치0 | 로컬 검증 bytes와 위 코드 commit bytes 동일 |

최종 UI 선정 명령:
```powershell
& 'C:\Program Files\nodejs\node.exe' --experimental-strip-types --test '--test-name-pattern=실제 생산 metadata·SourceRoot 보호 선택|실제 승인 화면은 metadata|환경 승인 준비 대기 중 관측' tests/unit/UI11/environment-configuration-ui.test.ts
```
인접 선정은 기존 두 FN06 시험에서 다음 다섯 이름만 실행했다: null/auto 정의 producer→고정 reader·replay, 합산 마지막 byte/초과1byte, 정의 producer→v2 보고→fixed/replay, used/held+보고 합산 초과 rollback, 보고 존재 후 정의 writer 총량 거절. 정확 명령은 같은 일자의 WORK_STATUS와 실행 증거 25db32에 연결한다.

구현자 c26ccf의 신규 4시험파일 45PASS와 f01cec의 인접 5PASS는 마지막 한 줄 guard 전 증거다. 마지막 guard 후 2a14c7의 ABA2·f6f0d2 타입·d11b67 App 메모리 build를 수행했고, Main이 최종 상태에서 위 4/5와 타입/build를 확인했다. 45+5와 그 부분집합인 재검사를 더해 중복 합격 건수를 만들지 않는다. 전체 프로젝트 전수 회귀는 실행하지 않았다.

### 독립 검토와 수정 이력

- runtime 원형·자원/환경 관계·등록 증빙·현재성·응답 한도·Web API/승인 helper·UI 부모/CAS·시험 신뢰성은 범위별 읽기 검토 C0/I0로 확인했다. 최종 관측 guard는 정확 한 줄 제거 시 직전 F6EC 지문으로 복원됐다.
- SQL의 새 표 직접 원문 조회/쓰기 보호 누락 I1을 세션/OWNER/종류별 현재 read RLS와 한정 쓰기·역사 검산 접점으로 보완했다. aggregate는 수치/무결성 결과만 반환하며 자식 원문 getter를 만들지 않았다.
- 보고 내부 검산에 공개 정의 read 정책을 재적용하던 I2는 실제 합법 A/B 반례 RED→GREEN과 독립 scoped C0/I0로 보완했다. 공개 GET403·변조503·nonnull 보고412·총량은 유지했다.
- 승인 요청의 관측 문맥 A→B→A에서 옛 POST가 재개되던 W-I1은 실제 React RED2→GREEN2와 독립 C0/I0로 보완했다. 옛 추가 정책 GET/POST0·늦은 결과 폐기·현재 A의 명시 재시도·원명령 보존을 확인했다.
- 기존 두 시험의 diff는 필수 aggregate fixture 적응뿐이며 기존 단언/기대값/거절 기준 삭제·완화0을 독립 대조했다. 새 fixture는 미모델 SQL을 거절하고 무결성 실패를 complete=false로 반영한다.

작성/시험 준비 오류는 제품 실패와 구분해 누적했다: SQL replacement 문자열의 달러 인용 손상은 새 꼬리를 복구해 앞부분 지문·중복/인용을 확인했다. canonical JSON과 JSON.stringify wire 비교, 누락된 POST Content-Type 병합, rollback 뒤 옛 객체 복구, aria-label 탐색과 타입 오류는 해당 준비 범위만 보정했다. 새 시험이 없던 e2f7a1 결과는 기능 증거에서 제외했다. 이 기록을 동일 제품 실패 3회 또는 실제 PG 문법 합격으로 포장하지 않는다.

## 3. 조치·제한과 다음 단계

1. `.pending` 0069는 **미적용**이다. 실제 SQL 구문/최초 함수 호출·RLS/ACL/OID·동시성/성능·실등록/OS·TLS·서비스·실 Agent·사용자 인수는 NOT_RUN이다.
2. browser harness는 합성 seed/상대경로만 사용하고 Node fixture import/실 fetch fallback이 없다. 미모델은503, 실권위는false다. 메모리 build와 React Host 결과를 실제 브라우저/App·DB 수용으로 승격하지 않는다. 승인 결정에 helper 호출 구간이 포함된다.
3. 실제 DB/DDL·GRANT/정책 부여·계정/키/Secret/인증서·서비스·유료/실 Agent·실사용자/백업 자료 조사·기존 프로젝트 차단 해제는 하지 않았다. 이 실행에서 영구 QA 자원 생성0, Native 도구 세션은 종료됐다. 기존 호스트 전체의 자원 상태를 새로 조사하거나 0으로 단정하지 않았다.
4. 원 0059/0065/0067 지문과 보호 untracked3을 보존했다. main·다른 branch/기존 자료 정리0, PR/병합/배포0이다. Git LF→CRLF 예고 경고는 보존했고 설정을 바꾸지 않았다. 이번 raw/blob bytes 동일성은 별도로 확인했다.
5. rollback은 이 코드 checkpoint의 정상 revert 검토로 한정한다. 실제 DB 변경이 없어 DB rollback은 실행하지 않는다. reset/rebase/force push/보호 자료 삭제는 금지한다.
6. 다음은 507B의 기존 채택 질문 확인과, 승인·선행 안의 다음 미완료 단위 선정이다. 미채택 경로를 구현 완료나 추후 테스트로 숨기지 않는다. 전체 Stage/FN06/계획 완료·main 병합은 선언하지 않는다.

### 계획 현황의 비의미 재확정

FN06/UI11 상태와 이 결과 링크만 갱신한다. 기능·요구·선행·검수/보안 기준은 그대로이며 직접 승인 E56 및 기존 계획 승인을 부모로 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 기록한다.
- 정본 계획 이전 `8C6761D5D77DA0BFA9A6696681740A1E90ED7C0A15806387011A10513B7DAAB7` → `B53B0148395AA556219D346AF7858017DF5D9498B68BC674F09FD26369993D25`.
- source 계획 이전 `F0A7CBF209A40786BE8ECBF48767F9055E9B3F21E035E7971449E51E0109014F` → `F70B5E6933E770603D45BE577424AB40E1C9EC7B1EC7EAE276618CDE70DAF016`.
두 계획의 기존 OS fixture/UI06 진도·실패 이력 표현 차이는 읽기 검토상 의미 충돌이 없었고 이번 갱신에서 서로 덮어쓰지 않았다. 다른 행/이력은 보존했다.
로컬 코드 commit은 위 a1398da5이며, 게시 결과·후속 문서 checkpoint는 WORK_STATUS의 실제 Git 검증 기록을 따른다. 이 문서 작성만으로 remote 동일을 주장하지 않는다.

## 4. 검사된 소스 지문

| 저장소 루트 기준 경로 | 실제 변경 | SHA256 |
|---|---|---|
| `apps/server/modules/projects/routes.ts` | 변경 | `11768F5E47A299A33829688E8E6A139964118C9C859633E7F6BE2903F79EF8F7` |
| `apps/server/modules/access/project-command.ts` | 변경 | `41C003CD980BD9E6FDF36760008BEDE6208B27D6BA93EA3F9AB3C1CD97F14327` |
| `apps/server/modules/approvals/project-approvals.ts` | 변경 | `C02B02A64D2BC2B6DF4600DBBA4BD7196B63B69AC629B92B98A0138BFBBE0040` |
| `apps/server/modules/connections/project-connection-definitions.ts` | 변경 | `74EF6C95EA9B5580F528BC8CBC3EFB161A81ADA7161331A89772CCAE28BFCFB7` |
| `apps/server/modules/connections/project-definition-capability-reports.ts` | 변경 | `8BD6768280BB0965AA4859DC0F315694B1575307D322B91058466EB5DDB56914` |
| `tests/unit/FN06/connection-definitions.test.ts` | 변경 | `0982575C90D8AD61440576CCBA128D7A87E9E2BA584298419D8160C4ED5BA9A7` |
| `tests/unit/FN06/definition-capability-reports.test.ts` | 변경 | `D0760A8A9791BC71253D0613257BADA3092BC44AD1C7E8DD2361D787A0A641FB` |
| `apps/web/src/App.tsx` | 변경 | `E13BA3AA6F2A5F2E6E451BDCAB210C08C2FE47E2C4AC8CD3110C84572B97BFE6` |
| `apps/web/src/features/connections/ConnectionsPage.tsx` | 변경 | `904878E597DF1787951E12A4B13AEE815FA6D98C5606B8D323919F87767073B7` |
| `apps/web/src/features/connections/ConnectionDefinitionPanel.tsx` | 기존 유지 | `CE1BC38A9E2D7A6E9D004BB96A3237FC5C2A242B84DEEBE4D730434B8C31090C` |
| `apps/web/src/features/connections/connection-definition-api.ts` | 기존 유지 | `1FF5EF27F0C9B085AD9D666F1595E908DDFB29E42DD151CE07444EF6E2146C29` |
| `apps/web/src/features/connections/policy-editor-profile.ts` | 변경 | `804C3C6A5939AAA5DADF9F57E178DCB77048EBA22BD5ABAEA67F9BB5AF05D257` |
| `apps/web/src/features/connections/CandidatePolicyPanel.tsx` | 변경 | `38B88FC2E87D0ED0C5B814B91C0F4479F4E0EB8C6683D8818A678E5D1AE40CBE` |
| `apps/web/src/features/connections/candidate-policy-api.ts` | 변경 | `1A9B950C4302BBB8182F87A803AAAD8F1A5418F375F67DDF3ED328E0180FDC4A` |
| `apps/web/src/features/decisions/api.ts` | 변경 | `F8F586DB032DACC4784EEDCFF9B65B7ABD64A56FF00561420EDCAC30C0BADF90` |
| `apps/web/src/features/decisions/ApprovalsPage.tsx` | 변경 | `80C16DFD51D4D4FDB0054DE00DE61370CE04DBBF996849E9BD9B448F68B97BFB` |
| `contracts/runtime/environment-configuration-v1.ts` | 변경 | `CEE1F1FAB2EC0E4259C4E0A782B2237A7ED525AF52977A8CDC66F89FFAAD9A77` |
| `apps/server/modules/connections/project-environment-resources.ts` | 변경 | `202BA93C7CFBEFF7A5ACAF58DC12A28656AD37478FB41604EC1B9739921F6350` |
| `apps/server/modules/connections/environment-registration-evidence.ts` | 변경 | `976EFEFA2D97A1CA2A2A5C1D18CA17741992E044A3C0C3C7D72E3C810E62BC39` |
| `db/migrations/0069_environment_configuration.sql.pending` | 변경 | `2C8F3E072B9810D5D9907E0B3E5BB17C0AC72DB132EABA0DEF8E6E5583865316` |
| `tests/unit/FN06/environment-resources.test.ts` | 변경 | `84D7E8BF244C5027577E900BDC6AA8AB660C457689E2A5B4531A45009B1A2C4A` |
| `tests/unit/FN06/environment-configuration-schema.test.ts` | 변경 | `7B2B8B6877C3150B961ADA3C48E930AA1B778E0BB22B1749719F2FD524C5016F` |
| `apps/server/modules/connections/project-environments.ts` | 변경 | `EDEB12C3A3CB5738285B2DC42B565F516935488539957F33ADF268F2CF06BAD8` |
| `tests/unit/FN06/environment-versions.test.ts` | 변경 | `39D8C480EDEFA456D093CD33B3A04377FD428E16CD6606F3DE0E353F1B5A28D8` |
| `apps/web/src/features/connections/environment-configuration-api.ts` | 변경 | `8A045D62B6525BA17CCBD3C51DE290DBD1FA0DACFE52BA6DB71CC8E219F9B037` |
| `apps/web/src/features/connections/environment-configuration-approval.ts` | 변경 | `1A1A732FA1704227C85C3F9EB8131C27EF995B5954B92F0E0B978C11B2786D06` |
| `apps/web/src/features/connections/EnvironmentConfigurationPanel.tsx` | 변경 | `24CFFB7AADD14A857AE9D3CFAAA54E659E156F533E1AA89E0AE0FCDEDF888B57` |
| `tests/unit/UI11/environment-configuration-ui.test.ts` | 변경 | `08AECDE838E58B2BF08B6D627DB4CC913E44830CD33E4BE3C017EB53EC0EBE91` |
| `tests/browser/UI11/environment-configuration-dom-harness.tsx` | 변경 | `994635B32C764628067D3DDF9F6C0E499816C953F8C623CA737047ECCFAF5DD5` |
| `tests/unit/FN06/environment-configuration-fixture.ts` | 변경 | `17FB6005FBF1F96F814A458C6094E4202D25934CFDE97D30935C661B9193E7FC` |
