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
// SHOW SESSION REPORT
// =========================================================

function renderReport(session) {

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
        session.durationSeconds || 0
            );

        const focused =
            Number(
        session.focusedSeconds || 0
            );

        const distracted =
            Number(
        session.distractionSeconds || 0
            );

        const youtube =
            Number(
        session.youtubeVisits || 0
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


// =========================================================
// LOAD SESSION REPORT
// =========================================================
// Asked for once this script is running, so the data cannot
// arrive before the page is ready to show it.

ipcRenderer
    .invoke("get-session-report")
    .then((session) => {

        if (session) {

            renderReport(session);

        } else {

            console.error(
                "No session data for this report window"
            );

        }

    })
    .catch((error) => {

        console.error(
            "FAILED TO LOAD SESSION REPORT:",
            error
        );

    });


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