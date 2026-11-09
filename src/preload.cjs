'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('quota',Object.freeze({
  get:() => ipcRenderer.invoke('quota:get'),
  refresh:() => ipcRenderer.invoke('quota:refresh'),
  openAiExtension:()=>ipcRenderer.invoke('quota:openai-extension'),
  disconnectOpenAi:()=>ipcRenderer.invoke('quota:openai-disconnect'),
  openAiBilling:()=>ipcRenderer.invoke('quota:openai-billing'),
  settings:() => ipcRenderer.invoke('quota:settings'),
  hide:() => ipcRenderer.invoke('quota:hide'),
  drag:phase => ipcRenderer.send('quota:drag',phase),
  previewOption:(key,value)=>ipcRenderer.send('quota:preview-option',key,value),
  onAppearance:callback=>{const handler=(_event,options)=>callback(options);ipcRenderer.on('quota:appearance',handler);return ()=>ipcRenderer.removeListener('quota:appearance',handler);},
  setOption:(key,value) => ipcRenderer.invoke('quota:option',key,value),
  onUpdate:callback => { const handler=(_event,data)=>callback(data); ipcRenderer.on('quota:update',handler); return ()=>ipcRenderer.removeListener('quota:update',handler); }
}));
