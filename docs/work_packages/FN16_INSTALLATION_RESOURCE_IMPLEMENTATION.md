# FN16 설치 자원·이식키 구현 지시서

2026-10-28 · Main 어울 · 승인된 source-only 전체 구현

## 기준·목표
신산님 직접 승인 3FAD0CE9 및 불변 계약5A6819E6 r2 전체를 구현한다. 후보의 NOT_ADOPTED는 승인전 이력이며 별도 승인기록이 현재 권위다. 기존 Stage B/282e2d15에서 단일 primary만 코드 작성, Main은 관리/검수/통합. 기존 R2 참조·반출/원문·보호자료 유지. 전체 백업 job/복원은 이번 계약 밖이고 실제 키/DB/서비스 실행은 직접 제외됐다.

## 순차 구현
1. 닫힌 DTO·portable envelope/UTF8/정규base64url·canonical AAD/hash, 고정 비동기 scrypt/AES-GCM 처리 및 메모리 합성 검증. codec만 전체 완료로 표시하지 않는다.
2. 슬롯 catalog/provider·intent/descriptor/lease·불변 이력/제한 counter·미적용0054. 기존 SQL/적용목록 불변. 실제 안전handle adapter가 없으면 실파일 사용은 UNCONFIGURED/UNVERIFIED로 차단하고 성공 stub 금지. 합성 포트와 실제OS검증을 구분한다.
3. 새 명령·승인 원소비1회·fulfill 원소비 귀속·현재 auth/control/policy·동시성/CAS·새routes/TLS/로그·FN17 연계. relock은 자기 exactgeneration 사용차단 먼저/DB감사실패도되돌리지않음.
4. UI14 슬롯/키등록·이식/보관확인·해제/재잠금·재포장/회전·상태재조회/승인복귀를 연결. Secret은 command/storage/buffer/로그에 남기지 않고 제출/이탈시 비움. TLS/로그 경계가입증되지않으면 Secret입력 UI 제공금지. 실제App 합성 정상/실패/ABA 검수.

## 허용 파일
동명 SOURCE_MANIFEST.json의 정확27경로만 코드/시험 작성. 제품21·시험6이며 기존13은 필요한 연결만. 추가로그아웃/권한회수 hook은 실제소비선과 최소diff를 먼저Main에제시해 허용경로를보완하며, 그대조와독립인첫블록은계속한다. 새계약/수치 변경은 금지한다.

## 검증 기준
- 각 블록은 시험을 먼저 작성하고 실제 실패를 보존한다. 최초 Main RED 확인 후 해당 제품 블록GO. 정상 흐름 및 중요한 실패를 직접검증하고 동일불변검사반복0. 독립검수 Critical/Important0 후 통합.
- 첫 블록은 독립literal wire/AAD/hash, RFC7914 scrypt벡터·GCM final오류의평문미사용, 과대KDF계산전거절·동시1/대기0·비밀번호Unicode/길이·외부오류누출0. Node24.22.1/OpenSSL3.5.9(win32 x64) 관측. 공식 Node24 crypto API와 RFC7914를대조한다. exact고정프로필의비용은공개합성fixture/메모리에서만유한측정하고키/비밀번호출력0. 운영성능/OS소거PASS아님.
- 나머지는계약§8 전항목을테스트에대응: 원승인1회/재전송0·귀속/CAS·20KiB·60s/5min·8/32/32·실패지속·UNKNOWN·relock/만료·R2reason코드보존·재시작잠금·파일DB비원자실패.
- tests/unit 직접·필요canonical/기존R2/FN17인접·typecheck만. UI변경후build와Main사전등록전용브라우저QA. SQL은미적용·정적/합성만, 실제DB/RLS/COMMIT·OS/TLS/실키/사용자인수NOT_RUN.

## 관리·보존
Primary는 source/test와 최종 docs/04_test_reports/AV3/FN16_INSTALLATION_RESOURCE_RESULT_20261028.md만 소유. Main은 승인/WI/manifest/WORK_STATUS/WORK_PLAN·Git. commit/push/PR/환경은Primary0. 동일근본정식실패3회시중지/인수규칙, 다른오류를합산하지않는다. Main이허용범위내후속블록을주도하며사용자재승인질문없이계속한다.

Rollback: 허용변경만 source revert; 기존키/자료/DB/원장삭제0. 범위밖 actual은 실행하지않는다.

## r2 기존 인증 폐기 연결
독립 읽기검토 결과 access/repository.ts 한 파일을 추가한다. logout은 검증된 자기session, reauthenticate는 옛session, changePassword/recover는 검증된actor의 lease를 DB/audit 완료를 기다리지 않고 차단한다. 기존 허용 project-command의 새 정책 저장 직전 project 무효화, projects/routes에서 같은 registry 주입/dispose를 연결한다. 진행중 KDF epoch도 무효화하고 기한 timer로 폐기한다. 현재 회원/제어 전환 mutator는 없으므로 새 권한변경 기능을 추가하지 않는다. 직접DB변경 즉시통지는 미보장·관측시소거와 구별한다. 동일26범위 테스트로 검수하며 실제키/DB/서비스0이다.

## r3 R2 참조 선택 실제 소비 연결
backup-reference-api.ts의 prepareBackupReference가 현재RETENTION만허용한다. 계약§6의검증된TARGET/KEY명시선택을위해 정확이파일을추가한다.현재slot/descriptor 검증·정확고정ref·copy확인등서버검사를유지하고 R2닫힌DTO/reasonCodes는변경하지않는다. 기존반출2와기존시험기준은보존한다.
