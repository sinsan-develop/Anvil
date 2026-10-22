# FN06 Ownership 신규 DLL 단발 컴파일 결과 — 2026-10-23

## 판정

**FAIL — C# compile exit1 / 후속 최소 SOURCE 보완은 재컴파일 미검증.** 전체 FN06·Stage B·작업계획 완료가 아니다.

## 승인·입력

- 신산님 이 대화 직접 답변 ‘네 의견대로 승인해’에 따라 `docs/contracts/FN06_OWNERSHIP_NATIVE_LIBRARY_COMPILE_CANDIDATE.md` rawSHA `22155ABA89DAC54F9B2710B05FEEF50E228DA33E9E947F2E4CA63F20FB09A70F`의 exact4·시스템 csc/참조·전용 보호 root·단1회 DLL compile/정리를 수행했다.
- 원 source checkpoint `e12370642e77db9a28b677a3a325d5d2aef12568`; 실행 전 branch `codex/av3-stage-b`/HEAD `97d8dc24ad74ccb117afadf0674bb3587ee96dee`. native4 rawhash/원checkpoint diff부재·후보hash·compiler/ref hash 일치. source 입력hash는 위 후보를 그대로 따른다.
- 임시 root `D:\tmp\anvil-v3-fn06-ownership-d2-compile-e1237064`, 생성 전 부재·부모nonlink/owner 확인. 현재사용자 SID `S-1-5-21-1072657845-3483457417-1550930144-1001`와 SYSTEM 두 FullControl 규칙만·상속차단으로 원자 생성하고 복사4 rawhash를 대조했다. 기존 부모/소스/공유 ACL 변경0.

## 실제 명령·결과

- 고정 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`를 UseShellExecute=false/CreateNoWindow=true/stdout·stderr redirect/ArgumentList로 단1회 실행했다. 인자는 후보의 `/noconfig /nologo /nostdlib+ /target:library /debug- /optimize- /warn:4 /warnaserror+ /platform:anycpu /codepage:65001 /utf8output`, exactroot의 `/out:OwnershipEvidenceSource.dll`, 고정 framework3 `/reference:`, exact 복사4파일이다. 다른 compiler/환경추가/responsefile/runner0.
- PID `30384`, StartUTC `2026-10-22T23:55:02.6569150Z`, 실제212ms, **compiler exit1**. TIMEOUT/kill0. wrapper exit0은 finally 정리 완료만 뜻하며 compilePASS가 아니다.
- stdout 원문:

```text
OwnershipEvidenceHost.cs(119,25): error CS4014: 경고를 오류로 보고: 이 호출에서 await를 사용하지 않으므로 호출이 완료되기 전에 현재 메서드 실행이 계속됩니다. 'await' 연산자를 호출 결과에 적용하십시오.
```

- stderr 빈값. `DLL_NOT_CREATED`. 경고 오류 처리 기준을 낮추거나 컴파일을 재시도하지 않았다.

## 원인·최소 SOURCE 보완

- `PlanAsync`가 timeout 이후 fault를 관측하기 위해 별도 `ContinueWith`를 붙이지만 async 메서드에서 반환 Task를 버려 CS4014가 발생했다. 원 work 자체는 기존 Task.WhenAny/await로 유한 대기한다. continuation을 await하면 늦거나 미완료 work의 상한을 깨뜨릴 수 있으므로 추가 await가 아니라 `Task faultObserver = work.ContinueWith(...)`로 의도적 별도 관측 작업을 명시했다. callback/options/scheduler/기존 timeout·취소·cleanup·권한 결과는 바꾸지 않았다.
- 변경 전: 반환값을 버린 `work.ContinueWith(...)`; 변경 후: 같은 호출을 지역 Task 변수에 보관하고 의도적 비await 이유 주석 추가. diff --check exit0. Host 새 rawSHA `C21CC141EE808A43AC6861FF99769393FEF226EEF1DA7685BA84BEEDD8E5C490`; Worker/두 시험 SOURCE는 불변이다.
- 실제 compile RED만 관측했으며 **GREEN/수정완료를 주장하지 않는다**. 원 단발허가 소진·입력hash 변경으로 재compile은 별도 exact 결정 전 NOT_RUN이다. 기존 승인 후보는 덮어쓰지 않았다.

## 정리·미검증·다음

- compiler 종료 후 root owner/nonlink·보호ACL·하위 exact 예상 basename/owner·자식directory부재를 확인했다. 소유 복사4파일을 개별삭제하고 빈root만 삭제했다. DLL0; 재귀삭제0. 독립 후속 읽기에서 root Test-Path=False·PID30384 조회0이다. 제거한 자료는 원Git source4의 일회 복사본이며 원본은 보존한다.
- DLL load/실행·RunAll·worker/helper·PInvoke·실제파일관측·OS소유/준비/회수·DB/키/Secret/서비스/Agent/비용 전부 NOT_EXECUTED. 실제 기능/Windows 상호운용/원 CS4014 해소도 미판정이다. 보호8·기존 ProviderHandle/0038/FN05 거절·REQUIRE/SQLpendingM1 유지.
- source는 기존 branch에 보존하고 새rawhash를 결박한 compile-only 결정은 PMO에 요청한다. 그 경계와 독립적인 승인된 D1 source 작업은 Main이 계속 선정한다. 소스 rollback은 해당 변경 diff의 역보완으로 가능하나 원 실패/이력을 삭제하거나 Git reset/rewrite하지 않는다.
