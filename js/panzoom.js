const config = {
    panzoom: { // Panzoom config Constants.cs
        startScale: 1,
        minScale: 1,
        maxScale: 40,
        scaleStep: 1
    },
    rectangle: {
        minSize: 100
    },
    photo: {
        types: { // PanZoomPhotoType enum Constants.cs
            normal: -1,
            base: 0,
            overlay: 1
        },
        scaleThreshold: 10
    },
    compare: {
        types: { // CompareType enum Constants.cs
            none: -1,
            xray: 0,
            sideBySide: 1
        },
        sideBySideGap: 8 // gap-2 = 8px between photos in side-by-side view
    }
};

// Global Panzoom instances
let panzoomNormalPhoto = null;
let panzoomBasePhoto = null;
let panzoomOverlayPhoto = null;
let panzoomRectangle = null;

let dotNetPanZoomHelper;
let hasTriggeredOriginalPhoto = false;

// Debounce utility
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// Initialize pan/zoom
function initializePanzoom(dotNetObj, panzoomId, photoType, compareType) {
    const container = document.getElementById(`panzoomPhotoContainer-${panzoomId}`);
    if (!container) return;

    const rangeInput = document.getElementById("panzoomInputRange");
    const zoomOutBtn = document.getElementById("panzoomZoomOutButton");
    const zoomInBtn = document.getElementById("panzoomZoomInButton");
    const sideBySideZoomOutBtn = document.getElementById("panzoomSideBySideZoomOutButton");
    const sideBySideZoomInBtn = document.getElementById("panzoomSideBySideZoomInButton");
    const sideBySideRange = document.getElementById("panzoomSideBySideInputRange");

    dotNetPanZoomHelper = dotNetObj;
    let isPanning = false;

    const panzoom = Panzoom(container, {
        startScale: config.panzoom.startScale,
        minScale: config.panzoom.minScale,
        maxScale: config.panzoom.maxScale,
        step: config.panzoom.scaleStep,
        contain: 'outside',
        panOnlyWhenZoomed: true,
        noBind: true,
    });

    // Assign globals based on photo type
    if (photoType === config.photo.types.normal) {
        panzoomNormalPhoto = { id: panzoomId, panzoom };
        panzoomBasePhoto = null;
        panzoomOverlayPhoto = null;
    } else if (photoType === config.photo.types.base) {
        panzoomBasePhoto = { id: panzoomId, panzoom };
        panzoomNormalPhoto = null;
    } else if (photoType === config.photo.types.overlay) {
        panzoomOverlayPhoto = { id: panzoomId, panzoom };
        panzoomNormalPhoto = null;
    }

    // Event handlers
    container.addEventListener('wheel', (event) => {
        panzoom.zoomWithWheel(event);
        const newScale = panzoom.getScale();
        setCurrentZoomScale(newScale);

        if (photoType === config.photo.types.base && panzoomOverlayPhoto && compareType === config.compare.types.xray) {
            panzoomOverlayPhoto.panzoom.zoomWithWheel(event);
        }
        else if (photoType === config.photo.types.overlay && panzoomBasePhoto && compareType === config.compare.types.xray) {
            panzoomBasePhoto.panzoom.zoomWithWheel(event);
        }
        else if (photoType === config.photo.types.base && panzoomOverlayPhoto && compareType === config.compare.types.sideBySide) {
            const ctn = document.getElementById('panzoomContainer-basePhotoSideBySide');
            const point = {
                clientX: event.clientX + ctn.getBoundingClientRect().width + config.compare.sideBySideGap,
                clientY: event.clientY,
            };
            panzoomOverlayPhoto.panzoom.zoomToPoint(newScale, point);
        }
        else if (photoType === config.photo.types.overlay && panzoomBasePhoto && compareType === config.compare.types.sideBySide) {
            const ctn = document.getElementById('panzoomContainer-overlayPhotoSideBySide');
            const point = {
                clientX: event.clientX - ctn.getBoundingClientRect().width - config.compare.sideBySideGap,
                clientY: event.clientY,
            };
            panzoomBasePhoto.panzoom.zoomToPoint(newScale, point);
        }

        updatePolygon();
        if (rangeInput) rangeInput.value = newScale;
        if (sideBySideRange) sideBySideRange.value = newScale;
        if (newScale > config.photo.scaleThreshold) showOriginalPhoto();
    });

    container.addEventListener('pointerdown', (event) => {
        isPanning = true;
        panzoom.handleDown(event);
    });

    document.addEventListener('pointermove', (event) => {
        panzoom.handleMove(event);
        if (isPanning) syncPanPosition(panzoom, photoType);
    });

    document.addEventListener('pointerup', (event) => {
        isPanning = false;
        panzoom.handleUp(event);
    });

    // Zoom controls
    if (rangeInput) {
        rangeInput.addEventListener('input', (event) => {
            const newScale = event.target.valueAsNumber;
            panzoom.zoom(newScale);
            setCurrentZoomScale(newScale);
            if (newScale >= config.photo.scaleThreshold) showOriginalPhoto();
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            const newScale = Math.max(config.panzoom.minScale, panzoom.getScale() - config.panzoom.scaleStep);
            panzoom.zoom(newScale);
            setCurrentZoomScale(newScale);
            if (rangeInput) rangeInput.value = newScale;
        });
    }

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            const newScale = Math.min(config.panzoom.maxScale, panzoom.getScale() + config.panzoom.scaleStep);
            panzoom.zoom(newScale);
            setCurrentZoomScale(newScale);
            if (rangeInput) rangeInput.value = newScale;
            if (newScale > + config.photo.scaleThreshold) showOriginalPhoto();
        });
    }

    if (sideBySideZoomOutBtn) {
        sideBySideZoomOutBtn.addEventListener('click', () => {
            const newScale = Math.max(config.panzoom.minScale, panzoom.getScale() - config.panzoom.scaleStep);
            panzoom.zoom(newScale);
            if (sideBySideRange) sideBySideRange.value = newScale;
        });
    }

    if (sideBySideZoomInBtn) {
        sideBySideZoomInBtn.addEventListener('click', () => {
            const newScale = Math.min(config.panzoom.maxScale, panzoom.getScale() + config.panzoom.scaleStep);
            panzoom.zoom(newScale);
            if (sideBySideRange) sideBySideRange.value = newScale;
        });
    }

    if (sideBySideRange) {
        sideBySideRange.addEventListener('input', (event) => {
            panzoom.zoom(event.target.valueAsNumber);
        });
    }

    function showOriginalPhoto() {
        if (photoType === config.photo.types.normal && !hasTriggeredOriginalPhoto) {
            hasTriggeredOriginalPhoto = true;
            dotNetPanZoomHelper.invokeMethodAsync("ShowOriginalPhoto");
        }
    }

    function setCurrentZoomScale(scale) {
        dotNetPanZoomHelper.invokeMethodAsync("SetCurrentZoomScale", scale);
    }
}

// Initialize rectangle pan/zoom
function initPanZoomRectangle() {
    const container = document.getElementById("rectangleContainer");
    const rectangle = document.getElementById("rectangle");
    if (!container || !rectangle) return;

    const containerRect = container.getBoundingClientRect();
    let maxWidth = containerRect.width;
    let maxHeight = containerRect.height;

    let isResizing = false;
    let isMoving = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let activeCorner;

    const panzoom = Panzoom(rectangle, {
        startScale: config.panzoom.startScale,
        minScale: config.panzoom.minScale,
        maxScale: config.panzoom.maxScale,
        step: config.panzoom.scaleStep,
        noBind: true,
        contain: 'inside',
        disableZoom: true,
        cursor: "grab",
    });

    debounce(() => {
        panzoom.pan((maxWidth - config.rectangle.minSize) / 2, (maxHeight - config.rectangle.minSize) / 2);
        rectangle.style.border = "2px solid red";
        rectangle.querySelectorAll(".handle").forEach((handle) => {
            handle.style.backgroundColor = "red";
        });
    })();

    panzoomRectangle = panzoom;

    // Event handlers
    rectangle.addEventListener('wheel', (event) => {
        if (panzoomBasePhoto) panzoomBasePhoto.panzoom.zoomWithWheel(event);
        if (panzoomOverlayPhoto) panzoomOverlayPhoto.panzoom.zoomWithWheel(event);
        const rangeInput = document.getElementById("panzoomInputRange");
        if (rangeInput && panzoomBasePhoto) rangeInput.value = panzoomBasePhoto.panzoom.getScale();
    });

    rectangle.addEventListener('pointerdown', (event) => {
        panzoom.handleDown(event);
        if (!event.target.classList.contains('handle') && !isResizing) {
            isMoving = true;
            updatePolygon();
        }
    });

    document.addEventListener('pointermove', (event) => {
        panzoom.handleMove(event);
        if (isMoving) {
            updatePolygon()
        }
    });

    document.addEventListener('pointerup', (event) => {
        isMoving = false;
        panzoom.handleUp(event);
        updatePolygon();
    });

    window.addEventListener('resize', debounce(handleWindowResize, 0));

    rectangle.querySelectorAll('.handle').forEach((handle) => {
        handle.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
            event.preventDefault();
            startResize(event, handle.classList[1]);
        });
    });

    function startResize(event, corner) {
        isResizing = true;
        isMoving = true;
        activeCorner = corner;
        startX = event.clientX;
        startY = event.clientY;
        startWidth = rectangle.offsetWidth;
        startHeight = rectangle.offsetHeight;
        startLeft = panzoom.getPan().x;
        startTop = panzoom.getPan().y;

        document.addEventListener('pointermove', resizeRectangle);
        document.addEventListener('pointerup', stopResize);
    }

    function resizeRectangle(event) {
        if (!isResizing) return;

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        switch (activeCorner) {
            case 'top-left':
                newWidth = startWidth - dx;
                newHeight = startHeight - dy;
                newLeft = startLeft + dx;
                newTop = startTop + dy;
                if (newTop < 0) { newHeight = startHeight + startTop; newTop = 0; }
                if (newLeft < 0) { newWidth = startWidth + startLeft; newLeft = 0; }
                break;
            case 'top-right':
                newWidth = startWidth + dx;
                newHeight = startHeight - dy;
                newTop = startTop + dy;
                if (newTop < 0) { newHeight = startHeight + startTop; newTop = 0; }
                if (newLeft + newWidth > maxWidth) newWidth = maxWidth - newLeft;
                break;
            case 'bottom-left':
                newWidth = startWidth - dx;
                newHeight = startHeight + dy;
                newLeft = startLeft + dx;
                if (newLeft < 0) { newWidth = startWidth + startLeft; newLeft = 0; }
                if (newTop + newHeight > maxHeight) newHeight = maxHeight - newTop;
                break;
            case 'bottom-right':
                newWidth = startWidth + dx;
                newHeight = startHeight + dy;
                if (newLeft + newWidth > maxWidth) newWidth = maxWidth - newLeft;
                if (newTop + newHeight > maxHeight) newHeight = maxHeight - newTop;
                break;
        }

        // Enforce minimum size
        if (newWidth < config.rectangle.minSize) {
            newWidth = config.rectangle.minSize;
            if (activeCorner === 'top-left' || activeCorner === 'bottom-left') {
                newLeft = startLeft + (startWidth - config.rectangle.minSize);
            }
        }
        if (newHeight < config.rectangle.minSize) {
            newHeight = config.rectangle.minSize;
            if (activeCorner === 'top-left' || activeCorner === 'top-right') {
                newTop = startTop + (startHeight - config.rectangle.minSize);
            }
        }

        // Apply new dimensions and position
        rectangle.style.width = `${newWidth}px`;
        rectangle.style.height = `${newHeight}px`;
        panzoom.pan(newLeft, newTop);

        updatePolygon();
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        isMoving = false;
        document.removeEventListener('pointermove', resizeRectangle);
        document.removeEventListener('pointerup', stopResize);
    }

    function handleWindowResize() {
        const oldMaxWidth = maxWidth;
        const oldMaxHeight = maxHeight;
        const newContainerRect = container.getBoundingClientRect();
        const newMaxWidth = newContainerRect.width;
        const newMaxHeight = newContainerRect.height;

        // Update the maxWidth and maxHeight variables
        maxWidth = newMaxWidth;
        maxHeight = newMaxHeight;

        const currentWidth = rectangle.offsetWidth;
        const currentHeight = rectangle.offsetHeight;
        const currentPan = panzoom.getPan();

        const relativeLeft = currentPan.x / oldMaxWidth;
        const relativeTop = currentPan.y / oldMaxHeight;
        const relativeWidth = currentWidth / oldMaxWidth;
        const relativeHeight = currentHeight / oldMaxHeight;

        let newWidth = relativeWidth * newMaxWidth;
        let newHeight = relativeHeight * newMaxHeight;
        let newLeft = relativeLeft * newMaxWidth;
        let newTop = relativeTop * newMaxHeight;

        newWidth = Math.max(config.rectangle.minSize, Math.min(newWidth, newMaxWidth));
        newHeight = Math.max(config.rectangle.minSize, Math.min(newHeight, newMaxHeight));
        newLeft = Math.max(0, Math.min(newLeft, newMaxWidth - newWidth));
        newTop = Math.max(0, Math.min(newTop, newMaxHeight - newHeight));

        rectangle.style.width = `${newWidth}px`;
        rectangle.style.height = `${newHeight}px`;
        panzoom.pan(newLeft, newTop);
        updatePolygon();
    }
}

// Sync pan position
function syncPanPosition(panzoom, photoType) {
    if (photoType === config.photo.types.normal) return;
    const { x, y } = panzoom.getPan();
    if (panzoomBasePhoto) panzoomBasePhoto.panzoom.pan(x, y);
    if (panzoomOverlayPhoto) panzoomOverlayPhoto.panzoom.pan(x, y);
}

// Update polygon clipping
function updatePolygon() {
    const container = document.getElementById("rectangleContainer");
    const rectangle = document.getElementById("rectangle");
    if (!container || !rectangle || !panzoomBasePhoto) return;

    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width;
    const maxHeight = containerRect.height;
    const recWidth = rectangle.offsetWidth;
    const recHeight = rectangle.offsetHeight;
    const pan = panzoomRectangle.getPan();

    const polygon = {
        topLeftX: (pan.x / maxWidth) * 100,
        topLeftY: (pan.y / maxHeight) * 100,
        topRightX: ((pan.x + recWidth) / maxWidth) * 100,
        topRightY: (pan.y / maxHeight) * 100,
        bottomRightX: ((pan.x + recWidth) / maxWidth) * 100,
        bottomRightY: ((pan.y + recHeight) / maxHeight) * 100,
        bottomLeftX: (pan.x / maxWidth) * 100,
        bottomLeftY: ((pan.y + recHeight) / maxHeight) * 100,
    };

    const css = `polygon(0% 0%, 0% 100%, 
                        ${polygon.topLeftX}% 100%, ${polygon.topLeftX}% ${polygon.topLeftY}%, 
                        ${polygon.topRightX}% ${polygon.topRightY}%, ${polygon.bottomRightX}% ${polygon.bottomRightY}%, 
                        ${polygon.bottomLeftX}% ${polygon.bottomLeftY}%, ${polygon.topLeftX}% 100%, 
                        100% 100%, 100% 0%)`;

    const basePanZoomPhotoContainer = document.getElementById(`panzoomContainer-${panzoomBasePhoto.id}`);
    if (basePanZoomPhotoContainer) {
        basePanZoomPhotoContainer.style.clipPath = css;
        basePanZoomPhotoContainer.style.webkitClipPath = css;
    }
}


// Reset panzoom state
function resetPanzoom() {
    if (panzoomNormalPhoto) {
        hasTriggeredOriginalPhoto = false;
        panzoomNormalPhoto.panzoom.reset();

        const rangeInput = document.getElementById("panzoomInputRange");
        if (rangeInput) {
            rangeInput.value = config.panzoom.startScale;
        }
    }
}

// Set hasTriggeredOriginalPhoto
function setHasTriggeredOriginalPhoto(value) {
    hasTriggeredOriginalPhoto = value;
}