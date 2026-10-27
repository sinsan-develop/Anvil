# FN06 compiler 진단 수집 소스 보완 검수 — 2026-10-27

## 판정
소스 준비 범위 C0/I0/M0. 실제 compiler 결과는 미검증이며 원01의 FAIL_VERIFICATION/COMPILER_ATTEMPT_CONSUMED/COMPILE_RESULT_UNKNOWN은 보존한다. 원 승인은 재사용하지 않았다. 전체 FN06·Agent 연결·Stage·작업계획은 미완료다.

## 기준과 변경
기준 HEAD24e70f71a865e3e4779f769a787000d9d6f77e98, branch codex/av3-stage-b. WI docs/work_packages/FN06_COMPILER_DIAGNOSTIC_CAPTURE_PREPARATION_WI_20261027.md SHA CAE7ADF6BF73E5838A8FE28973EED412EB58CE004A73A78358E58ED54814C870. 단일 구현 담당 fn06_diagnostic_capture, Main 관리·검수·통합. Main 제품 코드 수정0.
기존에는 최초 image 관측 실패 또는 후단 Owned가 capture/exit 저장보다 먼저 이탈했다. 보완은 동일 Process의 bounded pipe 읽기와 image 관측을 구분하고, 실제 apply에서 CaptureOriginalCompiler의 identity/capture/diagnostics/exit를 먼저 보존한 뒤 VERIFY/Owned를 수행한다. 미관측·불일치 FAIL은 그대로며 요청exe를 관측값으로 대신하지 않는다.
신원 증거 없는 Stop callback0, 검증된 본체 중단의 PID/startTicks/image/child 재검사, 종료/read 미확정 시 보존·완료 전 zero/Dispose 금지, 16KiB/15초·원clock·승인 잔여창은 유지한다. 위치 없는 CS코드도 제한 수집하며 manifest basename 외 원경로/진단본문을 노출하지 않는다. 최종 메모리 완전 소거·wallclock 강제성을 검증했다고 주장하지 않는다.
새02는 미승인 후보이며 decision/QA/marker를 만들지 않았다. 원01 manifest/실행안/actual결과/native 전체 diff 불변을 Main01deec로 확인했다. Main3ae77d는 source/tool 배열 동일과5파일 rawSHA를 확인했고903e46은 literal 새QA부재를 확인했다.

| 허용 변경 | 최종 raw SHA256 |
|---|---|
| scripts/fn06-ownership-compile-only-input.ts | 7055A009B77120A895A5CFC3E5661932082C8B19851250CEF5F1B25B75C4E4C2 |
| scripts/run-fn06-ownership-compile-only.ts | F1FF82C1986CF6E4462CD9873EEF1D294EA92BA678AA62B4BBA9B0D1D8FD5D4B |
| tests/unit/FN06/ownership-compile-only-preparation.test.ts | 118F70C6EF439BAFD15A351E994002DE978225B2D35EC9100719EA1D1CB2A08C |
| docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027_02.json | 04EC52DC9D837A890487041756DBE96249F90C5AB6F9BA5BAD993815F77910B9 |
| docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_EXECUTION_PLAN_20261027_02.md | 0C8DAC94255567B49E41020554F0B603BF98B96990129D7B97D91BFC795B3CFD |

## 실제 수행 검증

- Main2999e2: 새 모의 harness의 TS 문자열구문 수집FAIL1/104.2816ms. 담당이 PS 줄바꿈을 char10으로 보완했다. 제품/C# 실패와 구분한다.
- Mainff31cc: node --test --test-name-pattern='신원 미관측|신원 불명인 원 Process' tests/unit/FN06/ownership-compile-only-preparation.test.ts → 의도한 함수부재 RED2/135.4599ms/skip0.
- Main30ba25: node --test tests/unit/FN06/ownership-compile-only-preparation.test.ts → 12 PASS/0 FAIL/skip0/3648.6227ms. 기존9+timestamp 기대를 보존하고 후보 fixture만02로 변경했다. 새2는 exited/image예외/foreign image에서도 유한 diag/exit/FAIL·Stop0, 20000bytes의16384상한과 실제 같은 helper·저장순서를 검사한다.
- 같은 Main30ba25 npm run typecheck·git diff --check exit0. 담당 Node 구문검사0은 담당 증거이며 Main은 실제 unit import와 noEmit을 확인했다.
- Main4c38b8: node에서 export한 원문을 pwsh stdin으로 Parser.ParseInput에만 전달 → metadata3367/apply22564/bootstrap509/capture7478bytes AST_OK, exit0. PS apply 본문을 실행한 검사가 아니다.
- 독립 fn06_diagnostic_review: baseline diff/5hash/실제 연결/원 배열·한도·marker 비재사용을 읽기검수 C0/I0/M0. reviewer 직접 시험/변경0.

담당의 모의 ScriptProperty 예외가 Error 원장에만 남은 동작 보완1건, 긴 EncodedCommand 전달의 ENAMETOOLONG2건은 stdin전달로 해결했다. 실제 compiler 오류/정식 FAILURE_REPORT 횟수로 세지 않는다. 오류를 삭제하거나 성공으로 소급하지 않는다.

## 미실행·보존·다음

이번 actual --plan/apply·compiler/Process.Start·QA/decision/marker 생성·DLL load/Job/PInvoke/native/Agent/DB/Secret/서비스 실행0. 실제 OS 신원 조회/빠른 종료·출력pipe 취소·실compiler 진단·15초 wallclock·불명 정리 경합은 NOT_RUN. 모의 통과는 이 실제 증거를 대신하지 않는다.
원01 QA부재와 소비marker SHA45C21C7DCD8177A4E3F316B271A223F235C108132E9980D839C0E6DA924D6C60 보존은 앞선 실제결과서와 이번 시작 읽기에서 확인했다. 새02 생성0으로 정리할 새QA는 없다.
다음은 정확 소스checkpoint/private 게시 후, 필요할 경우 새02의 정확 source/hash·한도·제외를 새 직접 결정으로 결박한다. 원01 허가/기한/횟수를 늘리지 않는다. rollback은 소유5파일 후속 정상 revert이며 기존 source/native/marker·DB/키/서비스 삭제0이다.
