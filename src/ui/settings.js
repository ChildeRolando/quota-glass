'use strict';
const activeSliders=new Set();
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
 renderAppearance(data.options);
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
function renderAppearance(options){
 for(const key of ['scale','transparency'])if(!activeSliders.has(key)){
  document.getElementById(key).value=String(options[key]);
  document.getElementById(key+'-value').textContent=Math.round(options[key]*100)+'%';
 }
}
for(const key of ['scale','transparency']){
 const input=document.getElementById(key);
 input.addEventListener('pointerdown',()=>activeSliders.add(key));
 input.addEventListener('input',()=>{
  activeSliders.add(key);const value=Number(input.value);
  document.getElementById(key+'-value').textContent=Math.round(value*100)+'%';
  window.quota.previewOption(key,value);
 });
 const commit=()=>{
  if(!activeSliders.has(key))return;
  activeSliders.delete(key);
  window.quota.setOption(key,Number(input.value));
 };
 input.addEventListener('change',commit);
 input.addEventListener('pointerup',()=>{if(activeSliders.has(key))commit();});
 input.addEventListener('pointercancel',()=>{if(activeSliders.has(key))commit();});
}
window.quota.onAppearance(renderAppearance);
window.quota.onUpdate(render);window.quota.get().then(render);
