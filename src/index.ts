import "./point";
import "./draw";
import "./curve";
import "./plot";
import "./css/styles.css";
import "./ui";

import { pathpoints } from "./globals";

document.addEventListener("DOMContentLoaded", () => {
    const saveCppButton = document.getElementById("saveCpp");
    const fileNameInput = document.getElementById("fileNameInput") as HTMLInputElement;
    const pathNameInput = document.getElementById("pathNameInput") as HTMLInputElement;
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

                let routeName = pathNameInput.value.trim();

                // Start building the C++ vector definition
                let cppContent = `#include "paths.h"\n\nstd::vector<Data> `
                cppContent += routeName
                cppContent +=`= {\n`;

                // Add waypoints as structs to the vector
                cppContent += pathpoints
                    .map(
                        (wp) => `    {${Math.round(wp.time*1000)}, ${Math.round(wp.x*50)}, ${Math.round(wp.y*50)}, ${Math.round(wp.orientation*10)}, ${Math.round(wp.velocity*100)}, ${Math.round(wp.angularVelocity*1000)}}`
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
