const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const executablePath=process.env.QUOTA_GLASS_VERIFY_EXE;
 const app=await electron.launch({args:executablePath?['--verify']:['.','--verify'],...(executablePath?{executablePath}:{}),env});
 try{
  const panel=await app.firstWindow();await panel.waitForSelector('.provider');
  await panel.evaluate(()=>window.quota.setOption('clashPing',false));await panel.locator('#ping').waitFor({state:'hidden'});
  const [settings]=await Promise.all([app.waitForEvent('window'),panel.evaluate(()=>window.quota.settings())]);
  await settings.locator('#clash-ping').check();
  await panel.waitForFunction(()=>{const el=document.getElementById('ping');return !el.hidden&&el.textContent!=='ping …';},{},{timeout:15000});
  const live=await panel.evaluate(()=>window.quota.get());
  assert.equal(live.options.clashPing,true);
  assert.equal(live.clash.status,'connected',live.clash.error);
  assert.match(await panel.locator('#ping').innerText(),/^ping \d+ms$/);
  await settings.locator('#clash-ping').scrollIntoViewIfNeeded();await settings.screenshot({path:'screenshots/clash-settings.png'});
  await settings.locator('#clash-ping').uncheck();await panel.locator('#ping').waitFor({state:'hidden'});
  // Disabling during a request must prevent an old result from restoring the indicator.
  await panel.evaluate(async()=>{await window.quota.setOption('clashPing',true);await window.quota.setOption('clashPing',false);});
  await new Promise(r=>setTimeout(r,800));assert.equal((await panel.evaluate(()=>window.quota.get())).clash,null);
  await settings.close();
  // Labeled fixture for layout and disconnected-state coverage, no account data.
  for(const scale of [0.6,1.4]){
   await panel.evaluate(value=>window.quota.setOption('scale',value),scale);
   await panel.evaluate(()=>render({...current,options:{...current.options,clashPing:true},clash:{status:'connected',delay:191,node:'Test node',group:'Test group'}}));
   const fits=await panel.evaluate(()=>document.querySelector('.update-status').getBoundingClientRect().right<document.querySelector('nav').getBoundingClientRect().left);
   assert.ok(fits,'Ping must not overlap footer buttons');
  }
  await panel.evaluate(()=>window.quota.setOption('scale',0.8));
  await panel.evaluate(()=>render({...current,options:{...current.options,clashPing:true},clash:{status:'connected',delay:191,node:'Test node',group:'Test group'}}));
  await panel.screenshot({path:'screenshots/clash-layout-fixture.png'});
  await panel.evaluate(()=>render({...current,clash:{status:'unavailable',delay:null,error:'Test unavailable'}}));assert.equal(await panel.locator('#ping').innerText(),'ping —');
  console.log('Clash passed: live node delay, settings toggle, disable cancels stale result, 60–140% footer layout and unavailable state.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
