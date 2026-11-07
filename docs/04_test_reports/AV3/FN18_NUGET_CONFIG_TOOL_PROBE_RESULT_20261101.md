# FN18 NuGet 설정 옵션 제한 진단 결과

판정: **BASELINE_FAILED · 설정 소비 미확정 · Anvil 산출물/설치 미검증**.

- 기준 source/private: b15050e7779047bf5f81b0a6891b1c50bf362a83, branch codex/av3-stage-b. main f976ed5e29e14b13e12729d5b1ccf98f050f2210 불변.
- 실행안: docs/work_packages/FN18_NUGET_CONFIG_TOOL_PROBE_EXECUTION_PLAN_20261101.md, SHA256 DF33E47F5857C82686C83B8036BBF20510FF7474081BFA88B863DF30E9FBBC09. 실행 전 독립 C0/I0.
- 고정 vendor NuGet SHA256 61704F7DBE233980992F2A00EF9BAACF64A8B157D688A4A4BE6B7A2EAEA02828, 제품 버전2.8.3. 새 합성 nuspec/payload·명시 정상 ConfigFile로 pack **1회**만 수행했다. 실제 Anvil package·사용자 파일/설정·Squirrel·Setup·Update·앱 실행은 하지 않았다.
- 2026-11-01T02:30:36.742Z~02:30:37.841Z: PID85876, CLOSED/exit1, exitSeen=true/closeSeen=true, stdout0/stderr32바이트, 생성물0, 입력 hash 불변. stderr 원문 NOT_CAPTURED로 정확 오류는 미확인이다. 분류 boolean false를 원인 부재로 해석하지 않는다.
- 정상 baseline 실패로 후속 잘못된 설정 음성은 NOT_EXECUTED. 실제 NuGet 호출1·자동/수동 재시도0. 현재 Microsoft 문서는 고정된 옛 binary의 옵션 지원을 증명하지 않는다.
- 영수증: FN18_NUGET_CONFIG_TOOL_PROBE_RECEIPT_20261101.json, SHA256 AFEC70BAC7B6E74EF26719FC8E227912248FC2FC5BFD2CC55905D422CA45FD74. receipt.finalResources는 최종 receipt 재작성 전 집계이므로 최종 disk footprint로 인용하지 않는다.
- QA root D:\tmp\anvil-v3-fn18-nuget-config-probe-20261101-01, owner SINSAN\cyhuh, marker fcbc0c60-e700-4632-9794-214e28e97641. marker/script/receipt 지문·소유·비link·PID부재를 대조하고 파일7/등록 디렉터리14와 root를 제거했다. 독립 root 부재/보존 receipt hash 일치 확인. 계획 수명02:40:32.125Z보다 정리가 늦은02:41Z대로 **수명 준수 실패1**이다. 실행은02:30Z에 종료, 기한 연장0이다.
- 정적 조사: 대상 assembly를 실행/로드하지 않은 PE metadata에서 base Command.ConfigFile의 OptionAttribute와 derived PackCommand.ConfigFile의 attribute 부재를 확인했다. 옵션 가림 가설은 parser와 대조 전이며 원 stderr를 복원한 것이 아니다.
- 기본 native isolation guard 유지. ConfigFile 제거·허용 기준 완화·도구 업그레이드·재호출0. source/synthetic PASS를 실제 native/kernel/설정·network 격리·제품 설치 성공으로 승격하지 않는다.
- 실제 DB·권한·키·서비스·Agent/기존 프로젝트 차단 상태 변경0. 제품/시험 소스 변경0. 전체 FN18 및 WORK_PLAN 미완료. 실패 원인 검토와 별개로 기존 Primary가 다음 승인 source 기능을 대조한다.

검증 명령은 등록 script의 정확 argv를 실행안과 영수증으로 추적한다. script에는 내부 실행경로가 있어 원문을 배포하지 않고 SHA256 76772DCC70FDCDB88E23FD68716D881DDF777F6DAD31E48ABA69B6C63B02E83C를 보존한다. QA 재생성/재실행은 이번 결과의 복구 절차가 아니며, 새 근거와 검토 없이 수행하지 않는다.
