`D-03_WORK_INSTRUCTION.md`의 ID/hash, D-01·D-02 acceptance, 현재 worker/write fencing과 exact6를 확인한 뒤
test-first로 구현하라. source 등록·보안검사·불변 provenance·폐기 영향 등록만 수행하고 D-03 밖 candidate/activation,
실제 filesystem/network/DB/Run 제어, Git mutation을 수행하지 말라. focused/관련 회귀, compileall, diff-check와
완료보고를 남긴 뒤 구조화 상태로 반환하라.
