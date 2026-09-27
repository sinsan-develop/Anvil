# R45B QA 공개 검증 산출물

이 폴더는 R45B Test/Staging 재결박의 QA-only 공개 원본이다. `qa-release-manifest.json`의 서명 주체는 exact Git tag `f18-wsl-r45a-qa`의 source SHA와 R45B 새 Web/API/Worker image ID를 결박한다. `qa-public-key.pem`의 공개 fingerprint는 `sha256:811eacdbf512b47efc755c05f8685d8b79363f96f2f8c104c8ced233500acb8a`이며 독립된 QA 검증 입력일 뿐 Production trust가 아니다. private signing key는 메모리에서만 생성·사용했고 저장하지 않았다. `qa-sbom.json`은 application dependency source만 포함하며 OS/image 전체 SBOM이 아니다. 이 공개 원본이 Git에 게시되고 WSL-server가 같은 SHA를 Git으로 받은 뒤 F-16/F-18 preflight를 다시 통과하기 전에는 격리 target 검증을 시작하지 않는다.
