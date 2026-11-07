'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const YAML=require('yaml');
const DEFAULT_URL='http://cp.cloudflare.com/generate_204';
const messages={missing:'未找到 Clash Verge 配置',connection:'无法连接 Clash Verge，请确认内核正在运行',auth:'Clash Verge 接口认证失败',selection:'无法确定当前节点',direct:'当前为直连，没有代理节点',changed:'节点已切换，等待下次更新',timeout:'节点测速超时或不可用',format:'Clash Verge 返回的延迟无效'};
async function readYaml(file){return YAML.parse(await fs.readFile(file,'utf8'),{maxAliasCount:100})||{};}
function livePipe(configured,names){
 const leaf=configured.slice(9);
 if(names.includes(leaf))return configured;
 const suffix=leaf.match(/^verge-mihomo-.+-([a-f0-9]{64})$/i)?.[1];
 const matches=suffix?names.filter(name=>name.startsWith('verge-mihomo-')&&name.endsWith('-'+suffix)):[];
 return matches.length===1?'\\\\.\\pipe\\'+matches[0]:configured;
}
async function discover(appData){
 for(const folder of ['io.github.clash-verge-rev.clash-verge-rev','io.github.clash-verge.clash-verge']){
  const root=path.join(appData,folder);
  let config;
  try{config=await readYaml(path.join(root,'clash-verge.yaml'));}catch{try{config=await readYaml(path.join(root,'config.yaml'));}catch{continue;}}
  let verge={};try{verge=await readYaml(path.join(root,'verge.yaml'));}catch{}
  const pipe=config['external-controller-pipe'];
  if(typeof pipe==='string'&&pipe.startsWith('\\\\.\\pipe\\')){
   let names=[];try{names=await fs.readdir('\\\\.\\pipe\\');}catch{}
   return {socketPath:livePipe(pipe,names),secret:config.secret,testUrl:verge.default_latency_test};
  }
  try{
   const url=new URL('http://'+config['external-controller']);
   // Credentials are sent only to this computer, never to a configured remote host.
   if(!['127.0.0.1','localhost','[::1]','0.0.0.0','[::]'].includes(url.hostname)||!url.port||url.username||url.password)continue;
   return {hostname:url.hostname.includes(':')?'::1':'127.0.0.1',port:Number(url.port),secret:config.secret,testUrl:verge.default_latency_test};
  }catch{}
 }
 throw new Error('missing');
}
function requestJson(endpoint,route,signal){
 return new Promise((resolve,reject)=>{
  const req=http.get({...endpoint,path:route,agent:false,signal,headers:typeof endpoint.secret==='string'&&endpoint.secret?{Authorization:`Bearer ${endpoint.secret}`}:{},timeout:6500},res=>{
   if(res.statusCode!==200){res.resume();reject(new Error(res.statusCode===401||res.statusCode===403?'auth':route.includes('/delay?')?'timeout':'connection'));return;}
   let body='',size=0;res.setEncoding('utf8');
   res.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){req.destroy(new Error('format'));return;}body+=chunk;});
   res.on('error',reject);res.on('end',()=>{try{resolve(JSON.parse(body));}catch{reject(new Error('format'));}});
  });
  req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',reject);
 });
}
function selection(config,proxies,rules){
 if(config.mode==='direct')throw new Error('direct');
 const group=config.mode==='global'?'GLOBAL':rules.find(r=>/^(match|final)$/i.test(r.type)&&!r.extra?.disabled)?.proxy;
 if(!group)throw new Error('selection');
 let node=group;const visited=new Set();let testUrl;
 while(proxies[node]){
  if(visited.has(node))throw new Error('selection');visited.add(node);
  const proxy=proxies[node];testUrl ||= proxy.testUrl;
  if(/^(direct|reject|rejectdrop|pass)$/i.test(proxy.type))throw new Error('direct');
  if(!proxy.all)return {group,node,testUrl};
  if(typeof proxy.now!=='string'||!proxy.now)throw new Error('selection');
  node=proxy.now;
 }
 throw new Error('selection');
}
async function readClash({appData,signal,endpoint,get=requestJson}){
 const deadline=AbortSignal.timeout(10000),bounded=signal?AbortSignal.any([signal,deadline]):deadline;
 try{
  endpoint ||= await discover(appData);
  const read=route=>get(endpoint,route,bounded);
  async function current(){const [config,{proxies},{rules}]=await Promise.all([read('/configs'),read('/proxies'),read('/rules')]);return selection(config,proxies||{},rules||[]);}
  const selected=await current();
  let url=endpoint.testUrl||selected.testUrl||DEFAULT_URL;
  try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)url=DEFAULT_URL;}catch{url=DEFAULT_URL;}
  const result=await read(`/proxies/${encodeURIComponent(selected.node)}/delay?${new URLSearchParams({url,timeout:'5000'})}`);
  if(!Number.isInteger(result.delay)||result.delay<=0||result.delay>65535)throw new Error('format');
  const latest=await current();if(latest.node!==selected.node||latest.group!==selected.group)throw new Error('changed');
  return {status:'connected',delay:result.delay,node:selected.node,group:selected.group,updatedAt:Date.now(),error:null};
 }catch(error){return {status:'unavailable',delay:null,node:null,group:null,updatedAt:Date.now(),error:deadline.aborted?'节点测速超时':messages[error.message]||messages.connection};}
}
module.exports={readClash,selection,discover,requestJson,livePipe};
