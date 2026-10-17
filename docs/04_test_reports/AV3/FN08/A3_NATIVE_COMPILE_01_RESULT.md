# A3 native compile-01 실행 전 검사 결과

판정: **PRECHECK_BLOCKED · COMPILER_NOT_EXECUTED**. Main 어울, 2026-10-18. C# 컴파일 실패나 OS 관측 실패가 아니다.

## 대상·실제 결과

- 기준: codex/av3-stage-b / local·private exact **67ec6ed4b7e2180ef3a9be4e7f5fd5c3db92cbe1**, tracked clean / main **f976ed5e29e14b13e12729d5b1ccf98f050f2210** 불변.
- PMO AV3-PMO-A3-NATIVE-COMPILE-ONLY는 실제 요청 turn01a14b63-013b-7e73-b08e-e1ae387dad9f 완료19:42:57Z→실clock19:55:46Z/12분49초·최신4turn 답변/중지/거절/수정 부재에 따른 직접 위임 권장A였다. 고정창2026-10-17T19:55:46Z~20:25:46Z, compiler 최대15초, 단1회/자동 재시도0.
- Main의 사전 검사 단1회가 `A3_COMPILE_LINK_DENIED` / exec exit1로 중단됐다. `started:false`, compiler/exitCode/elapsedMs/output:null, diagnosticCodes:[], qaRootAbsent:true, cleanupFailure:null이었다. **컴파일러 PID·DLL·QA root 생성0, 정리 대상0**이다. 이번 입구 시도를 재사용하거나 남은 창에서 자동 재시도하지 않는다.
- 신규 등록 root `D:\tmp\anvil-v3-stage-b\a3-native-compile-01`은 별도 읽기에서도 부재다. DLL load/실행·reflection/Add-Type/PInvoke·OS 소스 관측·native 함수·실 Agent 호출·DB 쓰기·서비스 변경0.

## 차단 원인과 별도 확인

경로 guard가 LinkType의 모든 값을 금지하여 아래 고정 OS 파일의 **HardLink**를 차단했다. 세 파일 모두 FileInfo / Attributes Archive / Target null / ReparsePoint false / owner `NT SERVICE\TrustedInstaller`이며 source·부모 경로에 다른 link/reparse 발견은 없었다. 이는 컴파일러 진단이 아니며 OS 파일/ACL을 고칠 근거도 아니다.

| 고정 파일: C:\Windows\Microsoft.NET\Framework64\v4.0.30319\ | SHA256 |
|---|---|
| csc.exe (4.8.9221.0) | 46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00 |
| mscorlib.dll | 11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C |
| System.dll | 2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71 |

- 실행 source `apps/connector/native/SourceReadObserver.cs` SHA256 **3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC** 불변. hash/owner/속성은 Get-Item/Get-Acl/Get-FileHash 읽기로만 확인했다. fsutil/native helper·권한 변경·컴파일러 복사0.
- 읽기 진단의 foreach 파이프 구문 오류1은 실행 전에 거절됐고 배열에 먼저 담는 문법으로 정정했다. 제품/환경 변경0이다.
- 결과 문서 적용 최초1회는 자동 권한 검토 시간 초과로 끝났고 파일 부재/현황 미변경을 확인했다. 도구가 허용한 동일 범위 재시도1회로 기록했으며 권한 확대·우회0이다.
- sandbox의 PID54212 미발견은 서비스 장애로 판정하지 않았다. 별도 elevated 읽기로 Node54212/exe/start2026-10-17T19:08:16.5819440Z·단일127.0.0.1:3830·relay26052/start2026-10-15T12:28:17.5262970Z가 유지됨을 확인했다. runtime receipt PASS/hash **50459C537F84E4E9DB8B1DD35F3301638B1843EAB05A8928B7DEAEE1B5F74F92**, 기존 log0byte·QA root 부재를 확인했으며 로그 본문 읽기/서비스 재시작0이다.

## 다음·미검증

- Main이 선정한 필요한 결정은 **이 정확한 OS 3파일의 HardLink만 한정 허용한 새 compile-only 단1회**다. 상세 대안/위험/정리는 `docs/work_packages/A3_NATIVE_COMPILE_HARDLINK_DECISION.md`에 둔다. source·QA·부모 경로의 symlink/junction/reparse/link 금지는 유지한다. 승인 전 gate 수정/재실행0.
- 기존 준비 35PASS/type/diff0는 코드 불변이므로 반복하지 않는다. 원 독립 C0/I2·Main 단1회 보완과 실제 native compile/ABI/flag·handle/경합·보호 host/키/TLS/DB/Agent 미검증은 그대로 보존한다. whole FN06/FN08/UI11/Stage/사용자 인수 완료가 아니다.
- PMO에는 필요한 예외 결정만 요청하며 다음 미완료 업무 선정·계획 완료 책임은 Main에 있다. 다른 독립 승인 업무의 기능 공백을 대조하여 이어간다.
