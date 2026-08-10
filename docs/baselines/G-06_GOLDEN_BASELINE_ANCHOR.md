# G-06 Golden Baseline Immutable Anchor

이 문서는 새 승인이 아니다. 신산님의 기존 통합 기준선 승인 범위 안에서 G-06이 구현 전에 고정한 golden case 8건의 exact subject를 Main Agent가 기록한 불변 evidence다. 범위를 넓히거나 expected 값 변경을 승인하지 않는다.

- anchor_id: `ANCHOR-G-06-GOLDEN-20260810-001`
- anchor_type: `MAIN_AUTHORED_GOLDEN_BASELINE_ANCHOR`
- recorded_by: `main-agent-eoul`
- recorded_at: `2026-08-10T19:15:00+09:00`
- evidence_class: `IMMUTABLE_EVIDENCE_WITHIN_EXISTING_HUMAN_APPROVAL`
- scope_effect: `NO_SCOPE_EXPANSION_NO_NEW_APPROVAL`
- parent_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- parent_human_approval_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- parent_human_approval_scope: `설계서 v2.6, 작업계획서 v1.3, 검증문서 v1.1, 운영규칙 v1.3, D1~D10 진행 기준`
- parent_human_approval_file_sha256: `94A82676DB9BF0EE23B55B0A59CBAC706AF7D8617B61BBB9887357E300FDFDC7`
- candidate_path: `tests/fixtures/golden/golden-baseline-candidate.json`
- candidate_file_sha256: `9A1802A39711D64FE571D88912EEF368406E49A9C7835E7145113C2285F28EAF`
- aggregate_hash: `sha256:33128E180D32B89813C62BAA382483001A52ABCF74DDEC8899076246B97DB56D`
- exact_subject_hash: `sha256:F3447FC7323F63CB89B680C45C7DF9D0CC0C967E5F615508BAC115913F329923`

## 변경 통제

- golden expected, case hash, aggregate 또는 exact subject가 달라지면 이 anchor를 재사용할 수 없다.
- 변경에는 신산님의 새 명시 승인과 old/new hash, supersedes lineage가 필요하다.
- Developer Subagent는 이 파일을 생성·수정·대체할 수 없다.
