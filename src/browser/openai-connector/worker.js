'use strict';
importScripts('connection.js');
let forwarding=false;
const billingUrl='https://platform.openai.com/settings/organization/billing/overview';
async function status(text){await chrome.storage.local.set({status:text});}
chrome.webRequest.onBeforeSendHeaders.addListener(details=>{
 const url=new URL(details.url);
 if(!/^\/(?:v1\/)?dashboard\/billing\/credit_grants$/.test(url.pathname)||details.method!=='GET')return;
 if(details.initiator!=='https://platform.openai.com'||forwarding)return;
 const headers=Object.fromEntries((details.requestHeaders||[]).map(h=>[h.name.toLowerCase(),h.value]));
 const auth=headers.authorization;
 if(typeof auth!=='string'||!/^Bearer\s+\S+$/.test(auth)||/^Bearer\s+sk-/.test(auth))return;
 forwarding=true;
 fetch(CONNECTION.url+'/session',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+CONNECTION.token},body:JSON.stringify({authorization:auth,organization:headers['openai-organization']||'',project:headers['openai-project']||'',source:details.url}),signal:AbortSignal.timeout(8000)})
 .then(async r=>{if(!r.ok)throw new Error();await status('会话已交给本机 HUD。请确认 HUD 出现余额后关闭账单页。');})
 .catch(()=>status('未连接到 HUD。请启动 Quota Glass，再刷新账单页。'))
 .finally(()=>{forwarding=false;});
},{urls:['https://api.openai.com/*','https://platform.openai.com/*']},['requestHeaders','extraHeaders']);
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
 if(message.type==='open-billing'){chrome.tabs.create({url:billingUrl}).then(()=>reply({ok:true}));return true;}
});
