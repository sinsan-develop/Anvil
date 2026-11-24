# FN08 Windows 컴파일 준비 지문 확인 후보

- 작성일: 2026-11-25 KST
- 상태: CANDIDATE_ONLY. 이 문서는 실행 승인이 아니다.
- 기준: cd9f1f804d2e328ce055c25b66263a6830669756
- 목적: 기존 31개 native 소스 컴파일 계획에 필요한 고정 컴파일러와 다섯 참조의 현 Windows-local 지문을 확정한다. 후속 컴파일은 여기서 실행하지 않는다.

## 정확 대상과 순서

경로는 모두 C:\Windows\Microsoft.NET\Framework64\v4.0.30319\의 직계 파일이다.

| 순서 | 파일 | 기존 바이트 | 기존 SHA-256 |
|---:|---|---:|---|
| 1 | csc.exe | 2569832 | 46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00 |
| 2 | mscorlib.dll | 5445432 | 11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C |
| 3 | System.dll | 3545264 | 2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71 |
| 4 | System.Core.dll | 1551104 | 8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D |
| 5 | System.Web.Extensions.dll | 1846016 | 5E6378EDC06F5A61920AAADB2ABA839DD3CF302D6192E08AACD4454BA4CFF0B3 |
| 6 | System.Security.dll | 미확인 | 미확인 |

기존 다섯 지문은 [FN06 보관 실행 후보](FN06_NATIVE_PREPARATION_MANAGED_FAKE_VALIDATION_EXECUTION_CANDIDATE_20261102.md)의 표와 대조한다. 컴파일러의 과거 4.8.9221.0 및 Microsoft 유효 서명은 [FN03 보관 실행안](FN03_NATIVE_CONTENT_COMPILE_ONLY_FIXED_PACKET_20261107.md)의 기록이다. 이번 읽기에서 버전이나 Authenticode를 새로 판정하지 않는다. 정확 바이트가 같을 때만 후속 후보에서 역사 서명 근거를 참조할 수 있다.

## 읽기 조건

1. 승인 후 30분 안에 기존 Windows 실행 경로에서 PowerShell 프로세스 한 번으로 읽는다. 자식 프로세스, 범용 탐색, glob, 대체 경로 선택은 0이다.
2. 고정 경로의 각 부모와 각 leaf를 문자 그대로 확인한다. 부모 경로가 디렉터리가 아니거나 부모 또는 leaf에 reparse point가 있으면 중단한다. leaf는 디렉터리가 아닌 파일만 허용한다.
3. 각 leaf는 순서에 따라 읽기 전용 스트림 한 개로 연다. 열린 스트림의 길이 한도, 읽기 전후 메타데이터와 길이 일치, SHA-256, 정상 close를 확인한다. 전체 입력은 최대 64 MiB다. 시작에서 최종 결과까지 60초 안에 확정되지 않으면 결과를 불명으로 기록한다. 후속 파일이나 재시도는 허용하지 않는다.
4. 처음 다섯 파일 중 바이트 또는 SHA-256 하나라도 다르면 즉시 중단한다. 이 경우 System.Security.dll을 읽지 않는다. 처음 다섯 파일이 모두 일치할 때만 여섯 번째 파일의 새 지문을 수거한다. 여섯 번째 값은 관측값이며 후속 승인 지문으로 자동 사용하지 않는다.
5. 출력은 고정 파일명·길이·SHA-256·비재분석 확인과 결과 코드만 허용한다. 오류 시 최초 실패 파일 역할과 고정 사유만 남긴다. 파일 내용, 예외 원문, 계정이나 ACL 데이터는 출력하지 않는다.

## 제외와 후속 결정

- 해당 EXE/DLL을 호출하거나 로드하지 않는다. 컴파일러·Agent·native helper·DB·서비스 실행, 권한/설정 변경, 파일 쓰기·복사·삭제, 인증서 저장소·네트워크 조회는 모두 0이다.
- 승인되지 않거나 결과 불명, 변조, 시간 초과인 경우 자동으로 우회하거나 재실행하지 않는다.
- 후속 31-source compile-only는 정확 소스의 게시 커밋·5개 참조 및 컴파일러 지문·격리 출력 root·실행 한도를 별도로 검산하고 직접 결정받은 뒤에만 가능하다. 컴파일 결과 자체는 native 실행·설치 지원 또는 `RequireDurability` 해제의 근거가 아니다.
