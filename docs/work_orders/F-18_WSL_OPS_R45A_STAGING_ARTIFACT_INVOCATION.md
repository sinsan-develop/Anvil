# F-18 R45A Main QA invocation

기준: `F-18_WSL_OPS_R45A_STAGING_ARTIFACT_WORK_INSTRUCTION.md`의 새 hash와 canonical epoch34 worker lease. epoch33의 포트 불일치 검출로 제품·DB·Secret·Compose 실행 전 중지했고, Git tag/checkout은 정확성 재검증 후 재사용한다. G-05 PASS, 지정 원격 SHA 일치, 8444 포트/자원 사전 기록을 확인한 뒤 WSL-server의 전용 Test/Staging만 검증한다. 제품 파일은 수정하지 않는다. 결과는 실제 관측·미검증·자원 정리와 함께 보고하고, F-18 전체 acceptance나 Production으로 승격하지 않는다.
