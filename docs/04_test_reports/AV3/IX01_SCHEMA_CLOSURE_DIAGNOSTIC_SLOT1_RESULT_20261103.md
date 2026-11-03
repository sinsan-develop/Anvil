# IX01 새 빈 PG 정의 설치 단발 진단 결과
2026-11-03 · Main 어울

판정: **ACTUAL_DDL_FAILED / QA_CLEANED / IX01_NOT_COMPLETED**. 실제 실행한 최초 정의 설치에서 오류를 확인했으며 전체 기능·환경 복구·인수 완료가 아니다.

## 승인·고정 분모
- 직접승인 call_be5aa1ea2d9f40ceab16ba27ebefcb5a: 실행안 r4 SHA2D99172BC0155D9943884FC45FA978CF01E6082C0C4F11FB24A2E32521FAACB3, 신규 slot1 단1회. 승인 관측14:16:25Z/전체 deadline14:46:25Z, 재실행/slot2~3 허가0. 이번 허가는 소진됐다.
- code c84bdad14b1888281be2ee116031d573f9016193, SQL baseline d2f6ab8c74fad09f26319f77b3acb80afe3f927b, driver4750BAD4·indexDC8B5FC0·명시105 order09d2e7d5를 실제 Git checkout/지문으로 확인했다. 실행안·원SQL/guard를 현장에서 수정하지 않았다.
- planHash434efc6d0a972bc4e57c2909c986a6165e679772d7fef106fbd98cab574168be, slotExpiresAt14:33:45.584Z. owner/intent/result 원장3은 아래 원문 SHA로 보존한다.

## 실행·실패 사실
- cb413f 생성 전: SSH WSL-server/daon UID1000/SINSAN, 등록Node e32e2d16·0:0/0755/126879696B, daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e/SINSAN, cachePG image594290e9/declaredVOLUME1 일치. 두 신규 경로/QA 이름 부재.
- 946273→소유48066/cfade6→f5bd93 exit0: private Git으로 신규 source에 exactc84/clean·UID1000·driver/index 지문 확인. 서비스 배포·npm/의존성 설치0.
- b777c0→소유31253/86d064 exit1: 신규PG ID40be86571cc247b2681d5b2ac17e3d0173e45200f6a670c62c41c7cc2ca8f0c0, anvil-ix01-ddl-pg-20261103-r1-a1/빈 합성 DB에서 고정 SQL 순서의67번째 **db/migrations/0035_work_plan_draft_approval.sql** 정의 설치가 **DDL_REJECTED / SQLSTATE22P02**로 명확 거절됐다. 관측14:23:54.558Z. 후속38파일 실행0이며105 전체 설치 성공0이다.
- diagnostic:null이며 원 psql stderr/실패 행·구체 오류 문장은 수집·보존하지 않았다. SQLSTATE만으로 정확 원인/JSON 오류 문구를 만들어 보고하지 않는다. 앞66 source 호출이 반환된 사실도 함수 runtime/RLS/서비스/여정 통과가 아니다.
- 새 cluster pristine→installer/역할·멤버십 metadata 통과, installer CREATEROLE true→정착 후 false를 확인했다. app은 NOSUPERUSER/NOCREATEROLE/NOBYPASSRLS 유지, systemHash db45d2b43a1646fb5fb8f4140ea5e983b7d8b81aac408fec98a77b6b57129c81 불변. reader 생성 단계0066/0073은 미도달이다.
- bootstrap SHA496caf4e72938b8129b8b52354afc7c0a8c8db8f2c39ed598716247b758ece8c, 실제 회수 SHA8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5. 원장 roleEvidence의 before/after 원문hash와 속성을 따른다. 기존 cluster/사용자 권한 변경0이다.

## 정리·보존
- 도구 결과 cleanup CLEANED/status CLEANED는 DDL PASS가 아니다. e268e4 14:26:28Z 별도 SSH에서 exact fullID/등록QA이름0·원장 소유/지문·동일plan을 독립 확인했다.
- 37561b 14:29:05Z 새 source 경로의 owner/realpath/nonlink·exactGit/clean·driver 지문과 source cwd사용 프로세스 관측0을 검산한 뒤 정확 새 경로만 정리했다.
- **74adbd 14:30:17Z 별도 확인: source 부재·exactID 부재·등록QA 이름0.** 새 QA의 tmpfs는 컨테이너와 회수됐으며 bind/named/anonymous volume 사용0은 동결 도구의 실제 소유 검산 조건을 따른다. 정식 DB/원 volume/기존 서비스·키·Agent/P03R3·ysna/Oracle 변경0이다.
- 의도 보존: /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261103-r1 의0700 원장/빈docker-config와0600 원장3. 감사 보존을 QA 실행 자원 잔여0과 구분한다. 새로운 실행/슬롯은 없다.

| 보존 원문 | SHA256 | bytes |
|---|---|---:|
| [owner](IX01/DDL_SLOT1_OWNER_20261103.json) | 001fb71f68e051a9560535910bfc572783d345495ffb50a8fab26bcfec40a8c7 |199|
| [intent](IX01/DDL_SLOT1_INTENT_20261103.json) | 852f76712e3855b468294c73c24a1ea8bd3f2a07fa414aa754c7a62d309bd592 |414|
| [result](IX01/DDL_SLOT1_RESULT_20261103.json) | 9b270091117e2008386124df2003b082fcb5872c4efa940c26016acec1640df1 |3332|

## 분류·후속
- 0035 정의 설치 거절은 최신 기능 연결을 막는 현재 오류이며 클라우드 정밀 검증으로 미루지 않는다. 실제 인수·RLS·API/화면·Agent 실행·IX01 여정은 NOT_RUN이다.
- 기존 Primary의 한정 읽기는0035:155의 JSON추출 뒤 -ARRAY 적용에서 괄호 누락을 유력 후보로 확인했다. PG15 우선순위상 -가 JSON연산자보다 먼저 결합하므로 원 의도와 다르다는 정적 근거가 있다. 다만 원실패행/문장이 없으므로 이번22P02 직접 원인으로 확정하지 않는다. [PG15 연산자 우선순위](https://www.postgresql.org/docs/15/sql-syntax-lexical.html#SQL-PRECEDENCE).
- 0035 source 현재 SHAF6B3F1ACEA0A590DBEC86994EDE796E9661BCF058715B8DBDC6E60AF21C8F1CA. 최초8954a774부터 표현이 있고5278be5d는 다른 순환검사만 추가했다. 주석/WI/현황은 미적용·PG미검증, 기존실제FN10 builder는0035제외이며 과거적용성공근거는 확인하지 못했다. 이것을 모든 환경 미적용의 보장으로 과장하지 않는다.
- 다음은 미적용 후보의 원의도를 유지하는 한 표현 source-only 보완이다. 원d2/Git/이번FAILED와 원장 바이트는 보존한다. 이미 적용된 증거가 발견되면 기존 migration 수정안을 중단하고 보존·대체 경계를 재판단한다.
- 기존 focused semantic unit·diff는 실제 PG GREEN을 대신하지 않는다. 실제 수정 후 설치/원인 대조는 별도 새 exact 실행 승인 전 NOT_RUN으로 유지한다. 승인 소진된r1/다음slot/동일SQL 재실행0, guard/기대값 완화0이다.
