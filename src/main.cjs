'use strict';
const { app,BrowserWindow,ipcMain,Tray,Menu,nativeImage,globalShortcut,screen,net,nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {providers,readProvider} = require('./providers/index.cjs');
const {applyGlass,stopGlass}=require('./native/glass.cjs');
const testing = process.argv.includes('--verify');
if (testing) app.setPath('userData',path.join(app.getPath('temp'),'quota-glass-verify'));
let panel,settings,tray,timer,busy=false,quitting=false;
let dragOrigin=null,glassTimer;
const lifetime=new AbortController();
let options={scale:0.8,alwaysOnTop:true}, snapshots=providers.map(p=>({id:p.id,name:p.name,icon:p.icon,status:'loading',windows:[],updatedAt:null}));
let lastAttempt=null;
const configFile=()=>path.join(app.getPath('userData'),'settings.json');
function saveOptions() { try { fs.mkdirSync(app.getPath('userData'),{recursive:true}); fs.writeFileSync(configFile(),JSON.stringify(options,null,2)); } catch {} }
function startupState(){
  const available=process.platform==='win32'&&app.isPackaged&&!testing;
  if(!available)return {available:false,enabled:false,error:''};
  try {const item=app.getLoginItemSettings({path:process.execPath,args:[]});return {available:true,enabled:item.openAtLogin&&item.executableWillLaunchAtLogin,error:''};}
  catch{return {available:false,enabled:false,error:'无法读取开机启动状态'};}
}
function state() {return {providers:snapshots,options,busy,lastAttempt,startup:startupState()};}
function broadcast() { for(const win of [panel,settings]) if(win && !win.isDestroyed()) win.webContents.send('quota:update',state()); }
async function refresh() {
  if(busy) return state();
  busy=true;broadcast();
  try { snapshots=await Promise.all(providers.map(p=>readProvider(p,{fetch:net.fetch.bind(net),signal:lifetime.signal})));lastAttempt=Date.now(); }
  finally { busy=false;broadcast(); }
  return state();
}
function clampPosition(bounds) {
  const area=screen.getDisplayMatching(bounds).workArea;
  return {x:Math.round(Math.max(area.x,Math.min(bounds.x,area.x+area.width-bounds.width))),
    y:Math.round(Math.max(area.y,Math.min(bounds.y,area.y+area.height-bounds.height)))};
}
function resizePanel() {
  const width=Math.round((82+235*providers.length)*options.scale),height=Math.round(414*options.scale);
  const old=panel.getBounds();
  panel.setBounds({...clampPosition({...old,width,height}),width,height});
  panel.webContents.setZoomFactor(options.scale);
  applyGlass(panel);
}
function scheduleGlass(){clearTimeout(glassTimer);glassTimer=setTimeout(()=>{if(panel&&!panel.isDestroyed())applyGlass(panel);},100);}
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
    {label:'显示悬浮面板',click:()=>{panel.show();panel.focus();}},
    {label:'刷新额度',enabled:!busy,click:refresh},
    {label:'始终置顶',type:'checkbox',checked:options.alwaysOnTop,click:item=>setOption('alwaysOnTop',item.checked)},
    {label:'面板大小…',click:openSettings},
    {label:'设置与连接状态',click:openSettings},
    {type:'separator'},
    {label:'退出',click:()=>{quitting=true;app.quit();}}
  ]));
}
function setOption(key,value) {
  if(key==='scale' && Number.isFinite(value) && value>=0.6 && value<=1.4) {options.scale=Math.round(value*100)/100;resizePanel();}
  else if(key==='alwaysOnTop' && typeof value==='boolean') {options.alwaysOnTop=value;panel.setAlwaysOnTop(value);}
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
    if(Number.isFinite(saved.scale)&&saved.scale>=0.6&&saved.scale<=1.4)options.scale=Math.round(saved.scale*100)/100;
    if(typeof saved.alwaysOnTop==='boolean')options.alwaysOnTop=saved.alwaysOnTop;
    if(Number.isFinite(saved.x)&&Number.isFinite(saved.y)){options.x=saved.x;options.y=saved.y;}
  }catch{}
  nativeTheme.themeSource='dark';
  const area=screen.getPrimaryDisplay().workArea;
  panel=new BrowserWindow({width:442,height:331,x:options.x??area.x+area.width-470,y:options.y??area.y+40,
    title:'Quota Glass',frame:false,transparent:true,backgroundColor:'#00000000',thickFrame:false,roundedCorners:false,
    hasShadow:false,resizable:false,maximizable:false,fullscreenable:false,skipTaskbar:true,
    alwaysOnTop:options.alwaysOnTop,show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(panel);
  panel.on('close',e=>{if(!quitting&&!testing){e.preventDefault();panel.hide();}});
  panel.on('moved',()=>{const b=panel.getBounds();if(options.x!==b.x||options.y!==b.y){options.x=b.x;options.y=b.y;saveOptions();scheduleGlass();}});
  panel.on('show',scheduleGlass);
  panel.webContents.once('did-finish-load',()=>{resizePanel();panel.show();});
  const icon=nativeImage.createFromPath(path.join(__dirname,'ui/tray.png'));
  tray=new Tray(icon);tray.setToolTip('Quota Glass · 订阅额度');tray.on('double-click',()=>panel.show());trayMenu();
  globalShortcut.register('CommandOrControl+Shift+Q',()=>panel.isVisible()?panel.hide():panel.show());
  screen.on('display-removed',()=>resizePanel());
  screen.on('display-metrics-changed',()=>resizePanel());
  ipcMain.handle('quota:get',()=>state());
  ipcMain.handle('quota:refresh',refresh);
  ipcMain.handle('quota:settings',()=>{openSettings();return true;});
  ipcMain.handle('quota:hide',()=>{panel.hide();return true;});
  ipcMain.handle('quota:option',(_e,key,value)=>setOption(key,value));
  ipcMain.on('quota:drag',(event,phase)=>{
    if(event.sender!==panel.webContents)return;
    if(phase==='start')dragOrigin={cursor:screen.getCursorScreenPoint(),bounds:panel.getBounds()};
    else if(phase==='move'&&dragOrigin){const cursor=screen.getCursorScreenPoint();panel.setPosition(dragOrigin.bounds.x+cursor.x-dragOrigin.cursor.x,dragOrigin.bounds.y+cursor.y-dragOrigin.cursor.y);}
    else if(phase==='end')dragOrigin=null;
  });
  await panel.loadFile(path.join(__dirname,'ui/index.html'));
  if(!testing) {refresh();timer=setInterval(refresh,60000);}
 });
 app.on('before-quit',()=>{quitting=true;lifetime.abort();clearInterval(timer);clearTimeout(glassTimer);stopGlass();globalShortcut.unregisterAll();tray?.destroy();});
 app.on('window-all-closed',()=>{if(testing)app.quit();});
}
