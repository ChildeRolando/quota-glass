'use strict';
chrome.storage.local.get('status').then(s=>{if(s.status)document.getElementById('status').textContent=s.status;});
document.getElementById('connect').addEventListener('click',()=>chrome.runtime.sendMessage({type:'open-billing'}));
chrome.storage.onChanged.addListener(changes=>{if(changes.status)document.getElementById('status').textContent=changes.status.newValue;});
