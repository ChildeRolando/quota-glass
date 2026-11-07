const {_electron:electron}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:process.env.QUOTA_GLASS_VERIFY_EXE?['--verify']:['.','--verify'],...(process.env.QUOTA_GLASS_VERIFY_EXE?{executablePath:process.env.QUOTA_GLASS_VERIFY_EXE}:{}),env});
 try{
  const page=await app.firstWindow();await page.waitForSelector('.provider');
  const handles=await app.evaluate(async({BrowserWindow})=>{
   const panel=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');
   global.pinTestBounds=panel.getBounds();panel.setPosition(-20000,-20000);
   global.pinTestOther=new BrowserWindow({x:-20000,y:-20000,width:800,height:700,title:'Quota Glass stacking verification',show:false,alwaysOnTop:false,skipTaskbar:true});
   await global.pinTestOther.loadURL('data:text/html,<body>Window stacking verification</body>');
   global.pinTestOther.showInactive();
   return {panel:panel.getNativeWindowHandle().readBigUInt64LE().toString(),other:global.pinTestOther.getNativeWindowHandle().readBigUInt64LE().toString(),pid:String(process.pid)};
  });
  const helper=process.env.QUOTA_GLASS_VERIFY_EXE?path.join(path.dirname(process.env.QUOTA_GLASS_VERIFY_EXE),'resources/app.asar.unpacked/src/native/GlassHelper.exe'):path.resolve('src/native/GlassHelper.exe');
  const check=async pinned=>{
   await app.evaluate(()=>{global.pinTestOther.show();global.pinTestOther.focus();});
   await new Promise(r=>setTimeout(r,250));
   execFileSync(helper,[handles.panel,handles.pid,'--stackcheck',String(pinned),handles.other],{windowsHide:true,timeout:5000});
  };
  // Check the restored startup preference, not just an explicit toggle.
  await check((await page.evaluate(()=>window.quota.get())).options.alwaysOnTop);
  for(const pinned of [false,true,false,true]){
   await page.evaluate(v=>window.quota.setOption('alwaysOnTop',v),pinned);await check(pinned);
  }
  await page.evaluate(()=>window.quota.setOption('scale',1.07));await check(true);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');w.hide();w.showInactive();});await check(true);
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass').isAlwaysOnTop()),true);
  console.log('Native stacking passed: startup, pin/unpin, resize, hide/show; HUD and backdrop both above a raised normal window only when pinned.');
 }finally{
  await app.evaluate(({BrowserWindow})=>{global.pinTestOther?.destroy();const panel=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');if(panel&&global.pinTestBounds)panel.setBounds(global.pinTestBounds);});
  await app.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
