const { ipcRenderer } = require("electron");


// =========================================================
// ELEMENTS
// =========================================================

const reportSubject =
    document.getElementById("reportSubject");

const reportDuration =
    document.getElementById("reportDuration");

const reportFocused =
    document.getElementById("reportFocused");

const reportDistracted =
    document.getElementById("reportDistracted");

const reportYoutube =
    document.getElementById("reportYoutube");

const focusScore =
    document.getElementById("focusScore");

const reportDoneButton =
    document.getElementById("reportDoneButton");


// =========================================================
// FORMAT TIME
// =========================================================

function formatReportTime(seconds) {

    seconds = Number(seconds || 0);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes =
        Math.floor(seconds / 60);

    const remainingSeconds =
        seconds % 60;

    if (remainingSeconds === 0) {
        return `${minutes}m`;
    }

    return `${minutes}m ${remainingSeconds}s`;
}


// =========================================================
// RECEIVE SESSION REPORT
// =========================================================

ipcRenderer.on(
    "session-report",
    (_event, session) => {

        console.log(
            "================================"
        );

        console.log(
            "REPORT WINDOW RECEIVED SESSION:"
        );

        console.log(
            session
        );

        console.log(
            "================================"
        );


        // ----------------------------------------
        // Get values
        // ----------------------------------------

        const duration =
            Number(
                session.duration_seconds || 0
            );

        const focused =
            Number(
                session.focused_seconds || 0
            );

        const distracted =
            Number(
                session.distraction_seconds || 0
            );

        const youtube =
            Number(
                session.youtube_visits || 0
            );


        // ----------------------------------------
        // Calculate focus score
        // ----------------------------------------

        const score =
            duration > 0
                ? Math.round(
                    (focused / duration) * 100
                )
                : 0;


        // ----------------------------------------
        // Populate report
        // ----------------------------------------

        reportSubject.textContent =
            session.subject || "Study Session";

        reportDuration.textContent =
            formatReportTime(duration);

        reportFocused.textContent =
            formatReportTime(focused);

        reportDistracted.textContent =
            formatReportTime(distracted);

        reportYoutube.textContent =
            youtube;

        focusScore.textContent =
            `${score}%`;

    }
);


// =========================================================
// DONE BUTTON
// =========================================================

reportDoneButton.addEventListener(
    "click",
    () => {

        console.log(
            "REPORT DONE"
        );

        ipcRenderer.send(
            "report-done"
        );

    }
);