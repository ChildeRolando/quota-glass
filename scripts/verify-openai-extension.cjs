const {chromium}=require('playwright');const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createOpenAiBilling,API_URL}=require('../src/providers/openai-session.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'quota-openai-extension-'));
 const secure={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async s=>Buffer.from(s),decryptStringAsync:async b=>({result:b.toString()})};
 const bridge=await createOpenAiBilling({userData:root,testing:true,safeStorage:secure,shell:{},fetch:async()=>({status:200,ok:true,json:async()=>({total_available:73.85})})});
 let context;
 try{
  context=await chromium.launchPersistentContext(path.join(root,'browser'),{channel:'chromium',headless:true,args:['--disable-extensions-except='+bridge.folder,'--load-extension='+bridge.folder]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  worker.on('console',m=>console.log('extension:',m.type(),m.text()));
  await worker.evaluate(()=>{globalThis.seen=[];chrome.webRequest.onBeforeSendHeaders.addListener(d=>seen.push({url:d.url,initiator:d.initiator}),{urls:['https://api.openai.com/*']},['requestHeaders']);});
  await context.route('https://platform.openai.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>Local connector fixture</title><p>Mocked billing page: no real account or credentials</p>'}));
  const page=await context.newPage();await page.goto('https://platform.openai.com/settings/organization/billing/overview');
  await page.evaluate(url=>fetch(url,{headers:{Authorization:'Bearer sess-browser-fixture','OpenAI-Organization':'org-fixture'}}).then(r=>r.text()).catch(()=>null),API_URL);
  let imported=false;for(let i=0;i<40;i++){try{await fs.access(path.join(root,'openai-session.enc'));imported=true;break;}catch{}await new Promise(r=>setTimeout(r,100));}
  if(!imported)console.log(await worker.evaluate(async()=>({seen,storage:await chrome.storage.local.get('status')})));
  assert.ok(imported,'Browser extension must forward the request session to the local HUD');
  await context.close();context=null;
  assert.equal((await bridge.read()).balance.value,73.85);
  console.log('Extension fixture passed: real Chromium webRequest -> authenticated loopback -> session store -> balance read after browser closes. A deliberately invalid fixture session was sent only to the official read-only endpoint; no live account was used.');
 }finally{await context?.close();bridge.stop();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
