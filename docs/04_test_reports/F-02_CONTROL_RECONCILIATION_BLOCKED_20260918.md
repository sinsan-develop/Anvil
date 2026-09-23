# F-02 control reconciliation — BLOCKED

## 판정

`BLOCKED_CONTROL_PROJECTION / product mutation 0`.

F-02 developer report is `COMPLETED`; independent review result is `ACCEPT / C0 / I0 / M0` (focused 55 PASS, related 664 PASS, 4 DB skips). 그러나 canonical progress seq1195에는 F-02 active worker/write lease가 남아 있고 `active_work_instruction=E-11`, `last_event_id=evt_e11_package_started` 등 서로 다른 projection이 혼재한다.

## 확인된 사실

- F-02 write lease: `write-lease-f02-r1-20260918-001`
- F-02 worker lease: `worker-lease-f02-r1-20260918-001`
- execution fence: `f02-r1-execution-fence-epoch-1-98e218264bf54db0`
- write fence: `f02-r1-write-fence-epoch-1-4a1bd35a67273b71`
- 기존 F-02 product scope·HEAD·history는 보존 대상이다.
- `check_project_progress.py`는 branch/upstream/path/dirty projection 불일치로 fail-closed했다.

## 조치 및 제한

F-02 acceptance/revoke event를 임의로 추가하지 않았다. seq1~1195 raw history와 기존 dirty/untracked를 보호했으며 C-22 RED·제품 mutation·외부 호출은 0이다. C-22는 F-02 control reconciliation과 새 dual lease 발급 전까지 시작하지 않는다.

## 다음 안전 조치

Main이 F-02 `PACKAGE_COMPLETED → INDEPENDENT_TEST_JUDGMENT_RECORDED → WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → MAIN_PACKAGE_ACCEPTED`를 append-only로 기록하고, build-progress/HANDOFF/digest/checker projection을 같은 successor snapshot으로 재결박한 뒤 C-22 control을 발급한다.
