'use strict';
const path=require('node:path');const {verifySdk,ARCHIVE_DIR,VERSION}=require('./scripts/verify-sdk.cjs');
// fuse V1: RunAsNode/NodeOptions/NodeCliInspect 거절, embedded ASAR integrity/OnlyLoadAppFromAsar 활성화.
// 정확 basename ZIP 디렉터리만 소비한다. archive가 없으면 prePackage에서 차단한다.
const config={packagerConfig:{name:'Anvil',executableName:'Anvil',asar:true,prune:true,electronVersion:VERSION,electronZipDir:ARCHIVE_DIR,ignore:[/^\/\.cache(?:\/|$)/,/^\/out(?:\/|$)/,/^\/node_modules(?:\/|$)/,/^\/scripts(?:\/|$)/,/^\/forge\.config\.cjs$/,/^\/tsconfig\.json$/,/^\/package-lock\.json$/,/^\/\.gitignore$/]},plugins:[{name:'@electron-forge/plugin-fuses',config:{version:'1',0:false,2:false,3:false,4:true,5:true}}],rebuildConfig:{onlyModules:[]},hooks:{prePackage:async()=>{await verifySdk();},postPackage:async(/** @type {unknown} */_config,/** @type {{platform:string,arch:string,outputPaths:string[]}} */result)=>{if(result.platform!=='win32'||result.arch!=='x64'||!Array.isArray(result.outputPaths)||result.outputPaths.length!==1)throw Error('PACKAGE_HARDENING_INVALID');await require('./scripts/verify-package-hardening.cjs').verifyPackageHardening(result.outputPaths[0]);}}};

// 보호 profile이 기본 부재여도 실제 Forge copy 접점은 고정한다.
config.hooks=require('./scripts/desktop-runtime-profile.cjs').fixedDesktopTrustForgeHooks(config.hooks);
// 보호 worker build producer의 명시 조립 접점. 설정 부재를 임의 compile/설치로 채우지 않는다.
config.hooks=require('./scripts/native-worker-package.cjs').fixedNativeWorkerForgeHooks(config.hooks);
module.exports=config;
