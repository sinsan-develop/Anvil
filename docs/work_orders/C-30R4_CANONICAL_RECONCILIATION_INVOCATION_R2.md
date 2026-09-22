# C-30R4 canonical reconciliation R2 invocation

R2 WorkInstruction과 epoch 2 fencing token으로 Developer exact2만 수정한다. 남은
historical-current fixture 혼합을 Git checkpoint bytes로 격리하고 기존 검증 기대를
완화하지 않는다. 각 수정 후 exact GREEN과 compile/diff-check를 확인하고, 마지막에는
상호 배타 4개 shard 합계 679개를 fresh 검증한다. control materialization, commit, push는
하지 않는다.
