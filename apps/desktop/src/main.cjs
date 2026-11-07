'use strict';
const electron=require('electron');const {registerLocalScheme,createShell}=require('./shell.cjs');
if(process.argv.some(v=>/^--(?:remote-debugging|inspect|ignore-certificate|disable-web-security|no-sandbox)/.test(v)))throw Error('DESKTOP_UNSAFE_ARGUMENT');
registerLocalScheme(electron);
electron.app.whenReady().then(async()=>{const shell=await createShell(electron);shell.show();}).catch(()=>{console.error('DESKTOP_START_FAILED');electron.app.exit(1);});
