// =========================================================
// SUBJECT SELECTION
// =========================================================

const subjectInput =
  document.getElementById("subjectInput");

const startButton =
  document.getElementById("startButton");

const enterButton =
  document.getElementById("enterButton");

const laterButton =
  document.getElementById("laterButton");

let isPaused = false;


// =========================================================
// START STUDYING
// =========================================================

function startStudying() {

  const subject =
    subjectInput.value.trim();


  // -----------------------------------------
  // Empty subject
  // -----------------------------------------

  if (!subject) {

    subjectInput.focus();

    const input =
      document.querySelector(".study-input");

    input.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" }
      ],
      {
        duration: 300,
        easing: "ease-out"
      }
    );

    return;
  }


  console.log(
    "Selected subject:",
    subject
  );


  // -----------------------------------------
  // Button feedback
  // -----------------------------------------

  const text =
    startButton.querySelector("span");

  text.textContent =
    "Starting...";


  // -----------------------------------------
  // Send subject to Electron
  // -----------------------------------------

  window.studyApi.selectSubject(
    subject
  );

}


// =========================================================
// START BUTTON
// =========================================================

startButton.addEventListener(
  "click",
  startStudying
);


// =========================================================
// ENTER BUTTON
// =========================================================

enterButton.addEventListener(
  "click",
  startStudying
);


// =========================================================
// ENTER KEY
// =========================================================

subjectInput.addEventListener(
  "keydown",
  (event) => {

    if (event.key === "Enter") {

      startStudying();

    }

  }
);


// =========================================================
// MAYBE LATER
// =========================================================

laterButton.addEventListener(
  "click",
  () => {

    console.log(
      "Maybe later"
    );

  }
);


// =========================================================
// NAVIGATION
// =========================================================

document
  .querySelectorAll(".nav-item")
  .forEach((item) => {

    item.addEventListener("click", () => {

      const page = item.textContent.trim();

      console.log("NAV CLICK:", page);

      // Active navigation state
      document
        .querySelectorAll(".nav-item")
        .forEach((nav) => {
          nav.classList.remove("active");
        });

      item.classList.add("active");


      // =====================================================
      // ANALYTICS
      // =====================================================

      if (page === "Analytics") {

        console.log("ANALYTICS BUTTON CLICKED");

        window.studyApi.openAnalytics();

      }

    });

  });
// =========================================================
// ELECTRON WINDOW CONTROLS
// =========================================================

const hideWindow =
  document.getElementById(
    "hideWindow"
  );

const fullscreenWindow =
  document.getElementById(
    "fullscreenWindow"
  );

const closeWindow =
  document.getElementById(
    "closeWindow"
  );


hideWindow.addEventListener(
  "click",
  () => {

    window.electronWindow.hide();

  }
);


fullscreenWindow.addEventListener(
  "click",
  () => {

    window.electronWindow.toggleFullscreen();

  }
);


closeWindow.addEventListener(
  "click",
  () => {

    window.electronWindow.close();

  }
);