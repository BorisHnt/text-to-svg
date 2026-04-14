import { createNavigation } from "./js/navigation.js";
import { createSvgToDxfApp } from "./js/svg-to-dxf-ui.js";
import { createApp } from "./js/ui.js";

createApp();
createSvgToDxfApp();
createNavigation();

document.body.dataset.appReady = "true";
