// @ts-check

import { createWidgetFromNode, setCurrentGraph, getWidgetOrder, saveWidgetOrder, showRenameDialog } from "./widget.js";
import { OutputsManager, getOutputNodeTypes } from "./outputs.js";
import { 
    MOBILE_BREAKPOINT, 
    ROW_THRESHOLD, 
    PROGRESS_RESET_DELAY,
    MAX_BATCH_COUNT 
} from "./constants.js";

/** @import {ComfyUIApp, ComfyUIGraph, ComfyUIGraphGroup, ComfyUIGraphNode} from "./types" */

// @ts-ignore
import { api } from "../../scripts/api.js";

/**
 * Group title patterns
 */
const INPUT_GROUP_PATTERN = /^\s*mobile\s*(?:form|ui|inputs?)\s*$/i;
const OUTPUT_GROUP_PATTERN = /^\s*(?:mobile\s*)?outputs?\s*$/i;
const MOBILE_OUTPUT_GROUP_PATTERN = /^\s*mobile\s*outputs?\s*$/i;

/**
 * Subgroup colors - assigned automatically to nodes in the same subgroup
 */
const SUBGROUP_COLORS = [
    'blue', 'green', 'purple', 'orange', 'cyan', 
    'pink', 'teal', 'amber', 'indigo', 'rose'
];

export class MobileFormUI {
    /** @type {ComfyUIApp} */
    #app;

    /** @type {HTMLDivElement} */
    #elem;
    
    /** @type {HTMLDivElement} */
    #header;
    
    /** @type {HTMLDivElement} */
    #inputsContainer;
    
    /** @type {HTMLDivElement} */
    #outputsContainer;
    
    /** @type {HTMLDivElement} */
    #actionsContainer;
    
    /** @type {HTMLDivElement} */
    #statusBar;
    
    /** @type {OutputsManager | null} */
    #outputsManager = null;

    /** @type {boolean} */
    #visible = false;
    get visible() { return this.#visible; }
    
    /** @type {'mobile' | 'desktop'} */
    #mode = 'mobile';
    
    /** @type {'inputs' | 'outputs'} */
    #activeTab = 'inputs';
    
    /** @type {boolean} */
    #editMode = false;
    
    /** @type {HTMLElement | null} */
    #draggedElement = null;
    
    /** @type {number[]} */
    #currentNodeOrder = [];

    /** Execution tracking for status bar */
    /** @type {number} */
    #totalNodes = 0;
    /** @type {number} */
    #currentNodeIndex = 0;
    /** @type {number} */
    #executionStartTime = 0;
    /** @type {number[]} */
    #nodeTimings = [];

    /**
     * @param {ComfyUIApp} app 
     * @param {HTMLDivElement} elem 
     */
    constructor(app, elem) {
        this.#app = app;
        this.#elem = elem;

        elem.classList.add("comfy-mobile-form");
        if(!this.#visible) {
            elem.classList.add("comfy-mobile-form-hidden")
        }
        
        // Detect mobile
        this.#mode = this.#detectMode();
        elem.classList.add(`comfy-mobile-form-${this.#mode}`);
        
        // Build structure
        this.#buildStructure();
    }
    
    /**
     * Detect if we're on mobile or desktop
     * @returns {'mobile' | 'desktop'}
     */
    #detectMode() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isNarrow = window.innerWidth < MOBILE_BREAKPOINT;
        return (isMobile || isNarrow) ? 'mobile' : 'desktop';
    }
    
    /**
     * Build the UI structure
     */
    #buildStructure() {
        this.#elem.innerHTML = '';
        
        // Header with tabs and close button
        this.#header = document.createElement('div');
        this.#header.classList.add('comfy-mobile-form-header');
        this.#header.innerHTML = `
            <div class="comfy-mobile-form-tabs">
                <button class="comfy-mobile-form-tab active" data-tab="inputs">
                    <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 3v12M3 12l9 9 9-9"/>
                    </svg>
                    <span class="tab-label">Inputs</span>
                </button>
                <button class="comfy-mobile-form-tab" data-tab="outputs">
                    <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                    </svg>
                    <span class="tab-label">Outputs</span>
                </button>
            </div>
            <div class="comfy-mobile-form-header-actions">
                <button class="comfy-mobile-form-edit-btn" title="Edit Layout">
                    <svg class="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <span class="edit-label">Edit</span>
                </button>
                <button class="comfy-mobile-form-close" title="Close Form View">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Tab switching
        this.#header.querySelectorAll('.comfy-mobile-form-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = /** @type {'inputs' | 'outputs'} */ (tab.getAttribute('data-tab'));
                this.#switchTab(tabName);
            });
        });
        
        // Edit mode toggle
        this.#header.querySelector('.comfy-mobile-form-edit-btn')?.addEventListener('click', () => {
            this.#toggleEditMode();
        });
        
        // Add search bar below header
        const searchBar = document.createElement('div');
        searchBar.classList.add('comfy-mobile-form-search');
        searchBar.innerHTML = `
            <div class="comfy-mobile-form-search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
            </div>
            <input type="text" class="comfy-mobile-form-search-input" placeholder="Search widgets..." aria-label="Search widgets">
            <button class="comfy-mobile-form-search-clear" title="Clear search" style="display: none;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        `;
        
        const searchInput = /** @type {HTMLInputElement} */ (searchBar.querySelector('.comfy-mobile-form-search-input'));
        const clearBtn = /** @type {HTMLButtonElement} */ (searchBar.querySelector('.comfy-mobile-form-search-clear'));
        
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            clearBtn.style.display = query ? 'flex' : 'none';
            this.#filterWidgets(query);
        });
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            this.#filterWidgets('');
            searchInput.focus();
        });
        
        // Keyboard shortcut: / to focus search
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && this.#visible && !this.#isTypingInInput(e)) {
                e.preventDefault();
                searchInput.focus();
            }
        });
        
        // Close button
        this.#header.querySelector('.comfy-mobile-form-close')?.addEventListener('click', () => {
            this.toggleVisible();
        });
        
        this.#elem.appendChild(this.#header);
        this.#elem.appendChild(searchBar);
        
        // Content area
        const content = document.createElement('div');
        content.classList.add('comfy-mobile-form-content');
        
        // Inputs container
        this.#inputsContainer = document.createElement('div');
        this.#inputsContainer.classList.add('comfy-mobile-form-inputs');
        content.appendChild(this.#inputsContainer);
        
        // Outputs container
        this.#outputsContainer = document.createElement('div');
        this.#outputsContainer.classList.add('comfy-mobile-form-outputs-container', 'comfy-mobile-form-hidden');
        content.appendChild(this.#outputsContainer);
        
        this.#elem.appendChild(content);
        
        // Status bar (visible on all tabs) - aria-live for screen readers
        this.#statusBar = document.createElement('div');
        this.#statusBar.classList.add('comfy-mobile-form-status-bar');
        this.#statusBar.setAttribute('role', 'status');
        this.#statusBar.setAttribute('aria-live', 'polite');
        this.#statusBar.setAttribute('aria-atomic', 'true');
        this.#statusBar.innerHTML = `
            <div class="comfy-mobile-form-status-info">
                <span class="comfy-mobile-form-status-node-count" aria-label="Current node"></span>
                <span class="comfy-mobile-form-status-eta" aria-label="Estimated time remaining"></span>
            </div>
            <div class="comfy-mobile-form-status-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                <div class="comfy-mobile-form-status-progress-fill"></div>
            </div>
            <div class="comfy-mobile-form-status-text">Ready</div>
        `;
        this.#elem.appendChild(this.#statusBar);
        
        // Actions bar (Queue button, etc)
        this.#actionsContainer = document.createElement('div');
        this.#actionsContainer.classList.add('comfy-mobile-form-actions');
        this.#buildActionsBar();
        this.#elem.appendChild(this.#actionsContainer);
        
        // Initialize outputs manager
        this.#outputsManager = new OutputsManager(this.#outputsContainer);
        this.#outputsManager.onUpdate(() => {
            // Update tab badge when new outputs arrive
            this.#updateOutputsBadge();
        });
        
        // Setup status event listeners
        this.#setupStatusListeners();
        
        // Setup keyboard shortcuts
        this.#setupKeyboardShortcuts();
        
        // Listen for widget visibility changes that require re-render (unhiding)
        this.#elem.addEventListener('mf-widget-visibility-changed', () => {
            // Re-render the form to show newly unhidden widgets
            if (this.#app.graph) {
                this.setGraph(this.#app.graph);
            }
        });
    }
    
    /**
     * Build the actions bar with Queue button
     */
    #buildActionsBar() {
        this.#actionsContainer.innerHTML = `
            <button class="comfy-mobile-form-queue-btn" title="Queue Prompt (Q)">
                <span class="btn-icon">▶</span>
                <span class="btn-label">Queue</span>
            </button>
            <button class="comfy-mobile-form-batch-btn" title="Batch Queue (Shift+Q)">
                <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span class="btn-label">Batch</span>
            </button>
            <button class="comfy-mobile-form-cancel-btn" title="Cancel Current">
                <span class="btn-icon">⏹</span>
                <span class="btn-label">Cancel</span>
            </button>
        `;
        
        // Queue button
        this.#actionsContainer.querySelector('.comfy-mobile-form-queue-btn')?.addEventListener('click', async () => {
            await this.#queuePrompt(0);
        });
        
        // Batch queue button
        this.#actionsContainer.querySelector('.comfy-mobile-form-batch-btn')?.addEventListener('click', () => {
            this.#showBatchDialog();
        });
        
        // Cancel button
        this.#actionsContainer.querySelector('.comfy-mobile-form-cancel-btn')?.addEventListener('click', async () => {
            await this.#cancelExecution();
        });
    }

    /**
     * Show batch queue dialog
     */
    #showBatchDialog() {
        const overlay = document.createElement('div');
        overlay.classList.add('comfy-mobile-form-dialog-overlay');
        
        const dialog = document.createElement('div');
        dialog.classList.add('comfy-mobile-form-dialog');
        dialog.innerHTML = `
            <div class="comfy-mobile-form-dialog-header">
                <h3>Batch Queue</h3>
                <button class="comfy-mobile-form-dialog-close" aria-label="Close dialog">✕</button>
            </div>
            <div class="comfy-mobile-form-dialog-body">
                <div class="comfy-mobile-form-batch-field">
                    <label>Number of runs</label>
                    <input type="number" class="comfy-mobile-form-batch-count" min="1" max="100" value="4">
                </div>
                <div class="comfy-mobile-form-batch-field">
                    <label>
                        <input type="checkbox" class="comfy-mobile-form-batch-increment" checked>
                        Increment seed for each run
                    </label>
                </div>
                <div class="comfy-mobile-form-batch-info">
                    <small>Each run will be queued separately. If seed increment is enabled, seed widgets will be incremented by 1 for each run.</small>
                </div>
            </div>
            <div class="comfy-mobile-form-dialog-footer">
                <button class="comfy-mobile-form-dialog-btn secondary" data-action="cancel">Cancel</button>
                <button class="comfy-mobile-form-dialog-btn primary" data-action="queue">Queue Batch</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        const countInput = /** @type {HTMLInputElement} */ (dialog.querySelector('.comfy-mobile-form-batch-count'));
        const incrementCheckbox = /** @type {HTMLInputElement} */ (dialog.querySelector('.comfy-mobile-form-batch-increment'));
        
        countInput.focus();
        countInput.select();
        
        const close = () => overlay.remove();
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        
        dialog.querySelector('.comfy-mobile-form-dialog-close')?.addEventListener('click', close);
        dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
        
        dialog.querySelector('[data-action="queue"]')?.addEventListener('click', async () => {
            const count = parseInt(countInput.value, 10) || 1;
            const increment = incrementCheckbox.checked;
            close();
            await this.#runBatch(count, increment);
        });
        
        // Enter to submit
        countInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                dialog.querySelector('[data-action="queue"]')?.dispatchEvent(new Event('click'));
            } else if (e.key === 'Escape') {
                close();
            }
        });
    }

    /**
     * Run batch queue
     * @param {number} count - Number of runs
     * @param {boolean} incrementSeed - Whether to increment seed
     */
    async #runBatch(count, incrementSeed) {
        // Find all seed widgets in the graph
        const seedWidgets = [];
        if (incrementSeed && this.#app.graph?._nodes) {
            for (const node of this.#app.graph._nodes) {
                if (node.widgets) {
                    for (const widget of node.widgets) {
                        const name = widget.name?.toLowerCase() || '';
                        if (name === 'seed' || name === 'noise_seed') {
                            seedWidgets.push(widget);
                        }
                    }
                }
            }
        }
        
        // Store original seeds
        const originalSeeds = seedWidgets.map(w => w.value);
        
        // Queue each run
        for (let i = 0; i < count; i++) {
            // Increment seeds if enabled
            if (incrementSeed) {
                seedWidgets.forEach((widget, idx) => {
                    widget.value = originalSeeds[idx] + i;
                });
            }
            
            try {
                await this.#app.queuePrompt(0);
            } catch (e) {
                console.error(`[MobileForm] Batch run ${i + 1} failed:`, e);
            }
        }
        
        // Restore original seeds
        if (incrementSeed) {
            seedWidgets.forEach((widget, idx) => {
                widget.value = originalSeeds[idx];
            });
        }
        
        // Switch to outputs tab
        this.#switchTab('outputs');
    }
    
    /** @type {string} */
    #currentNodeName = '';
    
    /**
     * Setup status bar event listeners
     */
    #setupStatusListeners() {
        // Listen for execution events
        api.addEventListener('executing', (event) => {
            const nodeId = event.detail;
            if(nodeId) {
                this.#setStatus('executing');
                
                // Track timing for previous node
                if (this.#currentNodeIndex > 0) {
                    const nodeTime = Date.now() - (this.#nodeTimings[this.#nodeTimings.length - 1] || this.#executionStartTime);
                    this.#nodeTimings.push(nodeTime);
                }
                
                // Increment node index
                this.#currentNodeIndex++;
                
                // Get node name and store it
                const node = this.#app.graph?.getNodeById(nodeId);
                this.#currentNodeName = node?.title || node?.type || `Node ${nodeId}`;
                this.#setStatusText(`${this.#currentNodeName}`);
                
                // Update node count display
                this.#updateNodeCount();
                
                // Update ETA
                this.#updateETA();
                
                // Reset progress for new node
                this.#setProgress(0);
            }
        });
        
        api.addEventListener('execution_start', () => {
            this.#setStatus('running');
            this.#setStatusText('Starting workflow...');
            this.#setProgress(0);
            this.#currentNodeName = '';
            
            // Initialize execution tracking
            this.#executionStartTime = Date.now();
            this.#currentNodeIndex = 0;
            this.#nodeTimings = [];
            
            // Estimate total nodes from graph
            if (this.#app.graph?._nodes) {
                this.#totalNodes = this.#app.graph._nodes.length;
            }
            
            this.#updateNodeCount();
            this.#setETA('');
        });
        
        api.addEventListener('execution_cached', (event) => {
            const { nodes } = event.detail;
            if(nodes?.length) {
                // Count cached nodes in the total
                this.#currentNodeIndex += nodes.length;
                this.#setStatusText(`Cached: ${nodes.length} nodes`);
                this.#updateNodeCount();
            }
        });
        
        api.addEventListener('execution_error', (event) => {
            this.#setStatus('error');
            const errorMsg = event.detail?.exception_message || 'Unknown error';
            this.#setStatusText(`Error: ${errorMsg.substring(0, 50)}${errorMsg.length > 50 ? '...' : ''}`);
            this.#setProgress(0);
            this.#setETA('');
            this.#setNodeCount('');
        });
        
        api.addEventListener('status', (event) => {
            const status = event.detail;
            if(status?.exec_info?.queue_remaining === 0) {
                this.#setStatus('ready');
                
                // Calculate total time
                const totalTime = Date.now() - this.#executionStartTime;
                const formattedTime = this.#formatTime(totalTime);
                
                this.#setStatusText(`✓ Complete in ${formattedTime}`);
                this.#setProgress(100);
                this.#setETA('');
                this.#setNodeCount('');
                
                // Reset progress after a delay
                setTimeout(() => {
                    this.#setProgress(0);
                    this.#setStatusText('Ready');
                }, PROGRESS_RESET_DELAY);
            }
        });
        
        api.addEventListener('progress', (event) => {
            const { value, max } = event.detail;
            if(max) {
                const percent = Math.round((value / max) * 100);
                this.#setProgress(percent);
                // Show node name + percentage
                const nodeName = this.#currentNodeName || 'Processing';
                this.#setStatusText(`${nodeName} — ${percent}%`);
            }
        });
    }

    /**
     * Update the node count display
     */
    #updateNodeCount() {
        if (this.#totalNodes > 0 && this.#currentNodeIndex > 0) {
            this.#setNodeCount(`Node ${this.#currentNodeIndex}/${this.#totalNodes}`);
        } else {
            this.#setNodeCount('');
        }
    }

    /**
     * Update the ETA display based on node timings
     */
    #updateETA() {
        if (this.#nodeTimings.length < 2 || this.#currentNodeIndex >= this.#totalNodes) {
            this.#setETA('');
            return;
        }
        
        // Calculate average time per node
        const avgTime = this.#nodeTimings.reduce((a, b) => a + b, 0) / this.#nodeTimings.length;
        const remainingNodes = this.#totalNodes - this.#currentNodeIndex;
        const estimatedRemaining = avgTime * remainingNodes;
        
        if (estimatedRemaining > 1000) {
            this.#setETA(`~${this.#formatTime(estimatedRemaining)} left`);
        } else {
            this.#setETA('');
        }
    }

    /**
     * Format milliseconds to human-readable time
     * @param {number} ms
     * @returns {string}
     */
    #formatTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    /**
     * Set the node count display
     * @param {string} text
     */
    #setNodeCount(text) {
        const countEl = this.#statusBar.querySelector('.comfy-mobile-form-status-node-count');
        if (countEl) countEl.textContent = text;
    }

    /**
     * Set the ETA display
     * @param {string} text
     */
    #setETA(text) {
        const etaEl = this.#statusBar.querySelector('.comfy-mobile-form-status-eta');
        if (etaEl) etaEl.textContent = text;
    }
    
    /**
     * Set the status bar state
     * @param {'ready' | 'running' | 'executing' | 'error'} status
     */
    #setStatus(status) {
        this.#statusBar.dataset.status = status;
    }
    
    /**
     * Set the status text
     * @param {string} text
     */
    #setStatusText(text) {
        const textEl = this.#statusBar.querySelector('.comfy-mobile-form-status-text');
        if(textEl) textEl.textContent = text;
    }
    
    /**
     * Set the progress bar
     * @param {number} percent
     */
    #setProgress(percent) {
        const progressEl = this.#statusBar.querySelector('.comfy-mobile-form-status-progress');
        const fillEl = /** @type {HTMLElement | null} */ (this.#statusBar.querySelector('.comfy-mobile-form-status-progress-fill'));
        
        if (fillEl) fillEl.style.width = `${percent}%`;
        if (progressEl) progressEl.setAttribute('aria-valuenow', String(percent));
    }

    /**
     * Setup keyboard shortcuts
     * - Q: Queue prompt
     * - Shift+Q: Queue to front
     * - Escape: Close form / cancel dialogs
     * - Tab: Switch between Inputs/Outputs (when form is focused)
     * - E: Toggle edit mode
     */
    #setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when form is visible
            if (!this.#visible) return;
            
            // Don't handle shortcuts when typing in inputs
            const target = /** @type {HTMLElement} */ (e.target);
            const isTyping = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable;
            
            // Escape always works (even in inputs - to close dialogs)
            if (e.key === 'Escape') {
                // Close any open dialog first
                const dialog = document.querySelector('.comfy-mobile-form-dialog-overlay');
                if (dialog) {
                    dialog.remove();
                    return;
                }
                
                // Close context menu
                const contextMenu = document.querySelector('.comfy-mobile-form-context-menu');
                if (contextMenu) {
                    contextMenu.remove();
                    return;
                }
                
                // If editing, exit edit mode
                if (this.#editMode) {
                    this.#toggleEditMode();
                    return;
                }
                
                // Otherwise close the form
                this.hide();
                return;
            }
            
            // Other shortcuts don't work when typing
            if (isTyping) return;
            
            // Q - Queue prompt
            if (e.key === 'q' || e.key === 'Q') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+Q: Queue to front
                    this.#queuePrompt(-1);
                } else {
                    // Q: Normal queue
                    this.#queuePrompt(0);
                }
                return;
            }
            
            // Tab - Switch tabs (only when form element is focused)
            if (e.key === 'Tab' && this.#elem.contains(document.activeElement)) {
                e.preventDefault();
                const newTab = this.#activeTab === 'inputs' ? 'outputs' : 'inputs';
                this.#switchTab(newTab);
                return;
            }
            
            // E - Toggle edit mode
            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                this.#toggleEditMode();
                return;
            }
        });
    }
    
    /**
     * Queue the current workflow
     * @param {number} number - 0 for normal, -1 for front of queue
     */
    async #queuePrompt(number) {
        const queueBtn = this.#actionsContainer.querySelector('.comfy-mobile-form-queue-btn');
        if(queueBtn) {
            queueBtn.classList.add('loading');
            queueBtn.setAttribute('disabled', 'true');
        }
        
        try {
            // Use the app's queue prompt functionality
            await this.#app.queuePrompt(number);
            
            // Switch to outputs tab
            this.#switchTab('outputs');
        } catch(e) {
            console.error('[MobileForm] Queue error:', e);
            alert('Failed to queue prompt: ' + e.message);
        } finally {
            if(queueBtn) {
                queueBtn.classList.remove('loading');
                queueBtn.removeAttribute('disabled');
            }
        }
    }
    
    /**
     * Cancel current execution
     */
    async #cancelExecution() {
        try {
            await api.interrupt();
        } catch(e) {
            console.error('[MobileForm] Cancel error:', e);
        }
    }

    /**
     * Check if user is typing in an input field
     * @param {KeyboardEvent} e
     * @returns {boolean}
     */
    #isTypingInInput(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        return target.tagName === 'INPUT' || 
               target.tagName === 'TEXTAREA' || 
               target.isContentEditable;
    }

    /**
     * Filter widgets by search query
     * @param {string} query
     */
    #filterWidgets(query) {
        const widgets = this.#inputsContainer.querySelectorAll('.comfy-mobile-form-widget');
        const sections = this.#inputsContainer.querySelectorAll('.comfy-mobile-form-section');
        
        let matchCount = 0;
        
        widgets.forEach(widget => {
            const title = widget.querySelector('.comfy-mobile-form-widget-title')?.textContent?.toLowerCase() || '';
            const nodeType = widget.getAttribute('data-node-type')?.toLowerCase() || '';
            
            const matches = !query || title.includes(query) || nodeType.includes(query);
            
            if (matches) {
                widget.classList.remove('comfy-mobile-form-hidden');
                widget.classList.add('comfy-mobile-form-search-match');
                matchCount++;
            } else {
                widget.classList.add('comfy-mobile-form-hidden');
                widget.classList.remove('comfy-mobile-form-search-match');
            }
        });
        
        // Update section visibility based on whether they have visible widgets
        sections.forEach(section => {
            const visibleWidgets = section.querySelectorAll('.comfy-mobile-form-widget:not(.comfy-mobile-form-hidden)');
            if (visibleWidgets.length === 0 && query) {
                section.classList.add('comfy-mobile-form-hidden');
            } else {
                section.classList.remove('comfy-mobile-form-hidden');
            }
        });
        
        // Show/hide "no results" message
        let noResultsEl = this.#inputsContainer.querySelector('.comfy-mobile-form-no-results');
        if (matchCount === 0 && query) {
            if (!noResultsEl) {
                noResultsEl = document.createElement('div');
                noResultsEl.classList.add('comfy-mobile-form-no-results');
                noResultsEl.innerHTML = `
                    <div class="comfy-mobile-form-empty-state">
                        <div class="comfy-mobile-form-empty-state-icon">🔍</div>
                        <div class="comfy-mobile-form-empty-state-title">No matching widgets</div>
                        <div class="comfy-mobile-form-empty-state-description">
                            No widgets match "<strong>${this.#escapeHtml(query)}</strong>"
                        </div>
                    </div>
                `;
                this.#inputsContainer.appendChild(noResultsEl);
            }
        } else if (noResultsEl) {
            noResultsEl.remove();
        }
    }

    /**
     * Escape HTML for safe display
     * @param {string} text
     * @returns {string}
     */
    #escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Switch between input and output tabs
     * @param {'inputs' | 'outputs'} tab 
     */
    #switchTab(tab) {
        this.#activeTab = tab;
        
        // Update tab buttons
        this.#header.querySelectorAll('.comfy-mobile-form-tab').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });
        
        // Show/hide containers
        if(tab === 'inputs') {
            this.#inputsContainer.classList.remove('comfy-mobile-form-hidden');
            this.#outputsContainer.classList.add('comfy-mobile-form-hidden');
        } else {
            this.#inputsContainer.classList.add('comfy-mobile-form-hidden');
            this.#outputsContainer.classList.remove('comfy-mobile-form-hidden');
        }
    }
    
    /**
     * Update the outputs tab badge
     */
    #updateOutputsBadge() {
        // Could add a badge showing number of outputs
        const outputTab = this.#header.querySelector('.comfy-mobile-form-tab[data-tab="outputs"]');
        if(outputTab && this.#outputsManager) {
            // Flash the tab to indicate new content
            outputTab.classList.add('has-updates');
            setTimeout(() => outputTab.classList.remove('has-updates'), 500);
        }
    }
    
    /**
     * Toggle edit mode for drag/drop reordering
     */
    #toggleEditMode() {
        this.#editMode = !this.#editMode;
        
        const editBtn = this.#header.querySelector('.comfy-mobile-form-edit-btn');
        
        if(this.#editMode) {
            this.#elem.classList.add('comfy-mobile-form-edit-mode');
            editBtn?.classList.add('active');
            const editLabel = editBtn?.querySelector('.edit-label');
            if(editLabel) editLabel.textContent = 'Done';
            this.#enableDragDrop();
        } else {
            this.#elem.classList.remove('comfy-mobile-form-edit-mode');
            editBtn?.classList.remove('active');
            const editLabel = editBtn?.querySelector('.edit-label');
            if(editLabel) editLabel.textContent = 'Edit';
            this.#disableDragDrop();
            this.#saveCurrentOrder();
        }
    }
    
    /**
     * Enable drag and drop on all widgets
     */
    #enableDragDrop() {
        const widgets = this.#inputsContainer.querySelectorAll('.comfy-mobile-form-widget');
        
        widgets.forEach((widget, index) => {
            widget.setAttribute('draggable', 'true');
            widget.classList.add('comfy-mobile-form-draggable');
            
            widget.addEventListener('dragstart', this.#handleDragStart.bind(this));
            widget.addEventListener('dragend', this.#handleDragEnd.bind(this));
            widget.addEventListener('dragover', this.#handleDragOver.bind(this));
            widget.addEventListener('dragenter', this.#handleDragEnter.bind(this));
            widget.addEventListener('dragleave', this.#handleDragLeave.bind(this));
            widget.addEventListener('drop', this.#handleDrop.bind(this));
        });
    }
    
    /**
     * Disable drag and drop
     */
    #disableDragDrop() {
        const widgets = this.#inputsContainer.querySelectorAll('.comfy-mobile-form-widget');
        
        widgets.forEach(widget => {
            widget.setAttribute('draggable', 'false');
            widget.classList.remove('comfy-mobile-form-draggable', 'comfy-mobile-form-drag-over');
        });
    }
    
    /**
     * @param {DragEvent} e 
     */
    #handleDragStart(e) {
        const target = /** @type {HTMLElement} */ (e.currentTarget);
        this.#draggedElement = target;
        target.classList.add('comfy-mobile-form-dragging');
        
        // Set drag data
        e.dataTransfer?.setData('text/plain', target.dataset.nodeId || '');
        if(e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
        }
        
        // Slight delay to allow drag image to form
        setTimeout(() => {
            target.classList.add('comfy-mobile-form-drag-ghost');
        }, 0);
    }
    
    /**
     * @param {DragEvent} e 
     */
    #handleDragEnd(e) {
        const target = /** @type {HTMLElement} */ (e.currentTarget);
        target.classList.remove('comfy-mobile-form-dragging', 'comfy-mobile-form-drag-ghost');
        this.#draggedElement = null;
        
        // Remove all drag-over states
        this.#inputsContainer.querySelectorAll('.comfy-mobile-form-drag-over').forEach(el => {
            el.classList.remove('comfy-mobile-form-drag-over');
        });
    }
    
    /**
     * @param {DragEvent} e 
     */
    #handleDragOver(e) {
        e.preventDefault();
        if(e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
        
        // Update drop position indicator as cursor moves
        const target = /** @type {HTMLElement} */ (e.currentTarget);
        if(target !== this.#draggedElement && target.classList.contains('comfy-mobile-form-drag-over')) {
            this.#updateDropPosition(e, target);
        }
    }
    
    /**
     * @param {DragEvent} e 
     */
    #handleDragEnter(e) {
        e.preventDefault();
        const target = /** @type {HTMLElement} */ (e.currentTarget);
        if(target !== this.#draggedElement) {
            target.classList.add('comfy-mobile-form-drag-over');
            this.#updateDropPosition(e, target);
        }
    }
    
    /**
     * @param {DragEvent} e 
     */
    #handleDragLeave(e) {
        const target = /** @type {HTMLElement} */ (e.currentTarget);
        target.classList.remove('comfy-mobile-form-drag-over', 'drop-before', 'drop-after');
    }
    
    /**
     * Update drop position indicator based on cursor position
     * @param {DragEvent} e 
     * @param {HTMLElement} target 
     */
    #updateDropPosition(e, target) {
        const targetRect = target.getBoundingClientRect();
        const dropX = e.clientX;
        const targetCenter = targetRect.left + targetRect.width / 2;
        
        target.classList.remove('drop-before', 'drop-after');
        
        if(dropX < targetCenter) {
            target.classList.add('drop-before');
        } else {
            target.classList.add('drop-after');
        }
    }
    
    /**
     * @param {DragEvent} e 
     */
    #handleDrop(e) {
        e.preventDefault();
        const target = /** @type {HTMLElement} */ (e.currentTarget);
        const dropBefore = target.classList.contains('drop-before');
        target.classList.remove('comfy-mobile-form-drag-over', 'drop-before', 'drop-after');
        
        if(this.#draggedElement && target !== this.#draggedElement) {
            if(dropBefore) {
                // Insert before target
                target.parentNode?.insertBefore(this.#draggedElement, target);
            } else {
                // Insert after target
                target.parentNode?.insertBefore(this.#draggedElement, target.nextSibling);
            }
            
            // Update the order array
            this.#updateOrderFromDOM();
        }
    }
    
    /**
     * Update current order from DOM positions
     */
    #updateOrderFromDOM() {
        const widgets = this.#inputsContainer.querySelectorAll('.comfy-mobile-form-widget');
        this.#currentNodeOrder = [];
        
        widgets.forEach(widget => {
            const nodeId = parseInt(/** @type {HTMLElement} */ (widget).dataset.nodeId || '0', 10);
            if(nodeId) {
                this.#currentNodeOrder.push(nodeId);
            }
        });
    }
    
    /**
     * Save the current widget order
     */
    #saveCurrentOrder() {
        if(this.#currentNodeOrder.length > 0) {
            saveWidgetOrder(this.#currentNodeOrder);
        }
    }

    toggleVisible() {
        this.#visible = !this.#visible;
        if(this.#visible) {
            this.#elem.classList.remove("comfy-mobile-form-hidden");

            // Refresh when showing
            this.setGraph(this.#app.graph);
        } else {
            this.#elem.classList.add("comfy-mobile-form-hidden");
        }
    }
    
    /**
     * Show the form
     */
    show() {
        if(!this.#visible) {
            this.toggleVisible();
        }
    }
    
    /**
     * Hide the form
     */
    hide() {
        if(this.#visible) {
            this.toggleVisible();
        }
    }
    
    /**
     * Set the mode (mobile/desktop)
     * @param {'mobile' | 'desktop'} mode 
     */
    setMode(mode) {
        this.#elem.classList.remove(`comfy-mobile-form-${this.#mode}`);
        this.#mode = mode;
        this.#elem.classList.add(`comfy-mobile-form-${this.#mode}`);
    }

    /**
     * @param {ComfyUIGraph} graph 
     */
    setGraph(graph) {
        if(!graph || !graph._groups) return;
        
        // Set graph reference for widget settings persistence
        setCurrentGraph(graph);
        
        // Find input groups
        const inputGroup = graph._groups.find((g) => INPUT_GROUP_PATTERN.test(g.title));
        
        // Find output groups - prefer "Mobile Outputs" specifically
        const mobileOutputGroup = graph._groups.find((g) => MOBILE_OUTPUT_GROUP_PATTERN.test(g.title));
        const outputGroup = graph._groups.find((g) => OUTPUT_GROUP_PATTERN.test(g.title));
        
        // Process inputs
        if(inputGroup) {
            const inputNodes = graph._nodes.filter((n) => isGroupContainingNode(inputGroup, n));
            
            // Find subgroups within the input group
            const subgroups = findSubgroupsInGroup(inputGroup, graph._groups);
            
            // Build section info for each subgroup
            /** @type {Array<{group: ComfyUIGraphGroup, title: string, color: string, nodes: ComfyUIGraphNode[]}>} */
            const sections = subgroups.map((subgroup, index) => {
                const subgroupNodes = inputNodes.filter(n => isGroupContainingNode(subgroup, n));
                const color = SUBGROUP_COLORS[index % SUBGROUP_COLORS.length];
                return {
                    group: subgroup,
                    title: subgroup.title,
                    color,
                    nodes: subgroupNodes
                };
            });
            
            // Find nodes not in any subgroup
            const nodesInSubgroups = new Set(sections.flatMap(s => s.nodes.map(n => n.id)));
            const ungroupedNodes = inputNodes.filter(n => !nodesInSubgroups.has(n.id));
            
            this.#renderInputs(inputNodes, sections, ungroupedNodes);
        } else {
            this.#inputsContainer.innerHTML = `
                <div class="comfy-mobile-form-empty-state">
                    <div class="comfy-mobile-form-empty-state-icon">📋</div>
                    <div class="comfy-mobile-form-empty-state-title">No Form Group Found</div>
                    <div class="comfy-mobile-form-empty-state-description">
                        Create a group in your workflow to define which nodes appear in the form.
                    </div>
                    <div class="comfy-mobile-form-empty-state-hint">
                        <div class="comfy-mobile-form-empty-state-hint-item">Right-click on canvas → Add Group</div>
                        <div class="comfy-mobile-form-empty-state-hint-item">Name it <strong style="color: var(--mf-accent)">"Mobile Form"</strong></div>
                        <div class="comfy-mobile-form-empty-state-hint-item">Place your input nodes inside</div>
                    </div>
                </div>
            `;
        }
        
        // Process outputs - if "Mobile Outputs" group exists, render those nodes as widgets
        if(mobileOutputGroup) {
            // Get ALL nodes in the output group
            const nodesInGroup = graph._nodes.filter((n) => isGroupContainingNode(mobileOutputGroup, n));
            
            // Render output nodes as widgets
            this.#outputsManager?.setOutputNodes(nodesInGroup);
            
            // Also track these nodes for generated output filtering
            const nodeIds = nodesInGroup.map(n => n.id);
            this.#outputsManager?.setTrackedNodes(nodeIds);
        } else if(outputGroup) {
            // Legacy behavior - show all outputs (empty array = no filtering)
            this.#outputsManager?.setOutputNodes([]);
            this.#outputsManager?.setTrackedNodes([]);
        } else {
            // No output group - show all outputs
            this.#outputsManager?.setOutputNodes([]);
            this.#outputsManager?.setTrackedNodes([]);
        }
    }
    
    
    /**
     * Render input widgets into sections based on subgroups
     * @param {ComfyUIGraphNode[]} allNodes - All nodes in the form
     * @param {Array<{group: ComfyUIGraphGroup, title: string, color: string, nodes: ComfyUIGraphNode[]}>} sections - Subgroup sections
     * @param {ComfyUIGraphNode[]} ungroupedNodes - Nodes not in any subgroup
     */
    #renderInputs(allNodes, sections = [], ungroupedNodes = []) {
        this.#inputsContainer.innerHTML = '';
        
        if(allNodes.length === 0) {
            this.#inputsContainer.innerHTML = `
                <div class="comfy-mobile-form-empty-state">
                    <div class="comfy-mobile-form-empty-state-icon">🔧</div>
                    <div class="comfy-mobile-form-empty-state-title">Empty Form Group</div>
                    <div class="comfy-mobile-form-empty-state-description">
                        Add nodes to your "Mobile Form" group to create form inputs.
                    </div>
                    <div class="comfy-mobile-form-empty-state-hint">
                        <div class="comfy-mobile-form-empty-state-hint-item">Primitives (numbers, text, etc.)</div>
                        <div class="comfy-mobile-form-empty-state-hint-item">Load Image / Load Video nodes</div>
                        <div class="comfy-mobile-form-empty-state-hint-item">KSampler and other processing nodes</div>
                    </div>
                </div>
            `;
            return;
        }
        
        // Store current order (all nodes)
        this.#currentNodeOrder = allNodes.map(n => n.id);
        
        // If we have sections, render them with headers
        if(sections.length > 0) {
            // Render each section
            for(const section of sections) {
                if(section.nodes.length === 0) continue;
                
                // Create section container
                const sectionElem = document.createElement('div');
                sectionElem.classList.add('comfy-mobile-form-section');
                sectionElem.dataset.color = section.color;
                sectionElem.dataset.sectionId = section.title.toLowerCase().replace(/\s+/g, '-');
                
                // Check if section is collapsed (from localStorage)
                const isCollapsed = this.#getSectionCollapsed(section.title);
                if (isCollapsed) {
                    sectionElem.classList.add('collapsed');
                }
                
                // Create section header with collapse toggle
                const headerElem = document.createElement('div');
                headerElem.classList.add('comfy-mobile-form-section-header');
                headerElem.innerHTML = `
                    <span class="comfy-mobile-form-section-toggle">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="comfy-mobile-form-section-title" title="Double-click to rename">${section.title}</span>
                    <span class="comfy-mobile-form-section-count">${section.nodes.length}</span>
                `;
                
                // Add click handler for collapse/expand
                headerElem.style.cursor = 'pointer';
                headerElem.addEventListener('click', () => {
                    const collapsed = sectionElem.classList.toggle('collapsed');
                    const toggle = headerElem.querySelector('.comfy-mobile-form-section-toggle');
                    if (toggle) toggle.textContent = collapsed ? '▶' : '▼';
                    this.#setSectionCollapsed(section.title, collapsed);
                });
                
                // Add double-click to rename section (renames the underlying group)
                const titleElem = headerElem.querySelector('.comfy-mobile-form-section-title');
                if (titleElem && section.group) {
                    titleElem.style.cursor = 'text';
                    titleElem.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        showRenameDialog(section.group.title, 'Group', (newTitle) => {
                            section.group.title = newTitle;
                            titleElem.textContent = newTitle;
                            // Update section ID
                            sectionElem.dataset.sectionId = newTitle.toLowerCase().replace(/\s+/g, '-');
                            // Trigger graph change
                            if (this.#app.graph) {
                                this.#app.graph.setDirtyCanvas?.(true, true);
                            }
                        });
                    });
                }
                
                sectionElem.appendChild(headerElem);
                
                // Create section content (grid container)
                const contentElem = document.createElement('div');
                contentElem.classList.add('comfy-mobile-form-section-content');
                
                // Sort nodes within section by position
                const sortedNodes = sortNodesByPosition(section.nodes);
                
                // Render widgets into section
                for(const graph_node of sortedNodes) {
                    const elem = document.createElement('div');
                    
                    if(createWidgetFromNode(elem, graph_node)) {
                        // Mark widget as being in a section and apply section color
                        elem.dataset.inSection = "true";
                        elem.dataset.sectionColor = section.color;
                        elem.dataset.color = section.color;
                        contentElem.appendChild(elem);
                    }
                }
                
                sectionElem.appendChild(contentElem);
                this.#inputsContainer.appendChild(sectionElem);
            }
            
            // Render ungrouped nodes at the end (if any)
            if(ungroupedNodes.length > 0) {
                const sectionElem = document.createElement('div');
                sectionElem.classList.add('comfy-mobile-form-section');
                sectionElem.dataset.sectionId = 'other';
                
                const isCollapsed = this.#getSectionCollapsed('Other');
                if (isCollapsed) {
                    sectionElem.classList.add('collapsed');
                }
                
                const headerElem = document.createElement('div');
                headerElem.classList.add('comfy-mobile-form-section-header');
                headerElem.innerHTML = `
                    <span class="comfy-mobile-form-section-toggle">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="comfy-mobile-form-section-title">Other</span>
                    <span class="comfy-mobile-form-section-count">${ungroupedNodes.length}</span>
                `;
                
                headerElem.style.cursor = 'pointer';
                headerElem.addEventListener('click', () => {
                    const collapsed = sectionElem.classList.toggle('collapsed');
                    const toggle = headerElem.querySelector('.comfy-mobile-form-section-toggle');
                    if (toggle) toggle.textContent = collapsed ? '▶' : '▼';
                    this.#setSectionCollapsed('Other', collapsed);
                });
                
                // "Other" section can't be renamed (no backing group)
                
                sectionElem.appendChild(headerElem);
                
                const contentElem = document.createElement('div');
                contentElem.classList.add('comfy-mobile-form-section-content');
                
                const sortedUngrouped = sortNodesByPosition(ungroupedNodes);
                for(const graph_node of sortedUngrouped) {
                    const elem = document.createElement('div');
                    
                    if(createWidgetFromNode(elem, graph_node)) {
                        contentElem.appendChild(elem);
                    }
                }
                
                sectionElem.appendChild(contentElem);
                this.#inputsContainer.appendChild(sectionElem);
            }
        } else {
            // No sections - render all nodes in a single flowing grid
            const sortedNodes = sortNodesByPosition(allNodes);
            for(const graph_node of sortedNodes) {
                const elem = document.createElement('div');
                
                if(createWidgetFromNode(elem, graph_node)) {
                    this.#inputsContainer.appendChild(elem);
                }
            }
        }
    }
    
    /**
     * Get section collapsed state from localStorage
     * @param {string} sectionTitle 
     * @returns {boolean}
     */
    #getSectionCollapsed(sectionTitle) {
        try {
            const key = `mobileform-section-collapsed-${sectionTitle.toLowerCase().replace(/\s+/g, '-')}`;
            return localStorage.getItem(key) === 'true';
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Set section collapsed state in localStorage
     * @param {string} sectionTitle 
     * @param {boolean} collapsed 
     */
    #setSectionCollapsed(sectionTitle, collapsed) {
        try {
            const key = `mobileform-section-collapsed-${sectionTitle.toLowerCase().replace(/\s+/g, '-')}`;
            if (collapsed) {
                localStorage.setItem(key, 'true');
            } else {
                localStorage.removeItem(key);
            }
        } catch (e) {
            // Ignore localStorage errors
        }
    }
}

/**
 * @param {ComfyUIGraphGroup} group
 * @param {ComfyUIGraphNode} node
 * @returns {boolean}
 */
function isGroupContainingNode(group, node) {
    const [nx, ny] = node.pos;
    const [x, y, w, h] = group._bounding;

    return x <= nx && nx <= x+w && y <= ny && ny <= y+h;
}

/**
 * Sort nodes by position for natural flow (Y first, then X)
 * @param {Array<ComfyUIGraphNode>} nodes
 * @returns {Array<ComfyUIGraphNode>}
 */
function sortNodesByPosition(nodes) {
    if(nodes.length === 0) return [];
    
    // Group by approximate Y position (row detection)
    const ROW_THRESHOLD = 30;
    const sortedByY = [...nodes].sort((a, b) => a.pos[1] - b.pos[1]);
    
    // Group into rows
    const rows = [];
    let currentRow = [sortedByY[0]];
    let lastY = sortedByY[0].pos[1];
    
    for(let i = 1; i < sortedByY.length; i++) {
        const node = sortedByY[i];
        if(node.pos[1] - lastY >= ROW_THRESHOLD) {
            // New row
            rows.push(currentRow);
            currentRow = [node];
            lastY = node.pos[1];
        } else {
            currentRow.push(node);
        }
    }
    rows.push(currentRow);
    
    // Sort each row by X position, then flatten
    const result = [];
    for(const row of rows) {
        row.sort((a, b) => a.pos[0] - b.pos[0]);
        result.push(...row);
    }
    
    return result;
}

/**
 * Find groups that are contained within a parent group (subgroups)
 * @param {ComfyUIGraphGroup} parentGroup - The parent group
 * @param {ComfyUIGraphGroup[]} allGroups - All groups in the graph
 * @returns {ComfyUIGraphGroup[]} - Subgroups sorted by position
 */
function findSubgroupsInGroup(parentGroup, allGroups) {
    const [px, py, pw, ph] = parentGroup._bounding;
    
    const subgroups = allGroups.filter(g => {
        // Skip the parent group itself
        if(g === parentGroup) return false;
        
        // Skip if it matches the input/output group patterns (these are not subgroups)
        if(INPUT_GROUP_PATTERN.test(g.title) || OUTPUT_GROUP_PATTERN.test(g.title)) return false;
        
        // Check if this group is entirely within the parent
        const [gx, gy, gw, gh] = g._bounding;
        return gx >= px && gy >= py && (gx + gw) <= (px + pw) && (gy + gh) <= (py + ph);
    });
    
    // Sort subgroups by Y position first, then X position
    subgroups.sort((a, b) => {
        const yDiff = a._bounding[1] - b._bounding[1];
        if(Math.abs(yDiff) > 30) return yDiff;
        return a._bounding[0] - b._bounding[0];
    });
    
    return subgroups;
}

