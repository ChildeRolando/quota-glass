'use strict';
const finite = x => typeof x === 'number' && Number.isFinite(x);
function windowQuota(id, label, usedPercent, resetsAt, durationMins) {
  if (!finite(usedPercent) || usedPercent < 0) return null;
  return { id, label, remaining: Math.max(0, Math.min(100, 100 - usedPercent)),
    resetsAt: finite(resetsAt) && resetsAt > 0 ? resetsAt : null, durationMins };
}
function period(minutes) {
  if (!finite(minutes) || minutes <= 0) return '周期';
  if (minutes % 10080 === 0) return `${minutes / 10080}w`;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
function normalizeCodex(data) {
  const limit = data?.rateLimitsByLimitId?.codex ?? data?.rateLimits;
  if (!limit || (limit.limitId && limit.limitId !== 'codex')) throw new Error('unsupported');
  const windows = ['primary', 'secondary'].map(id => {
    const w = limit[id];
    return w ? windowQuota(id, period(w.windowDurationMins), w.usedPercent,
      finite(w.resetsAt) ? w.resetsAt * 1000 : null, w.windowDurationMins) : null;
  }).filter(Boolean).sort((a,b) => (b.durationMins || 0) - (a.durationMins || 0));
  if (!windows.length) throw new Error('unsupported');
  return { windows, plan: limit.planType || null, balance: null };
}
function normalizeCommand(data,subscription) {
  const limits = data?.windowLimits;
  const windows = [['weekly','周',10080],['fiveHour','5h',300]].map(([id,label,mins]) => {
    const w = limits?.[id];
    if (!w || !finite(w.used) || !finite(w.cap) || w.used < 0 || w.cap <= 0) return null;
    // Command Code returns resetAt in milliseconds; zero means a window has not started.
    return windowQuota(id,label,w.used / w.cap * 100,w.resetAt,mins);
  }).filter(Boolean);
  const c = data?.credits;
  const sub=subscription?.data;
  const {monthlyCredits}=require('./command-plans.cjs');
  const cap=monthlyCredits[sub?.planId];
  const end=Date.parse(sub?.currentPeriodEnd),start=Date.parse(sub?.currentPeriodStart);
  const active=sub?.status==='active' && finite(end) && end>Date.now();
  const monthly=active && finite(cap) && cap>0 && finite(c?.monthlyCredits) && c.monthlyCredits>=0
    ? windowQuota('monthly','月',Math.max(0,(1-c.monthlyCredits/cap)*100),end,finite(start)?(end-start)/60000:null) : null;
  // Returning a failed monthly query must not erase the valid 5h/weekly windows.
  if(monthly)windows.unshift({...monthly,basis:`订阅积分 ${c.monthlyCredits.toFixed(2)} / ${cap}（官方 CLI 口径）`});
  else windows.unshift({id:'monthly',label:'月',remaining:null,resetsAt:null,durationMins:null,status:'unavailable'});
  const balance = c && [c.monthlyCredits,c.purchasedCredits,c.freeCredits].every(finite)
    ? { value:c.monthlyCredits+c.purchasedCredits+c.freeCredits, unit:'积分' } : null;
  if (!windows.some(w=>finite(w.remaining)) && !balance) throw new Error('unsupported');
  return { windows, balance, plan: sub?.planId || null };
}
module.exports = { normalizeCodex, normalizeCommand, windowQuota, period };
