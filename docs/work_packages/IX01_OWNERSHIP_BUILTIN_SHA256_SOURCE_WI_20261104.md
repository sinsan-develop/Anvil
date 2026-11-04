# IX01 ownership SHA256 의존 source 보완 지시서

2026-11-04 · SOURCE_ONLY · 실제 DB/확장/권한/QA 실행 제외

## 근거·판정
새 R5 승인 call_b4accb1d는 a1d2f7에서 소진됐다. 결과는0039/42883/FUNCTION digest/statementEndLine100·ddlFAILED·CLEANED이며82c265 별도조회에서 실행자원잔여0·감사보존이다. 0037 정의 설치와 원 membership 회수는 통과했으나 전체 설치/함수호출/IX01 성공이 아니다.

기존Primary 읽기와 Mainf0b511/ee4466은0039:99/250의 두 digest(bytea,'sha256')와 제공 선행 부재를 확인했다. 0017:312~313은 같은 canonical UTF8 bytes를 내장 sha256로 계산한다. 공식 PG15 binary string/pgcrypto 문서상 두 함수는 동일 binary bytes의 SHA256 bytea를 반환한다. 이 보완은 hash 입력/알고리즘/hex 표현을 바꾸지 않는 승인 계획 내 내부 호환성 수정이다. 제품 공개 API·auth/권한정책·원문canonical/nonce 계약 변경이 아니다.

근거: https://www.postgresql.org/docs/15/functions-binarystring.html , https://www.postgresql.org/docs/15/pgcrypto.html . 실제 PG 동등성·SQL 설치는 별도 미검증이며 문서/Node 합성으로 PASS 승격하지 않는다.

## 단일 writer·허용2경로
기존Primary만 다음을 수정한다. Main은 동시코드쓰기0·문서/Git·독립검수를 소유한다. 다른작업자 변경·보호untracked3·Backup을 되돌리지 않는다.
1. db/migrations/0039_ownership_authority.sql.pending (현재 raw CC5835077567D9108A909029FCBF5DFA69F110A0B947FDB5C078D12B6F7E2DA7)
2. tests/unit/FN06/ownership-sql-hash-source.test.ts 신규

0039는 source-only/미적용pending이며 과거 Git baseline0a647daa/R5 raw와 감사는 보존한다. 실제 정식 DB/적용 SQL/manifest·기존 index는 수정하지 않는다.

## 정확 보완
두 해시 호출만 다음으로 바꾼다.
- digest(convert_to(anvil.execution_authority_canonical(v),'UTF8'),'sha256') → pg_catalog.sha256(convert_to(anvil.execution_authority_canonical(v),'UTF8'))
- digest(decode(translate(report->>'nonce','-_','+/')||'=','base64'),'sha256') → pg_catalog.sha256(decode(translate(report->>'nonce','-_','+/')||'=','base64'))

기존 encode(...,'hex'), canonical UTF8, nonce translate/padding/decode·null/형식/기한/권한/비교/거절 guard,함수 signature·IMMUTABLE/STRICT·DDL/ACL/역할은 그대로다. 새 pgcrypto/함수/확장설치·search_path확대·동명함수fallback·임의 알고리즘변경0. 원 두 before표현이 각각1회인지 확인하고 바이트역치환 부모동일로 범위 밖 변경0을 증명한다. 줄끝/전체포맷을 재작성하지 않는다.

## 검증
수정 전 신규 source 의존검사로 내장함수 미사용을 RED로 재현한다. 두 함수의 원 bytea입력·hex/nonce조건·guard 보존을 확인하는 필요한 최소 구조검사와 기존 ownership-ledger-contract/ownership-observation-contract의 직접 회귀를 수행한다. Node 자체 해시를 두 번 비교하거나 SQL을 흉내 내는 가짜 interpreter로 PG 동등성을 주장하지 않는다. 실제 운영 SQL 실행 없이 source2만 검증한다.

원본과 diff/역치환/hash·신규 RED→GREEN·직접 회귀·필요 noEmit/diff 결과를 반환한다. source 검사만으로 PG syntax/함수해석/전체105·RLS/API/UI PASS를 주장하지 않는다. 중복 전수/무관한56harness 검사는 반복하지 않는다. 동일 근본오류3회면 중단·증거와 대안을 Main에 반환한다.

## 제외·후속
실제 DB·SQL/확장·role/권한·키·서비스·Agent·WSL/Docker·실자료·P03R3·새QA 실행0,Git/새branch/worktree/세션/자동화/외부메시지0.
제출에 정확 파일/bytes/hash·명령/exit/수량·오류횟수·미검증·writer반환/live0을 포함한다. Main 독립 인수 후 새 SQL 기준 commit/index/실행안 동결은 별도 후속작업이며 소진 R5 승인은 재사용하지 않는다. 전체계획 완료 아님.
