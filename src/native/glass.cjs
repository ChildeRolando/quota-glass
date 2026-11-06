const {execFile,spawn}=require('node:child_process');
const path=require('node:path');
let running=false,pending=null;
const hosts=new Map();
function applyGlass(window){
 if(process.platform!=='win32'||window.isDestroyed())return;
 if(running){pending=window;return;}
 running=true;
 const handle=window.getNativeWindowHandle();
 const value=handle.length>=8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
 const file=path.join(__dirname,'GlassHelper.exe').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
 execFile(file,[value,String(process.pid)],{windowsHide:true,timeout:5000},error=>{
  if(error)console.warn('Native panel boundary update failed:',error.code);
  if(!window.isDestroyed()&&!hosts.has(window.id)){
   const host=spawn(file.replace('GlassHelper.exe','GlassBackdrop.exe'),[value,String(process.pid)],{windowsHide:true,stdio:['ignore','ignore','pipe']});
   hosts.set(window.id,host);
   host.stderr.on('data',data=>console.warn(String(data).slice(0,200)));
   host.on('error',()=>console.warn('Native backdrop could not start.'));
   window.once('closed',()=>{host.kill();hosts.delete(window.id);});
  }
  running=false;if(pending){const next=pending;pending=null;applyGlass(next);}
 });
}
function stopGlass(){for(const host of hosts.values())host.kill();hosts.clear();}
module.exports={applyGlass,stopGlass};
