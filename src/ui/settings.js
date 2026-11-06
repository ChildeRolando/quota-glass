'use strict';
let scaleTimer=null;
function render(data){
 const root=document.getElementById('connections');root.replaceChildren();
 for(const p of data.providers){
  const section=el('section','connection'),title=el('div','connection-title');
  title.append(el('h2','',p.name),el('span','badge',p.status==='connected'?'已连接':p.status==='loading'?'连接中':'未连接'));section.append(title);
  if(p.status==='connected'){
   section.append(el('p','source',`${p.source}${p.plan?' · '+p.plan:''}`));
   p.windows.forEach((w,i)=>{const row=el('div','window');const ring=p.id==='command'?({monthly:'外圈',weekly:'中圈',fiveHour:'内圈'}[w.id]):i===0?'外环':i===1?'内环':'附加周期';const left=el('span','',`${w.label} · ${ring} ${Number.isFinite(w.remaining)?'剩余 '+w.remaining.toFixed(1)+'%':'暂不可用'}`);row.append(left,el('small','',Number.isFinite(w.remaining)?countdown(w.resetsAt):'月额度或订阅暂不可用'));section.append(row);if(w.basis)section.append(el('p','source',w.basis));});
   if(p.balance)section.append(el('p','balance',`余额 ${p.balance.value.toFixed(2)} ${p.balance.unit}`));
  }else section.append(el('p','error',p.error||'正在读取本地登录信息…'));
  root.append(section);
 }
 document.getElementById('top').checked=data.options.alwaysOnTop;
 document.getElementById('startup').checked=Boolean(data.startup?.enabled);
 document.getElementById('startup').disabled=!data.startup?.available;
 document.getElementById('startup-note').textContent=data.startup?.error||(data.startup?.available?'登录 Windows 后自动显示面板':'开机启动仅在正式版中可用，验证模式不修改系统启动项');
 if(scaleTimer===null&&document.activeElement!==document.getElementById('scale')){
  document.getElementById('scale').value=String(data.options.scale);
  document.getElementById('scale-value').textContent=Math.round(data.options.scale*100)+'%';
 }
 document.getElementById('refresh').disabled=data.busy;
 document.getElementById('status').textContent=freshness(data);
}
document.getElementById('refresh').addEventListener('click',()=>window.quota.refresh());
document.getElementById('top').addEventListener('change',e=>window.quota.setOption('alwaysOnTop',e.target.checked));
document.getElementById('startup').addEventListener('change',async event=>{
 const input=event.target;input.disabled=true;
 try{render(await window.quota.setOption('startup',input.checked));}
 catch{render(await window.quota.get());document.getElementById('startup-note').textContent='无法修改开机启动，请重试';}
});
const scale=document.getElementById('scale');
function applyScale(){clearTimeout(scaleTimer);scaleTimer=null;window.quota.setOption('scale',Number(scale.value));}
scale.addEventListener('input',()=>{document.getElementById('scale-value').textContent=Math.round(Number(scale.value)*100)+'%';clearTimeout(scaleTimer);scaleTimer=setTimeout(applyScale,80);});
scale.addEventListener('change',applyScale);
window.quota.onUpdate(render);window.quota.get().then(render);
