# P03 R3 고정 대상 source 결박 — Main 내부 범위 채택

2026-10-31 / Main 어울 / MAIN_INTERNAL_SOURCE_SCOPE_ADOPTION

## 근거와 판정
- 신산님은 승인된 작업계획의 구현·시험·필수 개발을 재승인 없이 진행하고 Main이 완료 책임을 소유하라고 직접 지시했다. 최신 전역 지침은 계획 내 DB schema/migration/지속 데이터를 계획 승인에 포함하고, 계획 밖 변경·인증/권한/Secret·파괴/외부비용 등 별도 경계를 유지한다.
- 관측한 전역 AGENTS SHA75FDE3424F3BD62AA88DEEDEA9D7AB82ED2EC02ABFF233C1B7E14A975373714B, PMO AGENTS SHA599C0EFB37EFD1F77BC53AA1AFE4D506DBF0F42E2A086D565A1C712CA2B3FF97. 이 관측은 파일 권한/내용을 바꾸는 승인이 아니다.
- PMO chat 01a054f5-c2b4-7af0-b31a-c8148ef74642 cursor68의 현재 대조는 R3 source의 별도 직접 금지를 찾지 못했고 과거 대기가 메시지 전달 차단이었다고 확인했다. 고정 대상6/candidateSHA의5파일 source 보완을 기존 승인계획 내부 개발로 판단하며 재승인 질문이 필요하지 않다는 지원을 수신했다.
- Main도 이를 기존 P03의 내부 고정 결박 정합으로 분류한다. 공개 API/데이터/protocol/schema·권한·위험/한도 변경이 아니라 같은 제한 복제의 source 대상 정합이다. 새로운 신산님 actual 승인이나 소진 권한의 부활을 발급하지 않는다.

## 정확 source 범위
- 대상 후보: docs/contracts/P03_PG_COPY_LIMITED_RISK_R3_BINDING_CANDIDATE_20261028.md SHA256 94BB0D36438873994003F062A9C18ABC378E9C2382A7D617C45EE411141F0092. 후보의 source-only literal6/기존제품2·시험3 부분만 후속 WI의 기준으로 채택한다. 후보 전체와 actual 실행을 채택한 것이 아니다.
- sourceRoot /home/daon/anvil-v3-pgcopy-20261028-r3-src
- ledgerRoot /home/daon/.local/share/anvil-v3-pgcopy-20261028-r3
- copyVolume anvil-v3-pgdata-recovery-20261028-r3
- toolsName anvil-v3-pgcopy-tools-20261028-r3
- initName anvil-v3-pgcopy-init-20261028-r3
- copyName anvil-v3-pgcopy-20261028-r3
- 허용5: scripts/p03-pg-copy-host.ts, scripts/pg-recovery-copy.sh, tests/unit/P03/pg-recovery-copy-host.test.ts, tests/unit/P03/pg-recovery-copy-docker-time.test.ts, tests/unit/P03/pg-recovery-copy-preparation.test.ts.
- 기존 protocol/policy/mode/closed keys·소비/nonce/fence·시간/created-started/tmpfs·원본RO/사본RW/NoCopy·정상정리/불명보존·위험4/공간한도는 변경하지 않는다. 과거 R1/R2가 첫 mutation/consume 전에 거절되는 반례를 보존한다.

## 실제 실행은 제외
- 등록 PG 대상 부재는 Main e6ef07의 metadata 읽기 사실이며 새 R3 자원의 부재·owner/link/공간 확인은 아직 아니다.
- 실제 source checkout/원격 준비·grant/nonce/issuedAt/expiresAt·volume/helper·copy/cp·신호·PG/SQL·권한·Secret·서비스·Agent 실행0. 소진된 R1/R2 승인/원장/사본을 비우거나 재사용하지 않는다.
- 새 exact actual packet/실행 승인 전 실행0이며 이 문서로 위험 수락·권한 또는 새 자원 생성 허가를 발급하지 않는다. source 합성 PASS를 실제 Linux/Docker/복제·PG/IX01·전체계획 완료로 표시하지 않는다.
- TEST_ONLY → Main fresh 실제 RED/제품2 불변 확인 → PRODUCT_GO → 독립 검수/필요 집중 회귀 → Main 통합 순서. Main은 Primary의 source5 수정 동안 동일코드를 수정하지 않는다.

## 신산님 직접 후속 지시 수신
PMO의 trusted codex_delegation으로 다음 최신 직접 지시를 실제 수신했다: ‘그래, R3 source 보완은 재승인 없이 진행하도록 Anvil Main에 전달해. 실제 복구 실행은 별도 승인으로 유지해.’
정확 대상은 후보94BB0D36에 명시된 literal6/candidateSHA 및 위5파일 source 정합이다. 기존 담당자 구현/Main 검수·통합, 기존 보호/위험/한도와 실제 actual packet/grant·nonce/자원생성·복제·PG기동 제외를 함께 전달받았다. FN16 PRINCIPAL_LINK B 미답변 채택 질문과 별개다. 이 직접 source 진행 지시를 actual 승인으로 바꾸지 않는다.
