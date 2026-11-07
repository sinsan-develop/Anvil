import { get } from 'node:https';
import { readFileSync } from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertRecoveryNativeExecution} from './development-recovery-entry.ts';

export function getDevelopmentTlsCaPath(recoveryTls=false):string {
  return recoveryTls?'D:/Project/Anvil/.av3-data/dev-tls-20261025-01/ca.cert.pem':'D:/Project/Anvil/.av3-data/dev-tls/ca.cert.pem';
}
export function assertDevelopmentTlsExecution(recoveryTls:boolean):void {
  if(recoveryTls)assertRecoveryNativeExecution();
}
export async function checkDevelopmentHttps(args:string[]){
if(args.length>1||(args.length===1&&args[0]!=='--recovery-tls'))throw Error('DEVELOPMENT_HTTPS_ARGUMENT_INVALID');
const recoveryTls=args[0]==='--recovery-tls';
assertDevelopmentTlsExecution(recoveryTls);
const ca = readFileSync(getDevelopmentTlsCaPath(recoveryTls));
await new Promise<void>(resolve => {
  const request = get({ hostname: '127.0.0.1', port: 3830, path: '/api/v1/health', ca, rejectUnauthorized: true, agent: false }, response => {
    let body = '';
    response.on('data', part => {
      body += part;
      if (body.length > 4096) request.destroy(new Error('HEALTH_RESPONSE_TOO_LARGE'));
    });
    response.on('end', () => {
      try {
        const value = JSON.parse(body);
        if (response.statusCode !== 200 || value.status !== 'ok' || value.scope !== 'process') throw Error('HEALTH_INVALID');
        console.log('DEVELOPMENT_HTTPS_PROBE_OK');
      } catch { process.exitCode = 1; }
      resolve();
    });
  });
  request.setTimeout(2000, () => request.destroy(new Error('LOCAL_TLS_TIMEOUT')));
  request.on('error', error => {
    process.exitCode = 'code' in error && error.code === 'ECONNREFUSED' ? 2 : 1;
    resolve();
  });
});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await checkDevelopmentHttps(process.argv.slice(2));
