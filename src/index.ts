import "./point";
import "./draw";
import "./curve";
import "./plot";
import "./css/styles.css";
import "./ui";

import { pathpoints } from "./globals";

document.addEventListener("DOMContentLoaded", () => {
    const saveCppButton = document.getElementById("saveCpp");
    const pathNameInput = document.getElementById("pathNameInput") as HTMLInputElement;

    if (saveCppButton) {
        saveCppButton.addEventListener("click", async () => {
            try {
                let fileName = "path.cpp";

                const routeName = pathNameInput.value.trim();
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(routeName)) {
                    alert("Please enter a valid C++ variable name.");
                    return;
                }

                // Construct the C++ file content
                let cppContent = `#include "paths.h"\n\nstd::vector<Data> ${routeName} = {\n`;
                cppContent += pathpoints
                    .map(wp =>
                        `    {${Math.round(wp.time * 1000)}, ${Math.round(wp.x * 50)}, ${Math.round(wp.y * 50)}, ${Math.round(wp.orientation * 10)}, ${Math.round(wp.velocity * 100)}, ${Math.round(wp.angularVelocity * 1000)}}`
                    )
                    .join(",\n");
                cppContent += `\n};`;

                // Use File System Access API to show Save As dialog
                const fileHandle = await (window as any).showSaveFilePicker({
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

                const writable = await fileHandle.createWritable();
                await writable.write(cppContent);
                await writable.close();

                console.log("File saved successfully!");
            } catch (err) {
                console.error("Save As failed:", err);
                alert("Save failed. Make sure your browser supports the File System Access API.");
            }
        });
    }
});
