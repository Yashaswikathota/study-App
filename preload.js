const { contextBridge, ipcRenderer } = require("electron");


// =========================================================
// MAIN WINDOW CONTROLS
// =========================================================

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


// =========================================================
// STUDY API
// =========================================================

contextBridge.exposeInMainWorld("studyApi", {

    selectSubject(subject) {

        ipcRenderer.send(
            "subject-selected",
            subject
        );

    }

});