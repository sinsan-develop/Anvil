# FN06 HUMAN 능력 보고 보관 r2 — 결정용 후보 검토

판정: 최초 C0/I1/M0 → 최소 보완 후 한정 C0/I0/M0. 이는 채택/구현/실제 저장 권한 판정이 아니다.

대상 docs/work_packages/FN06_CAPABILITY_REPORT_HUMAN_STORAGE_CANDIDATE_R2.md 최종 SHA6546808480650288302FB6AAF674AE35D7A72744E2C85A693D6BB13AA2E6B7F8, 부모 FN06_CAPABILITY_REPORT_PERSISTENCE_PROPOSAL.md SHA3AE123551CB1CE2D437F538578993F39E8ED150BBE33F3A273818D8798BF5C81 불변이다.

원 I1은 자유 문자열의 well-formed만으로는 JSONB에 보관 불가능한 U+0000을 허용한다는 점이다. 기존 candidate-input.ts:20의 금지 제어문자 범위·422·원주장 자동 정규화/삭제0·허용 TAB/LF/CR 보존을33행에 명시했다. 기존21행의 정확 ISO밀리초Z/실제 파싱/toISOString 동일성도 고정했다. 최초 검토 SHA796E4A26과 보정 SHA를 구분하며 제품·SQL 실행0이다.

독립 검토자는 원주장 claim/서버 UNVERIFIED·CANDIDATE_ONLY 분리가 기존 자료형을 그대로 구현한 것이 아닌 새 delta임을 확인했다. 신규 operation/고정GET/DDL/한도/UI는 채택 대상이다. 실제 replay전 재인증·현재 PK/FK·anvil_v3_app 역할·기존 canonical/내장sha256 source는 대조했지만 실제 PostgreSQL·권한 동작 검증을 수행하지 않았다.

최종 후보를 정확 범위로 PMO에 제출했다. DRAFT_NOT_ADOPTED·채택전 제품/SQL파일·정본계약개정0을 유지한다. 기존 사람 질문을 복제하거나 침묵/문서 존재를 승인으로 간주하지 않는다. 실제DB/정책·rolegrant·credential/probe/native/Agent/서비스·비용·실PG는 이번 source·합성 범위에서 제외다.
