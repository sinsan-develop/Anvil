# C3 SEND permit 역방향 검사 검토 근거

- 작성: Main 어울, 2026-10-19. PMO 요청에 따른 **미적용 문서 후보**다.
- 기준: P1 D071CC6A, Git 600ad9f7c273ba159ccc44bc8d4983cb9692cf52.
- 기존 SQL·실DB·trigger·함수·권한 변경0. 아래 diff는 실행 가능한 migration으로 배치하지 않는다.

## 1. 실제 소스와 소유·권한 확인 범위

저장소 루트 기준 `db/migrations/0018_execution_observation.sql:448~460` 원문을 읽었다.
파일 SHA256: `547DEBDE0FA13F24401DDCF538A8A178147D5C9BCB60863B634A798B4BB896E5`.
Git blob: `6b5db588fd0ece0eb322d1e0ba6159dd490bcd24`. 기존0018·0021의 현재 diff는0이다.

```sql
CREATE FUNCTION anvil.guard_execution_permit_proof_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r anvil.execution_receipts%ROWTYPE;c anvil.execution_challenges%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='execution_receipts' THEN r=NEW;SELECT * INTO c FROM anvil.execution_challenges WHERE project_id=r.project_id AND id=r.challenge_id AND version=2;
 ELSE IF NEW.version<>2 THEN RETURN NULL;END IF;c=NEW;SELECT * INTO r FROM anvil.execution_receipts WHERE project_id=c.project_id AND challenge_id=c.id AND grant_id=c.grant_id AND grant_version=c.grant_version;END IF;
 IF c.snapshot_json->'request'->'target'->>'path' ~ '/commands/[^/]+/permit$' AND NOT EXISTS(
  SELECT 1 FROM anvil.execution_start_permits p WHERE p.project_id=r.project_id AND p.proof_result_id=r.id AND p.proof_result_version=r.version
   AND p.snapshot_json->'proofRef'=jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash)
   AND c.snapshot_json->'consumption'->'resultRef'=p.snapshot_json->'proofRef') THEN RAISE EXCEPTION 'EXECUTION_PERMIT_PROOF_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER execution_permit_proof_complete_receipt AFTER INSERT ON anvil.execution_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_permit_proof_complete();
CREATE CONSTRAINT TRIGGER execution_permit_proof_complete_consumption AFTER INSERT ON anvil.execution_challenges DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_permit_proof_complete();
```

소스상 함수 schema는 `anvil`, trigger 대상은 receipts와 challenges다. 둘 다 AFTER INSERT/행 단위/COMMIT 시 지연 검사를 유지한다. 함수에 SECURITY DEFINER나 ALTER OWNER는 없다. 소스의 `anvil_v3_app` 권한은 receipts/challenges에 SELECT(27줄), INSERT(225줄), UPDATE/DELETE 회수(28줄)이며 START표도 SELECT/INSERT만 허용하고 UPDATE/DELETE는 회수한다(376~377/445줄).

**실제 설치 DB의 pg_proc.proowner/proacl·pg_trigger 상태·테이블 owner는 이번에 조회하지 않았다.** 소스의 CREATE 주체를 실제 owner로 추측하지 않는다. PMO의 요청은 source-only 근거이며 실제 DB 접속/권한 조작으로 확대하지 않았다. 실제 owner/ACL 검증은 새 승인 범위를 갖춘 actual QA에서 별도 수행해야 한다.

## 2. 미적용 변경 전후

변경 전에는 명령 종류를 보지 않고 모든 permit 경로가 START표의 기존 proof에 역결박돼야 한다. 따라서 SEND 전용표를 새로 만들어도 nonce/result만의 COMMIT과 마찬가지로 거절된다.

권장 후보는 다음 **구조적 문서 diff**다. 새 함수의 완전한 SQL·구문/COMMIT 적합성을 검증한 코드가 아니다. PMO 판단 전에는 기존 함수 교체 파일을 작성·적용하지 않는다.

```diff
 DECLARE r ...; c ...;
+-- 추가 지역값: stored_command, command_count, stored_operation.
 -- 기존 receipt/challenge 쌍 선택은 그대로 유지.
-IF permit_path AND NOT EXISTS(original_start_binding) THEN reject; END IF;
+IF permit_path THEN
+  -- project=r.project_id, grant=r.grant_id/version, 실행/세대=원 grant,
+  -- envelope.commandId=정확 proof target의 command UUID로 저장 명령을 선택.
+  -- path 전체는 /api/v1/connectors/{원등록}/executions/{원실행}/commands/{UUID}/permit와 같아야 함.
+  -- 누락/복수·다른 grant·다른 실행/세대·다른 envelope는 reject.
+  stored_operation := stored_command.snapshot_json.envelope.operation;
+  IF stored_operation = 'START_SESSION' THEN
+    -- 기존 IF permit_path AND NOT EXISTS(...)부터 RAISE까지 원문 그대로.
+    -- execution_start_permits의 UNIQUE(project,execution,generation)·guard는 수정0.
+    IF permit_path AND NOT EXISTS(original_start_binding) THEN reject; END IF;
+  ELSIF stored_operation = 'SEND_INSTRUCTION' THEN
+    -- 저장 명령 state가 SYNTHETIC_INSTRUCTION_QUEUED여야 함.
+    -- execution_instruction_permits에서 아래 exact_binding 한 행 요구.
+    IF NOT EXISTS(exact_send_binding) THEN reject; END IF;
+  ELSE
+    reject; -- REQUEST_STOP/누락/알 수 없는 operation은 permit 소비 대상 아님.
+  END IF;
+END IF;
 RETURN NULL;
```

`original_start_binding`은 §1 원문의 `NOT EXISTS` 내부 SELECT와 두 JSON 비교를 **그대로** 뜻한다. START guard 함수·실행당1회 UNIQUE·기존 nonce/result guard·두 deferred trigger의 시점/대상/작동은 변경하지 않는다.

`exact_send_binding`의 필수 대조:

1. 전용표의 project/execution/generation, 원 grant ID/version과 정확 저장 SEND command record ID/version/hash 및 envelope commandId/hash 일치.
2. 전용표 snapshot의 scope는 원 connector/credential 세대·grantRef, commandRef는 정확 저장 행, request.envelopeHash는 원 봉투와 일치.
3. proof_result_id/version/ref/hash는 r과 같고, c의 consumption.resultRef가 그 proofRef와 같음. r과 c의 원 challenge/grant 결박도 유지.
4. requestHash는 정확4필드 request의 canonical hash이고 c.request.target.bodyHash와 같음. localAttemptRef/sourceObservationRefs/osOwnershipRef를 다른 시도로 바꾸지 않음.
5. reservationRef는 저장 SEND의 새 예약과 일치하며 원 START 예약이 아님. authorizationReceiptRef는 원 HUMAN 영수증과 일치.
6. 전용표 guard가 검증한 issuedAt/원 expiresAt·command/grant/proof 상한 및 현재 기한 내. 현재검사는 원 결과 기한을 연장하지 않음.
7. 전용표의 project/실행/세대/command 유일성과 proof/permitID 유일성, 정확 FK, UPDATE/DELETE 거절을 함께 요구. 전용 permit만 있는 orphan과 proof만 있는 orphan은 양방향 지연 검사로 거절.

이 목록은 동작 검증 결과가 아니라 source-only 구현·검토 계약이다. 전용표 schema/guard 미구현·미검증 범위를 PASS로 표시하지 않는다.

## 3. 변경 영향에 필요한 정확 회귀

기존 START: 정상 원 command/proof/permit 한 COMMIT; execution/gen의 두 번째 START permit 거절; 같은 요청 원결과/기한 재확인; 다른 proof/attempt/command 재사용 거절; START proof→SEND표만 존재 거절; START표만 존재/proof orphan/소비 nonce orphan 각각 거절; UPDATE/DELETE 거절; 만료/회수/중간 실패 rollback. 기존 START guard·UNIQUE 원문/hash 불변도 확인한다.

새 SEND: 다른 project/execution/gen/grant/credential/command/ref/hash/envelope/예약/영수증/attempt/source/OS/proof 중 하나라도 다르면 거절; 원 START 예약 재사용 거절; 두 번째 permit ID/동일 command 새 proof 거절; 같은 proof의 원결과 재확인은 TTL 연장0; 만료/불완전 nonce/누락 result/부분 append/COMMIT 실패 rollback; SEND proof→START표만 존재 거절; 전용표만 존재와 proof만 존재 둘 다 거절. 다른 후속 command는 새 예약/정확 허가가 있을 때만 별도1건.

요청 분기: 저장 command 누락/복수/REQUEST_STOP/알 수 없는 종류·prefix/세대 불일치에서 fail-closed. START·SEND가 서로의 표로 fallback하지 않음.

위 actual SQL/동시성/COMMIT 시험은 **미실행**이다. 기존 합성 consumer 시험을 이 DB 회귀의 PASS로 사용하지 않는다.

## 4. 원5함수 차단과의 독립성

이 후보는 기존 `guard_initial_execution_row`, `guard_execution_command_kind`, `guard_execution_command_complete`, `guard_initial_execution_complete`, `guard_initial_execution_shared_history`를 교체하거나 예외 처리하지 않는다. 따라서 그 guard가 SEND command 저장을 거절하면 정확 저장 SEND 행 자체가 없으므로 새표 INSERT/FK·전용 guard·위 후보의 command 선택 모두 실패해야 한다.

새표를 command/outbox/HUMAN 영수증의 대체 허가 경로로 사용하지 않는다. trigger 비활성·replication_role·직접 우회 DML·경로 변경·기존 START표에 SEND 위장 저장은 금지한다. 정식 DB·키/credential·OS/Agent·서비스/P2/P3 변경0을 유지한다. 여섯 번째 함수의 source-only 분기에 관한 PMO 판단은 원5함수 실제 거절 해제가 아니다.
