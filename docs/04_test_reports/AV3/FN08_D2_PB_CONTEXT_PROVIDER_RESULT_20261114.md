# D2 P-B 실행 grant 맥락 공급자 source 검수

상태: source·합성 검증 완료 후보, 통합 전. 실제 DB·Agent·전체 FN08 완료 보고가 아니다.

## 기준과 변경

- base: PR99 `41790410ea63f4a1887cda9b191eeebabfa98b26`.
- branch: `codex/av3-d2-grant-context-provider`.
- WI: `docs/work_packages/FN08_D2_GRANT_BOUND_CONTEXT_READ_WI_20261113.md` §6 P-B, SHA256 `259FBB49C917E881F6FBD12B664DF4F5291273B22E43F457D96795F44A128EDE`.
- 구현: 기존 `developer_primary` 단일 writer. Main 문서·검수·통합, 분리된 read-only 소스/시험 검수.
- 제품 5파일: 신규 `normal-start-context-source.ts`, `app.ts`, `context/read-access.ts`, `context/project-contexts.ts`, `context/context-sources.ts`.
- 시험 4파일: 신규 provider 시험·fixture, 기존 context-read-access·normal-start-materials-journey. 미적용 SQL 추가도 없다.

## 동작

공급자는 자기 pool의 REPEATABLE READ READ ONLY 거래에서 등록 grant·원 START·자료·실행/credential 세대·기한·회수·등록·보관 여부를 검산한다. 기존 0083 조회 함수를 재사용하며 회원 조회·행 잠금·DML을 하지 않는다. `SET LOCAL statement_timeout`은 이 거래에만 적용되는 설정이다.

검산 이후에만 모듈 내부 표식을 발급한다. 표식은 동일 DB·프로젝트·정확한 등록 맥락 묶음과 거래 수명에 결박된다. 실제 ProjectContexts/ProjectContextSources의 고정 구현으로 재구성한 후 기존 startContextBody를 사용해 등록 길이/hash를 다시 확인한다. 성공도 ROLLBACK으로 종료한다. 취소/늦은 연결/조회/rollback 실패는 합성 시험으로 확인했다.

공개 HUMAN 읽기와 자료 GET의 두 번째 권위 거래는 유지한다. 회원 해지 후 provider 단독 성공은 전체 GET 허용을 뜻하지 않는다. app의 명시 옵션으로만 조립하며 main 서비스 활성화는 없다.

## 검증 증거

Main의 최종 제품 지문 검증 시 명령:

```text
node --experimental-test-module-mocks --test --test-reporter=spec tests/unit/FN08/normal-start-context-source.test.ts tests/unit/FN08/context-read-access.test.ts tests/unit/FN08/normal-start-materials-journey.test.ts
node C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil/node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

- 영향 시험: exit0, 71 PASS / 0 FAIL / 0 SKIP, 15226.8479ms. provider50·접근7·자료여정14.
- typecheck·diff: exit0. 기존 전체 실패군은 재실행/수정하지 않았고 전체 suite PASS라고 보고하지 않는다.
- 구현자 RED→GREEN: provider 부재1F→정상 bytes1P, reader 교체 I1 5F→5P. 보완 중 TDZ1회·시험 타입 오류1회는 수정 후 확인. 동일 근본 원인 정식 실패3회는 발생하지 않았다.
- 신규 provider 최종 제품 SHA256: `461E2DD7C32CBBB8503125F28C932AF60BCC2CFE2361945D4B44706EA95DFA08`.
- 마지막 시험-only 보강: `node --experimental-test-module-mocks --test tests/unit/FN08/context-read-access.test.ts`, 구현자 exit0/8P/0F/0S/5835.067ms. downstream core 부재의 실제 공급자 경로 도달·정확412·rollback/release를 추가했다. 이 8건은 앞선 71건과 겹치므로 79개 독립 시험으로 합산하지 않는다. 최종 파일 SHA `5D8AE93A1FAE407586F4D36C95DBB6E1D19F7B8A8001DF8DEDB2D6D9DC5AA077`.

## 독립 검수와 한계

- source: 최초 C0/I1/M0 → I1 실제 reader/prototype 고정·옵션 교체 거절과 TDZ 수정 → 최종 C0/I0/M0. bigint 반환은 SQL `::int`로 명확히 했다.
- 시험: 최초 C0/I0/M3 중 downstream grantCore 부재 직접 시험을 보강했다. 소비 완료된 승인 불일치의 grant 전체 여정은 미검증이다(기존 HUMAN412와 grant 승인 core PENDING 조회는 서로 다른 증거). 일부 변조 시험은 앞선 hash 거절로도 통과하므로 각각의 독립 비교 분기 도달을 증명했다고 하지 않는다.
- SQL fixture는 JOIN/함수/READ ONLY·잠금을 실제 PG에서 실행하지 않는다. 실제 PostgreSQL 설치·RLS·경합·연결 취소 동작은 미검증이다.
- 여정은 제품 provider를 wrapper로 주입한다. app registeredContext 옵션의 positive GET 전체 연결은 별도 미검증이며 route 존재·중복 옵션 거절만 확인했다.
- 실제 DB·권한·키·서비스·Agent·native compile·SSH 변경0. 임시 runtime 자원 생성0.

## 복구와 다음

통합 후 필요하면 이 P-B commit을 일반 revert한다. 과거 dirty worktree·사용자 자료·공유 node_modules는 건드리지 않는다. 다음은 D1 실행기 수신→permit→관측 연결 source이며, 0083~0090 실제 적용과 실제 Agent 시험은 별도 실행 범위다.
