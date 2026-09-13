# C-09 R4 검증 계약

checker, seq814 tests, R3/R2/C08 회귀, compile/diff, seq1~806 raw/canonical, frozen product18/index를 검증한다.
staged control11+frozen18, sole-child+frozen18, 명시 ACTIVE_R4 exact18, detached exact control clean을 구분한다.
authority/ref/tree/status/raw/token/review/event/JSON tamper는 fail-closed. feature clean은 preservation loss로 거부한다.
trusted previous_mode ACTIVE_R4 뒤 FROZEN_R3는 거부하며 stateless CLI 영속 관측은 주장하지 않는다.
fresh clone ignored 비의존. 실제 clone/commit/runtime/배포는 미실행이며 pure fixture를 실제 운영 PASS로 승격하지 않는다.
