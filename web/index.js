// @ts-check

// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { api } from "../../scripts/api.js";
import { MobileFormUI } from "./ui.js";
import { migrateLocalStorageToWorkflow, getSettingsDebugInfo } from "./widget.js";

const log = console.log.bind(console, "[MobileForm]");
const error = console.error.bind(console, "[MobileForm]");

const BASE_PATH = import.meta.url.replace(/\/[^/]*$/, "");

// Check for mobile hash or auto-detect mobile device
const HASH_MOBILE = document.location.hash.startsWith("#mobile");
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const IS_NARROW = window.innerWidth < 768;
const ENABLE_BY_DEFAULT = HASH_MOBILE || ((IS_MOBILE || IS_NARROW) && getSetting('autoShowOnMobile', true));

/** @type {MobileFormUI} */
let ui;

/** @type {HTMLButtonElement | null} */
let sidebarButton = null;

/**
 * Get a setting from localStorage
 * @param {string} key 
 * @param {any} defaultValue 
 * @returns {any}
 */
function getSetting(key, defaultValue) {
    try {
        const stored = localStorage.getItem(`MobileForm.${key}`);
        if(stored !== null) {
            return JSON.parse(stored);
        }
    } catch(e) {}
    return defaultValue;
}

/**
 * Save a setting to localStorage
 * @param {string} key 
 * @param {any} value 
 */
function setSetting(key, value) {
    try {
        localStorage.setItem(`MobileForm.${key}`, JSON.stringify(value));
    } catch(e) {}
}

/**
 * Create the sidebar toggle button
 * @returns {HTMLButtonElement}
 */
function createSidebarButton() {
    const button = document.createElement('button');
    button.classList.add(..."comfy-mobile-form-sidebar-toggle p-button p-component p-button-icon-only p-button-text side-bar-button p-button-secondary".split(' '));
    button.title = 'Toggle Form View';

    const button_icon = document.createElement('span');
    button_icon.classList.add("side-bar-button-icon", "mf-icon");
    button_icon.textContent = '📋';

    const button_label = document.createElement('span');
    button_label.classList.add("p-button-label");
    button.replaceChildren(button_icon, button_label);

    return button;
}

/**
 * Create menu button for new-style ComfyUI menu
 * @returns {Promise<HTMLElement | null>}
 */
async function createMenuButton() {
    try {
        const { ComfyButton } = await import("../../scripts/ui/components/button.js");
        const { ComfyButtonGroup } = await import("../../scripts/ui/components/buttonGroup.js");
        
        const formButton = new ComfyButton({
            icon: "pi pi-list",
            action: () => {
                ui.toggleVisible();
                updateButtonState();
            },
            tooltip: "Toggle Form View",
            content: "Form",
            classList: "comfyui-button comfyui-menu-mobile-collapse"
        });
        
        const settingsButton = new ComfyButton({
            icon: "pi pi-angle-down",
            action: () => {
                showSettings();
            },
            tooltip: "Form View Settings",
            content: "▼"
        });
        
        const buttonGroup = new ComfyButtonGroup(
            formButton.element,
            settingsButton.element
        );
        
        return buttonGroup.element;
    } catch(e) {
        log("Could not create new-style menu button:", e);
        return null;
    }
}

/**
 * Update button active state
 */
function updateButtonState() {
    if(sidebarButton) {
        sidebarButton.classList.toggle('active', ui.visible);
    }
}

/**
 * Show settings dialog
 */
function showSettings() {
    // Create simple settings dialog
    const dialog = document.createElement('div');
    dialog.classList.add('comfy-mobile-form-settings-dialog');
    dialog.innerHTML = `
        <div class="comfy-mobile-form-settings-content">
            <h3>Form View Settings</h3>
            <label class="setting-row">
                <input type="checkbox" id="mf-auto-show" ${getSetting('autoShowOnMobile', true) ? 'checked' : ''}>
                <span>Auto-show on mobile devices</span>
            </label>
            <label class="setting-row">
                <input type="checkbox" id="mf-panel-mode" ${getSetting('panelMode', false) ? 'checked' : ''}>
                <span>Side panel mode (desktop)</span>
            </label>
            <div class="settings-actions">
                <button class="close-settings">Close</button>
            </div>
        </div>
    `;
    
    dialog.querySelector('#mf-auto-show')?.addEventListener('change', (e) => {
        setSetting('autoShowOnMobile', /** @type {HTMLInputElement} */ (e.target).checked);
    });
    
    dialog.querySelector('#mf-panel-mode')?.addEventListener('change', (e) => {
        const panelMode = /** @type {HTMLInputElement} */ (e.target).checked;
        setSetting('panelMode', panelMode);
        // Update UI mode
        document.querySelector('.comfy-mobile-form')?.classList.toggle('panel-mode', panelMode);
    });
    
    dialog.querySelector('.close-settings')?.addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.addEventListener('click', (e) => {
        if(e.target === dialog) dialog.remove();
    });
    
    document.body.appendChild(dialog);
}

/**
 * Hide canvas textareas when form is visible
 */
function updateCanvasTextareas() {
    for(const textarea of document.querySelectorAll(".graph-canvas-container>.comfy-multiline-input")) {
        if(ui.visible) textarea.classList.add("comfy-mobile-form-hidden");
        else textarea.classList.remove("comfy-mobile-form-hidden");
    }
}

app.registerExtension({
    name: "MobileForm",
    
    async init(app) {
        log("Initializing...");

        // Load stylesheet
        const style_elem = document.createElement('link');
        style_elem.rel = "stylesheet";
        style_elem.href = `${BASE_PATH}/style.css`;
        document.head.appendChild(style_elem);

        // Create UI root
        const ui_root_elem = document.createElement('div');
        ui = new MobileFormUI(app, ui_root_elem);
        
        // Apply panel mode setting
        if(getSetting('panelMode', false)) {
            ui_root_elem.classList.add('panel-mode');
        }

        const graph_canvas_container = document.querySelector(".graph-canvas-container");
        if(!graph_canvas_container) {
            error("Couldn't find a place to add main MobileForm UI!");
            return;
        }

        graph_canvas_container.appendChild(ui_root_elem);
    },
    
    /**
     * Customize the MobileFormSettings node to hide the settings widget
     * and make it look clean
     */
    async nodeCreated(node) {
        if (node.comfyClass === "MobileFormSettings") {
            // Hide the settings_json widget - it's managed by the form UI
            if (node.widgets) {
                for (const w of node.widgets) {
                    if (w.name === "settings_json") {
                        w.type = "hidden";
                        // Override serialization to ensure it's included
                        w.serializeValue = () => {
                            return w.value || "{}";
                        };
                    }
                }
            }
            
            // Make the node smaller since it has no visible widgets
            node.size = [200, 26];
            node.setSize?.(node.size);
            
            // Add a helpful title
            if (!node.title || node.title === "Mobile Form Settings") {
                node.title = "📋 Mobile Form Settings";
            }
            
            // Migrate localStorage settings to workflow if this is a new node
            setTimeout(() => {
                migrateLocalStorageToWorkflow();
                const debug = getSettingsDebugInfo();
                log("MobileFormSettings configured - localStorage:", debug.localStorage, "workflow:", debug.workflow);
            }, 100);
        }
    },
    
    async setup() {
        // Auto-show based on settings
        if(ENABLE_BY_DEFAULT) {
            ui.toggleVisible();
            updateCanvasTextareas();
        }

        // Inject sidebar button
        let try_inject_remaining_count = 10;
        const tryInjectSidebar = () => {
            const toolbar_end = /** @type {HTMLDivElement|null} */ (document.querySelector("div.side-tool-bar-end"));
            if(toolbar_end) {
                sidebarButton = createSidebarButton();
                sidebarButton.addEventListener('click', () => {
                    ui.toggleVisible();
                    updateCanvasTextareas();
                    updateButtonState();
                });

                toolbar_end.insertBefore(sidebarButton, toolbar_end.firstChild);
                updateButtonState();
                log("Sidebar button injected");
                return;
            }

            if(--try_inject_remaining_count === 0) {
                log("Could not find sidebar, skipping sidebar button");
                return;
            }

            setTimeout(tryInjectSidebar, 500);
        };

        setTimeout(tryInjectSidebar, 300);
        
        // Try to inject menu button (new-style menu)
        const tryInjectMenu = async () => {
            try {
                const menuButton = await createMenuButton();
                if(menuButton) {
                    // Try to find the settings group in new menu
                    if(app.menu?.settingsGroup?.element) {
                        app.menu.settingsGroup.element.before(menuButton);
                        log("Menu button injected");
                    }
                }
            } catch(e) {
                log("Could not inject menu button (may be using legacy menu)");
            }
        };
        
        setTimeout(tryInjectMenu, 500);
        
        // Also inject into old-style menu if it exists
        const tryInjectOldMenu = () => {
            const menu = document.querySelector(".comfy-menu");
            if(menu) {
                const separator = document.createElement("hr");
                separator.style.margin = "10px 0";
                separator.style.width = "100%";
                
                const formButton = document.createElement("button");
                formButton.textContent = "Form View";
                formButton.title = "Toggle Form View";
                formButton.onclick = () => {
                    ui.toggleVisible();
                    updateCanvasTextareas();
                    updateButtonState();
                };
                
                // Find a good place to insert
                const shareButton = menu.querySelector("#shareButton");
                if(shareButton) {
                    shareButton.before(separator, formButton);
                } else {
                    menu.appendChild(separator);
                    menu.appendChild(formButton);
                }
                log("Old-style menu button injected");
            }
        };
        
        setTimeout(tryInjectOldMenu, 600);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const wasNarrow = IS_NARROW;
            const isNowNarrow = window.innerWidth < 768;
            
            if(!wasNarrow && isNowNarrow && getSetting('autoShowOnMobile', true)) {
                // Window became narrow, could auto-show
            }
            
            // Update mode
            ui.setMode(isNowNarrow ? 'mobile' : 'desktop');
        });
    },
    
    async afterConfigureGraph(_, app) {
        ui?.setGraph(app.graph);
        
        // Log settings state after workflow load
        setTimeout(() => {
            const debug = getSettingsDebugInfo();
            if (debug.hasNode) {
                log("Workflow loaded with MobileFormSettings node - workflow settings:", debug.workflow, "localStorage backup:", debug.localStorage);
            }
        }, 200);
    },
});

// Export for external access
// @ts-ignore
window.MobileFormUI = {
    show: () => ui?.show(),
    hide: () => ui?.hide(),
    toggle: () => {
        ui?.toggleVisible();
        updateCanvasTextareas();
        updateButtonState();
    },
    isVisible: () => ui?.visible
};
