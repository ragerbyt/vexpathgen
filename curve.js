document.addEventListener('generatepath', function(event) {
    const points = event.detail.points;
    //alert("aha");

    let waypoints = [];

    for (let i = 0; i < points.length; i += 5) {

        if(i + 6 > points.length) break;


        for (let t = 0; t <= 1.01; t += 0.01) {
            let x = 0, y = 0;

            for (let j = 0; j < 6; j++) {
                if (j + i >= points.length) break; // Prevent out-of-bounds access
                
                let coeff = binomial(5, j) * Math.pow(1 - t, 5 - j) * Math.pow(t, j);
                x += coeff * points[j + i].x;
                y += coeff * points[j + i].y;
            }

            waypoints.push({ x: x, y: y });
            //alert(`x: ${x}, y: ${y}`);
        }
    }

    const drawpath = new CustomEvent("drawpath", {
        detail: { waypoints }, // Pass data inside the event
    });

    document.dispatchEvent(drawpath);
});

function factorial(N) {
    if (N === 0 || N === 1) return 1; // Base case
    let result = 1;
    for (let i = 2; i <= N; i++) {
        result *= i;
    }
    return result;
}

function binomial(N, I) {
    return factorial(N) / (factorial(I) * factorial(N - I));
}
