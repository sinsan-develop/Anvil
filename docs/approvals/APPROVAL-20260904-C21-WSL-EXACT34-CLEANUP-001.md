# APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001

- approval_id: `APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001`
- source: `DIRECT_USER_APPROVAL`
- actor: `신산님`
- approved_at: `2026-09-04 (Asia/Seoul)`
- artifact_path: `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`
- classification: `HUMAN_APPROVED_C21_WSL_EXACT34_AND_ISOLATED_VOLUME_CLEANUP`
- validated_base_commit: `eef349682ff5598e3488c9e75163c5e0a99a0bdb`
- candidate_commit: `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- repository_exact_path_count: `34`
- approval_text_encoding: `UTF-8`
- approval_text_line_ending: `LF`
- approval_text_bytes: `509`
- approval_text_sha256: `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`

## 승인 원문

```text c21-wsl-approval
C-21 WSL active projection을 validated base eef3496 대비 기존 exact18과 신규 16경로를 합친 누적 exact34로 결박하는 것을 승인한다. 이는 기존 historical 파일의 추가 수정을 승인하는 것이 아니다. 또한 검증 완료 후 WSL 전용 Compose project와 Docker label이 정확히 일치하는 anvil-wsl-pg15_anvil-db-data, anvil-wsl-pg18rc_anvil-db-data 격리 테스트 볼륨만 삭제하는 것을 승인한다. WSL server에서 테스트는 자유롭게 하면 돼
```

위 fenced payload는 승인 원문 뒤 정확히 하나의 LF를 포함한 509 UTF-8 bytes다. `approval_text_sha256`은 이 payload 자체의 SHA-256이다.

## 승인 범위

- validated base `eef349682ff5598e3488c9e75163c5e0a99a0bdb` 대비 candidate `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`의 cumulative exact34 결박
- WSL-server 내부의 승인된 테스트 자유 실행
- 검증 완료 뒤 exact Compose project 및 Docker label이 일치할 때에만 아래 두 격리 테스트 volume 삭제
  - `anvil-wsl-pg15_anvil-db-data`
  - `anvil-wsl-pg18rc_anvil-db-data`

## 보존 및 제외

- 기존 historical event와 evidence는 수정하지 않는다.
- 후보 외 volume, 공유 DB/schema, Telegram, Provider, 운영 배포, main 병합은 이 승인에 포함하지 않는다.
- candidate와 control은 별도 Git commit/ref로 유지한다.
