# FN11/FN16/UI14 반출 일회 승인 연결 검수

2026-10-27 · Main 어울 · 기준 checkpoint `76129721c9640ae67b32cbd943436388eea7571a`.

## 판정·변경

기존 exportProject에 일회 승인 요청·별도 결정·명시 결박·원명령 실행을 연결한 소스 단위를 검수했다. 실제 DB 적용·정식 서비스·사용자 인수는 미실행이며, 전체 FN11/FN16/UI14·Stage·작업계획 완료가 아니다.

이전에는 REQUIRE_APPROVAL에서 EXPORT_APPROVAL_NOT_CONNECTED로 막혔다. 변경 후 명확한 APPROVAL_REQUIRED에서만 원명령을 보존해 기존 승인 요청을 작성한다. UI08에서 별도로 결정한 정확 승인을 UI14에서 보호 조회·명시 결박하고, 사용자가 별도로 반출을 실행한다. 승인만으로 파일을 만들지 않는다. 응답 불명 후 412가 와도 새 승인으로 우회하지 않고 같은 원명령만 재확인한다.

새 operation/API·permission·공개 반출 manifest·자료군·quota·표/role/GRANT는 없다. 기존 ActionScope, 소비·receipt와 job 저장을 사용한다. 원 payload는 같은 transaction-local 설정으로만 SQL 대조에 전달하며 영구 후보 저장을 추가하지 않았다. 신규0044는 `.sql.pending`으로만 작성했다.

## 범위·담당

- 단일 writer `fn16_export_one_time_approval`. Main 제품 수정 0.
- WI r2 SHA256 `12936919673E1A3BDC16D95E5E49BC07233E6C169EB6243CF75E2250A16A2BA1`의 제품/시험15경로. 최초 E7DE1397의14경로는 사전 검토 이력이다.
- 실제 create32행 중복 null 승인 거절이 발견돼 repository1경로의 해당 guard만 추가 허용했다. 승인 ref를 null로 치환하지 않는다.
- 원문 선택·이유·commandId/payload는 보존하고 approvalRef만 명시 전이한다. 현재 actor/client/control/policy·기한/미소비·정확 scope를 대조한다.
- 기존0035 SHA `F6B3F1ACEA0A590DBEC86994EDE796E9661BCF058715B8DBDC6E60AF21C8F1CA`,0043 SHA `F83F256A479B0AE484F67B538B4763CED884173654D3692BA537C645FDAD0D5E` 불변이다.

## 실제 검증

1. `fb5d47`: 기존 제품 불변에서 `node --test --test-name-pattern='REQUIRE_APPROVAL/null' tests/unit/FN16/export-approval-consumption.test.ts`, 실제 기존 함수가 EXPORT_APPROVAL_NOT_CONNECTED를 반환해 1 FAIL/716.1473ms. 모듈 부재가 아닌 기능 RED다. 코드 변경 후 `c87c9f` 같은 반례1 PASS/361.7821ms.
2. 동결 후 Main `d01bd7` 타입·diff0·15지문 확인. `27f51d`: 신규 input/consumption/API3 + 기존 FN11 approval-input/source-detach-consumption/work-plan-consumption3을 `node --test`로 실행, **33 PASS/375.8353ms**, FAIL·SKIP0. fake PoolClient와 순수/SQL 소스 정적 검사를 사용했다.
3. 최초 실제 App `0770f2`→session54375→`fab35a`: **3 PASS/2 FAIL,18.5s**. 정상 승인·거절 두 사례가 RESPONSE_INVALID였다. 실제 서버 결정 POST에는 ref가 없고 GET만 ref를 포함하지만 신규 fixture가 GET 객체를 POST에도 반환한 원인이다. 제품 parser·기대조건은 유지하고 시험 POST 응답만 보정했다. 원 실패를 소급 PASS로 바꾸지 않는다.
4. 보정 spec SHA `9C39C6978BE7DE277DC75AF3F67D21AB40C4C50175AAE3A236F5AA9415AD1188`. `9b6850`: 동일 JS 번들에서 실패한 두 제목만 `--grep '실제 App 승인요청|UI08 거절'`로 재실행, **2 PASS/4.1s**. 승인 요청→UI08 별도 승인→UI14 결박→별도 반출·job/file href, 거절 시 원명령 보존/반출0을 확인했다. 최종 5개 일괄 PASS 실행은 하지 않았으며 최초 통과3+보정후2로 구분한다. 다운로드 href 확인은 실제 파일 다운로드 바이트·정식 파일 저장 검증이 아니다.
5. fixture DTO 반례를 포함한 Main `118259` API9 PASS/200.8849ms. 앞선33과 중복되는 검사를 포함하며 최종34 일괄 실행으로 표시하지 않는다. `7d808b` 최종 타입·diff0.
6. Main 최종 App build write:false 446모듈/318ms. JS `index-Ig0BVz5u.js` SHA `CC45C32BC4B7ECFEE06B9639B0C9A8C86FECC4396F02EE36FF30C55613C13965`, CSS `index-BHDH6qmX.css` SHA `BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87`. 최초/보정후 제품 번들 지문이 같다.

## 독립 검수·보정

- 사전 명세 C0/I0/M0. 제품 정적 검수 C0/I0/M0, 신규 fixture I1은 위 POST/GET 구분 보정 뒤 scoped ADDRESSED·새 C/I0.
- SQL 최초 C0/I2/M0: 감사 actor/client/source_kind 누락과, 소비 후 job 삽입 전 command 승인참조 NULL 변경으로 deferred 검사를 회피하는 경로.
- 같은 writer round1에서 감사3조건과 OLD/NEW 승인 export command의 UPDATE/DELETE 한정 guard를 추가했다. INSERT·정상 AUTO/null·다른 operation은 보존했다. 새 정적2건 RED→GREEN은 개발자 제출이며 Main33에도 포함한다.
- SQL 재동결 SHA `DB3D9FD22EA5DE70DB8B68D047F40687B32F1DBD2E9682A6C8A87D3502E296D0`, Main `c51efc` 대조. 독립 scoped I1/I2 각각 ADDRESSED·새 C/I0.
- 검수자 Git 읽기는 sandbox 제한으로 실패했다. Main 실제 Git·지문 대조로 보완했으며 검수자의 실행 증거로 표시하지 않는다.

SQL 컴파일·직접 DML·COMMIT·RLS·경합은 **NOT_RUN**이다. 현재 FN16 격리 TCP 지원 미결을 우회하지 않았다. 실제 정책 부여·권한/Secret·서비스·Agent/native 변경 0. 실제 DB/정식 HTTPS/사용자 인수와 전체 프로젝트 백업·복원도 완료가 아니다.

## 자원·오류·복구

QA root `D:/tmp/anvil-v3-stage-b/ui14-export-approval-20261027-01`, owner SINSAN\cyhuh, 각 생성 최대30분. dist/results/temp/config만 생성했다.

- 첫 실행 2026-10-26T23:03:46.687Z→23:05:21.045Z, owner/nonlink/realpath/process0 후 소유27항목 정리(`a268a0`), 독립부재 `75adad`.
- 재검증 23:06:16.019Z→23:06:50.689Z, 동일 검증 후21항목 정리(`7d808b`), 별도 부재 확인은 WORK_STATUS에 기록한다.
- 신규 시험의 ApiError 기대·unknown 타입 준비 오류는 기준 완화 없이 수정했다. writer의 추정0035 경로 읽기1은 실제 inventory로 전환했으며 제품 실패와 분리한다. 정식 FAILURE_REPORT0, SQL 독립 보정1라운드·fixture 보정1라운드다.
- 기존 보호 untracked8·다른 작업은 보존한다. 소스는 후속 revert 가능하고 DB/지속 자료 rollback은 실행하지 않는다.

다음은 계획 순서대로 FN01 기준선3연산, 이어 FN05 맥락 준비의 미완료 일회 승인 집행이다. 전체 대기·재승인 반복으로 전환하지 않는다.
