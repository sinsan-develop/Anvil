# UI09 준비기록 당시 한도 정책 조회 연결

기준 main68b1fdde9ab7baf201905655aca63bb25706ff85. 기존 FN14 준비기록 A안과 한도 정책 고정 GET 소비 범위이며 새 API·권한·현재 예산 권위를 추가하지 않는다. 기존Primary 단일writer/Main문서·검수·통합.

## 정확 허용2경로
- apps/web/src/features/transfers/TransferPreparationRecordPanel.tsx
- tests/unit/UI09/preparation-record-ui.test.ts

## 동작
검산된 준비기록의 nonnull budgetRef에 명시 '당시 저장된 한도 정책 보기'를 제공한다. 기존 readLimitPolicy의 프로젝트/fullref/body 검산을 사용한다. 당시 저장 정책의 상태·한도·결정/만료 정보를 기존 형상대로 읽기전용 표시한다. 현재 가용예산·재개허가·실행허가가 아님을 화면에서 구분한다. null은 참조없음/GET0, 자동조회0, usage/최신head조회0, POST/저장버퍼변경0.

원record/fullref·budgetRef·요청sequence·현재주체/프로젝트/client/transport를 결박한다. 기록교체/닫기/unmount/주체전환 뒤 늦은200/401은 버리고 A→B→A 재방문도 이전요청을수용하지 않는다. 해시불일치/403은 본문표시0, 현재401만 기존authlost 호출. 기존 동작을 보존하며 별도공통화/신규종속성0.

## 검증
기존 실제React RAM fixture·Vite configFile:false/envDir:false/write:false 사용. 핵심 RED→GREEN과 명시클릭/정확고정GET 양성, null GET0, 같은id/version 다른유효hash본문거절, 지연닫기/교체/주체·ABA와늦은401폐기, 오류표시·POST0. 영향회귀 limit-policy-api 및 typecheck/diff/정확지문·미검증·live0 보고. 실제브라우저/DB/권한/키/자료조사/서비스/SDK/Agent/백업실행0. 추가파일/의미필요시쓰기전Main에반환.
