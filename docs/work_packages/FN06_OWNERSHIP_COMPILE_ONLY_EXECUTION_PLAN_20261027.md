# FN06 Ownership compile-only 정확 실행계획 후보

2026-10-27 · 담당 어울 · `PREPARATION_ONLY_NOT_EXECUTION_APPROVAL`

## 판정과 기존 경계

이번 산출물은 신규 compile-only 1회의 소스 준비다. 실제 compiler/QA/소비 marker/승인 JSON은 생성·실행하지 않았다. 기존 D1 compile 제외, D2의 CS4014/exit1 단발 소진, PMO 한정 FN16/PG 지원 범위는 그대로다. 이 문서·단위시험·binding 일치는 실제 사용자 승인을 인증하지 않는다. Main이 새 직접 승인 원문과 플랫폼 실행 승인을 별도로 대조해야 한다.

## 고정 입력과 새로운 실행 commit

- 기준 manifest: `docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027.json`
- raw SHA256: `D6DE65F1226575736CCF65AC951C44FE632012D1EBA9D25D2CF276ACDFF08A57`
- native 12파일의 이력 기준: `64bb7ab2db534e66d66bf150529df3017e4bd70e`
- 실행 branch: `codex/av3-stage-b`. 실제 실행 commit은 준비 코드/검수/문서 통합 후의 새 exact HEAD이며, native 이력 기준과 구분한다.
- 준비 함수의 `actualHead`, 결정의 `executionCommit`, local/private branch HEAD는 일치해야 한다. native 12파일은 manifest의 개별 raw 길이/지문과 이력 기준 diff로 고정한다.
- 실행 결정은 그 새 HEAD와 입력 모듈 raw hash·runner raw hash·manifest raw hash를 각각 결박한다. 코드 변경 후 과거 결정을 재사용하지 않는다.

## 명령과 임시 자원

준비 명령은 `node scripts/run-fn06-ownership-compile-only.ts --plan`이며 생략 시에도 plan이다. 현재 이 실제 명령도 실행하지 않았다. plan은 source/tool 지문·도구 서명·owner/경로/부모 ACL·Git/private exact를 읽고 고정 argv와 binding을 출력한다. CLI import는 포트 실행/FS 변경/프로세스 생성을 하지 않는다. 보고에는 내부 실행 주소를 포함하지 않는다.

나중의 실행 명령은 `node scripts/run-fn06-ownership-compile-only.ts --apply` 하나뿐이다. 추가 옵션·허가 boolean·다른 root/source/timeout·혼합 mode는 거절한다. 고정 결정 파일 `docs/approvals/FN06_OWNERSHIP_COMPILE_ONLY_20261027_01.json`이 없거나 결박이 틀리면 mutation/compiler 전에 거절한다. 아직 이 결정 파일은 만들지 않았다.

검토 대상 자원은 다음 literal로 한정한다.

| 구분 | 고정 대상 |
|---|---|
| QA root | `D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-01` |
| 소스 사본 | `src/` 아래 manifest 12개 basename |
| 출력 | `bin/OwnershipEvidenceSource.dll` 1개 |
| compiler 임시 경로 | QA root의 `temp/` 1개, 사전 승인된 파일 목록 없음 |
| 소비 marker | `D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-01.consumed.json` |

root/marker는 생성 직전 부재가 필요하다. 부모는 `SINSAN/cyhuh` 소유·현재 사용자와 SYSTEM의 FullControl만 허용하는 nonlink 경로여야 한다. 부모 ACL은 바꾸지 않는다. 새 자원은 검증된 부모 ACL을 상속하고 생성 직후 다시 검사한다. source는 CreateNew로 raw 복사하고 길이/hash를 재검사한다. marker도 CreateNew로 먼저 소비하여, 이후 실패해도 새 직접 허가 없이 재시도하지 못한다. marker는 정리 후에도 보존한다.

고정 compiler는 manifest의 기존 Framework64 `csc.exe`이고 참조는 같은 manifest의 `mscorlib.dll`, `System.dll`, `System.Core.dll`뿐이다. 각 파일의 raw 길이/hash, TrustedInstaller 소유 system leaf, Microsoft Authenticode 유효 서명을 실행 전 확인한다. Windows system hardlink leaf만 구분하여 허용하고 symbolic/reparse 및 조상 link는 거절한다. 다운로드·설치·restore·다른 compiler·source·rsp·경고 완화는 없다.

정확 argv는 아래 순서다.

1. manifest `compilerOptions`의 `/noconfig /nologo /nostdlib+ /target:library /debug- /optimize- /warn:4 /warnaserror+ /platform:anycpu /codepage:65001 /utf8output`
2. `/out:D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-01/bin/OwnershipEvidenceSource.dll`
3. manifest 도구 순서의 BCL 3개 `/reference:<고정 절대경로>`
4. manifest 소스 순서의 QA `src/<basename>` 12개

PowerShell7의 고정 본문을 stdin으로 최대64KiB만 전달한다. 짧은 고정 bootstrap만 EncodedCommand로 전달해 Windows 명령 길이 한계를 피한다. `.NET ProcessStartInfo`는 shell=false·hidden window·고정 executable/ArgumentList·고정 QA cwd와 TEMP/TMP만 사용한다. 이 소스 준비에서 PowerShell 본문은 AST parse만 했으며 실행하지 않았다.

## 결정 형식과 기한

결정은 아래 정확 필드만 갖는 객체다. 이 목록은 값 없는 형식 설명이며 실제 승인 기록/서명/시간창이 아니다.

`schemaVersion, status, approvalKind, candidateId, manifestHash, sourceCheckpoint, executionCommit, inputHash, runnerHash, qaRoot, output, limits, approvedAt, expiresAt, runId, maximumRuns`

필수 값은 schemaVersion=1, status=`APPROVED_COMPILE_ONLY`, approvalKind=`DIRECT_USER_EXACT_EXECUTION`, candidateId/runId=`FN06_OWNERSHIP_COMPILE_ONLY_20261027_01`, maximumRuns=1이다. 모든 지문/commit/경로는 실행 직전 관측 binding과 일치해야 한다. 시간은 정확 ISO UTC 밀리초 `Z`, 승인 이후·만료 미만이어야 하며 창은 최대30분이다. 호출자가 현재 시간을 넘겨 새 승인을 만들지 않는다. 실제 CLI는 현재 시간을 관측해 이미 주어진 창과 비교한다. 중복키·추가필드·proxy/accessor·옛 D2/A3·다른 승인종류·소진 marker·불명 metadata는 거절한다.

정상 실행의 한도는 QA 전체1,800,000ms, compiler15,000ms, stdout+stderr 보존 합계16,384 bytes, compiler 시도1회다. 실행 전·복사 중·compiler 시작 전/대기 중에 남은 창을 확인하고 정리 여유를 둔다. OS 거절/신원·읽기 불명 예외에서는 수명·정리의 강제 보장이 불가능하며 아래 HANDOFF_REQUIRED/NOT_CLEANED로 보고한다. runtime type/단위시험의 모의 결정을 실제 승인의 증거로 사용하지 않는다.

## 캡처·중단·정리

stdout/stderr는 각각4KiB 고정 배열의 `ReadAsync`를 polling하며 저장 byte와 두 pending read의 예약 byte 합계를16KiB 이내로 제한한다. EOF를 더 읽을 예약 공간 없이 상한에 도달하면 보수적으로 incomplete다. 무제한 ReadToEnd는 없다. 상한도달/15초/창 만료는 성공이 아니다. 시작 직후 같은 `.NET Process`의 PID·start ticks·실제 exe를 관측하지 못하면 UNKNOWN으로 보존한다. timeout/상한 도달 시에도 같은 Process handle·PID/ticks/exe와 살아 있는 직접 child 부재를 재확인한 compiler 본체만 중단한다. 광역 PID/tree kill은 없다. child/신원 불명 시 자동 정리를 하지 않는다.

진단은 공개 가능한 CS 코드/line/column 최대128개, stdout/stderr의 captured bytecount/hash, EOF·limitHit·timeout·exit 관측을 구분한다. 경로·소스본문·원진단 문자열은 출력하지 않는다. 관리 배열/메모리 스트림의 소거를 시도하지만 managed 문자열·runtime 내부 버퍼까지 소거했다고 보장하지 않는다. DLL은 존재/길이/hash만 읽고 load/reflection/Add-Type/initializer/worker/Job/PInvoke는 실행하지 않는다.

미완료/예외 종료에서는 CancellationToken으로 read 취소를 요청하고 최대1초 동안 task 완료를 관측한다. 모든 task가 완료되고 compiler 종료가 관측된 뒤에만 task 결과를 회수하고 공유 read buffer/캡처 저장소를 zero·dispose한다. 순수 8조합 finalization 정책을 실제 adapter가 같은 값으로 소비한다. 늦은 read나 stop 불명에서는 완료 전 zero·Process.Dispose를 하지 않는다.

그 예외는 `HANDOFF_REQUIRED`, `NOT_CLEANED`, `memoryCleanupComplete=false`, `maximumLifetimeGuaranteed=false`다. 본인 compiler PID·start ticks·expected/observed exe와 미관측 여부, 원 PowerShell host PID·start ticks·exe, stop 신원확인/실제 요청/종료관측 상태, pending read와 원 객체 참조, 별도 복구 판단 필요를 결과에 보존한다. 원 객체/lease는 원 host 종료 때까지만 참조되며 **host 종료는 OS의 원 Process handle을 해제한다**. 같은 handle을 다음 담당에게 전달하거나 보존했다고 주장하지 않는다. 상주 host/새 keeper/daemon은 만들지 않는다. 다음 담당은 기록된 PID/start/observed exe와 OS 거절을 새로 검증하고 별도 정확 복구 결정을 받은 뒤 처리한다. 기록된 PID만으로 kill하거나 QA를 자동 삭제하지 않는다.

종료 확인·compiler 신원 재대조·등록 QA를 참조하는 관련 process 부재·owner/nonlink/절대 prefix·전체 예상 inventory가 모두 맞을 때만 source12와 DLL1을 개별 삭제한다. temp는 빈 상태만 자동 회수한다. 예상밖 임시 파일/폴더·metadata 불명·실패가 있으면 root를 보존하고 finite 실패 코드를 남긴다. 빈 폴더를 역순으로 개별 삭제하고 별도 root/관련 process 부재를 재조회한다. 소비 marker는 삭제하지 않는다. 정리 실패/불명은 PASS가 아니다.

프로세스 목록/파일 metadata는 시점 관측이며, OS handle 기반 전체 하위 프로세스 격리나 적대적인 동일 사용자와의 원자적 race 방지를 입증하지 않는다. 이 compile-only는 고정 Microsoft compiler와 현재 사용자/SYSTEM만 쓰는 부모를 전제로 한다. 실행 중 환경/소유권이 바뀌거나 예상밖 자원이 관측되면 보존·보고하며 확대 실행하지 않는다.

## 검증과 인수 전 남은 일

Main의 실제 RED는 7 FAIL/skip0/exit1(161.7585ms)로 builder/decision/runner 부재였다. 실행 commit 분리 지시에 맞춰 TEST_ONLY fixture에 actualHead/executionCommit을 추가했고 accessor/proxy 음성1개와 늦은 read/stop 불명 finalization 반례1개를 보강했다. 이후 실행 결과와 최종 네 파일 지문은 담당 제출/Main 현황에 기록한다.

현재 허용 검증은 신규 순수 unit·TypeScript noEmit·Node syntax·내장 PowerShell 문자열 AST parse뿐이다. 실제 --plan/--apply·compiler/QA/consumed/결정 JSON·DLL load/OS/실제 Agent·키/DB/Secret/서비스/비용은 NOT_RUN이다. 준비 소스/정적 검사를 실제 OS 실행 검증이나 FN06 전체 완료로 승격하지 않는다.

인수 전 순서는 준비 코드 동결/hash → 독립 Critical/Important 해소 → Main의 실제 source/tool 지문/부모/부재 및 exact 새 commit/private 확인 → 신산님의 새 직접 정확 결정 → 별도 플랫폼 실행 승인 → 단1회 실행/정리·독립 부재 확인이다. 이 문서 작성은 어느 단계를 자동 승인하지 않는다. 원본 native12/기존 helper/보호8/Main 현황·manifest는 수정하지 않는다.

rollback은 준비 신규4파일의 개별 제거 또는 통합 commit의 정상 되돌림이다. 실행 후라면 등록 생성물만 위 조건으로 회수하고 소비 marker/유한 결과는 보존한다. 원 native source·부모 ACL·DB/서비스·기존 자료를 rollback 명목으로 변경하지 않는다.
