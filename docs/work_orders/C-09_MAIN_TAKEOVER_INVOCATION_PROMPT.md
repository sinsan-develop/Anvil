# C-09 Main takeover invocation

TakeoverPacket과 WI-C-09-MAIN-TAKEOVER-001에 결박된 exact18만 main-agent-eoul이 수정한다. epoch3 token은 폐기됐으며 epoch4 execution/write token 둘 다 검증한다. 15 corrective axes를 순차 TDD로 해결하고 R4/R3/R2/C08 회귀를 유지한다. FROZEN_R4에서 시작해 ACTIVE_MAIN으로 전환하며 clean detached 검증은 DETACHED_CONTROL만 사용한다. C10/DIR2/외부 실행/제품 commit·push·merge는 금지한다.
