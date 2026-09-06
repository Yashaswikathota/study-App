const {
    app,
    BrowserWindow,
    screen,
    ipcMain
} = require("electron");

const path = require("node:path");
const fs = require("node:fs");

require("dotenv").config();

const { Pool } = require("pg");

// ========================================
// POSTGRESQL CONNECTION
// ========================================

const db = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});


// ========================================
// TEST DATABASE CONNECTION
// ========================================

db.connect()
    .then((client) => {

        console.log("================================");
        console.log("POSTGRESQL CONNECTED");
        console.log("Database:", process.env.DB_NAME);
        console.log("================================");

        client.release();

    })
    .catch((error) => {

        console.error("================================");
        console.error("POSTGRESQL CONNECTION FAILED");
        console.error(error.message);
        console.error("================================");

    });

app.disableHardwareAcceleration();


// ========================================
// WINDOWS
// ========================================

let mainWindow = null;
let timerWindow = null;
let totoroWindow = null;
let reportWindow = null;


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

let getActiveWindow = null;


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


    isDistracted =
        false;


    distractionStartTime =
        null;
    }

    const endedAt = new Date();

    const durationSeconds = Math.max(
        0,
        Math.floor(
            (endedAt.getTime() - currentSession.startedAt.getTime()) / 1000
        )
    );

    const distractionSeconds = Math.max(
        0,
        Math.min(currentSession.distractionSeconds, durationSeconds)
    );

    const focusedSeconds = Math.max(
        0,
        durationSeconds - distractionSeconds
    );

    try {

        const result = await db.query(
            `
            INSERT INTO study_sessions
            (
                started_at,
                ended_at,
                duration_seconds,
                focused_seconds,
                distraction_seconds,
                youtube_visits,
                completed,
                subject
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            `,
            [
                currentSession.startedAt,
                endedAt,
                durationSeconds,
                focusedSeconds,
                distractionSeconds,
                currentSession.youtubeVisits,
                completed,
                currentSession.subject
            ]
        );

        console.log("================================");
        console.log("STUDY SESSION SAVED");
        console.log(result.rows[0]);
        console.log("================================");

        const savedSession = result.rows[0];

        // Reset current session
        currentSession = {
            subject: null,
            startedAt: null,
            youtubeVisits: 0,
            distractionSeconds: 0
        };

        return savedSession;

    } catch (error) {

        console.error("================================");
        console.error("FAILED TO SAVE STUDY SESSION");
        console.error(error);
        console.error("================================");

        return null;
    }
}
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

    try {

        if (!getActiveWindow) {

            const module =
                await import(
                    "get-windows"
                );

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
                activeWindow.url ||
                null
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
    // IGNORE OUR ELECTRON WINDOWS
    // ========================================

    if (
        isOurApplication(
            activeWindow
        )
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

            console.log("YOUTUBE VISIT:",
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
        // INITIALIZE DATABASE SESSION
        // ====================================

        currentSession.subject =
            selectedSubject;

        currentSession.startedAt =
            new Date();

        currentSession.youtubeVisits =
            0;

        currentSession.distractionSeconds =
            0;


        console.log(
            "DATABASE SESSION INITIALIZED"
        );

        console.log(
            "Subject:",
            currentSession.subject
        );

        console.log(
            "Started at:",
            currentSession.startedAt
        );


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
        // SAVE SESSION TO POSTGRESQL
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