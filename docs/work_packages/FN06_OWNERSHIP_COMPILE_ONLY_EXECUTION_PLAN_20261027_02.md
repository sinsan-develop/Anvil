# FN06 Ownership compile-only 후보02 — 진단 수집 보완 소스 준비

2026-10-27 · 담당 어울 · `PREPARATION_ONLY_NOT_EXECUTION_APPROVAL`

## 현재 판정

원01의 compiler 실제1회는 소진됐고 결과는 UNKNOWN이다. 원01 QA는 회수됐으며 소비 marker SHA256 `45C21C7DCD8177A4E3F316B271A223F235C108132E9980D839C0E6DA924D6C60`은 보존한다. 빠른 종료·실제 C# 오류·OS 조회 오류 중 원인을 확정하지 않는다. 이 문서는 진단 수집 소스 보완과 별도 미승인 후보02 준비이며 추가 실행 허가가 아니다.

## 정확 입력과 후보

- manifest: `docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027_02.json`
- raw SHA256: `04EC52DC9D837A890487041756DBE96249F90C5AB6F9BA5BAD993815F77910B9`
- candidate/run ID: `FN06_OWNERSHIP_COMPILE_ONLY_20261027_02`
- sourceCheckpoint: `24e70f71a865e3e4779f769a787000d9d6f77e98`
- branch: `codex/av3-stage-b`; 실행 commit은 검수·통합 이후의 exact HEAD이며 sourceCheckpoint와 구분한다.
- 고정 decisionPath: `docs/approvals/FN06_OWNERSHIP_COMPILE_ONLY_20261027_02.json`. 결정 파일은 작성하지 않는다.
- QA root: `D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-02`
- 소비 marker: `D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-02.consumed.json`
- 출력: `bin/OwnershipEvidenceSource.dll`

원01 manifest의 source12/tool4 배열 원문·compilerOptions·한도·출력·제외 항목은 동일하다. 후보ID·checkpoint·새root만 바꾸며 원01 manifest/실행안/결정/실제 결과/native12/소비 marker는 수정하지 않는다. 기존 compiler와 BCL3개만 사용하고 source 사본은 manifest basename12개로 고정한다. `/target:library`, `/warn:4`, `/warnaserror+` 및 원 옵션 순서·reference 순서·source 순서를 유지한다. 새 옵션·rsp·설치·다른 compiler·DLL load/reflection/initializer/Job/PInvoke/Agent/DB/Secret/서비스/비용은 제외한다.

## 진단 수집과 검증 경계

첫 Start 성공 시 `processStarted/actualCompilerExecuted=true`, phase=`CAPTURE`로 기록한다. 함수 `CaptureOriginalCompiler`는 같은 Process의 두 pipe 읽기를 신원 조회 전에 예약하고 PID/startTicks·실제 image 관측과 pipe EOF/exitCode를 별개로 수집한다. image 오류는 제한된 유형·Win32code·오류 관측 후 HasExited만 남기며 raw 오류 메시지를 노출하지 않는다. 종료 여부나 요청 exe를 실제 관측 exe 대신 채우지 않는다. image 미관측·불일치에서는 `IDENTITY_UNKNOWN` FAIL을 유지한다.

같은 함수가 단위시험과 실제 apply에서 사용된다. 실제 apply는 반환된 identity/capture/diagnostics/exitCode를 먼저 state에 저장하고 phase=`VERIFY` 뒤 원 Owned 검증을 수행한다. 첫 신원 실패와 후단 Owned 실패 모두 이미 수집한 진단·exit를 지우지 않는다. 수집 함수는 PASS나 Stop 권한을 부여하지 않으며 실제 중단 callback은 관측 image가 일치할 때만 호출 후보가 된다. 외부 StopOwned는 같은 원 Process·PID/startTicks/image·직접 child 부재를 다시 확인해야 본체만 중단한다. 신원불명에서는 callback 호출·광역 PID 조회/kill·tree kill이 없다.

stdout/stderr 예약+보존 총합은 16,384bytes, 각 배열은 4,096bytes다. compiler 시작 전 시작된 같은 stopwatch의 15초와 승인 잔여창을 함께 적용한다. EOF를 추가 관측할 공간이 없으면 limitHit/incomplete로 닫는다. CS코드/line/column은 최대128개이며 source는 manifest의 exact basename만 매핑한다. 위치 없는 global CS코드도 남기고 raw 경로·진단본문·소스본문은 출력하지 않는다.

미완료 read는 같은 Context에 보유한다. 외부 finally가 취소 요청 후 최대1초 동안 완료를 관측하고, 기존 8조합 finalization 정책대로 모든 read 완료와 Process 종료가 확인될 때만 공유 buffer·capture memory를 zero/dispose하고 원 Process를 Dispose한다. 불명은 `HANDOFF_REQUIRED/NOT_CLEANED/memoryCleanupComplete=false/maximumLifetimeGuaranteed=false`이며 같은 handle을 다음 담당에게 넘겼다고 주장하지 않는다. 관리 문자열/runtime 내부까지 소거됐다고 보장하지 않는다.

## 결정·소비·정리

실제 CLI의 고정 decision binding·새 exact 실행 commit·입력/runner/manifest rawhash·승인 ISO 시각·최대30분·maximumRuns=1 검사는 유지한다. 미승인 후보02의 결정이 없거나 원01 결정이면 mutation/compiler 전에 거절한다. QA 전체30분·candidate별 library1회·compiler15초/16KiB를 유지한다. 원01 소진 허가·QA/marker는 재사용하지 않는다.

실제 실행은 새 직접 정확 승인과 플랫폼 실행 승인을 Main이 대조한 뒤에만 가능하다. 이 준비에서는 `node scripts/run-fn06-ownership-compile-only.ts --plan`과 `--apply` 모두 실행하지 않는다. 새 결정·QA·marker를 만들지 않는다.

자동 정리는 원 신원 증거·종료·관련 process0·owner/nonlink/prefix·exact inventory·파일 hash 재확인이 모두 충족될 때만 기존 등록 사본/출력/빈 dir를 개별 회수한다. image 미관측·불일치·read/종료 불명은 자동 삭제하지 않는다. 소비 marker는 항상 남긴다. 독립 수동 회수는 Main이 관련 process0·정확 inventory·source사본 hash·owner/link·종료를 fresh 대조한 별도 판단이며 이 수집 함수가 삭제 권한을 만들지 않는다.

## 검증과 인수

Main의 신규 행동 RED2 후 소스를 보완한다. 기존9+timestamp10개의 합격 기준은 유지하고 후보02 fixture 값만 정확 변경한다. 새 모의 시험은 종료/image예외/불일치에서도 유한 진단·exit와 FAIL/Stop0, 그리고 20,000bytes 입력의16KiB 상한을 검사한다. 실제 apply 전체·preflight·FS/marker·Process.Start는 시험하지 않는다. 허용 검증은 집중 unit·TypeScript noEmit·Node 구문·내장 PS AST와 모의 함수뿐이다. 실제 compiler/native/OS/Agent/DB/서비스 검증과 전체FN06/계획 완료는 NOT_RUN이다.

Main은 독립 C/I0와 실제 호출선·고정 입력 불변을 검수한 뒤 sourcecheckpoint/private 및 새 실행범위를 별도로 구체화한다. 후속03/04 후보나 합산 실행예산은 이번에 추가하지 않는다. rollback은 소유 변경의 후속 정상 revert이며 원01 자료/native12/marker/기존 DB·서비스·키를 지우지 않는다.
