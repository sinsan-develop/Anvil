# FN03 원문 내용 관측 컴파일 전용 시도 결과

- 판정 `PREPARE_DENIED / COMPILER_NOT_STARTED`. 기존 native 소스의 컴파일 결과 및 동작은 미검증이다.
- 직접 승인 `01a1b4b3-f640-7500-88b2-ecb6e0fc5ac6`. 유효창 `2026-11-07T06:30:55.296Z`부터 `2026-11-07T07:00:55.296Z`. 동일 지문의 과거 Microsoft 서명 관측을 이번 한정 선행으로 채택했다. 새 서명 조회는 하지 않았다.
- 기준 `f54c3655cdc58ebc0f5c345e66d5cfa8fef4010e`, [고정 실행안](../../work_packages/FN03_NATIVE_CONTENT_COMPILE_ONLY_FIXED_PACKET_20261107.md) `9F219AD943BB87D8F8F86571D402C7144CC851702DB8D437FA56914EA9E49685`, 실행체 `ED564C5CB4DFB5AE4C11306AA05175B15967679926756C19E0857C970CC3ACD2`.
- 승인 레코드 `CD7270F8A819FC9F13B94BEBD43C07BD635A7E4FBEA5B50E4C060F2D2117D549`, 3,308B. 승인된 PowerShell에 고정 `-NoProfile -NonInteractive -File` 및 이 레코드 해시를 전달했다.

| 확인 | 관측 결과 |
| --- | --- |
| 사전 조회 `a538a0`, `74ff56` | 정확 실행체·입력·도구 지문 일치, 전용 QA와 marker 부재 |
| 로컬 승인 기록 `9f09fd` | 배타 생성 및 동일 지문 재조회 |
| 실행기 `f64680` | exit 1, `APPROVAL_OR_PREFLIGHT_UNVERIFIED`, 승인 레코드 인수 이전 차단, `markerConsumed=false`, `processStarted=false`, `durableResult=false` |
| 독립 부재 확인 `11160c` | 전용 QA root·marker·result 모두 없음, 로컬 승인 레코드 지문 동일 |
| 읽기 진단 `ce3c98`, `d3e74d` | 동일 PowerShell 7.6.9의 `ProcessPath`는 `pwsh.exe`, `GetCommandLineArgs()[0]`은 `pwsh.dll`. 관측 DLL은 157,480B, SHA256 `682C403FD13E667FF9C67F28750C8FEDEC8AD60F962662D83642B48A6C3F2154`, 링크·reparse 없음 |

실행체 169~177행은 실제 프로세스 경로와 관리 런타임의 첫 인자를 모두 exe 경로와 비교했다. 독립 읽기 검토에서 관측한 DLL 첫 인자가 이 비교를 통과하지 못함을 확인했다. 정확 내부 실패 코드는 외부 공통 결과에 포함되지 않았으며, 이 검산 이후의 승인·경로·권한 검사가 실행에서 통과했다는 증거는 없다.

컴파일러 호출, DLL 생성·로드·실행, C# 시험 및 Windows 관측 검증은 모두 0회다. 이 실행체 호출을 자동 반복하지 않았다. 승인 레코드와 실패 이력을 보존한다. 다음에는 exe 신원과 관리 DLL 첫 인자를 각각 고정하고 나머지 여섯 인자의 검사를 보존하는 소스 보완을 검수한다. 실제 실행은 보완한 고정 후보에 대한 결정 뒤에 진행한다.
