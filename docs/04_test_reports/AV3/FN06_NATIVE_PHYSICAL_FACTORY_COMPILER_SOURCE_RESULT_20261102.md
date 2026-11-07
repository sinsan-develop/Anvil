# FN06 물리 helper compiler 소비선 source 결과

## 판정·범위

한정 source 단위 검수 완료. 실제 compiler/C#·OS/native·보호 supplier·제품 실행·전체 FN06/FN18/계획 완료는 아니다.

- WI docs/work_packages/FN06_NATIVE_PHYSICAL_FACTORY_COMPILER_SOURCE_IMPLEMENTATION_20261102.md SHA D260DFEBDF9B17AAD8071D3062E5BFBF26C6DDF92A9A36F321528D0E9B8A4200.
- 코드941b68c56ef17685b5011600d1128b71d0279a42, codex/av3-stage-b, 부모662bb79d5c0746084cfc74599cab753a341a2e68. 정확3/220추가2삭제.
- 기존 Primary 단독 구현, Main 검증·통합, 기존 Reviewer 독립 정적 검수. 동시 제품 writer 없음.

## 연결한 기능

고정 produceCompileInput closure의 원 source14/tool/reference/부모 검산→basis exclusive 보관·부분쓰기·sync·readback→원 입력 재검산·단발 enterCompiler→명시 driver→종료 정착·출력 경로/크기 검사→기존 verifyOutput을 연결했다. 실제 spawn/파일 IO 기본값·앱 기본 등록·외부 JSON plan 실행은 없다.

원120초와 더 짧은 caller 기한을 공유하고 재시도·추가 window를 만들지 않는다. stdout/stderr 각64KiB·출력64MiB 상한을 지키며 timeout·출력초과·미정착 IO/종료는 UNKNOWN/보존이다. 종료/IO 정착 전에 자원 재사용·출력 검산을 재개하지 않는다. 원 basis와 write/readback 사본을 분리하고 반환 Buffer의 getter/메서드 덮어쓰기를 고정 intrinsic·복사 전 상한으로 거절한다. 기존 공개/저장/권한·키 형식·실행 허가는 바꾸지 않았다.

## 동결 지문

| 파일 | SHA256 |
|---|---|
| apps/desktop/scripts/native-physical-factory-compiler.cjs | E88D4162135DE3639A2E8801E4151A501C1FB2FDB19E653F73239237DFFBD2D9 |
| apps/desktop/scripts/native-physical-factory-build.cjs | 9A106B119572EA41AD8846970608C44806A695FD35ED5BE2F949AA6324B7802B |
| tests/desktop/native-physical-factory-compiler.test.cjs | C9F719DE729C4D53DB4E6A2CC024640C19EED45CBFFA08196B442D6BAA96778B |

## Main 실행 증거

```powershell
$env:ANVIL_NATIVE_COMPILER_QA='REGISTERED'
node --test --test-reporter=spec tests/desktop/native-physical-factory-compiler.test.cjs tests/unit/FN06/native-physical-factory-build.test.ts
node node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json
git diff --check
```

- 1ce571 exit0: 신규33+직접인접9=42 PASS/FAIL0/SKIP0, 2157.1939ms. 고정 FN18 path reader는 실제 합성 부모 PE/ASAR를 읽었으며 compiler·basis/output/process/tool은 명시 메모리 대역이다. 성공 verifier로 기존 검산을 대체하지 않았다.
- desktop type983c44 exit0. 동결3 지문·diff68d462 exit0. staged 경로/원 bytes=Git index·diff0 후74004f commit.
- 독립 scoped 검수 I1/I2 해소 C0/I0·시작끝3 SHA 동일, 추가 C/I0. Reviewer 실행·수정0.
- Primary의 개별17/선정3/5/8 PASS와 Main42를 합산하지 않는다. 실제 부모 package의 제품 배포·실제 C# 컴파일/IL 실행 증거가 아니다.

## 오류·재작업

모듈 부재ff3c49 준비실패1, handle 부재 타입진단2건은 한 준비원인으로 구분해 보정했다. CHUNK_GETTER4fd20d genuine RED1→6d16fc 정상/음성2PASS, 늦은 open 회수1f67e3 RED1→5499f7 직접3PASS를 보존한다. 독립 I1/I2의10cc9a는 같은 실행에서 서로 다른 반례3을 확인한 뒤 한 번에 공통 Buffer 보완했고 반복 보정실패0이다. 기존 기대값/기준 완화0이다.

Main ca0eda exit1은 sandbox의 등록 case-01 mkdir EPERM 준비오류다. ACL 변경 없이 승인된 정확 QA 범위 elevated1ce571에서 검증했으며 초기 실패를 PASS로 소급하지 않는다. 현황의 CRLF 두 구분자 때문에 발생한 문서 diff 오류는84de1b에서 해당 구분자만 보정했다.

## QA 정리

- 등록 root D:\tmp\anvil-v3-native-physical-factory-compiler-parent-20261102-01, owner fn16_primary_recovered/Windows SINSAN\cyhuh. 최초 생성07:54:57.616Z→원만료08:24:57.616Z, 연장/재생성0. marker167B SHA2FA8B4E9D52C1CA23BA044A859D6851E6CCDBE9F2A43CC915B347F1EAFD977CC.
- 등록 상한12파일16MiB/예정5파일, 컨테이너·포트·DB 없음. test hook이 합성 fixture4파일과 소유 하위 디렉터리를 개별 정리해 marker만 남겼다.
- Main의 회수 send_message는 완료 상태 agent를 재개하지 않아 실행 증거가 아니었다. 실제 상태 확인 후 Main이 ff2768에서08:24:01.551638Z에 marker 원지문·소유·원 ISO·nonlink·단일 파일 목록을 대조해 marker와 빈 root만 비재귀 삭제했다. e13204 08:24:58.587Z 별도 조회 root/marker false. 새 실행 위임은 followup_task를 사용하도록 시정했다.

## 미완료·rollback

실제 compiler/CNG/DPAPI·Windows peer·실제 helper 산출물·보호 mapping/서명 전달·제품 조립·DB/권한/키/서비스/Agent·실자료·P03R3·사용자인수는 미실행/미완료다. FN03 §13.4도 미승인이다. 필수 실제 gate가 남아 PR/main 병합·전체 완료를 하지 않는다.

rollback은 이 코드 commit만 정상 revert한다. 실제 DB/서비스 변경0이며 임시 QA 잔여0이다. 다음은 기존 등록 성공 원결과와 local key/root의 보호 결박 생산·서명 선행 caller를 실제 제품 흐름에 연결하는 미완료 업무를 정본과 대조한다. 이미 있는 exchange wrapper만 추가해 그 공백을 완료로 표시하지 않는다.