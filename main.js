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
    distractionSeconds: 0,
    pausedSeconds: 0,
    pausedAt: null
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

    // Unanswered video question: close it (it stays a distraction).
    // Awaited so the activity update reaches the backend
    // before the stop request.
    await closeUnansweredVideo();

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

    // ========================================
    // CLOSE ACTIVE PAUSE
    // ========================================

    if (currentSession.pausedAt) {

        currentSession.pausedSeconds +=
            Math.floor(
                (
                    Date.now() -
                    currentSession.pausedAt
                ) / 1000
            );

        currentSession.pausedAt = null;
    }

    const endedAt = new Date();

    // Break time while paused is not study time.
    const durationSeconds = Math.max(
        0,
        Math.floor(
            (
                endedAt.getTime() -
                currentSession.startedAt.getTime()
            ) / 1000
        ) - (currentSession.pausedSeconds || 0)
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

    console.log("FINAL SESSION VALUES:", {
        durationSeconds,
        distractionSeconds,
        focusedSeconds
        });

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
                    distractionSeconds: distractionSeconds
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
            distractionSeconds: 0,
            pausedSeconds: 0,
            pausedAt: null
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

            nodeIntegration: false,

            // The sandboxed preload loader intermittently fails at
            // startup with ENOENT on preload.js, leaving window.studyApi
            // undefined so Start and Analytics do nothing. Loading the
            // preload without the sandbox is reliable; context isolation
            // still keeps Node out of the page.
            sandbox: false
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

    // Local reference: the handlers below must act on THIS window,
    // even if another report replaces reportWindow in the meantime.
    const window =
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


    reportWindow =
        window;


    // report.js asks for this when its script runs (see
    // "get-session-report"). A message pushed at "ready-to-show"
    // could arrive before report.js was listening, leaving the
    // report at its placeholder zeros.
    const contentsId =
        window.webContents.id;

    reportSessions.set(
        contentsId,
        savedSession
    );


    // ----------------------------------------
    // Load report UI
    // ----------------------------------------

    window.loadFile(
        path.join(
            __dirname,
            "report.html"
        )
    );


    // ----------------------------------------
    // Send session after page loads
    // ----------------------------------------

    window.once(
        "ready-to-show",
        () => {

            if (window.isDestroyed()) {

                return;
            }


            console.log(
                "REPORT WINDOW READY"
            );


            window.show();

            window.focus();

        }
    );


    // ----------------------------------------
    // Report closed
    // ----------------------------------------

    window.on(
        "closed",
        () => {

            reportSessions.delete(
                contentsId
            );


            // An older report closing must not clear the newer one
            if (reportWindow === window) {

                reportWindow = null;

            }

        }
    );

}


// Session shown by each report window, keyed by its webContents id
const reportSessions = new Map();


ipcMain.handle(
    "get-session-report",
    (event) => {

        return (
            reportSessions.get(
                event.sender.id
            ) ?? null
        );
    }
);

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
                end tell

                set pageURL to ""

                if appName is "Google Chrome" then
                    tell application "Google Chrome"
                        try
                            set pageURL to URL of active tab of front window
                            set windowTitle to title of active tab of front window
                        end try
                    end tell
                else if appName is "Safari" then
                    tell application "Safari"
                        try
                            set pageURL to URL of front document
                            set windowTitle to name of front document
                        end try
                    end tell
                end if

                return appName & "|||" & windowTitle & "|||" & pageURL
                `
            ],
            { timeout: 3000 },
            (error, stdout) => {
                if (error) {
                    console.log(
                        "ACTIVE APPLICATION ERROR:",
                        error.message
                    );
                    resolve(null);
                    return;
                }

                const output = stdout.trim();

                if (!output) {
                    console.log("NO ACTIVE APPLICATION FOUND");
                    resolve(null);
                    return;
                }

                const parts = output.split("|||");

                const app = parts[0]?.trim() || null;
                const title = parts[1]?.trim() || null;
                const url = parts.slice(2).join("|||").trim() || null;

                const result = {
                    app,
                    title,
                    url
                };

                console.log("ACTIVE APPLICATION:", result);

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
// STUDY-RELATED YOUTUBE CHECK
// ========================================

// Answers from the "Is this video for <subject>?" prompt.
// Key: "<subject>|<video key>", value: "study" or "distraction".
const videoAnswers = new Map();

// Unknown video waiting for the user's answer.
let pendingVideo = null;

// Last YouTube page seen, used to skip the moment where YouTube
// has changed the URL but still shows the previous video's title.
let lastYouTubePage = null;

const SUBJECT_STOP_WORDS = new Set([
    "a", "an", "and", "the", "of", "in", "on", "for", "to", "with", "or"
]);


function escapeRegExp(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


// Whole-word match, so "java" does not match "javascript"
// and "c++" still matches "C++ tutorial".
function containsWord(text, word) {

    return new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(word)}(?=$|[^a-z0-9])`
    ).test(text);
}


function matchesSubject(text, subject) {

    const lowerText =
        String(text || "").toLowerCase();

    const lowerSubject =
        String(subject || "").toLowerCase().trim();


    if (!lowerText || !lowerSubject) {

        return false;
    }


    if (containsWord(lowerText, lowerSubject)) {

        return true;
    }


    // "Data Structures" matches a title containing both words
    const words =
        lowerSubject
            .split(/\s+/)
            .filter(
                word =>
                    word &&
                    !SUBJECT_STOP_WORDS.has(word)
            );


    return (
        words.length > 0 &&
        words.every(
            word => containsWord(lowerText, word)
        )
    );
}


// "(4) Java Streams Tutorial - YouTube" -> "Java Streams Tutorial"
function cleanYouTubeTitle(title) {

    const cleaned =
        String(title || "")
            .replace(/^\(\d+\)\s*/, "")
            .replace(/\s+[-–—]\s+YouTube.*$/i, "")
            .trim();


    return cleaned.toLowerCase() === "youtube"
        ? ""
        : cleaned;
}


function getYouTubeUrl(activeWindow) {

    try {

        const url =
            new URL(activeWindow.url);

        const hostname =
            url.hostname.toLowerCase();


        if (
            hostname === "youtube.com" ||
            hostname.endsWith(".youtube.com")
        ) {

            return url;
        }

    }

    catch {

        // No URL or not a valid URL

    }


    return null;
}


function getVideoAnswerKey(subject, key) {

    return `${String(subject || "").toLowerCase().trim()}|${key}`;
}


// Returns { kind, key, text }
// kind: "focus"       not YouTube
//       "study"       YouTube video/search about the subject
//       "distraction" Shorts, home page, feed, or answered "No"
//       "unknown"     ask the user
//       "wait"        YouTube page still loading its title
function classifyActivity(
    activeWindow,
    subject
) {

    if (!isYouTube(activeWindow)) {

        return { kind: "focus" };
    }


    const url =
        getYouTubeUrl(activeWindow);

    let key = null;

    let text = "";


    if (url) {

        if (url.pathname === "/watch") {

            const videoId =
                url.searchParams.get("v");

            text =
                cleanYouTubeTitle(activeWindow.title);


            if (!videoId) {

                return { kind: "distraction" };
            }


            if (!text) {

                return { kind: "wait" };
            }


            key =
                `video:${videoId}`;


            // URL changed but the title is still the previous
            // video's title. Wait one check for it to update.
            if (
                lastYouTubePage &&
                lastYouTubePage.key !== key &&
                lastYouTubePage.text === text &&
                lastYouTubePage.waitedFor !== key
            ) {

                lastYouTubePage.waitedFor =
                    key;

                return { kind: "wait" };
            }

        }

        else if (url.pathname === "/results") {

            text =
                (url.searchParams.get("search_query") || "").trim();


            if (!text) {

                return { kind: "distraction" };
            }


            key =
                `search:${text.toLowerCase()}`;

        }

        else {

            // Home page, Shorts, feeds, channels
            return { kind: "distraction" };
        }

    }

    else {

        // Browser without URL access: only the title is known
        text =
            cleanYouTubeTitle(activeWindow.title);


        if (!text) {

            return { kind: "distraction" };
        }


        key =
            `title:${text.toLowerCase()}`;
    }


    lastYouTubePage = {
        key,
        text
    };


    // ====================================
    // 1. TITLE / SEARCH MATCHES THE SUBJECT
    // ====================================

    if (matchesSubject(text, subject)) {

        return { kind: "study", key, text };
    }


    // ====================================
    // 2. THE USER ALREADY ANSWERED
    // ====================================

    const answerKey =
        getVideoAnswerKey(subject, key);

    const answer =
        videoAnswers.get(answerKey);


    if (answer) {

        return { kind: answer, key, text };
    }


    // ====================================
    // 3. AI CHECK (only used to skip the question)
    // ====================================

    const verdict =
        aiVerdicts.get(answerKey);


    if (!verdict) {

        requestAiVerdict(
            answerKey,
            subject,
            text
        );

        return { kind: "checking", key, text };
    }


    if (verdict.status === "pending") {

        return { kind: "checking", key, text };
    }


    if (verdict.status === "study") {

        return { kind: "study", key, text };
    }


    // ====================================
    // 4. NOT MATCHED: ASK THE USER
    // ====================================

    return { kind: "unknown", key, text };
}


// ========================================
// AI VIDEO CHECK (JAVA BACKEND -> CLAUDE)
// ========================================

// Key: "<subject>|<video key>"
// Value: { status: "pending" | "study" | "unrelated" | "failed" }
// "unrelated" and "failed" both lead to asking the user.
const aiVerdicts = new Map();

const AI_CHECK_TIMEOUT_MS = 25000;


async function requestAiVerdict(
    answerKey,
    subject,
    text
) {

    const verdict = {
        status: "pending"
    };

    aiVerdicts.set(
        answerKey,
        verdict
    );


    try {

        const response = await fetch(
            "http://localhost:8080/api/video-check",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    subject,
                    title: text
                }),
                signal:
                    AbortSignal.timeout(
                        AI_CHECK_TIMEOUT_MS
                    )
            }
        );


        if (!response.ok) {

            throw new Error(
                `Java backend returned HTTP ${response.status}`
            );
        }


        const result =
            await response.json();


        if (typeof result.related !== "boolean") {

            throw new Error(
                "Unexpected AI check response"
            );
        }


        verdict.status =
            result.related
                ? "study"
                : "unrelated";


        console.log(
            "AI VIDEO CHECK:",
            verdict.status,
            text
        );

    }

    catch (error) {

        // Falls back to asking the user
        verdict.status =
            "failed";

        console.log(
            "AI VIDEO CHECK UNAVAILABLE:",
            error.message
        );

    }
}


// ========================================
// ASK ABOUT A VIDEO
// ========================================

// The question appears as a speech bubble in the character window.
function sendToCharacter(channel, payload) {

    if (
        totoroWindow &&
        !totoroWindow.isDestroyed()
    ) {

        totoroWindow.webContents.send(
            channel,
            payload
        );

    }
}


function askAboutVideo(video) {

    console.log(
        "ASKING ABOUT VIDEO:",
        video.text
    );


    sendToCharacter(
        "video-check",
        {
            subject: video.subject,
            title: video.text
        }
    );
}


// Question closed without an answer (user moved on, paused or
// stopped): the video stays a distraction. Its time is already
// being counted by the running distraction.
async function closeUnansweredVideo() {

    if (!pendingVideo) {

        return;
    }


    const video =
        pendingVideo;

    pendingVideo =
        null;


    sendToCharacter(
        "video-check-hide"
    );


    console.log(
        "UNANSWERED VIDEO KEPT AS DISTRACTION:",
        video.text
    );


    await sendActivityToJava(
        video.window
    );
}


// ========================================
// START / CANCEL / END DISTRACTION
// ========================================

// Page the current distraction belongs to (a video key, or
// BROWSE_KEY for Shorts / home page / feeds).
let distractionKey = null;

const BROWSE_KEY = "youtube:browse";


async function startDistraction(
    activeWindow,
    key,
    countVisit
) {

    isDistracted =
        true;

    isSad =
        false;

    distractionStartTime =
        Date.now();

    distractionKey =
        key;


    console.log(
        "DISTRACTION STARTED: YouTube"
    );


    // YouTube = Confused
    sendCharacterState(
        "confused"
    );


    // Unanswered videos are reported when the question closes
    if (countVisit) {

        await sendActivityToJava(
            activeWindow
        );

    }
}


// The video turned out to be for study: its time is not distraction.
function cancelDistraction() {

    console.log(
        "DISTRACTION CANCELLED: study video"
    );


    isDistracted =
        false;

    isSad =
        false;

    distractionStartTime =
        null;

    distractionKey =
        null;
}


function endDistraction() {

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


    isDistracted =
        false;

    isSad =
        false;

    distractionStartTime =
        null;

    distractionKey =
        null;
}


// Clicking the question bubble or dragging the character brings
// our app to the front. That is not "back to studying".
function isCharacterWindow(activeWindow) {

    if (!isOurApplication(activeWindow)) {

        return false;
    }


    // Electron knows which of our windows has focus. The title
    // macOS reports for this small frameless window is not reliable.
    if (
        totoroWindow &&
        !totoroWindow.isDestroyed() &&
        totoroWindow.isFocused()
    ) {

        return true;
    }


    return activeWindow.title === "Character";
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

async function sendActivityToJava(activeWindow) {
    if (!currentSession.id || !activeWindow) {
        return;
    }

    try {
        const response = await fetch(
            `http://localhost:8080/api/study-sessions/${currentSession.id}/activity`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    application: activeWindow.app,
                    title: activeWindow.title,
                    url: activeWindow.url,
                    timestamp: new Date().toISOString()
                })
            }
        );

        if (!response.ok) {
            throw new Error(
                `Java backend returned HTTP ${response.status}`
            );
        }

        const updatedSession = await response.json();

        console.log(
            "ACTIVITY SENT TO JAVA:",
            updatedSession
        );

    } catch (error) {
        console.error(
            "FAILED TO SEND ACTIVITY TO JAVA:",
            error.message
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

            // Answering the question bubble or dragging the
            // character: keep the current state.
            if (
                pendingVideo ||
                isCharacterWindow(activeWindow)
            ) {

                return;
            }

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
        // CLASSIFY: FOCUS / STUDY VIDEO /
        // DISTRACTION / UNKNOWN VIDEO
        // ========================================

        const subject =
            currentSession.subject ||
            selectedSubject ||
            "";

        const activity =
            classifyActivity(
                activeWindow,
                subject
            );


        console.log(
            "ACTIVITY:",
            activity.kind,
            activity.text || ""
        );


        // YouTube title not loaded yet: decide on the next check
        if (activity.kind === "wait") {

            return;
        }


        // ========================================
        // LEFT A VIDEO WITHOUT ANSWERING
        // ========================================
        // The question closes and the video stays a distraction.

        if (
            pendingVideo &&
            activity.key !== pendingVideo.key
        ) {

            await closeUnansweredVideo();

        }


        // ========================================
        // FOCUSED OR WATCHING A STUDY VIDEO
        // ========================================

        if (
            activity.kind === "focus" ||
            activity.kind === "study"
        ) {

            if (isDistracted) {

                if (
                    activity.kind === "study" &&
                    distractionKey === activity.key
                ) {

                    // Matched after all (e.g. AI said related):
                    // this video was never a distraction.
                    cancelDistraction();

                }

                else {

                    console.log(
                        "USER RETURNED FROM DISTRACTION"
                    );

                    endDistraction();

                }


                // ====================================
                // BACK TO WORKING
                // ====================================

                sendCharacterState(
                    "working"
                );

            }

            return;
        }


        // ========================================
        // YOUTUBE THAT IS NOT (YET) STUDY
        // ========================================
        // "distraction": Shorts, home page, or answered "No"
        // "checking":    AI is deciding
        // "unknown":     ask the user
        // In every case the character is confused and the
        // time counts until the video turns out to be for study.

        const pageKey =
            activity.key ??
            BROWSE_KEY;


        // Moved to a different distracting page: close the previous one
        if (
            isDistracted &&
            distractionKey !== pageKey
        ) {

            endDistraction();

        }


        if (!isDistracted) {

            await startDistraction(
                activeWindow,
                pageKey,
                activity.kind === "distraction"
            );

        }

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


        // ========================================
        // NOT MATCHED: ASK THE USER
        // ========================================

        if (
            activity.kind === "unknown" &&
            !pendingVideo
        ) {

            pendingVideo = {
                key: activity.key,
                text: activity.text,
                subject,
                window: activeWindow
            };


            askAboutVideo(
                pendingVideo
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


    // Ctrl+C in the terminal: quit normally so the open
    // session is saved ("before-quit") instead of being cut off.
    for (const signal of ["SIGINT", "SIGTERM"]) {

        process.on(
            signal,
            () => {

                app.quit();

            }
        );

    }


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
async function startStudySession() {

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

        currentSession.distractionSeconds =
            0;

        currentSession.pausedSeconds =
            0;

        currentSession.pausedAt =
            null;

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


        // Without a session nothing is tracked, so stop the
        // countdown and say why instead of failing silently.
        if (
            timerWindow &&
            !timerWindow.isDestroyed()
        ) {

            timerWindow.webContents.send(
                "study-session-error",
                "Backend not running. Start it, then press Start."
            );

        }

        return;
    }


    // ====================================
    // GET ACTIVE APPLICATION RIGHT NOW
    // ====================================

    const startingApplication =
        await getActiveApplication();


    // Only used for logging: tracking starts either way.
    if (!startingApplication) {

        console.log(
            "Could not determine starting application."
        );

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

    pendingVideo =
        null;

    lastYouTubePage =
        null;

    sendToCharacter(
        "video-check-hide"
    );


    console.log(
        "STUDY SESSION STARTED"
    );


    console.log(
        "Starting application:",
        baselineApplication?.app
    );


    console.log(
        "Starting window:",
        baselineApplication?.title
    );


    if (
        baselineApplication?.url
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

ipcMain.on(
    "study-session-start",
    startStudySession
);


// ========================================
// STUDY SESSION PAUSE
// ========================================

ipcMain.on(
    "study-session-pause",
    async () => {

        if (
            !isStudySessionActive ||
            !currentSession.startedAt
        ) {

            console.log(
                "No active study session to pause."
            );

            return;
        }


        // Unanswered video question: count it and close the bubble.
        // Its state is cleared immediately; the backend update
        // is awaited at the end of this handler.
        const unansweredVideo =
            closeUnansweredVideo();


        // ====================================
        // CLOSE ACTIVE DISTRACTION
        // ====================================
        // Break time must not count as distraction.

        if (
            isDistracted &&
            distractionStartTime
        ) {

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
        }


        // ====================================
        // STOP TRACKING, KEEP SESSION OPEN
        // ====================================

        isStudySessionActive =
            false;

        isDistracted =
            false;

        isSad =
            false;

        distractionStartTime =
            null;

        currentSession.pausedAt =
            Date.now();


        console.log(
            "STUDY SESSION PAUSED"
        );


        sendCharacterState(
            "thinking"
        );


        await unansweredVideo;

    }
);


// ========================================
// VIDEO QUESTION ANSWERED
// ========================================

ipcMain.on(
    "video-check-answer",
    async (_event, answer) => {

        if (
            !pendingVideo ||
            !isStudySessionActive ||
            (
                answer !== "study" &&
                answer !== "distraction"
            )
        ) {

            return;
        }


        const video =
            pendingVideo;

        pendingVideo =
            null;


        // Remember for this video and subject
        videoAnswers.set(
            getVideoAnswerKey(
                video.subject,
                video.key
            ),
            answer
        );


        sendToCharacter(
            "video-check-hide"
        );


        console.log(
            "VIDEO ANSWER:",
            answer,
            video.text
        );


        // ====================================
        // YES: STUDY VIDEO
        // ====================================
        // The time since the video opened is not distraction.

        if (answer === "study") {

            if (
                isDistracted &&
                distractionKey === video.key
            ) {

                cancelDistraction();

            }


            sendCharacterState(
                "working"
            );

            return;
        }


        // ====================================
        // NO: DISTRACTION
        // ====================================
        // Character stays confused. The distraction has been
        // counting since the video opened and keeps counting
        // until the user leaves YouTube.

        console.log(
            "VIDEO CONFIRMED AS DISTRACTION:",
            video.text
        );


        await sendActivityToJava(
            video.window
        );

    }
);


// ========================================
// STUDY SESSION RESUME
// ========================================

ipcMain.on(
    "study-session-resume",
    async () => {

        // Session was never created (e.g. backend was down
        // when the timer started) - start one now.
        if (!currentSession.startedAt) {

            console.log(
                "No session to resume. Starting a new one."
            );

            await startStudySession();

            return;
        }


        if (!currentSession.pausedAt) {

            console.log(
                "Study session is not paused."
            );

            return;
        }


        const pausedSeconds =
            Math.floor(
                (
                    Date.now() -
                    currentSession.pausedAt
                ) / 1000
            );

        currentSession.pausedSeconds +=
            pausedSeconds;

        currentSession.pausedAt =
            null;


        isStudySessionActive =
            true;

        isDistracted =
            false;

        isSad =
            false;

        distractionStartTime =
            null;


        console.log(
            "STUDY SESSION RESUMED"
        );

        console.log(
            "Paused for:",
            pausedSeconds,
            "seconds"
        );

        console.log(
            "Total paused:",
            currentSession.pausedSeconds,
            "seconds"
        );


        sendCharacterState(
            "working"
        );

    }
);
// ========================================
// STUDY SESSION STOP
// ========================================

let isStoppingSession = false;

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

        // A second stop while the first is still saving (e.g. the
        // timer finishing as Reset is pressed) would save twice and
        // open two reports.
        if (isStoppingSession) {
            console.log("Study session is already stopping.");
            return;
        }

        console.log(
            "STUDY SESSION STOPPING"
        );


        // ====================================
        // SAVE SESSION THROUGH JAVA BACKEND
        // ====================================

        isStoppingSession =
            true;

        let savedSession;

        try {

            savedSession =
                await saveStudySession(false);

        } finally {

            isStoppingSession =
                false;

        }


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


// ========================================
// SAVE OPEN SESSION ON QUIT
// ========================================
// Quitting mid-session (close button, Cmd+Q, Ctrl+C in the
// terminal) used to leave the session open in the database
// with no end time.

const QUIT_SAVE_TIMEOUT_MS = 5000;

let isQuitting = false;


app.on(
    "before-quit",
    (event) => {

        if (
            isQuitting ||
            !currentSession.startedAt
        ) {

            return;
        }


        // Hold the quit until the session is saved
        event.preventDefault();

        isQuitting =
            true;

        isStudySessionActive =
            false;


        console.log(
            "APP QUITTING: SAVING OPEN STUDY SESSION"
        );


        // A stop already in progress is saving this session
        const saving =
            isStoppingSession
                ? Promise.resolve()
                : saveStudySession(false);


        // Never keep the app open for long if the backend is down
        const timeout =
            new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        QUIT_SAVE_TIMEOUT_MS
                    )
            );


        Promise
            .race([saving, timeout])
            .catch((error) => {

                console.error(
                    "FAILED TO SAVE SESSION ON QUIT:",
                    error
                );

            })
            .finally(() => {

                app.quit();

            });

    }
);