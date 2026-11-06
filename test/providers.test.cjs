const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeCodex,normalizeCommand}=require('../src/providers/normalize.cjs');
const {readProvider,validateSnapshot}=require('../src/providers/index.cjs');
test('Codex uses the actual period and converts used to remaining; null windows are absent',()=>{
 const result=normalizeCodex({rateLimits:{primary:{usedPercent:50,windowDurationMins:10080,resetsAt:1794461836},secondary:null}});
 assert.deepEqual(result.windows,[{id:'primary',label:'1w',remaining:50,resetsAt:1794461836000,durationMins:10080}]);
});
test('Codex bucket selection does not mix another model quota into Codex',()=>{
 const result=normalizeCodex({rateLimits:{primary:{usedPercent:90}},rateLimitsByLimitId:{codex:{primary:{usedPercent:20,windowDurationMins:300}}}});
 assert.equal(result.windows[0].remaining,80);
 assert.throws(()=>normalizeCodex({rateLimits:{limitId:'other',primary:{usedPercent:50}}}));
});
test('Missing and malformed quotas must not become a full or empty valid ring',()=>{
 for(const usedPercent of [undefined,null,'50',NaN,Infinity,-1])assert.throws(()=>normalizeCodex({rateLimits:{primary:{usedPercent}}}));
 assert.throws(()=>normalizeCommand({windowLimits:{weekly:{used:0,cap:0}}}));
 assert.throws(()=>normalizeCommand({credits:{monthlyCredits:4}}));
});
test('Exhausted and overdrawn values clamp to zero; untouched windows remain at 100',()=>{
 for(const [used,cap,remaining] of [[0,14,100],[14,14,0],[16,14,0]]){
  const r=normalizeCommand({windowLimits:{fiveHour:{used,cap,resetAt:0}}});
  assert.equal(r.windows.find(w=>w.id==='fiveHour').remaining,remaining);assert.equal(r.windows.find(w=>w.id==='fiveHour').resetsAt,null);
 }
});
test('Command reset timestamps retain milliseconds and credits are summed without invented allowance',()=>{
 const result=normalizeCommand({windowLimits:{weekly:{used:7,cap:35,resetAt:1794274855683}},credits:{monthlyCredits:40,purchasedCredits:2,freeCredits:1}});
 assert.equal(result.windows.find(w=>w.id==='weekly').remaining,80);assert.equal(result.windows.find(w=>w.id==='weekly').resetsAt,1794274855683);
 assert.deepEqual(result.balance,{value:43,unit:'积分'});
});
test('Provider failures discard data and surface a fixed error, not a raw secret-bearing message',async()=>{
 const result=await readProvider({id:'sample',name:'Sample',read:async()=>{throw new Error('secret-token-value');}},{});
 assert.equal(result.status,'disconnected');assert.deepEqual(result.windows,[]);assert.equal(result.updatedAt,null);
 assert.ok(!JSON.stringify(result).includes('secret-token-value'));
});
test('Adapter projection removes extra credentials and account identifiers',()=>{
 const result=validateSnapshot({windows:[{id:'weekly',label:'1w',remaining:88,token:'secret'}],apiKey:'secret',accountId:'private'});
 assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('private'));
});
test('Monthly is subscription-only, excludes purchased credits, and uses the actual billing end',()=>{
 const result=normalizeCommand({credits:{monthlyCredits:42,purchasedCredits:10,freeCredits:5},windowLimits:{weekly:{used:7,cap:35},fiveHour:{used:7,cap:14}}},{data:{planId:'individual-goat',status:'active',currentPeriodStart:'2099-01-25T00:00:00Z',currentPeriodEnd:'2099-02-25T00:00:00Z'}});
 assert.deepEqual(result.windows.map(w=>w.id),['monthly','weekly','fiveHour']);
 assert.deepEqual(result.windows.map(w=>w.remaining),[60,80,50]);
 assert.equal(result.windows[0].resetsAt,Date.parse('2099-02-25T00:00:00Z'));
});
test('Unknown plan or missing subscription has an unavailable monthly ring, never a guessed percentage',()=>{
 const credits={credits:{monthlyCredits:42,purchasedCredits:0,freeCredits:0}};
 for(const sub of [null,{data:{planId:'new-plan',status:'active',currentPeriodEnd:'2099-01-01'}}]){
  const result=normalizeCommand(credits,sub);assert.equal(result.windows[0].remaining,null);assert.equal(result.windows[0].status,'unavailable');
  assert.equal(validateSnapshot(result).windows[0].remaining,null);
 }
});
