export let MODE = "Bezier"

document.addEventListener("DOMContentLoaded", () => {
    const modeSelect = document.getElementById("modeSelect") as HTMLSelectElement | null;
    if (!modeSelect) return;

    modeSelect.value = MODE;

    modeSelect.addEventListener("change", () => {
        MODE = modeSelect.value;
    });

    document.addEventListener("keydown", (event) => {
        if (event.key.toLowerCase() === "e") {

            // example: cycle through options
            const nextIndex =
                (modeSelect.selectedIndex + 1) % modeSelect.options.length;

            modeSelect.selectedIndex = nextIndex;

            // update MODE
            MODE = modeSelect.value;

            // trigger change event if needed
            modeSelect.dispatchEvent(new Event("change"));
        }
    });
});