
export let MODE = "Bezier"


document.addEventListener("DOMContentLoaded", () => {

    const bezier = document.getElementById("PlaceBezier") as HTMLDivElement;
    const bezier3 = document.getElementById("PlaceBezier3") as HTMLDivElement;
    const line = document.getElementById("PlaceLine") as HTMLDivElement;
    const arc = document.getElementById("PlaceArc") as HTMLDivElement;
    const displaymode = document.getElementById("Mode") as HTMLDivElement

    bezier.addEventListener("click", () => {
        MODE = "Bezier"
        displaymode.innerText = "Mode Selected: " + MODE;
    });

    bezier3.addEventListener("click", () => {
        MODE = "Bezier3"
        displaymode.innerText = "Mode Selected: " + MODE;
    });

    line.addEventListener("click", () => {
        MODE = "Line"
        displaymode.innerText = "Mode Selected: " + MODE;

    });

    arc.addEventListener("click", () => {
        MODE = "Arc"
        displaymode.innerText = "Mode Selected: " + MODE;

    });


});

