window.setupCanvas = (imageSrc) => {
    const canvas = document.getElementById("polygonCanvas");
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = imageSrc;

    const closeThreshold = 10; // Pixel distance to consider as "closing" the polygon

    img.onload = () => {

        // set canvas dimensions to match the image
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0); // draw the image on the canvas
    };

    img.onerror = () => {
        console.error("Failed to load image.");
    };

    let drawing = false;
    let points = [];

    const distance = (p1, p2) => {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    // Start drawing
    canvas.onmousedown = (event) => {
        const x = event.offsetX;
        const y = event.offsetY;

        if (!drawing) {
            // Start a new polygon
            drawing = true;
            points = [{ x, y }];
        } else {
            // Check if the current point is close to the starting point
            if (points.length > 1 && distance({ x, y }, points[0]) <= closeThreshold) {
                // Close the polygon
                points.push(points[0]); // Add the starting point to close the polygon
                drawing = false;
                drawPolygon();
                console.log("Polygon completed:", points);
                points = []; 
            } else {
                // Continue drawing
                points.push({ x, y });
                drawPolygon();
            }
        }
    };

    // Draw the polygon as the user moves the mouse
    canvas.onmousemove = (event) => {
        if (!drawing) return;

        const x = event.offsetX;
        const y = event.offsetY;

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
        ctx.drawImage(img, 0, 0); // Redraw the image

        // Draw the current polygon
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(point => {
            ctx.lineTo(point.x, point.y);
            ctx.arc(point.x, point.y, 1, 0, Math.PI * 2, true);
        });
        ctx.lineTo(x, y); // Draw a line to the current mouse position
        ctx.stroke();
    };

    // Draw the final polygon
    const drawPolygon = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
        ctx.drawImage(img, 0, 0); // Redraw the image

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(point => {
            ctx.lineTo(point.x, point.y);
            ctx.arc(point.x, point.y, 1, 0, Math.PI * 2, true);
        });
        ctx.closePath(); // Close the path to create the polygon
        ctx.stroke();
        ctx.strokeStyle = "red";
        ctx.fillStyle = "rgb(232,143,135,0.2)"; // Transparent blue fill
        ctx.fill();
    };

    // End drawing when the mouse is released (optional behavior)
    canvas.onmouseup = () => {
        if (drawing && points.length > 2) {
            // Check if the current point is close to the starting point
            const x = points[points.length - 1].x;
            const y = points[points.length - 1].y;
            if (distance({ x, y }, points[0]) <= closeThreshold) {
                points.push(points[0]); // Add the starting point to close the polygon
                drawing = false;
                drawPolygon(); // Finalize the polygon
                console.log("Polygon completed:", points);
                points = []; // Reset for the next polygon
            }
        }
    };
};

function clearPolygon(){

}

function saveData(){

}

