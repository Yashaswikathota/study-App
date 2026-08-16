const {
    ipcRenderer
} = require("electron");


const characterVideo =
    document.getElementById(
        "characterVideo"
    );


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
// PLAY CHARACTER
// ========================================

function playCharacter(state) {

    const video =
        animations[state];


    if (!video) {

        console.error(
            "Unknown character state:",
            state
        );

        return;

    }


    console.log(
        "Playing character:",
        state
    );


    characterVideo.pause();


    characterVideo.src =
        video;


    characterVideo.currentTime =
        0;


    characterVideo.play()
        .catch(
            error => {

                console.error(
                    "Could not play character:",
                    error
                );

            }
        );

}


// ========================================
// RECEIVE CHARACTER STATE
// ========================================

ipcRenderer.on(
    "character-state",
    (event, state) => {

        playCharacter(
            state
        );

    }
);


// ========================================
// INITIAL STATE
// ========================================

playCharacter(
    "working"
);