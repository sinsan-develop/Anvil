'use strict';
const path=require('node:path');const base=require('./forge.config.cjs');
// 기존 package identity/SDK hook은 유지한다. 이 별도 config는 개발 산출물 전용이다.
const config={...base,packagerConfig:{...base.packagerConfig,ignore:[...base.packagerConfig.ignore,/^\/forge\.installer-development\.config\.cjs$/]},makers:[{name:'@electron-forge/maker-squirrel',platforms:['win32'],config:{name:'AnvilDevelopmentArtifact',setupExe:'Anvil-Development-NOT-RELEASE-Setup.exe',noMsi:true}}],publishers:[]};
Object.defineProperty(config,'outDir',{enumerable:true,get(){const value=process.env.ANVIL_INSTALLER_DEV_OUTPUT;if(!value||!path.isAbsolute(value)||path.resolve(value)!==value)throw Error('INSTALLER_OUTPUT_REQUIRED');return value;}});
module.exports=config;
