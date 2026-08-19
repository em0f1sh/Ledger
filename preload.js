const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listCategories: () => ipcRenderer.invoke('categories:list'),
  addCategory: (data) => ipcRenderer.invoke('categories:add', data),
  renameCategory: (data) => ipcRenderer.invoke('categories:rename', data),
  removeCategory: (id) => ipcRenderer.invoke('categories:remove', id),

  addRecord: (record) => ipcRenderer.invoke('records:add', record),
  updateRecord: (data) => ipcRenderer.invoke('records:update', data),
  removeRecord: (id) => ipcRenderer.invoke('records:remove', id),
  listRecords: (filter) => ipcRenderer.invoke('records:list', filter),

  monthlyStats: (range) => ipcRenderer.invoke('stats:monthly', range),
  trendStats: () => ipcRenderer.invoke('stats:trend'),
  netStats: () => ipcRenderer.invoke('stats:net')
});