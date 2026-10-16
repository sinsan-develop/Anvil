# Anvil 재설계 작업현황

## 1. 현재 상태와 기록 기준

- 기준일: **2026-10-16 / Asia/Seoul**. 기록 담당: Main 어울.
- 단계: **전체44업무 목표 유지 / Stage A 통합·smoke·정리 완료 / Stage B UI00~03·FN01~03·FN11 부분 구현**. 인증·허가 프로젝트 조회/초안 저장·공식 양식·내장 방법론/본인 공통본 복사/개정의 실제 WSL API/DB를 확인했다. 최종 프로젝트 생성·전체 방법론 편집/확정·문서 작성/확정·실제 Agent 등은 미완료다.
- 정본: [설계 r8](design/Anvil_설계서_v3_초안.md), [계획 r7](WORK_PLAN.md)(r3 직접 승인 유지·필요한 전달/복구·선행 상세화), [개발환경](DEVELOPMENT_ENVIRONMENT.md), [작성 공통 기준](design/문서작성_공통기준.md). 이전 실행안전 보완은 이력이며 추가 현행 권위 문서가 아니다.
- 최근 실제 확인: WSL exact `72cd43affe6a738a342df3a3ca0e2e79b2e5c7de`에서 본인 방법론 검토/확정·양식 준비/위조·최신 보완 거절·초안 직접 작성2단계/조건·좌표 저장/GET 재조회 actual1 PASS/486ms/skip0·정확 QA 정리. migration10개/DB 권한 불변, Windows 단위41·Web45·UI03 인접12 및 UI02 인접7 fixture PASS. 전체 actual UI DB 여정은 미검증이다. Windows relay 재접속0·초기 비밀 만료/자동 연장0·DRAFT/PROJECT 새 권한 적용0 유지.
- 코드 기준: `codex/av3-stage-b`, base private main `f976ed5e29e14b13e12729d5b1ccf98f050f2210`(PR41 merged). Stage A branch 원격 부재/로컬 삭제·통합 smoke와 소유 Node 종료/3830잔여0을 확인했다. 원래 `codex/anvil-public-ui-preview`의 HEAD `ef80f61c`와 기존 삭제/dirty·미추적 자료는 보존하며 신규 코드와 합산하지 않는다.
- 다음 업무: 연결된 UI03 공간형·단계/문서/조건 편집·방법론 검토/확정의 잔여 검수→생성 초안 연결·FN01 최종 생성. 양식의 복사/편집/내용검토/확정은 부분 연결했지만 문서 본문 작성/원본·제안·확정과 FN11 프로젝트 정책/일회 승인 집행은 미완료다. P01/P02 조사와 불변 검사는 반복하지 않는다. 실제 Agent/Oracle는 미실행이다. 인증서 신뢰는 후속 HTTPS 검수 동안만 유지하며 2026-10-23 03:29:02 KST 만료 또는 검수 종료 때 정확 CA1개를 회수한다.

신산님이 지정한 `D:\Project\Daon2\docs\WORK_STATUS.md`의 **업무별 현재 요약 + 일자별 상세 이력** 형식을 참고했다. Daon2 문서는 읽기만 했으며 내용/상태를 Anvil로 이월하지 않았다.

### 상태 표기와 갱신 규칙

- **완료 [0] / 검토·테스트 중 [1] / 개발·작업 중 [2] / 시작 안 함 []**. P업무는 코드가 아니라 각 준비 산출·검토의 실제 완료를 기준으로 한다.
- [0]은 해당 카드의 완료 조건과 검수 증거가 있을 때만 표시한다. 제출만 됐으면 검수 대기이며 완료가 아니다. 실패·미검증·차단은 사유와 함께 별도 표시한다.
- 기능 사용 가능성은 `구현 완료·핵심 동작 확인 / 구현했지만 동작 미확인 / 부분 구현 / 미구현`으로 따로 기록한다. IX08 미실행을 1단계 미구현과 혼동하지 않는다.
- 현재 합계: **[0] 3 / [1] 0 / [2] 8 / [] 33 — 총44개**. P01/P02/P03 준비 수용, UI00/UI01/UI02/UI03/FN01/FN02/FN03/FN11을 Main 어울이 순차 작업 중(동시 writer 아님). 준비 산출물·schema 존재는 제품 기능 완료가 아니다.
- 시작·주요 변경·시험·오류·중단·검수 때 아래 해당 행과 일자별 기록을 함께 갱신한다. 행에는 현재 지점·담당/시작·최근 변경·증거/검수·미확인·다음을 추가한다.
- 일자별 기록에는 날짜·업무 ID·담당·branch/HEAD·변경 파일·명령/exit·결과·오류 횟수/원인/조치·QA 정리·미검증·다음 행동을 남긴다. 지시/승인과 실측을 구분한다.
- 이 파일이 실제 진행/증거의 정본이다. 계획의 정의·의존·완료 기준은 WORK_PLAN과 업무 카드가 정본이며, 계획 등록부 상태와 불일치하면 실제 증거를 대조해 함께 정정한다. 이력은 삭제하거나 과거 실패를 PASS로 덮지 않는다.

## 2. Stage별 요약

| Stage | 결과 목표 | 현재 상태·남은 일 |
|---|---|---|
| A | 설계·실행 준비 | [0] P01~P03 수용·PR41/main f976ed5e·통합 smoke·소유 자원/branch 정리 |
| B | 프로젝트·방법론·문서·지식 원본 | [2] 인증·프로젝트 조회/초안 저장·공식 양식 저장/조회 일부 연결. 방법론/문서 작성·지식·실제 UI DB 여정 미완료 |
| C | 실제 기존 Agent 작업 제어 | [] 실제 연결·임무·승인·실행/결과 회수 미구현 |
| D | 도구 교체·설계 변경 통제 | [] 최소 손실 인계·실제 다른 도구/총괄 교체 미구현 |
| E | 사람/기기 제어·백업·설치형 | [] 기능 구현·핵심 확인 미착수 |
| F | 1단계 전체 기능 사용 준비 | [] 선행 기능 완료 후 IX07, 현재 완료 후보 아님 |
| G | Oracle 후보 정밀 검증 | [] IX08 미착수. 별도 이전/배포 승인·환경 선행 필요 |

## 3. 준비 업무 — P01~P03

상세 범위: [준비·통합 업무 카드](work_packages/INTEGRATION_WORK.md).

| 업무 | 상태 | 현재 요약·근거 | 다음 수행·검수 |
|---|---|---|---|
| P01 상세 클릭형 동작·오류 검토 | [0] | 2026-10-15 Main 어울. [2차 검토·승인](04_test_reports/AV3/P01/REVIEW-02.md). 14경로×8상태 시안 검사·핵심 브라우저 확인, 사용자 원문 ‘P01 시안·양식 승인’ | 승인 hash의 시안·양식 보존. 제품 기능 완료로 이월하지 않고 P02 진행 |
| P02 Agent 지원·기술·계약 확정 | [0] | 2026-10-16 Main 어울. [종료 검토](04_test_reports/AV3/P02/RESULT.md)·TD-01~03 직접 승인·UI15/FN18 상세·6능력×4후보. 독립 C0/I3→최소 보완·추가 FK1 정정. 실제 구현/연동 미검증 | P03 정확 버전/lock·명령/환경을 준비하고 각 FN/IX의 실제 검수로 연결 |
| P03 기준선·검증 실행 환경 | [0] | 2026-10-16 Main 어울. [실제 결과](04_test_reports/AV3/P03/RESULT.md): unit13/실제 DB1/Edge1·build/타입 PASS, scoped 독립 C0/I0/M0. 준비 환경만 수용 | Stage A 통합 검수 후 UI00/FN01. 실제 제품 기능·Agent 연동 미검증 |

## 4. 화면 업무 — UI00~UI14

상세 범위: [화면 업무 카드](work_packages/SCREEN_WORK.md). 아래는 설계 시안의 존재가 아니라 **제품 화면 업무의 현재 상태**다.

| 업무·화면 | 상태 | 현재 요약 | 다음 수행·검수 |
|---|---|---|---|
| UI00 공통 작업틀·상태 표현 | [2] | 2026-10-16 Main 어울 착수·P01/P02/P03 기준. 실제 FN01 인증/제어 연결 전 부분 구현으로 관리 | shell·라우팅·오류/입력보존·same-origin client→FN01/FN11 실제 연결 |
| UI01 프로젝트 목록 | [2] | Main 어울. 허가 목록 API·검색/보관·cursor·뒤로/오래된 자료 표시 연결, 계약2 PASS. 실제 새 UI DB 여정은 미검증 | 생성·단계/담당/완료·결정/다음 행동·실제 브라우저 검수 |
| UI02 프로젝트 생성·기준선 | [2] | Main 어울. 목적/빈소스·고정 방법론 선택/전용 직접 작성·원본 복사/개정 저장·재조회와 owner 분리. fixture7 PASS·actual API/DB 별도 확인 | 전용 검토/확정·자료/총괄·환경·원자 생성/기존 소스 |
| UI03 방법론 흐름도 | [2] | Main 어울. 공간형·노드/문서/조건 편집·공통본 개정·내용 검토/별도 확정 연결. Edge12 fixture·실제 API/DB 각 별도 PASS. 전체 UI DB 여정 미검증 | 프로젝트 전용/생성 초안 검토·확정·적용/실제 UI DB 연결 |
| UI04 프로젝트 주 작업 | [] | S04 정적 시안 | 절차·총괄/책임자 대화·자료·지시/시작/중지 연결 |
| UI05 책임자·실행 상세 | [] | S05 정적 시안 | 실제 임무/관측·원문/diff/시험/현황 조회 |
| UI06 문서·설계·계획 추적 | [] | S06 정적 시안 | 문서편집/버전·화면위치→작업/코드/시험 양방향 |
| UI07 설계 변경·영향·역사 | [] | S07 정적 시안 | 전후/영향·승인·계획개정·재개·과거근거 조회 |
| UI08 승인·중요 문제 | [] | S08 정적 시안 | 정확 범위 승인/거절/수정·원인미확인 표시 |
| UI09 새 세션·다른 도구 이전 | [] | S09 정적 시안 | 기록/안전→대상→이해대조→실제 재개 |
| UI10 헌법·지식·결정 이유 | [] | S10 정적 시안 | 원문/이유·검색·정정/제외·헌법 적용버전 조회 |
| UI11 Agent·환경·권한 | [] | S11 정적 시안 | 실제 지원/연결/시험·환경/허용범위 설정 |
| UI12 사람·클라이언트 인계 | [] | S12 정적 시안 | 요청→안전요약→수락→단독 제어 확인 |
| UI13 모바일 작업·승인 | [] | S13 정적 시안 | 실제 같은 프로젝트/요청·지시·승인·제어권 연결 |
| UI14 설정·백업·보조 조회 | [] | S14 정적 시안 | 백업/영향·한도/알림·원화면과 같은 상태 조회 |

## 5. 기능 업무 — FN01~FN18

상세 범위: [기능 업무 카드](work_packages/FUNCTION_WORK.md). 신규 설계 기준 기능 상태는 모두 미구현이다. 과거 코드/시험은 재사용 적합성 확인 전 이 표의 완료 근거가 아니다.

| 업무 | 상태 | 현재 요약 | 다음 수행·검수 |
|---|---|---|---|
| FN01 프로젝트 원본·접근·기준선 | [2] | Main 어울. 0001 적용·실제 등록/로그인/로그아웃 UI 및 재인증/비밀번호 교체 API·세션회수 확인. 신규 보호 키/초기화1 생성·실제 사용자0 | 복구/초대·프로젝트 원본/접근/기준선·UI 연결 미구현 |
| FN02 내장/사용자 방법론·그래프 | [2] | Main 어울. 내장3종/각7단계·전체 그래프/고정 양식·본인 공통 개정·내용 검토/확정 실제 API/DB 확인. 프로젝트 초안 선택 저장/재조회 확인 | 프로젝트 전용 내용 검토/확정·원자 생성/적용·전체 UI DB 여정 |
| FN03 문서 가져오기·양식·확정 | [2] | Main 어울. 공식8종/48목차/기준 원문 보존·본인 공통 양식 복사/개정 실제 API·DB 확인·UI 편집 fixture PASS. 문서 원본/제안/내용검토·확정 미구현 | 양식 내용검토/확정·문서 원본/제안/버전/확정 |
| FN04 설계 추적·계획·변경 영향 | [] | 추적/변경 논리 설계 | ID연결·3상태축·영향·승인/계획개정 |
| FN05 헌법·지식·원문·맥락 | [] | 핵심 보관/전달 계약만 있음 | 원문/이유·검색·선별/이해대조·기준 재사용 |
| FN06 첫 코딩 Agent·환경 | [] | 실제 제품/버전별 연동 미확인 | 공식 지원과 실제 세션/지시/결과·권한 확인 |
| FN07 두 번째 Agent·계정 교체 | [] | 실제 두 번째 연결 미확인 | 공통계약으로 타도구·계정교체·원본유지 |
| FN08 Windows 실행·회수·중복방지 | [] | 회수/스풀 논리 계약 | 실제 관측·ACK·재전송/중복부작용 차단 |
| FN09 총괄·단계·하위 임무 | [] | 역할/위임 설계만 있음 | 필수맥락·임무·권한부분집합·단일writer |
| FN10 자동/건별·분기·한도 | [] | 진행모드/그래프 설계 | 실제 단계전이·승인지점·슬롯/대기열 |
| FN11 권한·일회 승인·통제 | [2] | Main 어울. 명령/범위 FK·공통 자료의 실제 owner/client·중복/버전/검토/감사 원자 집행 확인. PROJECT 현재 정책·일회 실행 승인 소비는 미구현 | 프로젝트 제어/정책·동시/만료/구세대·실제 도메인 승인 집행 |
| FN12 결과·검증·이상 판정 | [] | 제출≠완료·분류 설계 | 실제 증거 대조·보완·원인미확인/미실행 |
| FN13 체크포인트·중지·재개 | [] | 상세현황/복구 계약 | 현재지점 파일·정지확인·옛권한/중복 차단 |
| FN14 최소 손실 이전 | [] | 인계 절차/손실 측정안 | 실제 새세션/타도구/총괄 인계·공백/이해대조 |
| FN15 사람·클라이언트 제어권 | [] | 단독작업/동시조회 계약 | 인수·구기기 차단·실제 권한 검수 |
| FN16 백업·반출·검증복원 | [] | 논리 보존/복원 설계 | 실제 manifest·별도복원·원문/관계/증거 무결성 |
| FN17 중요 알림·모바일 전달 | [] | 중요/일반·미지원 구분 설계 | 실제 지원/허가·사건/인증요청 연결 |
| FN18 Windows 설치형 산출물 | [] | TD-01 Electron Windows 설계 선택, 제품 구현 미착수 | 패키징/업데이트 계약 뒤 코드/산출물·같은 서버자료·안전복원 |

## 6. 연결·통합 검수 — IX01~IX08

상세 범위: [통합 업무 카드](work_packages/INTEGRATION_WORK.md). 개별 UI/FN 시험을 합산해 아래 실제 흐름을 통과한 것으로 표시하지 않는다.

| 업무 | 상태 | 현재 요약 | 다음 수행·검수 |
|---|---|---|---|
| IX01 방법론→설계→계획→지식 | [] | 시나리오만 작성, 실제 실행 없음 | 내장/복사/직접작성→저장·확정·추적·재조회 |
| IX02 화면→실제 Agent→결과 | [] | 시나리오만 작성 | 실제 coding 임무·문서작성 임무·결과 회수/검수 |
| IX03 모드·승인·보완·중지 | [] | 시나리오만 작성 | 자동/건별·승인1회·실제 정지/재개·중복0 |
| IX04 이전·회수공백·설계변경 | [] | 시나리오만 작성 | 같은도구 새세션·다른도구·총괄 교체·변경 통제 |
| IX05 PC·모바일·사람 인계 | [] | 시나리오만 작성 | 같은요청/단독제어·실제 권한/비밀 경계 |
| IX06 복원·단절·설치형 | [] | 시나리오만 작성 | 원본반출/검증복원·체크포인트·개발산출물 |
| IX07 1단계 전체 사용 확인 | [] | 제품 사용 가능한 후보 없음 | 전체 기능4상태·핵심흐름·미구현/미확인 공개 |
| IX08 Oracle 정밀 검증 | [] | 별도 이전/배포 미실행 | 승인된 exact후보/환경 뒤 정밀 시험·사용자 확인 |

## 7. 일자별 상세 이력 — 최신순

### 2026-10-16 FN02·UI03 방법론 목록 페이지 조회

- actual RED exact `4e2656e394e712228d0c5365d506a9dba7994c2a`: 기존 route가 limit를 거절해400≠200·skip0·고유 QA 정리. 읽기 전용 keyset/cursor를 구현했고 타입·신규 cursor 단위1/변조·다른 사용자/필터/기한 차단·diff check exit0이다. 실제 DB GREEN과 화면 연결은 아직 전이다. 실제 인증 key/계정·권한·migration은 변경하지 않는다.
- DB 권한 응답 전에도 가능한 미완료를 계획/정본/코드로 대조했다. INTERFACES §9의 이름·scope·상태/cursor 조회가 현재 201행 조회 후412로 미완성이므로 기존 인증된 SYSTEM/본인 공통 읽기만 페이지화한다. 새 도메인/권한·SQL·지속 자료/Agent 변경0이며 DRAFT/PROJECT 승인은 여전히 대기다.
- 계약 상세화: 기본50/최대200·고정 정렬 keyset, cursor는 현재 사용자·정확 이름/scope/status/limit·30분 기한에 결박한다. 페이지마다 현재 인증/소유를 다시 검사하고 전체 목록을 동일시각 snapshot이라 주장하지 않는다. 검색/필터는 LIMIT 전에 검사한다. 화면/생성 선택에서 다음 페이지를 명시 조회하고 요청 실패는 빈 성공으로 숨기지 않는다.
- 실제 QA는 기존 versions.test의 qa-methods-UUID 사용자2/소유 방법론2/정리 계약 그대로이며, 내장3종을 limit2로 나눠 읽어 더 많은 fixture를 만들지 않는다. 새 SQL/자원 생성 없이 limit 미연결 RED부터 확인한다.

### 2026-10-16 UI02 프로젝트 전용 방법론 직접 작성·복사

- checkpoint actual: WSL Git exact `72cd43affe6a738a342df3a3ca0e2e79b2e5c7de`/tracked clean, 기존 개발 DB/SQL 그대로 방법론 검토·전용 초안2 단계/조건·좌표 GET 재조회와 임의 실행 속성422를 확인, actual1 PASS/486ms/skip0·고유 QA finally 정리했다. 새 migration 적용/DB 권한/실제 프로젝트 생성0이다. 화면 UI02 인접7 PASS/6초·unit41 PASS/skip0·타입/build/diff check exit0. 전체 actual UI↔DB 여정과 제품 인수는 미검증이며 기능별 partial 상태를 유지한다.
- 남은 승인 경계: 전용 초안의 내용을 검토·확정하고 최종 프로젝트를 원자 생성하려면 DRAFT/PROJECT scope의 실제 허가/감사·초기 소유·제어 결박이 필요하다. 기존 USER_COMMON 승인을 넓혀 적용하지 않았으며 앞선 정확 승인 질문의 응답 대기다. 다음 재개는 이 경계의 승인 여부부터 확인하고, 승인 시 새 forward migration/정확 도메인·음성 검증을 거친다. 사용자 답변 없이 새 권한/실제 프로젝트/Agent·Secret·서비스를 생성하지 않는다. 전체44업무 목표는 active이며 완료/paused/blocked로 임의 전환하지 않았다.
- 복사 버튼 미연결 RED→선택 원본 exact GET/분리 복사/출처 버전 보존 GREEN. 직접 작성과 합성 Edge2 PASS/3.5초, 늦은 GET 동안 부모 중간 저장 비활성·원본 목적 불변·수정은 전용 초안에만 보존을 확인했다. 화면 이탈 후 도착 응답은 active 여부로 버리고 현재 선택/입력 교체는 확인 후에만 한다. 타입/Web45모듈 exit0(JS330.19kB/gzip95.49), 실제 DB 권한 변경0.
- actual 추가 범위는 같은 고유 qa-method-review-UUID/소유 초안2의 기존 정리 계약이며 새 자원/DB권한/프로젝트 생성0이다. 직접 작성 두 단계·음수/양수 좌표·USER_DECISION 조건을 GET 재조회하고 임의 실행 속성을 거절하는 사례만 추가한다. 다른 정상/불변 검사를 새로 반복하지 않는다.
- Main 어울은 목표의 이전 turn을 진전으로 분류했다. 공통 검토/확정·선택 저장의 코드/actual 증거가 추가됐으며 현재 e47be6db/local-private 동일·tracked clean에서 이어간다. DRAFT/PROJECT DB 권한 보완은 사용자 응답 전이라 적용하지 않는다. 승인과 무관한 기존 input_json의 프로젝트 전용 초안 편집을 먼저 완성한다.
- 직접 작성 버튼 미연결 RED→기존 UI03 공간형/단계·문서·조건 부품을 새 DraftMethodEditor에서 재사용 GREEN1/2.8초. 두 사람 단계·연결·종료점·위치 x260이 명시 중간 저장/새로고침에 보존되고, 부품 버튼 편집 중 저장 요청0을 확인했다. 페이지 form 밖에 편집기를 둬 기본 button submit으로 무단 저장되지 않게 했다. 타입/Web45 build exit0(JS329.30kB/gzip95.22), actual 신규 그래프 DB 여정은 추가 확인 전이다.
- 다음은 기존 승인된 source GET을 읽어 프로젝트 전용으로 복사/수정한다. 원본/공통본·서버 저장본을 덮어쓰지 않고 sourceRef exact 버전을 남긴다. 늦은 GET 동안 저장을 잠그고 사라진 화면의 응답을 입력에 덮어쓰지 않는 합성 시험을 먼저 작성했다. 실제 DB·권한·Secret·Agent/서비스 변경0, QA는 기존 D:\tmp\anvil-v3-stage-b/browser만 사용한다.

### 2026-10-16 UI02·FN01 프로젝트 초안 방법론 선택 연결 착수

- 현재 checkpoint: 본인 공통 방법론·양식의 쓰기/검토/확정 계약 보완은 승인 범위에서 연결했다. 프로젝트 초안 선택 저장도 새 SQL 없이 연결했지만 최종 프로젝트 생성은 여전히 차단한다. 다음 필수 DB 경계는 DRAFT의 검토/확정·PROJECT 최초 원자 생성/소유/제어·명령/감사 결박이다. 이는 최신 USER_COMMON 직접 승인과 다른 범위이므로 관련 새 migration·DB 권한/지속 프로젝트 생성은 아직0이며 정확 별도 승인을 요청한다. 실제 사용자/Secret·서버/운영·Agent 변경을 묶지 않는다. 목표 전체44업무는 미완료이며 완료보고/goal 완료 처리/예약 생성은 하지 않는다.
- actual GREEN: exact `29d70cf0795d8593b8f6e7951e43bf7eab4e2424` WSL1 PASS/455ms/skip0. 공통 확정본의 exact ref와 프로젝트 전용 graph/sourceRef/좌표를 초안2개에 저장·재조회, hash 변조409·프로젝트 생성0·finally 정확 QA 정리를 확인했다. 새 SQL 적용0. 과거 실패 QA의 별도 정확 정리도 위 기록과 대조했다.
- 화면: 다음 단계 미연결 RED→선택한 내 확정 방법론을 초안2단계 저장/새로고침 재조회 GREEN1/2.1초. 인접 UI02 합성5 PASS/4.6초·단위41 PASS/skip0·타입/Web44모듈 build/diff check exit0(JS323.45kB/gzip95.17/CSS7.09kB). 기본본/내 확정본만 선택 목록에 표시하고 저장한 ref를 목록 실패나 최신 개정으로 자동 교체하지 않는다. 기존 소스/자료 가져오기·전용 그래프 편집·최종 생성은 아직 미완료다.
- 보안 보완: 합성 다른 사용자 재로그인 뒤 이전 미저장 목적이 실제 DOM에 남는 RED를 확인했다. DraftEditorState에 owner를 결박하고 다른 owner의 입력/명령 표시·전송을 차단, 서버 자료는 지우지 않고 탭 버퍼만 사용자 선택으로 닫게 했다. 재로그인 확인 후 검증하는 동일 시험 GREEN, 동일 사용자 만료 뒤 입력 보존도 인접 PASS다. 실제 계정/권한·데이터 노출 사례를 만들지 않았고 기본 source/method/form 동작은 유지했다.
- actual RED exact `ece504dfc2c3db8c2627e81de22f0bac479ec45b`: 선택 미연결412≠201·skip0·고유 QA 정리. 앞선48e3 시험은 정리 코드가 authorization_receipts의 존재하지 않는 draft_id를 사용해42703으로 본래 실패를 가렸다. schema의 scope_kind/scope_id로 보정했고, 읽기 확인한 고유 QA `8ac11367-573b-4afd-b282-ca2df776a677` 한 명/소유 방법론·양식을 별도 정확 정리·사용자 잔여0 확인했다. 실제 사용자/공유 서비스 영향0. 정리 실패를 제품 실패/합격으로 바꾸지 않았다.
- 직전 exact `28783de90e220eb993dc6a94f9b6b1792c9b22ff` WSL 방법론 추가 음성1 PASS/444ms/skip0: 위조·이전 버전·최신 REWORK·FORM 검토를 METHODOLOGY에 잘못 사용하는 시도를 거절하고 고유 QA 정리했다. 기존 SQL 재적용0.
- 다음은 승인된 계획 UI02/FN01/02의 기존 input_json 저장에 방법론 선택을 연결한다. CONFIRMED_REFERENCE는 허가된 exact versionRef, NEW_PROJECT_DRAFT는 name/purpose/graph/sourceRefs/reviewRefs의 미완성 프로젝트 전용 초안이다. 자기 공통 확정 또는 승인된 기본본을 읽으며 타인/PROJECT 원본·잘못된 hash/위조 검토는 거절한다. 여기서 프로젝트 전용 확정·최종 생성·Agent 실행 권한을 만들지 않는다. 새 SQL/DB 권한 변경은 이번 연결에 필요하지 않다.
- QA 사전등록: 기존 qa-method-review-UUID의 소유 초안2개/명령·감사만 추가하고 정확 owner/ID를 finally 정리한다. 실제 계정·Secret·서비스/port 변경0. 현재 미연결412 RED를 먼저 확인한다. 이 단계의 형식은 기존 §15.1 안의 VersionRef 명칭을 versionRef로 고정하는 상세화다.

### 2026-10-16 본인 공통 방법론 검토·확정 연결 착수

- fresh 화면/인접 검수: 단위41 PASS/skip0, UI03 Edge12 fixture PASS/9.1초, 타입·diff check exit0. 문서 갱신 중 WORK_STATUS 전체 읽기가 도구 출력 한도를 넘겨 patch가 검증 단계에서 거절1·원본 손실0, 해당 행만 좁혀 보정했다. 임의 경로 조회의 파일 없음은 source/시험 실패가 아니며 실제 파일 목록으로 범위를 확인했다.
- actual GREEN: WSL exact `4799e2f058035358baa01b36d45c21616366a95f`/tracked clean에서 새 migration10번째 `0011_user_common_method_reviews` checksum `9e480e3bd4da152befdbb2bca8a2f5e1b3cdf0ed43336c5b210090f7ff02fea2` 적용·기존9개 checksum 불변. 방법론 확정/사용자 양식 미확정 차단·양식 확정 후 허용/새 개정 분리·프로젝트 실행 권한0과 영향받는 양식 검토 실제2 PASS/595ms/skip0·정확 고유 QA 정리. 현재 DB/지속 자원 보존, Windows relay 재접속/실제 계정/Secret 변경0이다.
- 화면 TDD: 미존재 방법론 검토 시작 버튼 RED→본인 공통 exact version의 기준5개/사람 직접 판정·이유/검토 기록·별도 확정 연결 GREEN. 새 합성 Edge1 PASS/2초, 첫 기록 응답 단절 후 같은 명령 확인·작성자와 동일 주체 공개·확정이 실행 승인이 아님을 확인했다. 타입/Web43모듈 build exit0(JS318.68kB/gzip94.22). actual UI DB 전체 여정은 여전히 미검증이며 화면 fixture와 실제 API/DB를 합산하지 않는다.
- exact `976f8f0b3708d792b7f3dd1deb1e1f29fcebf991` WSL actual RED1/skip0: confirmMethodology가 미구현400을 반환해 기대422와 달랐다. QA finally 정리 후 새 forward `0011_user_common_method_reviews`를 추가하고 현재 사용자/client/명령·버전/hash와 감사에 검토/확정을 결박했다. 기존9개 SQL은 수정하지 않았다. 로컬 타입·단위41·diff check exit0이며 새 SQL 적용/actual GREEN은 아직 전이다. 편집 patch 중복 대상 문법 오류1은 쓰기 전 거절되어 정상 update로 보정했고 소스 변경 손실0이다.
- 직전 공간형 exact `7b22c5d935025d9d065e77db3a6ff256a73d8061` WSL actual1 PASS/405ms/skip0: 본인 복사·개정/타인·내장·멱등 차단에 더해 직접 작성2단계·양수/음수 좌표·고정 문서 ref·all/not 조건 전체 JSON roundtrip·구조검사/실행 미연결을 확인하고 정확 QA 정리했다. 현재 source/local-private 동일·tracked clean, 별도 실제 UI DB 여정은 미검증이다.
- 다음은 기존 직접 승인한 USER_COMMON 범위에서 METHODOLOGY 내용검토/확정만 연결한다. 기존 양식 검토·원문·9개 적용 SQL은 보존하고 새 forward migration으로 기존 methodology_reviews에 현재 client/명령 결박을 더한다. SYSTEM/PROJECT 원본과 적용본은 변경/확정하지 않고 사용자 공통 exact ref만 다룬다. 사람 판단/구조 검사/양식 준비와 실제 프로젝트·도구 권한은 별개다.
- 양식 준비 판정: P01 REVIEW-02에서 신산님이 승인한 공식8종의 고정 배포 원본은 원 출처/지문을 대조해 ‘승인된 기본 양식’으로 소비한다. USER_COMMON 양식은 별도 실제 확정 사건/최신 내용 판단이 필요하다. 공식 원본을 사용자 확정 사건이나 제품 인수로 위조하지 않으며 검증 근거 종류를 다르게 기록한다. 이는 기본 방법론을 그대로 쓰는 기존 요구를 만족하는 기술 상세화이며 실행 권한을 늘리지 않는다.
- QA 사전 등록: 기존 지정 WSL 개발 DB/exact Git SHA에서 고유 `qa-method-review-UUID` 사용자1·본인 방법론1/버전2·본인 양식1/검토/확정·명령/감사를 만들고 정확 owner/ID 순서로 finally 정리한다. 실제 사용자/계정·Secret·다른 프로젝트/환경·Agent/port/컨테이너 변경0. 원래 미구현 confirmMethodology RED부터 확인한다.

### 2026-10-16 UI03 공간형 방법론 편집 착수

- fresh 검수: 타입/단위41/diff check exit0·Web42모듈 build(JS311.03kB/gzip92.52/CSS7.09kB)·인접 Edge11 fixture PASS/10.4초. 빈 직접 작성2단계의 오른쪽20/방향키 아래20 이동이 저장 payload/재조회에 보존되고 합성 SVG 캡처에서 읽을 수 있는 두 단계/화살표를 확인했다. all+not/유한 재작업2회/AF08 버전1 입력 ref 편집도 fixture PASS/3초. 같은 양식 목록을 쓰는 기존 조회의 버전 GET fixture 누락1은 catch-all에서503으로 차단됐고, 해당 예상 GET만 명시 보완했다. 예상 밖 호출 허용/타임아웃 완화/actual DB 우회0.
- 다음 actual은 기존 전용 WSL DB에서 같은 고유 qa-common 사용자2/방법론 정의의 기존 정리 절차로 직접 작성2단계·음수/양수 좌표·고정 문서 ref·all/not 조건 전체 roundtrip을 추가 확인한다. 새로운 DB/port/Secret/Agent 호출은 만들지 않는다. 실제 새 UI DB E2E·방법론 내용검토/확정·프로젝트 적용·실제 한도 정책 바인딩은 여전히 미검증/미완료다.
- 브라우저 RED: 단계 유형 입력 없음→구현 후 빈 방법론2단계·사람 역할/순서·USER_DECISION 비교·종료점·좌표 이동이 payload와 재조회에 보존되는 fixture1 PASS/2.6초. Web42모듈 build/typecheck exit0, 아직 실제 신규 그래프 DB roundtrip과 복합 조건/문서 ref의 추가 화면 검수는 전이다.
- 구현은 source SVG 원본/본인 편집을 구별하고 선택/확대·방향키20 이동, 노드 이름/목적/역할/범위/진행/기록·입출력 고정 양식, 시작/종료/연결 및 제한 데이터형의 all/any/not·판단 비교, 합류 규칙·유한 재작업을 제공한다. 이전 조건 계약은 자동 변환하지 않으며 미리보기 깊이/범위 제한이 저장 정의를 바꾸지 않는다. 입력 변경 시 이전 검사 결과를 지우고 저장한 exact graph의 서버 문제 위치를 표시한다. 실제 호출·정책 권한 부여0.
- checkpoint `51c74aa17e3b028dd6a33bbe0eabc9d47075a356`/local-private 동일·tracked clean·main f976ed5e 불변에서 승인된 P01 S03/계획 UI03·FN02의 남은 공간형/전체 단계 편집을 이어간다. 기존 copy/save API·허가된 양식 GET만 사용하며 새 DB/권한/API/Agent 실행 변경0. 원본/구버전과 사용자 dirty는 유지한다.
- 구현 순서: 코드형 SVG 배치/선택·확대/키보드 위치 이동→단계 역할/범위·문서 양식 ref·순서/분기/합류/재작업 조건 편집→초안 저장 후 서버 구조 오류 위치 확인. 조건은 fieldRef/operator/value와 all/any/not의 제한 자료이며 eval/스크립트/임의 URL/actual Agent binding을 넣지 않는다. 좌표 미리보기 제한은 원래 저장 좌표를 수정하지 않으며 아직 없는 실제 실행 검증을 통과로 보고하지 않는다. 새 빈 방법론2단계/판단 연결·위치의 브라우저 RED부터 확인한다.

### 2026-10-16 본인 공통 자료의 내용검토·확정 착수

- 후속 음성 actual: exact `34805ebedd2781eb23119d6d79648b1ecc585e8f` WSL1 PASS/324ms/skip0. 종합 ACCEPTED/항목 REWORK 불일치422·미연결 임의 ArtifactRef412·최신 REWORK가 있으면 이전 ACCEPTED로 확정422·보완 후 새 검토에서만 확정·새 버전 미이월 확인. 기존 SQL 재적용0·고유 QA 정리.
- 가독성 보정: 합성 최종 화면에서 판정/이유가 한 줄에 몰림을 실제 캡처로 확인하고 위치관계 RED(이유 y168.9 < 판정 하단219.5)→새 편집 영역3곳에만 grid/폭/label 배치 CSS 적용 GREEN·같은 기능/위치 기준1 PASS/2.6초. 보정 후 캡처에서 판정 아래 충분한 이유 입력 폭과 별도 확정 상태를 확인했다. 사용자 프로필/실제 자료가 아닌 기존 전용 tmp의 합성 QA이며 Stage B 종료 때 소유 자원으로 정리한다. Web37 build/typecheck exit0·JS289.37kB/gzip86.20/CSS6.32kB, 실제 소유 서버 backend는 교체하지 않았다.
- actual GREEN: WSL Git exact `7b81c6e140308103b3f4a2c192801d9b113bd653`/tracked clean에서 `0011_user_common_content_reviews` checksum `0009cfe2c02b92a4e930d538ce5c0c5d67215c6d89aca6c1a4345868ccbc4f01` 적용·이전8개 불변. 실제 검토/확정1 PASS/592ms 및 영향받는 양식 저장1 PASS/632ms(총2/skip0). 기준 누락·주체 위조·가짜 ReviewRef 거절, 같은 본문 검토 뒤 별도 확정, 새 v2에 확정 미이월, v1 이력 보존·app 검토 UPDATE42501·정확 QA 정리 확인. 이는 합성 사용자 시험이며 신산님의 제품 인수/실제 Agent 실행은 아니다.
- UI 검토/확정 연결: 버전/hash·서버 기준·미검토 기본값, 사람이 각 판정/이유를 직접 입력→검토 기록→별도 확정을 연결했다. 탭의 검토 입력/미확인 명령/owner를 보존하고 다른 사용자에게 숨긴다. 미존재 버튼 RED·select label 본문 혼입1·동일 주체 표시의 의미 단위 구분1을 보정, 같은 기대/시간 제한의 직접 검토/확정 fixture1 PASS/1.9초·Web37모듈 build/typecheck exit0. 전 과정 actual UI/DB E2E는 미검증이며 backend000d0088/relay hold/초기 비밀 만료를 그대로 보존한다. 다음은 최신 REWORK/증거 위조 음성과 인접 회귀 후 방법론 전체 편집/확정·생성 초안 연결이다.
- fresh UI/인접 검수: unit41/typecheck/diff check exit0·UI03 Edge fixture9 PASS/6.1초. 조회 DTO는 서버의 정확 ReviewRef/확정자·시각/버전을 확인하며 `CONFIRMED` 문자열만 있고 확정 사건이 없으면 거절한다. 기존 SYSTEM 필수형식은 유지하고 작성 중 USER_COMMON의 빈 초안 허용과 확정 조건을 분리한다. 현재 브라우저 build37/JS289.32kB/gzip86.18, 실제 새 UI DB 전체 여정과 실제 소유자 등록/인수는 미검증이다.
- actual RED: exact `03006a4be89cfcdbaa7d8abd0be97bb7f4501938`/WSL의 미구현 confirmForm400≠422로 실패·합성 사용자/양식 정리. 새로운 content_reviews/form_reviews를 준비하고 검토 기준5개·서버의 owner/현재 version/hash·검토 종류/기준·위조 ref를 대조한다. 내용 검토 및 확정은 공통 receipt/append-only 감사와 같은 transaction이며 기존 migration 변경0. 서버 최신 판단 순서는 클라이언트 시각이나 UUID 대신 실제 audit server_sequence를 쓴다.
- 기존 승인 범위의 다음 단계는 USER_COMMON 양식 exact version/hash의 사람 직접 검토 기록과 별도 확정이다. 보완 계약은 내용 판단과 형식 검사·프로젝트/Agent 실행 승인을 분리한다. 사람이 직접 읽고 기준별 이유를 기록하며 자료/시험 파일 저장 미연결 동안 evidenceRefs는 빈 배열만 허용하고 임의 증거 ID를 신뢰하지 않는다. 작성/검토 주체·원본과 같은 사용자 여부를 이력에 공개하며, Agent가 HUMAN_REVIEW source/주체를 payload로 선언하는 필드는 거절한다. 실제 Agent 자격/실행 호출은 아직 연결하지 않는다.
- 고정 검토 기준 버전1은 양식의 목적/역할/항목·반복 구조/작성 규칙/내용 검토 규칙 5항목이다. 누락/중복/구버전·위조 ref로 확정하지 않고 새 양식 버전은 다시 검토해야 한다. `content_reviews`와 `form_reviews`는 불변 기록으로 새 forward migration에 둔다. SYSTEM/다른 사용자 양식·기존 SQL/계정·Secret 변경0. 공통 검토 범위는 직접 승인된 owner=actor와 현재 session/client/명령/감사에만 결박한다.
- 실제 QA 사전 등록: 기존 지정 WSL 개발 DB/exact 게시 SHA, 고유 `qa-form-review-UUID` 합성 사용자1/공통 양식1·버전2·검토/확정/명령/감사를 생성하고 정확 owner/ID의 FK 순서로 finally 정리한다. 기존 원본/실제 사용자·서비스·컨테이너·port 변경0, Windows relay 재접속0. 아직 구현/적용/시험 결과는 아니다.

### 2026-10-16 FN03 본인 공통 양식 쓰기 착수

- 부분 초안 actual: exact `14cb5181ece54a108c8ac53e4ffb61e7e398efd5` WSL의 같은 시험1 PASS/453ms/skip0. 목적/목차가 빈 별도 본인 초안을 실제 저장·재조회했고 validForConfirmation=false, 원래 복사/개정2건과 새 초안1건 외 부작용 없음·생성 QA 사용자/양식 정확 정리. 이미 적용된 migration은 재실행하지 않았다.
- actual GREEN: exact `eb3b79ab211b05d31bedf41c8b256790643e28f6`/WSL tracked clean, 신규 `0011_user_common_forms` checksum `b1bb3b65bd7f9616bb6f79e456c27c042da4a2dfdfc8f3a6167e4cd06480044a` 적용 exit0·기존7개 불변. 양식 복사/개정·정확 공통 기준·구버전/공식 원본 보존·멱등/구버전409·타인404·SYSTEM403/SQL42501·변조 기준422의 실제 시험1 PASS/445ms, 영향받는 방법론 실제1 PASS/483ms(총2/skip0). 각 합성 사용자·정의 정리 확인, 실제 사용자 생성0.
- UI03 양식 복사/편집 연결: 복사 버튼 없음 RED→공통본 작성/역할·항목·반복 필드·작성/검토 기준 편집·새 버전/정확 재조회1 fixture GREEN/2.6초, 타입/Web36모듈 PASS. pending/owner 경계는 방법론과 같은 원칙으로 탭 메모리에 보존하고 receipt 적용 후 GET 실패에서는 새 명령을 만들지 않는다. 미완성 USER_COMMON 초안이 클라이언트의 SYSTEM 전용 필수내용 검사에 막히는 RED→USER_COMMON 초안 읽기만 분리 GREEN; SYSTEM 검사/실제 확정 기준 완화0. 내용 검토/사용자 확정·문서 본문 작성은 여전히 미완료다.
- 현재 fresh 검수: unit41/typecheck/diff check exit0·UI03 인접 Edge fixture8 PASS/6.5초, Web36모듈 build exit0(JS280.78kB/gzip84.27). 실제 API·DB2 PASS와 fixture8을 새 UI/DB E2E로 합산하지 않는다. 후속 부분 초안 실제 보존을 같은 지정 DB에서 확인한 뒤 본인 공통 내용검토/확정으로 이어간다.
- 실제 RED: exact `13fac4f4cebcd5c9d19a56d3872a12ae5a841f18` WSL에서 copyForm 미등록400≠200, 사용자2/양식0 finally 정리·잔여0. 확정/검토·실제 문서 작성은 아직 구현0.
- Ruling: 방법론/양식에 동일한 USER_COMMON receipt·scope digest·감사를 중복 구현하지 않고 기존 약20행을 access/common-command.ts의 내부 저장 함수로 옮겼다. 공개 범용 dispatch나 권한 엔진은 만들지 않고 기존 인증/client/멱등 검사와 transaction을 재사용하며 명시4연산만 허용한다. 변경으로 영향받는 기존 방법론 실제 시험도 함께 확인한다. 양식 정의/기준·기존 버전과 형식 검사를 성공·사람 확정으로 혼동하지 않는다.
- Stage B Main 어울, 안전 checkpoint `bf6b0f4611ff25a01ddf36ee9efa3370e2674954`/local-private 동일·tracked clean·main f976ed5e 불변. 공식 양식 복사/개정도 앞선 본인 공통 자료 직접 승인 범위이며 다른 사용자/공식 원본 쓰기는 열지 않는다. 새로운 `0011_user_common_forms` forward migration만 준비하고 이미 적용된 SQL/버전은 보존한다.
- 사전 등록: 기존 WSL checkout/exact 게시 SHA·전용 개발 DB/보호 app·migrator 참조만 사용. 고유 `qa-common-form-UUID` 합성 사용자2/본인 양식1·명령/감사2를 생성하고 finally 정확 owner/ID로 정리한다. 기존 공식8종/사용자/Secret/계정·컨테이너·port 변경0. Windows relay 접속0. 사용자 양식 검사 모듈 미존재 RED 후 제한 데이터/고유 항목·필드·반복 구조·확정 가능성 검사1 GREEN. 전체 기능 완료는 아니다.

### 2026-10-16 조건 계약 정정·공통 자료 보완 승인

- 공통 쓰기 actual: exact `0f072bb93f1a454432f8e97e3ca7a574eca1320b` WSL 시험1 PASS/388ms/skip0. copy/save·원본/과거 버전 불변·좌표345·같은 command 병렬2회 결과 동일/부작용 총2건·본문/연산 충돌409·타인404·내장403/SQL42501·CSRF/Origin403·회수401·감사 변경42501 확인. 새 migration checksum `ea3043a71f4d1557bf9620ac06f88274ed7227629fe2b1bfab00e7409d16563c`, 기존6개 불변·새 실제 사용자0.
- 첫 actual은 QA 정리23503으로 실패했다. `ON DELETE RESTRICT`는 DEFERRABLE 표기만으로 receipt 순환 삭제를 미루지 않는 것을 확인했고, admin의 정확 QA 정리에서 commands.authorization_receipt_id를 null로 끊은 뒤 receipt→command 순으로 제거했다. 첫 실패 QA2의 사용자/명령/정의/감사 각각0 독립 조회, 동일 시험 재실행 GREEN·새 QA finally 정리. 제품 FK/불변 계약 완화0, 처음 실패를 PASS 소급0.
- UI03 복사/편집/저장 착수: API는 same-origin/CSRF·명령/사용자/버전 receipt를 대조하고 저장 뒤 exact GET까지 확인한다. pending 요청/입력은 App 메모리에 보존·단절 시 같은 command만 재확인, 다른 로그인 사용자에게 앞선 편집 노출/전송 차단. 복사 버튼 없음 RED→구현 뒤 textarea label의 초기 본문 혼입으로 exact label 조회 실패1→명시적 htmlFor/id 보정·같은 기대/timeout으로 복사·편집1 GREEN/2초. 서버 API/DB actual과 브라우저 fixture는 합쳐 실제 새 UI DB E2E로 주장하지 않는다. 전체 문서 연결/분기·합류 편집·확정·Agent 실행은 미완료다.
- 인접 검수: UI03 fixture4 PASS/3.4초(읽기·권한 회수·복사/개정·단절 동일 명령). 추가 ‘저장 성공→GET403’ 음성 RED→적용 성공과 재조회 실패를 분리해 pending 유지 GREEN/1.6초. null receipt TypeError RED→형식 거절로 보정, 현재 unit39/typecheck/diff check PASS. 저장 실패를 성공으로 올리지 않으며 현재 소유 서버 backend는000d0088으로 새 코드 미반영·Web dist만 신규다. 실제 새 UI DB 여정/소유자 등록은 미검증, 기존 초기 등록 비밀 만료를 연장하거나 relay 재접속하지 않았다.
- 현재 checkpoint 검증: 최종 Web34모듈 build/typecheck exit0·JS272.48kB/gzip82.99/CSS5.44kB, UI03 인접7 fixture PASS/4.6초. 전체 Stage/실제 사용자 인수는 미완료이며 후속 내용검토/확정과 생성 초안 연결을 계속한다. 원본 root의5개 소유 문서는4dd4b56d 바이트와 일치하는지 확인한 뒤만 기계적 동기화하고 legacy dirty/Backup/다른 문서는 보존한다.
- 후속 실제 확인: Git exact `02d579be26b09d6b6825c981e8c27f59547d3702` WSL/clean에서 forward 정정 적용 exit0·FN02 실제 시험1 PASS/558ms/skip0. SYSTEM3의 v1 literal hash/본문 유지·v2 head/정식 조건·본인200/타인404/회수401·app UPDATE42501 확인. 원본 실패/조건 미적합 판정을 소급하지 않는다. 새 UI fixture2 PASS/2.7초는 실제 UI DB 여정이 아니다.
- 본인 공통 쓰기 착수: 현재 사용자/client/CSRF·USER_COMMON owner=actor·command 재전송/충돌·정확 head·도메인 변경/receipt/append-only 감사의 단일 transaction을 기존0011 뒤 forward migration으로 추가한다. PROJECT/DRAFT 계약과 적용 SQL은 그대로 보존한다. 먼저 copyMethodology/saveMethodologyDraft를 연결하며 확정/내용검토·양식 쓰기는 후속 범위다. QA는 기존 지정 WSL 개발 DB에서 고유 `qa-common-UUID` 사용자2·방법론/명령/감사만 생성하고 정확 ID로 정리, 실제 사용자/Secret/다른 프로젝트/운영 변경0. 기존 Windows relay 재접속 금지 유지.
- RED 증거: 게시 exact `6a8817d9d6b3293162bf1c0e30d6f2d2fb3e2196`/WSL clean의 공통 쓰기 실제 HTTP/DB 시험은 첫 명령404≠200으로 실패했다(미구현 경로). 합성 사용자2/관련 자격은 finally 정리·잔여 사용자/정의0. Windows 무인증 명령404≠401도 RED 확인 후 새 경로에서 GREEN. 최초 타입검사의 테스트 payload unknown 오류는 JSON 직렬화로 보정. sandbox 전체 단위는 지정 tmp mkdtemp EPERM1(권한 변경0), 승인된 실행 환경에서 같은 시험을 재검증하며 제품/DB 실패로 계산하지 않는다.
- 신산님 직접 응답 `call_07a966ef8b6d4eefac5fa279876ff3c0`: **‘본인 공통 자료용 계약·개발 DB 보완 승인’**. 대상은 현재 v3 개발 DB의 본인 USER_COMMON 명령/허가/검토·감사 범위와 현재 사용자/client·정확 버전·중복 방지의 forward migration이다. 다른 사용자/프로젝트 제어권·실제 계정·Secret·운영 DB 변경은 불포함. 이전 ‘승인 요청 중’ 기록은 당시 상태이며 지금은 해당 범위 승인됨. 공통 자료 쓰기 자체는 아직 구현/적용0.
- 중요 오류: 추가 대조에서 앞선 FN02 조건 자료 `kind:REVIEW_DECISION/USER_CHOICE`가 같은 INTERFACES §15.3의 `fieldRef/operator/value`·all/any/not 계약과 다른 것을 확인했다. 앞 절의 잠정 설명보다 후속 상세 계약을 우선해야 했는데 놓쳤다. 실제 Agent 실행·프로젝트 적용·사람 확정 사건0이므로 외부 실행/운영 영향0, 그러나 v1 구조 검증을 계약 적합/인수 증거로 승격할 수 없다. 기존 v1/과거 시험 결과는 지우거나 PASS로 소급하지 않는다.
- 회귀2 RED(버전1≠2·정식 조건의 잘못된 거절)→계약형 조건·EQ/NE/IN/IS_PRESENT·all/any/not·한정된 typed 결과/사용자 판단 필드로 정정 GREEN. 현재 단위37 PASS/typecheck/diff check exit0. 제한 자료이며 실행 평가기/실제 승인/새 권한은 아니다. 형식 충족을 실제 결과 존재·실행 준비로 해석하지 않는다.
- 정정 사전 등록: `0002_builtin_condition_contract`는 이미 적용된0002 SQL을 변경하지 않고 기존 SYSTEM3개의 정확 v1 hash·head를 확인하고 v2 head/본문만 같은 transaction에 추가한다. v1 본문/검토/적용본 수정0·삭제0, 새 사용자/Secret/프로젝트/테이블0. 기존 v1 확정/적용본이 실제 있으면 영향 검토 전 실패·rollback, 예기치 않은 hash/head도 거절한다. 새 v2 역시 Anvil 사람 확정 사건을 날조하지 않고 source 승인 출처만 보존한다. 실제 적용/legacy 보존 시험은 exact 게시 SHA 후 진행 전이다.
- 다음은 이 정정을 실제 WSL에서 확인한 뒤 승인된 본인 공통 자료 쓰기 계약과 DRAFT 편집을 이어가는 것이다. 전체 작업계획 완료/Stage B 수용/사용자 인수는 아니다.

### 2026-10-16 FN02 내장 정의·그래프 검사 착수

- actual GREEN: WSL Git exact `7590d3584fb4971b67f1c4d6fd7aace749a37504`/clean. 적용 전 `anvil.methodology_definitions`42P01 RED(실제 fixture 생성0), 계획0002 checksum `0453854b9925f5ff2eeed15babfb5dda8446fbb751b3e7caf0378a98d6dbcd34` 적용 exit0 뒤 같은 실제 API/DB 시험1 PASS/skip0·608ms. 내장3종 그래프/정확 양식/원문지문·본인USER_COMMON 읽기200/타인404/회수401/app UPDATE42501 확인, QA 사용자2·양식 아닌 방법론2와 session/credential 정확 정리. 원문 source 승인과 사람 확정 사건은 분리(`confirmation=null`), 실제 소유자/실제 Agent 생성0. 기존 migration checksum 모두 유지.
- UI03 `methodology-editor/{MethodologyEditorPage.tsx,api.ts}`는 내장3종·7단계 선택과 문서 고정 버전/목적·검수/사람확인/기록/재작업·검사 결과를 읽는다. 현재 절차는 읽기 전용이며 위치 편집·노드/연결 편집·복사/직접 작성/확정/적용은 미구현이다. 첫 요소 부재 RED→연결. 같은 기본본 재열기에서 version을 비운 뒤 effect 의존 값이 바뀌지 않아 본문이 사라지는 결함을 회귀 RED로 재현, 명시 재조회 세대를 갱신한 뒤 같은 기대값 GREEN. 방법론2+양식2 Edge fixture4 PASS/3.4초, 타입/Web32모듈 PASS. 기존 양식 fixture에 새 방법론 조회만 명시 추가했고 예상 밖 API 차단은 유지, 실제 Windows DB 요청0.
- 새 승인 경계: 사용자 공통본 쓰기는 FN02/FN03 승인 기능에 있으나 현행0011 commands/check 및 content_reviews 상세 계약은 PROJECT/DRAFT만 지원한다. 가짜 project/draft ID나 인증 actions 우회로 공통 쓰기를 구현하지 않는다. 본인 USER_COMMON 자료의 현재 사용자/client·중복 명령·정확 버전/감사를 새 forward migration/계약으로 추가하는 보완을 신산님께 비동기1회 요청했다. 답변 전에는 해당 공통본 쓰기/DB 보완을 하지 않고 기존 DRAFT scope의 프로젝트 생성 초안 편집을 계속한다. 다른 프로젝트 권한·계정/키·운영은 범위 밖이다.
- 저장/조회 후보 사전 등록: 계획0002의 새 `methodology_definitions`·`methodology_versions`·`methodology_reviews`·`project_methodologies`만 기존 승인 DB/migrator에 추가, SYSTEM 정의/버전3개는 개발 기본 자료로 보존한다. 기존0000/0001/0011/0003 SQL 수정0, 실제 사용자/키/초기화/기존 프로젝트 변경0. 기본본은 원문 승인 출처만 보존하고 사람 검토/확정 사건을 자동 생성하지 않는다(`confirmation=null`·실행 준비 필요). 새 app 권한은 읽기만, 개정/확정/적용 집행 전 쓰기 개방0. 적용 실패 transaction 전체 rollback, 이후 문제는 별도 forward migration으로 수정.
- 실제 WSL QA는 지정 Git exact 게시 SHA/기존 보호 app·migrator 참조만 사용하고 Windows DB 재접속0. `qa-methods-UUID` 일반 사용자2·USER_COMMON 정의/버전2를 고유 ID로 만들어 본인 목록/ID200·타인404·회수401·app UPDATE42501·내장 그래프/hash/양식 참조를 확인한 뒤 정확 QA ID/session/client/password만 정리한다. 실제 계정 생성/새 컨테이너/port/Secret0, 비밀 없는 auth 감사는 보존. API 인증 경계404≠401 RED→GREEN, 현재 단위36/typecheck/diff check PASS. 실제 DB 시험은 다음 exact SHA에서 진행 전이다.
- Main 어울, 시작 `4dd4b56d215a3e538c731552e17ace78fe9b1691`(private 동일·clean/main f976ed5e 불변). REVIEW-01 승인 원문 hash `1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1` 기반 내장3종 각각7단계·역할/목적/입출력·실제 공식 양식 ref·완료/기록/사람 확인·재작업을 구현했다. 실제 도구/환경/유한 정책이 결합되기 전 `PROJECT_BINDINGS_REQUIRED`, Agent/DB 변경0.
- TDD: builtins0≠3 RED→GREEN, graph 초기6건 RED→GREEN. 명시 재작업 허용, 중복/참조/도달 불가/완료 누락/타 양식 hash/사람 역할 위반/조건 없는 분기·합류/코드·credential 필드 거절. AG07 정상 반복을 품질 실패로 인코딩한 원인을 원문 대조 후 `USER_CHOICE.NEXT_ITERATION`과 동일 실패 fingerprint3회 계수로 구분하는 회귀 RED→GREEN. 전체 시간/호출·비용 한도는 실제 프로젝트 정책 없이는 실행 불가다. 종료 뒤 정상 후속 작업을 추가 RED로 재현해 `TERMINAL_HAS_SUCCESSOR` 거절·유효 ALL 합류 허용까지 FN02 단위8 PASS/typecheck exit0.
- Ruling: `contracts/methodologies.ts`의 REVIEW_DECISION/USER_CHOICE는 구조 편집용 제한 자료이며 실제 승인/실행 근거가 아니다. FN10의 최종 사전·실제 결과·현재 권한/유한 정책 소비 전 실행 불가. 상세화가 잘못되면 후속 버전/참조 변환 비용이 있으므로 새 버전으로 교정한다. JSON schema·API/DB 저장·화면·복사/직접 작성·확정/적용은 아직 미완료다.
- 문서 복합 패치의 계획 행 제목 오인은 적용0을 실제 Git으로 확인한 뒤 정확 행에 재적용했다. 전체 단위35 PASS/skip0·typecheck/diff check exit0. 다음은 계획0002의 내장 버전 저장/조회다. 기존 Windows DB 접속 중단·bootstrap 재발급 금지·실제 계정 자동 생성 금지를 유지한다.

### 2026-10-16 FN03 공식 양식 저장·조회 착수

- actual GREEN: WSL `148684772ca863cc99dee5c359148b4aa1f58669`, 0003 checksum `51637420526c3bdae9c9b1ae3a020f2fd5c964125f67cd680b646eb191a0f59b`. migration exit0, 실제 catalog/API 시험1 PASS/skip0·453ms. 공식 양식8·기준1을 저장했고 사용자 공통본 두 개 중 본인 것만 목록/버전 조회, 타인404/구버전 부재404/회수401, app UPDATE42501, 같은 seed 검증과 바뀐 hash seed 거절/rollback을 확인했다. QA 두 사용자·소유 양식/버전/session/credential은 정리, 실제 소유자 생성0. 제품 형식 제공이며 실제 문서 내용 검수·사용자 확정은0이다.
- UI03 양식 조회: `features/methodologies/{FormsCatalog.tsx,forms-api.ts}`를 기존 App의 전역 방법론 분기에 연결, 승인 시안의 선택/목차·반복필드/작성 기준 원문을 데이터로만 렌더한다. HTML 실행/자료 명령 실행0·쓰기는0. 다른 양식 선택 시 앞선 본문을 버리고 늦은 응답을 무시, 재조회 실패는 오래된 자료 표시, 401/403은 자료를 회수한다. 방법론/문서 저장·확정 버튼을 허위 성공으로 노출하지 않는다. 기존 공통 App/CSS 변경은 이 경로 분기와 긴 기준 원문 읽기 스타일만이며 구조 개편이 아니다.
- UI 첫 RED: 양식 선택 요소 부재1, 새 구현 뒤 같은 기대값 Edge2 PASS. 공통 탐색/인증 오류 표현 직접 영향 회귀까지7 PASS/4.1초(API 전부 fixture 격리). 타입·Web30 build PASS(신규 UI Node/DB 실제 여정은 미검증). 첫 sandbox build는 기존 Vite 임시 파일 쓰기 EPERM, 같은 elevated build exit0·권한/ACL 변경0. UI 복합 패치의 App 문맥 불일치는 적용0·새 파일0을 확인한 뒤 정확 문맥으로 재적용했다. 새 FILE_MAP/정확 파일 재검색 전 잘못된 web 경로 읽기는 없는 파일 오류·변경0이며 실제 경로로 정정했다.
- 다음: 공식 양식의 실제 고정 ref를 내장3종 방법론 정의/저장/조회에 연결한다. UI03/FN03은 부분 구현이며 미구현 업무를 테스트 이월로 숨기지 않는다. 현재 브라우저는 Windows 실제 DB 접속 중단으로 계약 fixture만, WSL HTTPS 배포/사용자 인수는 미실행이다.
- Git exact `237899bcb318d641743068868ddc9ae8f2cab179`를 지정 branch/private와 WSL에서 일치·tracked clean 확인. WSL 실제 catalog 시험은 최초 DB 검사 `anvil.form_definitions` 부재/42P01 exit1로 RED, fixture 생성 전이며 skip0다. 이 RED를 제품 사용 성공으로 해석하지 않는다.
- 생성 전 DB 대상: 기존 승인 DB·migrator, 계획 `0003_documents`의 `anvil.authoring_standard_versions`·`form_definitions`·`form_versions` 세 테이블/버전 FK·head FK·범위 check·인덱스만 새로 만든다. 공통 기준 원문1과 공식 양식8·버전8을 지속 개발 자료로 보존하며 실제 계정/키/프로젝트 자료0. app는 이 새 catalog에 SELECT만 가능, 기존 역할/기존 테이블 권한 변경0. 같은 seed 재실행은 같은 버전 검증만, 다른 hash·본문/소유에는 rollback/거절한다. 적용 실패 전체 transaction rollback, 적용 후 기존 SQL을 수정하지 않고 별도 forward-only 수정으로 복구한다. 문서 파일 저장소·Secret·컨테이너·port 추가0.
- Main 어울, branch `codex/av3-stage-b`, 시작 `59c3444cc657812a90dc754c82f76406f66b9eda`. FN01 최종 생성이 소비할 FN03 catalog를 선행 연결한다. 공식 원문 SHA256 `622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13`/공통 기준 `85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07`을 보존, 승인 자료 자체 수정0. 공식8종·각6목차·안정 항목/필드 ID·반복 행·작성 규칙·검수/사용자확정 분리를 구현했다.
- `forms-import` 첫 실제 RED는0≠8, 구현 뒤 GREEN. 새 목록/버전 인증 시험404≠401 RED→공통 현재 세션 gate 연결 GREEN, 익명 오류는 기존 계약 `AUTH_REQUIRED`를 사용한다. 초기 시험의 SESSION_EXPIRED 예상은 소비자 코드와 대조해 인증 부재/만료를 구분하도록 바로잡았다. 선언되지 않은 scope는400, 다른Host403. 아직 실제 저장 검증 전이며 형식 합격을 내용검수/사용자 인수로 승격하지 않는다.
- `npm test` sandbox에서는26 PASS/1 FAIL: 기존 auth-init `D:\tmp\anvil-v3-stage-b\auth-init\owned-XXXXXX` mkdtemp EPERM, 실제 인증 파일 변경0. 같은 승인 범위 elevated 전체 단위27 PASS/skip0, typecheck exit0. ACL 변경/제품 실패로 오인하지 않는다. 없는 `FN03.md`/`migrate.ts`/`environment.test.ts` 읽기는 경로 오류이며 실제 파일 등록부로 정정, 파일 변경0. 첫 forms.ts 패치는 같은 대상 delete/add가 도구에서 거절되어 적용0, 단일 update로 처리했다.
- 다음 실제 QA 사전 등록: 기존 지정 WSL v3 checkout/Git exact 게시 SHA, `anvil_v3_development`/기존 app 및 migrator 보호 참조만 사용. `qa-forms-UUID` 일반 사용자2·USER_COMMON 양식2를 고유 ID로 생성, 소유 초안/실제 사용자/키/초기화/기존 프로젝트 변경0. 테스트 종료/실패 시 생성한 두 양식/버전·사용자/session/client/credential만 정확 정리하고 잔여0 확인, 비밀 없는 auth 감사는 유지한다. Windows relay actual DB 접속 재시도0. 신규 컨테이너/port/Secret/계정 소유자 생성0.
- Ruling: 공식 양식이 참조하는 공통 작성 기준의 실제 본문/고정 버전은 FN03 `authoring_standard_versions`로 보존한다. 미래 지식 테이블의 가짜 참조를 만들지 않는다. 계획된0003의 catalog 부분을 먼저 적용하고 이후 문서 원본/제안 저장은 별도 forward-only 후속 migration으로 확장하며 이미 적용한 SQL을 수정하지 않는다. 동작 범위 변경은 없고 기술적 의존 순서 상세화다. 잘못되면 후속 명시 migration/참조 변환 비용이 있으며 기존 버전은 보존한다. SYSTEM 양식은 app 역할에서 읽기 전용, 사용자 양식 작성/개정·목록 cursor·문서 가져오기/확정은 아직 미구현이다.

### 2026-10-16 Stage A 통합 종료·Stage B UI00 시작

- 실제 초안 DB/HTTP: WSL exact `5a88d5ebea1151c1da448da7d28bb3f074dd5952`/clean에서 draft-storage1 PASS(2.10초). 동시 동일command POST1회·본문 충돌409·타 소유404·타client403·stale409·별도 새Pool/HTTP 재조회값 유지·명령/감사2건·최종프로젝트0을 확인했다. 기존 migrator로 이번 삽입 성공 추적한 QA 소유자/초안/명령/감사만 정확 정리·잔여0, 제품 app 감사 변경 금지는 유지했다.
- UI02 첫 목적/빈소스 중간저장 연결: API helper의 상대 경로/CSRF·위조ID 차단1 RED→GREEN, 화면 부재2 RED→저장/새로고침·명시 같은command 재확인 GREEN. 로그인 만료/내부 왕복 후 미저장 입력 보존1도 확인했다. 후속 Edge14(모든 API를 명시 fixture로 격리·미등록 API는 차단/FAIL) PASS·unit25/typecheck/Web28모듈 PASS. fixture를 실제 저장/새 전체 브라우저 여정 PASS로 합산하지 않는다.
- 라벨 오류: React controlled textarea의 초기 내용이 감싼 label text에 섞여 정확 label 조회2건이 실패했다. 실제 DOM은 입력을 보존했으며 진단 출력은 합성 문구 `왜 만드는가개발 주도권`이었다. id/htmlFor로 명시 연결한 뒤 같은 기대값/timeout GREEN, 선택자/합격 기준을 느슨하게 바꾸지 않았다. UI02의 응답 단절은 pending command를 탭에 유지하고 명시 재확인만, 새 명령 자동 생성0. 목적 미완성 저장은 초안일 뿐 생성 성공이 아니며 방법론/기존 소스/최종 생성 버튼은 연결 전으로 명시한다.
- 새 UI 상태/명령은 App의 탭 메모리에 보존하고 로그인 만료/화면 이동으로 버리지 않는다. 미저장/결과미확인 상태의 새로고침은 native 경고, 새 초안을 시작할 때는 명시 확인하며 결과미확인 중 새 초안 생성은 차단한다. 비밀·credential을 localStorage/URL에 저장0. 기존 source/data 자동 삭제·권한 이전0. 문서 패치의 최종 문맥 오타1은 적용0을 확인한 뒤 정확 문맥으로 재적용했다.

- FN01 중간 저장 후보: 현재 인증/CSRF·초안 소유자/client 아래 POST/GET/PATCH를 추가, create/save command·DRAFT receipt·감사를 같은 transaction에 저장한다. 사용자 행 gate 아래 create command를 전체 본인 scope에서 먼저 대조하므로 동시 새 draftId를 중복 만들지 않는다. `schemaVersion=1,commandId,clientId`와 생성 targetId=null/expectedVersion0·저장 expectedVersion/step/input은 기존 §8~9.2의 wire 상세화다. 미완성 목적은 초안에 저장 가능, 최종 프로젝트가 아니며 미정 방법론/null·자료[]만 허용한다. EXISTING 소스/실제 자료/방법론 선택은 저장 선행 전412로 차단해 거짓 기준선/성공을 만들지 않는다. 무인증GET404→401·단위24/typecheck PASS, 실제 저장 검사는 다음 WSL 게시 후보 전이다.
- 초안 실제 QA 사전 등록: Main/FN01, 기존 지정 v3 DB의 고유 `qa-draft-UUID` 일반 사용자2·초안/command/receipt/감사만 사용·실제 소유자/초기화/키0. 기존 WSL migrator 참조는 이번 삽입 성공을 추적한 QA 소유 초안 행만 정확 정리하는 별도 역할로 사용하고 Windows로 비밀 복사0·제품 코드에서 감사 우회0. 실제 사용자/프로젝트·auth 감사는 보존한다. 이 정리 권한을 제품 app의 감사 UPDATE/DELETE 허용으로 승격하지 않는다. 과거 계약 그대로 administrator 전체 변조 불가 보장은 하지 않는다.

- FN01 프로젝트 읽기 actual: WSL exact `b11167dc2748d3aab347a3db24c05d1969767ddd`/clean에서 auth 인접1·project-read1=2 PASS(1.42초). 고유 QA 사용자2/프로젝트4만 사용하고 모두 정확 정리했다. 허가 목록/직접ID404·보관 분리·membership회수·로그아웃401·서명cursor 주체·microsecond 항목 손실0을 확인했다. 합성 SQL seed를 실제 프로젝트 생성 기능 성공으로 보고하지 않는다.
- UI01 목록 partial: 기존 S01의 이름/목적·목록 검색/보관·cursor·S04이동·관측/오류 보존만 연결했다. 단계/완료 분류·담당/결정/다음 행동·생성은 연결 전임을 화면에 명시했고 진행/완료인 것처럼 꾸미지 않는다. 화면 부재2 RED→같은 fixture2 GREEN, 단위24·타입/Web26모듈 PASS. API 저장 검수와 fixture 화면을 합쳐 E2E PASS로 세지 않는다.
- 영향 브라우저11에서10 PASS/1 FAIL: 예전 ‘실제 미구현 session404’ 조건은 현재 실제 인증401로 바뀌어 ‘찾을 수 없습니다’ assertion이 실패했다. 인증/세션 구현을404로 되돌리거나 기대값을 느슨하게 바꾸지 않고, 기존404 오류표시 계약에 명시 fixture를 고정했다. 이때 미고정 탐색 시험이 AuthForm의 자동 setup 조회를 실제 서버로 보낼 수 있던 격리 누락도 확인하고 공통 session fixture로 차단했다. 이후 동일 오류/빈목록 금지 기준의 UI00/01 영향11 PASS(6.3초), 단위24 PASS. 향후 Windows 실제 auth DB 경로 재시도 금지는 그대로 유지한다. 최초10/1 실패는 원래 사실로 보존한다.
- 공식 FILE_MAP은 원문 diff에서 현재 후보의 소유 추가 문단만 빠져 있고 기존 문장 삭제/변경은 없었다. Git 이력 byte 일치 부재만으로 사용자 변경이라고 단정하지 않는다. 동기화는 삭제0·추가만인지 기계 대조 후에만 수행하고, 기존 정본3파일도 직전 소유 hash를 확인해 바뀌었으면 보존한다. 실제 source/schema/API·시험은 지정 branch에만 게시하고 원래 legacy 소스/dirty를 덮지 않는다.

- FN11 schema 실제 적용: WSL Git exact `939ff6e878cdd33359f9557a3abb69dd319c916c`/clean에서 0011 적용 exit0·schema/범위·감사1 PASS(0.19초). checksum `b5922fe31715076e7cdb1f6485f9ea5af4554c90fb957fb3b3a2c42ea22b9a21`, 0000/0001 불변. PROJECT scope NULL 우회23514·다른 command/scope receipt23503·감사 UPDATE/DELETE42501·모든 합성 transaction rollback/사용자/프로젝트잔여0. 새 테이블에만 DML 제약을 적용했다. runner는 실제 적용된 migration3개/checksum을 전부 출력하도록 receipt를 보완했고 존재를 실제 권한 집행 완료로 표시하지 않는다. 적용된0011은 이제 수정 금지, 후속은 forward migration이다.
- FN01 조회 후보: 허가된 프로젝트 목록/직접ID·보관 필터·현재 membership/세션과 서명 cursor를 연결했다. 무인증404→401, filter기본값/다른주체·필터·limit/변조·기한·microsecond 보존 cursor RED→GREEN, boolean coercion 누락1도 RED→문자열만 허용 GREEN. 당시 단위24/typecheck PASS. 실제 교차 프로젝트/회수/페이지 손실 검사는 다음 게시 SHA의 WSL에서 실행 전이다. TypeScript 시험 callback implicit any1은 명시 id 타입만 보정했다.
- 내부 상세 판정: 전역 프로젝트 목록에는 단일 프로젝트 기준선이 없으므로 `baselineVersion:null`로 미해당을 명시하며 가짜1/READY를 만들지 않는다. cursor 자체 format version1·주체/필터/limit·정확 DB microsecond·서버 서명·30분 유효 범위를 결박한다(TD-03 page50/최대200 유지). 방법론/기준선·정책 미연결은 readiness gap이며 상세 조회는 READ_PROJECT만 제공한다. 프로젝트 생성·제어 grant/쓰기 성공으로 오인하지 않는다.

- FN11 저장 RED: WSL exactd1f76dcb에서 permission_policies 부재 false!=true를 확인했다. 이제 명시 `0011_authorization`으로 정책/version·명령·정확 승인 요청/결정/소비·receipt·별도 감사/사건/outbox/draft 감사11테이블을 전용 DB에 추가한다. 신산님 P03의 전용 v3 migration 승인 범위, 기존 0000/0001 checksum 불변. 새 감사·불변 version/결정/소비/receipt만 app UPDATE/DELETE 차단하고 기존 테이블/역할/Secret는 변경하지 않는다. command↔receipt는 같은 scope/command의 지연 FK로 결박, NULL scope 우회도 CHECK로 거절한다. 실제 적용은 지정 branch 게시→WSL exact SHA/migrator/transaction/checksum 뒤, 실패는 rollback·applied SQL 수정0. 합성 사용자/client/프로젝트2/명령2·감사1은 실제 검사 transaction rollback·잔여0, 실제 사용자 생성0. 이 단계는 schema 준비이며 기능 권한집행 PASS가 아니다.

- 내부 선행 판정: FN01의 초안/프로젝트 명령은 FN11 command·draft 감사 저장을 소비하고 최종 생성은 FN02/03 확정본을 소비한다. DATA_MODEL §6.6/INTERFACES §15.3의 명시 DAG대로 이미 확인한 FN01 인증 기반 뒤 0011 저장 원시기능을 먼저 구현한다. 이는 FN01/FN11을 최종 수용하거나 선행을 삭제하는 변경이 아니며, 각각의 최종 연결 검수는 남긴다. 정확 신규 시험 `tests/integration/FN11/authorization-schema.test.ts`는 WSL Git 후보의 미존재 RED부터 확인한다. 새 schema는 지정 v3 DB/migration 승인 범위만, 적용 전 0000/0001 checksum·역할·현재 사용자0을 대조한다. 기존 migration/데이터/외부 서비스 삭제0. 미커밋 부모 디렉터리 생성 도구 제한1은 기존 자료 변경 없이 정확 새 시험 디렉터리만 준비했다.

- 초대 API 실제 검수: WSL Git exact `3b8e029d539b5be587ff0c1b178641811a3c183e`/clean·typecheck·auth DB/HTTP1 PASS(1.83초). 소유자 재인증 초대→일회 비밀1회→일반 사용자 수락/자동로그인0→새 로그인·일반 사용자 초대403을 확인, 고유 두 QA 계정/초대/세션을 정리했다. 프로젝트 grant 집행과 소유자 초대 작성 UI는 아직 미완료다.
- 초대 수락 UI00: 화면 부재 RED→등록/복구 비밀 가림·보관 확인/자동로그인0 계약 GREEN. 초대 화면 ‘로그인으로 돌아가기’가 복구로 가는 오류도 실제 RED→분기만 보정 GREEN. 현재 인증 보안 계약4·unit23·타입/Web24모듈 PASS, 실제 새 UI DB 브라우저는 relay 위험으로 미검증이다. fixtures 합격을 실제 사용자 초대 성공으로 보고하지 않는다.
- 공식 문서 대조: 이전 소유 동기화본 불변인 WORK_STATUS/WORK_PLAN/DEVELOPMENT_ENVIRONMENT와 신규 UI00 RESULT4개만 공식 root로 hash 일치 동기화했다. 공식 FILE_MAP은 현재 Git 이력과 byte 동일본을 찾지 못해 보존했으며 덮어쓰지 않았다. 실제 업무 배정 파일은 게시 후보 FILE_MAP과 대조한다. 이 정본 경로 불일치를 몰래 일괄 복사로 덮지 않는다.

- FN01 초대 기반 후속: 명시 소유자/최근 재인증/CSRF·24시간 상한·일회 비밀·일반 사용자 수락/자동로그인0 API를 추가했다. 무인증 초대404→401 RED/GREEN, 로컬 unit23/typecheck/diff PASS. 실제 저장/동시·회수/역할 검수는 다음 WSL exact 후보에서 진행 전이다. 프로젝트 grant는 FN11 실제 권한/제어 집행 전 `PROJECT_AUTHORIZATION_NOT_READY`412로 차단하며 빈 projectGrants 계정 초대만 준비했다. 이를 프로젝트 권한 초대 완료라고 표시하지 않는다. 새 계약을 임의로 완화하거나 실제 사용자 계정을 생성하지 않았다.

- 복구 API는 WSL Git exact `551b7791e74b835ce7b08eb465b420e6d592e93c`/clean에서 실제 auth DB/HTTP1 PASS(0.93초)다. 이전/소비한 비밀 차단·동일command 결과·generation/세션 회수를 포함한다. 후속 UI00은 로그인의 복구 양식, 설정의 로그인 보안(재인증→새 CSRF로 비밀번호 교체·복구 비밀 재발급 동의/가림/보관), beforeunload 경고를 연결했다. 실제 화면 부재2 RED→계약 fixture2 GREEN, 추가 동의/가림 회귀1도 PASS, 단위23·타입/Web24 모듈·diff PASS. 브라우저3은 명시 fixture이며 실제 API/DB와 합쳐 E2E PASS로 세지 않는다. Windows relay 중단 때문에 새 UI의 실제 DB 브라우저 여정은 미검증, 초대/프로젝트·내부 탐색 미저장 보호 등도 남아 UI00/FN01 [2] 유지한다.

- 복구 기능 구현 전 기준선 `25d2a2c9`를 지정 branch에 게시하고 WSL exact SHA에서 실제 rotate404!=200 RED를 확인했다. Windows relay 오류를 기능 RED로 대신하지 않았다. 이후 access repository/routes에 최근 재인증/CSRF 아래 일회 복구 비밀 재발급·이전 회수, 비밀 digest/시도 제한·일회 소비/세대 증가/전체session회수·동일command 결과만 확인을 구현했다. 로컬 unit23/typecheck/diff PASS, actual WSL GREEN은 다음 게시 SHA에서 검증 전이다. 복구 비밀/새 비밀번호 원문은 저장/출력하지 않는다.

- 중요 환경 예외: 복구 후속 검사에서 Windows→WSL relay의 같은 connectionTimeout5000 실패가 누적3번째 발생했다(이번 본문 첫 DB 조회 전, finally 포함22.8초). 해당 Windows DB 실제 시험/재접속 경로를 중단하고 네 번째 재시도·timeout 확대·공유 relay 재시작/kill·ACL 변경은 하지 않는다. WSL 내부 동일 app/DB 조회는 exit0·active1/잠금대기0이었다. 기능 RED/PASS가 아닌 연결 환경 실패이며 직접 원인 미확정. 별도 변경 권한 없이 Windows relay 복구를 시도하지 않고 단위/로컬 구현·Git exact SHA WSL 검수는 계속한다. 정식 Node40744/초기화1은 보존하며 정상 상시 로그인 사용은 현재 미확인 위험이다.
- 중간 게시 `000d0088bfab071115958211bd4426f88e77b531` local/private 동일·clean, main f976ed5e 불변. WSL exact000d008/clean·typecheck/auth DB/HTTP1 PASS(3.1초). 정상 launcher는 같은 commit·Node40744/startUTC2026-10-15T20:25:42.3705853Z·3830·기존relay26052로 시작했고 직후 실제 HTTPS setup200/true·session401을 확인했다. 이후 위 relay 재발을 정상 사용 PASS로 숨기지 않는다.

- 승인 초기화 실제 결과: 설치ID `fdd305cc-9b91-4a1f-b86f-94d2690c062e`, 두 신규 파일 배타 생성·DB행1·사용자0. 초기 등록 기한 `2026-10-15T20:51:14.749Z`(KST 2026-10-16 05:51:14.749). 독립 조회로 digest/기한 일치·미사용·소유자 없음·파일 link0·허용 SID=current user/SYSTEM만 확인했다. 비밀 원문 출력0. bootstrap 만료 후 자동 연장/파일 덮어쓰기 금지다.
- 초기화 도구 최초 실행은 `PROTECTED_ACL` 이전 자료변경0에서 실패했다. Windows PowerShell5의 Microsoft.PowerShell.Security 모듈 자동 로드 실패를 ACL-only 재현으로 확인하고 기존 설치 PowerShell7의 같은 검사 GREEN 후 실행 경로만 보정했다. ACL 변경0. 진단 --check를 추가해 filesWritten0/rowsWritten0을 확인했다. diagnostic return의 최상위 TS1108 1건은 분기 구조만 보정했다.
- 인증 후속 검수: 무인증 재인증/password404→401, 실제 최근 재인증 없는 password404→412 RED에서 구현 후 실제 DB/HTTP1 GREEN. 토큰/CSRF 교체·동일client·절대12시간 연장0·옛cookie401·비밀번호 변경 세대 증가/모든세션회수·옛비밀번호401·새비밀번호 로그인·동시 claim 멱등/시도제한을 확인했다. 보안 감사는 비밀 없이 보존, QA 사용자/세션/claim/복구/counter는 정확 회수하며 신규 영속 초기화행은 보존했다. unit23/typecheck PASS. sandbox의 D:\tmp mkdtemp EPERM1은 기능 실패가 아니며 동일 검사 elevated PASS·ACL 변경0이다.
- 미확인: 재인증/password의 실제 화면 연결, 복구/초대, 프로젝트/권한/기준선, 정식 launcher의 신규 auth 참조 실행과 후속 WSL exact SHA는 남아 있다. 잘못된 읽기 경로 scripts/validate-app-config.ts·components/AuthForm.tsx·layout/AppShell.tsx는 파일 부재였고 기존 실제 storage/shell 경로로 대조했으며 제품 장애로 세지 않는다.

- 후속 직접 승인 `call_74c28acfc6424f6fb3e31ef55262a333`: ‘신규 개발 인증 키·초기화 기록 생성 승인’. Main/FN01은 기존 보호 root `D:\Project\Anvil\.av3-data`의 신규 `auth.json`·`bootstrap.json`만 배타 생성하고 기존 전용 DB `anvil_v3_development`에 초기화 기록1건을 만든다. bootstrap30분·원문 Git/대화/로그0·실제 소유자 자동 생성0·기존 계정/키/CA/ACL 변경0. 두 파일/행 생성 전 기존 부재·root realpath/link·ACL·DB/role을 대조하며 재실행으로 덮어쓰지 않는다. 개발 키는 후속 개발용 보존, bootstrap은 기한으로 무효화한다. 준비 함수의 실제 파일 시험은 등록된 `D:\tmp\anvil-v3-stage-b\auth-init` 아래 새 일회 경로에서만 하고 시험 뒤 소유 파일/경로를 정확 정리한다.
- 진행 중 보존: config 검증1 RED→GREEN(당시 unit22/typecheck PASS). 재인증/비밀번호 변경의 무인증401 검사는 현재 endpoint 부재404에서 예상 RED이며 구현 전 PASS 아님. 신규 동시 claim/세대회수/시도제한 DB 시험은 아직 실행 전이다. `apps/server/main.ts`·개발 launcher·access/config 및 관련 시험은 Main 소유 미커밋 변경으로 이어간다.

- 실제 인증 UI 중간 결과: 승인 CA·TLS무시false의 실제 HTTPS server/전용 PG/Edge에서 초기 등록→일회 복구 비밀 가림/보관 확인→로그인→Secure/HttpOnly/Lax cookie→화면 로그아웃/쿠키회수 1 PASS(2.8초). Network same-origin·JS오류0·Agent호출0. 최초 실행은 등록/로그인 뒤 로그아웃 버튼 부재에서 RED·QA정리0, 버튼/명시 CSRF 연결 뒤 동일 검사 GREEN. 실제 계정·token·설치ID·recovery/counter·worker server는 회수하고 비밀 없는 append 감사만 보존했다. 아직 제품 초기화 보호 참조/상시 개발 실행 연결·복구/초대/재인증·프로젝트 API/권한·기준선은 미구현이므로 FN01/UI00 완료 아님.
- 정확 WSL HTTP/DB 검수: b380f687/clean에서 typecheck·auth-postgres1 PASS. Origin/추가필드 거절·실제login cookie/CSRF·logout/옛cookie401은 실제 저장·HTTP이며 브라우저 fixture 합격으로 대체하지 않았다. Windows relay의 간헐 첫 연결timeout2는 미확정 환경 위험으로 보존하며 세 번째 동일 실패 전까지 무작정 재시도하지 않는다. 실제 live시험에서는 연결과 전체여정이 성공했다.

- UI00 후속: 로그인/최초 등록·복구 비밀 가림/보관확인·자동 로그인0의 화면을 추가했다. 계약 fixture2와 실제 탐색3을 포함 Edge5 PASS, build23/typecheck·unit21 PASS. fixture를 실제 인증 성공으로 세지 않는다. 본문 skip-link의 hash경로 변경 RED→preventDefault/본문focus GREEN. 복구 입력/checkbox 선택자 충돌1은 exact 구분 뒤 같은 기준 GREEN이다. 신규 AuthForm.tsx·postAuth는 UI00 로그인표시/FN01 계약 소비이며 공개 기능 추가 아님.
- 다음 실제 HTTPS/DB/UI QA 사전 등록: Main/FN01, 기존 CA/leaf·DB만 사용. 현재 소유 Node30072(startUTC2026-10-15T19:26:50.5534635Z)를 receipt/PID/start/exe/경로로 대조한 뒤만 중지·등록 runtime 로그/receipt3개 정확 정리한다. Playwright worker의 임시 HTTPS server는 같은127.0.0.1:3830·등록 Stage B browser profile·합성 설치ID/소유자·메모리 key/비밀만 사용·테스트 후 server/Pool 종료, 생성한 계정/세션/초기화/복구/시도 counter만 정확 회수·잔여 확인한다. append-only 비밀 없는 QA 감사는 사실 증거로 보존. 실제 사용자 계정/새 CA·파일 Secret·공유 relay·기존 서비스 변경0. 실패도 cleanup하며 Windows 같은 DB 연결 timeout이 세 번째면 해당 재시도 중단/예외 보고한다.

- FN01 DB 적용 결과: WSL-server Git exact04d268bd/clean에서 전용 DB0001 적용 exit0, 실제 원본/교차client FK/빈 목적 거절·rollback/잔여0 1 PASS. 0000 checksum 불변, 0001 checksum/멱등 상태는 다음 receipt에서 별도 조회한다. migration 출력이0000만 표시하는 현재 도구 한계를 0001 미적용으로 오인하지 않는다.
- 인증 저장 core: 실제 전용 DB의 고유 합성 설치ID·초기owner→동일command재조회/본문충돌→잘못된 비밀번호→대문자명 로그인→digest만저장/session조회→logout/옛token거절 1 PASS. 실제 사용자/세션/설치·복구/시도 counter는 시험 소유 UUID만 정리하며 append-only 비밀 없는 감사는 사실 증거로 보존한다. 이 시험은 HTTP/UI 전체 PASS가 아니다. 타입추론 오류1은 transaction 결과형을 명시해 typecheck0, patch 다중동일파일 연산1은 적용 전 거부 뒤 Update 한 건으로 정정했다.
- HTTP 연결 검수는 Windows relay 접속5초 timeout이 두 번째 발생해 기능 RED에서 제외했다. 같은 Windows DB 요청을 더 반복하지 않고, 새 코드의 WSL exact SHA에서 실제 HTTP/DB를 확인한다. 독립 사전 거절 시험은 DB가 없어도401/다른 Origin403/추가필드400이 나와야 한다는 실제 assertion RED404→GREEN, 전체21 PASS/typecheck0. cookie/CSRF·positive HTTP는 아직 미확인이다. shared relay 재시작/kill·timeout 확대0.

- FN01 실제 schema 검수 사전 등록: 기존 신규 전용 PG/DB/역할만 사용, `0001_projects_access`가 사용자·client·credential/session/초기화/초대/복구/감사·프로젝트/초안/멤버/초기제어·선언/기준선 테이블을 추가한다. 기존 테이블/자료 삭제·이전 DB/권한 변경0. migration checksum/명시 순서/transaction을 적용하고 실패는 rollback, 적용 뒤 파일수정/down/drop0. 합성 QA ID는 시험에서 UUID로 생성·transaction rollback·잔여0 확인하며 실제 사용자 계정은 만들지 않는다.
- 첫 Windows DB 시험은5초 timeout으로 데이터 변경 전 실패, 기능 RED에서 제외. WSL 동일 PG ID/running/loopback·직접 app SELECT/Windows TCP 성공을 읽기 확인한 뒤 같은 timeout의1회 재확인에서 정상 연결·새 anvil.users 부재42P01 RED를 얻었다. 첫 연결 시간 초과의 직접 원인은 미확정이고 timeout/relay/서비스를 바꾸지 않았다. 첫 PowerShell finally가 외부 시험 exit1을 shell exit0으로 숨긴 점을 기록하고 이후 exit를 명시 보존했다. 실제 SQL/사용자 추가0.

- 후속 직접 승인 `call_b7ba48656c4b44d7a6ad68143308c93e`: ‘Stage B 지정 branch 게시 승인’. 같은 지정 저장소/codex/av3-stage-b·Stage B 신규 코드/시험/migration/실행·검수 기록만 게시/일반 Stage PR. Backup/legacy·실제 계정/Secret/인증서/DB 데이터/타 프로젝트 제외, 실제 Agent/Oracle/운영·main 직접 쓰기/force/rewrite 불가. 이 승인은 실제 시험 결과가 아니다.
- UI00 부분 검수: API client3·route1 RED→GREEN, 기존 회귀 포함17 PASS·타입/Web22모듈 PASS·실제 Edge2 PASS. 프로젝트 첫 화면/404 실패≠빈목록·모바일키보드/뒤로/새로고침·same-origin/JS오류0. 실제 인증/제어·입력 보존·가독성 전체는 FN01 연결 후 검수하므로 UI00 [0] 아님. 실제 native fetch를 객체 receiver로 호출해 Illegal invocation이 난1건은 Edge window/object 비교로 직접 확인 후 `.call(globalThis)`만 보완·동일2건 GREEN. CSS side-effect 타입 선언 오류1은 vite/client 선언 추가로 해결했다.
- FN01 시작: FILE_MAP access service와 auth.test에 비밀번호15~128/Unicode·공백/대소문자 보존·개별salt/Argon2id·기한/세대/회수의 RED3→GREEN3, 전체20 PASS/typecheck0. 실제 Windows Node24.18 native crypto.argon2 존재와 공식 Node24 문서를 대조해 새 암호 라이브러리 설치 없이 승인 최소19MiB/2/p1을 사용한다. 동시 hash2개로 유한 제한, 실제 서버/DB·공격 방지 PASS 아님. 근거 https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback . 새 사용자·세션·키/DB 변경0.

- Stage A PR41 head ff9481d0를 일반 merge해 private main f976ed5e에 포함했다. PR 실제 mergeable=true, CI discovery의 checks/status0(설정된 CI 없음)·local 필수 검수와 독립 검토로 판정했다. account 지정 CI 조회1회 ‘account changed’는 쓰기 없이 실패, 기본 discovery의 정확 head 조회는 성공했다. CI를 실행 PASS라고 표시하지 않는다.
- merged-main source diff0, 단위13/생성타입 일치·실제 승인CA HTTPS probe exit0. merged main Node61812를 receipt/start/exe/인자 대조 후 종료·3830잔여0, 전용 로그/receipt3개 정리. 이전 Node52852 종료 guard1회는 PowerShell JSON 자동 시각 변환 때문이며 변경 전 중단. DateKind String으로 원래 시각을 보존해 같은 모든 조건으로 확인했다. 공유 relay26052/DB/보호 참조·CA는 보존.
- Stage A 원격 branch 부재·로컬 정상 삭제·정리 확인 후 main에서 `codex/av3-stage-b` 시작, 단일 writer Main 어울. 기존 원래 branch/사용자 자료는 손대지 않았다. 이전 Stage 문서7개를 공식 root로 hash 일치 동기화했다.
- UI00 목적: Dashboard 대신 프로젝트 첫 화면·내부 탐색·공통 역할/제어/오류/미전송·same-origin client. 파일은 FILE_MAP의 App/shell/api/styles와 정확 시험, 필요 SPA 진입은 server app 및 기존 P03 영향 시험만. FN01/FN11 전 인증/프로젝트를 가짜 성공으로 표시하지 않는다.
- 신규 Stage B 임시 자원: `D:\tmp\anvil-v3-stage-b\npm-cache`는 정확 lock102 설치 cache, `browser`는 Edge 별도 QA profile/결과. Main/UI00·Stage B 검수용·각 사용 종료/실패 때 정확 경로/소유 process 확인 후 정리한다. 이번 cache 디렉터리 생성이 사전 commentary/기록보다 먼저 실행된 순서 오류를 남긴다. 이후 새 자원은 생성 전 등록한다. 기존 사용자 profile/Root/전역 npm 자동 업데이트0.
- 시작 검증 오류1: fresh 설치 직후 기존 Web unit이503!=200 실패. ignored dist가 아직 build되지 않은 준비 순서이며 기능 RED가 아니다. build→기존13개 단위 확인 후 실제 UI00 RED를 시작한다. 기존 기대값/검사 기준은 변경하지 않는다.

### 2026-10-16 P03 준비 환경 수용·Stage A 통합 착수

- 담당 Main 어울, 단일 writer. `0ec17f1a` local/private 일치·tracked clean에서 P03 결과 기록을 시작했다. 준비 환경 판정은 ENVIRONMENT_READY이며 제품 사용/Agent 연결 PASS가 아니다.
- Windows Node24.18/npm11.12, WSL Node24.21/npm11.19 차이를 유지한다. 실제 WSL 검증 SHA는892ea1e1, 이후 Windows 실행/브라우저 SHA는0ec17f1a이다. 동일하지 않은 실행 SHA를 합치지 않는다.
- 실제 Windows HTTPS probe exit0, CA498348218A4015B341A90B10FF4FE176987D4424 정확1·Node52852 시작UTC2026-10-15T19:08:42.2263733Z·3830 일치. Edge155의1 PASS·Network3/off-origin0/pageerror0/TLSignorefalse는 기존 불변 소스 증거를 재사용한다. PowerShell cmdlet의 시간 초과/뒤 연결거절 실패는 아래 원래 기록대로 보존했다.
- 임시 정리 exit0: 등록한 D:\\tmp\\anvil-v3-stage-a\\npm-cache·P03-browser 부재, QA Edge process0. WSL 등록 npm-cache realpath/link 확인 뒤 제거·잔여0. 새 PG/volume/개발 자격참조·CA와 정확 소유 HTTPS는 후속 개발용 보존이다. 공유 wslrelay26052는 종료/변경하지 않았다. cache/profile은 재생성 가능한 일회성 자료다.
- 판정/다음: P03 조건별 증거/미확인/rollback을 RESULT에 연결하고 준비3/미착수41로 정정했다. 기존 문서/시안 승인 hash를 현재 관측으로 소급하지 않는다. Stage A PR 검수·통합·smoke 뒤 UI00. 코드/환경 불변의 완료 검사는 반복하지 않는다.

### 2026-10-16 P03 실행 범위 직접 승인·P02 종료 대조

- HTTPS 준비 도구 실패 보존: 새 Node process는 READY를 출력했으나 PowerShell Invoke-RestMethod가 시간 초과여서 finally에서 정확 소유 process를 종료·3830잔여0/receipt없음을 확인했다. 그 뒤 브라우저1건은 연결 거절로 실패(준비 process가 이미 종료됨)이며 TLS/제품 실패로 소급 확정하지 않는다. 같은 cmdlet 반복은 중단했다.
- 독립 전경 진단에서는 승인 CA 검증의 Node127/localhost와 Windows 기본 신뢰 HttpClient127이 모두 HTTPS200, 실제 Edge155.0.4283.45 브라우저1 PASS·Network3/off-origin0/pageerror0/TLS무시false였다. PowerShell cmdlet의 같은 localhost 읽기만 TaskCanceledException을 재현했다. 내부 직접 원인은 미확정이며 보안 기준을 낮추지 않고 CurrentUserRoot exact등록/기한 확인+동일 승인 CA의 Node2초 probe로 준비 확인을 결박한다. 인증서/설정·timeout 연장0이다.
- 로컬 runtime 첫 시도는5546 점유로 process 생성 전 안전 중단1. 읽기 조회에서 `wslrelay` PID26052/정확 Microsoft WSL 실행 파일을 확인했고 종료/포트 변경0이다. 신규 app credential로 실제127.0.0.1:5546의 DB/role/서버·fixture와 저장/조회/DDL거절·probe정리0을 독립 확인해1 PASS. 기존 자동 relay를 쓰는 명시 선택을 준비해 불필요한 SSH tunnel을 만들지 않으며 공유 relay는 절대 회수 대상이 아니다. 보호 app 참조는 이미 생성됐으므로 복사를 반복하지 않는다.
- 브라우저 일회성 자원 사전 등록: `D:\tmp\anvil-v3-stage-a\P03-browser`는 Playwright 임시 profile·검수 결과·실패 캡처만, Main/P03 소유·검수/근거 회수 후 정확 정리·잔여 확인. 기존 Windows Edge 사용·기존 사용자 profile/보안 설정/인증서 변경0, TLS 무시 OFF·Network same-origin/실제 JS 오류를 확인한다.
- WSL 실제 준비 검증: exact `892ea1e1f3e65c408910ffa3ae5f8e9f807fb361`에서 PG15.18 신규 자원 생성·instance/ID/image/loopback5546 확인. container `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, volume/network는 등록 이름. 보호 경로0700/app설정0600·daon 소유. lifecycle OFF 설치102·typecheck/Web14·단위13·생성 타입 일치 PASS. 0000 checksum `6ebbb9c580d54a50e0431806ee982244cbe134613354f8c3a8cd4f547e30178d` 적용/멱등 재적용·fixture7, 실제 비관리자 DB 저장→다른 연결 재조회·DDL거절·probe정리0 1건 PASS. 실제 제품 사용자/프로젝트 생성0·Agent 호출0. WSL Node24.21/npm11.19이며 로컬 버전과 다름을 보존한다.
- 로컬 후속 사전 등록: 신규 `.av3-data/db-app.json`에 방금 생성한 전용 app 역할 연결 참조만 보호 저장·값 출력0, migration/bootstrap credential은 복사하지 않는다. 신규 `.av3-data/runtime`의 소유 SSH tunnel loopback5546와 Node HTTPS3830·PID/시각 receipt/비밀 없는 로그를 생성한다. Main/P03·후속 개발용 수명, 새 프로세스만·기존 port 점유 시 중단. 실패 때 방금 시작한 PID/시각 일치 process만 종료, 정상 개발 종료/전환 때 같은 소유 확인으로 정리한다. 실제 시작은 아직 전이다.
- 중간 기준선 게시: `codex/av3-stage-a` commit `8f3af6565654af2649e2737933b243c3a969becd` 정확89파일·local/private 동일·tracked clean, private main `b4f9006e30e5afcf98ef8ef1f39707ecc8954feb` 불변을 실제 조회했다. WSL 신규 Git도 exact8f3af656/clean이며 기존 자료를 복사 배포하지 않았다. 실제 DB 생성/저장·브라우저는 아직 미검증이다.
- 생성 직전 준비 판정 보완: 공식 docker-library/postgres entrypoint의 초기 socket-only 서버와 최종 TCP 서버를 구분했다. 초기 서버를 정상 완료로 오인하는 assertion RED를 확인한 뒤 readiness를127.0.0.1 TCP로 한정했다. 근거 https://raw.githubusercontent.com/docker-library/postgres/master/docker-entrypoint.sh . 이 변경은 같은 branch의 후속 exact commit/private 게시 뒤 WSL로 받아 사용하며 서버 소스 직접 patch0이다.
- 첫 checkpoint은 exact89파일 stage 뒤 generated-types EOF 여백의 staged diff-check 실패1로 commit 전 중단했다. 기존 dirty/다른 파일은 stage하지 않았다. generator의 최종 개행을 단일화하고 .gitattributes/.gitignore LF를 고정해 재생성·exact hash/차이를 다시 대조한다. 이 중간 실패를 commit/push 완료로 표시하지 않는다.
- 다음 생성 사전 등록: WSL `/home/daon/deploy/anvil-v3`는 지정 private branch의 exact commit Git checkout용·후속 개발 보존, Git 원격 접근/부재/부모 realpath 확인 완료·생성 직전 재확인. `/home/daon/.local/share/anvil-v3-development`는 신규 DB 보호 설정만·UID1000/0700·파일0600. 신규 PG `anvil-v3-development-pg`/network `anvil-v3-development`/volume `anvil-v3-development-pgdata`는 Main/P03 소유·후속 개발 보존·기존 자원 채택0, 정확 image/digest·instance label/신규 ID/loopback5546을 검증한다. 실제 생성은 아직 전이다.
- WSL npm cache는 `/home/daon/deploy/anvil-v3/.av3-data/npm-cache`로 한정·P03 설치 후 정확 제거, 전역 npm/cache/기존 node_modules는 변경하지 않는다. 합성 fixture7개는 P03 전용 anvil_qa 저장 자료이며 제품 로그인 사용자/프로젝트 생성이 아니다. 동적 저장 probe행은 고유 ID로 시험 후 정확 삭제/0확인한다.
- 후속 실제 확인: 신산님 ‘확ㅇ니햇어’ 응답 뒤 CA 등록 호출 exit0·receipt 생성, 실제 CurrentUser Root 정확 지문1·새 root ACL 제한을 독립 조회했다. sandbox Root 조회0과 실제 조회1 차이를 구분했다. 공개 지문/기한·회수 대상은 DEVELOPMENT_ENVIRONMENT, 키 원문0이다. 기존 root `.gitignore`의 기존 내용을 보존하며 신규 `.av3-data/` 한 줄만 추가해 키 Git 제외를 확인했다.
- 코드 독립 검토 C0/I2/M0의 자원 부재 오판·DB endpoint 미결박을 각각 조회실패 즉시중단+신규 instance label/ID/image 확인, 공통127.0.0.1:5546/DB/role 검증+실제 연결 신원 확인으로 보완했다. scoped 재검토 C0/I0/M0. 음성 RED2→GREEN2·단위12 PASS, 타입 user 추론 오류1을 정확 역할 const로 정정해 typecheck PASS. 실제 DB/제품 업무 PASS는 아직 아님.
- 기본 실행에서 Git diff만 ‘must be run in a work tree’2회인 반면 root/branch 읽기는 성공했다. 읽기 진단·실제 허용된 diff exit0으로 실행 환경 제한을 분리했고 Git config/index/HEAD를 수리하지 않았다. 잘못된 trace config 진단 인자1은 실행 실패로 남기며 재사용하지 않는다.
- P03 준비 자원 사전 등록: 담당 Main 어울, `D:\tmp\anvil-v3-stage-a\npm-cache`는 npm 공식 registry metadata/lock·의존성 설치 cache이며 P03 준비 종료 때 정확 경로만 제거하고 잔여 확인한다. 제품 node_modules는 Git 제외·새 branch 소스 범위에서만 생성한다. 기존 cache/ACL/전역 도구는 변경하지 않는다. 신규 의존성은 정확 버전·출처/integrity를 registry에서 읽고 최초 설치는 lifecycle script OFF로 진행한다. 제품 자료 외부 업로드0·실제 Agent 호출0.
- HTTPS 사전 등록: 신규 `D:\Project\Anvil\.av3-data`/`dev-tls` 안에 신규 CA/leaf·private key·공개 receipt만 만든다. Main 어울/P03·후속 실제 HTTPS 개발 검수 소유, 유효7일·CurrentUser Root 신규 CA1개만, 검증 종료/만료 시 receipt의 정확 thumbprint를 회수한다. 새 보호 경로는 현 사용자/SYSTEM만 접근하도록 설정하되 기존 ACL/LocalMachine/인증서·공유 proxy는 변경하지 않는다. 기존 .av3-data가 생겨 있으면 덮거나 재생성하지 않는다.
- 실제 소규모 검증: 설정·health/구조화404의 assertion RED4→GREEN4, 정규화/중복key·잘못된 값/참조의 RED4→GREEN4, 합계 단위8 PASS·typecheck PASS. Web build는 sandbox EPERM1 뒤 허용된 실행에서 14모듈 PASS, 기존 서비스 영향0. 정확 package99 설치/lifecycle OFF·lock144 항목; optional macOS fsevents의 설치 스크립트는 실행하지 않았다. 이것은 환경 틀이며 UI/FN 업무 완료0이다.
- 사전 WSL 조회: private Git main 접근·신규 source/protected 경로 부재·부모 실경로·UID/GID1000·기존 node24.21.0과 후보 PG15/Node24 이미지·포트3830/5546·신규 container/network/volume 부재 확인. Docker image ls의 repository2개 인자 오류1은 해당 읽기만 올바른 filter로 정정했다. 자원 생성0, 기존 Agent/인증/DB 설정 변경0.
- 최소 실행 설정 검사 파일을 먼저 작성했다. 최초 실행은 app/config 파일 부재로 module-load 오류2이며 유효 동작 RED로 세지 않았다. 최소 시험 진입점을 만든 뒤 실제 assertion RED→필요 구현→GREEN으로 확인한다.
- 담당 Main 어울. 질문 `call_f2cd20981cc64d83aceff512225037b5`의 직접 응답 3개를 확인했다. `새 Stage A 기준선·private push 승인`: 기존 branch/미커밋/삭제 보존, 최신 지정 private main에서 `codex/av3-stage-a` 예외 생성·manifest의51파일과 계획 범위 신규 v3 코드/테스트/실행 문서만 지정 branch로 commit/push. Backup·legacy 제품·Secret·다른 프로젝트 제외, main 쓰기/force/history rewrite 금지.
- `새 전용 개발 자원 준비 승인`: 공통3830·WSL `/home/daon/deploy/anvil-v3`·신규 전용 PG/network/volume/DB/role·승인 v3 migration/합성 QA·loopback5546·로컬 `.av3-data`/신규 backup. 기존 DB/사용자/컨테이너/인증/proxy/운영/Oracle 변경0, 전용 개발 DB는 보존·일회성 QA만 정확 정리. 실제 유료 Agent 호출 제외.
- `개발 인증서 생성·현재 사용자 신뢰 승인`: 신규 개발 CA/leaf7일·보호 저장·새 CA 정확 thumbprint1개 CurrentUser Root에만 추가/검증 종료 또는 만료 때 회수. 기존 인증서/LocalMachine/공유 proxy 변경0, 키 Git/로그0. 상세 대상은 DEVELOPMENT_ENVIRONMENT와 결박한다. 아직 생성/전송/신뢰 변경 결과가 아니다.
- 재개 실제 상태: 기존 HEAD/branch·삭제852/수정3·staged0 불변. P01·지원/설치 조사·이미 확인한 기능은 반복하지 않는다. P02 계약 최종 누락/명칭 대조 후 P03에 착수한다.
- 도구 오류: 첫 선택 읽기 명령의 PowerShell 미지원 brace 경로 구문 때문에 parser 오류1·명령 미실행이었다. 명시 경로 목록으로 고쳐 읽었다. 이전 sandbox SSH/소켓 접근 제한과 elevated 실제 읽기 성공은 제품 장애와 분리하며 ACL/서비스/네트워크 변경0.

### 2026-10-16 P02 후속 코어·TD-02 전용 로그인 승인

- 후속 직접 결정: 신산님 **‘P02 기본 정책안으로 설계 확정’**, 질문 `call_dca9f14d6c23489b9baa952bb9600508` 응답을 TD-03/TECH_DECISIONS §12에 기록했다. 인증 만료·유한 크기/spool·단절/자동 범위·실패/호출·단독 writer·수동 backup/자동 삭제 OFF의 상세 설계 승인이고 실제 자원/비용·Secret·private 업로드/배포 허가는 아니다. 이전 ‘제안/검토 전’ 기록은 당시 사실이다.
- 후속 계약: INTERFACES §12~15·DATA_MODEL §9~11에 연결/등록·정규화 어댑터·비밀 없는 관측/spool/연속 ACK·실제 소유/회수, 임무/하위 scope·자동/건별/queue·결과/검수·checkpoint/부분 변경 분리·이전·제어 인수·backup/복원·중요 알림/설치형을 이어 작성했다. §15는 생성 전 직접 방법론 graph 저장/확정·범위가 제한된 draft 명령·실제 내용 검토/참여 변경·typed 조건/codec·catalog migration 선행의 누락을 보완했다. 모든 업무를 완료했다고 표시한 것이 아니다.
- OS 경로: TECH_DECISIONS §11에 Node 실행기+작은 Windows C# helper의 내부 상세안을 두었다. 기존 compiler2경로의 파일/version `4.8.9221.0`만 읽었고 실행/build/설치/Agent 시작0이다. 정확 helper/bridge/시험 파일·Job Object 후보와 한계·DPAPI 사용자 범위/평문 fallback 금지·공개키 지문/일회 challenge의 범위를 명시했다. 실제 소유/이탈/회수·서명/보호 저장 검수는 아직 미실행이다.
- 재개 판정/담당: 앞선 목표 turn은 초기 연산/물리 명세·WORK_STATUS를 바꾼 실제 진척이다. Main 어울, 계획 P02를 이어 수행하고 P01/완료 자료·Agent 버전/설치 조사를 재실행하지 않았다. HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228`, branch `codex/anvil-public-ui-preview`, 기존 tracked 삭제852/수정3·staged0에서 재개했다. 전체 목표는44업무이고 P02 완료가 아니다.
- 직접 결정: `call_99470fca48514e588fa272e66665be52` 응답 **‘Anvil 전용 로그인으로 설계’**를 확인했다. TD-02 1안(전용 사용자명/비밀번호+서버 세션) 선택이며 별도 OIDC/실제 사용자·DB·권한·Secret·서비스 변경·새 비용 승인이 아니다. TECH_DECISIONS §9·진입점/개발환경에 기록했다. 이전 일자의 ‘미선택/미답변’은 당시 이력으로 유지한다.
- 연산/저장: INTERFACES §10·DATA_MODEL §7에 FN11 요청/결정/일회 소비·본문/세대/정책·감사/거절·원자성, FN04 양방향 추적/AF04 업무계획·두 선행/영향 UNKNOWN/승인·계획 적용, FN05 원문/헌법·가설/결정/이유·정정/제외/공유·manifest·분할/후속 전달·6항목 이해/확인 주체를 추가했다. 실제 처리/DB 검증은 아니다.
- 인증 상세: INTERFACES §11·DATA_MODEL §8에 초기 claim/초대·로그인/로그아웃/재인증/비밀번호·복구/회수, 비밀 없는 감사·CSRF/cookie/세션/credential gate를 작성했다. 비밀번호를 일반 command/hash·로그에 넣지 않는 예외와 응답 유실 시 비밀 평문 재보관 금지를 명시했다. 수치 profile은 검토 제안이며 실제 적용하지 않았다. 신규 사용자/계정/키 생성0.
- 연결 보완/파일: 프로젝트 생성 전 방법론/양식 카탈로그 경로와 새 상세 operation의 기존 명시 목록을 맞췄다. FILE_MAP §7/8은 기존 소유 모듈·schema/시험을 연결했다. 로그인/회수의 실제 UI 구현은 승인 공통 인증 상태와 연결해 후속 배정하며 새 화면을 완료했다고 표시하지 않는다. 변경 계약/진입점·WORK_STATUS 이외의 사용자 자료/Backup는 보존한다.
- 근거/오류/미검증: OWASP 인증·세션·비밀번호 보관·CSRF 공식 문서에서 관련 보호 원칙을 확인했고 제품/도구 재실행은0이다. patch 작성 중 혼입 문자를 대조해 정정했다. 인증 라이브러리/정확 버전·정책 값/보호 키·실제 HTTPS/DB·행 경쟁/회수·제품 검증은 미실행, P02 [2]·P03 []·제품 미구현을 유지한다. 새 임시 자원·commit/push0. 다음은 도구 등록/OS·실행/관측/회수·나머지 FN 계약과 정책 검토다.
- 변경 문서 검증: 새 공개 명령4개의 기존 enum/본문 연결, 6항목 이해 코드, 인증 경로11개, 주요 저장 참조21개, 인증 시험 파일2개, TD-02 직접 선택의 manifest 단일 기록을 PowerShell로 대조해 exit0였다. 초기 계약 회귀도 연산19/초기 테이블21/소유4·변경 계약 표34개의 열수/manifest35 hash·크기/설계·계획 hash 불변·diff check exit0를 확인했다. 이것은 문서 검사이지 실제 구현/보안 합격이 아니다. 검사 중 FN05 표2행이 두 열 헤더 아래 세 열로 작성된 오류1회를 찾아 보호 설명을 두 번째 열에 합치고 fresh exit0를 확인했다. 이전 nullable 표 구분 문제와 함께 작성 시 표 폭을 사전 대조하는 것으로 조치하며, 세 번째 연속 동일 원인이 발생하면 직접 작업도 중단/예외 보고한다.

### 2026-10-16 계획 순서 재개 — P02 초기 저장 연산·물리 계약

- 지시/담당: 신산님 ‘작업 계획서의 순서와 내용으로…이전 작업을 이어서’, Main 어울. P01 완료·설계 r8/계획 r7 검토 반영을 반복하지 않고 P02 미완료의 연산/저장 명세에서 재개했다. 별도 임의 계획/새 업무 ID·Agent 세션/자동화를 만들지 않았다.
- 시작 증거: PMO/프로젝트 운영 진입점·WORK_STATUS·계획 P02 카드·설계/양식·DEVELOPMENT_ENVIRONMENT·현재 계약을 대조. branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228`, staged0·tracked 삭제852/수정3 유지. origin은 다른 저장소이므로 쓰기0, development만 기존 지정 원격으로 확인했다. 설계 hash `63FD6C2E43689668345BC529F925C1BEF823833E88D59EA99310C301D1854BD3`, 계획 hash `8F5E2507E26FF4EA1B0376364365FA7C661E96B407A93E2F4BD56D6795B66727` 불변.
- 이번 작성: INTERFACES §9에 공통 참조/원문 hash·입력 검사·초안/프로젝트·방법론 graph/복사/확정/적용·양식/본문/제안/구버전 조회·stale/타 프로젝트/허위 검토 거절을 상세화했다. 기존 FN03 사용자 양식 요구의 명세 누락은 공개 명령 목록에도 맞췄으며 실제 API를 배포한 것은 아니다.
- 저장/파일: DATA_MODEL §6에 초기 테이블·타입/키/복합 참조·불변 내용/결정 이력·프로젝트당 초기 제어1행·command 중복/원자성·파일/DB 중간 실패·초안 귀속·migration 소유/검수를 작성했다. FILE_MAP §6은 기존 정확 schema/시험 파일을 연결했다. 기능 카드 머리말의 남아 있던 r5 라벨만 현행 r7로 정정했고 카드 범위/상태는 바꾸지 않았다. TECH_DECISIONS §10의 잔여 표로 완료/미결정을 구별한다.
- 기술 근거: PostgreSQL 공식 제약/행 잠금 문서를 확인해 다른 행 정합성을 CHECK에 맡기지 않고 복합 FK·UNIQUE·명령/버전 경쟁 검수를 명세했다. 실제 DB 제약/경쟁 시험은 실행하지 않았다. 기존 Agent 공식/설치 조사와 P01 브라우저 검사는 재실행0.
- 오류/자체 대조: 최초 INTERFACES patch의 잘못된 context1회는 적용 전 거부, 실제 마지막 문단을 기준으로 재작성했다. 작성 중 혼입 문자/구두점과 조회 validation 응답에 없는 validationRef 사용을 자체 대조에서 정정했다. 제품 오류/TDD 결과로 계산하지 않는다. PowerShell 다중 파일/대량 Git 목록 출력은 일부 잘려 이후 필요한 문서와 집계로 범위를 좁혔다.
- 경계/미검증/다음: 현재는 계약 작성이며 기능 추가로 실제 사용 가능해진 화면은 아직 없다. TD-02 미선택, 나머지 연산/보호/등록·OS·정책 미완료로 P02는 [2] 유지, P03/제품 코드/SQL·DB/서비스·실제 Agent/계정/Secret/비용·commit/push0. 다음은 TECH_DECISIONS §10의 순서로 이어가며 같은 완료 자료를 다시 검증하지 않는다. 기존 dirty/untracked/Backup 보존, 새 QA 자원 생성0·정리 대상0.
- 변경 문서 검증: PowerShell inline 검사에서 INTERFACES §9의 연산19개 존재·새 양식 연산3개의 기존 명령 목록 연결·물리 테이블21개의 정확 이름/중복 없음·소유4업무 연결·변경 계약 문서 표24개 열수·혼입 문자/미정의 validationRef 없음·manifest35파일 hash/크기 일치, 설계/계획 hash·HEAD 불변과 staged0를 확인했다(exit0). `git diff --check -- AGENTS.md docs` exit0. P01/Agent/제품/DB 검사는 변경 대상이 아니므로 반복하지 않았다. 이는 문서 정합 확인이며 실제 schema/SQL/권한/기능 테스트 합격이 아니다.
- 검사 중 보완: 수기 예상 테이블 수24로 검사한 오류1회는 표의 실제21개 이름 목록으로 바로잡았다. 이어 INTERFACES 두 표 행의 nullable 타입 `|`가 Markdown 열을 나누는 문제1회를 발견해 ‘또는 null’로 수정하고 같은 검사를 fresh exit0로 확인했다. 제품 합격 기준을 수정한 것이 아니며 schema 미완료/TD-02 미선택을 그대로 유지한다. BASELINE_MANIFEST는 실제 변경한 계약5파일의 hash/크기를 갱신했고 과거 승인 기록·시안 hash·설계 r8/계획 r7는 변경하지 않았다.

### 2026-10-16 Word 검토의 필요한 부분 본문 반영 — 설계 r8·계획 r7

- 지시/담당: 신산님 ‘필요한 부분만 설계서와 작업계획서에 반영해’, Main 어울. 검토의 권고를 그대로 실행하지 않고 기존 요구 내 필요한 상세화만 선택했다. 제품 구현/전체 목표 완료가 아니다.
- 변경 전→후: 설계 §2.4에 문서 상대 링크와 sourceRootId/root 상대 기계 경로 해석을 구별했다. 링크에 docs/를 일괄 붙이지 않는다. §9.1.1에 UI11 전 FN06의 인증된 API/개발 시험 진입과 실제 사용자 흐름 완료의 구분을 명시했다. §7.4.1/S05/S09에 현재 변경 계속 보완 또는 보존 검증/정확 승인 후 범위 복원을 정의했다. 미추적/바이너리·삭제 상태/사용자 혼재·직전 hash 변경을 검사하고 자동 reset/stash/clean은 추가하지 않았다.
- 전달·보호: §8.1.1은 Anvil 조회 후 분할/후속 전달을 기본으로 하고 로컬 참조 사본은 능력·허가/위치·범위/hash·읽기 통제·수명/정리 조건에서만 허용했다. 서버 링크 전달만으로 실제 접근/이해 합격 금지. §10.5에 spool/참조 캐시/백업 사본의 식별·전송/조회/복원 제한·관리 메타데이터 격리와 새 마스킹 ID/hash·승인/대체본/복구 검증 후 정리 조건을 연결했다. ACK만으로 즉시 파기하거나 원 관측/번들 hash를 덮지 않는다.
- 화면/계획: S06 문서 목록을 공식8종+헌법으로 맞췄다. 계획 등록부44행을 착수 선행/완료·연결검수 선행2열로 구분했다. UI01~14 뷰는 UI00·해당 P01/P02/P03 계약을 대조해 착수하지만 부분 구현이며 기존 완료 선행 목록은 유지한다. P/FN/IX는 원래 선행을 두 열에 동일하게 기록했다. 계획 §2.2.1에 R-01~07의 P02/FN/UI/IX 책임·검수, §3.2에 경로 기준을 명시하고 SCREEN_WORK 공통 계약에 두 선행 축의 소비 기준을 연결했다.
- 이력/범위: 변경 전 설계 r7 hash `2C9E688BC85ACC506A62B753673BC1B91CCE588610972B5FE3999DB723E73F6A`, 계획 r6 hash `A822D0FDF8C034F4BF268CFF559098D8107982836BF1A632D92A1F41429C4B2A`를 design/history/Anvil_설계서_v3_r7_20261016.md와 work_packages/history/pre-word-review-20261016/WORK_PLAN_r6.md에 텍스트 보존했다(줄바꿈 정규화 가능성/과거 승인 hash와 구별). 현재 설계 hash `63FD6C2E43689668345BC529F925C1BEF823833E88D59EA99310C301D1854BD3`를 계획에 결박하고 관련 진입점/계약 머리말의 개정 참조를 동기화했다. Word 원본·승인 시안/양식은 변경하지 않는다.
- 오류/조치: 두 문서 patch에서 뒤쪽 hunk 뒤에 앞쪽 행을 찾도록 작성해 context 검증이 적용 전 거부된 경우2회가 있었다. 실제 본문을 읽어 해당 파일의 미적용을 확인하고 hunk를 문서 순서로 배치해 적용했다. 계획 표에 불필요 공백 행1건은 즉시 제거했다. 오류를 제품 실패/RED로 쓰지 않으며 최종 표·공백 검사를 수행한다.
- 실행 경계/미검증: 단일 Main 문서 writer, 제품 코드·새 Agent 호출·서비스/DB·권한/Secret·계정·예약·새 branch·commit/push0. 실제 소스 복원/스풀·백업 생성/삭제0. 기존852삭제/수정·미추적 자료 보존. P02의 전달/복구/격리 계약 상세와 실제 시험은 미완료이며 전체44업무 집계는 P01완료1/P02작업중1/미착수42 그대로다. Stage 의무 대기·경미 변경 승인 생략·새 범용 Git/규칙 엔진은 추가하지 않았다.
- 최종 문서 검증: 읽기 전용 PowerShell 검사 exit0. 등록부44/카드44·중복0, 기존44행의 이름/Stage/완료 선행/상태 동일, UI01~14 착수 선행 분리14, 두 선행 그래프 순환0·미정의 ID0, IX01 FN11 유지. 설계 hash→계획 결박 일치, manifest35파일 hash/크기 일치, 현행 상대 링크88개 유효, 표34개 열수 일관, 위협12행/추적19행 본문·파생표 동일. 검토 원본·승인 시안/양식8개 hash 불변. 변경 전 r7/r6 보존본 hash도 관측 원본과 일치. `git diff --check -- AGENTS.md docs` exit0, HEAD/branch 불변·staged0·기존 tracked 삭제852/수정3 유지. manifest 자체와 동적 WORK_STATUS는 hash 목록에서 제외했다. 제품·Agent·DB·런타임 검증 PASS를 뜻하지 않는다.
- 검사 도구 오류 구분: 최초 로그인 PowerShell 프로필의 conda 시작 오류가 출력됐으나 문서 읽기 exit0였으며 후속 검사는 프로필 없이 수행했다. S06 확인식이 ‘테스트 결과서’ 띄어쓰기를 누락한 경우1회, 추적표 확인식이 실제 F01/절 번호 대신 AV3 접두사를 가정한 경우1회는 검사식 오류다. 실제 본문 대조 후 확인식만 정정하고 각각 fresh exit0를 확인했으며 문서 합격 기준을 완화하거나 원문을 검사에 맞춰 바꾸지 않았다.

### 2026-10-16 재검토의 필요한 부분만 반영 — 설계 r7·계획 r6

- 지시/담당: 신산님 ‘필요한 내용만 반영해’, Main 어울. receiving-code-review로 앞선 판단 중 타당한 보완만 채택하고 verification-before-completion으로 문서 변경 범위를 검증한다. 본문/카드 개정이며 제품 기능 성과로 세지 않는다.
- 변경 전→후: IX01에는 기존 타 프로젝트 조회와 FN04→FN11 간접 선행이 있었으나 만료·초기 제어 세대 사례가 명시되지 않았다. 계획 등록부/IX01 카드에 FN11 직접 선행·TC08과 두 QA 프로젝트의 ID/첨부/검색 격리·만료/옛 세대 변경 거절·부작용0을 명시하고 설계 TM07/추적표에 Stage B 검수를 연결했다. FN15 인수 기능은 Stage E 그대로다.
- P02 보완: 후보별 공식 조사가 있었으나 완료 표 형식이 없었다. 설계 §9.1.1·계획 §2.2·P02 카드에 필수6능력×후보 표를 고정하고 CAPABILITIES §7에 기존 조사 기반 6×4 표를 작성했다. 공식 경로 후보/설치 버전 적합성·실측 미확인/통제 한계를 구분했다. 버전/도움말·Agent 실제 호출을 반복하지 않았다.
- 기타 필수 보완: §11.1/12.3을 본문12·작은 설명10·보조 설명9px로 통일했다. 기존 FN10/11의 비용 통제·TM08 변조를 없던 것으로 취급하지 않고 TM10 비용 누적/관측 한계·TM11 공급망/산출물 검증·TM12 관리자와 검증 기준 동시 침해의 한계를 보완해 P03/FN10/11/18·IX03/06에 연결했다. 현재 기준 hash/기존 승인·후속 수정 지시/변경 영향은 설계 §13.5·계획 §6·위임 양식에 결박하고 소급 hash·전면 재승인/Stage C 의무 대기는 추가하지 않았다.
- 보존/변경 파일: 변경 전 설계 r6/계획 r5를 각각 design/history/Anvil_설계서_v3_r6_20261016.md, work_packages/history/pre-rereview-20261016/WORK_PLAN_r5.md에 텍스트 보존했다. 줄바꿈 정규화 가능성과 원 관측 hash는 EXTERNAL_REVIEW §6에 남겼다. 설계/계획·기능/통합/화면 카드·위임 양식·CAPABILITIES/THREAT_MODEL/TRACEABILITY와 현행 개정 참조(AGENTS/환경/기술·명령·데이터 계약 머리말)를 맞췄다. 재검토 입력 원본은 변경하지 않는다. 새 설계 hash `2C9E688BC85ACC506A62B753673BC1B91CCE588610972B5FE3999DB723E73F6A`를 계획에 연결했다.
- 오류/미검증: 작업 중 계획 표에 삽입한 불필요 공백 행1건과 문구의 이문자1건을 즉시 정정했으며 최종 표/공백 검사에서 재확인한다. 실행 명령/제품 기능 오류는 없었다. 모든 추가 보안/한도/공급망 검수는 계획 정의일 뿐 실제 시험 미실행이다. 미답변 TD-02·P02 잔여 계약·P03·전체 제품 미구현/44업무 집계는 유지한다.
- 경계: 문서 수정만 수행, 제품 코드·Agent·DB·권한·Secret·계정·서비스·예약·새 branch·commit/push0. 기존852삭제/수정·미추적 작업을 보존한다. N1의 문서 commit은 P03의 정확 범위 선정 과제로 남기며 이 보완을 커밋 승인/실행으로 해석하지 않는다. 최종 정합/보존 검증 결과는 아래에 누적한다.
- 최종 검증: 로컬 읽기 전용 문서 검사 exit0 — 15조건 충족(계획/고유/카드44·의존 순환0, IX01 FN11 직접 선행/조기 사례, 능력6×4 미실측 구분, TM12행과 추적표 일치, Stage 대기 규칙 불변, 설계 hash 결박, manifest32 hash/크기 불일치0, 연결87개 누락0·표 열 오류0, 검토/승인 원본7개 hash 불변, HEAD 불변·stage된 파일0). 보존 r6/계획 r5의 현재 hash도 개정 전 관측값과 일치했다. `git diff --check -- AGENTS.md docs` exit0. 제품/Agent·보안/과금/설치 시험은 실행하지 않았으며 위 검증을 그 PASS로 승격하지 않는다.

### 2026-10-16 P02 검토 보완 — 설계 r6·계획 r5 본문 직접 개정

- 담당/지시: Main 어울. 신산님 ‘반영을 설계서와 작업계획서를 수정해야지’에 따라 별도 보완 문서만 추가했던 방식을 정정해 본문·업무 카드에 직접 반영했다. receiving-code-review 기준으로 기존 합의와 타당성을 대조했고 verification-before-completion 기준으로 문서 정합을 새로 검사했다.
- 설계 변경 전→후: r5의 안전/검수 상세가 별도 문서였고 현재 승인 표기가 과거 상태에 머물렀다. r6의 §2.3 안전 기반 책임, §4.3 양식/드리프트, §5.1 상태, §6.2 이해 6항목, §7.3~4 증거/회수, §9.1.1 역할별 실제 능력 판정, §10 경로/Git/감사·spool/백업, §11 화면 동작, §12.1.1 TM01~09, §13.1.1 추적표·승인/개정 이력에 직접 통합했다. 새 설계 SHA256 `49F353055ABD8DAA1C72741E2DFA1B020957F04284D45CD93300444BC66C8780`.
- 계획 변경 전→후: r4의 선행 보완을 유지하고 r5 §2.2에 설계 절→담당 FN/UI/IX→구현/검수 조건 12묶음, §2.3에 Main 책임 RK01~10과 재검토 지점, 내부 검수점·상태4값·최신 다음 작업을 직접 반영했다. 기준 설계 hash를 결박하고 화면/기능/통합/위임 카드에 해당 조건을 연결했다. 44업무 범위·단독 제어·기존 합격 기준은 유지한다.
- 보존/정본: 변경 전 설계 r5와 계획 r4는 각각 `docs/design/history/Anvil_설계서_v3_r5_20261016.md`, `docs/work_packages/history/pre-integration-20261016/WORK_PLAN_r4.md`에 텍스트 보존했다. 줄바꿈 정규화 가능성과 원래 관측 hash는 EXTERNAL_REVIEW §5에 기록했다. 보존본 안 상대링크는 당시 원본 디렉터리 기준의 역사 텍스트이며 현행 탐색 링크로 사용하지 않는다. 이전 실행안전 보완은 이력으로 표시했다. AGENTS·개발환경·관련 P02 계약 머리말/추적·위험 조회표를 현행 개정과 맞췄고 현재 내용 manifest 29파일을 갱신했다. 과거 승인 hash는 새 hash로 덮지 않았다.
- 검증: 로컬 읽기 전용 문서 정합 검사 exit0 — 계획44/고유44·카드44 일치, 의존 해석44·없는 선행0·순환0, 현재 연결75개 대상 누락0, F01~15/TC01~15 추적 누락0, 설계/계획 기준 hash 일치. `git diff --check -- AGENTS.md docs` exit0. 검토 원본 MD/DOCX와 승인 HTML/양식 hash 불변 확인. 최종 manifest·표/연결 대조는 아래 결과에 누적한다. 제품 시험·불변 P01 검사를 재실행하지 않았다.
- 오류/조치: 첫 보존용 합산 읽기 결과가 출력 한도로 잘려 JSON 해석 실패1회(쓰기 전), 파일별로 분리해 보존 성공. 한 부분행 patch의 문맥 불일치1회는 적용 전 거부돼 전체 정확 행으로 수정했다. Windows rg 파일 glob 입력 오류2회는 읽기 검색 대상 표기 문제로 파일/디렉터리 지정 방식으로 정정했다. 표 삽입 때 혼입된 다음 표 머리말1건은 즉시 제거하고 실표를 대조했다. 최초 PowerShell 프로필 경고는 비로그인 실행으로 분리했으며 ACL·PATH·프로필을 변경하지 않았다. 제품 오류·기능 RED/GREEN 증거로 계산하지 않는다.
- 최종 대조: 읽기 전용 검사 exit0 — manifest29 hash/크기 불일치0, 수정 본문/카드 표 열 불일치0, 본문 TM9·계획 RK10·추적19행과 보조 조회표 차이0, 검토37항목 유지, 최신 현행 링크74개 누락0(이력 링크 기준은 위와 같음), 검토 원본/승인 자산6개 hash 변경0, 설계 기준 hash 일치·HEAD 불변. 불변 제품 검사는 재실행하지 않았다.
- 범위/미검증: 문서만 수정. 제품 코드·Agent 호출·DB·권한·Secret·계정·서비스·예약·원격 쓰기0, commit/push0. 기존 dirty/삭제·미추적 자료 보존, branch/HEAD 불변. TD-02 미답변·P02 잔여 계약/P03/신규 기능은 미완료이며 전체44 완료 집계는 1/0/1/42 그대로다. 다음은 승인 A안 P02 상세 계약이다.

### 2026-10-15 P02 계속 — HTTP 집행 경계·TD-02 인증 선택안

- 제3자 검토 보완 뒤 실제 P02 명세 작성을 재개했다. INTERFACES §8에 Node/Fastify 명시 route·초안/프로젝트 생성·자료 업로드·작업/이벤트 조회, 사용자 명령 enum과 서버 내부 authorize/consume/dispatch·관측의 구분, 오류·재전송 경계를 추가했다. 임의 함수/Plugin 호출, 직접 도구 승인 소비·중복 실행 우회는 제공하지 않는다. endpoint/schema 전체 완성·실제 API 기동을 주장하지 않는다.
- TECH_DECISIONS §9에서 TD-02 인증을 전용 계정/서버 세션(권장)과 별도 사용자 소유 OIDC 연동으로 비교했다. OWASP 인증/세션/비밀번호 보관의 기본 보호 경계를 공식 문서로 확인했다. 실제 계정·비밀·DB/권한/인증 서버는 변경하지 않았다. 로그인 방식 상세 설계 선택만 비동기 질문으로 요청했으며 현재 답변 전이다.
- 도구 오류 추가: 두 파일을 묶은 patch에 이전 문구의 불필요 hunk를 넣어 context 검증이 실패했다(1회). 파일을 다시 읽어 변경 없음/해당 최신 문구를 확인한 뒤 단일 파일·정확 문맥 patch로 수정했다. 앞선 생성 manifest 중복 대상 오류와 각각 기록하며 같은 시도를 반복하지 않았다. 제품 실행 실패·권한 변경은 없다.
- 미완료: 인증/등록·OS 회수/보호 저장·전체 연산 필드/권한/물리 저장·측정/보존 정책, P03 기준선/환경/실제 명령과 모든 제품 기능. P02 [2], 완료 집계 불변이다. 완료 P01과 불변인 제품 시험을 다시 실행하지 않았다.

### 2026-10-15 제3자 검토 대조·설계 안전 상세와 계획 r4 보완

- 지시/판정: 신산님은 타인의 의견을 정답으로 취급하지 않고 타당한 부분 보완 후 계속하라고 지시했다. P02 신규 파일 명세 작업을 잠시 멈추고 Markdown 검토 전체 및 Word 본문44문단/표·삽입 문서 아이콘을 확인했다. Word 서식/페이지 레이아웃 평가는 미실행이며 새 DOCX를 만들지 않았다. 원본 두 검토 파일은 보존했다.
- 항목별 판단: [외부 검토 대응](04_test_reports/AV3/P02/EXTERNAL_REVIEW.md)에 Markdown29항목·Word8묶음의 현재 근거/수용·이미 해소·미채택을 기록했다. P01 상세/내장 방법론·TD-01 직접 승인을 현재 사실로 대조했으며 ‘일단’을 근거로 원 승인을 잠정/P01~03으로 축소하지 않았다.
- 실제 보완: root AGENTS의 v3 진입점, 실행안전 보완 r1, 계획 r4/기능·준비·위임·UI00 카드. FN01 인증/초기 제어, FN11 변경 권한/감사, FN06·FN08의 FN11 선행, FN15 기반 소비, FN16 불필요 FN17 선행 제거, 큰 업무 내부 검수점·조기 능력 gate·독립 증거/이해 기준·문서 드리프트/경로/노출 대응을 명료화했다.
- 추가 명세: THREAT_MODEL 위험/시험 책임, TRACEABILITY 다대다 표, FILE_MAP 인증/audit 책임, DATA_MODEL 원본/투영과 통제 기반, INTERFACES 공식 상태 축. 미지원 도구/안전 회수는 실측 미검증이며 문서 존재를 보안/연동 PASS로 바꾸지 않는다.
- 미채택: 전체44업무 필수 범위 축소, 모바일 별도 승인 위임, 자동 timeout 강제 종료, 모든 시험 무조건 재실행, 고정1-hop 맥락 삭제, 자동 Plugin 로딩·임의 archive branch/일괄 Git 정리·폰트 일괄 변경. 현 요구를 바꿀 제안은 실행하지 않았다.
- 보존/변경 이력: r5·P01 승인 HTML·공식 양식은 변경하지 않았다. 계획/기능·준비·위임 카드의 변경 전 텍스트를 history/pre-review-20261015에 보존했다(줄바꿈 정규화 가능, 원 승인 바이트/hash 재현이라고 주장하지 않음). root/문서 이외 제품 코드·Agent/DB/권한·서버·원격 변경0.
- 오류: AGENTS 포함 diff check에서 기존 문장의 후행 공백1건을 검출(exit1)해 비의미 공백을 제거했다. 실행 장애/제품 실패가 아니다. 제품 검사는 코드/환경 불변이므로 반복하지 않았다. 전체 완료 아님, P01 완료/P02 진행/나머지42개 미착수 유지.
- 문서 검사: 계획44개/고유44·누락 선행0·순환0, 내용 manifest26개 hash 불일치0 확인. 상대 링크 검사에서 보존 방법론 사본의 이동 후 공통 기준 링크1건을 찾았다. 승인 원본/hash는 그대로 두고 별도 링크 안내 파일을 추가해 현재 기준과 승인 당시 바이트를 구분했다. 원 검토2종·r5/P01 HTML/양식 hash 불변을 재확인. 검사 결과는 문서 정합 범위이며 제품 PASS가 아니다.
- 도구 오류 구분: 생성 manifest를 같은 patch의 Delete/Add로 갱신하려다 도구가 중복 대상 문법을 거부했다(1회, 원본 삭제/변경 없음). 같은 파일의 단일 Update로 바로잡았다. 권한/정책 우회나 Git 삭제가 아니며 실행 장애/제품 실패와 구분한다. 링크 안내 추가 후 현재 manifest는27개 내용 관측이며 과거 승인 원문/hash는 보존한다.
- 최종 문서 재검사(19:53 KST): manifest27개 불일치0, 현재 참조 링크 누락0, 검토37항목/고유37, F01~15·TC01~15 추적 누락0. `git diff --check -- docs AGENTS.md` exit0. 테스트는 문서의 ID/연결/hash 검사이며 실제 사용자 흐름/DB/Agent/보안·Oracle 검증은 전부 별도다. 타당한 보완 후 A안 P02 인증/실행기 등록·연산·저장 명세를 계속한다.

### 2026-10-15 19:35 TD-01 A안 직접 승인·P02 파일 책임 명세

- 신산님 직접 응답 ‘A안으로 설계 확정’을 TECH_DECISIONS에 기록했다. 이전 TD-01 선택 대기 조건은 해소돼 문서 작업을 재개했다. 선택 질문 ID call_40a3fa97fcbc4300bc88198939f443a0. React/TypeScript·Node/Fastify·Electron·PostgreSQL/파일의 상세 계약 범위이며 실제 Agent 호출/DB/권한/배포로 확대하지 않는다.
- FILE_MAP.md를 추가해 공통/UI15·FN18·IX 시험의 정확 파일/소유와 생성 전 경계를 명시했다. 제품 파일을 생성하지 않았다. OS process/Secret binding·구체 인증/등록·데이터/보존 정책과 실제 계약/검증은 남았다.
- 승인 전 TECH_DECISIONS 관측 hash 6C8C8FA9F9F4D7D825BF66C63A3F320351FAF6CA85DCD6BC81569E71028FB4C5를 확인했다. 승인 내용은 TD-01 A구성에 한정하며 §5·7·8의 미결정 사항까지 승인된 것이 아니다. branch/HEAD는 ef80f61c1e82ec7a70d319efb5c76061111f9228 불변이다.

### 2026-10-15 18:56 P02 승인 경계 재대조·목표 차단 판정

- 직전 목표 turn은 DATA_MODEL·UI/FN 매핑·명칭 정합·측정/보존 제안 추가와 문서 검증으로 **진행**했다. 실행 중 프로세스 대기를 주장하지 않는다.
- 동일 경계 점검: P01 승인 응답 turn의 TD-01 요청 → 다음 목표 continuation의 독립 정리 → 이번 continuation까지 기술 선택 응답이 없다. 직접 답변으로 확인된 승인은 P01 시안·양식뿐이다. 이 3개 연속 목표 turn의 TD-01 경계를 같은 조건으로 집계한다. 사용자 질문을 재전송하거나 일반 계속 지시를 A안 채택으로 해석하지 않는다.
- 판단 이유/영향: P02는 기술 선택과 실제 파일/모델/연산 계약을 확정해야 끝나고, P03은 수용된 P02를 요구한다. 후속 제품 업무는 P03을 선행한다. 기술 독립 지원 조사·공통 관계/연산·정책 측정안은 정리했으며 남은 파일 타입/물리 구조·인증/보호 경계·실행 검증은 사용자 설계 결정 없이 확정할 수 없다. 문서를 반복 생성하거나 이미 완료한 P01을 재검증해 진도로 대체하지 않는다.
- 조치: 전체 계획 목표를 완료/축소/사용자 중지로 바꾸지 않고 실행 상태만 `blocked`로 전환한다. P02 산출물은 초안 그대로 보존, P01 [0]/P02 [2]/그 외42개 시작 전 유지. 신규 오류0, 제품/DB/권한/배포/원격 변경0. 실제 branch/HEAD는 직전과 동일함을 재확인했다.
- 정확한 재개 조건: 기존 TD-01 질문에 A/B/C 또는 수정 구성을 신산님이 직접 결정하면 해당 구성의 FILE_MAP·연산별 schema·물리 데이터·남은 정책 결정을 이어간다. 기술 선택 승인을 Agent 호출·DB·권한·배포 승인으로 확대하지 않는다. 이번 차단은 전체 완료보고가 아니다.

### 2026-10-15 P02 기술 독립 관계·매핑과 측정/보존 제안

- 앞선 목표 turn 판정: P01 사용자 승인 기록·상태 변경 및 P02 계약 초안 추가로 **진행**했다. TD-01 직접 응답은 아직 없으며 단순 시간 경과를 승인이나 실행 중 증거로 취급하지 않는다. 이번에도 해당 기술 선택을 확정하지 않았다.
- 담당/기준: Main 어울, P02 [2]. branch/HEAD 불변. tracked 삭제852/수정3과 새 문서가 있는 상태를 읽기 확인했으며 기존 소유 자료를 복구/일괄 stage하지 않았다. 제품 코드·새 자원 생성/원격 쓰기 없음.
- 산출: DATA_MODEL.md에 프로젝트·방법론/양식/문서·지식/원문·임무/세션·명령/관측·승인/회수/인계·백업·알림/패키지 관계와 보존·3상태축·파일/DB 중간 실패를 상세화했다. 물리 테이블/경로/schema 승인이나 migration 실행이 아니다.
- 명세 대조: INTERFACES.md에 FN01~FN18 대표 연산/입출력·실패 경계, UI00~UI14 소비 표를 추가했다. FUNCTION_WORK와의 expectedVersion 명칭 및 commandId/operationId 역할 불일치를 정정했다. 대표 함수 외 조회/초안/정정/정책 연산의 후속 상세 필요를 명시했으며 누락0·P02 완료로 과장하지 않는다.
- TECH_DECISIONS §7~8에 기초 표본·환경/성능/회수/손실 측정과 백업/보존·단절 정책의 결정 순서를 제안했다. 임의 숫자 합격, 자동 삭제·외부 보관·기존 Backup 경로 채택, 실제 모델 호출은 하지 않았다.
- 오류/미검증: 신규 실행 오류0. 문서 정합 보완이며 제품 테스트 미실행, endpoint/schema/파일 확정·기초 실측·인증/비용·실제 저장/Agent 연결은 남았다. TD-01 답변 후 선택 구성의 물리 계약과 파일 책임으로 이어간다. 완료 P01 검사를 반복하지 않는다.
- 문서 검사: PowerShell 정규식으로 INTERFACES 표의 FN01~18/UI00~14 누락 각0, expectedVersion 있음/expectedRevision 없음 확인 exit0. 이는 ID 행의 존재 검사일 뿐 schema/기능 완전성 합격이 아니다. `git diff --check -- docs` exit0. 확인 시각 18:55 KST.

### 2026-10-15 P02 TD-01 선택 요청·공통 계약 초안

- 판정: Main 어울, P02 [2] 유지. TECH_DECISIONS.md에서 A(TypeScript/Node/Electron), B(Python 서버/실행기), C(.NET 서버/실행기)의 장단점·가역성·안전 경계를 비교했다. A 권장은 제안이지 채택 결과가 아니다. 신산님께 TD-01 한 가지 설계 결정을 비동기로 요청했다. 현재 답변 대기이며 P02 완료/제품 착수 승인으로 표시하지 않는다.
- 독립 수행: INTERFACES.md에 Anvil ID/외부 핸들 분리, 서버 권한 확인, 명령 저장→전달, 같은 key/다른 본문 충돌, 미확인 부작용의 재실행 금지, 순번/ACK/spool, stale 관측과 현재 권한 분리, 제출/검수 및 중지/회수 상태 구분을 정리했다. 전체 UI/FN endpoint/schema·물리 데이터·파일 매핑은 미완료다.
- 공식 근거: Electron 보안/safeStorage, Fastify schema 신뢰 경계, Microsoft Windows Job Objects, PostgreSQL 트랜잭션 격리 공식 문서를 대조해 선택안에 직접 연결했다. Windows 보호 저장이 같은 사용자 앱을 완전히 격리한다거나 Agent interrupt가 모든 자식 프로세스를 중지한다고 주장하지 않는다. Node24 child_process 공식 페이지 접근 Internal Error1회는 미확인으로 분리하고 반복 조회하지 않았다.
- 기록 정합: P01 README의 미승인 문구를 REVIEW-02 승인 참조로 정정했다. 읽기 실패를 강제로 시험했다는 README 표현은 실제 fixture와 맞지 않아 ‘읽기 성공/형식/크기 시험, 강제 text() 예외 미검증’으로 바로잡았다. 승인 HTML/양식 본문과 hash는 불변이다. 코드/환경 불변이므로 이미 통과한 시안 전체 검사를 다시 실행하지 않았다.
- 검증/보존: 승인 hash2종 재확인, `git diff --check -- docs` exit0(비추적 새 문서의 완전성 검증을 뜻하지 않음). branch/HEAD 불변, 기존 삭제/dirty 보존. 신규 설치/프로세스/컨테이너/DB/Secret/원격 쓰기0. 후속 사용자 선택 전 의존 계약을 임의 확정하지 않는다.

### 2026-10-15 18:41 P01 승인 완료·P02 공식 지원 조사

- 판정: Main 어울. 신산님 직접 응답 ‘P01 시안·양식 승인’을 REVIEW-02에 기록하고 P01 [0], P02 [2]로 등록부/요약을 맞췄다. 전체44 업무 중 준비1개 완료이며 제품 UI/FN/IX는 미구현이다. 전체 계획 목표는 계속 유지한다.
- 기준: branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228` 불변. 기존 보관 정리의 삭제·dirty/untracked를 보존했다. commit/push·새 실행 자원·DB/권한/배포 변경 없음.
- 승인 결박: HTML SHA256 `8B76BDE3EC24FBF37EBD53CF459D454C820098E1097171E60789C1AAC47A51D4`, 공식 양식 SHA256 `622FFC6DB4CCC26AE07C785C91B114467019B21571B728A71DEA05D206816B13` 재확인. 두 승인 원본 내용은 변경하지 않았다. 시안 승인에 실제 Agent/DB/권한/배포를 포함시키지 않는다.
- P01 후속 보완 증거: verify.cjs exit0(14경로×8상태 VM 렌더 및 주요 양성/음성 계약). 실제 브라우저의 파일 선택/탭 읽기·줄 비교, 만료 미전송 보존, 인계 미지원 차단, 계획 개정 전 재개 차단, 모바일 AP-01 중복 결정 차단, 지식 원문 보존, 기존 소스 접근불가 예시, 빈 목록→4단계 생성, 초기화 재확인을 확인했다. v13 증거와 한계는 REVIEW-02에 연결했다. beforeunload 실제 팝업과 전체112조합 실제 브라우저는 미검증. 실제 제품 시험 아님.
- P02 조사: CAPABILITIES.md에 Codex0.161.0 app-server 도움말, Claude Code2.1.224 CLI 도움말과 공식 API/인증 경계를 정리했다. Node24.18.0·npm11.12.1·Python3.14.3 확인. 실행 명령은 버전/도움말·파일 읽기뿐이며 실제 모델 호출·인증 정보 읽기·계정 변경 없음. SDK/CLI의 허용 방식·기술 스택은 미확정이다.
- 오류 분리: Codex 도움말/버전은 exit0이나 도구 자체 임시 경로/PATH 정리 AccessDenied 경고가 있었다. 권한/ACL/PATH를 변경하거나 반복 수리하지 않았다. 공식 SDK reference 링크 조회 InternalError 1회는 문서 접근 오류로 분리한다. 이번 복구 직후 로그인 셸의 기존 conda profile 오류 1회는 login=false로 사용자 profile을 실행하지 않고 읽기 작업을 이어갔으며 profile 수정 없음. 계획 TDD의 의도된 RED는 운영 오류 횟수와 구분한다.
- 임시 자원: 기존 loopback 시안 서버만 유지, 새 서버/컨테이너/DB/계정/예약 생성 없음. 사용자가 검토 중인 시안은 닫거나 삭제하지 않았다.
- 다음: P02 기술 선택안을 근거·대안·영향과 함께 제시하고 결정받은 범위로 FILE_MAP/INTERFACES/DATA_MODEL을 확정한다. 기술/인증·비용 결정 없이 P03 구현 준비나 제품 개발을 추측해 시작하지 않는다.

### 2026-10-15 P01 다음 업무 — 공간형 흐름도·4단계 생성·공식 산출물 양식

- 판정: Main 어울, P01 [1] 검토·보완 중 유지. ‘작업계획서의 다음 작업 진행’과 직전 공식 산출물 요구를 적용했다. 기존 설계 AV3-F03·P01·UI03/UI06·FN03/FN09·IX01/02의 상세화이며 새로운 제품 모듈/기술 스택을 임의 도입하지 않았다. 양식 상세 내용은 검토 초안이다. 전체44 업무 완료 집계 불변, P02/P03 미착수.
- 기준: branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228`, 설계 r5 파일 변경 없음. 보존/정리의 기존 dirty/untracked는 유지했다. commit/push·서버/DB/Agent 실제 실행·예약 변경 없음.
- 산출: [공식 양식 상세 초안](design/공식산출물_양식정의.md), 공통 작성 기준 §6, 인터뷰 §14에 직접 요구/상세 초안 구분. 요구사항·설계·화면시안·작업계획·시험계획/결과·진행상황·환경 정의 8종의 필수 목차/필드·작성/검수·버전·조회 흐름을 정의했다. 기존 FN03/UI06 카드에는 해당 상세 참조를 추가했으며 업무 수/단계/기술 계약은 바꾸지 않았다.
- 시안 변경: `index.html`·`verify.cjs`·README. SVG 연결선/조건·재작업 표시, 노드 선택·방향 이동·배율(포인터 드래그 미제공). 4단계 생성·필수 입력·탭 초안·준비 필요/실행 분리. 내장 단계의 공식 양식 기본 연결과 복사본 추가 연결, 양식별 작성 규칙/LLM 임무 미리보기, 필수 목차/본문·출처/작성 주체 검사, 탭 산출물의 검토대기 본문 조회. 양식 전환 시 본문 유지. 문서 속 지시를 실행하지 않는다.
- 검증: `node docs/design/prototypes/core-workflow/verify.cjs` — 공간 이동 함수 누락 exit1→보완, 생성 다음 단계 미동작 exit1→보완, 양식 정의 미존재 exit1→보완, 양식 전환 본문 유실/필수 목차 불일치 검사·내장 기본 양식/읽기 전용 양식 조회 누락을 각각 RED 후 GREEN. 최종 exit0. 기존 14경로/6상태/정지·이해·승인·입력 보존·문서 충돌·인계/복원 계약 유지. 실제 제품/LLM/DB 시험이 아니다.
- 브라우저: v7에서 N1 오른쪽 이동 left60px·AF01 연결/작성 임무, 목적 빈값에서 1/4 차단→목적/방법론/도구/확인→생성 뒤 준비 필요·실행 기록 아님 표시, 빈 산출물 필수값 부족→수동 예시 작성→검토대기 보관→본문/출처 조회. v9 최종 제공본에서는 읽기 전용 N3에 AF02/AF03 표시와 AF03 화면시안 필수 항목·임무/양식 버전을 확인했다. 일부 locator가 native AX와 DOM role 차이로 no_matches 2건 발생해 실제 DOM/관측 ID/텍스트로 조작했다. 기능 실패나 유효 Developer 실패로 세지 않았다. 기록을 실제 LLM 작성 결과로 표시하지 않았다.
- QA/제공본: 기존 loopback 미리보기 세션62801 재사용, 새 제품 자원 생성 없음. canonical HTML = `p01-flow-wizard-artifacts-v9.html`, SHA256 `57AD3887270A4957D08F3C27621E24F5A477C609D23BD793B9E82B8F258C26FE`. 최신 탭 유지, 이전 Agent 검사용 시안 탭만 종료, 1440×900 임시 viewport는 reset. [흐름도 캡처](design/assets/p01-spatial-flow-browser.png), [공식 양식 캡처](design/assets/p01-official-forms-browser.png). v7 수동 산출물 본문 캡처는 해당 버전의 부분 증거로만 보존한다.
- 미검증/다음: 실제 LLM 전달·양식별 실제 결과 회수·영속 저장/권한·내용/첨부 검수 미구현. 양식 검사 PASS는 내용/사용자 승인 아님. 파일 선택/import·행 단위 diff·초기화/빈 초안 보호·기존 소스 조사 상세·전체 상태 및 사용자 최종 검토가 남았다. 다음은 이 P01 잔여를 수행하고 P02의 실제 지원/계약, P03의 실행 환경 순서로 연결한다.

### 2026-10-15 P01 계획순서 재개·입력/문서/인계·복원 시안 보완 — Main 어울

- 판정: P01 **[1] 검토·보완 중** 유지. 최신 계획순서 진행 지시에 따라 미완료 시안만 보완했다. 제품/UI/FN 완료로 계산하지 않는다. P02/P03 미착수, 1차 사용자 승인 스냅샷은 변경하지 않았다.
- 기준: branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228` 불변. 설계 r5 SHA256 `9EF5FF5AC5E130B654F9044B35CB02BFADA554F72E7939488CC7D967B3F818E8` 재대조 일치. 기존 정리/보존 관련 dirty·untracked는 건드리지 않았다. commit/push·원격/DB/서비스 변경 없음.
- 변경: `docs/design/prototypes/core-workflow/index.html`, `verify.cjs`, `README.md`, 이 현황, 대표 PNG2개. 노드 입력→탭 초안 즉시 보존, 새 정의/복사·스냅샷 복원 전 재확인. 문서 붙여넣기→좌우 전체 본문 비교→별도 반영→이전 원문 보존, 충돌 차단. 인수 요청/안전 요약/수락 분리. 손상/누락 백업 검증 실패와 정상 검증 뒤 영향 확인을 구분. 모두 탭 메모리의 설계 예시이며 실제 저장·실행·승인이 아니다.
- 검증: `node docs/design/prototypes/core-workflow/verify.cjs` 신규 입력유지·초안복원·문서반영·새 초안 교체·인계/복원 계약에서 각각 누락을 exit1로 확인한 뒤 보완, 최종 exit0. 기존 14경로/6상태·정지/이해·일회 승인·권한·그래프 검사도 같은 시안 검사에 유지. 실제 제품 시험 아님. 테스트 준비 중 DOM double의 미생성 필드 참조 TypeError1은 준비 오류로 수정하고, 별도 assertion RED를 확인했다.
- 브라우저: 노드 이름을 반영 버튼 없이 입력→N2→N1에서 유지; 문서 충돌 차단으로 v1 유지→재비교/반영 v2→v1 원문 이력 표시. 인계 요청만으로 수락 비활성→안전 요약 후 활성. 손상 백업 영향확인 비활성→정상 검증 뒤 영향 예시 표시. `getByLabel('백업 검증 상황')` no_matches1은 확인된 DOM ID `#backup-check`로 조회/조작하여 구분했으며 제품 결함/정식 Developer 실패로 집계하지 않는다.
- 화면 규격: 주 작업 1920×1080/1440×900에서 문서 scrollWidth 각각1920/1440, 430×844에서415. 모바일 대화→절차→자료 탭 전환 및 자료 캡처 확인. 모든 화면/규격 합격이나 실기기 검증이 아니다. 임시 viewport는 reset했다. [문서 비교 캡처](../docs/design/assets/p01-document-comparison-browser.png), [모바일 캡처](../docs/design/assets/p01-mobile-430-browser.png).
- 제공본: canonical HTML과 loopback 서버의 `p01-input-documents-control-v6.html` SHA256 `0CA76A923902A645C59FD5181E2FFADFA10D006830E656201E55C9BD7D101BF5`. 기존 preview 세션62801을 재사용했고 제품 runtime·외부 endpoint 호출 없음. 최신 시안 탭을 사용자 검토용으로 유지하고 이전 Agent 검사용 시안 탭만 종료했다. 최초 PowerShell profile의 conda 출력 인코딩 오류는 제품 오류와 분리하고 이후 명령은 login=false로 실행, 프로필/권한 변경 없음.
- 수행 판단: P01은 카드에 명시된 Main 소유 설계 HTML 보완이므로 제품 Developer write lease를 발급하거나 제품 개발 기준선을 임의 변경하지 않았다. 작업 이력은 사용자 지정 정본 WORK_STATUS에 기록한다. 원본 설계/계획의 범위 변경 없이 기존 상세 동작만 구체화했다.
- 미검증/다음: 공간형 그래프·전체 다단계 프로젝트 생성·파일 선택/import·행 단위 diff·전체 폼 미전송 입력/초기화 보호·전체 화면 상태·사용자 최종 시안 검토가 남았다. 브라우저 beforeunload 경고는 코드만 있고 실제 팝업 검증 미실행. 이후 P01 수용 결과→P02 기술/Agent 실제 지원 계약→P03 개발 준비 순서를 유지한다. 부분 검증을 전체 P01 또는 제품 PASS로 승격하지 않는다.

### 2026-10-15 P01 1차 승인·절차 편집 흐름 보완 — Main 어울

- 사용자 ‘승인해’와 후속 ‘진행해’를 근거로 1차 화면 방향·기본3종 상세안 승인 기록 REVIEW-01을 생성하고 승인 시점 HTML/방법론 문서를 approved-v1에 보존했다. 미작성 동작·전체 P01 완료·제품 실행으로 확대하지 않는다.
- 변경 이유/전후: 기존 복사/직접정의는 기본 배열을 실제 편집하지 못했다. 시안 탭 메모리의 독립 초안, 빈 방법론, 노드 속성·사람/Agent·분기/합류·시작/종료, 연결/조건 추가·제거, 삭제 영향 확인, 필수값·분기/합류·도달·일반순환·중복연결 검사를 추가했다. 기본 원본 불변, 검사 후 선택한 절차가 프로젝트/주 작업 화면·단계 자료로 이어진다.
- 자체 검증: 새 복사 편집 계약은 함수 미존재 assertion RED1→보완 후 node verify.cjs exit0. 기존 14경로/6상태/정지·이해/조회자/일회결정과 신규 복사격리·빈정의·순환/분기조건·정상재작업·도달·합류·중복연결·0번 원본 복귀 확인을 함께 수행. 자기 자신 비교의 무의미 assertion은 제거하고 실제 기본본 불변 assertion으로 확인했다. 제품 시험 아님.
- 실제 브라우저: 복사→첫 노드 이름 변경/반영→검사·프로젝트 선택→주 작업에 편집 절차/입력/산출 표시 확인. 빈 정의 적용 차단, 노드 추가 후 목적/입력/산출/완료 조건 누락 표시 확인. p01-method-editor-browser.png 보존. 오류 없는 전체 브라우저/Network 검증이라고 확대하지 않는다.
- 자체 검토 보정: 원본 표시가 사용자 복사본 이름으로 보이던 부분과 원본0 전환의 falsy 확인 오류를 수정했다. 분기노드 출구/합류 입력·중복연결 검사를 추가했다. 아직 미저장 입력 보호/완전한 공간형 그래프 등 잔여는 README/요약에 공개.
- 제공: 기존 로컬 미리보기 서버/exec 세션62801 재사용, 최신 method-editor-v4.html. 새 서비스·원격 접속·Agent·DB·코드 commit/push 없음. 사용자 시안 탭 유지. 다른43개 업무 시작 전, P01 [1] 유지.

### 2026-10-15 P01 1차 클릭형·기본3종 상세 검토안 인계 — Main 어울

- 산출: core-workflow/index.html·README.md·verify.cjs, 기본방법론_상세검토안.md, assets/p01-methods-browser.png. 내장3종의 단계/역할·입력/출력·문서·승인·보완·검수 제안과 시안14경로를 작성했다. 임시 상태는 탭 메모리만 사용, 새로고침으로 초기화된다.
- 실제 확인: Node 구문/14경로 렌더·6상태·정지/이해조건3·조회자/일회결정·escape·외부API 없음의 시안 자체검사 exit0. 브라우저에서는 애자일 선택→생성→주작업 이동과 정지미확인→정지만확인→이해도확인 단계별 재개 비활성/활성을 확인. 실제 제품/DB/Agent 검증이 아니다.
- 미완료: 완전한 그래프 노드/연결 편집·직접정의, 문서 import/diff·다단계 생성, 일부 중지/인수/복구 상세, 모든 상태/버튼, 1920×1080/1440×900·430×844·실기기·사용자 시안/방법론 최종 검토. README에 현재 예시/설명 수준을 명시, P01 완료 처리 안함.
- 미리보기: localhost:57672 / 127.0.0.1 bind, exec 세션62801, skill companion의 검토전용 서버. 사용자용 key 포함 URL은 브라우저 인계와 응답에만 제공. 제공본 core-workflow-v2.html과 정본 SHA256 125F35518E90A8E828FE9EA2AA1232F110B709D9D2CC7C36569C1871F572CC14 일치. 사용자 검토 중 유지·중지 시 해당 exec 세션만 종료, 최대 idle4시간 자동 종료. 다른 서비스 영향0.
- 오류/조치: Git Bash sandbox NtCreateDirectoryObject 접근오류1→동일 승인된 로컬전용 명령 elevated 기동 성공. 첫 inline JS는 settings 템플릿 닫힘 누락으로 parse 실패1→수정 후 parse/자체검사 exit0. 브라우저 label exact 선택자1회 no-match→관측된 #stop-state로 상태 선택 확인. Windows 포트 소유자 조회1회 CIM 접근 불가, 권한변경/재시도 없음; 살아있는 서버상태 파일·실제 브라우저 표시·exec 세션으로 미리보기 확인. PID 확인은 못함.
- 후속: P01 [1] 검토/보완, 다른43개 시작 전. 제품 코드·원격 Agent/서버/DB·계정·Git commit/push 변경0. 사용자에게 방법론 화면부터 검토를 요청한다.

### 2026-10-15 P01 화면·방법론 검토 착수 — Main 어울

- 사용자 ‘2번 진행하자’는 사전 안내 2번의 화면·방법론 검토로 해석하고 명시했다. P02 기술/실제 Agent 조사·제품 코드는 이번 범위가 아니다.
- 산출 경로: docs/design/prototypes/core-workflow/index.html·README, 내장3종 상세 검토안. 실행/승인/도구 교체는 브라우저 메모리의 예시만 변경한다. 실제 외부 요청·저장·Agent·DB 실행은 없다.
- 미리보기 자원 사전등록: 소유 P01, Windows 로컬 전용 시안 미리보기 프로세스1개, 사용자 검토 동안만 사용 후 정지 시 정확 PID/세션만 종료. 시안 폴더/비밀 없는 자산만 제공, 공용 서비스·운영 컨테이너·네트워크 설정 변경0. 실제 주소/포트/프로세스는 기동 결과 후 기록한다. 파일은 검토 이력으로 보존.

### 2026-10-15 기존 Agent 사용 가능·설치 위치 전달 — Main 어울

- 신산님 확인: PC의 Codex·Claude Code 사용 가능, Hermes는 ysna-server 설치, OpenCode는 WSL 설치.
- 조치: DEVELOPMENT_ENVIRONMENT의 도구 목록에 출처·설치 위치·미확인을 구분해 기록. PC 두 도구는 사용자 사용 가능 확인과 직전 PATH 발견을 기록하며 Anvil 실제 연동 검증으로 바꾸지 않는다.
- 남은 확인: P02에서 제품/버전·공식 제어 인터페이스·지시/관측/결과/중지/승인 기능을 확인. OpenCode의 WSL 배포판/호스트는 아직 특정하지 않는다. Hermes의 원격 실행 지원은 기존 범위 대조가 필요하며 설치 정보만으로 운영 서버 실행을 허용하지 않는다.
- 이번 수행: 문서 기록만. 신규 설치·로그인/계정·SSH/원격 접속·Agent 실행·서비스/권한·제품 코드 변경 없음. 업무44개는 여전히 시작 전이다.

### 2026-10-15 현황 기록 형식 확정 — Main 어울

- 사용자 지시: P01~IX08 단계별 요약과 일자별 상황을 이 파일에 기록. Daon2 현황 형식을 참고한다.
- 조치: 현재상태·Stage 요약·44개 업무별 현황·일자별 이력으로 구성했다. 원래 날짜별 승인·설계·오류·보존 기록은 아래에 유지했다. 변경 전 원문은 [현황 보존본](04_test_reports/AV3/WORK_STATUS_20261015_단계요약추가전.md)에 보관했다.
- 현재 진도: 계획 승인과 제품 구현을 분리, 44개 전부 []·시작 전. 설계/시안/계획을 작성한 사실을 P01 또는 기능 구현 완료로 바꾸지 않았다.
- 변경 범위: 현황 문서·기록 규칙만. Daon2 원본·제품 코드·서버·DB·Agent 실행·Git 원격은 변경하지 않는다.
- 다음: 실제 업무 시작/변경/시험/검수 때 해당 행·합계·담당/증거와 아래 일자 이력을 함께 갱신한다.

### 2026-10-15 작업계획 r3 승인

- 사용자 원문: ‘작업 계획서는 일단 승인해’.
- 판정: docs/WORK_PLAN.md r3와 연결된 화면/기능/준비·통합 업무 카드, 위임·결과·검수 계약을 작업계획 승인 기준선으로 기록했다. 44개 업무는 아직 시작 전이다.
- 설계 기준 hash: 9EF5FF5AC5E130B654F9044B35CB02BFADA554F72E7939488CC7D967B3F818E8. 준비 업무 P01~P03의 선행조건·미확정 상세·별도 실행 승인 경계는 유지한다. 계획 승인을 제품 완료·실측 통과로 해석하지 않는다.
- 이번 수행: 승인 상태 기록만 변경. 구현·Agent 배정·시험·서버/DB·원격 Git 변경 없음. 실제 착수 시 승인 계획의 준비 업무부터 진행한다.

### 2026-10-15 기본 내장 3종 사용자 확정

- 신산님 결정: 구조적 방법론·객체지향 방법론·애자일 방법론. 직전 담당자의 3종 제안은 대체한다.
- 설계 r5 §4.1.2와 FN02에 SYS-M01 구조적/SYS-M02 객체지향/SYS-M03 애자일로 반영했다. 이름/목록은 확정, 상세 절차·표기·필수 양식·검수 구성은 검토 대상으로 구분한다. 선택·복사 수정·사용자 직접 정의는 유지.
- r4 설계 보존 후 계획 r3의 설계 hash를 9EF5FF5AC5E130B654F9044B35CB02BFADA554F72E7939488CC7D967B3F818E8로 갱신했다. 인터뷰 원문에 후속 결정 누적. 제품 구현·내장본 실제 생성·서버/DB·Agent 실행·원격 Git 변경은 없다.

### 2026-10-15 기본 내장 방법론 요구 추가

- 신산님 직접 지시: 방법론 몇 개를 기본 내장하고, 시스템 표준대로 진행/사용자 정의 모두 제공한다.
- 설계 r4 §4.1.1~3에 내장 선택·미리보기·프로젝트 적용, 기본본 복사·수정, 빈/가져오기 사용자 작성, 출처/버전·원본 보호·업데이트 자동 적용 금지를 상세화했다. 구체 종류는 단계형/반복·증분/기존 SW 개선 3종 제안이며 사용자 확정으로 쓰지 않았다.
- 계획 r2의 FN02·UI02·UI03·IX01에 구현/검수 범위를 연결했다. 44개 업무 유지. 정적/클릭형 선택 화면 개정은 P01 미완료로 공개했다.
- r3를 history/Anvil_설계서_v3_r3_20261015.md에 보존. r4 SHA256 7A7AB37CC6A80AB79A0A5F4619C635E601A23699391F51BFF50F69C2E054C64B로 계획 기준 갱신. 요구 원문에 후속 지시 누적.
- 문서 patch 1회는 개발환경의 전체 행과 일치하지 않아 적용 전 거부됐으며, 실제 파일 상태를 확인한 뒤 정확한 행으로 다시 적용했다. 제품 파일/권한 변경은 없었다.
- 설계·계획 문서만 변경했다. 제품 구현·내장 데이터 생성·Agent 실행·서버·DB·원격 Git 변경 없음. 내장 종류 확정·화면 검토·실제 구현/검증은 남아 있다.

### 2026-10-15 위임·검수용 작업계획과 개발 방법 공통 기준

- 판정: 계획 문서 작성·자체 대조 완료, 사용자 검토 전. 제품 구현은 시작 전이다.
- 사용자 지시: 상세 설계에 근거한 실제 작업관리 계획을 작성. 화면/기능 업무를 구분하고 다른 Agent 세션에 위임할 입력·범위·산출·검수 정보를 상세화한다. 업무 크기가 아니라 구분 가능한 책임/결과/검수 경계로 분해한다.
- 추가 직접 정의: Anvil은 우리가 SW를 개발하는 방법을 표준화·시스템화한다. Anvil을 만들며 사용하는 설계·계획·위임·검수·변경·오류·인계 방식이 원형이며, 이 대화의 방법들은 제품에서 재사용한다. 제안/시행착오를 확정 규칙과 혼동하지 않고 원문·합의·근거·버전·프로젝트 적용·실제 수행/검수로 연결한다.
- 정본: docs/WORK_PLAN.md와 docs/work_packages/SCREEN_WORK.md, FUNCTION_WORK.md, INTEGRATION_WORK.md, ASSIGNMENT_REVIEW.md. 준비3·화면15(공통틀1+상세화면14)·기능18·통합8, 합계44개 업무. 모두 시작 전으로 등록했다.
- 작성 내용: Stage A~G, 선행 의존, 설계 추적, 책임/범위/입출력·처리/파일 경계·RED/GREEN·실제 검수 순서·증거·복구·QA·결과/검수/인계 양식. P02/P03에서 실제 기술·파일/API·명령·환경을 고정한 뒤에만 구현 패킷을 발급한다. 설치/배포 실행은 별도 계획/승인으로 분리했다.
- 제품 적용 기준: docs/design/문서작성_공통기준.md 작성. 방법론의 문서양식·임무 맥락에 버전으로 연결하며 FN03/FN04/FN05/FN09, UI03/UI06, IX01/IX02에서 실제 다른 프로젝트 문서 작성 흐름까지 확인하도록 했다. 이번 계획 작성이 그 기능의 구현 완료는 아니다.
- 설계 개정: r2를 docs/design/history/Anvil_설계서_v3_r2_20261015.md에 보존하고 최신 직접 정의를 §1.4에 반영한 r3 작성. 기준 SHA256 9E0C5317E477445AB2BDFC846B3391F518356D9FA32AE577BEA270712F1159ED와 계획 hash 일치 확인. 인터뷰 후속 지시 누적. AGENTS·README·개발환경에 현행 계획 경로/상태 연결.
- 실제 확인: 등록44·고유44·업무카드44 일치, 선행 ID 유효·의존 순환0, 계획과 관련 문서 상대링크16개 존재, 공백검사 및 지정 diff --check exit0. 수정 문서/자산의 hash·설계 기준을 대조했다. 자체 문서 대조이며 독립 Agent 검수·제품 기능 시험은 미실행.
- 오류/조치: 자체 의존 검토 중 FN04 승인소비의 FN11 선행 누락과 FN16 전체원본의 제어권/알림 선행을 보정했다. 사용자 요구를 작은 코드 조각으로 분할하지 않았으며 실제 배정의 미확정 필드를 실행자에게 추측시키지 않는다.
- Git/범위: local branch codex/anvil-public-ui-preview, HEAD ef80f61c1e82ec7a70d319efb5c76061111f9228 불변. 기존 보관에 따른 삭제/수정·미추적 상태 보존. 제품 코드·DB·서버·Secret·계정·예약 변경0, 새 Agent 배정0, commit/push0. 원격을 다시 채우지 않았다.
- 다음 조치: 신산님 계획 검토 후 실제 착수 지시가 있으면 P01 상세 클릭형 검토/P02 기술·연동 계약부터 수행하고 P03 실제 개발 기준선·검증 명령을 묶는다. 지금은 계획 산출물 인계이며 제품 자동 실행 없음.

### 2026-10-15 v3 상세 설계 재작성

- 담당: 어울. 사용자 요청: 지정한 v3 초안을 인터뷰에서 설명한 내용과 상세 설계 형식으로 다시 작성.
- 단계/판정: 상세 설계 초안 r2와 정적 화면 시안 작성. 사용자 검토·클릭형 동작 검토·최종 설계 확정은 아직 하지 않았다. 제품 구현 완료가 아니다.
- 기준 확인: PMO AGENTS·문서/화면 설계 표준, 프로젝트 AGENTS 최신 재설계 지시, 인터뷰 합의사항, 기존 초안, 작업현황·개발환경을 대조했다. 기존 로컬 HEAD ef80f61c1e82ec7a70d319efb5c76061111f9228, branch codex/anvil-public-ui-preview. 기존 자료 보관으로 인한 다수 삭제/수정 상태를 보존했다.
- 변경: docs/design/Anvil_설계서_v3_초안.md를 668줄 상세 설계로 재작성. F01~F15에 입력·처리·저장·조회·조건·예외, S01~S14에 화면·필드·동작·상태를 연결했다. 헌법 적용, 총괄 포함 교체 가능한 도구, 지식 원본, 미수행/원인 미확인, 구도구 무응답 인계, 실제 상태 대조, 단독 제어, 설계→계획→코드→검증 추적을 중심으로 작성했다.
- 보존: 변경 전 초안을 docs/design/history/Anvil_설계서_v3_개괄초안_20261015.md에 복사. SHA256 901FD881F704F7E905B8352283AEAB9856B207A4F1AC8DC7A2282A20A60846FE 확인. 인터뷰 원문·기존 Backup은 변경하지 않았다.
- 시안: docs/design/assets/av3-s01.svg~av3-s14.svg 정적 화면 14개. build-mockups.ps1은 예시 벡터 이미지 생성 전용이며 제품 코드가 아니다. 방법론/주 작업/도구 이전/모바일 4화면은 PNG로 렌더하고 직접 시각 확인했다. 실제 저장·Agent 연결·작동하는 버튼은 없다.
- 문서 검사: 상대 참조16개 존재, SVG14개 XML 파싱, 지정 문서 경로의 diff --check exit0. 새 문서는 untracked이므로 추가로 원문 공백·ID·참조를 검사한다. 제품 build/test/API/DB/브라우저 기능 시험은 미실행.
- 오류/조치: 시안 생성 첫1회 PowerShell 기본 R alias 충돌 exit1→스크립트 범위 alias로 수정 후 생성 exit0. 수정 patch 중 잘못 붙은 빈 hunk 1회는 적용 전 거부→정확한 patch 적용. 브라우저 로컬 SVG 렌더 확인1회는 도구 timeout으로 확인 불가→기설치 sharp로 PNG 렌더4개 exit0 및 이미지 직접 확인. 권한·사용자 설정·패키지 설치 변경0.
- 범위 유지: 제품 코드·서버·DB·인증·외부 서비스 변경0. 새 계획 작성·개발 Agent 실행·예약 생성·Git commit/push는 하지 않았다. 비워 둔 원격에 설계 자료를 다시 올리지 않았다.
- 남은 검토: 사용자 상세 설계·정적 화면 검토→클릭형 동작/오류 시안→설계 확정→화면/기능별 상세 작업계획·테스트계획. Agent별 공식 인터페이스, 기술 선정, 손실/성능 임계값은 미확정·미검증으로 문서에 공개했다.

### 2026-10-15 Git 파일 정리 완료

신산님 정정에 따라 저장소 자체를 보존하고 현재 파일만 비웠다. 기존 작업 branch의 e0af2297 위에 빈 tree의 일반 commit 3a0882d3804797208bb2271039f3086697aaa1aa를 만들고 정상 push했다. 새 작업 branch·force push·이력 초기화는 없다. PR https://github.com/sinsan-develop/Anvil/pull/40을 통해 main b4f9006e30e5afcf98ef8ef1f39707ecc8954feb에 merge 반영했다. 기본 branch 직접 개발·직접 commit은 하지 않았다.

반영 후 Git fetch와 ls-tree로 main의 파일0개 및 이전 main04430432의 ancestry 보존을 확인했다. 독립 GitHub 조회에서 같은 저장소 ID1356865616·이름·main·공개 상태 불변과 PR40 merged=true를 확인했다. 기존 작업 branch는 저장소의 원래 auto-delete-on-merge 설정에 따라 자동 삭제됐으며 직접 branch 삭제 명령은 실행하지 않았다. 로컬 최초 mirror·bundle·기존 자료와 새 설계는 그대로 보존한다. 원격에 새 설계·로컬 백업을 업로드하지 않았다.

준비 중 로컬 bare 복사 하위 프로세스의 sandbox 실패1은 동일 로컬 복사를 elevated로 수행해 해결했다. API 확인 중 commit SHA를 tree 경로에 사용한 404 1회와 실제 빈 tree 조회404 1회를 분리했다. API 실패를 PASS로 바꾸지 않고 commit API의 빈 tree 지문 및 반영된 Git 객체를 fetch해 파일0개를 검증했다. 제품 구현·빌드·기능 시험·서비스 배포는 수행하지 않았다. 마지막 남은 정리 예외는 권한 제한 .pytest_cache 1항목이며 ACL 변경·강제 삭제는 하지 않는다.

### 2026-10-15 기존 자료 보관과 정리

- 담당: 어울
- 사용자 지시: 새 작업에 필요한 자료만 남기고 기존 자료는 로컬 backup으로 보관. WSL Anvil 폴더는 삭제한다. 신산님이 이후 정확히 정정한 Git 범위는 sinsan-develop/Anvil 저장소 자체를 유지하고 안의 파일을 모두 삭제하는 것이다. 저장소 삭제·delete_repo 권한 추가 요청은 철회한다.
- 현행 자료: v3 설계 초안과 인터뷰 합의사항. 프로젝트·헌법·지식은 Anvil 소유, 실행 도구는 교체·해제 가능, 목표는 최소 손실 이전.
- 보관 위치: D:\Project\Anvil\Backup\Anvil\legacy-20261015-1420. 기존 소스·문서·미커밋/비추적 자료 등 로컬 최상위 69개 항목을 이동했다. 원본 AGENTS.md도 사본으로 보존했다. 다른 프로젝트 Backup은 변경하지 않았다.
- 로컬 Git: local-history.bundle의 완전한 이력과 94개 ref를 검증했다. 정리 전 원격의 remote.git mirror는 fsck --full exit0, main 0443043251d25aa77c17d23165b7c9299c8dbeb8 및 codex/u01-dashboard-r2 e0af2297c0bb164b065b36067b32bedf5022d983를 확인했다. 이 최초 백업은 파일 정리 후에도 덮어쓰지 않았다.
- WSL 보관: anvil-wsl.tar.gz, SHA256 F0EC72E3B3E809464EEDE2E50038C06CE3AE5AF46BAAF1A162093A0C230EF276, 4742개 항목. .git과 kernel.py/test_kernel_lifecycle.py의 수정 및 C-04 비추적 문서 포함을 확인했다.
- WSL 삭제: 정확한 /home/daon/deploy/anvil을 사용자·소유·실경로·HEAD·압축과 원본 동일성·열린 프로세스0·mount0 검증 후 삭제, exit0. 전송용 원격 압축도 제거했다. 로컬 원본 압축은 보존한다. /srv/anvil-wsl 서비스·DB·인증자료·공유 네트워크는 대상에서 제외했다.
- 최종 확인: 독립 SSH exit0에서 요청 폴더·전송용 압축 부재와 제외한 Web677a9ceb499e/API8bd8af7bfed0/OIDCe26676734bca의 같은 full ID/running=true를 확인했다. 현행 설계2문서는 carry-forward와 hash가 같고 원격 GitHub는 같은 ID로 존재함을 재확인했다.
- GitHub 보관: 저장소 메타데이터·39개 PR 목록과 본문·이슈/댓글·리뷰댓글·릴리스·브랜치·태그 JSON 8개를 보존했다. GitHub 전체 Actions 로그·산출물·설정의 완전한 복제라고 주장하지 않는다.
- 잘못된 저장소 삭제 시도: 담당자가 Git 정리 범위를 저장소 자체 삭제로 오해해 1회 실행했지만 delete_repo 토큰 권한 부족으로 HTTP403 거부됐다. 실제 저장소 삭제0·권한 확대0이다. 신산님 정정 이후 저장소 보존과 파일 삭제로 범위를 바로잡는다. 현재 공개 여부와 계정·저장소 설정은 변경하지 않는다.
- 오류와 조치: WSL 초기 사전 검사2회는 /proc 보호 프로세스 조회에서 중단돼 삭제0. 보호 대상 sd-pam 확인 후 정확 폴더의 관리자 lsof 읽기 조회로 실제 사용 여부를 검증한 뒤 삭제했다. 로컬 .pytest_cache 1항목은 권한 때문에 이동되지 않아 기존 위치에 남겼다. ACL·OS·서비스 권한을 변경하거나 재시도하지 않았다.
- 미완료: 권한 차단된 캐시1항목. GitHub 현재 파일 비우기는 위 최신 결과로 완료했으며 저장소 삭제는 요구사항이 아니다. 신규 상세 설계·상세 클릭형 시안·작업계획·실제 도구 연결·이전 검증은 아직 미완료다. 기존 제품 검증을 신규 제품 PASS로 승격하지 않는다.
- 문서 확인: 현행6문서 존재와 기존 주요8항목의 로컬 보관, 보관된 v2 원본 hash 일치를 확인했다. 전체 diff --check는 기존 사용자 변경 AGENTS.md의 Markdown 줄바꿈용 공백1줄을 지적해 exit2이며 원문을 임의 정정하지 않았다. 신규 문서 내용 확인과 구분하고 제품 시험으로 취급하지 않는다.
- 다음 조치: 로컬 백업과 비워진 원격 저장소를 보존하고 새 설계의 핵심 이전 시나리오와 화면을 구체화한다. 저장소 재생성·삭제 권한 추가 인증은 하지 않는다.

상세 보관 목록과 복구 근거는 Backup/Anvil/legacy-20261015-1420의 ARCHIVE_STATUS.md 및 local-archive-manifest.csv에 있다. 로컬 자료는 삭제한 WSL 폴더와 기존 소스를 복구·참조할 수 있는 원본이며 과거 GitHub 서비스 상태 전체의 무손실 복구를 뜻하지 않는다.
