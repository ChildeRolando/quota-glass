const {execFile,spawn}=require('node:child_process');
const path=require('node:path');
const hosts=new Map(),starting=new Set(),opacity=new Map();
function setGlassOpacity(window,value){
 if(window.isDestroyed()||!Number.isFinite(value))return;
 opacity.set(window.id,Math.max(0,Math.min(1,value)));
 const host=hosts.get(window.id);
 if(host?.stdin.writable)host.stdin.write(opacity.get(window.id)+'\n');
}
function applyGlass(window){
 if(process.platform!=='win32'||window.isDestroyed()||hosts.has(window.id)||starting.has(window.id))return;
 starting.add(window.id);
 const handle=window.getNativeWindowHandle();
 const value=handle.length>=8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
 const file=path.join(__dirname,'GlassHelper.exe').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
 execFile(file,[value,String(process.pid)],{windowsHide:true,timeout:5000},error=>{
  starting.delete(window.id);
  if(error)console.warn('Native panel boundary update failed:',error.code);
  if(window.isDestroyed())return;
  const host=spawn(file.replace('GlassHelper.exe','GlassBackdrop.exe'),[value,String(process.pid)],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  hosts.set(window.id,host);
  host.stdin.on('error',()=>{});
  host.stderr.on('data',data=>console.warn(String(data).slice(0,200)));
  host.on('error',()=>console.warn('Native backdrop could not start.'));
  host.on('exit',()=>{if(hosts.get(window.id)===host)hosts.delete(window.id);});
  setGlassOpacity(window,opacity.get(window.id)??0.28);
  window.once('closed',()=>{host.kill();hosts.delete(window.id);opacity.delete(window.id);});
 });
}
function stopGlass(){for(const host of hosts.values())host.kill();hosts.clear();opacity.clear();}
module.exports={applyGlass,setGlassOpacity,stopGlass};
