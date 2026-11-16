# Anvil 작업 점검표

<!-- CURRENT_WORK_ENTRY_START -->
<!-- ANVIL_CURRENT_SUMMARY_V2 -->
## 현재 작업 요약 — 2026-11-17 00:19:50 KST

- **현재 상태: 전체 계획 미완료 · PR159 설정 수정 통합 완료·FN07 실제 SDK 생산자 구현 중.** 고정 package/원 worker/단발 child bridge/query factory를 한 경로로 닫으며 실제 실행은 제외한다.
- **현재 승인·결과:** 서버 항목 귀속5039D14A는 PR156 통합됐다. CLI 보완은 기존 승인 목적이라는 최신 PMO 명확화로 수행했으며 새승인 질문은 철회했다. 770175 결과 IMAGE_SIZE·자식/감독exit0·핸들0, 원20670a UNKNOWN/소진도 보존한다. 한도 확대·실제Agent 실행은 하지 않는다.
- **담당·실행:** 기존 Primary 한 명이 검수 보완 명세의 제품12·시험3 경로에서 실제 SDK 생산자 A→D를 구현한다. Main은 범위·인터페이스 검수와 통합을 맡는다. 기존 관측/실행 핸들은 0이며 실제 DB·권한·키·서비스·Agent 실행은 제외한다.
- **Git 제품 기준:** 최신 검증 main19e0430705f667593972524ed7c1c1c4e3cf1b66(PR159). sourceff3504fe와 tree 동일·병합본설정RAM1PASS/중복경고0·복구tag pr-159-head와 완료branch 정리 확인. 현재 codex/av3-normal-sdk-producer에서 다음 기존 승인 source 구현을 준비한다.
- **완료한 소스 단위:** START 준비·원 READY·첫/후속 SEND·보호 출력·같은 Query 입력은 PR144~151에 source/RAM으로 통합됐다. STOP 소비 상태기계도 존재하지만 등록 실행기의 독립 CURRENT 생산자·실제 OS/SDK 연결은 미완료다. 소비 코드와 생산자 미연결을 구분한다.
- **최근 확정 검증:** PR150 보호 출력과 PR151 동일 Query 입력은 각각 독립 C0/I0/M0·필요 타입/메모리 검사·병합본 RAM2건을 통과했다. 이전 PR148 spool 직접64건·선택6건 및 READY smoke는 이력으로 재사용하며 반복하지 않는다. 실제 SDK·Windows·DB 검증과 전체 인수는 미완료다.
- **현재 구현 검증:** UI06 서버 항목 귀속은 직접87PASS·인접43PASS·루트타입0·독립 C0/I0/M0·27개 지문 일치·병합본 RAM3PASS로 PR156에 통합됐다. 구형 미기록·B/본문section A 구별·원receipt/audit·적용본 교체후 과거읽기/개정409를 확인했다. 실제 PG/served UI·Agent 실행 증거는 아니다.
- **미확인·남은 기능:** 실제 SDK/CLI·OS 프로세스·도구 권한 집행, C# 컴파일·Windows 파일/ACL·보호 저장, 실제 DB·서비스·브라우저 통합 및 사용자 인수는 미검증이다. 실제 Agent 생산자와 전체 작업계획은 미완료다.
- **P03·SSH:** R3 복구는 복사·PG 기동·전환에 도달하지 못했고 원 자원을 보존한다. 자동 wrapper의 SSH255/UNKNOWN과 일반 SSH를 구분한다. 사용자 Windows PowerShell 로그인 성공 증거(11-16 18:04:45 KST)가 있으며 서버/로그인 불능으로 일반화하지 않는다. 새 부수 진단·재복제·정리는 하지 않는다.
- **기록 기준:** 소스/RAM 합격, 실제 동작 확인, 사용자 인수를 구분한다. 기존 서로 다른 이력은 아래 보관 영역에 남긴다. 사용자 열람본의 기존 미추적 원본은 `D:\Project\Anvil\.av3-data\status-view-backup-20261116-184648`에 원본 해시 그대로 보존했다.

### 44개 업무의 최종 인수 요약

완료 체크는 P01/P02 준비 수용만 유지한다. 미체크 42개에는 부분 구현·동작 미확인·미구현이 섞여 있으므로 이를 미구현 수나 진척률로 환산하지 않는다. 이 표는 기존 44업무 대조에 현재 확인된 후속 변경을 반영했으며 실제 검증 없이 완료 체크를 올리지 않는다.

| 완료 | 업무 | 상태 | 남은 기능·검증 |
|---|---|---|---|
| [x] | P01 | 준비 범위 완료 | 제품/DB 기능 인수와 별개. 시안 재작성 불필요 |
| [x] | P02 | 준비 범위 완료 | 실제 Agent 지원/성능/손실 수치는 실증거 필요 |
| [ ] | P03 | 부분 구현·복구 미완료 | R3 create-init/IDENTITY_UNKNOWN 후 복사·PG 기동·전환 미도달, 보존. 자동 관측 SSH255/UNKNOWN은 일반 로그인 불능 근거가 아니며 사용자 11-16 18:04:45 KST 로그인 성공 확인. 실제 DB·사본 상태 미확인 |
| [ ] | UI00 | 부분 구현 | 현재 서비스 전체 왕복/접근성. M2의 기존 세션 재확인 결합은 이번 합성 직접시험으로 확인; 암호 로그인/실서버는 별도 |
| [ ] | UI01 | 부분 구현 | 현재 단계/담당/실작업/다음행동 응답 생산·실사용 두 프로젝트 검수 |
| [ ] | UI02 | 부분 구현 | 실제 기존 소스 관측/기준선·총괄/환경 배치·전체 자료 가져오기·실DB 여정 |
| [ ] | UI03 | 부분 구현 | 실제 총괄 제안·실행 중 영향 근거·served 저장왕복 |
| [ ] | UI04 | 부분 구현 | 실제 총괄/책임 Agent 세션·지시/수행·중지/재개. 비활성 버튼을 임의 활성화하지 않음 |
| [ ] | UI05 | 부분 구현 | 실제 증거 진위/완료 수용·실제 쓰기 회수·후속 보완 임무 |
| [ ] | UI06 | 부분 구현 | 빈 초안/작성틀의 저장 전 선택 보존·표시 source/RAM 검수·PR153 통합 완료. 버전별 서버 item 귀속 저장/조회는5039D14A의 source/RAM 검수·PR156 통합 완료이며 기존 문서 추정0, 실제 파일/시험/diff 연결·served 사용자 인수도 미완료 |
| [ ] | UI07 | 부분 구현 | 보호 영향/OS writer 근거 부재로 실제 적용412. 기준 전환→계획 개정→영향 업무 재개 |
| [ ] | UI08 | 부분 구현 | 실제 관측 기반 문제 분류/회수/교체·실행 효과와 승인 연결 |
| [ ] | UI09 | 부분 구현 | 실제 새 대상/세션·6항목 이해 대조/이전 확정/안전재개 |
| [ ] | UI10 | 부분 구현 | 원발언 자동 이동의 대화방 매핑·실제 공유/헌법 전달·이해 대조 |
| [ ] | UI11 | 부분 구현 | 실제 첫/둘째 Agent 연결/측정·역할 배정·Windows↔WSL·해제 |
| [ ] | UI12 | 부분 구현 | 실제 두 기기·구세대 차단/PG 원자성·진행 작업/실정지 요약. 수락 코드 자체는 존재 |
| [ ] | UI13 | 부분 구현 | 실제 지시/역할·중지/재개·기기/원격 제어·푸시·실기기 인수 |
| [ ] | UI14 | 부분 구현 | 전체 프로젝트/DB/소스 백업/검증복원·전체 슬롯·외부 push/설치 운영 |
| [ ] | FN01 | 구현했지만 동작 미확인 | 현재 통합본 생성→재시작→권한별 조회 전체 여정. USER_DECLARED/UNVERIFIED는 의도된 표식 |
| [ ] | FN02 | 구현했지만 동작 미확인 | 현DB/served의 빈 작성·복사 수정·두 프로젝트 버전 고정 |
| [ ] | FN03 | 부분 구현 | 실제 보호 파일 관측 생산자→드리프트→제안 수집 미완료, 현재 공급자 부재412 |
| [ ] | FN04 | 부분 구현 | 실제 영향 완전성/OS writer 회수 공급자 부재로 실제 적용 차단, 영향 업무 재개 |
| [ ] | FN05 | 부분 구현 | 실제 공유/대상 반영·Agent 맥락 전달→새 세션 이해 대조 |
| [ ] | FN06 | 부분 구현 | 등록·준비·보호 연결 source는 구현·검수됨. 실제 기존 Agent의 파일·시험·결과·중지/회수 여정은 미확인 |
| [ ] | FN07 | 부분 구현 | PR150 보호 출력·PR151 같은 Query 첫/후속 입력 source/RAM·독립 검수·병합본 smoke 완료. 실제 SDK/CLI 생산자·독립 STOP CURRENT·둘째 도구/계정 교체는 미완료 |
| [ ] | FN08 | 부분 구현 | PR148~151 profile/예산·원 READY·제5 출력 보호·같은 Query 입력 source/RAM 검수 완료. 실제 Windows 프로세스/도구 승인·중지/회수·재접속 인수는 미완료 |
| [ ] | FN09 | 부분 구현 | 실제 총괄/단계/하위 Agent 운영 연결. queue/material/outbox 합성 저장은 실제 실행이 아님 |
| [ ] | FN10 | 부분 구현 | 실제 scheduler/dispatch·완료→다음 단계 실행. 과거 실제 PG 대기열 증거는 별도 유지 |
| [ ] | FN11 | 구현했지만 동작 미확인 | 현 전체SQL의 실제 ACL/RLS/경쟁/회수/만료·부작용1회 통합 |
| [ ] | FN12 | 부분 구현 | 실제 관측/산출물 진위 기반 완료 수용·보완→후속 임무 배정/실행 계보 |
| [ ] | FN13 | 부분 구현 | 실제 OS 프로세스/쓰기 회수→잔류→reconcile→수동재개. HTTP quota 저장은 현재 연결돼 있음 |
| [ ] | FN14 | 부분 구현 | 실제 인계 manifest 동결/회수·새 대상 이해 대조/확정/재개 미완료 |
| [ ] | FN15 | 구현했지만 동작 미확인 | 현재 실제DB/두 기기·모바일·이전 writer 폐기 여정. 과거 QA setup 실패와 분리 |
| [ ] | FN16 | 부분 구현 | 전체 프로젝트 DB/소스/미커밋/관계 반출→별도 복원검증→영향/확정 적용 |
| [ ] | FN17 | 부분 구현 | 중요 오류/자동한도/최종완료 사건과 모바일 push 구독/전달 |
| [ ] | FN18 | 부분 구현 | PR147에서 desktop 타입0·원 런타임 타입 연결 source 검수. 실제 C#·Windows 보호 저장/설치·격리 실행·로그인/재시작·업데이트/제거는 미검증 |
| [ ] | IX01 | 미완료 | 방법론3종/선택3경로→문서/계획/지식·실DB 저장/재조회·브라우저·재시작/TM07 |
| [ ] | IX02 | 미완료 | 화면 지시→실제 Agent→파일/시험→제출/검수→추적 |
| [ ] | IX03 | 미완료 | 자동/건별·승인/거절/수정/불명·보완/중지/대조 재개 |
| [ ] | IX04 | 미완료 | 새 세션/다른 도구/총괄 교체와 변경 통제 A~D |
| [ ] | IX05 | 미완료 | 실제 두 사용자/client 제어 인수·옛권한 차단·중복1회/모바일 |
| [ ] | IX06 | 미완료 | 전체백업→별도복원→단절재기동→대조재개→설치형 |
| [ ] | IX07 | 미완료 | IX01~06/TC01~15 실제 전체 기능과 사용자 확인 |
| [ ] | IX08 | 미완료 | Oracle의 정확 후보 정밀 검증·사용자 인수 |
<!-- CURRENT_WORK_ENTRY_END -->

## 이전 요약·누적 이력 — 당시 기록 보존(현재 판정 아님)


갱신: 2026-11-15 / 담당: Main 어울(normal SEND 서버 통합·실행기 자료 소비 연결)

- 현재 실행기 자료 소비: 기존 Primary 제품2/시험3 구현, 직접인접45P·Main직접24P·타입0·독립 C0/I0/M0. 혼합 START/SEND 보호GET 원문 재조립 source 검수 완료·PR117 통합. 후속 SEND 내구수신·permit source는 PR118에 통합됐으며 실제 Agent/DB는 미완료.
- 현재 SEND 내구 수신: 전용 수신·시도·permit 기록8경로 source 검수 완료. 독립 I1(부분 사이 만료 검사)을 보정해 최종 C0/I0/M0, Main 최종16P·PR118 통합. 실제 파일 내구성·DB·Agent·wire/cursor는 미완료.
- 최신 통합: PR119/main `62a0e16a` local/private exact·clean·merged SEND wire RAM smoke1P 확인. 서버 SEND·실행기 자료 소비·내구 수신/시도 source를 통합했다. SEND 내부 전달 연결6경로는 독립 C0/I0/M0·최종49P/Main22P로 source 검수 완료·PR119 통합이며 실제 Agent/DB·전체계획 미완료.

- 혼합 SEND polling·관측 ACK·cursor: source10경로 검수 완료(Primary57P·Main12P·독립 C0/I0/M0), PR120/main38388a92 통합·merged RAM1P. 실제 DB/Agent 및 전체 인수 미완료. STOP A안 source 경계는 PR121로 통합했다.

- normal STOP: 대상 codec·GET/명령 보호거절·역사 저장 형상·STOP 전용 페이지/소비 source23경로 검수. 실제 CURRENT 생산자가 없어 GET/신규 저장412·SQL 신규쓰기false이며 정상 중지 기능은 미완료. 독립C0/I0/M0·Main서버7P/저장형상RAM page1P, 0098 미적용. PR121/main65a51ae2 local/private exact·clean, merged RAM1P. UI10 기존 지시 부분계획 명시 조회 source4경로 PR122/mainf37d4e96 통합·local/private exact·merged RAM SSR1P(직접8P/인접9P/type0·독립C0/I0/M0). 실제 DOM 검증은 미완료.

- STOP 역사 관측 소비7경로 PR123/main3c457c90 통합·local/private exact·merged RAM1P: 원 START/역사/strictClose 검산→기존 spool ACK→UNKNOWN/cursor 유지. 직접14P/영향47P/type0, 실제 owner·협력적 중지는 미구현.

**전체 작업계획 미완료.** 아래 체크는 준비 문서 수용 2건만 완료이며, 제품/실환경 인수는 42건이 남아 있다. 각 행은 기존 44항목 대조 결과와 PR72~74 변경분을 기준으로 한다. 코드·합성 검증과 실제 실행·사용자 인수를 구분한다.

- 이전 통합 기준선: `main` `12f4b58a7111c400bbc7a4c98f103a7ad9653831`(PR114). normal 회수 계약 직접 채택·source 검수·통합 및 local/private 동기화·merged RAM smoke 1P를 확인했다. 후속 `codex/av3-fn08-normal-stop-contract`에서 normal 중지 종단의 원 세션 권위·제어 호출선·공개 응답 형상을 구체화 중이다.
- 2026-11-15 PR115 이전 검수 이력: normal SEND A안과 지시 부분계획 보완 A안 직접 채택 후 기존 Primary가21경로를 구현 중이다. 순수 부분계획3P와 보호 원문 GET→SEND저장→혼합page→자료전달/재조회 직접37P, 해당 묶음 독립 C0/I0/M0를 한정 수용했다. 최초쓰기 전용 graph 재사용 결함은 기존 역사 START 검산 함수로 교정·독립 C0/I0/M0이며 실제PG 검증은 아니다. 명령별permit 직접10P·독립 C0/I0/M0, 영향9파일172P와 타입 검사도 통과했다. 미적용0097 정적7P·최종 접점 독립 C0/I0/M0까지 source 검수를 마쳤으며 통합 전이다. 결과서는 docs/04_test_reports/AV3/FN08_NORMAL_SEND_DISPATCH_SOURCE_RESULT_20261115.md다. 고정 SDK READ3는 DNS ENOTFOUND로 실패·1회 소진했다. 실제DB/Agent 및 전체FN08·계획 완료로 표시하지 않는다.
- 2026-11-15 PR115 후속: main `a93677d5`에 source가 통합됐으나 병합 후 단독 RAM smoke가 시험 초기화 경로 ENOENT로 실패했다. 현재 기존 작업 브랜치에서 시험 독립성 보완 중이며 merged smoke·최종 정리는 미완료다. 전체 계획 완료 체크는 변경하지 않는다.
- 아래 44행 상세 코드 집계의 과거 기준: `development/main` `967c9a207452f5d3c9d79a1d8906e25a396dd704`.
- 최신 직접 채택: worker 배포 근거 전달 A안(source-only), SHA256 50596FFC…2FD4389. 해당 source와 명시 앱 연결은 PR112·113으로 통합됐다. 실제 설치/실행 및 전체 계획은 미완료다.
- PR110/main7efc5111 통합: native retained 조립 제품3/시험3을 독립 C0/I0/M0·Main29개 한정 검사·root tsc0으로 수용했다. 보호 입력 생산자가 미등록이라 기본 실행은 거절하며 Windows 실제 실행·정상 재시작은 미완료다. 상세: docs/04_test_reports/AV3/FN08_NATIVE_RETAINED_FACTORY_SOURCE_RESULT_20261114.md.
- 과거 통합 기준선(이력): `main` 6c4974c4(PR109). FN08 typed journal/owner/Client source 연결·RAM66검사·독립C0/I0/M0를 통합했고 local/private 동일·clean 및 merged smoke1P 후 완료branch/tag를 정리했다. Windows 구체 저장은 종료 불명 확정 근거가 없어 unsupported로 닫히며 정상 내구저장·재시작은 미완료다. 후속 source 조립은 PR110에 통합됐고 보호 입력 생산자 원천을 대조한다. 실제 파일·ACL·키·DB·서비스·Agent 실행 및 전체 계획은 미완료·제외 범위를 유지한다.
- 인수 뒤 현재(2026-11-11): 원격 main은 PR84로 2e0eab21이며 대기 당시 WIP(시험2·미채택 후보 문서1)가 main에 포함돼 있다. 작업 branch `claude/av3-normal-start-materials`에서 checkedMaterialPart만 구현했다(해당 시험 1P, 0088 SQL 시험은 0088 부재로 실패 유지). 자료 GET의 route·0088·nonce 소비는 bytes 표현/자료 발견 후보 채택과 원본 재구성 주체 결정 전까지 보류다. 아래 대기 기록은 11-08 시점 이력이다.
- 2026-11-11T03:51:34+09:00: 자료 전달·발견 후보 A안 직접 채택. §2 명령 페이지 자료 descriptor를 source·미적용 0088·합성 시험으로 구현했다(FN08 normal 계열 33P). §3 자료 bytes GET은 미구현이며 WIP SQL 시험 1건은 실패 유지다. FN08 행 상태는 그대로 부분 구현이다.
- 2026-11-11T14:39:31+09:00: A안 §3 자료 bytes 보호 GET을 source·미적용 0088·합성 여정으로 구현했다(FN08 normal 계열 85P). 맥락 묶음 원문은 서버 주입 공급자 방식(신산님 직접 결정)이며 실제 공급자·실행기 소비 codec·실제 DB 검증·독립 검수는 남았다. FN08 행 상태는 부분 구현 그대로다.
- 2026-11-11T19:30:00+09:00: PR84·PR85가 독립 검수 전에 main에 병합된 것을 사후 독립 정적 검수했다. C0/I1/M5, 병합 차단 사유 없음. I1(맥락 묶음 공급자를 프로젝트 행 잠금 안에서 호출)은 실제 공급자 구현 전 보완 대상이다. main 7b1e8b26 FN08 normal 계열 84P/1F(Windows CRLF 판정 1건, LF 원문은 통과), typecheck 0. 실제 DB의 0088 실행은 미검증이다.
- 2026-11-12T10:30:00+09:00: 실행기 쪽 명령 페이지·자료 응답 소비 codec을 source·합성 시험으로 구현했다(실제 서버 응답 소비·조립 확인, FN08 normal 계열 89P/1F 기존 CRLF, 독립 C0/I0/M5). 실행기 HTTP·credential 서명 클라이언트 연결과 실제 DB·Agent는 남았다. FN08 행 상태는 부분 구현 그대로다.
- 2026-11-12T12:30:00+09:00: 실행기 보호 GET 클라이언트(challenge 발급·서명·GET·codec 검산, 결과 불명 시 자동 재전송 0)를 source·합성 시험으로 구현했다(독립 C0/I1/M5 반영, FN08 실패 목록 main과 동일). 실행기 런타임 조립과 실제 TLS·DB·Agent는 남았다. FN08 행 상태는 부분 구현 그대로다.
- 2026-11-12T14:30:00+09:00: 신산님 선택대로 normal 전용 START 수신기를 source·합성 시험으로 구현했다(자료 내구 기록→RECEIVED에서 멈춤, permit·Agent 0, 독립 C0/I1/M8 반영). 서버 normal permit 부재로 START 실행 전달은 불가하며 실제 전송 활성화는 P3 승인 대상이다. FN08 행 상태는 부분 구현 그대로다.
- 2026-11-12T16:30:00+09:00: PR84·85 검수 지적 I1(맥락 묶음 공급자를 잠금·거래 밖에서 호출)·M1(.gitattributes 미적용 SQL LF)·M5(고정 inspect 바꿔치기 시험을 hook으로 정정)를 반영했다(독립 C0/I0/M3, FN06+FN08 새 실패 0·기존 실패 9건 해소). 실제 공급자 권한 결정은 남았다.
- 2026-11-13T02:40:00+09:00: 기존 실패 시험 정리(PR92·93)를 마쳤고, P3 실제 전송 활성화(D1)와 맥락 묶음 공급자 권한(D2) 결정안을 docs/contracts/FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113.md로 올렸다(권장 D1 A 단계 분할, D2 A grant 결박 내부 전용 읽기). 결정 대기.
- 2026-11-13T03:10:00+09:00: P3 결정안 채택(D1 A 단계 분할·D2 A grant 결박 내부 읽기). D2는 다중 모듈 권한 경로 분리가 필요해 세부 작업지시서를 먼저 작성한다. D1 2단계 서버 normal permit source가 다음 구현 후보다.
- 2026-11-13T05:30:00+09:00: D1 2단계 중 서버 normal START 일회 실행 허가(permit)를 계약·source·미적용 SQL 0089·합성 시험으로 구현했다(독립 C1/I2/M6 반영, 관련 시험 새 실패 0). receipts·observations·heartbeat와 실제 DB 적용은 남았다.
- 2026-11-13T07:30:00+09:00: D1 2단계 서버 normal 실행 관측(receipts·heartbeat 포함)을 계약·source·미적용 SQL 0090·합성 시험으로 구현해 D1 2단계 서버 경로를 갖췄다(독립 C1/I1/M5 반영). 다음은 D1 3단계 실행기 source와 D2 작업지시서, 0083~0090 개발 DB 적용(별도 승인).
- 2026-11-13T08:30:00+09:00: D2 세부 작업지시서(docs/work_packages/FN08_D2_GRANT_BOUND_CONTEXT_READ_WI_20261113.md)를 작성했다. 접근 판별자로 한 구현을 유지하고 P-A 동작 불변 리팩터 → P-B 공급자 순서다.
- 2026-11-14T09:00:00+09:00: D2 P-A 접근 판별자 도입(동작 불변 리팩터, 11개 모듈)을 마쳤다(회귀 기준선 420건 변경 없이 통과, 독립 C0/I0/M5). 다음은 D2 P-B 공급자 구현 또는 D1 3단계.
- 현재 상황: D2 P-B는 source 독립 C0/I0·영향71P·typecheck와 시험 보완 후 PR100으로 통합했다. D1 실행기 수신→내구 시도/permit→context·options 전달→관측/ACK source는 Main22P·typecheck·독립C0/I0으로 PR101에 통합했다. 최초 credential 교환·보호 저장/사용과 실제 adapter는 남아 있다. 실제 DB·서비스·Agent 실행은 제외하며 전체 D1/FN08 완료로 표시하지 않는다.
- 최근 소스 검수: PR76 duplex, PR77 normal grant/독립 예약, PR78 최초 challenge, PR79 일회 교환·nonce 소비, PR80 조회 challenge, PR81 명령 페이지·고정 응답. 모두 main 통합·핵심 smoke 확인, 실제 Agent·DB·전체 기능 인수는 미완료다.
- 현재 미확인: 실제 개발 DB 복구·served/Agent 전체 여정·실기기·Oracle 인수. 지정 SSH Connection refused를 PASS로 표시하지 않는다.
- 결정 대기: 기존 PMO 발행 2건(e59592e3,239845d6), 직접 답변 미수신. 중복 요청하지 않는다.
- 상세 현재 상황/오류/다음 조치: [WORK_STATUS.md](WORK_STATUS.md)의 ‘현재 상황 보완’ 절.
- [44항목 상세 근거](https://github.com/sinsan-develop/Anvil/blob/967c9a207452f5d3c9d79a1d8906e25a396dd704/docs/04_test_reports/AV3/WORK_PLAN_REMAINING_AUDIT_20261108.md)

| 완료 | 업무 | 상태 | 남은 기능·검증 |
|---|---|---|---|
| [x] | P01 | 준비 범위 완료 | 제품/DB 기능 인수와 별개. 시안 재작성 불필요 |
| [x] | P02 | 준비 범위 완료 | 실제 Agent 지원/성능/손실 수치는 실증거 필요 |
| [ ] | P03 | 부분 | 11-16 고정8d R3 단1회 실제 진입은 create-init/IDENTITY_UNKNOWN 실패·승인 소진. init/사본/원장 보존, 복사·PG 기동·전환 미도달. CAP_CHOWN 소스 보완 RAM74P. 추가 metadata 관측 1회는 SSH255/행0으로 UNKNOWN·소진, 실제 복구 미완료 |
| [ ] | UI00 | 부분 구현 | 현재 서비스 전체 왕복/접근성. M2의 기존 세션 재확인 결합은 이번 합성 직접시험으로 확인; 암호 로그인/실서버는 별도 |
| [ ] | UI01 | 부분 구현 | 현재 단계/담당/실작업/다음행동 응답 생산·실사용 두 프로젝트 검수 |
| [ ] | UI02 | 부분 구현 | 실제 기존 소스 관측/기준선·총괄/환경 배치·전체 자료 가져오기·실DB 여정 |
| [ ] | UI03 | 부분 구현 | 실제 총괄 제안·실행 중 영향 근거·served 저장왕복 |
| [ ] | UI04 | 부분 구현 | 실제 총괄/책임 Agent 세션·지시/수행·중지/재개. 비활성 버튼을 임의 활성화하지 않음 |
| [ ] | UI05 | 부분 구현 | 실제 증거 진위/완료 수용·실제 쓰기 회수·후속 보완 임무 |
| [ ] | UI06 | 부분 구현 | 문서 항목별 귀속 ref 저장·실파일/시험/diff의 실제 연결 |
| [ ] | UI07 | 부분 구현 | 보호 영향/OS writer 근거 부재로 실제 적용412. 기준 전환→계획 개정→영향 업무 재개 |
| [ ] | UI08 | 부분 구현 | 실제 관측 기반 문제 분류/회수/교체·실행 효과와 승인 연결 |
| [ ] | UI09 | 부분 구현 | 실제 새 대상/세션·6항목 이해 대조/이전 확정/안전재개 |
| [ ] | UI10 | 부분 구현 | 원발언 자동 이동의 대화방 매핑·실제 공유/헌법 전달·이해 대조 |
| [ ] | UI11 | 부분 구현 | 실제 첫/둘째 Agent 연결/측정·역할 배정·Windows↔WSL·해제 |
| [ ] | UI12 | 부분 구현 | 실제 두 기기·구세대 차단/PG 원자성·진행 작업/실정지 요약. 수락 코드 자체는 존재 |
| [ ] | UI13 | 부분 구현 | 실제 지시/역할·중지/재개·기기/원격 제어·푸시·실기기 인수 |
| [ ] | UI14 | 부분 구현 | 전체 프로젝트/DB/소스 백업/검증복원·전체 슬롯·외부 push/설치 운영 |
| [ ] | FN01 | 구현했지만 동작 미확인 | 현재 통합본 생성→재시작→권한별 조회 전체 여정. USER_DECLARED/UNVERIFIED는 의도된 표식 |
| [ ] | FN02 | 구현했지만 동작 미확인 | 현DB/served의 빈 작성·복사 수정·두 프로젝트 버전 고정 |
| [ ] | FN03 | 부분 구현 | 실제 보호 파일 관측 생산자→드리프트→제안 수집 미완료, 현재 공급자 부재412 |
| [ ] | FN04 | 부분 구현 | 실제 영향 완전성/OS writer 회수 공급자 부재로 실제 적용 차단, 영향 업무 재개 |
| [ ] | FN05 | 부분 구현 | 실제 공유/대상 반영·Agent 맥락 전달→새 세션 이해 대조 |
| [ ] | FN06 | 부분 구현 | 실제 기존 코딩 Agent 작은 작업→파일/시험/결과/중지 회수 제품 연결 |
| [ ] | FN07 | 부분 구현 | 실제 둘째 도구/계정 교체·생성/지시/결과, 현재 핵심 bridge는 SYNTHETIC_ONLY |
| [ ] | FN08 | 부분 구현 | 실제 Windows 소유 프로세스/도구 승인·중지/회수·재접속 생산 경로/실측 |
| [ ] | FN09 | 부분 구현 | 실제 총괄/단계/하위 Agent 운영 연결. queue/material/outbox 합성 저장은 실제 실행이 아님 |
| [ ] | FN10 | 부분 구현 | 실제 scheduler/dispatch·완료→다음 단계 실행. 과거 실제 PG 대기열 증거는 별도 유지 |
| [ ] | FN11 | 구현했지만 동작 미확인 | 현 전체SQL의 실제 ACL/RLS/경쟁/회수/만료·부작용1회 통합 |
| [ ] | FN12 | 부분 구현 | 실제 관측/산출물 진위 기반 완료 수용·보완→후속 임무 배정/실행 계보 |
| [ ] | FN13 | 부분 구현 | 실제 OS 프로세스/쓰기 회수→잔류→reconcile→수동재개. HTTP quota 저장은 현재 연결돼 있음 |
| [ ] | FN14 | 부분 구현 | 실제 인계 manifest 동결/회수·새 대상 이해 대조/확정/재개 미완료 |
| [ ] | FN15 | 구현했지만 동작 미확인 | 현재 실제DB/두 기기·모바일·이전 writer 폐기 여정. 과거 QA setup 실패와 분리 |
| [ ] | FN16 | 부분 구현 | 전체 프로젝트 DB/소스/미커밋/관계 반출→별도 복원검증→영향/확정 적용 |
| [ ] | FN17 | 부분 구현 | 중요 오류/자동한도/최종완료 사건과 모바일 push 구독/전달 |
| [ ] | FN18 | 부분 구현 | 실제 설치 산출물·격리 실행/로그인/재시작·업데이트/제거. native 격리 미확인으로 생성 차단 |
| [ ] | IX01 | 미완료 | 방법론3종/선택3경로→문서/계획/지식·실DB 저장/재조회·브라우저·재시작/TM07 |
| [ ] | IX02 | 미완료 | 화면 지시→실제 Agent→파일/시험→제출/검수→추적 |
| [ ] | IX03 | 미완료 | 자동/건별·승인/거절/수정/불명·보완/중지/대조 재개 |
| [ ] | IX04 | 미완료 | 새 세션/다른 도구/총괄 교체와 변경 통제 A~D |
| [ ] | IX05 | 미완료 | 실제 두 사용자/client 제어 인수·옛권한 차단·중복1회/모바일 |
| [ ] | IX06 | 미완료 | 전체백업→별도복원→단절재기동→대조재개→설치형 |
| [ ] | IX07 | 미완료 | IX01~06/TC01~15 실제 전체 기능과 사용자 확인 |
| [ ] | IX08 | 미완료 | Oracle의 정확 후보 정밀 검증·사용자 인수 |

미구현/부분 구현 기능을 미실행 검증에 숨기지 않는다. 실제 동작·인수 근거가 없는 항목의 체크를 임의로 올리지 않는다.

## 기록 유지 기준

항목 착수·완료, 오류·복구, 중단·인계 전에 WORK_CHECK의 현재 상태와 WORK_STATUS의 일자별 근거를 함께 갱신한다. Main이 사용자 열람 위치의 같은 두 파일에도 반영하고 저장·Git 게시를 확인한다. 한쪽 기록만 갱신한 상태를 기록 완료로 보지 않는다. 상태 변경은 실제 증거가 있는 항목에만 적용하며 이전 이력은 보존한다.

- 2026-11-14 Main 어울 재개: PR99 41790410과 원격 main 동일 확인 후 D2 P-B source·합성 범위를 착수했다. P-A는 재구현하지 않는다. 공급자/자료 여정·거절 시험은 진행 중이며 실제 DB·키·권한·서비스·Agent 실행과 전체 완료는 제외/미완료다.

- 2026-11-14 D1 재교환 source 검수: 같은 grant 비중첩 발급·receipt별 보호 슬롯·명시 renew 및 새credential 관측/ACK·기존wire1 보존을 합성 확인했다. 0091 미적용, 실제 native/PG/Agent 미검증. FN06/FN08 완료 체크는 올리지 않으며 다음 polling 조합을 진행한다.

- 2026-11-14 PR103/main ab1fab01 소스 통합·동기화·완료branch 정리 확인. 다음 D1 normal polling→내구 수신→START→ACK 조합 착수. 실제 Agent/DB/키/서비스는 제외하며 FN06/FN08 부분 구현 상태 유지.

- 2026-11-14 D1 normal polling 소스 조합 검수: GET→자료 내구수신→START→관측ACK, 재시작/갱신wire추가0을12개합성검사로확인. 실제adapter/current공급자·native/DB/Agent·UI는미완료이며FN06/FN08부분구현유지.

- 2026-11-14 PR104/main 68b03a96 통합·동기화·완료 branch/tag 정리 및 병합 smoke1 PASS. 다음 normal adapter source는 기존 Primary에게 배정. 실제 Agent/DB/native 미검증, 완료 체크 유지.

- 2026-11-14 normal Claude adapter source 검수15PASS/독립C0/I0/M0. 원 START/permit/attempt/Options 연결 및 UNKNOWN 재호출0 확인. 실제 process/tool/SID 공급자는 미완료이며 완료 체크를 올리지 않는다.

- 2026-11-14 PR105/main8922562b 통합·동기화·정리완료. normal adapter source 검수완료이나 최초ownership 관측반환/현재성실공급/앱조립미완료. 다음은순환없는준비결과관측계약후보검토이며실제실행0.

- 2026-11-14 최초ownership 반환 A안 source-only 채택. 기존Primary 구현재개, Main검수/통합. 실제환경제외·전체완료체크불변.

- 2026-11-14 FN08 native anchor 정정 채택 후 서버 반환 연결 구현 중. 원 HUMAN prepare/consume→request→RAM P256 결과→원 ledger/head→replay 합성여정1P 및 COMMIT 불명 UNKNOWN/저장0은 구현자 제출이며 Main/독립검수 전이다. 0092 native 부모 완결·retained signer는 미완료이고 실제 DB/native/Agent 검증은 제외한다. FN06/FN08 완료 체크를 올리지 않는다.

- 2026-11-14 FN08 최초 ownership 반환 source 검수: v2/원부모·서명·원장계획·RAM거래/재조회·HTTPS·native 정적 경계 확인, 독립 미해결 C/I0. 실제앱 DB 저장 진입점·retained/key host·grant/current/resume는 미완료. 결과서 FN08_D1_NATIVE_PREPARATION_OWNERSHIP_RETURN_SOURCE_RESULT_20261114.md; 전체 완료 체크 불변.

- 2026-11-14 PR106/main34f613a0 source통합·동기화·정리·merged smoke확인. 다음FN08 내부runtime/build/v2판독연결미완료를조사해착수하며, 실제host/DB/Agent미연결·전체체크불변.

- 2026-11-14 FN08 내부 runtime/build/v2 판독 및 동일 host 소스 조립 검수. retained 수명 I1과 v2 예약38B 누락 I2를 보완하고 독립 C0/I0/M0 확인. Main owner11P·예약/전달2P는 RAM/소스 검증이다. 실제 DB 접근·보호 공급자·grant/current/resume·Agent 실행은 미완료, 전체 완료 체크 유지. 결과서는 FN08_D1_RETURN_RUNTIME_WIRING_SOURCE_RESULT_20261114.md.

- 2026-11-14 PR107/main b2df4dcf 소스통합·동기화·완료branch/tag정리·merged smoke확인. 다음FN08 한정host저장접근A안source-only직접채택으로정확9경로착수. 실제DB/권한/Agent미실행·전체완료체크불변.

- 2026-11-14 worker 신뢰 A안 source18경로 동결·인수. 독립 server/native/build C0/I0/M0, Main 합성·정적55사례 exit0·roottsc0·diffcheck0. Desktop 기준174/현재174/신규0은 전체PASS 아님. 실제 deployment/current 생산자·전달매체·root결박·Windows journal은 미완료다. 실제환경 실행0·전체완료체크 불변. 근거: docs/04_test_reports/AV3/FN08_NATIVE_WORKER_PROVENANCE_SOURCE_RESULT_20261114.md. 다음은 source Git 통합과 후속 전달매체/회수 계약 구체화.

- 2026-11-14 worker 배포 근거 전달 A안 SHA50596FFC…2FD4389 직접 승인 수신. Stage C FN08 후속 계약/목적SQL→compile/package→publisher→sibling설치→원소비 연결을 기존Primary 단일writer로 구현한다. 실제DB/권한/키/자료조사/설치/서비스/C#/Agent 제외 유지. Main 검수·통합, 전체완료체크 불변. 기준 e4d44b29 clean·후보hash 일치 확인, 정확WI 파일목록 확정 중.

- 2026-11-14 FN08 배포 전달 부분진행: 계약/목적조회/미적용0095 및 build→package→publisher source 묶음은 독립 C0/I0/M0·Main 합성검증 후 checkpoint e8ab3ccc로 private 보존했다. client/설치기록/native/명시UI/종단RAM 연결은 구현중이다. 실제 DB·권한·키·자료조사·설치·서비스·C#·Agent 실행0, 전체 완료 체크는 올리지 않는다.

- 2026-11-14 FN08 worker배포전달 한정source검수 완료: 게시/조회→설치조정→보호배포원천→원관측반환 RAM연결과명시설치UI검증, 독립C0/I0/M0. 실제Windows내구설치unsupported·실DB/TLS/C#/Agent미검증, 전체FN06/FN08 및계획완료체크불변. 결과서 FN08_WORKER_DEPLOYMENT_HANDOFF_SOURCE_RESULT_20261114.md.

- PR112/main681af80d source통합·동기화·mergedRAMsmoke확인. 남은FN08: app명시구성에서배포basisadapter를기존host반환route에연결(현재GET등록·여정직접조립). 다음작업으로선정했으며실제환경/Windows내구/전체계획미완료체크유지.

- FN08 명시app소비후속: buildApp 별도옵션→보호store basis→기존반환route 연결 source검수완료(2파일, 독립C0/I0/M0). 앱설정기본값·실환경은미변경. 실제Windows/DB/Agent 및전체계획은미완료.


- 2026-11-14 PR113/main97a2a734 명시 앱 소비 연결 통합·동기화·merged RAM smoke 1P·정확 완료 branch 정리. 실제 환경·Windows 내구성·전체 계획 완료 체크는 유지한다. 다음은 기존 HUMAN grant 회수의 normal 생산자 누락이며, 정확 응답 의미와 기존 승인 범위를 대조 중이다. 제품 writer는 아직 배정하지 않았고 독립 승인 범위의 미완료 연결도 조사한다.

- 2026-11-14 normal HUMAN 허가 회수 source7경로 검수수용. 명시설정→다른OWNER 회수저장→원영수증→challenge거절 RAM여정, 독립C0I0M0·Main직접/회귀/type통과. 실제SQL/프로세스종료/writer해제/Agent 검증아님. FN08/전체완료체크유지.

- 2026-11-15 PR114/main12f4b58a normal회수source통합·동기화·mergedRAM1P·완료branch정리. 실제DB/회수효과/Agent전체여정은미완료. 다음은normal중지종단의계약/현재성/전달선행구체화이며전체완료체크불변.

- 2026-11-15 normal Query 생성 선행 대조: 기존 START permit 재사용, normal SEND 및 보호 실행 구성·SID/child 결박 미완료. 고정 SDK 추가읽기는 이전 DNS 실패 후 새 답변 대기이며 실제 실행 승인과 분리한다. 전체 완료 체크 변경 없음.

- 2026-11-15 SDK READ3은DNS실패·승인1회소진,신규SDK계약미확인. normalSEND서버후보는독립C0/I0/M0·직접채택답변대기,아직제품구현아님. 전체완료체크불변.


- 2026-11-15 FN07 READ4: 직접 추가1회 승인에 따라 기존 Primary가 고정 SDK 원문 GET1회 수행했으나 ENOTFOUND(getaddrinfo ENOTFOUND registry.npmjs.org)로 실패. attempted=true/fetches=1/requestClosed=true/live0/sourceAvailable=false, 1회 소진. READ2/3 포함 동일 DNS 원인3회이며 재시도·환경변경0. 실제 DB·권한·키·서비스·Agent0, SDK 계약 신규 확인0·전체 완료체크 불변. 근거: docs/04_test_reports/AV3/FN07_PINNED_SDK_HOOK_READ4_RESULT_20261115.md. Main은 PMO에 제약·지원사항을 전달하며 완료된 STOP 소스 검증은 반복하지 않는다.

- 2026-11-15 UI14 수동 백업정책 목록선택의fullref누락 보완: 다른유효본문차단/개정불가·직접입력보존. Primary18P/type0·Main4P·독립C0/I0/M0. 소스/RAM행동검수이며 실제브라우저/DB/백업미검증·전체체크불변.

- 2026-11-15 UI09 준비기록에서저장한도정책명시고정조회 source연결. 참조없음GET0·다른hash거절·닫기/교체/ABA/주체전환늦은응답폐기·POST0. Primary43P/type0·Main11P·독립M1문구보완후C0/I0/M0. 실제DB/브라우저/이전/예산권위미확인·전체완료체크불변.

- 2026-11-15 UI12 확정수락결과 GET재조회연결과후속현재GET실패의UNKNOWN역행race보완. 확정/원버퍼보존·추가POST0·현재권위불변. Primary직접7/type0·인접25P1F중stale선택자1개교정/해당1P,Main3P·독립C0/I0/M0. 실제DB/브라우저/제어권인수전체미검증·체크상향0.

- 2026-11-15 직접승인실행: P03R3고정수거ref부재로진입전STOP·새6대상0/독립부재·원volume보존확인,복제NOT_RUN/P03미완료유지. Windows-localSDK0.3.224단발GET/해시검산성공·hook동기성/일부argv/env/PermissionResult선언확인·실Agent효과0/전체FN07체크불변.

- 2026-11-16 UI05/FN13 확정 저장 후 GET실패 복구: source2경로·직접/인접21P/type0/메모리빌드0·Main1P·독립C0/I0/M0. fullref 확정 유지→명시GET복구는 RAM React에서 확인했고 저장POST1·POST응답유실재확인·늦은응답차단을 보존했다. 실제브라우저/DB/전체업무는미완료이며 완료체크상향0.

- 2026-11-16 UI03/FN03 공통양식 저장확정 뒤 조회복구: source3경로·직접/인접22P/type0/메모리build0·Main1P·독립C0/I0/M0. 신규양식발급fullref를화면왕복버퍼에보존→명시GET복구·POST1/다른hash거절을확인. 실제DB/브라우저·전체업무미완료이며완료체크상향0.

- 2026-11-16 UI03/FN02 공통방법론 저장·복사확정 후 조회복구: source3경로·직접/인접23P/type0/메모리build0·Main1P·독립C0/I0/M0. 왕복후명시GET만복구/다른hash거절/PROJECT gateway기존순서보존을RAM에서확인. 실제DB/브라우저/전체업무미완료·완료체크상향0.

- 2026-11-16 UI03/FN02·FN03 검토·확정사건복구: source5경로/직접·인접43P/type0/메모리build0/Main1P/독립C0/I0/M0. 원영수증사건이GET본문과일치해야만확인·pending해제, 사건누락/불일치시보존·GET만복구. 실제DB/브라우저·전체업무미완료·완료체크상향0.

- 2026-11-16 UI06/FN03 문서 내용검토 사건 재조회: source3경로·직접/인접21P/type0/메모리build520모듈0·Main핵심1P. 저장확인/원영수증 유지와 명시GET의 유일한 원사건 일치를 분리했다. 실제DB/브라우저/전체업무 미완료·완료체크 상향0. UI06_DOCUMENT_REVIEW_RECEIPT_READ_SOURCE_RESULT_20261116 참조.

- 2026-11-16 FN08 START 역사 재수신: source4경로/직접10P·인접34P/type0/diff0·Main핵심1P·독립C0/I0/M0. 원 수신/시도 fullref 검산→추가GET/permit/wire0→원 관측ACK/coverage 뒤 cursor를 연결했다. 중간시도 UNKNOWN은 ACK돼도 cursor0. 실제OS/DB/SDK/Agent·전체업무 미완료, 완료체크 상향0. FN08_START_REPLAY_RECOVERY_SOURCE_RESULT_20261116 참조.

- 2026-11-16 FN06/FN08 데스크톱 owner의 보호 GET/POST 쌍: source5경로·직접30P/추가갱신2P/등록인접2P·루트/entry타입0·Main1P·독립C0/I0/M0. 데스크톱 전체 타입169진단은 기준과동일·추가0/소실0이나 FAIL 유지. 실제TLS/키/host/DB/Agent·전체업무 미완료·완료체크 상향0. FN08_DESKTOP_NORMAL_CLIENT_PAIR_SOURCE_RESULT_20261116 참조.

- 2026-11-16 FN10/UI04 판단이력 페이지연속성: source2경로·최종UI18P·기존서버12P별도재사용/type0/메모리build0/Main1P·독립I2해소C0/I0/M0. 동일cursor GET1·거절뒤원문숨김/영수증보존·첫페이지명시복구와늦은응답폐기를확인했다. 실제DB/브라우저/전체업무미완료·체크상향0. FN10_NODE_DECISION_HISTORY_CONTINUITY_SOURCE_RESULT_20261116 참조.

- 2026-11-16 FN08 같은번들 START polling 조립: source6경로·직접36P/등록인접2P·루트/entry타입0·Main1P·독립C0/I0/M0. REGISTERED owner의CJS pair→조립I/O0→첫 non-empty START RAM permit/wire1·원관측5ACK/cursor1을확인했다. 데스크톱169진단은전후동일·FAIL유지, 실제OS/DB/SDK/Agent·root/CURRENT공급/전체업무미완료·체크상향0. FN08_SAME_BUNDLE_START_POLLING_SOURCE_RESULT_20261116 참조.

### 코드 미구현과 실제 검증 미완료의 구분

- normal 실행세대 root 배정/재개·공통 spool 예약 producer: **미구현**. 후보9E98은 게시·검수만 완료했고 직접 source-only 채택 답변 대기다.
- normal Claude SDK Query 호출·원 Query/child 소유 대응·보호 SDK 출력 Sink/fullref producer: **부분 구현·진행 중**. 채택 FN07 후보86A461의 START 준비·출력 소비자·첫 SEND 소스는 PR144/main a86705e5로 통합했다. 원 Query STOP·첫 SEND 이후 출력 수집은 PR145, 같은 Query 후속 SEND는 PR146/main584a7059로 소스 통합했다. 실제 SDK/module/hook·CURRENT·OS 소유·보호 spool9E98의 채택/배정은 미완료다. RAM 합성 factory를 실제 SDK 구현으로 계산하지 않으며 전체 완료 체크는 올리지 않는다.
- 기존 프로젝트/방법론/문서/지식의 연결된 API/UI source는 위 항목과 달리 실제 DB 재시작/권한별·다프로젝트 여정이 미확인인 부분이 있다. 이를 모두 미구현으로 합산하거나 source/RAM 통과를 실제 인수로 승격하지 않는다. 전체44업무 완료 체크는 상향하지 않는다.

- 2026-11-16 FN07/FN08 START 준비 소스 단위: 제품5·시험5, 직접41/인접3/메모리 번들12=56PASS·FAIL/SKIP0, 루트 타입0·Main 핵심1PASS·독립C0/I0/M0. 원 로컬 준비 종단과 마지막 필수 관측의 연속 ACK를 연결하고 실제 SDK 응답과 구분했다. 실제 SDK·OS·등록 owner 조립·보호 저장은 미검증이며 출력 소비자/첫 SEND 결합은 후속이다. 결과서 FN07_NORMAL_START_READY_SOURCE_RESULT_20261116 참조. 전체 완료 체크 상향0.
- 2026-11-16 FN07 세션 출력 소비자: 신규 제품1/시험1, 최종 직접29PASS·FAIL/SKIP0·타입0·Main 재진입1PASS·독립I1 해소 C0/I0/M0. 전체 원문·init 전 불변행/후행 확인·격리·공동 예약·단발 증거를 RAM에서 확인했다. 기존 codec17PASS는 앞 회차 재사용이다. 실제 보호 배정·SDK 생산자와 첫 SEND 결합은 미완료이며 결과서 FN07_NORMAL_SDK_OUTPUT_CONSUMER_SOURCE_RESULT_20261116 참조. 전체 완료 체크 상향0.
- 2026-11-16 FN07 첫 SEND 소스: 제품7·시험5, 교차 역할 소유 I1 보완 뒤 최종 owner 직접12PASS·메모리 빌드12PASS·타입0·Main 반례1PASS·독립C0/I0/M0. 앞선 직접35/인접24/빌드12는 보완 전 실행 이력으로 구분한다. 원 입력 제공과 init 정착의 새 로컬 종단·필수 ACK를 연결했고 실제 응답/업무 완료로 승격하지 않았다. 실제 SDK·배정 공급자와 후속 SEND/STOP은 미완료, FN07_NORMAL_FIRST_SEND_SOURCE_RESULT_20261116 참조. 전체 완료 체크 상향0.

- 2026-11-16 원 Query STOP 소비 소스 r2: 직접30건·메모리 빌드12건·타입·독립 C0/I0/M0 및 Main 재진입1건 확인. 실제 SDK/OS 중지·회수는 미검증이며 FN07/FN08 완료 체크는 유지한다. 다음은 첫 SEND 정착 후 출력 수집 연결이다.
- 2026-11-16 첫 SEND 정착 후 출력 수집 소스 검수: 수정 후 직접63건·빌드12건·타입·독립 C0/I0/M0 및 Main 변조 반례 각1건 확인. 실제 SDK·보호 저장·OS 종료는 미검증이다. STOP과 같은 소스 통합 단위로 진행하며 완료 체크는 올리지 않는다.
- 2026-11-16 후속 SEND r2 계약23BF 직접 채택. 같은 원 Query에 입력을 한 번 제공하고 정확 부모4행·현 시도/종단 정상닫힘·기존 연속ACK를 검산하는 소스를 기존 Primary에게 맡겼다. 실제 SDK/DB/권한/키/서비스 실행은 제외하며 FN08 부분 구현 체크를 유지한다.
- 2026-11-16 후속 SEND r3 소스: 최종 직접영향61건·타입·메모리번들·독립 C0/I0/M0와 Main 반례2건 확인. 원부모/현시도/종단·연속ACK 및 종료경합을 RAM으로 검산했다. 실제 SDK/보호저장·비정상DI late삭제 재시작 봉인은 미검증이며 FN08 전체 체크는 유지한다.
- 2026-11-16 UI14정책페이지동일cursor명시재조회는38건·루트타입·독립검수확인. FN18기존수신IPC정적선언24건을해소했으나전체desktop타입145건/exit1·미완료이며필수개발의존성/생성물해석을준비한다. source checkpoint이고Stage/FN18전체PASS가아니다.

- 2026-11-16 FN18 후속: 고정 개발 의존성만 복원하고 기존 수신 client·owner·shell/policy의 실제 계약과 nullable 선언을 보완했다. 현재 desktop 타입은 생성 runtime 참조4건/exit1이다. 수신 client5·owner6·shell선택5·미지원phase2 RAM 결과는 서로 다른 영향범위의 근거이며 전체 실제 검증으로 합산하지 않는다. 생성 타입 연결을 구현 중이고 실제 앱/설치·SDK/Agent·DB·서비스는 미검증이다. FN18/Stage 완료 체크를 올리지 않는다.

- 2026-11-16 FN18 생성타입 연결 최종: desktop0·루트타입0·웹메모리빌드통과, 생성타입/번들15PASS·독립C0/I0/M0. 앞선4건FAIL 기록은 보완 전 이력이다. 배포JS 값로딩 금지와 원17export 엄격검산을 유지한다. 실제앱/설치/DB/SDK는 제외·미검증이므로 FN18전체 체크는 올리지 않는다.

- 2026-11-16 spool9E98 A안 source: profile최초발급·등록결박·writer별예약·미정산보존·원READY/단발/4ACK/cursor 연결을14제품/8시험으로구현했다. 직접64PASS와선택6PASS·타입0·독립C0/I0/M0는소스/RAM범위다. 실제C#/파일보호·DB·SDK/Agent는미검증이며FN08/전체완료체크는올리지않는다. SDK단발조회는확인/미확인분리, P03단발관측은SSH255·0행UNKNOWN_PRESERVE로보존했다.


## 2026-11-16 승인 후 FN03 구현 배정·CLI 단발 관측 종결

기존 Primary에 WI1CBC87356EE8AB9E816B1EF8113B4FC3E0D592B1ED9A27768422B21672759E36의 제품12·시험10 및 결과서1을 배정했다. 같은 승인 재질문0, UI00 발견은 이번 구현과 분리했다. CLI20670a는 12:39:06.7612572Z~12:39:08.7501796Z에 UNKNOWN/부모exit0으로 종결했고 잔여 핸들0·추가 관측0이다. 원 수거물에 자식exit/오류/도달단계가 없어 설치 부재나 원인을 단정하지 않는다. 결과서 SHA854E62DECC567602562618A56E162AA78767130653526B72B330EFB7CEE9CB46을 보존한다. 직접 승인된 서버 항목 귀속 구현은 이 UNKNOWN과 독립적으로 계속한다. 실제 DB·권한·키·서비스·Agent/SDK 실행은 여전히 제외하며 구현·실행·인수 판정을 구분한다.


## 2026-11-16 FN03 영향 fixture 경로 r2 보완

원버전 GET의 원 command/auth/audit 검산이 기존 RAM의 영수증 없는 seed에 영향을 주는 것을 수행자가 확인했다. Main은 제품·계약 의미를 바꾸지 않고 필요한5시험 fixture만 WI r2에 추가했다(SHA DCFB1BF5FF30A8196741355FBBBDE61B89662B94CF1EC6B011355D6E5FEC9B45). 누락 영수증을 구형 미기록으로 취급하거나 기대값을 낮추지 않고 실제 원 관계를 구성하도록 지시했다. 독립 사전검수는 receipt가 version INSERT 전에 존재하고 import/proposal 선택행과 DRAFT_SAVED는 뒤에 생기는 순서를 확인했으며 즉시 guard의 잘못된 선행 요구를 피하도록 전달했다. 실제DB/키/권한/서비스/Agent 실행0·같은 승인 재요청0이다.


## 2026-11-16 FN03 사전 독립검수 C0/I2·보완 지시

기존 preflight는 서버3경로의 전후 동일지문에서 legacy 조기반환의 원 request_hash→scopeDigest 공통검산 누락과 결박 원 적용본 소실의404 오분류를 잠정 I2로 확인했다. Main은 기존 Primary에 공통 원인 검산과 역사 결박의503 한정처리·각 반례 보완을 전달했다. 구현중 사전판정이며 합격/동결/실제PG 증거가 아니다. 테스트 반복seed를 피하는 RAM helper1경로만 WI r3 F85D1CBEE9BD10B775CC7BD8A794642109CF7392B67156FDF2B09F5D02513078에 추가했다. 실제DB/권한/키/서비스/Agent 실행0, 검증기준완화0, 단일writer 유지.


## 2026-11-16 FN03 직접 제품 경로 26PASS·후속 검증 중

Primary의279029 exit0에서26PASS/FAIL0/SKIP0을 확인했다. 원 save/영수증·감사/정확버전 GET과v2, 적용본교체후과거읽기·개정/제안409, A/B손상·감사/원application 소실503을 검증했다. 사전I2의 공통scopeDigest/역사503 보완을 포함한다. 앞선4인접fixture61PASS/1FAIL은 budget200 seed본문/hash와 원receipt가 서로다른 시험준비오류였고 실제원 seed를 구성해 해당파일을279029로 재검증했다. 0099 지문6155F65510C1785E75AF4AE155603DDBBD4F1631E39302236692C71EC152341C 정적 C0/I0이며 설치·실행0이다. 승인·replay·화면/타입·동결 독립검수는 아직 진행중이므로 통합/전체완료PASS로 승격하지 않는다.


## 2026-11-16 FN03/UI06 산출물 귀속 소스 인수·통합 준비

Primary는 제품12·시험/fixture15 쓰기를 반환했다. 최종직접10파일87PASS/FAIL0/SKIP0(d04116), 인접3파일43PASS/FAIL0/SKIP0(e6ac69→ecc810/91103종료), 루트타입0(52915d→1d0e5f/38164종료), 실행handle0이다. 독립읽기검수 C0/I0/M0·앞선I2해소, Main56368f에서결과서27개개별SHA/현재bytes일치와diff공백0을확인했다. 결과서 FN03_STAGE_ARTIFACT_ITEM_BINDING_SOURCE_RESULT_20261116.md SHA4D954CC6C32545ED884110444EE3E21767AE63E906F59D4B0336D931347CB922. 0099미적용·실제DB/RLS/동시거래·served브라우저/사용자인수·Agent실행은미검증/제외다. 같은양식B와본문sectionA구별·원receipt/감사·같은명령replay·다른item409·과거조회/적용교체후개정409를소스/RAM으로만인수한다. Main은정확Git/PR/Broker·병합본선택smoke·정리를진행하며전체계획/UI06전체완료체크를올리지않는다.


## 2026-11-16 PR156 통합·정리 및 다음 UI00 배정

PR156은 source e86414ec90ac02da08318ebc0ef1201b9514adcb/merge fedf6631e37c745c6e2534e0a3e3554f85bf11ff로통합됐다. Broker43875912494 success, source/main tree f1c3ed057d3bfa22333cb1744b80e931f0332767 일치. Main a1b108 병합본RAM3PASS/FAIL0/SKIP0·1028.329ms(빈초안B/409/다른item응답거절), local/remote main exact clean·원격source복구tag pr-156-head 확인 후 완료branch/request tag만정상정리했다. squash뒤branch삭제는원격추적ref에포함됨 경고와 함께정상-d로종료됐고 원격복구ref·tree일치를별도확인했다.

GitHub MCP Unknown tool/gh create must be a collaborator는권한이나credential을바꾸지않고기존로그인브라우저에서전체본문PR156을생성해해소했다. PR제출중복0·전용브라우저작업정상종료. 검수묶음74102213은PowerShell기본경로정렬·대문자SHA+공백1·LF행간/최종LF없음이고, Main/검수자/결과서의27개개별지문모두일치했다. 단발CLI UNKNOWN은재관측하지않았다.

다음기존UI00 keyboard_focus_and_labels를WI C017EF163743F5B6EEAFC97EFFCD3A2E524ABDC7330C3F9081D85838E7AC9628로기존Primary에배정했다. 최신main에서codex/av3-shell-menu-focus 사용, AppShell/test2경로의동일·다른모바일메뉴선택후본문초점복귀와초기렌더입력초점보존을구현/검증한다. 새승인요청0·단일writer, Main은검수·통합이다. 실제DB/권한/키/서비스/CLI·SDK·Agent/실자료조사와전체계획인수는여전히제외/미완료다.


## 2026-11-16 UI00 모바일 메뉴 초점 RED 재현

Primary06a1b3 exit1에서동일화면/다른화면메뉴선택후activeElement===main 2건실패, 메뉴닫힘/제목정상과초기렌더·입력편집초점유지1건통과를확인했다. 실제브라우저아닌기존ReactRAM재현이며사용자입력·서비스·DB변경0이다. 기존hashchange/본문요소를재사용한선택한정수정을같은Primary가진행한다. 관리checkpoint4eca78002467f6a74dc8abfa0ce2504ad2c46f6c 원격동기화완료, Main코드쓰기0·재승인0.


## 2026-11-16 Main GitHub 호출 정정·UI00 사전 I1 보완

Main은최초GitHub create_pull_request에잘못된link_id를전달했다. 올바른기존연결link_6ac086be8c1881919e5b9d06c9432c04의get_pr_info는PR156 merged/source e86414ec/main fedf6631을정상반환했다. 연결도구전체장애로일반화한설명은정정하며불필요한CLI/브라우저경로추가는Main실수다. 계정/credential/권한변경0·PR중복0, 다음PR은정상연결을사용한다.

UI00최초동결21PASS/type0 뒤독립C0/I1에서다른링크선택→경로전메뉴재열기→경로반영→토글닫기의낡은focus요청과대기중별도입력초점보호누락을확인했다. 같은2파일로수동토글pending취소·선택후명시초점이동보호를보완하도록Primary에게배정했다. 21PASS는이보완전근거이며최종합격으로승격하지않는다. 실제브라우저/DB/키/권한/서비스/Agent실행0이다.


## 2026-11-16 UI00 I1 해소·최종 소스 인수

Primary의5b842b RED2FAIL→동일범위보완후063543 최종직접/인접3파일24PASS/FAIL0/SKIP0·3290.4326ms, 루트타입e54837→67382d/session44116종료 exit0·공백d69d77 exit0·핸들0을확인했다. 보완중TS2367 1건은Object.is 비교후해소했고이전21/24PASS와최종실행을구분했다. 독립C0/I0/M0·I1해소, Main902c3c에서제품/시험/결과서3개정확SHA일치를확인했다. 최종제품431B00C67CBF03FD3D9AE3D771BAEF3EE925FEFFFC56BCE04CDA2813B4FC6B44/시험CF8935B987967BBD42F3CAD6A58CAEC948EA0A58D20BEC672FE3ABF04F25F79D, 결과서UI00_MOBILE_MENU_FOCUS_RESULT_20261116.md SHA6EF107D055765A84F19C217AFD5559FD2E90635DEBE10919BF4795C2AAD1DCAD. 수동메뉴재열기·셸내다른focusin은대기선택취소, 원링크/숨김뒤body는정상본문focus를허용한다. 실제브라우저Enter·기본링크/CSS/뒤로가기·DB/서비스/Agent는미검증/제외이며전체UI00완료체크는올리지않는다. Primary쓰기반환후Main이정확Git/PR/Broker·병합본영향smoke·정리를맡는다.


## 2026-11-16 PR157 병합·정리와 FN07 진단 소스 착수

정상기존GitHub연결로PR157을생성/첨부했다. source1a470851592fba5e2fce4369830eaf2ed233425e→main188b506712a1ad65658a633465b2852e50c95365, Broker43878228705 success·source/main tree3b4810cc5aa57f0d3e2d6b023b4a21125b7fd591동일. Main57078→534004 병합본RAM4PASS/FAIL0/SKIP0·1680.5027ms. 경로반영전2경합시험에서React합성key중복경고2건이있어콘솔경고0으로표시하지않고읽기원인대조를맡겼다. 실제브라우저PASS가아니다. local/remote main exact clean·pr-157-head복구tag확인후완료branch/requesttag를정상정리했다.

기존Primary의읽기대조는UNKNOWN20670a에서자식원인/종료코드복원불가를확인했다. 최신main에서codex/av3-cli-observation-diagnostics를만들고WI F8255DB0DAD268B4B73DAFF3FCE9D389AAC4D6ECD1CD402F540470682E1D5447의새script-v2/진단후보/순수시험/결과서4경로만source-only로배정했다. 원script2A7E/후보EEAA/소진기록은보존, 성공형상·조회본문·한도불변, 실패고정분류와자식종단을분리한다. 현재Observe/Start/설치파일·PATH재조회/프로세스회수/SDK·Agent/SSH/실제DB/키/권한/서비스실행0. 새관측후보는NOT_APPROVED_EXECUTION이며실행허가/시간창을만들지않는다. Main은검수·통합및필요한정확다음결정안을마련한다.


## 2026-11-16 PR157 smoke 경고 한정 원인·후속 수정 항목

기존preflight의읽기대조는global #/settings에서projectId부재로backupReferenceKey/installationResourceKey가모두빈문자열이고App.tsx의두형제패널이같은접미사/CSRF를붙여동일React key가됨을확인했다. 합성행중복이필수조건이아닌기존제품key공식의충돌이다. PR157은이key를변경하지않았고2경합시험이기존경고를노출했다. 초점단언4PASS와경고2건을구분하며실제브라우저영향은미검증이다. Main은현재FN07진단단위통합뒤이기존설정패널key충돌을기존계획범위최소수정항목으로이어간다. 새API/권한/DB/키/서비스/Agent실행및전체사용자인수는확대하지않는다.


## 2026-11-16 FN07 진단 소스 최종 검수·통합 준비

Primary27b30c AST/원조회역치환/순수RAM3PASS/FAIL0/SKIP0·1929.6495ms, 신규4경로공백5cc6ac exit0·핸들0·쓰기반환. 독립C0/I0/M0·4파일전후지문일치, Main298d8e에서신규4+원본3 SHA일치를확인했다. 결과서FN07_LOCAL_CLI_IDENTITY_DIAGNOSTIC_SOURCE_RESULT_20261116.md SHAE8250C63EF0EA18B21EE0F6760E27A9B97466ECA9A01EBD1D1507CF9D7502D9D. 시험용PowerShell은원문AST와추출한순수분류함수2개만호출했고실제관측감독/Observe/Start/PATH·설치file/SDK·CLI조회0이다.

새script0FD03A3F62C508F1E7343FBD80DC03DED0AFE30251C1D2356450E271F5B28120·후보DB9265A3EECADBAE4DC76E8A55EDB7881D6CE195401DFEF89C3509AAFA0102E9는원한도/본문/성공형상보존·고정실패와자식종단분리를명시한다. 새후보는NOT_APPROVED_EXECUTION/추가실행미승인이다. 원20670a의UNKNOWN·부모exit0/자식미확정과단발소진을유지한다. 앱TS/권한/DB·기존제품/실자료/키/서비스/Agent변경0이므로관련없는전체제품검사를반복하지않는다. Main은현재소스만PR통합하고실제추가관측은별도정확결정전실행하지않는다.


## 2026-11-16 PMO 기존 승인 범위 명확화·동일 목적 보완조회 배정

PMO turn01a1e4a7-6c0a-7fa2-8867-91c6cb444001/toolcall exec-d200d6bb-7079-459d-9540-9e42a6658851의실제전달문을확인했다. 새후보가스스로요구한추가직접승인/30분창은사용자최신승인에없는절차이므로Main의추가질문을철회한다. 동일CLI설치정보조회목적·기존한도내오류보완은기존승인으로수행하고플랫폼거절은우회하지않는다. 후보DB9265A3/소스0FD03A3F를바꾸지않고외부의최신범위명확화기록을결박한다. 원20670a/단발소진기록은수정하지않는다.

새dispatch계속기록FN07_LOCAL_CLI_DIAGNOSTIC_SCOPE_CONTINUATION_20261116_02.json에현재보완관측1을PATH/Start전에선소진했다. 기존실제미완료는SDK spawn구성용설치CLI형태/바이트근거이며관측결과를실행권위나서명/물리신원PASS로확대하지않는다. 실패/불명재발행0·미확정원Process/소유감독세션보존, 실제CLI/SDK/Agent/권한·키·DB·서비스변경0이다. Primary는설정key수정을이미반환했고Main이검수/통합한다. 기존preflight에이한정관측과별도결과서1개만배정한다.


## 2026-11-16 CLI 보완 관측 종결·Settings 소스 인수

기존승인/PMO명확화아래preflight770175 보완관측1회는14:08:37Z발행직전~14:08:52Z수거직후/부모1.8517172초 exit0으로종결됐다. 두고정행은UNKNOWN|IMAGE|IMAGE_SIZE 및SUPERVISOR=NONE|CLEANUP=NONE|CHILD=EXIT_CONFIRMED|EXIT=0|TOTAL=WITHIN이다. 첫적격claude.exe가사전크기[68,268435456] 밖임만확인했고하한/상한구분·실제값·이미지바이트/hash/서명/최종물리신원은미확인이다. 이미지본문읽기전종료·실제CLI/SDK/Agent0·잔여수거/소유핸들0·재발행0. 크기한도를늘리거나원20670a를PASS로바꾸지않는다. 목적은미완료normal SDK spawn구성의설치형태/바이트근거였으나이관측으로실행권위는충족되지않았다.

관측결과서FN07_LOCAL_CLI_DIAGNOSTIC_OBSERVATION_RESULT_20261116_02.md의최초수행자지문36011BFA…FD043에서외부보고경로문구만비의미정리했고최종SHADB16006BC8BBD7A27FC5E183177E4F5366DEB3D42DDB55B882A36403DFBEDDF5다. 관측원행/정확실행명령/시각/원scope기록SHA2C4EE2ED…D80C/고정소스지문은불변이다. Main76d6b8에서기록지문/결과최초지문을대조했다. 후보의자체새승인요구는앞선최신PMO명확화로한정대체됐으며추가승인질문은철회했다.

Settings source는RED a8f5ba key중복1FAIL→d2da8c 직접·인접16PASS/FAIL0/SKIP0·1586.0417ms, 타입771c10→b7e31e/session62252종료 exit0·공백0·독립C0/I0/M0·3파일전후지문일치다. Main76d6b8은두JSX종류접두사를역치환한App.tsx가원Git바이트와같음을추가확인했다. 같은project상태보존/교체초기화·원console.error전달·모의GET만/POST0이며실제브라우저·CSRF회전은미검증이다. 결과서D68B391FFF1DD8CE3DD64807C3600B47D2598DD1B3AB68227EBEA3120202253B/쓰기반환·핸들0, Main이PR통합한다.

다음핵심실제사용흐름은OwnedSpoolRuntime.outputSource의fixed.create 생산자다. 기존첫/후속Query·iterator/출력보관/STOP소비와고정SDK query호출형상은재사용하고, caller주입이아닌고정모듈loader/격리worker/검산형동기spawnhook·원child입출력/종료소유를묶을실제Native kernel호출선을기존Primary가읽기대조한다. CLI/모듈설치·신뢰근거미확인은실제검증제약이며이유없이기존승인source구현전체를중단하지않는다. 새권한/신뢰주체가정말필수인경우만구체차이를입증하고실제DB/키/서비스/Agent실행은확대하지않는다.


## 2026-11-17 00:05:05 KST PR159 통합·정리 및 FN07 생산자 구현 준비

PR159 sourceff3504feccf579c1b8b0cb005f0cfb2d35589791→main19e0430705f667593972524ed7c1c1c4e3cf1b66, Broker43887067527 success·source/main treed794188156d062f8d683ec619fae169d31ee9e69동일. Main1fc391→52e1b9 병합본설정RAM1PASS/FAIL0/SKIP0·1213.8774ms·중복key경고0, local/remote main exact clean·원격복구pr-159-head확인후완료branch/request/추적ref를정상정리했다. 실제브라우저/CSRF회전·설정POST·DB/권한/키/서비스/Agent는미검증/제외다.

다음기존FN07 source생산자단위를Main이선정했다. codex/av3-normal-sdk-producer는최신main에서시작했고MainWI EBA7836B91796A6DB4C0213D1114029E2623677816AB4E6D4E116244993A6EEB를배정했다. 기존Primary는먼저FN07_NORMAL_SDK_PRODUCER_IMPLEMENTATION_SPEC_20261116.md 한문서에닫힌파일맵/인터페이스/위험검수5/체크리스트를작성하며제품/시험쓰기는Main의실제경로배정전0이다. writing-plans/subagent-driven-development의파일·서명·자기검토·독립검수와연속진행을적용하되사용자지정기존담당자/WORK_STATUS ledger/docs경로를유지하고새workspace/agent/인적재승인절차를추가하지않는다. 파일명의20261116은착수검토식별자이고실제기록시각은위KST를따른다.

기술판정: 고정SDK package/원worker최초발급/목적한정자식bridge/query factory는승인된Agent연결의미완료구현을닫을단위다. 기존evidence·Codexhandshake·스풀발급목적을느슨하게하거나실제미검증을true로바꾸지않는다. 원등록주체/normal grant·slot·시도/기한·sourceRoot/env/고정package 및원handle검산으로한CLI자식만한정하며실제설치/새권한적용/DB·키·서비스·C#/SDK·Agent실행0이다. 잘못된경계는소유하지않은spawn위험이있으므로계약대조/독립C0전제품효과를추가하지않고, 기존grant밖실제효과/새신뢰주체가정말필수이면정확차이를입증한다. 설치미확인을source작업전체중단사유로만들거나새helper/mock을실제생산자완료로보고하지않는다.
## 2026-11-17 00:19:50 KST FN07 생산자 명세 검수·기존 Primary 구현 배정

Main이 명세 BC6BFC11 전체와 WI EBA7836B 및 기존 Forge source를 대조했다. 독립 검수 C0/I2: 최종 부모 exe/ASAR/header를 사전 manifest 입력으로 요구하는 순환과 Writable.write의 false를 무시한 입력이 미전송 큐에 무한 축적될 가능성이다. 두 항목은 승인된 기능의 내부 구현 보완이며 새로운 공개 계약·권한·실제 실행 승인을 요구하지 않는다. 기존 Primary가 사전 고정 빌드 준거/후행 native 부모 검산을 분리하고 입력 진입의 미전송+미확인 2MiB 예약을 보완했다. 수정 명세 SHA256 808629CECAF0362FB74FF4F4B4EB854340FAE5220A27D347560C26DDD03A0389. Main은 chunk64KiB·양방향 수송합256MiB·stderr64KiB를 별도 내부 수송 상한으로 채택했다. 기존 공동 spool256MiB·본문2MiB·원 기한·10초/64frame은 별도로 유지한다.

기존 Primary에게 명세의 닫힌 제품12/시험3 경로를 단독 배정하고 A package/최초owner→B 목적한정 native child→C 격리 Query/동기 hook→D 기존 SEND/출력/STOP 구현을 연속 수행하도록 지시했다. Main은 제품 쓰기 없이 문서·검수·Git 통합을 맡는다. 독립 preflight는 두 사전문제 해소를 읽기 확인한다. 다른 담당자의 변경을 되돌리지 않으며 실제 DB·권한·키·서비스·설치·SDK/CLI/Agent/C# 실행·추가 SDK/SSH 조회·실자료 조사는 제외한다. 새로운 source/RAM 합격이나 실제 동작 완료는 아직 선언하지 않는다. 명세 단계 오류2건, 실제 새 실행0·소유 관측핸들0이다.

승인 세 건의 결과 기록을 다시 대조했다. SDK 출력 저장 source는 기존 PR150 검수/통합 이력을 재사용하고, 공개 원문 단발 8aa1c8은 getCalls1·1.351176초·고정해시일치·요청종료/핸들0이다. WSL 보존 자원 관측76192f는 SSH255·0/14행·UNKNOWN_PRESERVE, 원인/자원상태는 미확인이고 재실행/자동삭제0이다. 이후 CLI 보완관측770175의 IMAGE_SIZE/정상종단은 별도 결과이며 앞선 WSL 또는 SDK 조회 성공으로 혼동하지 않는다. 추가 CLI크기한도 확대·SDK재조회·SSH재접속을 요청하거나 수행하지 않는다. 필요한 보고는 PMO에 전달했다.
