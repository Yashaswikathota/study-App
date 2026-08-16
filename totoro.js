const totoro = document.getElementById("totoro");

// Prevent the browser/Electron from treating the image
// as a normal HTML drag operation.
totoro.addEventListener("dragstart", (event) => {
    event.preventDefault();
});