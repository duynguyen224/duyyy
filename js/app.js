// =====================
// = Show page loading =
// =====================
function showPageLoading(shouldShow) {
    const $loading = $('#ps-overlay');

    if (shouldShow) {
        $loading.show();
    } else {
        $loading.hide();
    }
}

// ==============
// = Show toast = 
// ==============
function showToast(type, message) {
    let toastClass = '';

    switch (type) {
        case 'success':
            toastClass = 'ps-toast-success';
            break;
        case 'info':
            toastClass = 'ps-toast-info';
            break;
        case 'warning':
            toastClass = 'ps-toast-warning';
            break;
        case 'danger':
            toastClass = 'ps-toast-danger';
            break;
        default:
            toastClass = 'ps-toast-info';
            break;
    }

    const toastHTML = `
      <div class="toast ps-toast ${toastClass} align-items-center text-white border-0 w-100" role="alert" aria-live="assertive" aria-atomic="true" data-delay="3000">
        <div class="d-flex align-items-center p-2">
            <div class="ps-toast-icon"></div>
            <div class="toast-body">
                <p class="ps-text-md m-0">${message}</p>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close" style="opacity: 100; margin-left: auto;"></button>
        </div>
      </div>`;

    // Remove any existing toast before adding a new one
    $("#toastContainer .toast").remove();

    const newToast = $(toastHTML);

    $("#toastContainer").append(newToast);

    newToast.toast("show");

    newToast.on("hidden.bs.toast", function () {
        $(this).remove();
    });
}

// ==========================================
// = Disable button when form is processing =
// ==========================================
function disableButtonWhileProcessing(btnId, shouldDisable) {
    const $button = $(btnId);
    const $spinner = $button.find('.spinner-border');

    if (shouldDisable) {
        $button.attr('disabled', true);
        $spinner.removeClass('d-none');
    } else {
        $button.attr('disabled', false);
        $spinner.addClass('d-none');
    }
}

// ==========================================
// = Close popup ============================
// ==========================================
function closePopup(popupId) {
    $(popupId).removeClass("show");
}

// ==========================================
// = Init video js ==========================
// ==========================================
function initVideo(videoId) {
    var player = videojs(videoId);

    player.on('error', function () {
        var error = player.error();
        console.error("Video.js error:", error);
    });
}

// ==========================================
// = Dispose video js =======================
// ==========================================
function disposeVideo(videoId) {
    const $elem = $(`#${videoId}`);

    if ($elem.length) {
        const player = videojs(videoId);
        if (player.currentSources().length) {
            player.dispose();
        }
    }
}

// ==========================================
// = Setup simplebar ================
// ==========================================
window.setupSimplebar = (elemId) => {
    new SimpleBar($(elemId)[0], {
        scrollbarMinSize: 100
    });
};

// ==========================================
// = Scroll to position =====================
// ==========================================
function scrollToTop(scrollContainerId) {
    const $scrollContainer = $(scrollContainerId);

    if (!$scrollContainer) {
        return;
    }

    // Get SimpleBar instance
    const simplebar = SimpleBar.instances.get(document.querySelector(scrollContainerId));
    if (!simplebar) {
        return;
    }

    const scrollElement = simplebar.getScrollElement();

    scrollElement.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function scrollToSelectedPhoto(scrollContainerId, selectedPhotoId) {
    const $scrollContainer = $(scrollContainerId);
    const $photo = $(selectedPhotoId);

    if (!$scrollContainer || !$photo || !$photo.offset()) {
        return;
    }

    // Get SimpleBar instance
    const simplebar = SimpleBar.instances.get(document.querySelector(scrollContainerId));
    if (!simplebar) {
        return;
    }

    const scrollElement = simplebar.getScrollElement();

    // Calculate position relative to container's content
    const containerOffset = $scrollContainer.offset().top;
    const photoOffset = $photo.offset().top;
    const currentScroll = scrollElement.scrollTop;

    // Calculate the exact position to scroll to
    const scrollPosition = currentScroll + (photoOffset - containerOffset);

    // Smoothly scroll to the position
    scrollElement.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
    });
}

// ==========================================
// = Observer - Infinite scrolling ==========
// ==========================================
window.Observer = {
    observer: null,
    Initialize: function (component, observerTargetId) {
        this.observer = new IntersectionObserver(
            (entries) => {
                // Only trigger when the target is sufficiently visible
                if (entries[0].isIntersecting) {
                    component.invokeMethodAsync('OnIntersection');
                }
            },
            {
                threshold: 0.5 // Trigger only when 50% of the target is visible
            }
        );

        let element = document.getElementById(observerTargetId);
        if (element == null) return;

        this.observer.observe(element);
    }
};

// ==========================================
// = Extract a thumbnail from video url =====
// ==========================================
window.extractThumbnail = async function (videoUrl) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.src = videoUrl;
        video.crossOrigin = "anonymous";
        video.style.display = "none";

        video.addEventListener("loadeddata", function () {
            video.currentTime = 1; // Seek to 1 second
        });

        video.addEventListener("seeked", function () {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const base64 = canvas.toDataURL("image/png"); // Convert to Base64

            video.remove(); // Cleanup

            resolve(base64); // Return Base64 string
        });

        video.addEventListener("error", function () {
            showToast("danger", "Video loading error");
        });

        document.body.appendChild(video);
    });
};

// ==========================================
// = Download image =========================
// ==========================================
window.downloadImage = async (url, filename, isBase64Source) => {
    if (isBase64Source) {
        // Handle base64 sources
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (!isBase64Source) {
        try {
            // Fetch the image with proper headers
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'image/*,*/*',
                },
                mode: 'cors'
            });

            if (response.ok) {
                // Get the original blob
                const originalBlob = await response.blob();

                // Check the original content type
                const originalContentType = response.headers.get('content-type');

                // Determine the correct MIME type
                let mimeType = originalContentType;
                if (!mimeType || mimeType === 'application/octet-stream' || !mimeType.startsWith('image/')) {
                    // Try to determine MIME type from file extension
                    const extension = filename.toLowerCase().split('.').pop();
                    switch (extension) {
                        case 'jpg':
                        case 'jpeg':
                            mimeType = 'image/jpeg';
                            break;
                        case 'png':
                            mimeType = 'image/png';
                            break;
                        case 'gif':
                            mimeType = 'image/gif';
                            break;
                        case 'webp':
                            mimeType = 'image/webp';
                            break;
                        case 'svg':
                            mimeType = 'image/svg+xml';
                            break;
                        default:
                            mimeType = 'image/jpeg'; // Default fallback
                    }
                }

                // Create a new blob with the correct MIME type
                // This effectively "removes" the Content-Disposition: attachment behavior
                const correctedBlob = new Blob([originalBlob], { type: mimeType });

                // Create download link
                const link = document.createElement('a');
                link.href = URL.createObjectURL(correctedBlob);
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);

                return;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.warn('Fetch method failed :', error);
        }
    }
};

// ==========================================
// = Request full screen ====================
// ==========================================
window.requestFullScreen = () => {
    const doc = document;
    const elem = doc.documentElement;

    const isFullScreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;

    if (!isFullScreen) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen(); // Safari
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen(); // IE11
        }
    } else {
        if (doc.exitFullscreen) {
            doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen(); // Safari
        } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen(); // IE11
        }
    }
};

window.imageLoader = {
    loadImageAsBlobUrl: async function (url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error('Image loading failed', e);
            return null;
        }
    }
};