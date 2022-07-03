import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  selectFolder: () => ipcRenderer.invoke("dialog:openDirectory"),
  uploadBuild: (filename, gameName) =>
    ipcRenderer.invoke("upload:build", { filename, gameName }),
  downloadBuild: (filename, gameName) =>
    ipcRenderer.invoke("download:build", { filename, gameName }),
  removeBuild: (gameName) => ipcRenderer.invoke("remove:build", { gameName }),
  installBuild: (gameName, version) =>
    ipcRenderer.invoke("install:build", { gameName, version }),

  upgradeBuild: (gameName, fromVersion, toVersion) =>
    ipcRenderer.invoke("upgrade:build", { gameName, fromVersion, toVersion }),

  uploadManifest: (gameName, files, version, executable, hashes, from) =>
    ipcRenderer.invoke("upload:manifest", {
      gameName,
      files,
      version,
      executable,
      hashes,
      from,
    }),
  compressBuild: (version, folder) =>
    ipcRenderer.invoke("compress:build", { version, folder }),
  hashBuild: (folder) => ipcRenderer.invoke("hash:build", { folder }),

  play: (gameName, executable, accessToken, refreshToken) =>
    ipcRenderer.invoke("play", {
      gameName,
      executable,
      accessToken,
      refreshToken,
    }),
  copyBuild: (folder, gameName) =>
    ipcRenderer.invoke("copy:build", { folder, gameName }),
  cleanBuild: () => ipcRenderer.invoke("clean:build", {}),
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  receive: (channel, fn) => {
    ipcRenderer.on(channel, (event, ...args) => fn(...args));
  },
  removeAll: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  fileExists: (path) => ipcRenderer.invoke("file:exists", { path }),
  diffBuild: (folder, gameName, fromVersion, toVersion) =>
    ipcRenderer.invoke("diff:build", {
      folder,
      gameName,
      fromVersion,
      toVersion,
    }),

  storeSet: (key, value) => ipcRenderer.invoke("store:set", { key, value }),
  storeMerge: (key, value) => ipcRenderer.invoke("store:merge", { key, value }),

  storeGet: (key, value) => ipcRenderer.invoke("store:get", { key }),
});