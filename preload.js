const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  win: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    maximize: () => ipcRenderer.invoke('win:maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
    onMaximized: (cb) => ipcRenderer.on('win:maximized', (e, v) => cb(v)),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    detectDota: () => ipcRenderer.invoke('settings:detectDota'),
    browseDota: () => ipcRenderer.invoke('settings:browseDota'),
  },
  catalog: {
    load: (force) => ipcRenderer.invoke('catalog:load', force),
  },
  mods: {
    install: (payload) => ipcRenderer.invoke('mods:install', payload),
    list: () => ipcRenderer.invoke('mods:list'),
    setEnabled: (id, enabled) => ipcRenderer.invoke('mods:setEnabled', id, enabled),
    remove: (id) => ipcRenderer.invoke('mods:remove', id),
    externalSetEnabled: (fileName, enabled) => ipcRenderer.invoke('mods:externalSetEnabled', fileName, enabled),
    externalRemove: (fileName) => ipcRenderer.invoke('mods:externalRemove', fileName),
    checkConflicts: (payload) => ipcRenderer.invoke('mods:checkConflicts', payload),
    exportSingle: (id) => ipcRenderer.invoke('mods:exportSingle', id),
    importDialog: () => ipcRenderer.invoke('mods:importDialog'),
    importPaths: (paths) => ipcRenderer.invoke('mods:importPaths', paths),
    splitMod: (id) => ipcRenderer.invoke('mods:splitMod', id),
    splitExternal: (fileName) => ipcRenderer.invoke('mods:splitExternal', fileName),
    pathForFile: (file) => webUtils.getPathForFile(file),
  },
  presets: {
    list: () => ipcRenderer.invoke('presets:list'),
    save: (name) => ipcRenderer.invoke('presets:save', name),
    delete: (id) => ipcRenderer.invoke('presets:delete', id),
    apply: (id) => ipcRenderer.invoke('presets:apply', id),
  },
  misc: {
    openLangFolder: () => ipcRenderer.invoke('misc:openLangFolder'),
    openToolsFolder: (sub) => ipcRenderer.invoke('misc:openToolsFolder', sub),
    openExternal: (url) => ipcRenderer.invoke('misc:openExternal', url),
    cacheSize: () => ipcRenderer.invoke('misc:cacheSize'),
    clearCache: () => ipcRenderer.invoke('misc:clearCache'),
    runTool: (dirName) => ipcRenderer.invoke('misc:runTool', dirName),
  },
  onProgress: (cb) => {
    ipcRenderer.on('progress', (e, evt) => cb(evt));
  },
  update: {
    install: () => ipcRenderer.invoke('update:install'),
    version: () => ipcRenderer.invoke('app:version'),
    onUpdate: (cb) => ipcRenderer.on('update', (e, evt) => cb(evt)),
  },
});
