# C-21 Final Acceptance Projection Reconciliation — seq699

The approved evidence projection records `MAIN_PACKAGE_ACCEPTED`, `accepted=true`, zero blockers, `C-01=READY_FOR_WORK_INSTRUCTION`, and `DIR-2=NOT_REACHED`.

The deployed product source is `7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`; record/development reference is `2db9eff352d32d60638ae9bf7c9dae153c862be8`. The checker fails closed unless the source is its sole direct parent and ancestor.

Historical completed evidence supplies image digest, OCI revision, one `anvil-web` on port 3770, live/ready migration 0013, nine-provider GET read API, authenticated Dashboard/Provider browser, initial SSE and exact `Last-Event-ID` resume, and secret/filesystem residue 0.

Network boundary: the historical R11 receipt records authenticated UI/API/SSE results separately (Provider GET-only, writes 0, cross-origin 0, initial SSE true, exact reconnect true). The current successor records only static source evidence: CSP `connect-src 'self'` and browser-source absolute-host scan 0; it does not invent a new Network receipt.

External Provider probe and actual Telegram invocation remain `USER_OWNED_NOT_EXECUTED`.

## Tooling verification and review boundary

- Historical fixture RED `FileNotFoundError` for untracked sibling `.superpowers/.../seq496-c21-independent-judgment.md` was removed by embedding the exact 5,779-byte historical source in `tests/tooling/test_project_progress.py`; its required SHA-256 remains `67B7D70633DECA23FD5716EA7902AE30FB043AD082AC55B4DA4459C825D66460`. The seven related tests are GREEN (`7 passed in 61.38s`); no fixture file was added outside the approved path set.
- The seq513 Provider-status historical test no longer mixes the seq699 live repository projection into its frozen bundle. Focused verification is GREEN (`1 passed in 6.98s`).
- The apparent seq533 CPU hang was a runner boundary: restricted execution denied `D:\tmp` mkdir while `os.access` reported writable, causing Windows `tempfile.mkdtemp` name retries. With the approved writable temp execution, the exact node is GREEN (`1 passed in 0.48s`) and its 52-node partition is GREEN (`52 passed in 254.04s`). No source/test workaround or skip was applied for this environment issue.
- Full tooling one-shot completed with `2 failed, 669 passed in 950.42s`. The seq699-related failure showed that its specialized Git collector omitted the historical `GIT_VALIDATED_BASE_NOT_ANCESTOR` error for a mutated projected base. A minimal fail-closed check restored that contract; focused GREEN is `1 passed in 3.16s`, and the seq699 exact class is `3 passed in 4.83s`.
- The remaining A14 failure was ruled an approved test-integrity repair. The scanner no longer treats the bare DOM identifier `container` as an internal address. `fetch(READY_PATH)` is accepted only when the scanned source set contains exactly one root-relative declaration excluding `//` and `://`; unresolved, protocol-relative, and absolute values still fail closed. `A-14_A14_SUCCESSOR_R6.json` additively binds the committed-clean scanner/test bytes to the preserved R5 registry and historical manifest.

The approved seq699 set is exact15: the original 12 paths plus only `scripts/check_a14_workbench_prototype.py`, `tests/tooling/test_a14_workbench_prototype.py`, and `docs/evidence/manifests/A-14_A14_SUCCESSOR_R6.json`. Its Git gate accepts only dirty exact15 at record HEAD `2db9eff` before commit or a clean sole direct child whose changed paths are exact15 after commit.

Precommit verification is GREEN: A14 module + seq699 class + historical Git regression `16 passed in 20.21s`, app-shell `3 passed`, live checker `PASS sequence=699`, deterministic two-build/live equality, seq1~698 byte prefix, 14-row non-self manifest, exact15 path set, direct-parent/ancestor, and `git diff --check` all pass. Exact15 path hashes are Windows `D06C8F4158A914042DA3C0688BC5829D7B6F2D94DDEDFEF18F27AEC6FD7B336E` and ordinal `DE7B86332907781913506C1C74B2066EAA4EAF74EAF00378866FA587803D4187`.

Verdict: `PRECOMMIT_GATES_PASSED_COMMIT_PENDING`. Final acceptance remains pending the single exact15 commit and post-commit A14/full-tooling/live-checker verification.

The first post-commit A14 standalone run exposed an R6 selection-order defect: the tracked-clean R6 registry was valid, but older A15/B03 rows applied afterward and overrode it, producing ten checksum failures. R6 is now applied as the final committed-clean successor and binds the unchanged current A14 live ten-path set plus the repaired scanner/test to the preserved R5 registry and historical manifest. Coverage RED was `1 failed in 3.75s`; focused GREEN is `3 passed in 3.50s`. The unpublished commit will be amended so the required topology remains one exact15 sole-direct-child commit.

After the R6 final-selection repair, post-commit A14 standalone passed (`paths=17 self_reference=false`), full tooling passed (`675 passed in 1012.49s`), live checker passed at sequence 699, and the worktree was clean. These results supersede the earlier `669 passed, 2 failed` run.

Fix round 1/5 corrected the fresh range-diff finding `new blank line at EOF` in this report. Only this report, WORK_STATUS evidence, and their deterministic generated5 checksum bindings changed; scanner/checker/test logic is unchanged from the 675-test GREEN run. Fresh range diff, seq699 focused, A14 standalone, live checker, and clean sole-child exact15 gates are rerun after the same single commit is amended.

This intermediate `DONE` wording is superseded by the review-fix rounds below and is not final acceptance evidence by itself.

## Review fix round 1/5 — canonical state, A14 parser, private authority

Review base `ab5c03afc695af03d836c79a735d8e9baabffca2` reproduced three seq699 contract failures (`3 failed in 3.45s`): canonical `next_work_package` remained blocked, the success projection omitted `C-21` from `completed_packages`, and the collector did not execute the new private-authority/range-specific whitespace predicates. The review-base A14 scanner returned no finding for all three adversarial sources (`[[], [], []]`): a block-comment declaration, a function-parameter shadow, and `'/\\x2fexample.invalid/ready'`.

The seq699 builder now projects both canonical next-package fields to `C-01 / READY_FOR_WORK_INSTRUCTION` and appends `C-21` to `completed_packages`. Projection validation emits `C21_FINAL_ACCEPTANCE_CANONICAL_STATE_INVALID` if any of those three assertions contradicts acceptance. The Git collector verifies the exact development URL plus the exact full `for-each-ref` row for `refs/remotes/development/candidates/c21-wsl-acceptance-auth-r1 -> 2db9eff...`; URL/ref lookup failure, mismatch, or contaminated multi-row output returns `GIT_PRIVATE_AUTHORITY_MISMATCH`. Precommit uses `git diff --cached --check`; postcommit uses `git diff --check 2db9eff..HEAD`.

The A14 scanner now masks comments and string/template contents, accepts only one literal, top-level, single-slash root-relative `READY_PATH` declaration without escapes, requires each identifier fetch to have a same-file canonical declaration or exact named import, and rejects any remaining identifier occurrence as scope ambiguity. The new reviewer cases and unbound cross-file use are fail-closed. Focused GREEN is `18 passed in 15.30s`; direct A14 adversarial/safe tests passed, current browser-source findings are `[]`, and app-shell remains `3 passed` (only the existing module-type warning).

One unescaped diagnostic command failed before execution because PowerShell split its inline Python text; it was corrected with a literal here-string and changed no files. Two initially restricted A14 runs hit the already-diagnosed `D:\tmp` write boundary; only the four owned test PIDs were terminated and residue was confirmed `0`, then the approved temp-write execution passed.

Round 1 ended on a clean exact15 sole direct child of `2db9eff...`. Its postcommit verification passed: focused A14/seq699/historical Git `18 passed in 14.24s`; A14 standalone `PASS paths=17 self_reference=false`; live checker `PASS sequence=699 reporting=AUTO_CONTINUE`; generated5 two-build/live equality and seq1~698 raw prefix preservation; exact development URL/ref; ancestor/sole-parent; and `git diff --check 2db9eff..HEAD`. The report deliberately does not embed a mutable final commit SHA.

The round-1 logic-change full tooling one-shot passed with `677 passed in 954.99s (0:15:54)`, exit 0 and failure marker 0. Documentation/generated-hash rebinding was followed by focused, A14 standalone, live checker, generated equality, exact15 topology, authority, range diff, and clean-status verification on the then-current HEAD.

## Review fix round 2/5 — final repository semantics and scope-safe READY_PATH parsing

The current-head builder reproduced stale repository semantics: `head_relation=PRECOMMIT_EXACT12_SUCCESSOR_PROJECTION` and `worktree_status=SEQ698_R11_RESULT_EXACT12_DIRTY`. New builder/assertion tests were RED (`2 failed in 5.46s`). The projection now uses symbolic, non-self-referential final semantics `POSTCOMMIT_EXACT15_SOLE_DIRECT_CHILD_OF_RECORD` and `CLEAN`; its validator adds `C21_FINAL_ACCEPTANCE_CANONICAL_STATE_INVALID` for either stale value as well as the existing next-package/completed-package contradictions.

The prior scanner reproduced both independent-review bypasses (`2 failed in 2.78s`): a nested declaration appeared top-level because `/}/` corrupted raw brace counting, and a shadowed protocol-relative declaration/use disappeared inside template interpolation. The root cause was lexical masking that treated all template content as inert and did not recognize regex literals. The replacement conservative tokenizer masks comments, quoted strings, regex bodies, and template text while recursively retaining `${...}` code; it tracks valid brace depth, fails closed on malformed/ambiguous structure, and keeps the exact top-level declaration/named-import/use allowlist. R6 was rebound to the updated scanner/test bytes. Focused A14 plus seq699 is GREEN (`19 passed in 16.14s`).

Round-2 postcommit verification on the current HEAD passed: A14/seq699/historical Git focused `20 passed in 16.55s`; A14 standalone `PASS paths=17 self_reference=false`; live checker `PASS sequence=699 reporting=AUTO_CONTINUE`; app-shell `3 passed`; generated5 two-build/live equality; seq1~698 raw prefix; exact15 sole-parent/ancestor/range; development URL/ref; A14 R5 preservation; clean status; and range diff-check. The required fresh full tooling one-shot passed with `679 passed in 967.03s (0:16:07)`, exit 0 and failure marker 0. This evidence is bound to the symbolic current exact15 HEAD and intentionally omits a self-referential commit SHA.

## Review fix round 3/5 — Main Agent takeover and fail-closed slash ambiguity

Independent review found a third consecutive scope-analysis bypass: regex character classes after control-statement parentheses could balance structural braces and make a nested `READY_PATH` declaration appear top-level. The exact regression was captured first and failed (`1 failed in 4.38s`). Under the three-repeat rule, `developer-primary` was stopped and Main Agent took the write lease; no new branch or worktree was created.

The scanner remains deliberately narrower than a general JavaScript parser. When a source contains `READY_PATH`, any slash that survives comment/string/template/recognized-regex masking makes structural inference ambiguous and is rejected. This closes both unrecognized regex and division-context guesses while preserving the canonical declaration/import/fetch files, which contain no unmasked slash. The complete A14 contract suite then passed (`14 passed in 10.20s`). The R6 registry is rebound to the scanner and regression-test bytes; Provider and Telegram external actions remain `USER_OWNED_NOT_EXECUTED`.

The scanner-bearing postcommit passed the focused A14/seq699 set (`20 passed in 17.56s`), A14 standalone (`PASS paths=17 self_reference=false`), live progress checker (`PASS sequence=699 reporting=AUTO_CONTINUE`), app-shell (`3 passed`), and the fresh full tooling one-shot (`680 passed in 1071.45s (0:17:51)`, exit 0). Final evidence uses the symbolic current exact15 HEAD plus range/authority/clean predicates; a mutable self-referential final SHA is intentionally excluded. Verdict: `MAIN_PACKAGE_ACCEPTED`; C-01 status: `READY_FOR_WORK_INSTRUCTION`.
