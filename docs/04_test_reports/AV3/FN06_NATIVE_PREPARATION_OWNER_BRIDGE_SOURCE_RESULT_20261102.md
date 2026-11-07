# FN06 native 준비 원시도 owner bridge source 결과

2026-11-02 / Main 어울 / 기존 Primary·Reviewer

## 판정

**소스 한정 검수·통합. 실제 native·Agent·전체 계획 완료 아님.** 기준은 r2 A와 WI FF39A3325FCDF83854D6A0267B88235F28AFB25BF829260E0551CC2DB29B6E5D이다. 시작 3f0d7f5b3b46b9bf3d6994905eff163f306a2770, 기존 codex/av3-stage-b. code **0caad4eaf86377eb47f3262dd8abe957e04970ec** 정확8파일/294추가10삭제. Main b61889는 8SHA·raw/index bytes 동일·staged diff0·정확8목록을 확인했다. 관련없는 파일·보호 untracked3·원 SQL/SDK/과거 fixture/compile-only 계획은 보존했다.

## 구현과 유지 경계

기존 Client의 원 run10초·authority/current/challenge/permit의 계속 축소되는 budget과 current guard를 실제 ticket·동일 factory·수명에 private 결박한다. context 소비 await가 끝나기 전에는 OPEN하지 않는다. consumer finally 뒤 budget/current 접근은 거절하며 기존 flat/context 결과와 wire/outcome 호환을 유지한다.

새 bridge는 실제 발급 ticket→원 context/budget→원 current 재검사→구체 launcher 코드의 직접 소유 child/stdio에 OPEN을 한 번 보낸다. supplier/이미지 await 뒤·OPEN 직전 head/기한/포트 동일성을 확인한다. 일반 JSON·다른 factory·복제 context는 권위가 아니다. launcher는 shell:false/windowsHide:true이며 import/constructor는 IO0, 제품의 실제 보호 image supplier는 기본 부재다.

같은 private owner의 QUERY/CLOSE를 구분한다. consumer 종료 뒤 전송 전 일반 조회 권위 폐기는 IO0 거절하며 이미 소유한 자원의 정리 가능성을 보존한다. 시계/기한 오류·전송 후 timeout/단절/미정착 write·늦은 frame은 sticky UNKNOWN이며 재OPEN/새 helper/자동 close로 우회하지 않는다. CLOSE는 원 고정 기한 안의 같은 owner만 처리하고 새 예산을 발급하지 않는다.

C# dispatcher는 기존 CreateEmptyJobSource/ReadEmpty/Dispose/LocalHandleCloseConfirmed를 직접 소비하고 owner를 private 보유한다. 내부 Dispose는 이미 소유한 owner만 정리 시도하며 UNKNOWN을 성공으로 해제하지 않는다. 로컬 handle 닫힘은 writer 회수나 외부 handle 부재 증거가 아니다. **C# 시험 source는 작성만 했고 컴파일·실행하지 않았다.** TS 메모리 상대 모델은 C# 실행 증거가 아니다.

## 검증과 오류

| 근거 | 결과·범위 |
|---|---|
| Primary16e0aa/f9872c | launcher lifecycle/실제 Client→bridge 정상 경로 미구현 RED |
| Primary40105d→1aa96f | supplier await 중 head 변경에도 fake spawn1 RED→정상/음성2 GREEN |
| Primary ee62d7 | 최종 신규 Node2파일21PASS/286.778ms·type0 |
| Primary da9f43 | 기존 직접영향24조건은 PASS이나 전체 명령44PASS/1FAIL, 실패 원본 보존 |
| Main **9c07e2** | 정확8SHA 일치 후 신규2+기존client/context2의 **45PASS/fail0/skip0/467.2449ms**, root type/diff exit0 |
| 독립 Reviewer | 정확8 시작/끝SHA 일치·C0/I0, 읽기 정적 검수 |

Main은 수행자 결과와 중복 합산하지 않는다. 앞42PASS나 신규21/직접24의 서로 다른 시점을 최종45PASS로 조합하지 않고 별도 fresh 명령으로 확인했다.

오류 계보 FN06_OWNER_QUERY_GUARD_STATE_CLASSIFICATION은 da9f43의 clock 오류 latch 누락과 eb87ee의 정상 정리 오염을 **같은 근본원인 연속2회**로 Main이 집계했다. 다음 실패 시3회 중단/반환을 지시했고 ee62d7 및 Main9c07e2에서 두 경계가 통과해3차 실패는 없었다. 서로 다른 이름으로 쪼개지 않는다. 앞 원 current guard 생산 누락40105d는 별도 계보다.

module 부재·fixture fullref·정확 기한 기대·sandbox Git worktree exit128은 준비 오류로 구분한다. stream callback 선후관계·타입 overload·빈 chunk 문제도 이력으로 보존했다. C# var 다중 선언은 읽기 보정했지만 compile PASS가 아니다. LF 정규화는 의미 불변 동등 검산 후 수행했다.

내부 exact frame64KiB는 큰 NativeIntent/sourceScopes를 복제하지 않는다. 모든 정수를16자리로 과대 계산한 고정 context6279B/OPEN frame+LF6683B를 시험했고, 원2MiB 판독 상한을 줄이거나 새8MiB 형식으로 늘리지 않았다. 임의 본문에 대한 최대치라는 뜻은 아니다.

정확 Main 명령:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN06/native-preparation-owner-bridge.test.ts tests/unit/FN06/native-preparation-owner-launcher.test.ts tests/unit/FN06/native-preparation-client.test.ts tests/unit/FN06/native-factory-call-context.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc -p tsconfig.base.json
git diff --check -- apps/connector/runtime/native-preparation-client.ts apps/connector/runtime/native-preparation-factory-consumer.ts apps/connector/runtime/native-preparation-owner-bridge.ts apps/connector/runtime/native-preparation-owner-launcher.ts apps/connector/native/NativePreparationOwnerBridgeSource.cs tests/unit/FN06/native-preparation-owner-bridge.test.ts tests/unit/FN06/native-preparation-owner-launcher.test.ts tests/native/FN06/NativePreparationOwnerBridgeSourceTests.cs
```

## 최종 SHA256

| 파일 | SHA256 |
|---|---|
| apps/connector/runtime/native-preparation-client.ts | E74C1CA0C8F45FC36A87C7D4A076A8432D46277B19E66D7B77802E49898DBA3C |
| apps/connector/runtime/native-preparation-factory-consumer.ts | 07041FF7DBC116D167E6BD87F445E6C08EF1685B570972FD713468A1F26B6AEE |
| apps/connector/runtime/native-preparation-owner-bridge.ts | 382C70B59EFF8CBDAD61DB03C24E30CB2F77F3169EAFF2B42485E28BAF2A7D7F |
| apps/connector/runtime/native-preparation-owner-launcher.ts | 98470AF26CEB94E5A8B9E767CA705B1D511357513C8EB1BC51F3ED27353677E8 |
| apps/connector/native/NativePreparationOwnerBridgeSource.cs | 9BB0339C9E133F6B9AB9FFE1F5896A37D08B9B13702C67474D8F4C69CE616A54 |
| tests/unit/FN06/native-preparation-owner-bridge.test.ts | 177DE6D7F376C6F0A745FE18267A28EE98B496E79BC4DF258DAA28DA33C8F730 |
| tests/unit/FN06/native-preparation-owner-launcher.test.ts | 876F6C2FED18CCA59E807E7A0EF98FC9929E25DED15DA5E983CB1F283B2241D6 |
| tests/native/FN06/NativePreparationOwnerBridgeSourceTests.cs | 06BCFFE029E5AB6D3160DCB60B63436F6231960649E9E0E55D412E52C6F1515D |

## 미검증·다음 작업·복구

실제 spawn/파일 포트·C#compile/helper/native/OS·DB/권한/키/서비스/Agent·실자료/P03R3 실행0, QA 자원0·live handle0이다. Node가 제품·시험 소스를 읽어 메모리 포트를 실행한 근거이며 실제 admission이나 native 정리를 증명하지 않는다. standalone helper entry/build/등록, 보호된 원 startup 취득·actual package/peer admission·EOF/finally 실제 호출선이 미연결이다. 새 trust root/store/공개 operation/STATUS_ONLY 승격은 만들지 않았다.

다음은 보호 startup과 유한 helper loop/EOF 정리·빌드 source 폐쇄를 같은 내부 A 안에서 구체화한다. 첫 stdin JSON을 인가로 바꾸지 않으며 실제 공급자가 없으면 기본 거절을 유지한다. source 복구는0caad4ea의 정상 revert 후보, 실제 환경 rollback0이다. 전체 FN06/FN08/44업무와 사용자 인수는 미완료다.