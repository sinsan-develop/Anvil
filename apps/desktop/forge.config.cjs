'use strict';
const path=require('node:path');const {verifySdk,ARCHIVE_DIR,VERSION}=require('./scripts/verify-sdk.cjs');
// 정확 basename ZIP 디렉터리만 소비한다. archive가 없으면 prePackage에서 차단한다.
module.exports={packagerConfig:{name:'Anvil',executableName:'Anvil',asar:true,prune:true,electronVersion:VERSION,electronZipDir:ARCHIVE_DIR,ignore:[/^\/\.cache(?:\/|$)/,/^\/out(?:\/|$)/,/^\/node_modules(?:\/|$)/,/^\/scripts(?:\/|$)/,/^\/forge\.config\.cjs$/,/^\/tsconfig\.json$/,/^\/package-lock\.json$/,/^\/\.gitignore$/]},rebuildConfig:{onlyModules:[]},hooks:{prePackage:async()=>{await verifySdk();}}};
