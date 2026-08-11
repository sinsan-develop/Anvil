# A-08 Completion·Validation·Release 정적 계약

A-08은 Completion Summary/Plan-vs-Actual, Technical Test, ProductValidation, Defect Board, Release Decision을 정적 계약으로 확정한다.

- assigned: AV-UI-008, AV-UI-009, AV-FLOW-025 static slice
- verdict: STATIC_CONTRACT_PASS
- actual L4/L5/L7, MI/AE/E-SHOT/E-EVT/E-DEC, API/DB/browser/release: NOT_EXECUTED
- AV-FLOW-025 runtime owner remains E-09

필수 분리: Developer result, Main preliminary accept, independent technical verification, criterion-level ProductValidation, DefectAssessment, authenticated human ReleaseDecision, Apply/Deploy eligibility.

Technical results exact PASS/FAIL/SKIPPED/BLOCKED/ERROR; non-executed/static/mock/build is never functional PASS. ProductValidation exact SUITABLE/NEEDS_IMPROVEMENT/UNSUITABLE/BLOCKED per required criterion and target/delivered hash. Defect state OPEN→ACCEPTED→FIXING→READY_FOR_RETEST→CLOSED with DEFERRED/REJECTED only by Owner; Developer cannot close and same-target independent retest is required. Release decisions exact RELEASE/REWORK/DEFER/REJECT and final actor is authenticated human.

Required PV incomplete/BLOCKED/UNSUITABLE or open blocking defect disables RELEASE, Apply and Deploy. Hash change invalidates PV/release/approval. REWORK pauses and revises WI; DEFER requires reason/risk/review/carryover; REJECT prohibits downstream actions. Package ACCEPTED is not product RELEASE.

Create catalog, focused Markdown, 1920×1080 static SVGs, checker/test/fixtures, validation, evidence manifest, completion report. Hostile checks cover result promotion, criterion removal, hash/evidence reuse, defect downgrade/lifecycle/retest, human actor, release guards, rework/defer/reject, permissions, static qualifier, secrets and manifest integrity. No runtime/product code or actual release.
