'use strict';
const icons={
 command:'<svg class="brand-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="m5 8 9 8-9 8M18 24h10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 codex:'<svg class="brand-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M13 2c-4 0-5 4-6 7-4 1-6 5-5 9 0 3 3 5 6 5 1 5 5 8 9 7 3-1 4-4 6-6 4 0 7-3 7-7 0-5-4-8-8-8-2-4-5-7-9-7Z"/><path d="m11 12 4 4-4 4m7 0h5" fill="none" stroke="#283445" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 generic:'<svg class="brand-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
};
function countdown(ms,now=Date.now()){
 if(!ms)return '等待周期开始';
 if(ms<=now)return '等待额度更新';
 const mins=Math.ceil((ms-now)/60000),days=Math.floor(mins/1440),hours=Math.floor(mins%1440/60);
 if(days)return `${days}天${hours}小时`;
 if(hours)return `${hours}小时${mins%60}分`;
 return `${mins}分钟`;
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function percent(value){return String(Math.round(value));}
function freshness(data){
 if(data.busy)return '正在更新…';
 const connected=data.providers.filter(p=>p.status==='connected');
 if(!connected.length)return '未连接 · 请查看设置';
 const secs=Math.max(0,Math.floor((Date.now()-Math.min(...connected.map(p=>p.updatedAt)))/1000));
 const age=secs<60?`${secs}秒`:`${Math.floor(secs/60)}分钟`;
 return `${connected.length<data.providers.length?'部分连接 · ': '距更新 '}${age}`;
}

function pingText(clash){return clash?.status==='connected'&&Number.isFinite(clash.delay)?`ping ${clash.delay}ms`:clash?.status==='loading'?'ping …':'ping —';}
