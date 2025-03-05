// Listen for the "generatepath" event to compute the Bezier path waypoints.
document.addEventListener('generatepath', (event) => {
    const points = event.detail.points;
    const waypoints = computeBezierWaypoints(points);
    dispatchDrawPathEvent(waypoints);
});

/**
 * Computes waypoints along Bezier curves for each group of 6 points.
 * Each group of points is assumed to start every 5 points in the array.
 *
 * @param {Array} points - Array of point elements containing dataset.x and dataset.y.
 * @returns {Array} Array of waypoint objects { x, y }.
 */
function computeBezierWaypoints(points) {
    const waypoints = [];

    // Process points in groups of 6 (starting every 5 points)
    for (let i = 0; i < points.length; i += 5) {
        // Ensure that a full set of 6 points exists.
        if (i + 6 > points.length) break;

        // t parameter runs from 0 to 1 in increments.
        for (let t = 0; t <= 1.01; t += 0.01) {
            let x = 0;
            let y = 0;

            // Calculate the Bezier sum for each control point.
            for (let j = 0; j < 6; j++) {
                if (j + i >= points.length) break; // Safety check
                const pointX = Number(points[j + i].dataset.x);
                const pointY = Number(points[j + i].dataset.y);
                const coeff = binomialCoefficient(5, j) * Math.pow(1 - t, 5 - j) * Math.pow(t, j);
                x += coeff * pointX;
                y += coeff * pointY;
            }

            waypoints.push({ x, y });
        }
    }
    return waypoints;
}

/**
 * Dispatches a custom event "drawpath" with the computed waypoints.
 *
 * @param {Array} waypoints - Array of waypoint objects { x, y }.
 */
function dispatchDrawPathEvent(waypoints) {
    const drawPathEvent = new CustomEvent("drawpath", {
        detail: { waypoints },
    });
    document.dispatchEvent(drawPathEvent);
}

/**
 * Computes the factorial of a given number.
 *
 * @param {number} n - The number to compute the factorial for.
 * @returns {number} The factorial of n.
 */
function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

/**
 * Computes the binomial coefficient "n choose k".
 *
 * @param {number} n - Total number of items.
 * @param {number} k - Number of items chosen.
 * @returns {number} The binomial coefficient.
 */
function binomialCoefficient(n, k) {
    return factorial(n) / (factorial(k) * factorial(n - k));
}
