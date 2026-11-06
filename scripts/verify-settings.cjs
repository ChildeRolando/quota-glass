const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 for(const top of [true,false]){
  const app=await electron.launch({args:process.env.QUOTA_GLASS_VERIFY_EXE?['--verify']:['.','--verify'],...(process.env.QUOTA_GLASS_VERIFY_EXE?{executablePath:process.env.QUOTA_GLASS_VERIFY_EXE}:{}),env});
  try{
   const panel=await app.firstWindow();await panel.waitForSelector('.provider');
   await panel.evaluate(value=>window.quota.setOption('alwaysOnTop',value),top);
   await app.evaluate(({app})=>{
    global.settingsTrace=[];
    app.on('browser-window-created',(_,win)=>{
     const trace={createdVisible:win.isVisible(),painted:false,shownBeforePaint:false,closed:false,crashed:false};global.settingsTrace.push(trace);
     win.prependListener('ready-to-show',()=>{trace.painted=true;});
     win.on('show',()=>{if(!trace.painted)trace.shownBeforePaint=true;});
     win.on('closed',()=>{trace.closed=true;});
     win.webContents.on('render-process-gone',()=>{trace.crashed=true;});
    });
   });
   // Cover the first open while the initial quota request is still running.
   await panel.evaluate(()=>{void window.quota.refresh();});
   for(let opening=0;opening<2;opening++){
    const [page]=await Promise.all([app.waitForEvent('window'),panel.evaluate(()=>window.quota.settings())]);
    await page.waitForSelector('#connections .connection');
    await app.evaluate(async({BrowserWindow})=>{for(let i=0;i<50;i++){if(BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('设置'))?.isVisible())return;await new Promise(r=>setTimeout(r,20));}throw Error('Settings not shown');});
    const inspect=()=>app.evaluate(({BrowserWindow,screen})=>{
     const settings=BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('设置'));
     const panel=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');
     return {trace:global.settingsTrace.at(-1),visible:settings?.isVisible(),owned:settings?.getParentWindow()===panel,sameDisplay:settings&&screen.getDisplayMatching(settings.getBounds()).id===screen.getDisplayMatching(panel.getBounds()).id};
    });
    let result=await inspect();
    assert.equal(result.trace.createdVisible,false,'Do not flash an unpainted settings window');
    assert.equal(result.trace.shownBeforePaint,false);assert.equal(result.owned,true);assert.equal(result.sameDisplay,true);
    // A second click while already open reuses the same window.
    await panel.evaluate(()=>window.quota.settings());assert.equal((await app.windows()).length,2);
    await new Promise(r=>setTimeout(r,1500));result=await inspect();
    assert.equal(result.visible,true);assert.equal(result.trace.closed,false);assert.equal(result.trace.crashed,false);
    // Restore a minimized settings window instead of leaving it on the taskbar.
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('设置')).minimize());
    await panel.evaluate(()=>window.quota.settings());
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('设置')).isMinimized()),false);
    await page.close();
   }
   await panel.evaluate(()=>window.quota.setOption('alwaysOnTop',true));
  }finally{await app.close();}
 }
 console.log('Settings lifecycle passed: cold open, repeated open, recreate, minimize/restore, both pin states.');
})().catch(e=>{console.error(e);process.exitCode=1;});
