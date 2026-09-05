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

            playCharacter(
                "thinking"
            );


            // =================================
            // ASK WHAT NEXT
            // =================================

            setTimeout(
                () => {

                    console.log(
                        "Showing What next?"
                    );


                    alert(
                        "What next?"
                    );

                },
                500
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
// INITIAL STATE
// ========================================

console.log(
    "Setting initial character: working"
);


playCharacter(
    "working"
);