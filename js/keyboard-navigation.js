let dotnetTimelinePhotoHelper;
let keyboardEventListener;

function initKeyboardNavigation(dotNetObj) {
    if (!dotNetObj) return;

    dotnetTimelinePhotoHelper = dotNetObj;

    keyboardEventListener = function (event) {
        switch (event.key) {
            case "ArrowUp":
                dotnetTimelinePhotoHelper.invokeMethodAsync("OnClickPrevious");
                break;
            case "ArrowDown":
                dotnetTimelinePhotoHelper.invokeMethodAsync("OnClickNext");
                break;
            case "ArrowLeft":
                dotnetTimelinePhotoHelper.invokeMethodAsync("OnClickPrevious");
                break;
            case "ArrowRight":
                dotnetTimelinePhotoHelper.invokeMethodAsync("OnClickNext");
                break;
        }
    }

    document.addEventListener("keydown", keyboardEventListener);
}

function destroyKeyboardNavigation() {
    if (keyboardEventListener) {
        document.removeEventListener("keydown", keyboardEventListener);
        keyboardEventListener = null;
        dotnetTimelinePhotoHelper = null;
    }
}