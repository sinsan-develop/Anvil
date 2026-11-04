# FN06 codec·profile 동결 checkpoint 독립 검수

2026-11-04 · Main 어울 · 단일 Primary writer 유지
기준: 직접 채택 packet 682a51daca51fad9525b4db34ab62dcdd99b0d5dc63a2b1bca1acc211f2ca24e, source adoption 및 연결 wire/account/WI.

## 정확 동결 경로와 SHA256
- contracts/runtime/native-first-receive-v1.ts: 2f6e8b24d1592b1717afa08762b2a7d800854ae00f2270e4599b4b71fd929cef
- apps/server/modules/executions/native-first-receive-input.ts: 6430330925770d9373ba004f89b065d3e586b0dbefe968a739afeba92cd5d623
- apps/server/modules/executions/native-first-receive-profile.ts: cc4e572eff5f5649f5915e6ac8f83a58d98a2f6b698d987d88b3b9ee167be71f
- scripts/publish-native-channel-profile.ts: 4ab0b4581bd75eca8c8594d79028aa4e455e194fbace54027046a576470d9698
- tests/unit/FN06/native-first-receive-contract.test.ts: fac3b2bb8dd5c25cd072e5f11660d8a052bcc8fd5026d2012e36d92351f13fee
- tests/unit/FN06/native-first-receive-profile.test.ts: 18e87793c431e14c3d00acd02165f1dd441905ef83dbc315de00bdb3974c0fa5

## 담당별 범위
remaining_stage_b_dependencies: 계약 적합 검토. 기존 native 입력·기존 승인/command hash 보존, 새 immutable ref/phase/형제 결과 exact 검산, 큰 정상 command의 외피 보존, 보호 Profile/Head의 실제 원문/기한 검산만 확인한다. 새 S3~S7과 현재 미작성 SQL을 누락 결함으로 세지 않는다.

remaining_execution_dependencies: 품질·경계 검토. publisher expected/manifest 실제 bytes/파일별 목록, fake FS adapter의 link/중복/경로/변조 거절, IO 직전 기한·송신 후 UNKNOWN/retry0, default/import/plan 효과0, 공개 응답/오류/로그 비밀 혼입 여부를 확인한다. 실제 FS/DB/키 실행은 하지 않는다.

## 공통
검토 전후 정확 6경로 지문을 대조한다. Primary는 이 6경로만 동결하고 store/0076/해당 시험은 계속 작성한다. 코드·문서·시험 수정, 테스트 재실행, commit/push·실환경 실행은 0이다. 읽기만으로 발견한 실제 반례와 파일/행·영향·최소 조치를 반환한다. C0/I0도 이 동결 접점에만 적용하며 전체 FN06/S2·PG/브라우저/native/Agent 인수로 확장하지 않는다. 기존 보완된 반례를 같은 코드에서 반복 검토할 필요는 없으며 변경된 접점과 미확인 경계를 중심으로 본다.