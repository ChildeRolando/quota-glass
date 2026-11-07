const {_electron:electron}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const executablePath=process.env.QUOTA_GLASS_VERIFY_EXE;
 const helper=executablePath?path.join(path.dirname(executablePath),'resources/app.asar.unpacked/src/native/GlassHelper.exe'):path.resolve('src/native/GlassHelper.exe');
 for(const restart of [false,true]){
  const app=await electron.launch({args:executablePath?['--verify']:['.','--verify'],...(executablePath?{executablePath}:{}),env});
  try{
   const page=await app.firstWindow();await page.waitForSelector('.provider');
   const native=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');return {handle:w.getNativeWindowHandle().readBigUInt64LE().toString(),pid:String(process.pid)};});
   const check=async locked=>{
    await new Promise(r=>setTimeout(r,300));
    assert.equal((await page.evaluate(()=>window.quota.get())).options.locked,locked);
    execFileSync(helper,[native.handle,native.pid,'--lockcheck',String(locked)],{windowsHide:true,timeout:5000});
   };
   if(restart)await check(true);
   await app.evaluate(({Menu})=>{const build=Menu.buildFromTemplate;Menu.buildFromTemplate=function(template){const result=build.call(this,template);global.lockTestMenu=result;return result;};});
   await page.evaluate(()=>window.quota.setOption('locked',false));await check(false);
   assert.deepEqual(await app.evaluate(()=>global.lockTestMenu.items.map(i=>i.label)),['显示','置顶','锁定','设置','退出']);
   for(const locked of [true,false,true]){
    await app.evaluate(()=>global.lockTestMenu.getMenuItemById('lock').click());
    await check(locked);
    assert.equal(await app.evaluate(()=>global.lockTestMenu.getMenuItemById('lock').checked),locked);
   }
   for(const key of ['visibility','visibility'])await app.evaluate((_electron,id)=>global.lockTestMenu.getMenuItemById(id).click(),key);
   await check(true);
   if(restart){await page.evaluate(()=>window.quota.setOption('locked',false));await check(false);}
  }finally{await app.close();}
 }
 console.log('Lock passed: tray toggles native mouse transparency on HUD, glass remains input-transparent, show/hide and restart preserve lock, unlocking restores input.');
})().catch(e=>{console.error(e);process.exitCode=1;});
