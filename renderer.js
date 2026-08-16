const {
    ipcRenderer
} = require("electron");


const timerDisplay =
    document.getElementById(
        "timerDisplay"
    );


const progressFill =
    document.getElementById(
        "progressFill"
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


// ========================================
// TIMER STATE
// ========================================

let elapsedSeconds = 0;

let timerInterval = null;

let isPaused = false;


// ========================================
// UPDATE TIMER
// ========================================

function updateTimer() {

    const minutes =
        Math.floor(
            elapsedSeconds / 60
        );


    const seconds =
        elapsedSeconds % 60;


    timerDisplay.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


    const totalSeconds =
        Number(
            timerMinutes.value
        ) * 60;


    if (
        totalSeconds <= 0
    ) {

        progressFill.style.width =
            "0%";

        return;

    }


    const progress =
        (
            elapsedSeconds /
            totalSeconds
        ) * 100;


    progressFill.style.width =
        `${Math.min(progress, 100)}%`;

}


// ========================================
// START TIMER
// ========================================

startButton.addEventListener(
    "click",
    () => {

        if (
            timerInterval !== null
        ) {

            return;

        }


        const totalSeconds =
            Number(
                timerMinutes.value
            ) * 60;


        if (
            totalSeconds <= 0
        ) {

            return;

        }


        // ====================================
        // START STUDY SESSION
        // ====================================

        ipcRenderer.send(
            "study-session-start"
        );


        timerInterval =
            setInterval(
                () => {

                    elapsedSeconds++;

                    updateTimer();


                    // =================================
                    // TIMER COMPLETED
                    // =================================

                    if (
                        elapsedSeconds >=
                        totalSeconds
                    ) {

                        clearInterval(
                            timerInterval
                        );


                        timerInterval =
                            null;


                        // Stop distraction monitoring

                        ipcRenderer.send(
                            "study-session-stop"
                        );


                        // Happy = completed session

                        ipcRenderer.send(
                            "character-state",
                            "happy"
                        );


                        alert(
                            "Time's up!"
                        );

                    }

                },
                1000
            );

    }
);


// ========================================
// PAUSE
// ========================================

pauseButton.addEventListener(
    "click",
    () => {

        // ========================================
        // PAUSE
        // ========================================

        if (
            !isPaused
        ) {

            clearInterval(
                timerInterval
            );

            timerInterval =
                null;

            isPaused =
                true;

            pauseButton.textContent =
                "Resume";


            // Stop distraction monitoring

            ipcRenderer.send(
                "study-session-stop"
            );


            return;

        }


        // ========================================
        // RESUME
        // ========================================

        isPaused =
            false;

        pauseButton.textContent =
            "Pause";


        // Start study session again

        ipcRenderer.send(
            "study-session-start"
        );


        const totalSeconds =
            Number(
                timerMinutes.value
            ) * 60;


        timerInterval =
            setInterval(
                () => {

                    elapsedSeconds++;

                    updateTimer();


                    if (
                        elapsedSeconds >=
                        totalSeconds
                    ) {

                        clearInterval(
                            timerInterval
                        );

                        timerInterval =
                            null;


                        isPaused =
                            false;


                        pauseButton.textContent =
                            "Pause";


                        ipcRenderer.send(
                            "study-session-stop"
                        );


                        ipcRenderer.send(
                            "character-state",
                            "happy"
                        );


                        alert(
                            "Time's up!"
                        );

                    }

                },
                1000
            );

    }
);


// ========================================
// RESET
// ========================================

resetButton.addEventListener(
    "click",
    () => {

        clearInterval(
            timerInterval
        );


        timerInterval =
            null;


        elapsedSeconds =
            0;
        isPaused =false;

        pauseButton.textContent =
                            "Pause";


        updateTimer();


        // Stop monitoring

        ipcRenderer.send(
            "study-session-stop"
        );


        // Return character to working

        ipcRenderer.send(
            "character-state",
            "working"
        );

    }
);


// ========================================
// INITIAL DISPLAY
// ========================================

updateTimer();