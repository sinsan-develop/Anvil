# FN15 문서 가져오기·선택 source 검수 — 2026-11-03

판정: 기존 승인 범위 source5의 한정 검수. 전체 FN15/일반9op·실제 DB·사용자 인수는 미완료다.

- 기준 branch codex/av3-stage-b, 부모4d517f4e11d5dd10b71c07f63ac1facfdb34cfb0.
- 실행 부록 docs/work_packages/FN15_IMPORT_SELECTION_SQL_FORWARD_SOURCE_20261103.md r2 SHA39ADDF15490B7A70C3C5C0FCE0EABB354BB563C239DA99BDE448B9B646B8D545. 부모 준비92E5145A…/상위 WI r7 SHA15700DB2F63FFB6DE3F248B22142F76FBFF1B58AE30BC090EB08FAB610BDBE3F의 U4 내부 상세다.
- 기존 Primary 한 명이 정확5를 구현·반환했고 Main이 독립 검수했다. 다른 코드/공개 API/테이블/role·실제 권한 변경은 없다.

## 실제 연결·보존

Node private 목적context와 SQL 고정 helper에 importDocument만 추가했다. 원 인증 session/credential·DB/actor/client/control·원 command/hash·고정 purpose/상한·물리 grant/정책/receipt 검산은 유지한다.

기존 ProjectDocuments/메모리 Artifact reader/파서에서 후보 저장과 명시 save 선택을 소비한다. READY/FAILED/UNSUPPORTED 원후보 보존을 유지하고 READY만 선택한다. 실제 원문 보관소·파일·DB는 읽지 않았다.

최종0072의 guard_document_import_write를0073으로 forward했다. regular membership에서 원 OWNER 또는 정확 HE/import/save-purpose만 허용하며 기존 COLLECT·등록/보호source·Owner/invoker·원Artifact/form/document/version 검산은 불변이다. membership delta 역치환 시 최종0072 함수 전체 및 COLLECT 구간이 정확 동일하다.

새 import/save 승인 producer는 만들지 않았다. 해당 정책이 REQUIRE_APPROVAL일 때 미지원 경로는 계속 차단된다. 타사용자 HE 정책 생산도 미채택이며 유효한 기존 명시 정책의 합성 조건을 정상 생산 경로로 승격하지 않는다.

## 검증

| 수행 | 증거·한계 |
|---|---|
| Primaryf36f51 | 최종 forward 부재 정적 RED1. 상대 Store 경로는 준비오류로 구분. |
| Primarydd5157 | actual Repo→ProjectDocuments.import→메모리 Artifact reader→receipt→INSERT에서 목적context0≠1 행동 RED. 실제 FS/DB0. |
| Primary95b5d7 | 위 반례2 GREEN. |
| Primaryec624d | 최종 직접2파일23PASS/FAIL0/SKIP0,887.7104ms/exit0. 신규 import 시험6, 내부 반복 조건을 독립 시험으로 더하지 않음. |
| Primary57ac56 | root TypeScript noEmit exit0. 중간 TS2345/TS2322는 시험 overload·고정 literal 조립 준비오류로 정정. |
| Maindc973c | 동결5 지문·실제 차분·diffcheck 대조. |
| Maind6f985 | 직접2파일 독립23PASS/FAIL0/SKIP0,682.7742ms/exit0. 공유 helper 변경이 영향받는 기존 문서 경로를 포함한 최소 인접 검증. FN01/UI·전체 회귀 반복0. |
| Main58d228 | 실제 persistProjectReceipt의 artifactRef/targetId/version:null 생산과 SQL 소비 필드를 읽기 대조. |

실행:
```powershell
node --test --test-concurrency=1 tests/unit/FN15/control-source-integration.test.ts tests/unit/FN15/control-acceptance-schema.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

정상 후보→명시 READY 선택, 실패/미지원 후보 보존·선택 거절, 다른 project/file/hash/form·원Artifact 누락·DENY·회수 grant/옛 client/세대, context의 다른 DB/session/원요청 변조·중복/종료 뒤 재사용과 Owner 원3GUC를 확인했다. 실제 클래스 호출이지만 DB/reader는 합성 모델이다. 정적 SQL PASS를 실제 PG/RLS/ACL/경합 집행으로 주장하지 않는다.

진행 중 type session28617은 새로 실행하지 않고 원 handle로 수거했다. 이후57ac56 최종type0/본인 exec완료·live0가 제출됐다. 동일 근본 정식 보정 실패3회는 없다. 생성 자원0·commit/push와 현황 쓰기는 Main이 소유한다.

## 지문·미확인·복구

0073 raw SHA256 5FDDA30C3AB3987064C3C5778F4A58FF7166B33074A455E1341A3900D6A001A1,156034B/CRLF0·service checksum 일치·COMMIT1. Git 필터 전후 blob a22766b843b25ad6aba10a8fffeda6f4c486cb41. 옛0072 SHA E561CDADB1BC68E426B6CD8D62417822B549756263463F252A9B032493706B06은 불변이다.

| 상대 경로 | SHA256 |
|---|---|
| apps/server/modules/access/project-command.ts | F20F7835EA7CDEFBFC0CF18D3ACA785749C6B796156AA055C46FF3F5BF7720D1 |
| db/migrations/0073_control_handoff_acceptance.sql.pending | 5FDDA30C3AB3987064C3C5778F4A58FF7166B33074A455E1341A3900D6A001A1 |
| apps/server/modules/control-handoff/control-acceptance.ts | 800D66F8488E9556CF7080BEF36369D8235BEDF0FF92727A9C1684C3481A6634 |
| tests/unit/FN15/control-source-integration.test.ts | F0932B1D9F05BA37F756B47CA816E1F679017538D911E9411E5F2C97E8795C80 |
| tests/unit/FN15/control-acceptance-schema.test.ts | 010FBBA26570B437492CE9EACF586F44161B59F7507BD89D1A65E31A648FA708 |

검토 구간의 추가 미해결 Critical/Important는 없다. 실제 PG·RLS·ACL·경합·원문 보관소·키·권한/정책/회원·서비스·Agent·OS·제품 네트워크·served·실자료/사용자 인수는 NOT_RUN/실효과0이다. 이 source 검수로 실제 사용 가능·전체 계획 완료를 주장하지 않는다.

후속은 detach 및 기존 지원 approval SQL chain·등록/보호 source 권위를 실제 호출선에 따라 분리한다. 새 계약이 필요한 부분은 미채택으로 남긴다. rollback은 정확5 source의 정상 revert이며 적용하지 않은 DB를 복구했다고 하지 않는다. 보호3·FN01 source/기존 자료·main은 보존한다.
