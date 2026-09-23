# C-09 Main takeover WorkInstruction

WI-C-09-MAIN-TAKEOVER-001. executor main-agent-eoul.
R4 동일 snapshot spec C2/I8/M1 및 quality C0/I11/M0를 failure3으로 한 번만 수락한다. epoch3 write 후 worker lease를 폐기하고 epoch4 dual lease로 Main이 순차 인수한다.
기능 범위, 요구사항, 중요 위험은 UNCHANGED이고 APPROVAL-20260814-WORKPLAN-V16-001 binding을 유지한다.
제품 exact18 raw map SHA-256 6AE618D40896B16A0AD69BFBEDFBB900F9B2E22F9FEDD9DF8750F5C2C77B58AF를 frozen input으로 사용한다.
C-09 REWORK_MAIN_TAKEOVER, C-10 NOT_READY, DIR-2 NOT_REACHED를 유지하며 actual Docker/WSL/external은 실행하지 않는다.

## Corrective axes
1. `C09-MT-DOCKER-SCOPE-ENVELOPE`
2. `C09-MT-TRUSTED-MANIFEST-VERIFIER`
3. `C09-MT-FULL-OWNER-IDENTITY`
4. `C09-MT-NONMAPPING-INGRESS-AUDIT`
5. `C09-MT-PER-SESSION-PERMISSION-RESERVATION`
6. `C09-MT-WORKSPACE-RETAINED-FENCE`
7. `C09-MT-OUTPUT-SCHEMA-TERMINALIZATION`
8. `C09-MT-CANONICAL-RECEIPT-LINKAGE`
9. `C09-MT-EARLY-CUMULATIVE-BOUNDS`
10. `C09-MT-PUBLIC-ORPHAN-RECOVERY`
11. `C09-MT-CANCEL-BEFORE-IO-FENCE`
12. `C09-MT-REVOKE-BEFORE-IO-TERMINALIZATION`
13. `C09-MT-DOCKER-PER-HANDLE-CORRELATION`
14. `C09-MT-REQUEST-ID-UNIQUENESS`
15. `C09-MT-PHYSICAL-HOSTILE-EVIDENCE-HONESTY`

각 축을 deterministic hostile RED→GREEN과 authoritative suite로 닫고 R4/R3/R2/C08 회귀를 유지한다. terminal/audit/receipt, cumulative bound, concurrency/lock/revoke/destroy fence와 digest/orphan/path evidence를 실제 결과로 기록한다.
제품 완료 전 acceptance를 주장하지 않는다. rollback은 제품 exact18을 보존한 채 successor control exact14만 정상 unstage/revert한다.
