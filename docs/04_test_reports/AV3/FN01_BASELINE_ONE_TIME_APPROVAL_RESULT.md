# FN01/FN11/UI02 기준선 3연산 일회 승인 검수

2026-10-27 · Main 어울 · 기준 `8bd9232e68329cf1e1bee417f2fcb5ef29549dad`.

## 판정

기존 기준선 초안 저장·내용 검토·별도 채택을 REQUIRE_APPROVAL 정책에서도 각각 별도 일회 승인으로 진행하도록 연결한 소스 단위를 검수했다. 전체 FN01/FN11/UI02·Stage·작업계획 완료가 아니다. 실제 PG·정식 서비스 반영·사용자 인수는 미실행이다.

기존 operation/payload/DTO·권한 종류를 유지한다. 명확한 APPROVAL_REQUIRED에서만 원명령 승인 요청을 작성하고, UI08 별도 결정→UI02 보호 조회·명시 결박→별도 실행으로 이어진다. 저장 승인을 검토·채택·업로드에 전파하지 않는다. 원명령·payload/fullhash를 보존하며 UNKNOWN 후412는 새 승인으로 우회하지 않는다. 저장소 receipt 재구성과 재조회도 승인 소비에 연결했다. 현재 source/CORE·검토·채택 조건은 보존하고, 후속 control/policy/head 변화만으로 합법 과거 이력을 위조로 취급하지 않는다.

## 담당·범위

- 단일 writer `fn01_baseline_one_time_approval`, Main 제품 수정0.
- WI r3 SHA256 `93029BE781FE39DC5D113D27196BC08837B309AB82320E7195ADC32E11D9BFCA`, 허용17경로. F2B3E1C4·855BD430은 사전 검토·내부 상세화 이력이다.
- 기존 시험2경로의 미연결 오류 기대만 명확 승인필요/불필요·잘못된 ref 거절로 변경했다. writer 부작용0·DENY/만료/기기/세대/replay·격리·receipt 무결성은 유지했다. 저장소 시험의 실제 잘못된 참조는 `{fake:true}`다.
- 신규0045는 미적용 forward 후보다. 기존0015 SHA `3E5EEA0F94186F0CC28819D435E85C4FEC97569DDA3BEF7751AD420ED9D3B6EC`와0044 SHA `DB3D9FD22EA5DE70DB8B68D047F40687B32F1DBD2E9682A6C8A87D3502E296D0`는 불변이다. 새 표/role/GRANT·공개 API·영구 후보 원문·다른 기기 복원·실제 정책 부여는 없다.

## 실행 근거

1. Main `7c49b7`: 기존 제품8경로 불변에서 신규 consumption test 실행. 반복의 최초 saveBaselineDraft가 BASELINE_APPROVAL_NOT_CONNECTED를 반환해 APPROVAL_REQUIRED/412 기대와 달랐다. **1 FAIL/235.9365ms**이며 이후 두 연산은 첫 실패로 미도달이다. 모듈 부재가 아닌 기능 RED다.
2. Main `75a651`: 타입·diff0와 제출17지문 확인. `442207`: 신규/직접·인접10개 unit 파일 **61 PASS/521.5715ms**, FAIL·SKIP0. 실제 기존 repository 저장·재조회는 fake DB/source adapter로 검수했다. 명령은 WORK_STATUS와 소스 manifest에 연결된 unit 파일 목록이다.
3. 최초 actual App `f70070`→session21294→`a56b3d`: **1 FAIL/30.1s**, 승인 요청 저장 후 별도 결정 링크 부재. 독립 I1과 Main `fefb73`이 부모 `previous===buffer`와 자식의 pending→uncertain→성공 연속 갱신 충돌을 확인했다. 검토·채택은 이 실행에서 미도달이다.
4. 같은 writer fix round1은 부모를 기존 mergeBaselineBuffer의 binding·주체·세대·전체 원명령 기준에 연결하고 자식의 예상 request identity·API/session/transport/disabled epoch·늦은 응답 보호를 유지했다. 수정은 Panel·Editor·API unit3개뿐이다. 서버/SQL은 불변이다. Main `e667b2` 직접/인접 API3파일 **23 PASS/224.8557ms**, 타입·diff0. 앞선61과 중복을 포함하므로 최종62 일괄 PASS로 표시하지 않는다.
5. actual `38f10d`: 링크를 넘어 UI08 결정까지 도달했으나 신규 spec의 포괄 heading locator가 h3/h4를 함께 매칭해 **1 FAIL/1.3s**. 기대 APPROVED는 유지하고 의도한 h3만 지정했다.
6. actual `081a7f`: 승인·명시 저장·재조회 후 검토 시작까지 도달했으나 exact label locator가 option 텍스트를 포함한 label을 찾지 못해 **1 FAIL/6.7s**. Main `e363ce/b26f51` 실제 DOM에 검토 화면과 세 combobox가 있음을 확인했다. 실제 group/role/name으로 정확 지정하고, 완료된 UI08 결정은 확인 후 기존 ‘결정 입력 닫기’를 명시 클릭하는 정상 사용자 흐름을 반영했다. 제품·기대·timeout은 바꾸지 않았다.
7. 최종 spec SHA `143622BA94DB7C4A3EC8EF4A394C3FF66C04DFE0EC0CE81CC79E1DFF0134664E`, actual App `82598a`: **1 PASS/4.6s**. 한 여정에서 초안 저장→내용 검토→채택의 서로 다른 승인3개, 각 commandId·전체 payload 보존과 명시 실행 전 적용0·각 실행 후 적용1을 검수했다. 과거 실패를 소급 PASS로 바꾸지 않는다.
8. 최종 bundle은448모듈/314ms, JS `index-FToqFnz-.js` SHA `605FF3851DA13681CB20DC4DC65D9C5BDF920727E7DF0410F6D95F1F9539C91F`. fixture 보정 전후 제품 bundle이 같다. 최종 Main `36c3c0` 타입·diff0.

## 독립 검수·미확인

WI 사전 검토 C0/I0, SQL 정적 C0/I0/M0. SQL0045 지문 `AD9B0D917C71E3B5C080F15431ACF64405B433A1E424C236F22A6BAFD2FF2C75`를 Main `09ee08`과 독립 검수자가 대조했다. 기존 source/CORE/review/CAS 본문·0044 wrapper·감사·불변/deferred 검사는 보존한다.

제품 최초 C0/I1/M0 → 동일 writer 보정 → scoped I1 ADDRESSED·새 C/I/M0. 신규 fixture의 h3/combobox·종결 입력 닫기 보정도 별도 정적 검수 C/I0이며, 실행 합격은 Main 실제 App 결과로만 판단한다. 검수자 sandbox Git 제한과 local main/remote main 차이는 Main 실제 source branch·원격 대조와 구분했다. 설정/ACL/ref를 변경하지 않았다.

실제 SQL compile·직접 DML·COMMIT·RLS·경합, 실제 파일/CORE 증거 관측·정식 DB/HTTPS 서비스·사용자 인수는 **NOT_RUN**이다. 합성 App 여정은 NOT_IMPLEMENTED 분류의 기록을 사용하며 실제 기능 구현/CORE 합격을 인증하지 않는다. API/session/transport 교체·ABA의 실제 DOM 음성은 이번 단일 여정으로 실행하지 않았고 unit·정적 근거와 구분한다. HUMAN R2·FN04 미채택 delta·실제 Agent 허가는 채택하지 않았다.

## 자원·오류·복구

root `D:/tmp/anvil-v3-stage-b/ui02-baseline-approval-20261027-01`, owner SINSAN\cyhuh·각 생성 최대30분. 생성 전 부재/부모 nonlink·owner를 확인하고, 종료 후 root/각 항목 realpath·nonlink·owner·해당 Node/Edge 프로세스0 확인 후 정확 경로만 정리했다.

| 실행 | 생성 UTC | 정리 UTC | 정리 항목 | 근거 |
|---|---|---|---:|---|
| 최초 I1 | 23:23:27.188 | 23:25:01.020 | 30 | ce7107·독립 부재 db22f8 |
| h3 locator | 23:27:36.884 | 23:28:25.425 | 30 | 56742f·다음 생성 전 부재 |
| 검토 locator | 23:29:07.313 | 23:31:27.263 | 30 | 097370·다음 생성 전 부재 |
| 최종 | 23:32:22.076 | 23:32:57.405 | 27 | 36c3c0·별도 부재 WORK_STATUS |

날짜는 모두2026-10-26 UTC(한국시간10-27)다. Python cp949 읽기1은 쓰기0에서 UTF-8 명시로 해결했다. 신규 fixture의 identity/동적 소비ID·비동기 reader/type 준비 오류와 기존 미연결 기대3건 변경은 기능 실패·합격 기준 완화와 분리했다. 개발자 정식 FAILURE_REPORT0·제품 독립 I 보정1라운드다.

보호 untracked8과 다른 작업은 보존한다. 소스는 후속 revert로 복구 가능하며 실제 DB·지속 자료 rollback/삭제는 실행하지 않는다. 다음 계획 작업은 FN05 buildTaskContext의 기존 일회 승인 집행이다.
