# A-01 AV-FLOW-001 책임 정합화 설계

## 결정

신산님 승인에 따라 A-01의 Package 역색인에서 `AV-FLOW-001`을 제거한다. A-01은 문서형 전체 journey의 연결성을 `AV-UI-005`로만 판정하고, `AV-FLOW-001`의 L4+L7 runtime 검증은 정의행의 책임 Package인 A-05와 B-03에서 수행한다.

## 이유

A-01은 screen map·journey·Phase Rail을 확정하는 문서 설계 Package다. 브라우저 클릭, 영속 Event, 승인 guard가 아직 없으므로 `E-SHOT`·`E-EVT`를 정적 fixture로 만들어 L4 runtime PASS로 승격할 수 없다. A-01에 `AV-FLOW-001`을 유지하면 mock PASS 금지 원칙과 CRITICAL 전량 PASS 종료조건이 동시에 충돌한다.

## 변경 범위

- 통합검증매트릭스의 A-01 역색인을 `AV-UI-005` 단독으로 정규화한다.
- A Gate 전체 회귀의 `AV-FLOW-001`은 유지한다.
- A-05와 B-03의 `AV-FLOW-001` 책임은 유지한다.
- 작업계획과 테스트계획은 새 매트릭스 revision/hash와 A-01 정적 검증 경계를 명시한다.
- 운영규칙·온보딩 ACK·progress/HANDOFF는 새 활성 기준선을 가리킨다.
- 과거 G-02/G-07/Phase G evidence와 historical baseline은 수정하지 않는다.

## 검증

- A-01 역색인은 정확히 `AV-UI-005`다.
- A-05와 B-03에는 `AV-FLOW-001`이 남는다.
- A Gate 신규 필수 통과 ID에는 `AV-FLOW-001`이 남는다.
- 전체 Package 97개, AV ID 255개, 고유 실행 234개, 미할당 0은 유지한다.
- 기존 accepted evidence는 byte 불변이다.

## 영향

기능 범위와 제품 요구는 바뀌지 않는다. 검증 책임의 실행 가능성을 바로잡으며, A-01은 정적 journey artifact를 만들고 A-05/B-03이 실제 runtime 증거로 `AV-FLOW-001`을 닫는다.
