# FN06 같은-client 최초 수신 source-only 직접 채택

2026-11-04 · Main 어울 · SOURCE_GO1 / ACTUAL_EXECUTION_GO0

승인 근거: 신산님 직접 답변 call_453a800c6ef74f0c8b723fea57ed2100의 questionItem0, “패킷 source-only 채택”. 질문은 정확 채택 패킷 SHA256 682a51daca51fad9525b4db34ab62dcdd99b0d5dc63a2b1bca1acc211f2ca24e의 코드·화면·미적용 SQL·합성 검증 구현을 대상으로 했고 실제 DB·권한 부여·키·서비스·Agent·C# 컴파일·J3/P03 R3 실행과 Git 복구를 제외했다. 질문전달 accepted가 아니라 이 직접 답변을 채택 근거로 삼는다.

## 고정 계약

- docs/work_packages/FN06_NATIVE_FIRST_RECEIVE_ADOPTION_PACKET_20261104.md — SHA256 682a51daca51fad9525b4db34ab62dcdd99b0d5dc63a2b1bca1acc211f2ca24e
- docs/contracts/FN06_NATIVE_FIRST_RECEIVE_WIRE_PROPOSAL_20261104.md — SHA256 6d1a727fb60298c4adcc37ce5066b4032f144e6f42b8a0b74f023d8af56e83f4
- docs/contracts/FN06_NATIVE_FIRST_RECEIVE_ACCOUNTING_PROPOSAL_20261104.md — SHA256 f8667e17830b60791d769a288ec77c82e34649a952bff9faf4ae688bb32c1597
- docs/work_packages/FN06_NATIVE_FIRST_RECEIVE_SOURCE_IMPLEMENTATION_CANDIDATE_20261104.md — SHA256 c66b3381829513a5a1cb69a0d606fbcd4904e62a4561e8b979bdfad940df43bc

위 문서의 후보/미채택 머리글과 부모 hash는 작성 이력이며 이 직접 채택 기록이 위 정확 원문의 source 구현 권한만 확정한다. 원문 bytes를 바꾸거나 실제 실행 권한으로 확대하지 않는다. 구체 원형·S0~S7·WI §2의56경로가 권위다. 신규19경로 부재와 기존37경로의 raw 지문을 아래에 고정했다. 코드·시험·SQL 수정은 기존 Primary 한 명만 수행하며 Main은 같은 경로를 수정하지 않는다. Main이 검수·통합·현황·Git을 소유한다.

## 권한·제외·재개

허용: 정확56경로의 실제 구현, TDD·직접/인접 합성 검증·타입·문법·파일 출력 없는 제품 빌드. 원 guard/원 commandHash/승인·2MiB/깊이64·10초·단발 전달·UNKNOWN 보존을 유지한다. 기존 실제 공급자 부재를 성공 callback/가짜 current로 덮지 않는다. source 결과와 실사용/정식 환경/전체 FN06·계획 완료를 구분한다.

제외: 실제 DB 접속/SQL/GRANT/정책·권한 부여/키·인증서·실제 anchor·사용자자료 조사/서비스·Agent·C# 컴파일/helper/HTTPS 기동/J3/P03 R3/Oracle·운영/기존 프로젝트 차단 해제/Git 인증 복구. 새 branch·세션·worktree·의존성 도입·원 SQL 수정·history rewrite0. private 연결 오류는 별도이며 재push/SSH·키 변경0이다. 실제 publisher 실행계획 공급자가 없으면 artifact/intent/DB 전 미구성 거절한다.

이전 직접 결정 미수신 차단은 본 답변으로 해소돼 source 작업을 재개한다. goal의 이전 blocked 기록을 완료로 바꾸거나 임의 새 목표를 만들지 않는다. 재차 외부 차단이 생기면 새 감사로 센다. 승인 범위 내 독립 구현은 계속한다.

## 착수 기준선

branch codex/av3-stage-b, 구현 전 HEAD fa028a934d0ec198a763f5381e442937d03b6e33. 이 채택 기록의 문서 commit 후 실행 HEAD는 달라질 수 있으나 제품/시험/SQL 기준선은 아래 raw 지문과 동일해야 한다. 보호 미추적3을 변경·stage·삭제하지 않는다.

```json
[
  {
    "path": "contracts/runtime/native-first-receive-v1.ts",
    "exists": false
  },
  {
    "path": "apps/server/modules/executions/native-first-receive-input.ts",
    "exists": false
  },
  {
    "path": "apps/server/modules/executions/native-first-receive-store.ts",
    "exists": false
  },
  {
    "path": "apps/server/modules/executions/native-first-receive-profile.ts",
    "exists": false
  },
  {
    "path": "apps/server/modules/executions/native-first-receive-service.ts",
    "exists": false
  },
  {
    "path": "apps/server/modules/executions/native-first-receive-routes.ts",
    "exists": false
  },
  {
    "path": "apps/connector/runtime/native-first-receive-client.ts",
    "exists": false
  },
  {
    "path": "apps/desktop/src/native-first-receive-client.cjs",
    "exists": false
  },
  {
    "path": "scripts/publish-native-channel-profile.ts",
    "exists": false
  },
  {
    "path": "db/migrations/0076_native_first_receive.sql.pending",
    "exists": false
  },
  {
    "path": "apps/server/app.ts",
    "exists": true,
    "bytes": 5634,
    "sha256": "12e92b277092d8453fccb5291034ea959e8c3d352dce868bd3954573ae1ef398"
  },
  {
    "path": "apps/server/main.ts",
    "exists": true,
    "bytes": 1844,
    "sha256": "144e8bad2ba2657f998be0d8fff0f76c863a2ee2c05dc7cf46bd53e990124486"
  },
  {
    "path": "apps/server/modules/access/project-command.ts",
    "exists": true,
    "bytes": 37250,
    "sha256": "2c99802130b5be162c920902da45ac69645aa2ce4a006df88d49e839ead866f8"
  },
  {
    "path": "apps/server/modules/connections/project-registration-reads.ts",
    "exists": true,
    "bytes": 13165,
    "sha256": "4d4f049124970faee4dc89dbd4f7a8f84ee53742581d60d3b89412528f516636"
  },
  {
    "path": "apps/server/modules/executions/project-native-preparations.ts",
    "exists": true,
    "bytes": 47707,
    "sha256": "3fa16ab290dcad99afc4d478f3688d4540b0af4658cc8b4f75f7e76e2d22b0b5"
  },
  {
    "path": "apps/server/modules/executions/native-preparation-routes.ts",
    "exists": true,
    "bytes": 7484,
    "sha256": "abc73ee892e9f0b9b91e3073d2b64e2000bc733d4530632a54aed041b341b7d2"
  },
  {
    "path": "apps/server/modules/executions/native-preparation-current-source.ts",
    "exists": true,
    "bytes": 16872,
    "sha256": "a57080c52b113d8245272a53296768a2f364d62dd0271923d6e17d1cd86951be"
  },
  {
    "path": "apps/server/modules/executions/native-preparation-store.ts",
    "exists": true,
    "bytes": 16492,
    "sha256": "f789392bd85d54ced2074027a0ac1646922bb4b9362d3369d6d0b17d72550f2a"
  },
  {
    "path": "apps/connector/runtime/native-preparation-https.ts",
    "exists": true,
    "bytes": 22332,
    "sha256": "68c6fb45aee9b85daa55ecc98a2ef6110172f01e879b89c9328650b4cd64cee8"
  },
  {
    "path": "apps/desktop/src/trust-enrollment-owner.cjs",
    "exists": true,
    "bytes": 49054,
    "sha256": "07ce69e6e8d683d61be6b6f81a734c9768078b7c117edc1823c5a10beb6e0b64"
  },
  {
    "path": "apps/desktop/src/trust-key-host-client.cjs",
    "exists": true,
    "bytes": 9658,
    "sha256": "c3c9b04c2664f528f3b9d65c0e33f3866a34c63315232bca0361688145b2cc1a"
  },
  {
    "path": "apps/connector/native/DesktopTrustKeyHostSource.cs",
    "exists": true,
    "bytes": 27631,
    "sha256": "dc4c71b78546b85cb1ad71ff83a668336ff944696b237e36dca7b2fe99da0e8a"
  },
  {
    "path": "apps/desktop/src/shell.cjs",
    "exists": true,
    "bytes": 13641,
    "sha256": "d4ecce1baa0e2257a469bf6c20f1a789d839a39bbdfd7438f6ac076e269722c2"
  },
  {
    "path": "apps/desktop/src/preload.cjs",
    "exists": true,
    "bytes": 1698,
    "sha256": "c2843a657d98559b3dc41770cfd9c0859d78bd78d9b8d7c20692eeb26f1c947e"
  },
  {
    "path": "apps/desktop/src/policy.cjs",
    "exists": true,
    "bytes": 4761,
    "sha256": "fbfb13498dcf707e70d3681bbcbf103e5e3f6575c9299ee45facce17250eaec6"
  },
  {
    "path": "apps/desktop/src/settings.html",
    "exists": true,
    "bytes": 3519,
    "sha256": "07962b4a6f694acad82d3ee3e03b2db26e7217c51a7832cee9cd77fa898c539f"
  },
  {
    "path": "apps/desktop/src/settings.js",
    "exists": true,
    "bytes": 11757,
    "sha256": "60b74eab81bbbe33332d6f146f918266cae08cf8abc001be7241c0ab86b9046c"
  },
  {
    "path": "apps/desktop/scripts/native-proof-runtime-entry.mts",
    "exists": true,
    "bytes": 553,
    "sha256": "5605710335ca0ce6601de5248fab44563bfe872121de2497afb6e9d6809ee1d4"
  },
  {
    "path": "apps/desktop/scripts/native-proof-runtime-build.cjs",
    "exists": true,
    "bytes": 7502,
    "sha256": "488dc99d9437f59cccc68956b0f9dc8269f18629896062b9ae1ae23f6102f58e"
  },
  {
    "path": "apps/web/src/features/connections/native-boundary-preparation-api.ts",
    "exists": true,
    "bytes": 29894,
    "sha256": "096a02f9e3c17a1fd68cfd20ca688fc5799304547fe490d59502fd3af76848e9"
  },
  {
    "path": "apps/web/src/features/connections/NativeBoundaryPreparationPanel.tsx",
    "exists": true,
    "bytes": 8630,
    "sha256": "9d292b7d5b289c521fb3cf84ed44ccf99ce94d6e7f5cdd7d6d12ffd97f721af6"
  },
  {
    "path": "apps/web/src/features/connections/policy-editor-profile.ts",
    "exists": true,
    "bytes": 4857,
    "sha256": "518bba64437baf84da73ef08033547596b340625bdf3c50b40a7ac5b569a54ac"
  },
  {
    "path": ".gitattributes",
    "exists": true,
    "bytes": 416,
    "sha256": "218270b2d8ccbb6131a4f3d87f1c6e2c03c5e3cdbbaf52ed33abdc873ad0a2d0"
  },
  {
    "path": "tests/unit/FN06/native-first-receive-contract.test.ts",
    "exists": false
  },
  {
    "path": "tests/unit/FN06/native-first-receive-profile.test.ts",
    "exists": false
  },
  {
    "path": "tests/unit/FN06/native-first-receive-store.test.ts",
    "exists": false
  },
  {
    "path": "tests/unit/FN06/native-first-receive-routes.test.ts",
    "exists": false
  },
  {
    "path": "tests/unit/FN06/native-first-receive-client.test.ts",
    "exists": false
  },
  {
    "path": "tests/unit/FN06/native-first-receive-schema.test.ts",
    "exists": false
  },
  {
    "path": "tests/desktop/native-first-receive-owner.test.cjs",
    "exists": false
  },
  {
    "path": "tests/unit/UI11/native-first-receive-flow.test.ts",
    "exists": false
  },
  {
    "path": "tests/native/FN06/NativeFirstReceiveHostSourceTests.cs",
    "exists": false
  },
  {
    "path": "tests/unit/FN06/native-preparation-authority-contract.test.ts",
    "exists": true,
    "bytes": 3706,
    "sha256": "8838c54e6edb2aec4e2463adcdde08ea014b70a306a78f15315f15939e98582c"
  },
  {
    "path": "tests/unit/FN06/native-preparation-store.test.ts",
    "exists": true,
    "bytes": 77422,
    "sha256": "949e46effe88407cde20f35963e6c908f42109569ac6b691ad51cce70a89de7f"
  },
  {
    "path": "tests/unit/FN06/native-preparation-routes.test.ts",
    "exists": true,
    "bytes": 5642,
    "sha256": "f2a334cda807294dbc5d925bb63a79adc0971f1dbf5d848974b946bf6b419faa"
  },
  {
    "path": "tests/unit/FN06/native-preparation-current-source.test.ts",
    "exists": true,
    "bytes": 57678,
    "sha256": "ff2c75af5694b9758ec75e3d046aa9b82c6a6fe225c07dba2c894d756303b043"
  },
  {
    "path": "tests/unit/FN06/native-preparation-https.test.ts",
    "exists": true,
    "bytes": 25109,
    "sha256": "17a2c2ad77b4de7c507460ae55a938acbbc33a83e29da60d97c121e3c21dc243"
  },
  {
    "path": "tests/unit/FN06/native-preparation-credential-slot.test.ts",
    "exists": true,
    "bytes": 20084,
    "sha256": "634fc7d576d99aeed9cdd826abce63dfbe971e9062d4845246a878e43c1778fb"
  },
  {
    "path": "tests/unit/FN06/native-preparation-owner-host.test.ts",
    "exists": true,
    "bytes": 10719,
    "sha256": "b688ebc97f3f2c7496110effe6553c7269545aa70fae94cd4e200ecc170b5874"
  },
  {
    "path": "tests/unit/UI11/native-boundary-preparation.test.ts",
    "exists": true,
    "bytes": 41433,
    "sha256": "772d09355ddd64d31d158c6e92bdf47b2228e70a63720b690e2d359bce8ce62d"
  },
  {
    "path": "tests/unit/UI11/native-boundary-preparation-app.test.ts",
    "exists": true,
    "bytes": 25149,
    "sha256": "d5a93f7cba09387ff4448994b2c8794fd35d026aff8d726b186b1b5727e892a6"
  },
  {
    "path": "tests/desktop/desktop-trust-owner.test.cjs",
    "exists": true,
    "bytes": 34532,
    "sha256": "19bd7864af9e71069d89340bbb308f7afc6e8c273634398a50afafcf3a4980fe"
  },
  {
    "path": "tests/desktop/desktop-trust-registration.test.cjs",
    "exists": true,
    "bytes": 71068,
    "sha256": "64ea49b66b50db551f8f8a1bcedd7b4117f97725dda8cef8e3d8a0456927f2a3"
  },
  {
    "path": "tests/desktop/shell-policy.test.cjs",
    "exists": true,
    "bytes": 3851,
    "sha256": "0c9ff1eb3302fc117a954028178a29a22c633cd8c5e84422acc8047cf2316e0d"
  },
  {
    "path": "tests/desktop/native-proof-runtime-build.test.cjs",
    "exists": true,
    "bytes": 6145,
    "sha256": "fc121ce80c24944c7b36c0a396fbdde3c76d45fb8cd1d33a4b5477d7bf85ce82"
  },
  {
    "path": "tests/native/FN06/DesktopTrustKeyHostSourceTests.cs",
    "exists": true,
    "bytes": 39686,
    "sha256": "86542bb11e8112adb8b5626922161ba1f04063e8209f0bfc98c5b4332a0964c5"
  }
]
```
