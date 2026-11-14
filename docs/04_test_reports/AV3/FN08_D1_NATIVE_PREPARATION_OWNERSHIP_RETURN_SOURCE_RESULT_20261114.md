# FN08 준비 결과 ownership 반환 source 검수 — 2026-11-14

## 판정

승인된 source·미적용 SQL·합성 검증 묶음을 검수했다. FN06/FN08 전체 기능과 작업계획서는 미완료다. 실제 앱 DB 호출 경로와 retained process·등록 키의 실제 host 공급자는 연결되지 않았다. 이 결과는 실제 Agent 실행이나 사용자 사용 가능 판정이 아니다.

- 계획: 채택 P3 §3.1 단계3, 최초 준비 결과의 관측 반환.
- 승인: 반환 A안 원문 SHA256 CFF94F6704B91556A0DBBD21353F5F2D29A8CA0F4340E3C0413A7841B849EFA4; anchor 정정 A안 원문 SHA256 6BF3B5F2734F5F365674E9AC895D226B1EC3359336504F7D5A41728A7ECE95CA.
- 기준 main: 8922562ba1b63354042e3b326ebc5e40ca02e25c. 작업 branch: codex/av3-d1-ownership-binding, 구현 시작 HEAD e8ae0f812bfd130f9d58878008c0f577e3c5b48a.
- 담당: developer_primary 단일 코드 writer; Main 어울 검증·기록·통합; d2_scope_audit 독립 읽기 검수.

## 변경과 보존

제품·미적용 SQL 17경로와 시험 7경로. 명시 v2 authority에 RETURN operation을 추가하고 v1 발급 기본값·기존 서명 bytes를 보존했다. 원 HUMAN 준비·consume·attempt에 결박한 request/result 형상, 제한 두 route, 서버 저장계획·거래 저장소, 실행기 HTTPS/원 journal·ticket 연결을 추가했다. native source는 원 factory의 retained 객체만 읽고 원 승인 receipt·등록·process·facts를 검산해 기존 ownership 도메인으로만 서명한다.

0092는 새 native binding/result 및 anchor의 닫힌 부모 XOR/FK·완결 검사를 정의한다. 기존 migration은 수정하지 않았고 기존 unconditional deny·RLS false·app REVOKE를 유지한다. 따라서 현재 app Pool의 raw SQL 실행 가능성을 구현 완료로 주장하지 않는다. 실제 역할/보호 저장 진입점 계약은 후속 결정 대상이다.

정상 합성 종단은 observation/head/receipt 수용까지다. PREPARED 또는 ACTIVE head를 writer OWNED/osFence VERIFIED_CURRENT/grant/current/resume로 승격하지 않는다. 실제 owned host에서 retained process와 등록 키를 함께 공급하는 연결은 미완료다.

## Main 직접 검증

아래 결과는 서로 중복되는 범위를 포함하며 합산한 전체 시험 수가 아니다.

| 명령/범위 | 결과 |
|---|---|
| node --test --test-reporter=spec --test-name-pattern="v2\|RETURN issuer" tests/unit/FN06/native-preparation-ownership-return-contract.test.ts tests/unit/FN06/native-preparation-store.test.ts | 7P/0F/0SKIP, 3079.6697ms, exit0 |
| native anchor/result 계약 필터 | 실제 계약 2개 통과. 이름 불일치 다른 파일 wrapper는 검증 수에서 제외 |
| node --test --test-reporter=spec tests/unit/FN06/native-preparation-ownership-return.test.ts | 3P/0F/0SKIP, 295.9558ms, exit0 |
| node --test --test-reporter=spec --test-name-pattern="RETURN 실제 HUMAN" tests/unit/FN06/native-preparation-store.test.ts, 최종 route 음성 보완 후 | 1P/0F/0SKIP, 3290.719ms, exit0 |
| node --test --test-reporter=spec tests/unit/FN06/native-preparation-ownership-return-store.test.ts | 3P/0F/0SKIP, 266.4074ms, exit0 |
| node --test --test-reporter=spec tests/unit/FN06/native-preparation-ownership-return-client.test.ts tests/unit/FN06/native-preparation-https.test.ts tests/unit/FN06/native-preparation-ownership-return-sql.test.ts | 19P/0F/0SKIP, 557.1111ms, exit0 |
| 새 client/channel·동일 journal 반례 집중 | 1P/0F/0SKIP, 410.1763ms, exit0 |
| native 정적 + 기존 native-preparation-proof-signer.test.ts | 15P/0F/0SKIP, 880.1144ms, exit0 |
| node --test --test-reporter=spec tests/unit/FN06/native-preparation-ownership-return-native.test.ts, authorizationReceipt 보완 후 | 2P/0F/0SKIP, 173.7293ms, exit0 |
| TypeScript tsc --noEmit -p tsconfig.base.json | exit0, 9.426579s |
| git diff --check | exit0 |

서버 여정은 실제 제품 처리 코드를 사용하지만 DB·basis·retained process는 RAM 대역이다. TLS header 검사는 실제 TLS 연결 시험이 아니다. SQL 검사는 정적 원문 대조이며 실제 PG 구문·동시성 검증이 아니다. C# 시험은 source 정적 검사이며 컴파일·CNG·OS 실행이 아니다.

## 검수와 오류 이력

독립 검수에서 operations 배열 변조, Proxy 검사/반환 불일치, issuer getter, 공용 SQL trigger의 없는 NEW 필드 접근, native authorizationReceipt fullref 누락을 찾아 보완했다. 각 보완 재검토에서 미해결 Critical/Important 0을 확인했다. 재시작 시험은 새 client/channel이 실제 journal.read/current에 도달하고 추가 HTTP 효과·factory·sign·close를 만들지 않도록 보강했다.

등록 ref의 version1 강제 오류는 기존 양의 버전 계약과 맞게 교정했다. malformed body의 503 지적은 기존 선행 parse→400 처리를 놓친 검수 오독으로 철회됐다. 실패·정정은 WORK_STATUS에 보존한다. 기존 proof helper는 internal 접근성 변경 외 본문 동등 대조를 수행했다.

## 미검증·다음 작업·복구

- 실제 DB 적용·권한/키·서비스·Agent·native C# 실행: 사용자 제외 범위로 미실행.
- 앱 역할의 제한 DB 저장 진입점, 실제 retained/key host 공급자, 최초 grant의 실행 전 OS fence 의미와 공급자: 미완료. 합성 PASS로 대체하지 않는다.
- source 단위 통합 후 위 미완료와 독립 가능한 계획 항목을 계속한다. WORK_CHECK의 전체 완료 체크는 올리지 않는다.
- 실제 환경 변경과 임시 OS/DB 자원 생성은 하지 않았다. 공유 의존성과 기존 작업은 보존했다.
- 복구: 이 source 묶음의 일반 revert. 기존 v1 기록·기존 migration·서명 이력은 변경하지 않았다. force/history rewrite를 사용하지 않는다.
