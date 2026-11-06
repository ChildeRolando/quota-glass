const {_electron:electron}=require('playwright');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:['.','--verify'],env});
 const page=await app.firstWindow();await page.waitForSelector('.provider');
 await page.evaluate(()=>window.quota.refresh());
 await app.evaluate(({BrowserWindow})=>{
  const panel=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Quota Glass');
  panel.setPosition(800,160);const b=panel.getBounds();
  const scene=new BrowserWindow({title:'Quota Glass · Glass Test',x:b.x-20,y:b.y-20,width:b.width+40,height:b.height+40,frame:false,show:false});
  scene.loadURL('data:text/html,'+encodeURIComponent('<body style="margin:0;display:flex;height:100vh;font:28px sans-serif;color:white">'+['#3368aa','#d58a40','#486a57','#826893','#b57d6b','#2f5d8c'].map((c,i)=>`<div style="background:${c};width:16.666%;padding-top:${i%2?100:200}px">GLASS</div>`).join('')+'</body>'));
  scene.once('ready-to-show',()=>{scene.show();panel.setAlwaysOnTop(true);panel.show();panel.moveTop();});
 });
 console.log('GLASS_SCENE_READY');
 setTimeout(async()=>{await app.close();},60000);
})().catch(console.error);
