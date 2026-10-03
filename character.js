const {
    ipcRenderer
} = require("electron");


const characterVideo =
    document.getElementById(
        "characterVideo"
    );


// ========================================
// DEBUG
// ========================================

console.log("================================");
console.log("CHARACTER.JS LOADED");
console.log(
    "characterVideo:",
    characterVideo
);
console.log("================================");


// ========================================
// CHARACTER VIDEOS
// ========================================

const animations = {

    working:
        "./assets/Coding.webm",

    thinking:
        "./assets/thinking.webm",

    confused:
        "./assets/Confused.webm",

    sad:
        "./assets/Sad.webm",

    happy:
        "./assets/Happy.webm"

};


// ========================================
// CHARACTER STATE
// ========================================

let currentState =
    "working";


// ========================================
// PLAY CHARACTER
// ========================================

function playCharacter(state) {

    console.log("================================");
    console.log("PLAY CHARACTER");
    console.log("Requested state:", state);
    console.log("================================");


    const video =
        animations[state];


    if (!video) {

        console.error(
            "Unknown character state:",
            state
        );

        return;

    }


    currentState =
        state;


    // Stop current video

    characterVideo.pause();


    // Change video

    characterVideo.src =
        video;


    // Start from beginning

    characterVideo.currentTime =
        0;


    // ====================================
    // LOOP CONTROL
    // ====================================

    if (
        state === "happy"
    ) {

        // Happy plays ONLY ONCE

        characterVideo.loop =
            false;

        console.log(
            "Happy: LOOP OFF"
        );

    } else {

        // Other animations keep looping

        characterVideo.loop =
            true;

        console.log(
            state,
            ": LOOP ON"
        );

    }


    // ====================================
    // PLAY VIDEO
    // ====================================

    characterVideo.play()
        .then(
            () => {

                console.log(
                    "SUCCESS: Playing",
                    state
                );

            }
        )
        .catch(
            error => {

                console.error(
                    "ERROR: Could not play",
                    state,
                    error
                );

            }
        );

}


// ========================================
// VIDEO FINISHED
// ========================================

characterVideo.addEventListener(
    "ended",
    () => {

        console.log("================================");
        console.log("VIDEO ENDED");
        console.log(
            "Current state:",
            currentState
        );
        console.log(
            "Video src:",
            characterVideo.src
        );
        console.log("================================");


        // ====================================
        // HAPPY FINISHED
        // ====================================

        if (
            currentState === "happy"
        ) {

            console.log(
                "HAPPY VIDEO FINISHED"
            );


            console.log(
                "Changing HAPPY -> THINKING"
            );


            // Change to thinking
            // (No alert() here: it blocks this window, so the
            // character would stop reacting until the app restarts.)

            playCharacter(
                "thinking"
            );

        }

    }
);


// ========================================
// RECEIVE CHARACTER STATE
// ========================================

ipcRenderer.on(
    "character-state",
    (event, state) => {

        console.log("================================");
        console.log(
            "IPC CHARACTER STATE RECEIVED"
        );
        console.log(
            "Received state:",
            state
        );
        console.log("================================");


        playCharacter(
            state
        );

    }
);


// ========================================
// VIDEO QUESTION BUBBLE
// ========================================

const videoCheck =
    document.getElementById(
        "videoCheck"
    );

const videoCheckSubject =
    document.getElementById(
        "videoCheckSubject"
    );

const videoCheckTitle =
    document.getElementById(
        "videoCheckTitle"
    );


function hideVideoCheck() {

    videoCheck.hidden =
        true;

    document.body.classList.remove(
        "asking"
    );

}


ipcRenderer.on(
    "video-check",
    (_event, video) => {

        videoCheckSubject.textContent =
            video.subject;

        videoCheckTitle.textContent =
            video.title;

        videoCheck.hidden =
            false;

        document.body.classList.add(
            "asking"
        );

    }
);


ipcRenderer.on(
    "video-check-hide",
    hideVideoCheck
);


document
    .getElementById("videoCheckYes")
    .addEventListener(
        "click",
        () => {

            hideVideoCheck();

            ipcRenderer.send(
                "video-check-answer",
                "study"
            );

        }
    );


document
    .getElementById("videoCheckNo")
    .addEventListener(
        "click",
        () => {

            hideVideoCheck();

            ipcRenderer.send(
                "video-check-answer",
                "distraction"
            );

        }
    );


// ========================================
// INITIAL STATE
// ========================================

console.log(
    "Setting initial character: working"
);


playCharacter(
    "working"
);