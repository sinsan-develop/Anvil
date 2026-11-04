# IX01 R7 정의 설치 진단 source 준비 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_NOT_RUN

## 판정·고정 기준

R7 source3은 namespace·SQL 기준·직전 R6 cwd/SQL 기준 거절 음성만 변경했다. 실행 code 41f037571dfa256e903f422785883d2b228df07d와 SQL sourceHead 7adc72b43063c875120124c7c3828633c55c35c7를 구분한다. 후행 문서 commit을 실행 code로 대체하지 않는다. 전체 IX01/계획 완료가 아니다.

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|35588|1558e08f74f6fd0742c47d5f3b1268607e561f8bb4e2d4e1730d341ba12d3580|
|tests/unit/IX01/schema-closure-controller.test.ts|49206|6225e88c78cc8433a850dd4f4d703db3b4f2f484e5d4d855555ef812183bf060|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R7.tsv|15981|5c70d5b2b1478b01e3e496f90c7829a8a1c00b7f8a39bfc692badbcb06dc43ef|

## SQL 변경·기존 로직 보존

R6 SQL69bd 대비0069의 원 alias/wrapper224~227과 REVOKE/GRANT442~443 두 블록만 scope 정의/ACL 뒤·quota_account 앞에 원문 그대로 이동했다. 함수 본문/signature/security/search_path·정책/guard/ACL·역할·선택 순서는 불변이다. SQL0069 raw SHA256 5BF84DADB59BAAE5FD258FED2DEE030155193A26D4904121488A5E631F326F92/130509B이며 크기 변화0·역이동 부모398A6774 raw 동일이다. 기존0039 내장SHA256 보완은 그대로 보존한다.

provider owner 준비·0037 원자Tx·role metadata·권한·기한·UNKNOWN·회수·격리는 R6 및 R5와 동일하다. R7 index는 header baseline과0069 hash만 변경했고 다른105행은 동일하다. 표시106/명시105/2376143B/order 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef이다.

## 서로 다른 검증 분모

- 부모 provider source: Primary ba8bea56PASS/skip0/1056.8243ms·e4985a noEmit0; Main5de96f fresh56PASS/1094.703ms. 기존 증거이며 재실행하지 않았다.
- 0069 순서 보완: Primary3a35cf 순서RED1→f40ca7 schema/versions/resources50PASS/skip0/5716.9251ms;898c9c noEmit0. b17c30 역이동/ACL/원문 보존 검산은 source 증거이며 실제 PG GREEN이 아니다. 타입 준비 명령의 -p 누락1회(a3f497)는898c9c에서 실제 tsconfig.base.json으로 정정했다.
- R7 source3:65eb54 직접3PASS/skip0/519.7572ms;35ca7b Bash-n exit0; driver/test 역치환 부모 raw 동일 및 index header/0069 hash 두 필드 외 동일. f7b65f index·합계·원문0069·후행공백 검산 exit0.
- Main42af3e는106 Git blob·역치환을 독립 검산했고 dda56b 변경음성1PASS/141.5312ms를 확인했다. 부모56/noEmit·0069의50개·R7직접3/Main1은 서로 다른 분모이며 합쳐 전체 인수 PASS로 표시하지 않는다.
- R7 준비 오류:ad6e1b 읽기 검산기의 UTF-8 미지정/cp949 decode 오류1회는 f7b65f UTF-8 지정으로 정정했다. 제품 실패가 아니다.

직접3 명령:
```text
node --test --test-name-pattern='R7는 과거|0037선택만|actual controller→bootstrap' tests/unit/IX01/schema-closure-controller.test.ts
```
Bash 명령:
```text
& 'C:/Program Files/Git/bin/bash.exe' --noprofile --norc -n scripts/qa-ix01-schema-closure.sh
```
타입 구조 불변으로 기존 noEmit을 재사용했고 이번 namespace 갱신에서 재실행하지 않았다.

## 실제 과거·미검증·반환

R6 실제 slot1은 code43530093/SQL69bd에서0069_environment_configuration.sql.pending 정의 설치가 SQLSTATE42883/FUNCTION anvil.environment_approval_scope/statementEndLine227로 FAILED/CLEANED였다. 오류 원문 전체는 미수집이므로 직접 원인행·메시지를 확정하지 않는다. Main c07b3e는2026-11-04T00:52:23.435Z 별도 exactfullID/name/source 부재와 감사3 보존을 확인했다. 원R5의 최종PID1·0037 원자 정의 설치/회원 회수 통과 및0039 FAILED·잔여0도 보존하며, 원R4 FAILED·R3 UNKNOWN·R1/R2 실패를 소급 변경하지 않는다.

R7는 NOT_APPROVED/자원 생성0·시각 발급0이다. 실제 PG/SQL·ACL/RLS·DB/권한/키·WSL/Docker·서비스·Agent/P03R3·API/UI/IX01·사용자인수는 NOT_RUN이다. 문서2만 신규 작성했으며 product/test/index/WORK_STATUS/Git·기존 감사/packet/보호3은 변경하지 않았다. writer 반환/live0. rollback은 R7 source3만 부모와 대조하고 기존 감사·소진 이력을 보존한다.
