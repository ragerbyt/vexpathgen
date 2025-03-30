import "./point";
import "./draw";
import "./curve";
import "./plot";
import "./css/styles.css";
import "./ui";

import { waypoints } from "./curve";

document.addEventListener("DOMContentLoaded", () => {
    const saveCppButton = document.getElementById("saveCpp");
    const fileNameInput = document.getElementById("fileNameInput") as HTMLInputElement;

    // Example waypoints (finalWaypoint objects)
  

    if (saveCppButton) {
        saveCppButton.addEventListener("click", () => {
            try {
                // Get the file name from the input field
                let fileName = fileNameInput.value.trim();
                if (!fileName) {
                    fileName = "waypoints.cpp"; // Default name
                }

                if (!fileName.endsWith(".cpp")) {
                    fileName += ".cpp";
                }

                // Start building the C++ vector definition
                let cppContent = `std::vector<Data> path = {\n`;

                // Add waypoints as structs to the vector
                cppContent += waypoints
                    .map(
                        (wp) => `    {${wp.time}, ${wp.x}, ${wp.y}, ${wp.orientation}, ${wp.velocity}, ${wp.angularVelocity}}`
                    )
                    .join(",\n");
                cppContent += `\n};`;

                // Create a Blob object for the file
                const blob = new Blob([cppContent], { type: "text/plain" });

                // Create an anchor element for download
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = fileName; // Use the file name with the .cpp extension

                // Trigger the download
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                console.error("Error saving file:", err);
            }
        });
    }
});
