const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:process.env.QUOTA_GLASS_VERIFY_EXE?['--verify']:['.','--verify'],...(process.env.QUOTA_GLASS_VERIFY_EXE?{executablePath:process.env.QUOTA_GLASS_VERIFY_EXE}:{}),env});
 try{
  const panel=await app.firstWindow();await panel.waitForSelector('.provider');
  await app.evaluate(({Menu})=>{const build=Menu.buildFromTemplate;Menu.buildFromTemplate=function(template){const result=build.call(this,template);global.testTrayMenu=result;return result;};});
  await panel.evaluate(()=>window.quota.setOption('alwaysOnTop',true));
  assert.deepEqual(await app.evaluate(()=>global.testTrayMenu.items.map(i=>i.label)),['显示','置顶','锁定','设置','退出']);
  for(const visible of [false,true,false,true]){
   await app.evaluate(()=>global.testTrayMenu.getMenuItemById('visibility').click());
   assert.equal(await panel.evaluate(()=>window.quota.get()).then(s=>s.visible),visible);
   assert.equal(await app.evaluate(()=>global.testTrayMenu.getMenuItemById('visibility').checked),visible);
  }
  // Settings remain usable when opened from the tray with the overlay hidden.
  await app.evaluate(()=>global.testTrayMenu.getMenuItemById('visibility').click());
  const [settings]=await Promise.all([app.waitForEvent('window'),app.evaluate(()=>global.testTrayMenu.getMenuItemById('settings').click())]);
  await settings.waitForSelector('#scale');
  await settings.locator('#scale').fill('0.8');await settings.locator('#scale').dispatchEvent('change');
  assert.equal((await panel.evaluate(()=>window.quota.get())).visible,false);
  await app.evaluate(()=>global.testTrayMenu.getMenuItemById('visibility').click());
  // Sample while input events are STILL arriving, before any change / pointerup.
  await app.evaluate(({BrowserWindow})=>{global.resizeSamples=[];BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass').on('resize',()=>global.resizeSamples.push(Date.now()));});
  const samples=await settings.evaluate(async()=>{
   const slider=document.getElementById('scale'),result=[];
   for(let i=0;i<28;i++){
    const requested=0.1+i*0.04517;slider.value=String(requested);slider.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,20));
    result.push({requested,actual:(await window.quota.get()).options.scale});
   }
   slider.dispatchEvent(new Event('change',{bubbles:true}));return result;
  });
  assert.ok(new Set(samples.slice(0,-1).map(s=>s.actual)).size>=20,'Window must resize during drag, not only after a pause');
  const errors=samples.slice(3,-1).map(s=>Math.abs(s.actual-s.requested));
  assert.ok(Math.max(...errors)<0.08&&errors.reduce((a,b)=>a+b,0)/errors.length<0.03,'Live size must follow slider: '+JSON.stringify(samples));
  assert.ok(await app.evaluate(()=>global.resizeSamples.length)>=20);
  // Layout fills the native client area at non-preset sizes; no repeated zoom.
  await panel.waitForFunction(()=>Math.abs(document.querySelector('.glass').getBoundingClientRect().width-innerWidth)<1);
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass').webContents.getZoomFactor()),1);
  for(const value of ['0.2','0.73','0.9']){
   await settings.locator('#transparency').fill(value);await settings.locator('#transparency').dispatchEvent('change');
   await panel.waitForFunction(v=>Math.abs(Number(getComputedStyle(document.documentElement).getPropertyValue('--glass-density'))-(1-v))<0.001,Number(value));
  }
  await settings.locator('#transparency').fill('0.55');await settings.locator('#transparency').dispatchEvent('change');
  await settings.locator('#scale').fill('0.8');await settings.locator('#scale').dispatchEvent('change');
  await panel.waitForFunction(()=>Math.abs(innerWidth-(82+235*document.querySelectorAll('.provider').length)*0.8)<=1);
  await new Promise(r=>setTimeout(r,100));
  const native=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');return {handle:w.getNativeWindowHandle().readBigUInt64LE().toString(),pid:String(process.pid)};});
  const helper=process.env.QUOTA_GLASS_VERIFY_EXE?path.join(path.dirname(process.env.QUOTA_GLASS_VERIFY_EXE),'resources/app.asar.unpacked/src/native/GlassHelper.exe'):path.resolve('src/native/GlassHelper.exe');
  for(const mode of ['--check','--hitcheck','--edgecheck'])execFileSync(helper,[native.handle,native.pid,mode],{windowsHide:true,timeout:5000});
  await settings.locator('#transparency').scrollIntoViewIfNeeded();
  await settings.screenshot({path:'screenshots/appearance-settings.png'});
  console.log('Appearance passed: five tray actions, repeated show/hide, hidden-panel settings, continuous drag samples, transparency, rounded client area and native resize edge.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
