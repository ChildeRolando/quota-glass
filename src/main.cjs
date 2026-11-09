'use strict';
const { app,BrowserWindow,ipcMain,Tray,Menu,nativeImage,globalShortcut,screen,net,nativeTheme,shell,safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {providers,readProvider} = require('./providers/index.cjs');
const {applyGlass,setGlassOpacity,stopGlass}=require('./native/glass.cjs');
const {createOpenAiBilling}=require('./providers/openai-session.cjs');
const {readClash}=require('./extensions/clash.cjs');
const testing = process.argv.includes('--verify');
if (testing) app.setPath('userData',path.join(app.getPath('temp'),'quota-glass-verify'));
let openAiBilling;
let panel,settings,tray,timer,busy=false,quitting=false;
let dragOrigin=null,saveTimer;
const panelWidth=82+235*providers.length,panelHeight=414;
const lifetime=new AbortController();
let options={scale:0.8,transparency:0.55,alwaysOnTop:true,locked:false,clashPing:false}, snapshots=providers.map(p=>({id:p.id,name:p.name,icon:p.icon,display:p.display,status:'loading',windows:[],updatedAt:null}));
let lastAttempt=null,clash=null,pingController;
async function refreshPing(){
  pingController?.abort();
  if(!options.clashPing){clash=null;return;}
  const controller=new AbortController();pingController=controller;
  clash={status:'loading',delay:null};broadcast();
  const result=await readClash({appData:app.getPath('appData'),signal:AbortSignal.any([controller.signal,lifetime.signal])});
  if(pingController===controller&&!controller.signal.aborted){clash=result;broadcast();}
}
const configFile=()=>path.join(app.getPath('userData'),'settings.json');
function saveOptions() { try { fs.mkdirSync(app.getPath('userData'),{recursive:true}); fs.writeFileSync(configFile(),JSON.stringify(options,null,2)); } catch {} }
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveOptions,180);}
function appearance(){for(const win of [panel,settings])if(win&&!win.isDestroyed())win.webContents.send('quota:appearance',options);}
function applyPin(){
  // Explicit Windows level: the default floating level does not reliably set
  // WS_EX_TOPMOST in this runtime. Reapply whenever the overlay is shown.
  panel.setAlwaysOnTop(options.alwaysOnTop,options.alwaysOnTop?'pop-up-menu':'normal');
}
function applyLock(){dragOrigin=null;panel.setIgnoreMouseEvents(options.locked);}
function togglePanel(){if(panel.isVisible())panel.hide();else{panel.show();panel.focus();}}
function startupState(){
  const available=process.platform==='win32'&&app.isPackaged&&!testing;
  if(!available)return {available:false,enabled:false,error:''};
  try {const item=app.getLoginItemSettings({path:process.execPath,args:[]});return {available:true,enabled:item.openAtLogin&&item.executableWillLaunchAtLogin,error:''};}
  catch{return {available:false,enabled:false,error:'无法读取开机启动状态'};}
}
function state() {return {providers:snapshots,options,visible:panel?.isVisible()??false,busy,lastAttempt,clash,startup:startupState()};}
function broadcast() { for(const win of [panel,settings]) if(win && !win.isDestroyed()) win.webContents.send('quota:update',state()); }
async function refreshOpenAi(){
 const index=providers.findIndex(p=>p.id==='openai');
 snapshots[index]=await readProvider(providers[index],{readOpenAiBalance:()=>openAiBilling.read()});broadcast();
}
async function refresh() {
  if(busy) return state();
  busy=true;broadcast();void refreshPing();
  try { snapshots=await Promise.all(providers.map(p=>readProvider(p,{fetch:net.fetch.bind(net),signal:lifetime.signal,readOpenAiBalance:()=>openAiBilling.read()})));lastAttempt=Date.now(); }
  finally { busy=false;broadcast(); }
  return state();
}
function clampPosition(bounds) {
  const area=screen.getDisplayMatching(bounds).workArea;
  return {x:Math.round(Math.max(area.x,Math.min(bounds.x,area.x+area.width-bounds.width))),
    y:Math.round(Math.max(area.y,Math.min(bounds.y,area.y+area.height-bounds.height)))};
}
function resizePanel() {
  const width=Math.round(panelWidth*options.scale),height=Math.round(panelHeight*options.scale);
  const old=panel.getBounds();
  panel.setBounds({...clampPosition({...old,width,height}),width,height});
}
function setAppearance(key,value){
  if(!Number.isFinite(value))return false;
  if(key==='scale'&&value>=0.6&&value<=1.4){options.scale=value;resizePanel();}
  else if(key==='transparency'&&value>=0.2&&value<=0.9){
    options.transparency=value;setGlassOpacity(panel,0.28*(1-value)/0.45);
  }else return false;
  appearance();return true;
}
function secureWindow(win) {
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
}
let settingsReady=false;
function presentSettings(win){
  if(win.isDestroyed())return;
  if(win.isMinimized())win.restore();
  win.show();win.focus();
}
function openSettings() {
  if(settings && !settings.isDestroyed()) {
    if(settingsReady)presentSettings(settings);
    return;
  }
  settingsReady=false;
  const area=screen.getDisplayMatching(panel.getBounds()).workArea;
  const width=Math.min(630,area.width),height=Math.min(690,area.height);
  const win=new BrowserWindow({width,height,minWidth:Math.min(530,width),minHeight:Math.min(560,height),
    x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),
    title:'Quota Glass · 设置',parent:panel,show:false,
    backgroundColor:'#151e2b',autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  settings=win;
  // Own the settings window and activate it only after its first paint. The initial
  // creation path must not briefly show an unready, unowned window behind other apps.
  win.once('ready-to-show',()=>{if(settings===win){settingsReady=true;presentSettings(win);}});
  win.once('closed',()=>{if(settings===win){settings=null;settingsReady=false;}});
  secureWindow(win);
  win.loadFile(path.join(__dirname,'ui/settings.html')).catch(()=>{
    console.warn('Settings page could not load.');if(!win.isDestroyed())win.destroy();
  });
}
function trayMenu() {
  if(!tray)return;
  tray.setContextMenu(Menu.buildFromTemplate([
    {id:'visibility',label:'显示',type:'checkbox',checked:panel.isVisible(),click:togglePanel},
    {id:'pin',label:'置顶',type:'checkbox',checked:options.alwaysOnTop,click:item=>setOption('alwaysOnTop',item.checked)},
    {id:'lock',label:'锁定',type:'checkbox',checked:options.locked,click:item=>setOption('locked',item.checked)},
    {id:'settings',label:'设置',click:openSettings},
    {label:'退出',click:()=>{quitting=true;app.quit();}}
  ]));
}
function setOption(key,value) {
  if(key==='scale'||key==='transparency'){if(!setAppearance(key,value))return state();}
  else if(key==='alwaysOnTop' && typeof value==='boolean') {options.alwaysOnTop=value;applyPin();}
  else if(key==='locked'&&typeof value==='boolean'){options.locked=value;applyLock();}
  else if(key==='clashPing'&&typeof value==='boolean'){options.clashPing=value;void refreshPing();}
  else if(key==='startup'&&typeof value==='boolean'&&startupState().available){
    try{app.setLoginItemSettings({openAtLogin:value,enabled:value,path:process.execPath,args:[]});}
    catch{return {...state(),startup:{...startupState(),error:'无法修改开机启动，请重试'}};}
    const result=state();broadcast();
    if(result.startup.enabled!==value)result.startup.error='开机启动未生效，请检查 Windows 启动应用设置';
    return result;
  }
  else return state();
  saveOptions();trayMenu();broadcast();return state();
}
if(!testing && !app.requestSingleInstanceLock()) app.quit();
else {
 app.on('second-instance',()=>{panel?.show();panel?.focus();});
 app.whenReady().then(async()=>{
  try {const saved=JSON.parse(fs.readFileSync(configFile(),'utf8'));
    if(Number.isFinite(saved.scale)&&saved.scale>=0.6&&saved.scale<=1.4)options.scale=saved.scale;
    if(Number.isFinite(saved.transparency)&&saved.transparency>=0.2&&saved.transparency<=0.9)options.transparency=saved.transparency;
    if(typeof saved.alwaysOnTop==='boolean')options.alwaysOnTop=saved.alwaysOnTop;
    if(typeof saved.locked==='boolean')options.locked=saved.locked;
    if(typeof saved.clashPing==='boolean')options.clashPing=saved.clashPing;
    if(Number.isFinite(saved.x)&&Number.isFinite(saved.y)){options.x=saved.x;options.y=saved.y;}
  }catch{}
  openAiBilling=await createOpenAiBilling({userData:app.getPath('userData'),fetch:net.fetch.bind(net),safeStorage,shell,signal:lifetime.signal,testing,onChange:()=>{if(panel&&!quitting)void refreshOpenAi();}});
  nativeTheme.themeSource='dark';
  const area=screen.getPrimaryDisplay().workArea;
  panel=new BrowserWindow({width:Math.round(panelWidth*options.scale),height:Math.round(panelHeight*options.scale),x:options.x??area.x+area.width-Math.round(panelWidth*options.scale)-28,y:options.y??area.y+40,
    title:'Quota Glass',frame:false,transparent:true,backgroundColor:'#00000000',thickFrame:true,roundedCorners:false,
    hasShadow:false,resizable:true,maximizable:false,fullscreenable:false,skipTaskbar:true,
    alwaysOnTop:options.alwaysOnTop,show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(panel);
  panel.setMinimumSize(Math.round(panelWidth*0.6),Math.round(panelHeight*0.6));
  panel.setMaximumSize(Math.round(panelWidth*1.4),Math.round(panelHeight*1.4));
  panel.setAspectRatio(panelWidth/panelHeight);
  panel.on('resize',()=>{
    const bounds=panel.getBounds();options.scale=Math.max(0.6,Math.min(1.4,bounds.width/panelWidth));
    appearance();saveSoon();
  });
  panel.on('close',e=>{if(!quitting&&!testing){e.preventDefault();panel.hide();}});
  panel.on('moved',()=>{const b=panel.getBounds();if(options.x!==b.x||options.y!==b.y){options.x=b.x;options.y=b.y;saveSoon();}});
  panel.on('show',()=>{applyPin();applyLock();applyGlass(panel);trayMenu();});
  panel.on('hide',trayMenu);
  panel.webContents.once('did-finish-load',()=>{panel.webContents.setZoomFactor(1);resizePanel();setGlassOpacity(panel,0.28*(1-options.transparency)/0.45);panel.show();});
  const icon=nativeImage.createFromPath(path.join(__dirname,'ui/tray.png'));
  tray=new Tray(icon);tray.setToolTip('Quota Glass · 订阅额度');tray.on('double-click',togglePanel);trayMenu();
  globalShortcut.register('CommandOrControl+Shift+Q',togglePanel);
  screen.on('display-removed',()=>resizePanel());
  screen.on('display-metrics-changed',()=>resizePanel());
  ipcMain.handle('quota:get',()=>state());
  ipcMain.handle('quota:refresh',refresh);
  ipcMain.handle('quota:settings',()=>{openSettings();return true;});
  ipcMain.handle('quota:openai-billing',()=>openAiBilling.open());
  ipcMain.handle('quota:openai-extension',async()=>{try{return {folder:await openAiBilling.prepare()};}catch{return {error:'本机余额连接端口不可用，请重启 HUD 后重试。'};}});
  ipcMain.handle('quota:openai-disconnect',()=>openAiBilling.disconnect());
  ipcMain.handle('quota:hide',()=>{panel.hide();return true;});
  ipcMain.on('quota:preview-option',(event,key,value)=>{if(event.sender===settings?.webContents&&setAppearance(key,value))saveSoon();});
  ipcMain.handle('quota:option',(_e,key,value)=>setOption(key,value));
  ipcMain.on('quota:drag',(event,phase)=>{
    if(event.sender!==panel.webContents||options.locked)return;
    if(phase==='start')dragOrigin={cursor:screen.getCursorScreenPoint(),bounds:panel.getBounds()};
    else if(phase==='move'&&dragOrigin){const cursor=screen.getCursorScreenPoint();panel.setPosition(dragOrigin.bounds.x+cursor.x-dragOrigin.cursor.x,dragOrigin.bounds.y+cursor.y-dragOrigin.cursor.y);}
    else if(phase==='end')dragOrigin=null;
  });
  await panel.loadFile(path.join(__dirname,'ui/index.html'));
  if(!testing) {refresh();timer=setInterval(refresh,60000);}
 });
 app.on('before-quit',()=>{quitting=true;lifetime.abort();clearInterval(timer);clearTimeout(saveTimer);saveOptions();openAiBilling?.stop();stopGlass();globalShortcut.unregisterAll();tray?.destroy();});
 app.on('window-all-closed',()=>{if(testing)app.quit();});
}
