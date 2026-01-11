// @ts-check

/** @import {ComfyUIGraphNode, ComfyUIGraphWidget} from "./types" */

// Import extension system
import { ExtensionRegistry, initializeExtensions } from './extensions/index.js';

// Initialize extensions when module loads
initializeExtensions();

/**
 * @typedef {Object} WidgetSettings
 * @property {string} [width] - Column span: "1", "2", "3", "4"
 * @property {string} [height] - "auto", "compact", "medium", "tall"
 * @property {string} [color] - "default", "blue", "green", "purple", "orange", "red"
 * @property {string} [break] - "true" to start a new row before this widget
 * @property {string} [tooltip] - Custom tooltip/hint text for this widget
 * @property {string[]} [hiddenWidgets] - Array of widget names to hide from this node
 */

/**
 * @typedef {Object.<string, WidgetSettings | number[]>} AllWidgetSettings
 */

/** @type {HTMLDivElement | null} */
let activeContextMenu = null;

/** @type {any} */
let currentGraph = null;

/**
 * Set the current graph reference for workflow-based settings
 * @param {any} graph 
 */
export function setCurrentGraph(graph) {
    currentGraph = graph;
}

/**
 * Find the MobileFormSettings node in the graph
 * @returns {ComfyUIGraphNode | null}
 */
function findSettingsNode() {
    if (!currentGraph || !currentGraph._nodes) return null;
    return currentGraph._nodes.find(n => n.type === 'MobileFormSettings') || null;
}

/**
 * Get all widget settings from the MobileFormSettings node
 * @returns {AllWidgetSettings}
 */
function getWorkflowSettings() {
    const settingsNode = findSettingsNode();
    if (!settingsNode) return {};
    
    try {
        // Try getting from the widget first (live value)
        if (settingsNode.widgets) {
            const widget = settingsNode.widgets.find(w => w.name === 'settings_json');
            if (widget && widget.value && typeof widget.value === 'string' && widget.value !== '{}') {
                return JSON.parse(widget.value);
            }
        }
        
        // Fall back to widgets_values (saved value)
        if (settingsNode.widgets_values && settingsNode.widgets_values[0]) {
            const json = settingsNode.widgets_values[0];
            if (typeof json === 'string' && json !== '{}') {
                return JSON.parse(json);
            }
        }
    } catch(e) {
        console.warn('[MobileForm] Failed to parse workflow settings:', e);
    }
    return {};
}

/**
 * Save all widget settings to the MobileFormSettings node
 * @param {AllWidgetSettings} allSettings 
 */
function saveWorkflowSettings(allSettings) {
    const settingsNode = findSettingsNode();
    if (!settingsNode) return;
    
    try {
        const json = JSON.stringify(allSettings, null, 0); // Compact JSON
        
        // Update the widget value (this is what gets serialized)
        if (settingsNode.widgets) {
            const widget = settingsNode.widgets.find(w => w.name === 'settings_json');
            if (widget) {
                widget.value = json;
            }
        }
        
        // Also update widgets_values array for direct serialization
        if (!settingsNode.widgets_values) {
            settingsNode.widgets_values = [json];
        } else {
            settingsNode.widgets_values[0] = json;
        }
        
        // Mark graph as changed so it saves
        if (currentGraph && currentGraph.change) {
            currentGraph.change();
        }
        
        // Debug log
    } catch(e) {
        console.warn('[MobileForm] Failed to save workflow settings:', e);
    }
}

/**
 * Get widget settings - tries workflow node first, then localStorage
 * @param {number} nodeId 
 * @returns {WidgetSettings}
 */
export function getWidgetSettings(nodeId) {
    const defaults = { width: "1", height: "auto", color: "default", break: "false" };
    
    // Try workflow settings first
    const workflowSettings = getWorkflowSettings();
    if (workflowSettings[nodeId]) {
        return { ...defaults, ...workflowSettings[nodeId] };
    }
    
    // Fall back to localStorage
    try {
        const stored = localStorage.getItem(`MobileForm.widgetSettings.${nodeId}`);
        if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch(e) {}
    
    return defaults;
}

/**
 * Save widget settings - saves to workflow node if present, and localStorage
 * @param {number} nodeId 
 * @param {WidgetSettings} settings 
 */
export function saveWidgetSettings(nodeId, settings) {
    // Always save to localStorage as backup
    try {
        localStorage.setItem(`MobileForm.widgetSettings.${nodeId}`, JSON.stringify(settings));
    } catch(e) {}
    
    // Save to workflow node if present
    const settingsNode = findSettingsNode();
    if (settingsNode) {
        const allSettings = getWorkflowSettings();
        allSettings[nodeId] = settings;
        saveWorkflowSettings(allSettings);
    }
}

/**
 * Check if a specific widget within a node should be hidden
 * @param {number} nodeId 
 * @param {string} widgetName 
 * @returns {boolean}
 */
export function isWidgetHidden(nodeId, widgetName) {
    const settings = getWidgetSettings(nodeId);
    return settings.hiddenWidgets?.includes(widgetName) || false;
}

/**
 * Get the saved widget order
 * @returns {number[]}
 */
export function getWidgetOrder() {
    // Try workflow settings first
    const workflowSettings = getWorkflowSettings();
    if (workflowSettings._order && Array.isArray(workflowSettings._order)) {
        return workflowSettings._order;
    }
    
    // Fall back to localStorage
    try {
        const stored = localStorage.getItem('MobileForm.widgetOrder');
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    
    return [];
}

/**
 * Save the widget order
 * @param {number[]} order - Array of node IDs in display order
 */
export function saveWidgetOrder(order) {
    // Always save to localStorage as backup
    try {
        localStorage.setItem('MobileForm.widgetOrder', JSON.stringify(order));
    } catch(e) {}
    
    // Save to workflow node if present
    const settingsNode = findSettingsNode();
    if (settingsNode) {
        const allSettings = getWorkflowSettings();
        allSettings._order = order;
        saveWorkflowSettings(allSettings);
    }
}

/**
 * Migrate localStorage settings to the workflow node
 * Called when a MobileFormSettings node is first found in the workflow
 */
export function migrateLocalStorageToWorkflow() {
    const settingsNode = findSettingsNode();
    if (!settingsNode) return;
    
    // Check if workflow already has settings
    const existingSettings = getWorkflowSettings();
    if (Object.keys(existingSettings).length > 1) {
        return;
    }
    
    // Collect all localStorage settings
    const migratedSettings = {};
    
    try {
        // Get widget order
        const orderJson = localStorage.getItem('MobileForm.widgetOrder');
        if (orderJson) {
            migratedSettings._order = JSON.parse(orderJson);
        }
        
        // Find all widget settings keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('MobileForm.widgetSettings.')) {
                const nodeId = key.replace('MobileForm.widgetSettings.', '');
                const value = localStorage.getItem(key);
                if (value) {
                    migratedSettings[nodeId] = JSON.parse(value);
                }
            }
        }
        
        if (Object.keys(migratedSettings).length > 0) {
            saveWorkflowSettings(migratedSettings);
        }
    } catch (e) {
        console.warn('[MobileForm] Failed to migrate localStorage settings:', e);
    }
}

/**
 * Get debug info about current settings state
 * @returns {{localStorage: number, workflow: number, hasNode: boolean}}
 */
export function getSettingsDebugInfo() {
    let localStorageCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('MobileForm.')) {
            localStorageCount++;
        }
    }
    
    const workflowSettings = getWorkflowSettings();
    
    return {
        localStorage: localStorageCount,
        workflow: Object.keys(workflowSettings).length,
        hasNode: !!findSettingsNode()
    };
}

/**
 * Apply widget settings to element
 * @param {HTMLElement} elem 
 * @param {WidgetSettings} settings 
 */
function applyWidgetSettings(elem, settings) {
    elem.dataset.width = settings.width || "1";
    elem.dataset.height = settings.height || "auto";
    elem.dataset.break = settings.break || "false";
    
    // If widget is in a section, always use the section color
    // Otherwise, use the saved color setting
    if (elem.dataset.inSection === "true" && elem.dataset.sectionColor) {
        elem.dataset.color = elem.dataset.sectionColor;
    } else {
        elem.dataset.color = settings.color || "default";
    }
}

/**
 * Apply tooltip to a widget element
 * Creates or updates the tooltip indicator and content
 * @param {HTMLElement} elem 
 * @param {number} nodeId 
 * @param {WidgetSettings} settings 
 */
async function applyWidgetTooltip(elem, nodeId, settings) {
    // Get or create tooltip container
    let tooltipContainer = /** @type {HTMLElement | null} */ (
        elem.querySelector('.comfy-mobile-form-tooltip-container')
    );
    
    // Get the tooltip text (custom or default)
    const customTooltip = settings.tooltip;
    const defaultTooltip = await getNodeDefaultTooltip(nodeId);
    const tooltipText = customTooltip || defaultTooltip;
    
    if (!tooltipText) {
        // Remove tooltip if no text
        tooltipContainer?.remove();
        elem.dataset.hasTooltip = 'false';
        elem.dataset.hasCustomTooltip = 'false';
        return;
    }
    
    if (!tooltipContainer) {
        tooltipContainer = document.createElement('div');
        tooltipContainer.classList.add('comfy-mobile-form-tooltip-container');
        
        // Use SVG icon for cleaner look
        const tooltipIcon = document.createElement('div');
        tooltipIcon.classList.add('comfy-mobile-form-tooltip-icon');
        tooltipIcon.setAttribute('aria-label', 'Show tooltip');
        tooltipIcon.setAttribute('role', 'button');
        tooltipIcon.setAttribute('tabindex', '0');
        tooltipContainer.appendChild(tooltipIcon);
        
        // Add tooltip content (shown on hover/click)
        const tooltipContent = document.createElement('div');
        tooltipContent.classList.add('comfy-mobile-form-tooltip-content');
        tooltipContent.setAttribute('role', 'tooltip');
        tooltipContainer.appendChild(tooltipContent);
        
        // Insert at the beginning of the widget (positioned via CSS)
        elem.insertBefore(tooltipContainer, elem.firstChild);
        
        // Touch device support - click to toggle
        let touchVisible = false;
        tooltipContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                touchVisible = !touchVisible;
                if (touchVisible) {
                    tooltipContent.style.opacity = '1';
                    tooltipContent.style.visibility = 'visible';
                    tooltipContent.style.transform = 'translateY(0)';
                    tooltipContent.style.pointerEvents = 'auto';
                } else {
                    tooltipContent.style.opacity = '';
                    tooltipContent.style.visibility = '';
                    tooltipContent.style.transform = '';
                    tooltipContent.style.pointerEvents = '';
                }
            }
        });
        
        // Keyboard support
        tooltipIcon.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                tooltipContainer?.click();
            }
        });
        
        // Close tooltip when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (touchVisible && !tooltipContainer?.contains(/** @type {Node} */ (e.target))) {
                touchVisible = false;
                tooltipContent.style.opacity = '';
                tooltipContent.style.visibility = '';
                tooltipContent.style.transform = '';
                tooltipContent.style.pointerEvents = '';
            }
        });
    }
    
    // Update tooltip content
    const tooltipContent = tooltipContainer.querySelector('.comfy-mobile-form-tooltip-content');
    if (tooltipContent) {
        tooltipContent.textContent = tooltipText;
    }
    
    // Update icon based on whether it's custom
    const tooltipIcon = tooltipContainer.querySelector('.comfy-mobile-form-tooltip-icon');
    if (tooltipIcon) {
        // Use simple text characters that render well
        tooltipIcon.textContent = customTooltip ? '💡' : 'ℹ';
    }
    
    // Mark as having custom tooltip
    elem.dataset.hasTooltip = 'true';
    elem.dataset.hasCustomTooltip = customTooltip ? 'true' : 'false';
}

/**
 * Move a widget in the order
 * @param {HTMLElement} widgetElem - The widget element to move
 * @param {number} nodeId - The node ID of the widget
 * @param {'top' | 'up' | 'down' | 'bottom'} action - The move action
 */
function moveWidget(widgetElem, nodeId, action) {
    const container = widgetElem.parentElement;
    if (!container) return;
    
    // Get all widgets in current DOM order
    const widgets = Array.from(container.querySelectorAll('.comfy-mobile-form-widget'));
    const currentIndex = widgets.indexOf(widgetElem);
    
    if (currentIndex === -1) return;
    
    let newIndex;
    switch (action) {
        case 'top':
            newIndex = 0;
            break;
        case 'up':
            newIndex = Math.max(0, currentIndex - 1);
            break;
        case 'down':
            newIndex = Math.min(widgets.length - 1, currentIndex + 1);
            break;
        case 'bottom':
            newIndex = widgets.length - 1;
            break;
        default:
            return;
    }
    
    // Don't do anything if position doesn't change
    if (newIndex === currentIndex) return;
    
    // Move the element in the DOM
    if (newIndex === 0) {
        container.insertBefore(widgetElem, widgets[0]);
    } else if (newIndex >= widgets.length - 1) {
        container.appendChild(widgetElem);
    } else if (newIndex < currentIndex) {
        container.insertBefore(widgetElem, widgets[newIndex]);
    } else {
        // Moving down - insert after the target
        const targetWidget = widgets[newIndex];
        if (targetWidget.nextSibling) {
            container.insertBefore(widgetElem, targetWidget.nextSibling);
        } else {
            container.appendChild(widgetElem);
        }
    }
    
    // Update and save the new order
    const newOrder = Array.from(container.querySelectorAll('.comfy-mobile-form-widget'))
        .map(w => parseInt(/** @type {HTMLElement} */(w).dataset.nodeId || '0', 10))
        .filter(id => id > 0);
    
    saveWidgetOrder(newOrder);
}

/**
 * Close any open context menu
 */
function closeContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
    }
}

/**
 * Toggle bypass state on a node
 * @param {number} nodeId 
 * @param {HTMLElement} widgetElem
 * @returns {Promise<boolean>} - New bypass state
 */
async function toggleNodeBypass(nodeId, widgetElem) {
    // @ts-ignore
    const { app } = await import("../../scripts/app.js");
    const node = app.graph.getNodeById(nodeId);
    
    if (!node) return false;
    
    // mode = 0 is active, mode = 4 is bypassed
    const isBypassed = node.mode === 4;
    node.mode = isBypassed ? 0 : 4;
    
    // Update widget appearance
    if (node.mode === 4) {
        widgetElem.classList.add('bypassed');
    } else {
        widgetElem.classList.remove('bypassed');
    }
    
    // Trigger graph change to update the canvas
    app.graph.setDirtyCanvas(true, true);
    
    return node.mode === 4;
}

/**
 * Check if a node is bypassed
 * @param {number} nodeId 
 * @returns {Promise<boolean>}
 */
async function isNodeBypassed(nodeId) {
    // @ts-ignore
    const { app } = await import("../../scripts/app.js");
    const node = app.graph.getNodeById(nodeId);
    return node?.mode === 4;
}

/**
 * Get the default tooltip/description for a node
 * @param {number} nodeId 
 * @returns {Promise<string>}
 */
async function getNodeDefaultTooltip(nodeId) {
    // @ts-ignore
    const { app } = await import("../../scripts/app.js");
    const node = app.graph.getNodeById(nodeId);
    
    if (!node) return '';
    
    // Try to get node description from various sources
    const nodeType = node.type;
    const nodeTitle = node.title || nodeType;
    
    // Try to get description from node definition
    // @ts-ignore
    const nodeDefs = app.registerNodesFromDefs?.nodeDefs || LiteGraph?.registered_node_types?.[nodeType];
    if (nodeDefs?.description) {
        return stripHtml(nodeDefs.description);
    }
    
    // Try to get from ComfyUI node info
    try {
        // @ts-ignore
        const objectInfo = await app.api?.getNodeDefs?.();
        if (objectInfo?.[nodeType]?.description) {
            return stripHtml(objectInfo[nodeType].description);
        }
    } catch (e) {
        // Ignore
    }
    
    // Default: use node title/type
    return `${nodeTitle} (${nodeType})`;
}

/**
 * Escape HTML special characters to prevent XSS and rendering issues
 * @param {string} text 
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Strip HTML tags from text, returning plain text
 * @param {string} html 
 * @returns {string}
 */
function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Show tooltip edit dialog
 * @param {number} nodeId 
 * @param {string} currentTooltip 
 * @param {(newTooltip: string) => void} onSave 
 */
async function showTooltipEditDialog(nodeId, currentTooltip, onSave) {
    const defaultTooltip = await getNodeDefaultTooltip(nodeId);
    const escapedDefault = escapeHtml(defaultTooltip);
    const escapedCurrent = escapeHtml(currentTooltip || '');
    
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.classList.add('comfy-mobile-form-dialog-overlay');
    
    const dialog = document.createElement('div');
    dialog.classList.add('comfy-mobile-form-dialog');
    dialog.innerHTML = `
        <div class="comfy-mobile-form-dialog-header">
            <h3>Edit Tooltip</h3>
            <button class="comfy-mobile-form-dialog-close" aria-label="Close dialog">✕</button>
        </div>
        <div class="comfy-mobile-form-dialog-body">
            <label class="comfy-mobile-form-dialog-label">
                Custom tooltip/hint for this widget:
            </label>
            <textarea class="comfy-mobile-form-dialog-textarea" rows="3" placeholder="${escapedDefault}">${escapedCurrent}</textarea>
            <div class="comfy-mobile-form-dialog-hint">
                Leave empty to use the default: "${escapedDefault}"
            </div>
        </div>
        <div class="comfy-mobile-form-dialog-footer">
            <button class="comfy-mobile-form-dialog-btn secondary" data-action="reset">Reset to Default</button>
            <button class="comfy-mobile-form-dialog-btn secondary" data-action="cancel">Cancel</button>
            <button class="comfy-mobile-form-dialog-btn primary" data-action="save">Save</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    const textarea = /** @type {HTMLTextAreaElement} */ (dialog.querySelector('textarea'));
    textarea.focus();
    textarea.select();
    
    // Close handlers
    const close = () => overlay.remove();
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    
    dialog.querySelector('.comfy-mobile-form-dialog-close')?.addEventListener('click', close);
    
    dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
    
    dialog.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
        textarea.value = '';
        onSave('');
        close();
    });
    
    dialog.querySelector('[data-action="save"]')?.addEventListener('click', () => {
        onSave(textarea.value.trim());
        close();
    });
    
    // Save on Enter (Ctrl/Cmd+Enter for multiline)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            onSave(textarea.value.trim());
            close();
        } else if (e.key === 'Escape') {
            close();
        }
    });
}

/**
 * Show a confirmation dialog
 * @param {Object} options 
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Confirmation message
 * @param {string} [options.confirmText='Confirm'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {'danger' | 'warning' | 'info'} [options.type='warning'] - Dialog type for styling
 * @param {string} [options.icon] - Optional icon emoji
 * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
 */
export function showConfirmDialog(options) {
    return new Promise((resolve) => {
        const { 
            title, 
            message, 
            confirmText = 'Confirm', 
            cancelText = 'Cancel',
            type = 'warning',
            icon = type === 'danger' ? '⚠️' : type === 'warning' ? '❓' : 'ℹ️'
        } = options;
        
        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.classList.add('comfy-mobile-form-dialog-overlay');
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'confirm-dialog-title');
        
        const typeClass = `comfy-mobile-form-confirm-${type}`;
        
        const dialog = document.createElement('div');
        dialog.classList.add('comfy-mobile-form-dialog', 'comfy-mobile-form-confirm-dialog', typeClass);
        dialog.innerHTML = `
            <div class="comfy-mobile-form-dialog-header">
                <h3 id="confirm-dialog-title">${icon} ${escapeHtml(title)}</h3>
                <button class="comfy-mobile-form-dialog-close" aria-label="Close dialog">✕</button>
            </div>
            <div class="comfy-mobile-form-dialog-body">
                <p class="comfy-mobile-form-confirm-message">${escapeHtml(message)}</p>
            </div>
            <div class="comfy-mobile-form-dialog-footer">
                <button class="comfy-mobile-form-dialog-btn secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
                <button class="comfy-mobile-form-dialog-btn ${type === 'danger' ? 'danger' : 'primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Focus trap setup - get focusable elements
        const focusableElements = dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = /** @type {HTMLElement} */ (focusableElements[0]);
        const lastFocusable = /** @type {HTMLElement} */ (focusableElements[focusableElements.length - 1]);
        
        // Store the element that was focused before opening
        const previouslyFocused = /** @type {HTMLElement | null} */ (document.activeElement);
        
        // Close handlers with focus restoration
        const closeWithFocus = (confirmed) => {
            overlay.remove();
            previouslyFocused?.focus();
            resolve(confirmed);
        };
        
        // Keyboard support with focus trap
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeWithFocus(false);
            } else if (e.key === 'Enter' && e.target === dialog.querySelector('[data-action="confirm"]')) {
                closeWithFocus(true);
            } else if (e.key === 'Tab') {
                // Focus trap
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable?.focus();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable?.focus();
                    }
                }
            }
        });
        
        // Update close handlers to use focus restoration
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeWithFocus(false);
        });
        
        dialog.querySelector('.comfy-mobile-form-dialog-close')?.addEventListener('click', () => closeWithFocus(false));
        dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => closeWithFocus(false));
        dialog.querySelector('[data-action="confirm"]')?.addEventListener('click', () => closeWithFocus(true));
        
        // Focus the cancel button by default (safer choice)
        const cancelBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-action="cancel"]'));
        cancelBtn?.focus();
    });
}

/**
 * Show context menu for widget settings
 * @param {HTMLElement} widgetElem 
 * @param {number} nodeId 
 * @param {number} x 
 * @param {number} y 
 */
async function showContextMenu(widgetElem, nodeId, x, y) {
    closeContextMenu();
    
    const settings = getWidgetSettings(nodeId);
    const bypassed = await isNodeBypassed(nodeId);
    
    const menu = document.createElement('div');
    menu.classList.add('comfy-mobile-form-context-menu');
    
    // Bypass toggle section
    const bypassSection = document.createElement('div');
    bypassSection.classList.add('comfy-mobile-form-context-menu-section');
    
    const bypassItem = document.createElement('div');
    bypassItem.classList.add('comfy-mobile-form-context-menu-item');
    if (bypassed) bypassItem.classList.add('active');
    bypassItem.innerHTML = `<span class="check-icon">${bypassed ? '✓' : ''}</span>Bypass Node`;
    bypassItem.title = 'Skip this node during execution. The node will be greyed out and its inputs disabled.';
    bypassItem.addEventListener('click', async () => {
        await toggleNodeBypass(nodeId, widgetElem);
        closeContextMenu();
    });
    bypassSection.appendChild(bypassItem);
    menu.appendChild(bypassSection);
    
    // Row break toggle section
    const breakSection = document.createElement('div');
    breakSection.classList.add('comfy-mobile-form-context-menu-section');
    
    const breakItem = document.createElement('div');
    breakItem.classList.add('comfy-mobile-form-context-menu-item');
    if (settings.break === "true") breakItem.classList.add('active');
    breakItem.innerHTML = `<span class="check-icon">${settings.break === "true" ? '✓' : ''}</span>New Row Before`;
    breakItem.title = 'Force this widget to start on a new row, even if there\'s room in the previous row.';
    breakItem.addEventListener('click', () => {
        settings.break = settings.break === "true" ? "false" : "true";
        saveWidgetSettings(nodeId, settings);
        applyWidgetSettings(widgetElem, settings);
        closeContextMenu();
    });
    breakSection.appendChild(breakItem);
    menu.appendChild(breakSection);
    
    // Width section
    const widthSection = document.createElement('div');
    widthSection.classList.add('comfy-mobile-form-context-menu-section');
    widthSection.innerHTML = `<div class="comfy-mobile-form-context-menu-label">Width</div>`;
    
    /** @type {{value: string, label: string, tooltip: string}[]} */
    const widthOptions = [
        { value: "1", label: "1 Column", tooltip: "Widget takes up 1/4 of the row width" },
        { value: "2", label: "2 Columns", tooltip: "Widget takes up 2/4 (half) of the row width" },
        { value: "3", label: "3 Columns", tooltip: "Widget takes up 3/4 of the row width" },
        { value: "4", label: "Full Row", tooltip: "Widget takes up the entire row" }
    ];
    
    for (const opt of widthOptions) {
        const item = document.createElement('div');
        item.classList.add('comfy-mobile-form-context-menu-item');
        if (settings.width === opt.value) item.classList.add('active');
        item.innerHTML = `<span class="check-icon">${settings.width === opt.value ? '✓' : ''}</span>${opt.label}`;
        item.title = opt.tooltip;
        item.addEventListener('click', () => {
            settings.width = opt.value;
            saveWidgetSettings(nodeId, settings);
            applyWidgetSettings(widgetElem, settings);
            closeContextMenu();
        });
        widthSection.appendChild(item);
    }
    menu.appendChild(widthSection);
    
    // Height section
    const heightSection = document.createElement('div');
    heightSection.classList.add('comfy-mobile-form-context-menu-section');
    heightSection.innerHTML = `<div class="comfy-mobile-form-context-menu-label">Height</div>`;
    
    /** @type {{value: string, label: string, tooltip: string}[]} */
    const heightOptions = [
        { value: "auto", label: "Auto", tooltip: "Height adjusts to content automatically" },
        { value: "compact", label: "Compact", tooltip: "Fixed compact height (~80px)" },
        { value: "medium", label: "Medium", tooltip: "Fixed medium height (~150px)" },
        { value: "tall", label: "Tall", tooltip: "Fixed tall height (~250px) - ideal for text areas and image previews" }
    ];
    
    for (const opt of heightOptions) {
        const item = document.createElement('div');
        item.classList.add('comfy-mobile-form-context-menu-item');
        if (settings.height === opt.value) item.classList.add('active');
        item.innerHTML = `<span class="check-icon">${settings.height === opt.value ? '✓' : ''}</span>${opt.label}`;
        item.title = opt.tooltip;
        item.addEventListener('click', () => {
            settings.height = opt.value;
            saveWidgetSettings(nodeId, settings);
            applyWidgetSettings(widgetElem, settings);
            closeContextMenu();
        });
        heightSection.appendChild(item);
    }
    menu.appendChild(heightSection);
    
    // Color section - only show if widget is NOT in a section (section controls color)
    if (widgetElem.dataset.inSection !== "true") {
        const colorSection = document.createElement('div');
        colorSection.classList.add('comfy-mobile-form-context-menu-section');
        colorSection.innerHTML = `<div class="comfy-mobile-form-context-menu-label">Color</div>`;
        
        const colorsContainer = document.createElement('div');
        colorsContainer.classList.add('comfy-mobile-form-context-menu-colors');
        
        const colors = [
            "default", 
            "red", "orange", "amber", "yellow", "lime", 
            "green", "emerald", "teal", "cyan", "sky", 
            "blue", "indigo", "violet", "purple", "fuchsia", 
            "pink", "rose", "slate", "zinc", "white"
        ];
        for (const color of colors) {
            const swatch = document.createElement('div');
            swatch.classList.add('comfy-mobile-form-color-swatch');
            swatch.dataset.color = color;
            if (settings.color === color) swatch.classList.add('active');
            swatch.addEventListener('click', () => {
                settings.color = color;
                saveWidgetSettings(nodeId, settings);
                applyWidgetSettings(widgetElem, settings);
                closeContextMenu();
            });
            colorsContainer.appendChild(swatch);
        }
        colorSection.appendChild(colorsContainer);
        menu.appendChild(colorSection);
    }
    
    // Rename section
    const renameSection = document.createElement('div');
    renameSection.classList.add('comfy-mobile-form-context-menu-section');
    
    const renameItem = document.createElement('div');
    renameItem.classList.add('comfy-mobile-form-context-menu-item');
    renameItem.innerHTML = `<span class="check-icon">✏️</span>Rename`;
    renameItem.title = 'Rename this widget/node';
    renameItem.addEventListener('click', () => {
        closeContextMenu();
        const node = currentGraph?._nodes?.find(n => n.id === nodeId);
        if (node) {
            const currentTitle = node.title || node.type || 'Node';
            showRenameDialog(currentTitle, 'Node', (newTitle) => {
                node.title = newTitle;
                // Update the label in the widget
                const label = widgetElem.querySelector('.comfy-mobile-form-label');
                if (label) label.textContent = newTitle;
                // Trigger graph change to save
                if (currentGraph) {
                    currentGraph.setDirtyCanvas?.(true, true);
                }
            });
        }
    });
    renameSection.appendChild(renameItem);
    menu.appendChild(renameSection);
    
    // Tooltip section
    const tooltipSection = document.createElement('div');
    tooltipSection.classList.add('comfy-mobile-form-context-menu-section');
    
    const tooltipItem = document.createElement('div');
    tooltipItem.classList.add('comfy-mobile-form-context-menu-item');
    const hasCustomTooltip = settings.tooltip && settings.tooltip.length > 0;
    tooltipItem.innerHTML = `<span class="check-icon">${hasCustomTooltip ? '✓' : '✏️'}</span>Edit Tooltip${hasCustomTooltip ? ' (custom)' : ''}`;
    tooltipItem.title = 'Set a custom hint/description for this widget';
    tooltipItem.addEventListener('click', () => {
        closeContextMenu();
        showTooltipEditDialog(nodeId, settings.tooltip || '', (newTooltip) => {
            settings.tooltip = newTooltip;
            saveWidgetSettings(nodeId, settings);
            applyWidgetTooltip(widgetElem, nodeId, settings);
        });
    });
    tooltipSection.appendChild(tooltipItem);
    menu.appendChild(tooltipSection);
    
    // Move section
    const moveSection = document.createElement('div');
    moveSection.classList.add('comfy-mobile-form-context-menu-section');
    moveSection.innerHTML = `<div class="comfy-mobile-form-context-menu-label">Move</div>`;
    
    /** @type {{action: 'top' | 'up' | 'down' | 'bottom', label: string, icon: string}[]} */
    const moveOptions = [
        { action: "top", label: "⇈ Move to Top", icon: "⇈" },
        { action: "up", label: "↑ Move Up", icon: "↑" },
        { action: "down", label: "↓ Move Down", icon: "↓" },
        { action: "bottom", label: "⇊ Move to Bottom", icon: "⇊" }
    ];
    
    for (const opt of moveOptions) {
        const item = document.createElement('div');
        item.classList.add('comfy-mobile-form-context-menu-item');
        item.innerHTML = `<span class="check-icon">${opt.icon}</span>${opt.label.substring(2)}`;
        item.addEventListener('click', () => {
            moveWidget(widgetElem, nodeId, opt.action);
            closeContextMenu();
        });
        moveSection.appendChild(item);
    }
    menu.appendChild(moveSection);
    
    // Advanced section - show/hide individual widgets within this node
    const node = currentGraph?._nodes?.find(n => n.id === nodeId);
    if (node && Array.isArray(node.widgets) && node.widgets.length > 1) {
        const advancedSection = document.createElement('div');
        advancedSection.classList.add('comfy-mobile-form-context-menu-section');
        advancedSection.innerHTML = `<div class="comfy-mobile-form-context-menu-label">Show/Hide Fields</div>`;
        
        const hiddenWidgets = settings.hiddenWidgets || [];
        
        // Create scrollable container for widget toggles
        const widgetList = document.createElement('div');
        widgetList.classList.add('comfy-mobile-form-context-menu-widget-list');
        
        for (const widget of node.widgets) {
            // Skip internal/hidden widgets
            if (widget.type === 'converted-widget' || widget.name?.startsWith('_')) continue;
            
            const initiallyHidden = hiddenWidgets.includes(widget.name);
            const item = document.createElement('div');
            item.classList.add('comfy-mobile-form-context-menu-item');
            if (!initiallyHidden) item.classList.add('active');
            item.innerHTML = `<span class="check-icon">${initiallyHidden ? '' : '✓'}</span><span class="widget-name">${widget.name}</span>`;
            item.title = `${initiallyHidden ? 'Show' : 'Hide'} the "${widget.name}" field`;
            item.dataset.widgetName = widget.name;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Re-read current state from settings (don't use captured value)
                const currentSettings = getWidgetSettings(nodeId);
                const currentHidden = currentSettings.hiddenWidgets || [];
                const isCurrentlyHidden = currentHidden.includes(widget.name);
                
                // Toggle visibility
                if (isCurrentlyHidden) {
                    // Remove from hidden list (show it)
                    currentSettings.hiddenWidgets = currentHidden.filter(n => n !== widget.name);
                } else {
                    // Add to hidden list (hide it)
                    currentSettings.hiddenWidgets = [...currentHidden, widget.name];
                }
                
                saveWidgetSettings(nodeId, currentSettings);
                
                // Update menu UI immediately (now showing opposite state)
                const nowHidden = !isCurrentlyHidden;
                item.classList.toggle('active', !nowHidden);
                const checkIcon = item.querySelector('.check-icon');
                if (checkIcon) checkIcon.textContent = nowHidden ? '' : '✓';
                item.title = `${nowHidden ? 'Show' : 'Hide'} the "${widget.name}" field`;
                
                // For hiding: directly hide the widget wrapper
                // For unhiding: need to re-render since element might not exist
                if (nowHidden) {
                    // Hiding - find and hide the wrapper
                    const widgetWrappers = widgetElem.querySelectorAll('.comfy-mobile-form-widget-wrapper');
                    widgetWrappers.forEach(wrapper => {
                        const label = wrapper.querySelector('.comfy-mobile-form-label');
                        if (label && label.textContent === widget.name) {
                            wrapper.style.display = 'none';
                        }
                    });
                } else {
                    // Unhiding - close menu and trigger re-render since element may not exist
                    closeContextMenu();
                    const formContainer = document.querySelector('.comfy-mobile-form');
                    if (formContainer) {
                        formContainer.dispatchEvent(new CustomEvent('mf-widget-visibility-changed', { 
                            bubbles: true, 
                            detail: { nodeId } 
                        }));
                    }
                }
            });
            
            widgetList.appendChild(item);
        }
        
        advancedSection.appendChild(widgetList);
        menu.appendChild(advancedSection);
    }
    
    // Position menu
    document.body.appendChild(menu);
    
    // Adjust position to stay in viewport
    const rect = menu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
        x = window.innerWidth - rect.width - 10;
    }
    if (y + rect.height > window.innerHeight) {
        y = window.innerHeight - rect.height - 10;
    }
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    activeContextMenu = menu;
    
    // Close on click outside
    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            closeContextMenu();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Add edit dot to widget
 * @param {HTMLElement} elem 
 * @param {number} nodeId 
 */
function addEditDot(elem, nodeId) {
    const dot = document.createElement('div');
    dot.classList.add('comfy-mobile-form-widget-edit-dot');
    dot.title = 'Edit widget settings';
    
    dot.addEventListener('click', (e) => {
        e.stopPropagation();
        showContextMenu(elem, nodeId, e.clientX, e.clientY);
    });
    
    elem.appendChild(dot);
}

/**
 * Add preview for a loaded image (from input or output folder)
 * Returns an update function to change the preview image
 * @param {HTMLElement} elem 
 * @param {string} filename - The filename (may include subfolder like "subfolder/image.png")
 * @param {string} type - "input" or "output"
 * @param {ComfyUIGraphNode} node
 * @returns {(newFilename: string) => void} Function to update the preview
 */
function addLoadedImagePreview(elem, filename, type, node) {
    const previewContainer = document.createElement('div');
    previewContainer.classList.add('comfy-mobile-form-node-preview', 'comfy-mobile-form-loaded-preview');
    
    const img = document.createElement('img');
    img.loading = 'lazy';
    
    // Click for fullscreen
    img.addEventListener('click', () => {
        showFullscreenImage(img.src);
    });
    
    // Handle load errors
    img.addEventListener('error', () => {
        img.style.display = 'none';
    });
    
    // Handle load success - show image
    img.addEventListener('load', () => {
        img.style.display = '';
    });
    
    previewContainer.appendChild(img);
    elem.appendChild(previewContainer);
    
    // Function to update the preview
    const updatePreview = (newFilename) => {
        if (!newFilename) {
            img.style.display = 'none';
            return;
        }
        
        // Parse filename - could be "subfolder/filename.png" or just "filename.png"
        let subfolder = '';
        let actualFilename = newFilename;
        
        if(newFilename.includes('/')) {
            const lastSlash = newFilename.lastIndexOf('/');
            subfolder = newFilename.substring(0, lastSlash);
            actualFilename = newFilename.substring(lastSlash + 1);
        }
        
        const params = new URLSearchParams({
            filename: actualFilename,
            subfolder: subfolder,
            type: type
        });
        img.src = `/view?${params.toString()}`;
        img.alt = newFilename;
    };
    
    // Set initial image
    updatePreview(filename);
    
    return updatePreview;
}

/**
 * Add preview for a loaded video (from input or output folder)
 * Returns an update function to change the preview video
 * @param {HTMLElement} elem 
 * @param {string} filename 
 * @param {string} type 
 * @param {ComfyUIGraphNode} node
 * @returns {(newFilename: string) => void} Function to update the preview
 */
function addLoadedVideoPreview(elem, filename, type, node) {
    const previewContainer = document.createElement('div');
    previewContainer.classList.add('comfy-mobile-form-node-preview', 'comfy-mobile-form-loaded-preview');
    
    const video = document.createElement('video');
    video.controls = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    
    // Handle load errors
    video.addEventListener('error', () => {
        video.style.display = 'none';
    });
    
    // Handle load success
    video.addEventListener('loadedmetadata', () => {
        video.style.display = '';
    });
    
    previewContainer.appendChild(video);
    elem.appendChild(previewContainer);
    
    // Function to update the preview
    const updatePreview = (newFilename) => {
        if (!newFilename) {
            video.style.display = 'none';
            return;
        }
        
        // Parse filename
        let subfolder = '';
        let actualFilename = newFilename;
        
        if(newFilename.includes('/')) {
            const lastSlash = newFilename.lastIndexOf('/');
            subfolder = newFilename.substring(0, lastSlash);
            actualFilename = newFilename.substring(lastSlash + 1);
        }
        
        const params = new URLSearchParams({
            filename: actualFilename,
            subfolder: subfolder,
            type: type
        });
        video.src = `/view?${params.toString()}`;
    };
    
    // Set initial video
    updatePreview(filename);
    
    return updatePreview;
}

/**
 * Add preview images from node.images to the widget
 * @param {HTMLElement} elem 
 * @param {ComfyUIGraphNode} node 
 */
function addNodeImagePreview(elem, node) {
    if (!node.images || !Array.isArray(node.images) || node.images.length === 0) return;
    
    const previewContainer = document.createElement('div');
    previewContainer.classList.add('comfy-mobile-form-node-preview');
    
    for (const imgData of node.images) {
        const img = document.createElement('img');
        const params = new URLSearchParams({
            filename: imgData.filename,
            subfolder: imgData.subfolder || '',
            type: imgData.type || 'output'
        });
        img.src = `/view?${params.toString()}`;
        img.alt = imgData.filename;
        img.loading = 'lazy';
        
        // Click for fullscreen
        img.addEventListener('click', () => {
            showFullscreenImage(img.src);
        });
        
        previewContainer.appendChild(img);
    }
    
    elem.appendChild(previewContainer);
}

/**
 * Add preview images from node.imgs (HTMLImageElement array used by some nodes)
 * @param {HTMLElement} elem 
 * @param {ComfyUIGraphNode} node 
 */
function addNodeImgsPreview(elem, node) {
    // @ts-ignore - imgs is a runtime property containing HTMLImageElement instances
    const imgs = node.imgs;
    if (!imgs || !Array.isArray(imgs) || imgs.length === 0) return;
    
    const previewContainer = document.createElement('div');
    previewContainer.classList.add('comfy-mobile-form-node-preview');
    
    for (const imgElement of imgs) {
        // imgs can be HTMLImageElement instances or objects with src
        const img = document.createElement('img');
        img.src = imgElement.src || imgElement;
        img.alt = 'Preview';
        img.loading = 'lazy';
        
        // Click for fullscreen
        img.addEventListener('click', () => {
            showFullscreenImage(img.src);
        });
        
        // Handle errors
        img.addEventListener('error', () => {
            img.style.display = 'none';
        });
        
        previewContainer.appendChild(img);
    }
    
    elem.appendChild(previewContainer);
}

/**
 * Show fullscreen image overlay
 * @param {string} src 
 */
function showFullscreenImage(src) {
    const overlay = document.createElement('div');
    overlay.classList.add('comfy-mobile-form-fullscreen-overlay');
    
    const img = document.createElement('img');
    img.src = src;
    overlay.appendChild(img);
    
    const closeBtn = document.createElement('button');
    closeBtn.classList.add('comfy-mobile-form-fullscreen-close');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

/**
 * @param {HTMLDivElement} elem 
 * @param {ComfyUIGraphNode} node 
 * @returns {boolean}
 */
export function createWidgetFromNode(elem, node) {
    elem.classList.add("comfy-mobile-form-widget");
    
    // Store node ID for drag/drop ordering
    elem.dataset.nodeId = String(node.id);
    
    // Check if node is bypassed (mode = 4)
    // @ts-ignore - mode exists on LiteGraph nodes
    if (node.mode === 4) {
        elem.classList.add('bypassed');
    }
    
    // Load and apply saved settings
    const settings = getWidgetSettings(node.id);
    applyWidgetSettings(elem, settings);
    
    // Add edit dot
    addEditDot(elem, node.id);
    
    let hasContent = false;
    
    // Check extension registry for a registered handler first
    const registeredHandler = ExtensionRegistry.getNodeHandler(node.type);
    if (registeredHandler) {
        try {
            hasContent = registeredHandler({
                elem,
                node,
                addTitle,
                addWidget,
                addLoadedImagePreview,
                addLoadedVideoPreview,
                addNodeImagePreview,
                addNodeImgsPreview,
                isWidgetHidden: (widgetName) => isWidgetHidden(node.id, widgetName)
            });
            
            // Extension handlers are responsible for deciding whether to show
            // node.images/node.imgs - don't add them automatically to avoid duplicates
            
            // Apply tooltip after content is built
            applyWidgetTooltip(elem, node.id, settings);
            
            return hasContent;
        } catch (e) {
            console.error(`[MobileForm] Extension handler error for ${node.type}:`, e);
            // Fall through to default handling
        }
    }
    
    switch(node.type) {
        case 'PrimitiveNode': {
            if(!Array.isArray(node.widgets)) break;

            for(const widget of node.widgets) {
                if(widget.name === 'value') {
                    addTitle(elem, node.title, node);
                    addWidget(elem, widget, node);
                    hasContent = true;
                    break;
                }
            }
            break;
        }
        case 'Note': {
            if(!Array.isArray(node.widgets)) break;

            for(const widget of node.widgets) {
                if(widget.type === 'customtext') {
                    addTextNote(elem, widget);
                    hasContent = true;
                    break;
                }
            }
            break;
        }
        case 'LoadImage':
        case 'LoadImageMask': {
            // Special handling for LoadImage nodes - show preview from input folder
            addTitle(elem, node.title, node);
            
            if(Array.isArray(node.widgets)) {
                const imageWidget = node.widgets.find(w => w.name === 'image');
                if(imageWidget && imageWidget.value) {
                    addLoadedImagePreview(elem, imageWidget.value, 'input', node);
                    hasContent = true;
                }
                
                // Add other widgets
                const group_elem = document.createElement('div');
                group_elem.classList.add("comfy-mobile-form-group");
                
                for(const widget of node.widgets) {
                    if(widget.hidden || widget.type === 'converted-widget') continue;
                    
                    const widgetWrapper = document.createElement('div');
                    widgetWrapper.classList.add("comfy-mobile-form-widget-wrapper");
                    
                    addTitle(widgetWrapper, widget.name);
                    if(addWidget(widgetWrapper, widget, node)) {
                        group_elem.appendChild(widgetWrapper);
                    }
                }
                
                if(group_elem.children.length > 0) {
                    elem.appendChild(group_elem);
                    hasContent = true;
                }
            }
            break;
        }
        case 'LoadImageFromOutputFolder':
        case 'LoadImageOutput':
        case 'Load Image From Output Folder': {
            // Special handling for loading images from output folder
            addTitle(elem, node.title, node);
            
            if(Array.isArray(node.widgets)) {
                // Try common widget names for output folder image loaders
                const imageWidget = node.widgets.find(w => 
                    w.name === 'image' || w.name === 'filename' || w.name === 'file'
                );
                const subfolderWidget = node.widgets.find(w => 
                    w.name === 'subfolder' || w.name === 'folder'
                );
                
                if(imageWidget && imageWidget.value) {
                    const subfolder = subfolderWidget?.value || '';
                    const fullPath = subfolder ? `${subfolder}/${imageWidget.value}` : imageWidget.value;
                    addLoadedImagePreview(elem, fullPath, 'output', node);
                    hasContent = true;
                }
                
                // Add other widgets
                const group_elem = document.createElement('div');
                group_elem.classList.add("comfy-mobile-form-group");
                
                for(const widget of node.widgets) {
                    if(widget.hidden || widget.type === 'converted-widget') continue;
                    
                    const widgetWrapper = document.createElement('div');
                    widgetWrapper.classList.add("comfy-mobile-form-widget-wrapper");
                    
                    addTitle(widgetWrapper, widget.name);
                    if(addWidget(widgetWrapper, widget, node)) {
                        group_elem.appendChild(widgetWrapper);
                    }
                }
                
                if(group_elem.children.length > 0) {
                    elem.appendChild(group_elem);
                    hasContent = true;
                }
            }
            break;
        }
        case 'VHS_LoadVideo':
        case 'LoadVideo': {
            // Special handling for LoadVideo nodes
            addTitle(elem, node.title, node);
            
            if(Array.isArray(node.widgets)) {
                const videoWidget = node.widgets.find(w => w.name === 'video' || w.name === 'video_path');
                if(videoWidget && videoWidget.value) {
                    addLoadedVideoPreview(elem, videoWidget.value, 'input', node);
                    hasContent = true;
                }
                
                // Add other widgets
                const group_elem = document.createElement('div');
                group_elem.classList.add("comfy-mobile-form-group");
                
                for(const widget of node.widgets) {
                    if(widget.hidden || widget.type === 'converted-widget') continue;
                    
                    const widgetWrapper = document.createElement('div');
                    widgetWrapper.classList.add("comfy-mobile-form-widget-wrapper");
                    
                    addTitle(widgetWrapper, widget.name);
                    if(addWidget(widgetWrapper, widget, node)) {
                        group_elem.appendChild(widgetWrapper);
                    }
                }
                
                if(group_elem.children.length > 0) {
                    elem.appendChild(group_elem);
                    hasContent = true;
                }
            }
            break;
        }
        default: {
            // For nodes without a specific handler, render all their widgets
            const hasWidgets = Array.isArray(node.widgets) && node.widgets.length > 0;
            const hasImages = node.images && Array.isArray(node.images) && node.images.length > 0;
            
            if(!hasWidgets && !hasImages) break;
            
            addTitle(elem, node.title || node.type, node);

            if(hasWidgets) {
                const group_elem = document.createElement('div');
                group_elem.classList.add("comfy-mobile-form-group");
                elem.appendChild(group_elem);

                let widgetCount = 0;
                for(const widget of node.widgets) {
                    // Skip hidden widgets, converted widgets, and user-hidden widgets
                    if(widget.hidden || widget.type === 'converted-widget') continue;
                    if(isWidgetHidden(node.id, widget.name)) continue;
                    
                    const widgetWrapper = document.createElement('div');
                    widgetWrapper.classList.add("comfy-mobile-form-widget-wrapper");
                    
                    addTitle(widgetWrapper, widget.name);
                    if(addWidget(widgetWrapper, widget, node)) {
                        group_elem.appendChild(widgetWrapper);
                        widgetCount++;
                    }
                }
                
                // Even if no widgets were added, show the node with its title
                // This is useful for output nodes that might not have editable widgets
                hasContent = widgetCount > 0 || hasImages;
                
                // If no widgets but we have images, remove the empty group
                if (widgetCount === 0 && !hasImages) {
                    group_elem.remove();
                }
            }
            break;
        }
    }
    
    // Always add node preview images if they exist (from execution results)
    if(node.images && Array.isArray(node.images) && node.images.length > 0) {
        addNodeImagePreview(elem, node);
        hasContent = true;
    }
    
    // Check for imgs property (used by some nodes for preview)
    // @ts-ignore - imgs is a runtime property
    if(node.imgs && Array.isArray(node.imgs) && node.imgs.length > 0) {
        addNodeImgsPreview(elem, node);
        hasContent = true;
    }
    
    // Apply tooltip after content is built
    applyWidgetTooltip(elem, node.id, settings);
    
    return hasContent;
}

/**
 * Show inline rename editor for a title element
 * @param {HTMLElement} labelElem - The label element to rename
 * @param {string} currentTitle - Current title text
 * @param {(newTitle: string) => void} onRename - Callback when renamed
 */
function showInlineRename(labelElem, currentTitle, onRename) {
    // Create inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.classList.add('comfy-mobile-form-inline-rename');
    
    const originalText = labelElem.textContent;
    labelElem.textContent = '';
    labelElem.appendChild(input);
    
    input.focus();
    input.select();
    
    const finish = (save = true) => {
        const newTitle = input.value.trim();
        input.remove();
        
        if (save && newTitle && newTitle !== currentTitle) {
            labelElem.textContent = newTitle;
            onRename(newTitle);
        } else {
            labelElem.textContent = originalText;
        }
    };
    
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
        }
    });
}

/**
 * Show rename dialog for a node or section
 * @param {string} currentTitle - Current title
 * @param {string} itemType - Type of item being renamed (e.g., "Node", "Section")
 * @param {(newTitle: string) => void} onRename - Callback when renamed
 */
export function showRenameDialog(currentTitle, itemType, onRename) {
    const overlay = document.createElement('div');
    overlay.classList.add('comfy-mobile-form-dialog-overlay');
    
    const dialog = document.createElement('div');
    dialog.classList.add('comfy-mobile-form-dialog');
    dialog.innerHTML = `
        <div class="comfy-mobile-form-dialog-header">
            <h3>Rename ${itemType}</h3>
            <button class="comfy-mobile-form-dialog-close" aria-label="Close dialog">✕</button>
        </div>
        <div class="comfy-mobile-form-dialog-body">
            <div class="comfy-mobile-form-rename-field">
                <label>Name</label>
                <input type="text" class="comfy-mobile-form-rename-input" value="${escapeHtml(currentTitle)}" placeholder="Enter new name...">
            </div>
        </div>
        <div class="comfy-mobile-form-dialog-footer">
            <button class="comfy-mobile-form-dialog-btn secondary" data-action="cancel">Cancel</button>
            <button class="comfy-mobile-form-dialog-btn primary" data-action="rename">Rename</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    const input = /** @type {HTMLInputElement} */ (dialog.querySelector('.comfy-mobile-form-rename-input'));
    input.focus();
    input.select();
    
    const close = () => {
        overlay.remove();
    };
    
    const doRename = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            onRename(newTitle);
        }
        close();
    };
    
    // Close button
    dialog.querySelector('.comfy-mobile-form-dialog-close')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    
    // Action buttons
    dialog.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            if (action === 'rename') {
                doRename();
            } else {
                close();
            }
        });
    });
    
    // Enter to submit, Escape to cancel
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            doRename();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {string} title 
 * @param {ComfyUIGraphNode} [node] - Optional node for rename support
 */
export function addTitle(elem, title, node) {
    const label_elem = document.createElement('label');
    label_elem.classList.add("comfy-mobile-form-label");
    label_elem.textContent = title;
    
    // Add double-click to rename if node is provided
    if (node) {
        label_elem.style.cursor = 'text';
        label_elem.title = 'Double-click to rename';
        
        label_elem.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            showInlineRename(label_elem, node.title || title, (newTitle) => {
                node.title = newTitle;
                // Trigger graph change to save
                if (currentGraph) {
                    currentGraph.setDirtyCanvas?.(true, true);
                }
            });
        });
    }
    
    elem.appendChild(label_elem);
}

/**
 * @param {HTMLDivElement} elem 
 * @param {ComfyUIGraphWidget} widget 
 * @param {ComfyUIGraphNode} [node]
 * @returns {boolean}
 */
export function addWidget(elem, widget, node) {
    const type = widget.type?.toLowerCase?.() || widget.type;
    
    // Check extension registry for a registered widget handler first
    const registeredHandler = ExtensionRegistry.getWidgetHandler(type);
    if (registeredHandler) {
        try {
            const handled = registeredHandler({ elem, widget, node });
            if (handled) return true;
            // If handler returns false, fall through to default handling
        } catch (e) {
            console.error(`[MobileForm] Widget handler error for ${type}:`, e);
            // Fall through to default handling
        }
    }
    
    switch(type) {
        case 'combo': 
            addComboWidget(elem, widget); 
            return true;
        case 'number': 
            addNumberWidget(elem, widget); 
            return true;
        case 'float':
            addFloatWidget(elem, widget);
            return true;
        case 'int':
            addIntWidget(elem, widget);
            return true;
        case 'string':
        case 'text':
            addTextWidget(elem, widget);
            return true;
        case 'customtext':
        case 'multiline':
            addCustomTextWidget(elem, widget);
            return true;
        case 'boolean':
        case 'toggle':
            addBooleanWidget(elem, widget);
            return true;
        case 'button':
            addButtonWidget(elem, widget);
            return true;
        case 'slider':
            addSliderWidget(elem, widget);
            return true;
        case 'seed':
            addSeedWidget(elem, widget);
            return true;
        case 'image':
        case 'imageupload':
            // Handled by media.js
            addImageUploadWidget(elem, widget, node);
            return true;
        case 'video':
        case 'videoupload':
            // Handled by media.js
            addVideoUploadWidget(elem, widget, node);
            return true;
        default:
            // Try to infer type from options
            if(widget.options?.values && Array.isArray(widget.options.values)) {
                addComboWidget(elem, widget);
                return true;
            }
            if(typeof widget.value === 'number') {
                addNumberWidget(elem, widget);
                return true;
            }
            if(typeof widget.value === 'boolean') {
                addBooleanWidget(elem, widget);
                return true;
            }
            if(typeof widget.value === 'string') {
                // Check if multiline
                if(widget.options?.multiline || widget.value.includes('\n')) {
                    addCustomTextWidget(elem, widget);
                } else {
                    addTextWidget(elem, widget);
                }
                return true;
            }
            console.warn("[MobileForm]", "Unknown widget type:", widget.type, widget);
            return false;
    }
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'combo', name: string, value: string, options: {values: string[] | (() => string[])}}} widget 
 */
export function addComboWidget(elem, widget) {
    const wrapper = document.createElement('div');
    wrapper.classList.add("comfy-mobile-form-combo-wrapper");
    
    const select_elem = document.createElement('select');
    select_elem.classList.add("comfy-mobile-form-select");
    
    // Get values - they may be a function or various formats
    let values = widget.options?.values || [];
    if(typeof values === 'function') {
        try {
            values = values();
        } catch(e) {
            values = [];
        }
    }
    
    // Ensure values is an array
    if(!Array.isArray(values)) {
        // Could be an object or other type - try to convert
        if(values && typeof values === 'object') {
            values = Object.keys(values);
        } else if(typeof values === 'string') {
            values = [values];
        } else {
            values = [];
        }
    }
    
    // Add search for large lists
    if(values.length > 10) {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        searchInput.classList.add("comfy-mobile-form-combo-search");
        
        searchInput.addEventListener('input', () => {
            const filter = searchInput.value.toLowerCase();
            for(const option of select_elem.options) {
                const match = option.text.toLowerCase().includes(filter);
                option.style.display = match ? '' : 'none';
            }
        });
        
        wrapper.appendChild(searchInput);
    }
    
    select_elem.replaceChildren(...values.map((value) => {
        const option_elem = document.createElement('option');
        option_elem.value = value;
        option_elem.textContent = value;
        return option_elem;
    }));

    select_elem.value = widget.value;
    wrapper.appendChild(select_elem);
    elem.appendChild(wrapper);

    select_elem.addEventListener('change', () => {
        widget.value = select_elem.value;
        widget.callback?.(widget.value);
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'number', name: string, value: number, options?: {min?: number, max?: number, step?: number, precision?: number}}} widget 
 */
export function addNumberWidget(elem, widget) {
    const wrapper = document.createElement('div');
    wrapper.classList.add("comfy-mobile-form-number-wrapper");
    
    const input_elem = document.createElement('input');
    input_elem.type = 'number';
    input_elem.classList.add("comfy-mobile-form-number");
    input_elem.value = `${widget.value}`;
    
    // Apply constraints from options
    const options = widget.options || {};
    if(options.min !== undefined) input_elem.min = `${options.min}`;
    if(options.max !== undefined) input_elem.max = `${options.max}`;
    if(options.step !== undefined) {
        input_elem.step = `${options.step}`;
    } else if(options.precision !== undefined) {
        input_elem.step = `${Math.pow(10, -options.precision)}`;
    }
    
    // Add increment/decrement buttons for mobile
    const decrementBtn = document.createElement('button');
    decrementBtn.classList.add("comfy-mobile-form-number-btn", "decrement");
    decrementBtn.textContent = '−';
    decrementBtn.type = 'button';
    
    const incrementBtn = document.createElement('button');
    incrementBtn.classList.add("comfy-mobile-form-number-btn", "increment");
    incrementBtn.textContent = '+';
    incrementBtn.type = 'button';
    
    const step = options.step || 1;
    
    decrementBtn.addEventListener('click', () => {
        let newVal = parseFloat(input_elem.value) - step;
        if(options.min !== undefined) newVal = Math.max(options.min, newVal);
        input_elem.value = formatNumber(newVal, options.precision);
        widget.value = parseFloat(input_elem.value);
        widget.callback?.(widget.value);
    });
    
    incrementBtn.addEventListener('click', () => {
        let newVal = parseFloat(input_elem.value) + step;
        if(options.max !== undefined) newVal = Math.min(options.max, newVal);
        input_elem.value = formatNumber(newVal, options.precision);
        widget.value = parseFloat(input_elem.value);
        widget.callback?.(widget.value);
    });
    
    wrapper.appendChild(decrementBtn);
    wrapper.appendChild(input_elem);
    wrapper.appendChild(incrementBtn);
    elem.appendChild(wrapper);

    input_elem.addEventListener('change', () => {
        let val = parseFloat(input_elem.value);
        if(options.min !== undefined) val = Math.max(options.min, val);
        if(options.max !== undefined) val = Math.min(options.max, val);
        input_elem.value = formatNumber(val, options.precision);
        widget.value = val;
        widget.callback?.(widget.value);
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {ComfyUIGraphWidget} widget 
 */
export function addFloatWidget(elem, widget) {
    // FLOAT is just a number with decimal support
    const options = widget.options || {};
    if(options.precision === undefined) options.precision = 3;
    if(options.step === undefined) options.step = 0.1;
    widget.options = options;
    addNumberWidget(elem, widget);
}

/**
 * @param {HTMLDivElement} elem 
 * @param {ComfyUIGraphWidget} widget 
 */
export function addIntWidget(elem, widget) {
    // INT is a whole number
    const options = widget.options || {};
    options.step = options.step || 1;
    options.precision = 0;
    widget.options = options;
    addNumberWidget(elem, widget);
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'string' | 'text', name: string, value: string, options?: {placeholder?: string, maxLength?: number}}} widget 
 */
export function addTextWidget(elem, widget) {
    // Use textarea for all text inputs for consistent height handling
    const textarea_elem = document.createElement('textarea');
    textarea_elem.classList.add("comfy-mobile-form-textarea");
    textarea_elem.value = widget.value || '';
    
    if(widget.options?.placeholder) {
        textarea_elem.placeholder = widget.options.placeholder;
    }
    if(widget.options?.maxLength) {
        textarea_elem.maxLength = widget.options.maxLength;
    }
    
    elem.appendChild(textarea_elem);

    textarea_elem.addEventListener('change', () => {
        widget.value = textarea_elem.value;
        widget.callback?.(widget.value);
    });
    
    // Also update on input for real-time sync
    textarea_elem.addEventListener('input', () => {
        widget.value = textarea_elem.value;
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'customtext', name: string, value: string, options?: {multiline?: boolean, dynamicPrompts?: boolean}}} widget 
 */
export function addCustomTextWidget(elem, widget) {
    const textarea_elem = document.createElement('textarea');
    textarea_elem.classList.add("comfy-mobile-form-textarea");
    textarea_elem.value = widget.value || '';
    textarea_elem.placeholder = widget.options?.dynamicPrompts ? 'Enter prompt...' : '';
    
    elem.appendChild(textarea_elem);

    textarea_elem.addEventListener('input', () => {
        widget.value = textarea_elem.value;
    });
    
    textarea_elem.addEventListener('change', () => {
        widget.value = textarea_elem.value;
        widget.callback?.(widget.value);
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'boolean' | 'toggle', name: string, value: boolean, options?: {}}} widget 
 */
export function addBooleanWidget(elem, widget) {
    const wrapper = document.createElement('label');
    wrapper.classList.add("comfy-mobile-form-toggle-wrapper");
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add("comfy-mobile-form-toggle-input");
    checkbox.checked = !!widget.value;
    
    const slider = document.createElement('span');
    slider.classList.add("comfy-mobile-form-toggle-slider");
    
    wrapper.appendChild(checkbox);
    wrapper.appendChild(slider);
    elem.appendChild(wrapper);
    
    checkbox.addEventListener('change', () => {
        widget.value = checkbox.checked;
        widget.callback?.(widget.value);
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'button', name: string, value?: any, callback?: Function}} widget 
 */
export function addButtonWidget(elem, widget) {
    const button = document.createElement('button');
    button.classList.add("comfy-mobile-form-button");
    button.textContent = widget.name || 'Button';
    button.type = 'button';
    
    elem.appendChild(button);
    
    button.addEventListener('click', () => {
        widget.callback?.(widget);
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'slider', name: string, value: number, options?: {min?: number, max?: number, step?: number}}} widget 
 */
export function addSliderWidget(elem, widget) {
    const wrapper = document.createElement('div');
    wrapper.classList.add("comfy-mobile-form-slider-wrapper");
    
    const options = widget.options || {};
    const min = options.min ?? 0;
    const max = options.max ?? 100;
    const step = options.step ?? 1;
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.classList.add("comfy-mobile-form-slider");
    slider.min = `${min}`;
    slider.max = `${max}`;
    slider.step = `${step}`;
    slider.value = `${widget.value}`;
    
    const valueDisplay = document.createElement('span');
    valueDisplay.classList.add("comfy-mobile-form-slider-value");
    valueDisplay.textContent = `${widget.value}`;
    
    wrapper.appendChild(slider);
    wrapper.appendChild(valueDisplay);
    elem.appendChild(wrapper);
    
    slider.addEventListener('input', () => {
        widget.value = parseFloat(slider.value);
        valueDisplay.textContent = `${widget.value}`;
    });
    
    slider.addEventListener('change', () => {
        widget.callback?.(widget.value);
    });
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'seed', name: string, value: number, options?: {min?: number, max?: number}}} widget 
 */
export function addSeedWidget(elem, widget) {
    const wrapper = document.createElement('div');
    wrapper.classList.add("comfy-mobile-form-seed-wrapper");
    
    const options = widget.options || {};
    const min = options.min ?? 0;
    const max = options.max ?? 0xffffffffffffffff;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.classList.add("comfy-mobile-form-seed-input");
    input.value = `${widget.value}`;
    input.min = `${min}`;
    input.max = `${max}`;
    
    const randomBtn = document.createElement('button');
    randomBtn.classList.add("comfy-mobile-form-seed-random");
    randomBtn.innerHTML = '🎲';
    randomBtn.title = 'Random seed';
    randomBtn.type = 'button';
    
    const lastBtn = document.createElement('button');
    lastBtn.classList.add("comfy-mobile-form-seed-last");
    lastBtn.innerHTML = '↩';
    lastBtn.title = 'Last seed';
    lastBtn.type = 'button';
    
    let lastSeed = widget.value;
    
    randomBtn.addEventListener('click', () => {
        lastSeed = widget.value;
        const newSeed = Math.floor(Math.random() * max);
        input.value = `${newSeed}`;
        widget.value = newSeed;
        widget.callback?.(widget.value);
    });
    
    lastBtn.addEventListener('click', () => {
        input.value = `${lastSeed}`;
        widget.value = lastSeed;
        widget.callback?.(widget.value);
    });
    
    input.addEventListener('change', () => {
        lastSeed = widget.value;
        widget.value = parseInt(input.value, 10);
        widget.callback?.(widget.value);
    });
    
    wrapper.appendChild(input);
    wrapper.appendChild(randomBtn);
    wrapper.appendChild(lastBtn);
    elem.appendChild(wrapper);
}

/**
 * @param {HTMLDivElement} elem 
 * @param {ComfyUIGraphWidget} widget 
 * @param {ComfyUIGraphNode} [node]
 */
export function addImageUploadWidget(elem, widget, node) {
    const wrapper = document.createElement('div');
    wrapper.classList.add("comfy-mobile-form-image-upload");
    
    const preview = document.createElement('div');
    preview.classList.add("comfy-mobile-form-image-preview");
    
    // Show current image if exists
    if(widget.value) {
        const img = document.createElement('img');
        img.src = getImageUrl(widget.value);
        img.alt = 'Current image';
        preview.appendChild(img);
    } else {
        preview.innerHTML = '<span class="placeholder">No image selected</span>';
    }
    
    const inputWrapper = document.createElement('div');
    inputWrapper.classList.add("comfy-mobile-form-upload-buttons");
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.classList.add("comfy-mobile-form-file-input");
    fileInput.id = `image-upload-${Math.random().toString(36).substr(2, 9)}`;
    
    const uploadBtn = document.createElement('label');
    uploadBtn.classList.add("comfy-mobile-form-upload-btn");
    uploadBtn.htmlFor = fileInput.id;
    uploadBtn.innerHTML = '📁 Choose File';
    
    // Camera button for mobile
    const cameraBtn = document.createElement('button');
    cameraBtn.classList.add("comfy-mobile-form-camera-btn");
    cameraBtn.innerHTML = '📷 Camera';
    cameraBtn.type = 'button';
    
    const cameraInput = document.createElement('input');
    cameraInput.type = 'file';
    cameraInput.accept = 'image/*';
    cameraInput.capture = 'environment';
    cameraInput.classList.add("comfy-mobile-form-file-input");
    
    cameraBtn.addEventListener('click', () => cameraInput.click());
    
    const handleFile = async (file) => {
        if(!file) return;
        
        preview.innerHTML = '<span class="loading">Uploading...</span>';
        
        try {
            const result = await uploadImage(file);
            if(result) {
                widget.value = result.name;
                const img = document.createElement('img');
                img.src = getImageUrl(result.name, result.subfolder, result.type);
                img.alt = 'Uploaded image';
                preview.innerHTML = '';
                preview.appendChild(img);
                widget.callback?.(widget.value);
            }
        } catch(e) {
            console.error('[MobileForm] Image upload failed:', e);
            preview.innerHTML = '<span class="error">Upload failed</span>';
        }
    };
    
    fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));
    cameraInput.addEventListener('change', () => handleFile(cameraInput.files?.[0]));
    
    // Drag and drop
    wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.classList.add('dragover');
    });
    
    wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('dragover');
    });
    
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('dragover');
        handleFile(e.dataTransfer?.files?.[0]);
    });
    
    inputWrapper.appendChild(fileInput);
    inputWrapper.appendChild(uploadBtn);
    inputWrapper.appendChild(cameraInput);
    inputWrapper.appendChild(cameraBtn);
    
    wrapper.appendChild(preview);
    wrapper.appendChild(inputWrapper);
    elem.appendChild(wrapper);
}

/**
 * @param {HTMLDivElement} elem 
 * @param {ComfyUIGraphWidget} widget 
 * @param {ComfyUIGraphNode} [node]
 */
export function addVideoUploadWidget(elem, widget, node) {
    const wrapper = document.createElement('div');
    wrapper.classList.add("comfy-mobile-form-video-upload");
    
    const preview = document.createElement('div');
    preview.classList.add("comfy-mobile-form-video-preview");
    
    if(widget.value) {
        const video = document.createElement('video');
        video.src = getVideoUrl(widget.value);
        video.controls = true;
        video.muted = true;
        preview.appendChild(video);
    } else {
        preview.innerHTML = '<span class="placeholder">No video selected</span>';
    }
    
    const inputWrapper = document.createElement('div');
    inputWrapper.classList.add("comfy-mobile-form-upload-buttons");
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*';
    fileInput.classList.add("comfy-mobile-form-file-input");
    fileInput.id = `video-upload-${Math.random().toString(36).substr(2, 9)}`;
    
    const uploadBtn = document.createElement('label');
    uploadBtn.classList.add("comfy-mobile-form-upload-btn");
    uploadBtn.htmlFor = fileInput.id;
    uploadBtn.innerHTML = '📁 Choose Video';
    
    const handleFile = async (file) => {
        if(!file) return;
        
        preview.innerHTML = '<span class="loading">Uploading...</span>';
        
        try {
            const result = await uploadVideo(file);
            if(result) {
                widget.value = result.name;
                const video = document.createElement('video');
                video.src = getVideoUrl(result.name, result.subfolder, result.type);
                video.controls = true;
                video.muted = true;
                preview.innerHTML = '';
                preview.appendChild(video);
                widget.callback?.(widget.value);
            }
        } catch(e) {
            console.error('[MobileForm] Video upload failed:', e);
            preview.innerHTML = '<span class="error">Upload failed</span>';
        }
    };
    
    fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));
    
    // Drag and drop
    wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.classList.add('dragover');
    });
    
    wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('dragover');
    });
    
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('dragover');
        handleFile(e.dataTransfer?.files?.[0]);
    });
    
    inputWrapper.appendChild(fileInput);
    inputWrapper.appendChild(uploadBtn);
    
    wrapper.appendChild(preview);
    wrapper.appendChild(inputWrapper);
    elem.appendChild(wrapper);
}

/**
 * @param {HTMLDivElement} elem 
 * @param {{type: 'customtext', value: string}} widget 
 */
export function addTextNote(elem, widget) {
    elem.classList.add("comfy-mobile-form-note");
    const text_elem = document.createElement('div');
    text_elem.classList.add("comfy-mobile-form-note-text");
    text_elem.innerHTML = widget.value.replace(/\n/g, '<br>');
    elem.appendChild(text_elem);
}

// ============ Helper Functions ============

/**
 * Format a number with optional precision
 * @param {number} value 
 * @param {number} [precision] 
 * @returns {string}
 */
function formatNumber(value, precision) {
    if(precision !== undefined && precision >= 0) {
        return value.toFixed(precision);
    }
    return String(value);
}

/**
 * Get image URL from ComfyUI
 * @param {string} filename 
 * @param {string} [subfolder] 
 * @param {string} [type] 
 * @returns {string}
 */
function getImageUrl(filename, subfolder = '', type = 'input') {
    const params = new URLSearchParams({ filename, subfolder, type });
    return `/view?${params.toString()}`;
}

/**
 * Get video URL from ComfyUI
 * @param {string} filename 
 * @param {string} [subfolder] 
 * @param {string} [type] 
 * @returns {string}
 */
function getVideoUrl(filename, subfolder = '', type = 'input') {
    const params = new URLSearchParams({ filename, subfolder, type });
    return `/view?${params.toString()}`;
}

/**
 * Upload an image to ComfyUI
 * @param {File} file 
 * @returns {Promise<{name: string, subfolder: string, type: string} | null>}
 */
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file, file.name);
    formData.append('overwrite', 'true');
    
    try {
        const response = await fetch('/upload/image', {
            method: 'POST',
            body: formData
        });
        
        if(response.ok) {
            return await response.json();
        }
    } catch(e) {
        console.error('[MobileForm] Upload error:', e);
    }
    return null;
}

/**
 * Upload a video to ComfyUI
 * @param {File} file 
 * @returns {Promise<{name: string, subfolder: string, type: string} | null>}
 */
async function uploadVideo(file) {
    const formData = new FormData();
    formData.append('image', file, file.name);
    formData.append('overwrite', 'true');
    formData.append('type', 'input');
    
    try {
        const response = await fetch('/upload/image', {
            method: 'POST',
            body: formData
        });
        
        if(response.ok) {
            return await response.json();
        }
    } catch(e) {
        console.error('[MobileForm] Upload error:', e);
    }
    return null;
}
