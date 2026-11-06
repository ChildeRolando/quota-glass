const {_electron:electron}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:process.env.QUOTA_GLASS_VERIFY_EXE?['--verify']:['.','--verify'],
  ...(process.env.QUOTA_GLASS_VERIFY_EXE?{executablePath:process.env.QUOTA_GLASS_VERIFY_EXE}:{}),env,timeout:30000});
 try{
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector('.provider');
  assert.equal(await page.locator('.provider').count(),2);
  assert.equal(await page.evaluate(()=>typeof require),'undefined');
  await page.evaluate(()=>window.quota.setOption('scale',1));
  await page.waitForFunction(()=>innerWidth===552);
  const live=await page.evaluate(()=>window.quota.refresh());
  const cmd=page.locator('[data-provider="command"]');
  assert.equal(await cmd.locator('.ring-control[role="button"]').count(),3);
  const box=await cmd.locator('.meter-button').boundingBox();
  for(const [id,label,radius] of [['fiveHour','5h',54],['weekly','7d',72],['monthly','1m',90]]){
   await page.mouse.click(box.x+100+radius,box.y+100);
   assert.equal(await cmd.locator('.meter-period').textContent(),label);
   assert.equal(await cmd.locator(`[data-period="${id}"]`).getAttribute('aria-pressed'),'true');
  }
  await cmd.locator('[data-period="fiveHour"]').focus();await page.keyboard.press('Enter');
  assert.equal(await cmd.locator('.meter-period').textContent(),'5h');
  await page.mouse.move(0,0);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-provider=command] .ring-control:not(.selected) .ring-fill')).every(n=>getComputedStyle(n).stroke==='rgba(241, 243, 247, 0.58)'));
  const brightness=await cmd.evaluate(node=>({selected:getComputedStyle(node.querySelector('.selected .ring-fill')).stroke,outer:getComputedStyle(node.querySelector('[data-period=monthly] .ring-fill')).stroke,middle:getComputedStyle(node.querySelector('[data-period=weekly] .ring-fill')).stroke,title:getComputedStyle(node.querySelector('h2')).color}));
  assert.equal(brightness.outer,brightness.middle);assert.notEqual(brightness.outer,brightness.selected);assert.equal(brightness.title,brightness.selected);
  await page.mouse.click(box.x+190,box.y+100);
  const selection=await cmd.locator('.meter-period').textContent();
  for(const center of await page.locator('.meter-center').all())await center.click();
  assert.equal((await app.windows()).length,1,'Center text must not open settings');
  assert.equal(await cmd.locator('.meter-period').textContent(),selection,'Center text must not change periods');
  assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('.ring-control,.ring-hit,.meter-center,nav button')).every(node=>getComputedStyle(node).cursor==='default')),true);
  fs.mkdirSync('screenshots',{recursive:true});
  fs.writeFileSync('screenshots/live-status.json',JSON.stringify(live,null,2));
  await page.screenshot({path:'screenshots/live-panel.png',omitBackground:true});
  if(process.platform==='win32'){
   const native=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');return {handle:w.getNativeWindowHandle().readBigUInt64LE().toString(),pid:String(process.pid)};});
   const helper=process.env.QUOTA_GLASS_VERIFY_EXE?path.join(path.dirname(process.env.QUOTA_GLASS_VERIFY_EXE),'resources/app.asar.unpacked/src/native/GlassHelper.exe'):path.resolve('src/native/GlassHelper.exe');
   execFileSync(helper,[native.handle,native.pid,'--check'],{windowsHide:true,timeout:5000});
   execFileSync(helper,[native.handle,native.pid,'--hitcheck'],{windowsHide:true,timeout:5000});
  }
  const [preferences]=await Promise.all([app.waitForEvent('window'),page.getByRole('button',{name:'设置与连接状态',exact:true}).click()]);
  await preferences.waitForSelector('#connections .connection');
  assert.equal(await preferences.locator('#startup').isDisabled(),true,'Verification must not modify login items');
  await preferences.screenshot({path:'screenshots/live-settings.png'});
  await preferences.locator('#top').uncheck();
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass').isAlwaysOnTop()),false);
  await preferences.locator('#top').check();
  for(const scale of ['0.6','0.73','0.8','1','1.17','1.4']){
   await preferences.locator('#scale').fill(scale);
   await preferences.locator('#scale').dispatchEvent('change');
   await page.waitForFunction(async s=>(await window.quota.get()).options.scale===s,Number(scale));
   await page.waitForFunction(()=>Math.abs(innerHeight-414)<=2);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await preferences.locator('#scale').fill('0.8');
  await preferences.locator('#scale').dispatchEvent('change');
  await preferences.close();
  const actual=await page.evaluate(()=>window.quota.get());
  // Deliberate offline fixture: ensure failures do not display previous quota values.
  await page.evaluate(s=>render({...s,providers:s.providers.map(p=>({...p,status:'disconnected',windows:[],balance:null,updatedAt:null,error:'网络不可用'}))}),actual);
  assert.equal(await page.getByText('未连接',{exact:true}).count(),2);
  await page.screenshot({path:'screenshots/offline-panel.png',omitBackground:true});
  await page.evaluate(s=>render(s),actual);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({checks:'passed',providers:live.providers.map(p=>({name:p.name,status:p.status,error:p.error,windows:p.windows})),rendererErrors:errors},null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
