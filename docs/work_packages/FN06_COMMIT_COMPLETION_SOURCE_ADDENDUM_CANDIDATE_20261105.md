# FN06 공급 전 COMMIT 완료 응답 검산 보완 후보

- 상태: TECHNICAL_REVIEW_CANDIDATE / 제품 수정 전. 2026-11-05 Main 어울.
- 목적: 승인된 S5의 확정 COMMIT/Pool 반환 후 공급 조건을 기존 공통 트랜잭션 구현에서 충족한다. 새 로그인·권한·승인·공개 입력을 만들지 않는다.

## 1. 확인된 원인과 한정 재현
AccessRepository.#transaction은 BEGIN→body→COMMIT Promise await→동기 db.release→result.value 반환 순서지만 COMMIT 응답의 command를 검사하지 않는다. node_modules/@types/pg/index.d.ts:93~94의 QueryResultBase.command는 문자열이다.
Main77c9af는 실제 repository.ts를 메모리 Pool로 호출했다. COMMIT 응답 tag가 COMMIT/ROLLBACK/MISSING인 세 경우 모두 정상 반환·release1·후속 marker1이었다. ROLLBACK이면 후속 marker0이어야 한다는 단언이 exit1로 실패했다. 실제 DB·SQL 접속·외부 공급·계정·키·서비스 실행0, 새 제품/시험 파일 쓰기0이다. 이 메모리 모델은 실제 PG 여정 인수 증거가 아니다.
[PostgreSQL 15 공식 source utility.c](https://raw.githubusercontent.com/postgres/postgres/REL_15_STABLE/src/backend/tcop/utility.c)는 COMMIT 처리의 EndTransactionBlock 실패 시 ROLLBACK 완료 tag를 지정한다(605~611행). 따라서 COMMIT 호출의 정상 정착과 실제 COMMIT 완료는 구분해야 한다. 실제 DB에서 재현했다고 주장하지 않는다.

## 2. 정확한 추가 경로와 전후 차이
| 대상 | 시작 SHA256 | 변경 |
|---|---|---|
| apps/server/modules/access/repository.ts | 3DC7A52FE977245BAEEBF2FAAAD3D328E54188984035D0CE0E443A1468103052 | 기존 #transaction의 COMMIT 반환 command가 정확 COMMIT인지 확인한 뒤에만 committing=false와 정상 result 반환으로 진행 |
| tests/unit/FN01/auth-transaction.test.ts | 29476AECDEF6CCB4E615FF0B35CA2F67D11F8F909A921D733EA0B5CA121A28D0 | 기존 authenticateInTransaction5개는 보존하고 실제 AccessRepository.authenticated/#transaction의 완료 tag·실패·release 합성 반례 추가 |

개념 diff는 기존 await db.query('COMMIT')의 결과를 받아 command===COMMIT을 검사하는 것뿐이다. 불일치/누락/비정상 결과는 기존 TRANSACTION_STATE_UNKNOWN 보수적 오류 경계와 releaseError 처리를 사용하며, 새로운 성공·재시도·권한 상태/공개 DTO·오류 enum을 추가하지 않는다. BEGIN/body/기존 callback 실패·rollback·release 순서와 원 인증/CSRF/자격/기한/감사 검사는 유지한다. 다른 파일의 광범위 정리·fixture 통과용 기대 완화는 하지 않는다.

## 3. 대안과 영향
- A 권장: 기존 공통 #transaction의 실제 완료 tag를 검산한다. 단일 종료 지점의 잘못된 성공을 차단하며 정상 pg COMMIT 응답의 동작은 유지한다. 공통 메서드를 소비하는 인증/자료 흐름이 영향 범위이므로 직접 회귀를 확인한다.
- B: native 전용 strict opt-in 경로를 추가한다. 영향은 좁지만 별도 내부 API/분기와 중복 종료 계약이 필요하고 다른 공통 호출의 잘못된 성공은 남는다. 이번 최소 보완보다 범위가 크다.
- C: 공통 source를 보존하고 COMMIT 미검산을 미충족으로 남긴다. 독립 waiter 구현은 가능하지만 확정 COMMIT 뒤 공급 인수는 할 수 없다. 정상 Promise만을 근거로 PASS 처리하지 않는다.

A는 승인된 원자성/확정 뒤 공급의 내부 오류 보완이며 인증 방식·허용 사용자·권한 정책·신뢰·Secret·실제 DB를 변경하는 안이 아니다. 다만 기존 부모57 밖의 공통 소스1/기존 시험1이므로 Main이 기술 검토·PMO 지원에 정확 범위를 전달한 뒤 구현 통제에 추가한다. 이 후보만으로 실제 DB·권한·키·서비스·Agent·C#/J3/P03 R3·운영 실행을 허용하지 않는다.

## 4. 검수와 복구
- 실제 repository와 메모리 Pool에서 정상 COMMIT+release 뒤 결과1, ROLLBACK/누락/비정상 tag에서는 정상 결과·후속 공급 marker0을 RED→GREEN으로 확인한다.
- COMMIT reject·기존 callback/AuthFailure·rollback 실패·release throw에서 기존 보수적 오류/연결 반환과 후속 marker0을 보존한다. 새로운 Secret 값을 만들거나 출력하지 않는다.
- 원 FN06 fixture와 같은 authenticated 종료 의미를 대조하고, 미관측 query 실패의 정착·정상 완료 여부는 기존 허용 제품의 별도 직접 반례로 확인한다. 이 보완만으로 미관측 query의 의미적 성공/모든 callback 계약까지 증명하지 않는다.
- 타입/직접 영향 합성 회귀·diff·안정 지문·독립 C/I0 전 인수0이다. 실제 PG/Pool/TLS/운영 검증은 미실행으로 남긴다.
- 복구는 추가 소스1/시험1 한정 revert다. 과거 승인·검수·실패 기록·사용자 자료를 지우지 않는다.
