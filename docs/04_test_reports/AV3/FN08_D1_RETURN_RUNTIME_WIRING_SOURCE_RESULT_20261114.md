# FN08 준비 관측 반환 runtime 조립 검수

판정: 소스 구현·독립 검수 완료, Git 통합 준비 중. 실제 환경 완료가 아니다.

기준 main `34f613a03c9e6edf0e96f3096aad86e3c3d4aede`, 작업 branch `codex/av3-d1-return-runtime-wiring`. Primary 단일 구현, Main 검수·통합, d2_scope_audit 독립 읽기 검수.

## 목적과 범위

PR106의 승인된 준비 관측 반환 source를 명시 v2 delivery 판독, desktop owner/client 조립, 동일 native host의 retained 객체·등록키, runtime/native build 목록에 연결한다. 기본 보호 journal/공급자 부재는 거절한다. RAM 대역을 실제 Agent 실행이나 OS 관측으로 표시하지 않는다.

실제 DB·권한·키·보호 파일·프로세스·서비스·Agent·C# 컴파일 실행은 제외한다. 기존 v1·정책 총한도·서명 목적·원장·이전 migration은 보존한다.

## 검수에서 발견한 문제와 조치

| 문제 | 조치·현재 상태 |
|---|---|
| v2가 기존 v1 delivery 판독에서 거절됨 | 명시 dispatcher를 실제 decoder/서버 delivery 검산에 연결. v1 판독 본문 보존 |
| runtime export/build 및 native source 목록 미연결 | 목록과 실제 owner 생성자 호출 연결. 실제 C# 컴파일은 미검증 |
| I1: 마지막 READ 뒤 host 종료가 retained 프로세스를 결과 POST 전에 종료 | RED 확보 후 client 요청과 receiver 소유 host 수명 분리. 성공/abort 뒤 보유, dispose/등록 무효화/원 기한에서 종료. 독립 재검수 C0/I0/M0 |
| I2: v2 최대 authority가 v1보다38B 크지만 예약 상한은 v1 | 0093 forward SQL과 서버 전달 보완. 서버 소유 버전을 Window 예약부터 저장·delivery·quota까지 결박. PMO가 기존 채택 v2의 내부 일관성 보완으로 확인. SQL 및 TS 독립 C0/I0/M0 |

## 확인한 증거

- Main 명시 v2 delivery 집중 시험: 1P/0F/0SKIP, 297.863ms, exit0. 이후 실제 재해시 frame의 credential 불일치·기한 초과·추가 필드 음성을 Primary가 보완했고 독립 검수에서 확인했다.
- 최초 owner 시험 7P는 close가 프로세스를 종료하는 효과를 반영하지 못했다. 이 결과를 수명 정상의 근거로 사용하지 않는다.
- Main 보완 후 `node --test --test-reporter=spec tests/desktop/native-preparation-return-owner.test.cjs`: 11P/0F/0SKIP, 5511.1743ms, exit0. 실제 제품 owner/client/coordinator와 RAM host·서버 순수 계획을 연결했다. 성공 POST·client abort 뒤 alive, 명시 dispose·원 idle 기한·등록 무효화 후 종료, 늦은 host 회수와 중복 효과0을 확인했다.
- 수명 검토 당시 owner SHA256 `0B4C6F81185C13474E9E7741376922056AAD37088AE73BF224E91A3CF90162D2`, 시험 `743F292FB147886DE1495CF5FFF9C960CDDB9F10D213AB331699194EF7E09E47`. 이후 JSDoc만 보완한 owner 최종 지문은 `4E287220BD956A807BBC8531DA1B352AD3EC153EAED923CECE892E63FB090AB9`다.
- Main `node --test --test-reporter=spec --test-name-pattern="fixed intent|명시 v2 issuer" tests/unit/FN06/native-preparation-store.test.ts`: 2P/0F/0SKIP, 5671.2291ms, exit0. v2 issuer→ARM 예약→authority→delivery decoder, 양방향 버전 불일치·원 한도 거절을 RAM 저장소에서 확인했다.
- 0093 SHA256 `F91FD36E21AE28D6013669BFEB2EEE69A2A69B56867E6A1C9F2CA6E293B93D23`: 신규5/교체9함수의 원 0076 대비 delta와 OWNER/ACL·guard·총한도 보존을 독립 읽기 검수했다. 실제 PG 구문·거래 검증은 아니다.
- TS issuer/service/store와 직접 시험 독립 C0/I0/M0. 기존 7필드 반환과 전체 bounds·합계 exact 비교로 저장 version 불일치를 검산한다. 새 응답 필드는 추가하지 않는다.
- Primary desktop TS7.0.2 메모리 HEAD overlay 179진단 대비 현재174진단, 신규 진단0. 전체 desktop typecheck는 기존 진단 때문에 exit1이며 PASS가 아니다. 원문을 HEAD로 대체하는 비교는 파일·진단 코드·문구 multiset을 사용하고 위치 이동을 제외했다. 신규 owner 진단3개는 JSDoc만 보완했다. root `tsc --noEmit -p tsconfig.base.json --pretty false`는 exit0이다.
- PE 합성 fixture의 의존성 해석 실패는 `ERR_MODULE_NOT_FOUND`였다. 기존 pe-library1.0.1의 dist/index.js만 Node `registerHooks` resolve에 연결한 process-memory 방식으로 시험했고, Main 15P/0F/0SKIP107.3365ms exit0을 확인했다. 설치·링크·검산기 변경·실 PE 컴파일은 하지 않았다. 검산기 SHA256 `CD7DD3ABA0074F36170965CC462258CFC8E024A51C016BA5078DE7502A911E7E`는 기존과 동일하다.

Primary 추가 검증(범위가 겹치므로 합산하지 않음):

| 명령 | 결과 |
|---|---|
| `node --test tests/unit/FN06/native-first-receive-client.test.ts tests/unit/FN06/native-first-receive-contract.test.ts tests/desktop/native-proof-runtime-build.test.cjs` | 79P/0F/0SKIP, exit0, 1455.3744ms |
| `node --test tests/unit/FN06/native-preparation-ownership-return-native.test.ts` | 정적3P/0F/0SKIP, exit0, 181.4698ms |
| `node --test tests/unit/FN06/native-first-receive-version-capacity-sql.test.ts` | bytes/정적2P/0F/0SKIP, exit0, 1161.6248ms |
| `node --test --test-name-pattern='ARM header 정상 여정\|명시 v2 issuer\|window 저장\|fixed intent 선예약' tests/unit/FN06/native-preparation-store.test.ts` | 기존 ARM 29모드와 신규 경로를 포함한4노드, 4P/0F/0SKIP, exit0, 18906.882ms |
| `node --test --test-name-pattern='REGISTERED 첫 수신 receiver\|STREAM 원 Client\|shell 수신 UNKNOWN\|shell 시작은' tests/desktop/desktop-trust-registration.test.cjs` | 4P/0F/0SKIP, exit0, 2306.0718ms |

표의 `\|`는 Markdown 표 구분 방지이며 실제 single-quoted 정규식 인자는 이스케이프 없는 `|`를 사용했다. 실행 handle은 모두 종료됐고 Primary가 제품·시험 쓰기를 종료했다. Main diff check도 exit0이다.

## 미검증·미완료

- Git 통합·병합 후 소스 smoke는 후속 기록한다.
- 실제 app DB 목적 접근은 기존 false RLS/app REVOKE로 막혀 있다. 별도 미채택 저장 접근 후보를 실제 권한으로 취급하지 않는다.
- 보호 journal/retained image·startup·selection 공급자의 실제 활성화, C#/OS/키/DB 여정은 미검증이다.
- 최초 grant의 osFence·writer OWNED, CURRENT·resume·START·실제 코딩 Agent 실행은 완료되지 않았다.
- WORK_PLAN 전체 완료 체크를 올리지 않는다. source 검수와 실제 사용자 인수를 구분한다.

## 복구

실제 서비스를 바꾸지 않는다. source 통합 후 회귀가 확인되면 해당 source commit을 정상 revert하는 범위이며, 기존 WIP·과거 migration·사용자 자료는 변경하지 않는다. 미적용 SQL을 실제 DB rollback 대상으로 간주하지 않는다.
