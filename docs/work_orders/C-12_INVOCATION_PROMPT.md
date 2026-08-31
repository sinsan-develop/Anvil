# C-12 Invocation Prompt

WorkInstruction 범위만 구현하라. C-06 validator와 C-07 결과 계약을 먼저 읽고, 표준 라이브러리 기반 deterministic failure ledger/replay 테스트를 작성하라. valid failure만 1·2·3회 집계하고 무효·환경성 실패·중복 replay는 fail-closed/idempotent로 처리하라. 실제 lease/tool takeover나 외부 시스템 호출은 하지 말고 완료보고서에 증거·오류·미검증·rollback을 기록하라.
