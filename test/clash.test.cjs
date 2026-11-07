const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {readClash,selection,livePipe}=require('../src/extensions/clash.cjs');
const proxies={GLOBAL:{type:'Selector',all:['Main'],now:'Main'},Main:{type:'Selector',all:['Auto'],now:'Auto'},Auto:{type:'URLTest',all:['Node / 日本'],now:'Node / 日本'},'Node / 日本':{type:'Shadowsocks'},DIRECT:{type:'Direct'}};
const rules=[{type:'Match',proxy:'Main'}];
test('resolve rule/global selection through nested groups, reject direct, cycles and load balancing',()=>{
 assert.equal(selection({mode:'rule'},proxies,rules).node,'Node / 日本');
 assert.equal(selection({mode:'global'},proxies,[]).group,'GLOBAL');
 assert.throws(()=>selection({mode:'direct'},proxies,rules),/direct/);
 assert.throws(()=>selection({mode:'rule'},{...proxies,Auto:{all:['Main'],now:'Main'}},rules),/selection/);
 assert.throws(()=>selection({mode:'rule'},{...proxies,Auto:{type:'LoadBalance',all:['Node / 日本']}},rules),/selection/);
 assert.throws(()=>selection({mode:'rule'},proxies,[]),/selection/);
});
test('service pipe uses same installation identity and never guesses between multiple matches',()=>{
 const hash='b'.repeat(64),configured='\\\\.\\pipe\\verge-mihomo-sidecar-release-'+hash,live='verge-mihomo-production-'+hash;
 assert.equal(livePipe(configured,[live]),'\\\\.\\pipe\\'+live);
 assert.equal(livePipe(configured,[live,'verge-mihomo-other-'+hash]),configured);
 assert.equal(livePipe(configured,['verge-mihomo-production-'+'a'.repeat(64)]),configured);
});
test('local HTTP round trip measures selected leaf, authenticates, and exposes no credentials',async t=>{
 const calls=[];
 const server=http.createServer((req,res)=>{
  calls.push(req.url);assert.equal(req.method,'GET');assert.equal(req.headers.authorization,'Bearer test-secret');
  res.setHeader('Content-Type','application/json');
  const data=req.url==='/configs'?{mode:'rule'}:req.url==='/proxies'?{proxies}:req.url==='/rules'?{rules}:{delay:191};res.end(JSON.stringify(data));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const result=await readClash({endpoint:{hostname:'127.0.0.1',port:server.address().port,secret:'test-secret'}});
 assert.equal(result.status,'connected');assert.equal(result.delay,191);
 assert.ok(calls.some(route=>route.startsWith('/proxies/'+encodeURIComponent('Node / 日本')+'/delay?')));
 assert.ok(!JSON.stringify(result).includes('test-secret'));
});
test('invalid delays and changing nodes never reuse a previous number',async()=>{
 for(const delay of [0,-1,null,'191',65536]){
  const result=await readClash({endpoint:{},get:async(_e,route)=>route==='/configs'?{mode:'rule'}:route==='/proxies'?{proxies}:route==='/rules'?{rules}:{delay}});
  assert.equal(result.status,'unavailable');assert.equal(result.delay,null);
 }
 let measured=false;
 const result=await readClash({endpoint:{},get:async(_e,route)=>{
  if(route==='/configs')return {mode:'rule'};
  if(route==='/rules')return {rules};
  if(route==='/proxies')return {proxies:measured?{...proxies,Auto:{all:['Other'],now:'Other'},Other:{type:'Shadowsocks'}}:proxies};
  measured=true;return {delay:191};
 }});
 assert.match(result.error,/已切换/);assert.equal(result.delay,null);
});
test('unavailable controller and abort return safe unknown state',async()=>{
 const controller=new AbortController();controller.abort();
 const result=await readClash({endpoint:{hostname:'127.0.0.1',port:1,secret:'private'},signal:controller.signal});
 assert.equal(result.status,'unavailable');assert.equal(result.delay,null);assert.ok(!JSON.stringify(result).includes('private'));
});
