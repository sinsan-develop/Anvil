# FN07 로컬 CLI 신원 관측의 비밀 없는 진단 소스 보완

기준 main188b506712a1ad65658a633465b2852e50c95365(PR157), 승인된 FN07 연결 구현과 필수 개발 작업의 내부 진단 보완이다. 공개 제품 계약·권한·한도를 확장하지 않는다. 실제 관측 추가 실행 승인은 아니다. 단발20670a/기존 승인 소진은 유지하며 원인 미확정을 실패 추정으로 바꾸지 않는다.

기존 Primary만 다음 네 경로를 작성한다: scripts/fn07-local-cli-identity-read-v2.ps1; docs/work_packages/FN07_LOCAL_CLI_IDENTITY_DIAGNOSTIC_CANDIDATE_20261116.md; tests/unit/FN07/local-cli-identity-diagnostic.test.ts; docs/04_test_reports/AV3/FN07_LOCAL_CLI_IDENTITY_DIAGNOSTIC_SOURCE_RESULT_20261116.md. Main은 현황·검수·Git 통합을 소유한다. 다른 작업 변경을 되돌리지 않는다. 필요한 정확 추가 경로는 Main에게 반환한다.

원 script2A7E8911…F511·후보EEAFFF15…F620 및 기존 결과서를 수정하지 않는다. v2는 기존 PATH/192 literal/후보1·wrapper 본문0·고정 local/비재분석점·PE/후검산·256MiB/64KiB·자식1·27+3초·4KiB 출력·불명 보존을 유지한다. 조회 본문과 성공 형상은 그대로 두고 실패 단계·고정 이유·감독 실패·자식 종료확인 상태를 분리한다. 예외 메시지/스택/경로/환경/실 stderr/사용자 원문은 내보내지 않는다. 고정 허용 enum 이외 값을 근거로 삼지 않는다. 자식 원행은 pipe/형상/한도가 완결된 경우에만 채택한다.

Start 예외는 실행 여부 미확정으로 원 Process 객체를 보존한다. 시작 전 실패만 NO_START라 할 수 있고, 확인되지 않은 exitCode를 만들지 않는다. finally의 timeout/회수 실패가 먼저 확인한 원 실패를 덮지 않는다. 자식 종료확인과 실행 실패를 별도 표시하고, 확인된 자기 객체만 기존 한도로 정지한다. 재시도/다른 탐색/새도구/설치/권한 변경을 추가하지 않는다.

관측·시작/정지·파일IO 본문을 실행하지 않고 AST 구문·기존 대비 조회 본문/한도 불변 대조와 순수 결과 분기의 RAM 입력으로 검증한다. 정상 UNKNOWN·감독 오류·시작/정지 불명·늦은 종단·잘린/위조 원행·4KiB·비밀문자 미출력을 포함한다. 실제 Observe/Process.Start/파일 모사 함수와 SDK/Agent를 호출하는 시험은 하지 않는다. 시험을 위해 새로운 프레임워크·권한·로그·환경 수집을 만들지 않는다.

후보 문서는 새 실제 관측에 필요한 정확 script SHA/감독 블록·대상·한도·미확인·실패/회수 정책을 검토 가능한 형태로 동결하되 NOT_APPROVED_EXECUTION을 명시한다. 현재 시각을 새 승인/시간창으로 만들지 않는다. 후보/운영 코드는 이번에는 실행하지 않는다. Main 독립 검수 후에만 추가 관측의 정확 결정을 요청한다. 실제 DB/권한/키/서비스/설치·Agent/SDK/C# 실행·실자료/백업 조사·WSL/추가 SDK 조회는 제외한다. 결과서에 정확 명령/exit·허용 diff·지문·실패 이력·미검증과 롤백을 기록하고 소스 쓰기를 반환한다.
