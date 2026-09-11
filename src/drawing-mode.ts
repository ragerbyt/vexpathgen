import { FIELD_BACKGROUND_MODE, FieldBackgroundMode, setFieldBackgroundMode } from "./editor-state";
import { redrawCanvas } from "./field-renderer";

export let MODE = "Bezier";

document.addEventListener("DOMContentLoaded", () => {
    const modeSelect = document.getElementById("modeSelect") as HTMLSelectElement | null;
    const fieldSelect = document.getElementById("fieldSelect") as HTMLSelectElement | null;
    if (!modeSelect) return;

    if (fieldSelect) {
        fieldSelect.value = FIELD_BACKGROUND_MODE;
    }

    modeSelect.value = MODE;

    modeSelect.addEventListener("change", () => {
        MODE = modeSelect.value;
    });

    fieldSelect?.addEventListener("change", () => {
        const selected = fieldSelect.value as FieldBackgroundMode;
        setFieldBackgroundMode(selected);
        redrawCanvas();
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