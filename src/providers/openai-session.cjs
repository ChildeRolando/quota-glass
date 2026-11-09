'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const BILLING_URL='https://platform.openai.com/settings/organization/billing/overview';
const API_URL='https://api.openai.com/dashboard/billing/credit_grants';
function normalizeCredits(data){
 if(!data||typeof data.total_available!=='number'||!Number.isFinite(data.total_available))throw new Error('openai_balance');
 return {windows:[],balance:{value:data.total_available,unit:'USD'},source:'OpenAI 官方余额接口 · 本机网页登录会话',plan:null};
}
function validateSession(data){
 const url=new URL(data.source);
 if(!['https://api.openai.com','https://platform.openai.com'].includes(url.origin)||!/^\/(?:v1\/)?dashboard\/billing\/credit_grants$/.test(url.pathname))throw new Error('invalid');
 if(typeof data.authorization!=='string'||data.authorization.length>16384||!/^Bearer \S+$/.test(data.authorization)||/^Bearer sk-/.test(data.authorization))throw new Error('invalid');
 const result={authorization:data.authorization};
 for(const key of ['organization','project']){const value=data[key]||'';if(typeof value!=='string'||value.length>256||/[\r\n]/.test(value))throw new Error('invalid');result[key]=value;}
 return result;
}
async function createOpenAiBilling({userData,fetch,safeStorage,shell,onChange=()=>{},signal,testing=false}){
 const folder=path.join(userData,'OpenAI余额连接扩展'),sessionFile=path.join(userData,'openai-session.enc'),connectionFile=path.join(userData,'openai-bridge.json');
 let secret,lastSession,pending,serverError=false,generation=0,captureAllowed=true;
 await fs.mkdir(userData,{recursive:true});
 try{const saved=JSON.parse(await fs.readFile(connectionFile,'utf8'));if(/^[a-f0-9]{64}$/.test(saved.token))secret=saved.token;if(saved.captureAllowed===false)captureAllowed=false;}catch{}
 secret ||= crypto.randomBytes(32).toString('hex');
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const origin=req.headers.origin;
  if(origin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)){res.writeHead(403).end();return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST');}
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  if(req.url!=='/session'||req.method!=='POST'||req.headers.authorization!=='Bearer '+secret){res.writeHead(403).end();return;}
  if(!captureAllowed){res.writeHead(409).end();return;}
  let body='';
  try{
   for await(const chunk of req){body+=chunk;if(body.length>32768){res.writeHead(413).end();return;}}
   const session=validateSession(JSON.parse(body)),acceptedGeneration=generation;
   if(!await safeStorage.isAsyncEncryptionAvailable())throw new Error('encryption');
   const serialized=JSON.stringify(session);
   if(serialized!==lastSession){
    const encrypted=await safeStorage.encryptStringAsync(serialized);
    if(!captureAllowed||generation!==acceptedGeneration){res.writeHead(409).end();return;}
    await fs.writeFile(sessionFile,encrypted,{mode:0o600});lastSession=serialized;generation++;onChange();
   }
   res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true}');
  }catch{res.writeHead(400).end();}
 });
 await new Promise(resolve=>{server.once('error',()=>{serverError=true;resolve();});server.listen(testing?0:48761,'127.0.0.1',resolve);});
 const port=server.address()?.port;
 if(!serverError){
  await fs.writeFile(connectionFile,JSON.stringify({token:secret,captureAllowed}),{mode:0o600});
  await fs.mkdir(folder,{recursive:true});
  const template=path.join(__dirname,'../browser/openai-connector');
  for(const name of ['manifest.json','worker.js','popup.html','popup.js','popup.css'])await fs.copyFile(path.join(template,name),path.join(folder,name));
  await fs.writeFile(path.join(folder,'connection.js'),'const CONNECTION='+JSON.stringify({url:`http://127.0.0.1:${port}`,token:secret})+';\n',{mode:0o600});
 }
 async function read(){
  if(!captureAllowed)throw new Error('openai_login');
  if(pending)return pending;
  pending=(async()=>{
   const readGeneration=generation;let credentials;
   try{credentials=JSON.parse((await safeStorage.decryptStringAsync(await fs.readFile(sessionFile))).result);}catch{throw new Error('openai_login');}
   const headers={Authorization:credentials.authorization,Accept:'application/json'};
   if(credentials.organization)headers['OpenAI-Organization']=credentials.organization;
   if(credentials.project)headers['OpenAI-Project']=credentials.project;
   let response;
   try{response=await fetch(API_URL,{headers,redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});}catch{throw new Error('connection');}
   if(response.status===401||response.status===403)throw new Error('openai_expired');
   if(!response.ok)throw new Error(response.status===429?'rate_limited':'connection');
   let data;try{data=await response.json();}catch{throw new Error('openai_balance');}
   if(generation!==readGeneration)throw new Error('openai_login');
   return normalizeCredits(data);
  })().finally(()=>{pending=null;});
  return pending;
 }
 return {read,url:BILLING_URL,folder,port,serverError,
  open:async()=>{captureAllowed=true;await fs.writeFile(connectionFile,JSON.stringify({token:secret,captureAllowed}),{mode:0o600});return shell.openExternal(BILLING_URL);},
  prepare:async()=>{if(serverError)throw new Error('openai_bridge');await shell.openPath(folder);return folder;},
  disconnect:async()=>{generation++;captureAllowed=false;await fs.writeFile(connectionFile,JSON.stringify({token:secret,captureAllowed}),{mode:0o600});await fs.rm(sessionFile,{force:true});lastSession=null;onChange();},
  stop:()=>{server.closeAllConnections();server.close();}
 };
}
module.exports={createOpenAiBilling,normalizeCredits,validateSession,BILLING_URL,API_URL};
