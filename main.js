const {
    app,
    BrowserWindow,
    screen,
    ipcMain
} = require("electron");

const path = require("node:path");
const fs = require("node:fs");
const { execFile } = require("node:child_process");

app.disableHardwareAcceleration();


// ========================================
// WINDOWS
// ========================================

let mainWindow = null;
let timerWindow = null;
let totoroWindow = null;
let reportWindow = null;
let analyticsWindow = null;


// ========================================
// CURRENT STUDY SESSION
// ========================================

let currentSession = {
    subject: null,
    startedAt: null,
    youtubeVisits: 0,
    distractionSeconds: 0
};


// ========================================
// CHARACTER POSITION STORAGE
// ========================================

const characterPositionFile = path.join(
    app.getPath("userData"),
    "character-position.json"
);


// ========================================
// ACTIVE WINDOW DETECTION
// ========================================


let isCheckingActiveWindow = false;


// ========================================
// STUDY SESSION STATE
// ========================================

let isStudySessionActive = false;

let selectedSubject = null;

let baselineApplication = null;

let currentApplication = null;

let isDistracted = false;

let distractionStartTime = null;

let isSad = false;

let lastNonElectronApplication = null;

// ========================================
// SAVE STUDY SESSION
// ========================================

async function saveStudySession(completed = false) {

    if (!currentSession.startedAt) {
        console.log("No active study session to save.");
        return null;
    }

    // ========================================
    // CLOSE ACTIVE DISTRACTION
    // ========================================

    if (
        isDistracted &&
        distractionStartTime
    ) {

        const activeDistractionSeconds =
            Math.floor(
                (
                    Date.now() -
                    distractionStartTime
                ) / 1000
            );

        currentSession.distractionSeconds +=
            activeDistractionSeconds;

        console.log(
            "FINAL ACTIVE DISTRACTION:",
            activeDistractionSeconds,
            "seconds"
        );

        isDistracted = false;
        distractionStartTime = null;
    }

    const endedAt = new Date();

    const durationSeconds = Math.max(
        0,
        Math.floor(
            (
                endedAt.getTime() -
                currentSession.startedAt.getTime()
            ) / 1000
        )
    );

    const distractionSeconds = Math.max(
        0,
        Math.min(
            currentSession.distractionSeconds,
            durationSeconds
        )
    );

    const focusedSeconds = Math.max(
        0,
        durationSeconds - distractionSeconds
    );

    try {

        console.log("SAVING SESSION THROUGH JAVA BACKEND...");

        const response = await fetch(
            "http://localhost:8080/api/study-sessions/stop",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    sessionId: currentSession.id,
                    durationSeconds: durationSeconds,
                    distractionSeconds: distractionSeconds,
                    youtubeVisits: currentSession.youtubeVisits
                })
            }
        );

        if (!response.ok) {
            throw new Error(
                `Java backend returned HTTP ${response.status}`
            );
        }

        const savedSession =
            await response.json();

        console.log("================================");
        console.log("STUDY SESSION SAVED THROUGH JAVA");
        console.log(savedSession);
        console.log("================================");

        // Reset current session
        currentSession = {
            id: null,
            subject: null,
            startedAt: null,
            youtubeVisits: 0,
            distractionSeconds: 0
        };

        return savedSession;

    } catch (error) {

        console.error("================================");
        console.error("FAILED TO SAVE STUDY SESSION THROUGH JAVA");
        console.error(error);
        console.error("================================");

        return null;
    }
}

// ========================================
// GET STUDY ANALYTICS
// ========================================
async function getStudyAnalytics() {

    try {

        console.log(
            "GETTING STUDY ANALYTICS THROUGH JAVA..."
        );

        const response = await fetch(
            "http://localhost:8080/api/analytics"
        );

        if (!response.ok) {

            throw new Error(
                `Java backend returned HTTP ${response.status}`
            );

        }

        const analytics =
            await response.json();

        console.log(
            "JAVA ANALYTICS RECEIVED:"
        );

        console.log(
            analytics
        );

        return analytics;

    } catch (error) {

        console.error(
            "================================"
        );

        console.error(
            "FAILED TO GET ANALYTICS THROUGH JAVA"
        );

        console.error(
            error
        );

        console.error(
            "================================"
        );

        return {
            totals: {
                totalSeconds: 0,
                focusedSeconds: 0,
                distractionSeconds: 0,
                youtubeVisits: 0,
                focusScore: 0
            },
            sessions: []
        };
    }
}
// ========================================
// ANALYTICS DATA REQUEST
// ========================================

ipcMain.handle(
    "get-study-analytics",
    async () => {

        console.log(
            "ANALYTICS DATA REQUESTED"
        );

        return await getStudyAnalytics();
    }
);


// ========================================
// OPEN ANALYTICS WINDOW
// ========================================

console.log(
    "========== REGISTERING ANALYTICS =========="
);

ipcMain.on(
    "open-analytics",
    () => {

        console.log(
            "========== OPEN ANALYTICS RECEIVED =========="
        );

        createAnalyticsWindow();
    }
);


// ========================================
// CHARACTER POSITION
// ========================================

function saveCharacterPosition() {

    if (
        !totoroWindow ||
        totoroWindow.isDestroyed()
    ) {
        return;
    }

    try {

        const bounds =
            totoroWindow.getBounds();

        fs.writeFileSync(
            characterPositionFile,
            JSON.stringify({
                x: bounds.x,
                y: bounds.y
            })
        );

        console.log(
            "Character position saved:",
            bounds.x,
            bounds.y
        );

    } catch (error) {

        console.error(
            "Could not save character position:",
            error
        );

    }
}


// ========================================
// LOAD CHARACTER POSITION
// ========================================

function loadCharacterPosition() {

    try {

        if (
            !fs.existsSync(
                characterPositionFile
            )
        ) {
            return null;
        }

        const position =
            JSON.parse(
                fs.readFileSync(
                    characterPositionFile,
                    "utf8"
                )
            );

        if (
            typeof position.x !== "number" ||
            typeof position.y !== "number"
        ) {
            return null;
        }

        console.log(
            "Loaded character position:",
            position.x,
            position.y
        );

        return position;

    } catch (error) {

        console.error(
            "Could not load character position:",
            error
        );

        return null;
    }
}


// ========================================
// KEEP CHARACTER INSIDE WORK AREA
// ========================================

function keepCharacterInsideWorkArea() {

    if (
        !totoroWindow ||
        totoroWindow.isDestroyed()
    ) {
        return;
    }

    const bounds =
        totoroWindow.getBounds();

    const display =
        screen.getDisplayNearestPoint({
            x: bounds.x,
            y: bounds.y
        });

    const workArea =
        display.workArea;

    const padding = 20;

    const minX =
        workArea.x + padding;

    const maxX =
        workArea.x +
        workArea.width -
        bounds.width -
        padding;

    const minY =
        workArea.y + padding;

    const maxY =
        workArea.y +
        workArea.height -
        bounds.height -
        padding;

    const x =
        Math.max(
            minX,
            Math.min(
                bounds.x,
                maxX
            )
        );

    const y =
        Math.max(
            minY,
            Math.min(
                bounds.y,
                maxY
            )
        );

    if (
        x !== bounds.x ||
        y !== bounds.y
    ) {

        totoroWindow.setPosition(
            x,
            y,
            true
        );
    }
}


// ========================================
// SNAP CHARACTER TO NEAREST EDGE
// ========================================

function snapCharacterToEdge() {

    if (
        !totoroWindow ||
        totoroWindow.isDestroyed()
    ) {
        return;
    }

    const bounds =
        totoroWindow.getBounds();

    const display =
        screen.getDisplayNearestPoint({
            x: bounds.x,
            y: bounds.y
        });

    const workArea =
        display.workArea;

    const distanceToLeft =
        Math.abs(
            bounds.x -
            workArea.x
        );

    const distanceToRight =
        Math.abs(
            (
                bounds.x +
                bounds.width
            ) -
            (
                workArea.x +
                workArea.width
            )
        );

    const snapToRight =
        distanceToRight <
        distanceToLeft;

    const padding = 20;

    const targetX =
        snapToRight
            ? workArea.x +
              workArea.width -
              bounds.width -
              padding
            : workArea.x +
              padding;

    const targetY =
        Math.max(
            workArea.y + padding,
            Math.min(
                bounds.y,
                workArea.y +
                workArea.height -
                bounds.height -
                padding
            )
        );

    console.log(
        "Snapping character:",
        targetX,
        targetY
    );

    totoroWindow.setPosition(
        targetX,
        targetY,
        true
    );

    saveCharacterPosition();
}


// ========================================
// CREATE MAIN WINDOW
// ========================================

function createMainWindow() {

    mainWindow = new BrowserWindow({

        width: 1500,

        height: 900,

        minWidth: 1100,

        minHeight: 700,

        show: false,

        frame: false,

        transparent: true,

        backgroundColor: "#00000000",

        vibrancy: "under-window",

        visualEffectState: "active",

        webPreferences: {

            preload:
                path.join(
                    __dirname,
                    "preload.js"
                ),

            contextIsolation: true,

            nodeIntegration: false
        }
    });


    mainWindow.loadFile(
        path.join(
            __dirname,
            "index.html"
        )
    );



    mainWindow.once(
        "ready-to-show",
        () => {

            mainWindow.show();

        }
    );


    mainWindow.on(
        "closed",
        () => {

            mainWindow = null;

        }
    );
}


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

            show: false,

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
            "timer.html"
        )
    );
}

// ========================================
// CREATE REPORT WINDOW
// ========================================

function createReportWindow(savedSession) {

    // ----------------------------------------
    // Close existing report if necessary
    // ----------------------------------------

    if (
        reportWindow &&
        !reportWindow.isDestroyed()
    ) {

        reportWindow.close();

    }


    // ----------------------------------------
    // Report dimensions
    // ----------------------------------------

    const reportWidth = 420;
    const reportHeight = 460;


// ----------------------------------------
// Center report window on screen
// ----------------------------------------

    const display =
    screen.getPrimaryDisplay();

    const workArea =
    display.workArea;


    const reportX =
    workArea.x +
    (
        workArea.width -
        reportWidth
    ) / 2;


    const reportY =
    workArea.y +
    (
        workArea.height -
        reportHeight
    ) / 2;
    // ----------------------------------------
    // Create report window
    // ----------------------------------------

    reportWindow =
        new BrowserWindow({

            x: Math.round(reportX),

            y: Math.round(reportY),

            width: reportWidth,

            height: reportHeight,

            frame: false,

            transparent: true,

            backgroundColor:
                "#00000000",

            show: false,

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


    // ----------------------------------------
    // Load report UI
    // ----------------------------------------

    reportWindow.loadFile(
        path.join(
            __dirname,
            "report.html"
        )
    );


    // ----------------------------------------
    // Send session after page loads
    // ----------------------------------------

    reportWindow.once(
        "ready-to-show",
        () => {

            console.log(
                "REPORT WINDOW READY"
            );


            reportWindow.webContents.send(
                "session-report",
                savedSession
            );


            reportWindow.show();

            reportWindow.focus();

        }
    );


    // ----------------------------------------
    // Report closed
    // ----------------------------------------

    reportWindow.on(
        "closed",
        () => {

            reportWindow = null;

        }
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


    // ====================================
    // LOAD SAVED POSITION
    // ====================================

    const savedPosition =
        loadCharacterPosition();


    // ====================================
    // DEFAULT POSITION
    // ====================================

    const defaultX =
        bounds.x +
        bounds.width -
        characterWidth -
        30;

    const defaultY =
        bounds.y +
        bounds.height -
        characterHeight -
        30;


    const characterX =
        savedPosition?.x ??
        defaultX;

    const characterY =
        savedPosition?.y ??
        defaultY;


    // ====================================
    // CREATE WINDOW
    // ====================================

    totoroWindow =
        new BrowserWindow({

            x: characterX,

            y: characterY,

            width:
                characterWidth,

            height:
                characterHeight,

            frame: false,

            transparent: true,

            backgroundColor:
                "#00000000",

            show: false,

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


    // ====================================
    // CHARACTER WINDOW SETTINGS
    // ====================================

    totoroWindow.setHasShadow(false);

    totoroWindow.setIgnoreMouseEvents(
        false
    );


    // ====================================
    // LOAD CHARACTER
    // ====================================

    totoroWindow.loadFile(
        path.join(
            __dirname,
            "character.html"
        )
    );


    // ====================================
    // CHARACTER MOVED
    // ====================================

    totoroWindow.on(
        "moved",
        () => {

            if (
                !totoroWindow ||
                totoroWindow.isDestroyed()
            ) {
                return;
            }


            // Keep inside usable screen
            keepCharacterInsideWorkArea();


            // Save current position
            saveCharacterPosition();


            // Cancel previous snap timer
            clearTimeout(
                totoroWindow.snapTimeout
            );


            // Wait for user to finish dragging
            totoroWindow.snapTimeout =
                setTimeout(
                    () => {

                        if (
                            !totoroWindow ||
                            totoroWindow.isDestroyed()
                        ) {
                            return;
                        }

                        snapCharacterToEdge();

                    },
                    350
                );
        }
    );


    // ====================================
    // CHARACTER READY
    // ====================================

    totoroWindow.once(
        "ready-to-show",
        () => {

            console.log(
                "Character window ready."
            );

            // Make sure saved position
            // is still valid
            keepCharacterInsideWorkArea();

            saveCharacterPosition();

        }
    );


    // ====================================
    // CHARACTER CLOSED
    // ====================================

    totoroWindow.on(
        "closed",
        () => {

            if (
                totoroWindow &&
                !totoroWindow.isDestroyed()
            ) {
                saveCharacterPosition();
            }

            totoroWindow = null;

        }
    );
}


// ========================================
// GET ACTIVE APPLICATION
// ========================================
async function getActiveApplication() {

    return new Promise((resolve) => {

        execFile(
            "osascript",
            [
                "-e",
                `
                tell application "System Events"
                    set frontApp to first application process whose frontmost is true
                    set appName to name of frontApp
                    set windowTitle to ""
                    
                    try
                        set windowTitle to name of front window of frontApp
                    end try
                    
                    return appName & "|||" & windowTitle
                end tell
                `
            ],
            {
                timeout: 2000
            },
            (error, stdout) => {

                if (error) {

                    console.log(
                        "ACTIVE APPLICATION ERROR:",
                        error.message
                    );

                    resolve(null);
                    return;
                }


                const output =
                    stdout.trim();


                if (!output) {

                    console.log(
                        "NO ACTIVE APPLICATION FOUND"
                    );

                    resolve(null);
                    return;
                }


                const parts =
                    output.split("|||");


                const app =
                    parts[0]?.trim() || null;


                const title =
                    parts.slice(1)
                        .join("|||")
                        .trim() || null;


                const result = {

                    app,
                    title,
                    url: null

                };


                console.log(
                    "ACTIVE APPLICATION:",
                    result
                );


                resolve(result);

            }
        );

    });
}

// ========================================
// IS THIS OUR ELECTRON APP?
// ========================================

function isOurApplication(
    activeWindow
) {

    if (!activeWindow) {

        return false;
    }


    return (
        activeWindow.app ===
        "Electron"
    );
}


// ========================================
// IS THIS YOUTUBE?
// ========================================

function isYouTube(
    activeWindow
) {

    if (!activeWindow) {

        return false;
    }


    // ====================================
    // CHECK URL
    // ====================================

    const url =
        activeWindow.url;


    if (url) {

        try {

            const hostname =
                new URL(url)
                    .hostname
                    .toLowerCase();


            if (
                hostname ===
                    "youtube.com" ||

                hostname ===
                    "www.youtube.com" ||

                hostname.endsWith(
                    ".youtube.com"
                )
            ) {

                return true;
            }

        }

        catch {

            // Continue and check title

        }
    }


    // ====================================
    // CHECK WINDOW TITLE
    // ====================================

    const title =
        activeWindow.title || "";


    if (
        title
            .toLowerCase()
            .includes("youtube")
    ) {

        return true;
    }


    return false;
}


// ========================================
// SEND CHARACTER STATE
// ========================================

function sendCharacterState(
    state
) {

    console.log(
        "SENDING CHARACTER STATE:",
        state
    );


    if (
        totoroWindow &&
        !totoroWindow.isDestroyed()
    ) {

        totoroWindow.webContents.send(
            "character-state",
            state
        );

    }

    else {

        console.log(
            "CHARACTER WINDOW NOT AVAILABLE"
        );

    }
}


// ========================================
// MONITOR STUDY SESSION
// ========================================

async function monitorStudySession() {

    console.log(
        "MONITOR CHECK:",
        new Date().toISOString()
    );


    // ========================================
    // PREVENT OVERLAPPING ACTIVE WINDOW CHECKS
    // ========================================

    if (isCheckingActiveWindow) {

        console.log(
            "ACTIVE WINDOW CHECK ALREADY RUNNING"
        );

        return;
    }


    isCheckingActiveWindow = true;


    try {

        const activeWindow =
            await getActiveApplication();


        if (!activeWindow) {

            return;
        }


        // ========================================
        // ALWAYS REMEMBER LAST NON-ELECTRON APP
        // ========================================

        if (
            !isOurApplication(
                activeWindow
            )
        ) {

            lastNonElectronApplication =
                activeWindow;

        }


        // ========================================
        // HANDLE RETURN TO OUR ELECTRON APP
        // ========================================

        if (
            isOurApplication(
                activeWindow
                            )
            ) {

            if (
                isStudySessionActive &&
                isDistracted
                ) {

            console.log(
            "USER RETURNED FROM DISTRACTION"
        );


        // ====================================
        // CALCULATE DISTRACTION DURATION
        // ====================================

        if (distractionStartTime) {

            const distractionDuration =
                Math.floor(
                    (
                        Date.now() -
                        distractionStartTime
                    ) / 1000
                );


            currentSession.distractionSeconds +=
                distractionDuration;


            console.log(
                "DISTRACTION DURATION:",
                distractionDuration,
                "seconds"
            );


            console.log(
                "TOTAL DISTRACTION:",
                currentSession.distractionSeconds,
                "seconds"
            );

        }


        // ====================================
        // END DISTRACTION
        // ====================================

        isDistracted =
            false;

        isSad =
            false;

        distractionStartTime =
            null;


        // ====================================
        // BACK TO WORKING
        // ====================================

        sendCharacterState(
            "working"
        );

       }

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


        console.log(
            "IS YOUTUBE:",
            watchingYouTube
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

                isSad =
                    false;

                distractionStartTime =
                    Date.now();

                currentSession.youtubeVisits += 1;


                console.log(
                    "DISTRACTION STARTED: YouTube"
                );


                console.log(
                    "YOUTUBE VISIT:",
                    currentSession.youtubeVisits
                );


                // YouTube = Confused

                sendCharacterState(
                    "confused"
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


                // =================================
                // 5 MINUTES
                // =================================

                if (
                    distractionSeconds >= 300 &&
                    !isSad
                ) {

                    isSad =
                        true;


                    console.log(
                        "DISTRACTION REACHED 5 MINUTES"
                    );


                    // YouTube for 5 minutes = Sad

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


            // ====================================
            // CALCULATE DISTRACTION DURATION
            // ====================================

            if (distractionStartTime) {

                const distractionDuration =
                    Math.floor(
                        (
                            Date.now() -
                            distractionStartTime
                        ) / 1000
                    );


                currentSession.distractionSeconds +=
                    distractionDuration;


                console.log(
                    "DISTRACTION DURATION:",
                    distractionDuration,
                    "seconds"
                );


                console.log(
                    "TOTAL DISTRACTION:",
                    currentSession.distractionSeconds,
                    "seconds"
                );

            }


            // ====================================
            // END DISTRACTION
            // ====================================

            isDistracted =
                false;


            isSad =
                false;


            distractionStartTime =
                null;


            // ====================================
            // BACK TO WORKING
            // ====================================

            sendCharacterState(
                "working"
            );

        }

    } finally {

        // ========================================
        // ALWAYS RELEASE THE LOCK
        // ========================================

        isCheckingActiveWindow =
            false;

    }

}

// ========================================
// APP READY
// ========================================

app.whenReady().then(() => {

    // New glass subject-selection UI
    createMainWindow();


    // Existing study windows
    // They start hidden.
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
                !mainWindow ||
                mainWindow.isDestroyed()
            ) {

                createMainWindow();

            }

            else {

                mainWindow.show();

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

        console.log(
            "CHARACTER STATE FROM TIMER:",
            state
        );


        sendCharacterState(
            state
        );

    }
);


// ========================================
// SUBJECT SELECTED FROM MAIN UI
// ========================================

ipcMain.on(
    "subject-selected",
    (event, subject) => {

        selectedSubject =
            String(
                subject || ""
            ).trim();


        if (!selectedSubject) {

            console.log(
                "No subject selected."
            );

            return;
        }


        console.log(
            "SUBJECT SELECTED:",
            selectedSubject
        );


        // ====================================
        // HIDE MAIN SUBJECT UI
        // ====================================

        const senderWindow =
            BrowserWindow.fromWebContents(
                event.sender
            );


        if (senderWindow) {

            senderWindow.hide();

        }


        // ====================================
        // SHOW TIMER
        // ====================================

        if (
            timerWindow &&
            !timerWindow.isDestroyed()
        ) {

            timerWindow.show();


            timerWindow.webContents.send(
                "study-subject",
                selectedSubject
            );

        }


        // ====================================
        // SHOW CHARACTER
        // ====================================

        if (
            totoroWindow &&
            !totoroWindow.isDestroyed()
        ) {

            totoroWindow.show();


            totoroWindow.webContents.send(
                "character-state",
                "working"
            );

        }

    }
);


// ========================================
// STUDY SESSION START
// ========================================
ipcMain.on(
    "study-session-start",
    async () => {

        console.log(
            "================================"
        );

        console.log(
            "SELECTED SUBJECT AT SESSION START:",
            selectedSubject
        );

        // ====================================
        // CREATE DATABASE SESSION THROUGH JAVA
        // ====================================

        try {

            console.log(
                "CREATING STUDY SESSION THROUGH JAVA..."
            );

            const response = await fetch(
                "http://localhost:8080/api/study-sessions/start",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        subject: selectedSubject
                    })
                }
            );

            if (!response.ok) {

                throw new Error(
                    `Java backend returned HTTP ${response.status}`
                );

            }

            const javaSession =
                await response.json();

            console.log(
                "JAVA SESSION CREATED:"
            );

            console.log(
                javaSession
            );

            // ====================================
            // INITIALIZE LOCAL SESSION
            // ====================================

            currentSession.id =
                javaSession.id;

            currentSession.subject =
                selectedSubject;

            currentSession.startedAt =
                new Date(
                    javaSession.startedAt
                );

            currentSession.youtubeVisits =
                0;

            currentSession.distractionSeconds =
                0;

            console.log(
                "DATABASE SESSION INITIALIZED THROUGH JAVA"
            );

            console.log(
                "Session ID:",
                currentSession.id
            );

            console.log(
                "Subject:",
                currentSession.subject
            );

            console.log(
                "Started at:",
                currentSession.startedAt
            );

        } catch (error) {

            console.error(
                "================================"
            );

            console.error(
                "FAILED TO CREATE SESSION THROUGH JAVA"
            );

            console.error(
                error
            );

            console.error(
                "================================"
            );

            return;
        }


        // ====================================
        // GET ACTIVE APPLICATION RIGHT NOW
        // ====================================

        const startingApplication =
            await getActiveApplication();


        if (!startingApplication) {

            console.log(
                "Could not determine starting application."
            );

            return;
        }


        // ====================================
        // SAVE STARTING APPLICATION
        // ====================================

        baselineApplication =
            startingApplication;

        currentApplication =
            startingApplication;

        isStudySessionActive =
            true;

        isDistracted =
            false;

        isSad =
            false;

        distractionStartTime =
            null;


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


        // ====================================
        // CHARACTER STARTS WORKING
        // ====================================

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
    async () => {

        console.log(
            "================================"
        );

        if (!currentSession.startedAt) {
            console.log("No active study session to stop.");
            return;
        }

        console.log(
            "STUDY SESSION STOPPING"
        );


        // ====================================
        // SAVE SESSION THROUGH JAVA BACKEND
        // ====================================

        const savedSession =
            await saveStudySession(false);


        // ====================================
        // STOP ACTIVE SESSION TRACKING
        // ====================================

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

        // ========================================
        // OPEN SESSION REPORT WINDOW
        // ========================================

        if (savedSession) {

            console.log(
                 "OPENING SESSION REPORT WINDOW:",
                savedSession
            );


            // ----------------------------------------
            // Hide timer
            // ----------------------------------------

            if (
                timerWindow &&
                !timerWindow.isDestroyed()
            ) {

            timerWindow.hide();

            }


            // ----------------------------------------
            // Open report window
             // ----------------------------------------

            createReportWindow(
             savedSession
         );

        }
    }
);

// ========================================
// REPORT → DONE
// ========================================

ipcMain.on(
    "report-done",
    () => {

        console.log(
            "REPORT DONE"
        );


        // ----------------------------------------
        // Close report window
        // ----------------------------------------

        if (
            reportWindow &&
            !reportWindow.isDestroyed()
        ) {

            reportWindow.close();

        }

        reportWindow = null;


        // ----------------------------------------
        // Show timer again
        // ----------------------------------------

        if (
            timerWindow &&
            !timerWindow.isDestroyed()
        ) {

            timerWindow.show();

            timerWindow.focus();

        }

    }
);

// ========================================
// CREATE ANALYTICS WINDOW
// ========================================

function createAnalyticsWindow() {

    // If already open, focus it
    if (
        analyticsWindow &&
        !analyticsWindow.isDestroyed()
    ) {

        analyticsWindow.show();
        analyticsWindow.focus();

        return;
    }


    const display =
        screen.getPrimaryDisplay();

    const workArea =
        display.workArea;


    const analyticsWidth = 900;
    const analyticsHeight = 700;


    const analyticsX =
        workArea.x +
        (
            workArea.width -
            analyticsWidth
        ) / 2;


    const analyticsY =
        workArea.y +
        (
            workArea.height -
            analyticsHeight
        ) / 2;


    analyticsWindow =
        new BrowserWindow({

            x: Math.round(analyticsX),

            y: Math.round(analyticsY),

            width: analyticsWidth,

            height: analyticsHeight,

            minWidth: 750,

            minHeight: 600,

            frame: false,

            transparent: true,

            backgroundColor:
                "#00000000",

            show: false,

            hasShadow: false,

            resizable: true,

            movable: true,

            skipTaskbar: false,

            webPreferences: {

                contextIsolation: false,

                nodeIntegration: true

            }

        });


    analyticsWindow.loadFile(
        path.join(
            __dirname,
            "analytics.html"
        )
    );


    analyticsWindow.once(
        "ready-to-show",
        () => {

            console.log(
                "ANALYTICS WINDOW READY"
            );

            analyticsWindow.show();

            analyticsWindow.focus();

        }
    );


    analyticsWindow.on(
        "closed",
        () => {

            analyticsWindow = null;

        }
    );

}

// ========================================
// MAIN WINDOW CONTROLS
// ========================================

ipcMain.on(
    "window-hide",
    () => {

        if (
            mainWindow &&
            !mainWindow.isDestroyed()
        ) {

            mainWindow.hide();

        }

    }
);


ipcMain.on(
    "window-fullscreen",
    () => {

        if (
            mainWindow &&
            !mainWindow.isDestroyed()
        ) {

            mainWindow.setFullScreen(
                !mainWindow.isFullScreen()
            );

        }

    }
);


ipcMain.on(
    "window-close",
    () => {

        app.quit();

    }
);


// ========================================
// CLOSE APP
// ========================================

app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !==
            "darwin"
        ) {

            app.quit();

        }

    }
);