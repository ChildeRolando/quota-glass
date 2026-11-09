const {_electron:electron}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const executablePath=process.env.QUOTA_GLASS_VERIFY_EXE;
 const app=await electron.launch({args:executablePath?['--verify']:['.','--verify'],...(executablePath?{executablePath}:{}),env});
 try{
  assert.ok(await app.evaluate(async({safeStorage})=>{const plain='quota-glass-encryption-fixture';const encrypted=await safeStorage.encryptStringAsync(plain);return !encrypted.includes(Buffer.from(plain))&&(await safeStorage.decryptStringAsync(encrypted)).result===plain;}),'OS encryption must round-trip without plaintext storage');
  const page=await app.firstWindow();await page.waitForSelector('.provider');
  assert.equal(await page.locator('.provider').count(),3);
  const original=await page.evaluate(()=>window.quota.get());
  for(const value of [0,73.85,12345.67]){
   await page.evaluate(({state,value})=>render({...state,providers:state.providers.map(p=>p.id==='openai'?{...p,status:'connected',windows:[],balance:{value,unit:'USD'},updatedAt:Date.now()}:p)}),{state:original,value});
   const card=page.locator('[data-provider=openai]');
   assert.equal(await card.locator('.meter-value').innerText(),'$'+value.toFixed(2));
   assert.equal(await card.locator('.meter-period').innerText(),'余额');assert.equal(await card.locator('.countdown').innerText(),'USD');
   assert.equal(await card.locator('[role=button]').count(),0);
  }
  for(const scale of [0.6,0.8,1.4]){
   await page.evaluate(value=>window.quota.setOption('scale',value),scale);
   await page.waitForFunction(value=>Math.abs(innerWidth-787*value)<=1,scale);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.evaluate(()=>window.quota.setOption('scale',0.8));
  await page.evaluate(s=>render({...s,providers:s.providers.map(p=>p.id==='openai'?{...p,status:'connected',windows:[],balance:{value:73.85,unit:'USD'},updatedAt:Date.now()}:p)}),original);
  await page.screenshot({path:'screenshots/openai-layout-fixture.png',omitBackground:true});
  await page.evaluate(s=>render({...s,providers:s.providers.map(p=>({...p,status:'disconnected',balance:null,windows:[]}))}),original);
  assert.equal(await page.locator('[data-provider=openai] .meter-value').innerText(),'—');
  const [settings]=await Promise.all([app.waitForEvent('window'),page.evaluate(()=>window.quota.settings())]);
  await settings.getByRole('button',{name:'连接 OpenAI 账单'}).waitFor();
  await settings.screenshot({path:'screenshots/openai-settings.png'});
  console.log('OpenAI layout passed: three peer providers, USD balance incl. zero, no fake percentage ring, unknown on disconnect, settings connection action, 60–140% layout. Live login/balance is a separate acceptance step.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
