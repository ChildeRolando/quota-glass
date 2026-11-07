'use strict';
let current;
const container=document.getElementById('providers');
const selected={};
try{Object.assign(selected,JSON.parse(localStorage.getItem('selected-periods')||'{}'));}catch{}
function pick(provider,id){selected[provider.id]=id;try{localStorage.setItem('selected-periods',JSON.stringify(selected));}catch{}if(current)render(current);}
function periodLabel(window){return ({'周':'7d','1w':'7d','月':'1m'})[window?.label]||window?.label;}
function chosen(provider){return provider.windows.find(w=>w.id===selected[provider.id])||provider.windows[0];}
function buildRing(radius,width,window,provider,index){
 const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');
 group.setAttribute('class',`ring-control${window?.id===chosen(provider)?.id?' selected':''}`);
 if(window){
  group.setAttribute('role','button');group.setAttribute('tabindex','0');
  group.setAttribute('aria-label',`${provider.name} ${window.label}额度`);
  group.setAttribute('aria-pressed',String(window.id===chosen(provider)?.id));
  group.dataset.period=window.id;
  const activate=()=>pick(provider,window.id);
  group.addEventListener('click',activate);
  group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();container.querySelector(`[data-period="${window.id}"]`)?.focus();}});
 }
 const track=document.createElementNS(ns,'circle');
 for(const [k,v] of Object.entries({cx:100,cy:100,r:radius,'stroke-width':width,class:'ring-track'}))track.setAttribute(k,v);
 const fill=track.cloneNode();fill.setAttribute('class',`ring-fill ring-${index}`);
 const perimeter=2*Math.PI*radius,remaining=window?.remaining,filled=perimeter*Math.max(0,Math.min(100,remaining??0))/100;
 fill.setAttribute('stroke-dasharray',`${filled} ${perimeter}`);
 if(!filled)fill.setAttribute('visibility','hidden');
 const hit=track.cloneNode();hit.setAttribute('class','ring-hit');hit.setAttribute('stroke-width',width+6);
 group.append(track,fill,hit);return group;
}
function render(data){
 current=data;applyAppearance(data.options);fitPanel();container.replaceChildren();
 for(const provider of data.providers){
  const connected=provider.status==='connected',windows=provider.windows||[],main=chosen(provider),triple=provider.id==='command';
  const column=el('section',`provider${connected?'':' offline'}`);column.dataset.provider=provider.id;
  const header=el('h2',provider.icon);const logo=el('span');logo.innerHTML=icons[provider.icon]||icons.generic;header.append(logo,el('span','',provider.name));
  const meter=el('div',`meter-button${triple?' triple':windows.length>1?' dual':''}`);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 200');svg.setAttribute('class','rings');svg.setAttribute('aria-label',`${provider.name} 额度周期选择`);
  if(triple){
   ['monthly','weekly','fiveHour'].forEach((id,i)=>svg.append(buildRing(90-i*18,11,windows.find(w=>w.id===id),provider,i)));
  }else{
   (windows.length?windows:[null]).slice(0,3).forEach((w,i)=>svg.append(buildRing(90-i*20,windows.length>1?13:18,w,provider,i)));
  }
  const center=el('div','meter-center');
  center.setAttribute('aria-label',`${provider.name} 当前${main?.label||'周期'}剩余额度`);
  const known=main&&Number.isFinite(main.remaining);
  center.append(el('span','meter-value',known?percent(main.remaining):!triple&&provider.balance?provider.balance.value.toFixed(1):'—'),el('span','meter-period',connected?periodLabel(main)||provider.balance?.unit||'周期':provider.status==='loading'?'读取中':'未连接'));
  meter.append(svg,center);
  const detail=el('p','countdown',connected?known?countdown(main.resetsAt):'额度暂不可用':provider.status==='loading'?'正在连接':'点击设置查看原因');
  column.append(header,meter,detail);container.append(column);
 }
 document.getElementById('freshness').textContent=freshness(data);
 const ping=document.getElementById('ping');ping.hidden=!data.options.clashPing;
 ping.textContent=pingText(data.clash);ping.title=data.clash?.status==='connected'?`${data.clash.group} → ${data.clash.node}`:data.clash?.error||'正在测速';
 document.getElementById('refresh').disabled=data.busy;
}
document.getElementById('refresh').addEventListener('click',()=>window.quota.refresh());
document.getElementById('settings').addEventListener('click',()=>window.quota.settings());
document.getElementById('hide').addEventListener('click',()=>window.quota.hide());
function fitPanel(){
 const width=82+235*(current?.providers.length||2),surface=document.querySelector('.glass');
 surface.style.width=width+'px';surface.style.transform=`scale(${innerWidth/width},${innerHeight/414})`;
}
function applyAppearance(options){document.documentElement.style.setProperty('--glass-density',String(1-(options.transparency??0.55)));}
window.addEventListener('resize',fitPanel);fitPanel();
window.quota.onAppearance(applyAppearance);
window.quota.onUpdate(render);window.quota.get().then(render);
// Keep all native hit tests in the client area. Only blank/header pointer drags move the HWND.
let dragging=false;
const surface=document.querySelector('.glass');
surface.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('button,.meter-button,nav'))return;
 dragging=true;surface.setPointerCapture(event.pointerId);window.quota.drag('start');event.preventDefault();
});
surface.addEventListener('pointermove',()=>{if(dragging)window.quota.drag('move');});
const stopDrag=()=>{if(dragging){dragging=false;window.quota.drag('end');}};
surface.addEventListener('pointerup',stopDrag);surface.addEventListener('pointercancel',stopDrag);surface.addEventListener('lostpointercapture',stopDrag);
setInterval(()=>{if(current){document.getElementById('freshness').textContent=freshness(current);const nodes=document.querySelectorAll('.countdown');current.providers.forEach((p,i)=>{const w=chosen(p);if(p.status==='connected'&&Number.isFinite(w?.remaining))nodes[i].textContent=countdown(w.resetsAt);});}},1000);
