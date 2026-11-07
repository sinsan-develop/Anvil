# FN03 native 내용 hash 소스의 1회 컴파일 결정 후보

상태 `DRAFT / NOT_APPROVED / EXECUTION_GO0`. 작성 기준 HEAD `93bca154cdc64527d320d2a7b9aad1b7d381f75a`. 현재 compiler·하네스·DLL load·OS/PInvoke 실행은 모두 0이다. 이 문서는 실행 승인을 발급하지 않는다.

**결정 문장** — 아래 고정 C# source/test2만 새 전용 QA 디렉터리에 복사하고, 신원 검산된 기존 로컬 C# compiler를 library 대상으로 최대 1회·15초·진단 합계 16KiB 안에서 실행해 컴파일 진단을 수집하는 것을 승인할까요? 생성 DLL의 load·실행과 시험 RunAll·native 함수 호출은 포함하지 않습니다.

## 1. 고정 입력

| 저장소 상대 경로 | bytes | SHA256 |
| --- | ---: | --- |
| `apps/connector/native/SourceContentObserver.cs` | 39004 | `C714C4C16DFF65794D9B7B40D7D0B3DCDFA34849E33ACF211EB1A06CD04E4482` |
| `tests/native/FN03/SourceContentObserverSourceTests.cs` | 17557 | `8806E2A72C35449429E07BFA217D06D10B3FE25345E8D97473A3257B5723AB08` |

원 source WI의 부모 `4EA0D7B2`, pending open 제한을 고정한 부록 `1FAB29355E659CE7C8F1FC4D1DA124BD07F29C9DC58F0BB24BA37A8F691361CA` 및 source 인수 checkpoint를 함께 결박한다. source 원문·합성 시험은 같은 DLL에 컴파일한다. 코드의 static initializer·RunAll·PInvoke는 호출하지 않는다. 실행 직전 두 원본과 복사본을 모두 재해시하고, 다르면 컴파일 전에 거절한다. 진단에 따른 source 수정이나 재컴파일은 이 1회 안에 자동으로 이어가지 않는다.

## 2. 기존 도구의 재사용 범위

- `docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_EXECUTION_PLAN_20261027_02.md`와 `scripts/run-fn06-ownership-compile-only.ts`의 단발 marker, 원 Process의 stdout/stderr·exit와 image 신원 분리 수집, 현재 owner/nonlink·입력 해시, 미정착 buffer 보존·정리 원칙을 재사용할 수 있다.
- 기존 `scripts/fn06-ownership-compile-only-input.ts:81–104`는 source12/tool4·FN06 후보 ID/manifest/output을 정확히 고정한다. 새 source2를 인자로 넣어 기존 `--apply`를 실행할 수 없다. 해당 승인·소비 marker도 재사용하지 않는다.
- `scripts/run-source-read-core-reference-compile.ps1`은 A3 고정 source/output·과거 commit/remote/runtime까지 결박한다. `scripts/source-read-compile-diagnostics.ps1`도 `SourceReadObserver.cs` 한 이름을 요구한다. 현재 FN03용 실행기로 직접 사용할 수 없다.
- `apps/desktop/scripts/native-physical-factory-compiler.cjs`는 다른 helper/package의 고정 입력 closure와 명시 driver를 소비하므로 FN03 실행 진입으로 전용하지 않는다. 이번 작성에서 이 도구를 실행하거나 수정하지 않았다.
- 과거 FN06 후보02의 결과는 `OUTER_RESULT_UNKNOWN / ONE_USE_CONSUMED`다. [기존 실제 결과](../04_test_reports/AV3/FN06_OWNERSHIP_COMPILE_ONLY_ACTUAL_RESULT_20261027_02.md)에 기록된 collector·반환 불명 경계를 새 실행에서도 별도 판정해야 한다. 과거 runner를 복사했다는 사실을 새 실행기의 검증으로 쓰지 않는다.

현재 FN03용 고정 launch 본문·그 해시와 결과 collector의 정확 실행 패킷은 아직 없다. Main은 실행 전에 새 후보 ID/두 source·tool 지문/실행 commit/고정 argv/cwd/유한 collector를 대조해 별도 실행 패킷으로 확정해야 한다. 이 문서 작성에는 새 controller 코드·manifest·결정 파일 작성이 포함되지 않는다. 기존 도구의 정확 입력 제한을 느슨하게 하지 않는다.

## 3. compiler와 참조의 신원

기존 manifest `FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027_02.json`에 기록된 경로와 역사 지문이다. 이번에는 시스템 파일의 존재·메타데이터·서명을 재조회하지 않았다. 현재 설치와 동일하다고 확정하지 않는다.

| 기존 경로 | 역사 bytes | 역사 SHA256 |
| --- | ---: | --- |
| `C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe` | 2569832 | `46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00` |
| `C:/Windows/Microsoft.NET/Framework64/v4.0.30319/mscorlib.dll` | 5445432 | `11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C` |
| `C:/Windows/Microsoft.NET/Framework64/v4.0.30319/System.dll` | 3545264 | `2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71` |
| `C:/Windows/Microsoft.NET/Framework64/v4.0.30319/System.Core.dll` | 1551104 | `8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D` |

실행 전 승인된 metadata 검산에서 exact 경로·해시·크기·파일 종류·최종 경로/ancestor의 reparse 여부, Microsoft 서명과 시스템 파일 owner를 확인한다. 기존 실행기는 Windows system leaf의 TrustedInstaller 소유 hardlink를 별도 검산하므로 일반 QA의 nonlink 규칙과 혼동하지 않는다. compiler의 서명/의존 runtime 파일 확인 범위는 고정 실행 패킷에 명시하고 설치·다운로드·다른 compiler 탐색으로 보충하지 않는다. 도구나 서명 확인이 거절되거나 불명이라면 그 정확 사유를 남기고 실행하지 않는다. 지문 차이가 있으면 역사 값을 현재 값으로 자동 덮어쓰지 않는다.

## 4. 새 실행 자원과 정확 argv 후보

- 새 후보 ID `FN03_NATIVE_CONTENT_COMPILE_ONLY_20261107_01`.
- 새 QA root `D:/Project/Anvil/.av3-data/fn03-content-compile-20261107-01`.
- 보존할 단발 marker `D:/Project/Anvil/.av3-data/fn03-content-compile-20261107-01.consumed.json`.
- 복사본은 `src/SourceContentObserver.cs`, `src/SourceContentObserverSourceTests.cs` 두 개다.
- 출력은 `bin/SourceContentObserverSource.dll` 한 개이며 `temp/`는 이 실행 전용이다. cwd는 새 QA root다.
- 존재/owner/ancestor/ACL·link 상태는 현재 미확인이다. 승인된 실행 준비에서 원 parent와 정확 root/marker 부재부터 확인한다. 기존 root/marker가 있으면 재사용하거나 삭제하지 않는다.

명시 compiler 경로에 shell·response file 없이 전달할 argv 후보를 아래 순서로 고정한다. `Q`는 위 QA root의 문자열 치환만 허용하며 `B`는 위 Framework64/v4.0.30319다. 실행 패킷에는 축약 없이 전체 문자열을 저장한다.

`/noconfig /nologo /nostdlib+ /target:library /debug- /optimize- /warn:4 /warnaserror+ /platform:anycpu /codepage:65001 /utf8output /out:Q/bin/SourceContentObserverSource.dll /reference:B/mscorlib.dll /reference:B/System.dll /reference:B/System.Core.dll Q/src/SourceContentObserver.cs Q/src/SourceContentObserverSourceTests.cs`

기존 FN06 compiler 옵션과 BCL3 순서를 따른다. warning을 성공으로 숨기거나 진단 후 옵션을 바꾸지 않는다. 승인된 QA temp 외 임의 출력·SDK·NuGet·추가 reference·package/install·명령 주입·일반 환경 forwarding을 허용하지 않는다. DLL을 읽어 길이·SHA256을 관측할 수 있으나 Assembly.Load/Reflection/Add-Type·테스트 진입 호출은 금지한다.

## 5. 단발·진단·불명 처리

승인 원문·실행 commit·문서/source/tool/launcher의 exact 해시와 시각 창을 Main이 대조한 뒤, compiler 시작 전에 exclusive 생성·flush·재조회한 marker로 1회를 소비한다. marker 생성 후 시작 여부나 결과가 불명이면 재실행하지 않는다. 원 FN06의 최대30분 QA/승인 창과 compiler15초·총 stdout/stderr16,384B·각 read buffer4,096B·진단 CS코드/line/column 최대128개를 상한으로 재사용한다. 시작 전 고정한 단조 종료와 더 짧은 승인 잔여창을 사용하며 await 뒤 연장하지 않는다.

같은 원 Process의 stdout/stderr 읽기를 image 관측 전에 예약해 빠른 실패의 진단도 보존한다. 출력에는 exact 두 basename에 해당하는 CS코드·위치·개수, EOF/초과/exit와 신원 검산 결과만 남긴다. 원 경로·source 본문·raw 오류·자유 진단본문은 공개하지 않는다. 외부 반환 해석불가·image 미관측·timeout·출력 초과·미정착 pipe를 컴파일 오류나 성공으로 바꾸지 않는다.

timeout은 종료 증거가 아니다. 원 Process/PID/start/image와 자식 부재가 확인된 경우만 고정 실행 패킷의 원 compiler 종료 조치를 적용할 수 있고 tree kill·다른 process 종료·권한 변경은 없다. 신원 또는 종료가 불명이면 원 handle·부분 출력/진단·QA를 보존해 Main에게 반환한다. 미정착 pipe의 buffer는 완료 전에 지우거나 dispose하지 않는다. compiler 종료와 모든 read의 정착이 확인돼야 회수할 수 있다. 성공 판정은 identity/exit0·완전한 유한 진단·예상 단일 DLL의 비링크/길이/hash·전후 입력 불변을 모두 요구한다.

## 6. 정리와 결과의 한계

새 root의 생성 전후 inventory와 source 사본2 해시, 원 소유자·ACL·비링크·원 process 종료/관련 process 부재를 fresh 대조한 뒤에만 등록 파일을 개별 제거한다. bin DLL 및 실행 중 명시 등록한 정확 temp 파일도 같은 조건으로 회수한다. 예상 밖 파일·실제 삭제 오류·부분 생성·owner/link/종료 불명은 보존한다. 상위 `.av3-data`나 다른 QA root, 기존 FN06/A3 파일과 소비 marker는 정리하지 않는다. 새 marker도 소비 증거로 남긴다. 정리 완료는 별도 부재 조회로 확인하고 compiler PASS와 따로 보고한다.

허용될 결과는 source/test2의 문법·타입·참조 검사까지다. C# 시험의 합격·Windows ABI·NtCreateFile/ReadFile/PInvoke·SHA256 관측 동작·취소/자원 회수·지원 위협모델·등록/서명/current receipt·문서 LINK·실제 Agent·전체 FN03 완료는 계속 미검증이다. source 변경이 필요하면 정확 진단으로 별도 보완하고, 다음 컴파일은 새로운 단발 결정 범위를 먼저 고정한다. 이번 작성에서는 QA/marker/DLL·실키·DB·서비스·실자료를 생성하거나 조사하지 않았다.
