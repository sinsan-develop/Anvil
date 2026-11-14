# UI12 확정 인수 수락 결과 명시 재조회

기준 main50d1aed611886ca3053d336adf1c9960eff3948a, branch codex/av3-ui12-control-followup. 기존 FN15 HE 승인 결과 GET 소비를 연결하며 새 API·권한·데이터 의미를 추가하지 않는다. Primary 단일writer, Main문서/검수/통합.

## 정확 허용2경로
- apps/web/src/features/control-handoff/ControlAccessPage.tsx
- tests/unit/UI12/control-acceptance.test.ts

## 문제와 동작
원수락결과검산→CONFIRMED CAS후 별도현재상태GET이실패하면현재화면이수락결과를숨기고확정명령은재전송차단되어역사결과를열수없다. 현재본인/클라이언트/프로젝트의보존CONFIRMED·ACCEPT명령과원보호요약에한해'수락 결과 다시 조회'를제공한다. 기존ControlApi.acceptanceResult로원튜플/commandHash/requestRef/summaryRef를검산한역사결과만표시한다. 새POST/CAS/제어상태갱신0, 기존현재상태조회는별도유지한다.

원bindingId·전체보존명령/요약·session/client/transport·요청ticket을검산한다. 닫기/화면전환/주체교체/재마운트뒤늦은200401을폐기한다. GET403404503/불일치는역사결과를숨기고원버퍼를보존한다. 현재401만기존인증상실처리. 현재오류가있어도명시결과재조회로정확오류를회복가능해야한다. 역사결과는현재제어권증명아님을구분한다.

## 검증
기존React RAM시험으로수락확정후현재상태503→GET만복구 RED→GREEN, 재진입/권한거절/다른유효본문불일치/주체·지연응답폐기와POST불증가·원CONFIRMED보존. 기존UNKNOWN복구/현재조회영향회귀,typecheck/diff/지문/실미검증보고. 신규의존성/실제DB·권한·키·서비스·Agent·네트워크0. 추가경로필요시쓰기전Main에반환.

## 내부 보완 r2 — 확정 상태 단조성

Main79~95행 확인과 Primary 원CAStrace RED0ba0e2에서 확정 CAS 후 빠른 현재상태GET503이 재렌더전 이전buffer를읽어UNKNOWN으로역행함을확인. 동일2경로/기존원CONFIRMED보존목표내에서수락확정이후현재읽기실패를수락불명catch와분리한다. 확정후UNKNOWN재CAS/재POST0,기존미확정UNKNOWN복구보존. 내부동일관측3회는정식실패보고3회가아니며추가목적없는반복중지·Main원인판단후같은Primary최소보완.

## 내부 보완 r3 — 기존 인접 시험 selector

Main이기준main의실제버튼 인수 수락 명령 보존과기존pagination시험의 인수 수락 (미구현)불일치를확인했다. tests/unit/UI12/control-access-pagination.test.ts1경로를추가허용하며그selector1개만실제이름으로교정한다. disabled/원버퍼불변/재전송단언유지,제품버튼/합격기준변경0. 직전인접25P1F중해당반례만재검증한다.
