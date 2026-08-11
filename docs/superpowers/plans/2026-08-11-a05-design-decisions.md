# A-05 Design Decision Implementation Plan

> **For developer-primary-a05:** Execute the approved WorkInstruction test-first. Do not implement runtime APIs, events, or browser UI.

**Goal:** Deliver a fail-closed static Proposal Compare, Decision Board, and Design Baseline contract.

**Architecture:** A machine-readable catalog is the source of truth, bound to three Markdown contracts and two 1920×1080 SVG specimens. A Python checker and hostile fixtures verify human-decision, hash, lineage, carryover, immutability, permissions, and static/runtime boundaries.

**Tech Stack:** JSON, Markdown, SVG, Python unittest.

---

### Task 1: Bind contract and predecessors
- [ ] Bind authority and A-01~A-04 accepted hashes.
- [ ] Record AV-FLOW-001 staged verdict and runtime owners.
- [ ] Freeze allowed/forbidden paths.

### Task 2: RED tests
- [ ] Add missing-artifact RED.
- [ ] Add proposal/decision/baseline hostile mutations.
- [ ] Add manifest invocation and integrity traps.

### Task 3: Static artifacts and checker
- [ ] Create catalog, three Markdown specs, and two SVG specimens.
- [ ] Implement exact fields, states, edges, permissions, human/hash guards, lineage/carryover, immutable baseline checks.
- [ ] Emit stable reason codes.

### Task 4: Evidence and completion
- [ ] Create validation, evidence manifest, completion report.
- [ ] Run focused tests/checker and A-01~A-04/project/G07/Phase-G regressions.
- [ ] Verify JSON/SVG, raw/target/self-reference, predecessor immutability, exact diff, diff-check.
- [ ] Record runtime/API/DB/event/browser/deploy as NOT_EXECUTED.

### Task 5: Main and Tester
- [ ] Main revokes leases and materializes TEST_REVIEW.
- [ ] Independent Tester performs fresh hostile verification.
- [ ] Resolve blocking findings or accept A-05 and set A-06 READY.
