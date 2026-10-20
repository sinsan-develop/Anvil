import {test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// 기존 복사/개정/검토/확정 시험의 API 조건은 유지하고 등록 bundle만 제공한다.
test.beforeEach(async({page})=>{
 await page.route('https://localhost:3830/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/api/'))return route.fallback();if(route.request().method()!=='GET'||path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return route.abort();const name=path==='/'?'index.html':path.slice(1);return route.fulfill({body:await readFile(new URL('../../../apps/web/dist/'+name,import.meta.url)),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
});
await import('./project-methodology.spec.ts');
