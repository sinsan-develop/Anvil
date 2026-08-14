# B-03 A13 Inner Clone Portability Validation R3

- baseline: `0f1ebb0686c2524fe6df9c1ba560e0c76cf7eeb3`
- WorkInstruction SHA-256: `A15F078F729361D486064AB44234B5D2CC41FB1C40A1EFFB09A0F4EF184F8CB7`
- source Tester report SHA-256: `D41F9D21BF3C92D6BD6C2FDEBDB80C2504E63745103D8655C78DC4F9A978E1C5`
- execution/write lease: epoch 3, exact 5

## TDD evidence

Hostile process configuration (`core.autocrlf=true`, `core.eol=native`) 아래에서 inner clone의 local config가 비어 있음을 focused test로 재현했다. RED는 exit 1이며 `(1, '') != (0, 'false')`였다.

최소 수정은 A13 test helper의 `git clone`에 clone-local `core.autocrlf=false`, `core.eol=lf`를 지정한 것이다. 같은 hostile test는 exit 0, `1/1 PASS`로 전환했다. 이 설정은 checkout 이전에 clone local config에 기록되므로 host/system Git 설정과 무관하게 LF raw bytes를 만든다.

최종 A13 focused는 `24/24 PASS` (exit 0)다. full tooling은 독립 회귀 test를 기존 R3 projection test에 통합한 뒤 `276/282 PASS` (exit 1)였다. 6 failures는 모두 frozen R3 start successor와 current exact5 dirty projection의 동일 경계이며 `B03_R3_START_SUCCESSOR_INVALID`, `GIT_DESCENDANT_WORKTREE_DIRTY`, `PRG_REFERENCED_HASH_MISMATCH`로 분류했다.

## Boundary

R2의 actual service, same-origin browser, L4 E-SHOT 3개와 L7 E-EVT bytes는 변경하지 않았고 runtime/browser를 재실행하지 않았다. 제품/API/UI/provider/DB/WSL/production/deployment는 R3 범위가 아니다.
