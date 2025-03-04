const points = [];


function createpoints(){
    const canvas = document.getElementById('canvas');
    // Array to store all points {x, y}

    // When you click on the canvas, create a new point
    canvas.addEventListener('click', function(e) {
      // Get the click coordinates relative to the container
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for(let i = -2; i < 3; i++){
        // Create a new point element
        if(points.length == 0 && i < 0) continue;
        const pointElem = document.createElement('div');
        if(i == 0){
          pointElem.classList.add('point');

        }else{
          pointElem.classList.add('ctrlpoint');

        }
        // Position the point
        pointElem.style.left = `${x + i*50}px`;
        pointElem.style.top = `${y}px`;

        // Store the point in the array and also save its index in a data attribute
        const index = points.length;
        points.push({x: x + i*50, y: y});
        pointElem.dataset.index = index;

        // Append the point to the canvas
        canvas.appendChild(pointElem);

        // Add drag functionality to the point
        addDragHandlers(pointElem, rect);
        console.log('Points array:', points);
      }

      const genpath = new CustomEvent("generatepath", {
        detail: {points}, // Pass data inside the event
      });
    
      document.dispatchEvent(genpath);

    })
}


function addDragHandlers(pointElem, rect) {
    let isDragging = false;

    pointElem.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    // When the user presses down on the point, start dragging
    pointElem.addEventListener('mousedown', function(e) {
      e.stopPropagation();  // Prevent the canvas click from firing
      isDragging = true;
        // Listen for mousemove events on the entire document
        function onMouseMove(e){
            if (!isDragging) return;
            // Calculate new position relative to canvas
            const newX = e.clientX - rect.left;
            const newY = e.clientY - rect.top;
            // Update the point's style to move it
            pointElem.style.left = `${newX}px`;
            pointElem.style.top = `${newY}px`;
            // Update the corresponding point's coordinates in the array
            const idx = pointElem.dataset.index;
            points[idx] = { x: newX, y: newY };

            if(idx % 5 == 0){
              for(let i = -2; i < 3; i++)
            }

            const genpath = new CustomEvent("generatepath", {
              detail: {points}, // Pass data inside the event
            });
          
            document.dispatchEvent(genpath);
        }

        // Stop dragging on mouseup
        function onMouseUp(e){
            isDragging = false;
            console.log('Updated points array:', points);

            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('mousemove', onMouseMove);
        };

        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('mousemove', onMouseMove);
    });

  }

  

  document.addEventListener("DOMContentLoaded", createpoints);
 