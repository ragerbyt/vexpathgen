import "./point";
import "./draw";
import "./curve";
import "./plot";
import "./css/styles.css";
import "./ui";
import "./sidebar"

import { pathpoints } from "./globals";

let fileHandle: FileSystemFileHandle | undefined; // Store the file handle for re-use

document.addEventListener("DOMContentLoaded", () => {
    const saveCppButton = document.getElementById("saveCpp") as HTMLButtonElement;
    const pathNameInput = document.getElementById("pathNameInput") as HTMLInputElement;
    const statusMessage = document.getElementById("statusMessage");

    saveCppButton.addEventListener("click",() => {
        



    // Initial save function
    async function saveFile(): Promise<void> {
        try {
            let fileName = "path.cpp";

            const routeName = pathNameInput.value.trim();
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(routeName)) {
                alert("Please enter a valid C++ variable name.");
                return;
            }

            let mode = "BACK"; // or you can use a selected mode as before

            // Construct the C++ file content
            let cppContent = `#include "paths.h"\n\nconst std::vector<Data> ${routeName} = {\n`;

            if (mode == "FORWARD") {
                cppContent += pathpoints
                    .map(wp =>
                        `    {${Math.round(wp.time * 1000)}, ${Math.round(wp.x * 50)}, ${Math.round(wp.y * 50)}, ${Math.round(wp.orientation * 100)}, ${Math.round(wp.velocity * 100)}, ${Math.round(wp.angularVelocity * 1000)}}`
                    )
                    .join(",\n");
                cppContent += `\n};`;
            } else if (mode == "BACK") {
                cppContent += pathpoints
                    .map(wp =>
                        `    {${Math.round(wp.time * 1000)}, ${Math.round(wp.x * 50)}, ${Math.round(wp.y * 50)}, ${Math.round((wp.orientation + Math.PI) * 100)}, ${Math.round(wp.velocity * -100)}, ${Math.round(wp.angularVelocity * 1000)}}`
                    )
                    .join(",\n");
                cppContent += `\n};`;
            }

            if (pathpoints.length === 0) {
                alert("No path points available to save.");
                return;
            }

            // If we don't have a file handle, let the user choose the file
            if (!fileHandle) {
                const fileHandleSelection = await (window as any).showSaveFilePicker({
                    suggestedName: fileName,
                    types: [
                        {
                            description: "C++ Source File",
                            accept: {
                                "text/x-c++src": [".cpp"]
                            }
                        }
                    ],
                    excludeAcceptAllOption: true
                });

                fileHandle = fileHandleSelection;
            }

            const writable = await fileHandle!.createWritable();
            await writable.write(cppContent);
            await writable.close();

            // Update status after successful save
            if (statusMessage) {
                statusMessage.innerText = "File saved successfully!";
            }

            console.log("File saved successfully!");
        } catch (err) {
            console.error("Auto-Save failed:", err);
            if (statusMessage) {
                statusMessage.innerText = "Auto-save failed. Please try again.";
            }
            alert("Auto-save failed. Make sure your browser supports the File System Access API.");
        }
    }

    // Periodic auto-save (every 30 seconds)
    setInterval(saveFile, 30000); // 30,000 ms = 30 seconds

    // Optional: Manual save trigger (for immediate save)
    if (saveCppButton) {
        saveCppButton.addEventListener("click", saveFile);
    }

    });

});
