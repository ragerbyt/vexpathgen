
export let MODE = "Bezier"


document.addEventListener("DOMContentLoaded", () => {

    const bezier = document.getElementById("PlaceBezier") as HTMLDivElement;
    const line = document.getElementById("PlaceLine") as HTMLDivElement;
    const displaymode = document.getElementById("Mode") as HTMLDivElement

    bezier.addEventListener("click", () => {
        MODE = "Bezier"
        displaymode.innerText = "Mode Selected: " + MODE;
    });

    line.addEventListener("click", () => {
        MODE = "Line"
        displaymode.innerText = "Mode Selected: " + MODE;

    });


});

