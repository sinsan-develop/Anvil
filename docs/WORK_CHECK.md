# Anvil 작업 점검표

갱신: 2026-11-14 / 담당: Main 어울(D2 P-B 통합·D1 실행기 source 진행)

**전체 작업계획 미완료.** 아래 체크는 준비 문서 수용 2건만 완료이며, 제품/실환경 인수는 42건이 남아 있다. 각 행은 기존 44항목 대조 결과와 PR72~74 변경분을 기준으로 한다. 코드·합성 검증과 실제 실행·사용자 인수를 구분한다.

- 현재 통합 기준선: `main` `12f4b58a7111c400bbc7a4c98f103a7ad9653831`(PR114). normal 회수 계약 직접 채택·source 검수·통합 및 local/private 동기화·merged RAM smoke 1P를 확인했다. 후속 `codex/av3-fn08-normal-stop-contract`에서 normal 중지 종단의 원 세션 권위·제어 호출선·공개 응답 형상을 구체화 중이다.
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
| [ ] | P03 | 부분 | 현재 보호 PG 복구 미완료. R3는 소스 검수이며 실제 복제/기동/전환 미실행 |
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
