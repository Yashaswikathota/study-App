const {
    ipcRenderer
} = require("electron");


// ========================================
// DOM ELEMENTS
// ========================================

const timerDisplay =
    document.getElementById(
        "timerDisplay"
    );

const progressFill =
    document.getElementById(
        "progressFill"
    );

const progressText =
    document.getElementById(
        "progressText"
    );

const timerMinutes =
    document.getElementById(
        "timerMinutes"
    );

const startButton =
    document.getElementById(
        "startTimer"
    );

const pauseButton =
    document.getElementById(
        "pauseTimer"
    );

const resetButton =
    document.getElementById(
        "resetTimer"
    );

const statusText =
    document.getElementById(
        "statusText"
    );

const subjectDisplay =
    document.getElementById(
        "subjectDisplay"
    );

const timerWindow =
    document.querySelector(
        ".timer-window"
    );


// ========================================
// TIMER STATE
// ========================================

let remainingSeconds = 0;

let timerInterval = null;

let timerStarted = false;


// ========================================
// GET TOTAL SECONDS
// ========================================

function getTotalSeconds() {

    const minutes =
        Number(
            timerMinutes.value
        );

    if (
        !Number.isFinite(minutes) ||
        minutes <= 0
    ) {

        return 0;

    }

    return minutes * 60;

}


// ========================================
// FORMAT TIME
// ========================================

function formatTime(
    seconds
) {

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remaining =
        seconds % 60;

    return `${String(
        minutes
    ).padStart(2, "0")}:${String(
        remaining
    ).padStart(2, "0")}`;

}


// ========================================
// UPDATE TIMER
// ========================================

function updateTimer() {

    timerDisplay.textContent =
        formatTime(
            remainingSeconds
        );


    const totalSeconds =
        getTotalSeconds();


    if (
        totalSeconds <= 0
    ) {

        progressFill.style.width =
            "0%";

        progressText.textContent =
            "0%";

        return;

    }


    const completedSeconds =
        totalSeconds -
        remainingSeconds;


    const progress =
        (
            completedSeconds /
            totalSeconds
        ) * 100;


    const safeProgress =
        Math.min(
            Math.max(
                progress,
                0
            ),
            100
        );


    progressFill.style.width =
        `${safeProgress}%`;


    progressText.textContent =
        `${Math.round(
            safeProgress
        )}%`;

}


// ========================================
// START TIMER
// ========================================

function startTimer() {

    if (
        timerInterval !== null
    ) {

        return;

    }


    const totalSeconds =
        getTotalSeconds();


    if (
        totalSeconds <= 0
    ) {

        statusText.textContent =
            "Enter a valid duration";

        return;

    }


    // Starting again after a pause continues the same session
    const isResuming =
        timerStarted;


    // Initialize countdown
    if (!timerStarted) {

        remainingSeconds =
            totalSeconds;

        timerStarted = true;

        updateTimer();

    }


    // ====================================
    // TELL MAIN PROCESS
    // ====================================

    console.log(
        isResuming
            ? "TIMER RESUMED"
            : "TIMER STARTED"
    );


    ipcRenderer.send(
        isResuming
            ? "study-session-resume"
            : "study-session-start"
    );


    // ====================================
    // UPDATE UI
    // ====================================

    statusText.textContent =
        "Studying";

    timerWindow.classList.add(
        "running"
    );


    // ====================================
    // START COUNTDOWN
    // ====================================

    timerInterval =
        setInterval(
            () => {

                remainingSeconds--;

                updateTimer();


                if (
                    remainingSeconds <= 0
                ) {

                    completeTimer();

                }

            },
            1000
        );

}


// ========================================
// PAUSE TIMER
// ========================================

function pauseTimer() {

    // Nothing to pause
    if (
        timerInterval === null
    ) {

        return;

    }


    clearInterval(
        timerInterval
    );

    timerInterval =
        null;


    statusText.textContent =
        "Paused";


    timerWindow.classList.remove(
        "running"
    );


    console.log(
        "TIMER PAUSED"
    );


    // Keep the session open - Reset or completion ends it
    ipcRenderer.send(
        "study-session-pause"
    );

}


// ========================================
// RESET TIMER
// ========================================

function resetTimer() {

    if (
        timerInterval !== null
    ) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }


    const totalSeconds =
        getTotalSeconds();


    remainingSeconds =
        totalSeconds;


    timerStarted =
        false;


    updateTimer();


    statusText.textContent =
        "Ready to study";


    timerWindow.classList.remove(
        "running"
    );


    console.log(
        "TIMER RESET"
    );


    ipcRenderer.send(
        "study-session-stop"
    );


    ipcRenderer.send(
        "character-state",
        "working"
    );

}


// ========================================
// TIMER COMPLETE
// ========================================

function completeTimer() {

    if (
        timerInterval !== null
    ) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }


    remainingSeconds =
        0;


    // Session is over: the next Start begins a new session
    // with a full countdown instead of resuming this one.
    timerStarted =
        false;


    updateTimer();


    statusText.textContent =
        "Session complete";


    timerWindow.classList.remove(
        "running"
    );


    console.log(
        "TIMER COMPLETED"
    );


    // Stop tracking
    ipcRenderer.send(
        "study-session-stop"
    );


    // Happy character
    ipcRenderer.send(
        "character-state",
        "happy"
    );

    // No alert() here: the timer window is hidden while the
    // report is open, and an alert on a hidden window freezes
    // the timer so the next session cannot be started.

}


// ========================================
// DURATION CHANGED
// ========================================

timerMinutes.addEventListener(
    "change",
    () => {

        if (
            timerInterval !== null
        ) {

            return;

        }


        const totalSeconds =
            getTotalSeconds();


        remainingSeconds =
            totalSeconds;


        timerStarted =
            false;


        updateTimer();

    }
);


// ========================================
// BUTTON EVENTS
// ========================================

startButton.addEventListener(
    "click",
    startTimer
);


pauseButton.addEventListener(
    "click",
    pauseTimer
);


resetButton.addEventListener(
    "click",
    resetTimer
);


// ========================================
// RECEIVE SUBJECT
// ========================================

ipcRenderer.on(
    "study-subject",
    (
        _event,
        subject
    ) => {

        if (!subject) {

            return;

        }


        subjectDisplay.textContent =
            subject;

        console.log(
            "TIMER SUBJECT:",
            subject
        );

    }
);


// ========================================
// SESSION COULD NOT START
// ========================================
// Nothing is tracked without a session, so do not let the
// countdown run as if it were.

ipcRenderer.on(
    "study-session-error",
    (
        _event,
        message
    ) => {

        if (
            timerInterval !== null
        ) {

            clearInterval(
                timerInterval
            );

            timerInterval =
                null;

        }


        remainingSeconds =
            getTotalSeconds();

        timerStarted =
            false;


        updateTimer();


        statusText.textContent =
            message;


        timerWindow.classList.remove(
            "running"
        );


        console.log(
            "SESSION ERROR:",
            message
        );

    }
);


// ========================================
// INITIAL DISPLAY
// ========================================

remainingSeconds =
    getTotalSeconds();

updateTimer();