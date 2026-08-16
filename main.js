const {
    app,
    BrowserWindow,
    screen,
    ipcMain
} = require("electron");

const path = require("node:path");

app.disableHardwareAcceleration();


// ========================================
// WINDOWS
// ========================================

let timerWindow = null;
let totoroWindow = null;


// ========================================
// ACTIVE WINDOW DETECTION
// ========================================

let getActiveWindow = null;


// ========================================
// STUDY SESSION STATE
// ========================================

let isStudySessionActive = false;

let baselineApplication = null;

let currentApplication = null;

let isDistracted = false;

let distractionStartTime = null;

let isSad = false;

let lastNonElectronApplication = null;


// ========================================
// CREATE TIMER WINDOW
// ========================================

function createTimerWindow() {

    const display =
        screen.getPrimaryDisplay();

    const {
        width,
        height
    } = display.workAreaSize;


    const timerWidth = 360;
    const timerHeight = 180;


    timerWindow =
        new BrowserWindow({

            x:
                width -
                timerWidth -
                30,

            y: 30,

            width:
                timerWidth,

            height:
                timerHeight,

            frame: false,

            transparent: true,

            backgroundColor:
                "#00000000",

            hasShadow: false,

            alwaysOnTop: true,

            resizable: false,

            movable: false,

            skipTaskbar: true,

            webPreferences: {

                contextIsolation: false,

                nodeIntegration: true

            }

        });


    timerWindow.loadFile(
        path.join(
            __dirname,
            "index.html"
        )
    );
}


// ========================================
// CREATE CHARACTER WINDOW
// ========================================

function createTotoroWindow() {

    const display =
        screen.getPrimaryDisplay();

    const bounds =
        display.workArea;


    const characterWidth = 250;
    const characterHeight = 250;


    totoroWindow =
        new BrowserWindow({

            x:
                bounds.x +
                bounds.width -
                characterWidth -
                30,

            y:
                bounds.y +
                bounds.height -
                characterHeight -
                30,

            width:
                characterWidth,

            height:
                characterHeight,

            frame: false,

            transparent: true,

            backgroundColor:
                "#00000000",

            hasShadow: false,

            alwaysOnTop: true,

            resizable: false,

            movable: true,

            skipTaskbar: true,

            webPreferences: {

                contextIsolation: false,

                nodeIntegration: true

            }

        });


    totoroWindow.setHasShadow(false);

    totoroWindow.setIgnoreMouseEvents(false);


    totoroWindow.loadFile(
        path.join(
            __dirname,
            "character.html"
        )
    );


    totoroWindow.once(
        "ready-to-show",
        () => {

            totoroWindow.show();

        }
    );


    totoroWindow.on(
        "closed",
        () => {

            totoroWindow = null;

        }
    );
}


// ========================================
// GET ACTIVE APPLICATION
// ========================================

async function getActiveApplication() {

    try {

        if (!getActiveWindow) {

            const module =
                await import("get-windows");

            getActiveWindow =
                module.activeWindow;

        }


        const activeWindow =
            await getActiveWindow();


        if (!activeWindow) {

            return null;

        }


        return {

            app:
                activeWindow.owner.name,

            title:
                activeWindow.title,

            url:
                activeWindow.url || null

        };

    }

    catch (error) {

        console.error(
            "Active application detection failed:",
            error
        );

        return null;

    }

}



// ========================================
// IS THIS OUR ELECTRON APP?
// ========================================

function isOurApplication(activeWindow) {

    if (!activeWindow) {

        return false;

    }


    return (
        activeWindow.app === "Electron"
    );

}


// ========================================
// IS THIS YOUTUBE?
// ========================================

function isYouTube(activeWindow) {

    if (!activeWindow) {

        return false;

    }


    const url =
        activeWindow.url;


    if (!url) {

        return false;

    }


    try {

        const hostname =
            new URL(url).hostname
                .toLowerCase();


        return (
            hostname === "youtube.com" ||
            hostname === "www.youtube.com" ||
            hostname.endsWith(
                ".youtube.com"
            )
        );

    }

    catch {

        return false;

    }

}


// ========================================
// SEND CHARACTER STATE
// ========================================

function sendCharacterState(state) {

    if (
        totoroWindow &&
        !totoroWindow.isDestroyed()
    ) {

        totoroWindow.webContents.send(
            "character-state",
            state
        );

    }

}

async function monitorStudySession() {

    const activeWindow =
        await getActiveApplication();


    if (!activeWindow) {
        return;
    }


    // ========================================
    // ALWAYS REMEMBER LAST NON-ELECTRON APP
    // ========================================

    if (
        !isOurApplication(activeWindow)
    ) {

        lastNonElectronApplication =
            activeWindow;

    }


    // ========================================
    // IGNORE OUR ELECTRON WINDOWS
    // ========================================

    if (
        isOurApplication(activeWindow)
    ) {

        return;

    }


    const appName =
        activeWindow.app;

    const title =
        activeWindow.title;

    const url =
        activeWindow.url;


    currentApplication =
        activeWindow;


    // ========================================
    // LOG CURRENT APPLICATION
    // ========================================

    console.log(
        "--------------------------------"
    );

    console.log(
        "Active app:",
        appName
    );

    console.log(
        "Window:",
        title
    );


    if (url) {

        console.log(
            "URL:",
            url
        );

    }


    // ========================================
    // DON'T CHECK DISTRACTION
    // BEFORE TIMER STARTS
    // ========================================

    if (
        !isStudySessionActive
    ) {

        return;

    }


    // ========================================
    // CHECK YOUTUBE
    // ========================================

    const watchingYouTube =
        isYouTube(
            activeWindow
        );


    // ========================================
    // USER IS ON YOUTUBE
    // ========================================

    if (watchingYouTube) {

        // -------------------------------
        // DISTRACTION JUST STARTED
        // -------------------------------

        if (!isDistracted) {

            isDistracted =
                true;

            isSad = false;

            distractionStartTime =
                Date.now();


            console.log(
                "DISTRACTION STARTED: YouTube"
            );


            sendCharacterState(
                "thinking"
            );

        }


        // -------------------------------
        // ALREADY DISTRACTED
        // -------------------------------

        else {

            const distractionSeconds =
                Math.floor(
                    (
                        Date.now() -
                        distractionStartTime
                    ) / 1000
                );


            console.log(
                "YouTube distraction:",
                distractionSeconds,
                "seconds"
            );


            // 5 minutes
            if (
                distractionSeconds >= 300 &&
                !isSad
            ) {

            isSad = true;

            sendCharacterState(
                    "sad"
            );

        }

            

        }


        return;

    }


    // ========================================
    // USER LEFT YOUTUBE
    // ========================================

    if (isDistracted) {

        console.log(
            "USER RETURNED FROM DISTRACTION"
        );


        isDistracted =
            false;

        isSad = false;

        distractionStartTime =
            null;


        sendCharacterState(
            "working"
        );

    }

}

// ========================================
// APP READY
// ========================================

app.whenReady().then(() => {

    createTimerWindow();

    createTotoroWindow();

    // Start monitoring immediately
    monitorStudySession();

    // Check every second

    setInterval(
        monitorStudySession,
        1000
    );


    app.on(
        "activate",
        () => {

            if (
                BrowserWindow
                    .getAllWindows()
                    .length === 0
            ) {

                createTimerWindow();

                createTotoroWindow();

            }

        }
    );

});


// ========================================
// TIMER → CHARACTER
// ========================================

ipcMain.on(
    "character-state",
    (event, state) => {

        sendCharacterState(
            state
        );

    }
);


// ========================================
// STUDY SESSION START
// ========================================

ipcMain.on(
    "study-session-start",
    () => {

        if (
            !lastNonElectronApplication
        ) {

            console.log(
                "Could not determine starting application."
            );

            return;

        }


        baselineApplication =
            lastNonElectronApplication;


        currentApplication =
            lastNonElectronApplication;


        isStudySessionActive =
            true;


        isDistracted =
            false;
        
        isSad =
            false;


        distractionStartTime =
            null;


        console.log(
            "================================"
        );


        console.log(
            "STUDY SESSION STARTED"
        );


        console.log(
            "Starting application:",
            baselineApplication.app
        );


        console.log(
            "Starting window:",
            baselineApplication.title
        );


        if (
            baselineApplication.url
        ) {

            console.log(
                "Starting URL:",
                baselineApplication.url
            );

        }


        console.log(
            "================================"
        );


        sendCharacterState(
            "working"
        );

    }
);


// ========================================
// STUDY SESSION STOP
// ========================================

ipcMain.on(
    "study-session-stop",
    () => {

        isStudySessionActive =
            false;

        baselineApplication =
            null;

        currentApplication =
            null;

        isDistracted =
            false;
        
        isSad =
            false;

        distractionStartTime =
            null;

        console.log(
            "STUDY SESSION STOPPED"
        );

    }
);


// ========================================
// CLOSE APP
// ========================================

app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);