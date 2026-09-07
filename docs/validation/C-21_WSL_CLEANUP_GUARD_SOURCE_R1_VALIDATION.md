# C-21 WSL cleanup guard source R1 validation

- TDD RED: real guard second source returned readonly-variable failure before Docker inventory.
- TDD GREEN: one guard source, two `validate_wsl_candidate_manifest` calls, inventory reached, and only the approved cleanup allowlist is eligible for deletion.
- Negative fixture contracts cover invalid manifest, second validation failure, label mismatch and unrelated endpoint with mutation count zero.
- External runtime verification is `NOT_EXECUTED`.

## Reviewer fix round 1

- The stored regression executes the real `cleanup.sh` entrypoint and real readonly guard. Only runtime state/image and Docker/stat boundaries are fixture adapters; `validate_wsl_candidate_manifest` is never replaced.
- Success observes guard source `1`, validation `2`, environment load `1`, then Docker volume/network inventory. First validation failure observes validation `1`, environment/inventory/mutation `0`. Second validation failure observes validation `2`, environment load `1`, inventory/mutation `0`.
- A historical duplicate-source fixture executes the real guard twice and reproduces the readonly-variable failure after entry validation/environment load but before inventory.
- Seq554 builder fixtures read every non-generated input from immutable commit `797b4d831e384423fdd9a706f9512ffa9dc79bb5`, not the current worktree.
- Reviewer full deploy was `107 passed, 2 skipped`, exit `0`; pre-fix full tooling was `198 passed, 2 failed`, exit `1`. Fix focused tooling was `4 passed`; real cleanup focused was `4 passed`.
- After the first direct-child amend made the worktree clean, the live checker passed at sequence 560 and full tooling passed `202` tests in `637.37s`, exit `0`.
