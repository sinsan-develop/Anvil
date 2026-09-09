# C-21 R10 evidence correction invocation

parent `c8c35cf92e72ea405b1a9171983c26407175c382`에서 exact12만 append-only로 수정한다. historical R10 evidence를 strict preserve하고 effective current projection의 unsupported `provider_row_count`/`groq_detail_clicked` assertion만 `UNAVAILABLE_NOT_PERSISTED`로 교정한다. seq687~692 generated5/checker/determinism/exact12/direct-child/postcommit을 검증한다. runtime/WSL/product/external/amend/rewrite/push는 실행하지 않는다.
