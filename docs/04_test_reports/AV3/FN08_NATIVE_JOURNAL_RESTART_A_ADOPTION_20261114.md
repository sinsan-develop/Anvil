# FN08 보호 journal 재시작 식별 A안 직접 채택

2026-11-14 / Main 어울

신산님이 한정 질문에 **A안 계약·source-only 구현 채택**으로 답했다. 승인 대상은 `docs/contracts/FN08_NATIVE_JOURNAL_RESTART_BINDING_CANDIDATE_20261114.md` 원문 SHA256 `6FC307D7C13435563F6E9BD99B2F8BF473E45B6584C16F401A41250169BBAC87`이다. 후보 원문은 수정하지 않고 당시 미채택 문구는 작성 이력으로 보존한다.

기존 Trust root의 journal 전용 namespace·목적별 보호 연산·원 설치/등록/사용자/authority 결박·존재 원장·배타/CAS·유한 한도·불명 보존·명시 재시작 식별을 코드와 합성 검증으로 구현한다. 신규 namespace는 총 ciphertext64MiB·authority10,000개·원형 행2MiB, 기존 authority당 exact2행을 유지한다. 자동삭제·과거 권위/process/grant 복구·재실행은 허용하지 않는다.

실제 파일·ACL·키·DB·권한 적용·서비스·helper/C# 컴파일·Agent/프로세스 실행은 제외한다. 보호 source/모형 성공을 실제 Windows 내구성·권한 검증으로 승격하지 않는다.

기준 main PR108 `2c42f84b021350b8412555b4e7f4ebd40d377815`, 현재 기록 checkpoint `05e070dd24cc77f774963105678657709646489e`, 단일 branch `codex/av3-d1-journal-binding`, 시작 clean 및 원문 지문 일치를 확인했다. 기존 Primary 단일 writer가 Main의 정확 경로 WI 이후 구현하고 Main은 문서·검수·통합을 담당한다. 독립 검수는 read-only다. 전체 작업계획 완료나 실제 실행 승인이 아니다.
