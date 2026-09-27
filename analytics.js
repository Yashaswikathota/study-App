const { ipcRenderer } =
    require("electron");


// =========================================================
// ELEMENTS
// =========================================================

const totalStudy =
    document.getElementById(
        "totalStudy"
    );

const focusedTime =
    document.getElementById(
        "focusedTime"
    );

const distractedTime =
    document.getElementById(
        "distractedTime"
    );

const youtubeVisits =
    document.getElementById(
        "youtubeVisits"
    );

const focusScore =
    document.getElementById(
        "focusScore"
    );

const focusProgress =
    document.getElementById(
        "focusProgress"
    );

const focusMessage =
    document.getElementById(
        "focusMessage"
    );

const sessionsList =
    document.getElementById(
        "sessionsList"
    );

const closeAnalytics =
    document.getElementById(
        "closeAnalytics"
    );


// =========================================================
// FORMAT TIME
// =========================================================

function formatTime(seconds) {

    seconds =
        Number(seconds || 0);


    if (seconds < 60) {

        return `${seconds}s`;

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    if (minutes < 60) {

        if (remainingSeconds === 0) {

            return `${minutes}m`;

        }

        return `${minutes}m ${remainingSeconds}s`;

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remainingMinutes =
        minutes % 60;


    if (remainingMinutes === 0) {

        return `${hours}h`;

    }


    return `${hours}h ${remainingMinutes}m`;

}


// =========================================================
// FORMAT DATE
// =========================================================

function formatDate(date) {

    if (!date) {

        return "";

    }


    return new Date(date)
        .toLocaleDateString(
            undefined,
            {
                month: "short",
                day: "numeric"
            }
        );

}


// =========================================================
// FOCUS MESSAGE
// =========================================================

function getFocusMessage(score) {

    if (score >= 90) {

        return "Excellent focus. You stayed locked in.";

    }


    if (score >= 75) {

        return "Great work. You maintained strong focus.";

    }


    if (score >= 50) {

        return "Good effort. Keep building your focus.";

    }


    if (score >= 25) {

        return "You got distracted quite a bit. Let's improve the next session.";

    }


    return "Let's try a more focused session next time.";

}


// =========================================================
// RENDER SESSIONS
// =========================================================

function renderSessions(sessions) {

    if (
        !sessions ||
        sessions.length === 0
    ) {

        sessionsList.innerHTML = `
            <div class="empty-state">
                No study sessions yet.
            </div>
        `;

        return;

    }


    sessionsList.innerHTML =
        sessions
            .map(
                (session) => {

                    const duration =
                        Number(
                            session.durationSeconds || 0
                        );


                    const focused =
                        Number(
                            session.focusedSeconds || 0
                        );


                    const score =
                        duration > 0
                            ? Math.round(
                                (
                                    focused /
                                    duration
                                ) * 100
                            )
                            : 0;


                    return `
                        <div class="session">

                            <div>

                                <div class="session-subject">
                                    ${escapeHtml(
                                        session.subject ||
                                        "Study Session"
                                    )}
                                </div>

                                <div class="session-date">
                                    ${formatDate(
                                        session.startedAt
                                    )}
                                </div>

                            </div>

                            <div class="session-duration">
                                ${formatTime(duration)}
                            </div>

                            <div class="session-score">
                                ${score}%
                            </div>

                        </div>
                    `;

                }
            )
            .join("");

}


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// =========================================================
// LOAD ANALYTICS
// =========================================================

async function loadAnalytics() {

    try {

        console.log(
            "REQUESTING ANALYTICS DATA"
        );


        const analytics =
            await ipcRenderer.invoke(
                "get-study-analytics"
            );


        console.log(
            "ANALYTICS DATA FROM JAVA:",
            JSON.stringify(
                analytics,
                null,
                2
            )
        );


        const totals =
            analytics.totals;


        // ----------------------------------------
        // Values
        // ----------------------------------------

        const totalSeconds =
            Number(
                totals.totalSeconds || 0
            );


        const focusedSeconds =
            Number(
                totals.focusedSeconds || 0
            );


        const distractionSeconds =
            Number(
                totals.distractionSeconds || 0
            );


        const visits =
            Number(
                totals.youtubeVisits || 0
            );


        const score =
            Number(
                totals.focusScore || 0
            );


        // ----------------------------------------
        // Overview
        // ----------------------------------------

        totalStudy.textContent =
            formatTime(
                totalSeconds
            );


        focusedTime.textContent =
            formatTime(
                focusedSeconds
            );


        distractedTime.textContent =
            formatTime(
                distractionSeconds
            );


        youtubeVisits.textContent =
            visits;


        // ----------------------------------------
        // Focus score
        // ----------------------------------------

        focusScore.textContent =
            `${score}%`;


        focusProgress.style.width =
            `${score}%`;


        focusMessage.textContent =
            getFocusMessage(score);


        // ----------------------------------------
        // Sessions
        // ----------------------------------------

        renderSessions(
            analytics.sessions
        );

    }

    catch (error) {

        console.error(
            "FAILED TO LOAD ANALYTICS:",
            error
        );

    }

}


// =========================================================
// CLOSE
// =========================================================

closeAnalytics.addEventListener(
    "click",
    () => {

        window.close();

    }
);


// =========================================================
// INITIAL LOAD
// =========================================================

loadAnalytics();