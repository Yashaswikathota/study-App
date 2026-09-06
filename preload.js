const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronWindow", {
  hide() {
    ipcRenderer.send("window-hide");
  },

  toggleFullscreen() {
    ipcRenderer.send("window-fullscreen");
  },

  close() {
    ipcRenderer.send("window-close");
  }
});

// Study Companion API
contextBridge.exposeInMainWorld("studyApi", {
  selectSubject(subject) {
    ipcRenderer.send("subject-selected", subject);
  }
});