'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('quota',Object.freeze({
  get:() => ipcRenderer.invoke('quota:get'),
  refresh:() => ipcRenderer.invoke('quota:refresh'),
  settings:() => ipcRenderer.invoke('quota:settings'),
  hide:() => ipcRenderer.invoke('quota:hide'),
  drag:phase => ipcRenderer.send('quota:drag',phase),
  setOption:(key,value) => ipcRenderer.invoke('quota:option',key,value),
  onUpdate:callback => { const handler=(_event,data)=>callback(data); ipcRenderer.on('quota:update',handler); return ()=>ipcRenderer.removeListener('quota:update',handler); }
}));
