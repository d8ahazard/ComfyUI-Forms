// @ts-check

// @ts-ignore
import { api } from "../../scripts/api.js";
import { ExtensionRegistry, createAudioPlayer, getViewUrl } from './extensions/index.js';
import { createWidgetFromNode, showConfirmDialog } from './widget.js';

/** @import {ComfyUIGraphNode} from "./types" */

/**
 * Get all supported output node types from registry + defaults
 * @returns {string[]}
 */
export function getOutputNodeTypes() {
    const registryTypes = ExtensionRegistry.getOutputNodeTypes();
    // Include legacy types that might not be registered
    const legacyTypes = [
        'ADE_AnimateDiffCombine',
        'CR Image Output',
    ];
    return [...new Set([...registryTypes, ...legacyTypes])];
}

/**
 * Supported output node types (legacy export for backwards compatibility)
 * @deprecated Use getOutputNodeTypes() instead
 */
export const OUTPUT_NODE_TYPES = [
    'PreviewImage',
    'SaveImage',
    'VHS_VideoCombine',
    'ADE_AnimateDiffCombine',
    'SaveAnimatedWEBP',
    'SaveAnimatedPNG',
    'CR Image Output',
    'PreviewVideo',
    'SaveVideo',
    'PreviewAudio',
    'SaveAudio',
    'SaveAudioMP3',
    'SaveAudioOpus',
    'MaskPreview',
];

/**
 * @typedef {Object} OutputItem
 * @property {'image' | 'video' | 'gif' | 'audio'} type
 * @property {string} filename
 * @property {string} subfolder
 * @property {string} format
 * @property {number} nodeId
 * @property {string} nodeTitle
 */

/**
 * Class to manage output displays
 */
export class OutputsManager {
    /** @type {HTMLDivElement} */
    #container;
    
    /** @type {OutputItem[]} */
    #outputs = [];
    
    /** @type {Map<number, OutputItem[]>} */
    #nodeOutputs = new Map();
    
    /** @type {boolean} */
    #isExecuting = false;
    
    /** @type {Function|null} */
    #onUpdate = null;
    
    /** @type {Set<number>} */
    #trackedNodeIds = new Set();
    
    /** @type {ComfyUIGraphNode[]} */
    #outputNodes = [];
    
    /** @type {HTMLDivElement|null} */
    #widgetsContainer = null;

    /** @type {Map<string, Function>} */
    #eventListeners = new Map();

    /**
     * @param {HTMLDivElement} container 
     */
    constructor(container) {
        this.#container = container;
        this.#container.classList.add('comfy-mobile-form-outputs');
        this.#setupEventListeners();
        this.render();
    }

    /**
     * Cleanup event listeners and resources
     */
    destroy() {
        // Remove all API event listeners
        for (const [eventName, listener] of this.#eventListeners) {
            api.removeEventListener(eventName, listener);
        }
        this.#eventListeners.clear();
        this.#outputs = [];
        this.#nodeOutputs.clear();
        this.#container.innerHTML = '';
    }
    
    /**
     * Set the output nodes to render as widgets
     * @param {ComfyUIGraphNode[]} nodes 
     */
    setOutputNodes(nodes) {
        this.#outputNodes = nodes;
        // Check for cached outputs on these nodes
        this.#loadCachedOutputs(nodes);
        this.render();
    }
    
    /**
     * Load cached outputs from nodes that have them
     * @param {ComfyUIGraphNode[]} nodes
     */
    #loadCachedOutputs(nodes) {
        for (const node of nodes) {
            const nodeId = node.id;
            const nodeTitle = node.title || node.type || `Node ${nodeId}`;
            
            // Check node.images (standard output format)
            if (node.images && Array.isArray(node.images) && node.images.length > 0) {
                for (const img of node.images) {
                    // Check if we already have this output
                    const exists = this.#outputs.some(o => 
                        o.filename === img.filename && o.nodeId === nodeId
                    );
                    if (!exists) {
                        this.#outputs.push({
                            type: 'image',
                            filename: img.filename,
                            subfolder: img.subfolder || '',
                            format: img.type || 'output',
                            nodeId: nodeId,
                            nodeTitle: nodeTitle
                        });
                    }
                }
            }
            
            // Check node.imgs (alternative format used by some nodes)
            // @ts-ignore
            if (node.imgs && Array.isArray(node.imgs) && node.imgs.length > 0) {
                // @ts-ignore
                for (const img of node.imgs) {
                    if (img.src) {
                        // This is an HTMLImageElement, extract URL
                        const exists = this.#outputs.some(o => 
                            o.filename === img.src && o.nodeId === nodeId
                        );
                        if (!exists) {
                            this.#outputs.push({
                                type: 'image',
                                filename: img.src,
                                subfolder: '',
                                format: 'url',
                                nodeId: nodeId,
                                nodeTitle: nodeTitle
                            });
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Set the node IDs to track for outputs
     * If empty, all outputs will be shown
     * @param {number[]} nodeIds 
     */
    setTrackedNodes(nodeIds) {
        this.#trackedNodeIds = new Set(nodeIds);
        // Try to load recent outputs from history
        this.#loadFromHistory();
    }
    
    /**
     * Load outputs from ComfyUI history API
     */
    async #loadFromHistory() {
        try {
            const response = await fetch('/history?max_items=1');
            if (!response.ok) return;
            
            const history = await response.json();
            const promptIds = Object.keys(history);
            if (promptIds.length === 0) return;
            
            // Get the most recent prompt's outputs
            const latestPrompt = history[promptIds[0]];
            const outputs = latestPrompt?.outputs;
            if (!outputs) return;
            
            
            for (const [nodeIdStr, nodeOutput] of Object.entries(outputs)) {
                const nodeId = parseInt(nodeIdStr, 10);
                
                // Debug: log the output structure
                
                // Check if this node should be tracked
                if (!this.#shouldTrackNode(nodeId)) continue;
                
                // Get node title from graph if available
                let nodeTitle = `Node ${nodeId}`;
                try {
                    // @ts-ignore
                    const { app } = await import("../../scripts/app.js");
                    const node = app.graph?.getNodeById(nodeId);
                    if (node) {
                        nodeTitle = node.title || node.type || nodeTitle;
                    }
                } catch(e) {}
                
                // Process images - check extension to determine if it's actually a video/gif
                // Also check animated flag to treat as video
                const hasAnimatedFlag = nodeOutput.animated && Array.isArray(nodeOutput.animated) && 
                    nodeOutput.animated.some(a => a === true);
                    
                if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
                    for (const img of nodeOutput.images) {
                        const exists = this.#outputs.some(o => 
                            o.filename === img.filename && o.nodeId === nodeId
                        );
                        if (!exists) {
                            const filename = img.filename;
                            const ext = String(filename).toLowerCase().split('.').pop();
                            // Video extensions (webp excluded - can be static)
                            const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '');
                            const isGif = ext === 'gif';
                            const isWebp = ext === 'webp';
                            
                            // Determine type based on extension and animated flag
                            /** @type {'image' | 'video' | 'gif'} */
                            let outputType = 'image';
                            if (isVideo) {
                                outputType = 'video';
                            } else if (isGif) {
                                outputType = 'gif';
                            } else if ((isWebp || ext === 'png') && hasAnimatedFlag) {
                                // Animated webp/apng treated as video
                                outputType = 'video';
                            }
                            
                            this.#outputs.push({
                                type: outputType,
                                filename: img.filename,
                                subfolder: img.subfolder || '',
                                format: img.type || 'output',
                                nodeId: nodeId,
                                nodeTitle: nodeTitle
                            });
                        }
                    }
                }
                
                // Process gifs
                if (nodeOutput.gifs && Array.isArray(nodeOutput.gifs)) {
                    for (const gif of nodeOutput.gifs) {
                        const exists = this.#outputs.some(o => 
                            o.filename === gif.filename && o.nodeId === nodeId
                        );
                        if (!exists) {
                            this.#outputs.push({
                                type: 'gif',
                                filename: gif.filename,
                                subfolder: gif.subfolder || '',
                                format: gif.format || 'output',
                                nodeId: nodeId,
                                nodeTitle: nodeTitle
                            });
                        }
                    }
                }
                
                // Process video (single object)
                if (nodeOutput.video) {
                    const video = nodeOutput.video;
                    const filename = video.filename || video;
                    const exists = this.#outputs.some(o => 
                        o.filename === filename && o.nodeId === nodeId
                    );
                    if (!exists) {
                        this.#outputs.push({
                            type: 'video',
                            filename: filename,
                            subfolder: video.subfolder || '',
                            format: video.type || video.format || 'output',
                            nodeId: nodeId,
                            nodeTitle: nodeTitle
                        });
                    }
                }
                
                // Process videos array (SaveVideo format)
                if (nodeOutput.videos && Array.isArray(nodeOutput.videos)) {
                    for (const video of nodeOutput.videos) {
                        const filename = video.filename || video;
                        const exists = this.#outputs.some(o => 
                            o.filename === filename && o.nodeId === nodeId
                        );
                        if (!exists) {
                            this.#outputs.push({
                                type: 'video',
                                filename: filename,
                                subfolder: video.subfolder || '',
                                format: video.type || video.format || 'output',
                                nodeId: nodeId,
                                nodeTitle: nodeTitle
                            });
                        }
                    }
                }
                
                // Process animated array (if it's boolean flags, check images for actual animated content)
                // Some nodes use `animated: [true]` as a flag, others use `animated: [{filename, subfolder, type}]`
                // Note: When animated is a boolean flag, the images array is already processed above
                // with the hasAnimatedFlag check, so we only need to handle object-based animated items here
                if (nodeOutput.animated && Array.isArray(nodeOutput.animated)) {
                    for (const anim of nodeOutput.animated) {
                        // Skip boolean flags - they're handled in the images processing above
                        if (typeof anim === 'boolean') {
                            break;
                        } else if (typeof anim === 'object' && anim.filename) {
                            // It's an actual animated file object
                            const filename = anim.filename;
                            const exists = this.#outputs.some(o => 
                                o.filename === filename && o.nodeId === nodeId
                            );
                            if (!exists) {
                                const ext = String(filename).toLowerCase().split('.').pop();
                                const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '');
                                const isGif = ext === 'gif';
                                
                                /** @type {OutputItem} */
                                const outputItem = {
                                    type: /** @type {'video' | 'image' | 'gif'} */ (isVideo ? 'video' : (isGif ? 'gif' : 'image')),
                                    filename: filename,
                                    subfolder: anim.subfolder || '',
                                    format: anim.type || 'output',
                                    nodeId: nodeId,
                                    nodeTitle: nodeTitle
                                };
                                this.#outputs.push(outputItem);
                            }
                        }
                    }
                }
            }
            
            // Re-render if we found outputs
            if (this.#outputs.length > 0) {
                this.render();
                this.#onUpdate?.();
            }
        } catch(e) {
            console.warn('[MobileForm Outputs] Could not load history:', e);
        }
    }
    
    /**
     * Check if a node should be tracked
     * @param {number} nodeId 
     * @returns {boolean}
     */
    #shouldTrackNode(nodeId) {
        // If no specific nodes are tracked, show all outputs
        if (this.#trackedNodeIds.size === 0) return true;
        // Convert to number for comparison (API may return string)
        const numericId = typeof nodeId === 'string' ? parseInt(nodeId, 10) : nodeId;
        return this.#trackedNodeIds.has(numericId);
    }
    
    /**
     * Set callback for when outputs update
     * @param {Function} callback 
     */
    onUpdate(callback) {
        this.#onUpdate = callback;
    }
    
    /**
     * Add an API event listener and store it for cleanup
     * @param {string} eventName 
     * @param {Function} handler 
     */
    #addApiListener(eventName, handler) {
        api.addEventListener(eventName, handler);
        this.#eventListeners.set(eventName, handler);
    }

    /**
     * Setup API event listeners
     */
    #setupEventListeners() {
        // Listen for execution events
        this.#addApiListener('executing', (event) => {
            const nodeId = event.detail;
            if(nodeId) {
                this.#isExecuting = true;
                this.setExecutingStatus(nodeId);
            }
        });
        
        this.#addApiListener('executed', (event) => {
            const { node, output } = event.detail;
            if(output) {
                this.#handleNodeOutput(node, output);
            }
        });
        
        this.#addApiListener('execution_start', () => {
            this.#isExecuting = true;
            this.clearOutputs();
            this.setStatus('Running workflow...');
        });
        
        this.#addApiListener('execution_cached', (event) => {
            // Handle cached outputs
            const { nodes } = event.detail;
            if(nodes) {
                for(const nodeId of nodes) {
                    this.#checkCachedOutput(nodeId);
                }
            }
        });
        
        this.#addApiListener('execution_error', (event) => {
            this.#isExecuting = false;
            this.setStatus('Error: ' + (event.detail?.exception_message || 'Unknown error'));
        });
        
        this.#addApiListener('status', (event) => {
            const status = event.detail;
            if(status?.exec_info?.queue_remaining === 0 && this.#isExecuting) {
                this.#isExecuting = false;
                if(this.#outputs.length === 0) {
                    this.setStatus('Complete - No outputs generated');
                } else {
                    this.setStatus(`Complete - ${this.#outputs.length} output(s)`);
                }
            }
        });
        
        this.#addApiListener('progress', (event) => {
            const { value, max, node } = event.detail;
            if(node && max) {
                const percent = Math.round((value / max) * 100);
                this.setProgress(percent, node);
            }
        });
    }
    
    /**
     * Check for cached output on a node
     * @param {number} nodeId 
     */
    async #checkCachedOutput(nodeId) {
        // Check if this node should be tracked
        if (!this.#shouldTrackNode(nodeId)) return;
        
        // Access cached outputs through app
        try {
            // @ts-ignore
            const app = (await import("../../scripts/app.js")).app;
            const node = app.graph.getNodeById(nodeId);
            
            if(node && node.images && Array.isArray(node.images)) {
                for(const img of node.images) {
                    this.#addOutput({
                        type: 'image',
                        filename: img.filename,
                        subfolder: img.subfolder || '',
                        format: 'image',
                        nodeId: nodeId,
                        nodeTitle: node.title || node.type || `Node ${nodeId}`
                    });
                }
            }
        } catch(e) {
            console.warn('[MobileForm] Could not check cached output:', e);
        }
    }
    
    /**
     * Handle output from a node execution
     * @param {number} nodeId 
     * @param {any} output 
     */
    #handleNodeOutput(nodeId, output) {
        // Check if this node should be tracked
        if (!this.#shouldTrackNode(nodeId)) return;
        
        // @ts-ignore
        import("../../scripts/app.js").then(({ app }) => {
            const node = app.graph.getNodeById(nodeId);
            const nodeTitle = node?.title || node?.type || `Node ${nodeId}`;
            
            // Handle images - check extension to determine if it's actually a video/gif
            // Also check animated flag to treat as video
            const hasAnimatedFlag = output.animated && Array.isArray(output.animated) && 
                output.animated.some((/** @type {any} */ a) => a === true);
                
            if(output.images && Array.isArray(output.images)) {
                for(const img of output.images) {
                    const filename = img.filename;
                    const ext = String(filename).toLowerCase().split('.').pop();
                    // Video extensions (webp excluded - can be static)
                    const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '');
                    const isGif = ext === 'gif';
                    const isWebp = ext === 'webp';
                    
                    // Determine type based on extension and animated flag
                    /** @type {'image' | 'video' | 'gif'} */
                    let outputType = 'image';
                    if (isVideo) {
                        outputType = 'video';
                    } else if (isGif) {
                        // GIFs are treated as gifs (animated images)
                        outputType = 'gif';
                    } else if ((isWebp || ext === 'png') && hasAnimatedFlag) {
                        // Animated webp/apng treated as video when animated flag is set
                        outputType = 'video';
                    }
                    
                    this.#addOutput({
                        type: outputType,
                        filename: img.filename,
                        subfolder: img.subfolder || '',
                        format: img.type || 'output',
                        nodeId: nodeId,
                        nodeTitle: nodeTitle
                    });
                }
            }
            
            // Handle gifs
            if(output.gifs && Array.isArray(output.gifs)) {
                for(const gif of output.gifs) {
                    this.#addOutput({
                        type: 'gif',
                        filename: gif.filename,
                        subfolder: gif.subfolder || '',
                        format: gif.format || 'output',
                        nodeId: nodeId,
                        nodeTitle: nodeTitle
                    });
                }
            }
            
            // Handle videos (single video object)
            if(output.video) {
                const video = output.video;
                this.#addOutput({
                    type: 'video',
                    filename: video.filename || video,
                    subfolder: video.subfolder || '',
                    format: video.format || 'video',
                    nodeId: nodeId,
                    nodeTitle: nodeTitle
                });
            }
            
            // Handle videos array
            if(output.videos && Array.isArray(output.videos)) {
                for(const video of output.videos) {
                    this.#addOutput({
                        type: 'video',
                        filename: video.filename || video,
                        subfolder: video.subfolder || '',
                        format: video.format || 'video',
                        nodeId: nodeId,
                        nodeTitle: nodeTitle
                    });
                }
            }
            
            // Handle audio
            if(output.audio && Array.isArray(output.audio)) {
                for(const audio of output.audio) {
                    this.#addOutput({
                        type: 'audio',
                        filename: audio.filename,
                        subfolder: audio.subfolder || '',
                        format: audio.type || 'output',
                        nodeId: nodeId,
                        nodeTitle: nodeTitle
                    });
                }
            }
            
            // Handle animated array - ONLY for object-based animated items
            // Boolean flags in animated array are already handled by hasAnimatedFlag check in images processing
            // This prevents duplicate processing when animated: [true] + images array both exist
            if(output.animated && Array.isArray(output.animated)) {
                for(const anim of output.animated) {
                    // Skip boolean flags - images were already processed with hasAnimatedFlag
                    if (typeof anim === 'boolean') {
                        continue;
                    }
                    
                    // Handle object-based animated items (actual file references)
                    if (typeof anim === 'object' && anim.filename) {
                        const filename = anim.filename;
                        const ext = String(filename).toLowerCase().split('.').pop();
                        const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '');
                        const isGif = ext === 'gif';
                        
                        this.#addOutput({
                            type: /** @type {'video' | 'image' | 'gif'} */ (isVideo ? 'video' : (isGif ? 'gif' : 'image')),
                            filename: filename,
                            subfolder: anim.subfolder || '',
                            format: anim.type || 'output',
                            nodeId: nodeId,
                            nodeTitle: nodeTitle
                        });
                    }
                }
            }
        });
    }
    
    /**
     * Add an output item (with deduplication)
     * @param {OutputItem} item 
     * @returns {boolean} - Whether the item was added (false if duplicate)
     */
    #addOutput(item) {
        // Check for duplicates - same filename and nodeId means it's the same output
        const exists = this.#outputs.some(o => 
            o.filename === item.filename && o.nodeId === item.nodeId
        );
        
        if (exists) {
            return false;
        }
        
        this.#outputs.push(item);
        
        // Store by node
        if(!this.#nodeOutputs.has(item.nodeId)) {
            this.#nodeOutputs.set(item.nodeId, []);
        }
        this.#nodeOutputs.get(item.nodeId)?.push(item);
        
        this.render();
        this.#onUpdate?.();
        return true;
    }
    
    /**
     * Clear all outputs
     */
    clearOutputs() {
        this.#outputs = [];
        this.#nodeOutputs.clear();
        this.render();
    }
    
    /**
     * Set status message
     * @param {string} message 
     */
    setStatus(message) {
        const statusEl = this.#container.querySelector('.comfy-mobile-form-outputs-status');
        if(statusEl) {
            statusEl.textContent = message;
        }
    }
    
    /**
     * Set executing status for a node
     * @param {number} nodeId 
     */
    setExecutingStatus(nodeId) {
        // @ts-ignore
        import("../../scripts/app.js").then(({ app }) => {
            const node = app.graph.getNodeById(nodeId);
            const name = node?.title || node?.type || `Node ${nodeId}`;
            this.setStatus(`Executing: ${name}...`);
        });
    }
    
    /**
     * Set progress
     * @param {number} percent 
     * @param {number} nodeId 
     */
    setProgress(percent, nodeId) {
        const progressEl = this.#container.querySelector('.comfy-mobile-form-outputs-progress');
        if(progressEl instanceof HTMLElement) {
            progressEl.style.width = `${percent}%`;
        }
        this.setStatus(`Progress: ${percent}%`);
    }
    
    /**
     * Render the outputs display
     */
    render() {
        const currentView = localStorage.getItem('mf-outputs-view') || 'grid';
        
        this.#container.innerHTML = `
            <div class="comfy-mobile-form-outputs-widgets"></div>
            <div class="comfy-mobile-form-outputs-header">
                <h3>Generated Outputs</h3>
                <span class="comfy-mobile-form-outputs-status">Ready</span>
                <div class="comfy-mobile-form-outputs-actions">
                    <div class="comfy-mobile-form-view-toggle" data-view="${currentView}">
                        <button class="comfy-mobile-form-view-btn ${currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"/>
                                <rect x="14" y="3" width="7" height="7"/>
                                <rect x="14" y="14" width="7" height="7"/>
                                <rect x="3" y="14" width="7" height="7"/>
                            </svg>
                        </button>
                        <button class="comfy-mobile-form-view-btn ${currentView === 'list' ? 'active' : ''}" data-view="list" title="List View">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="8" y1="6" x2="21" y2="6"/>
                                <line x1="8" y1="12" x2="21" y2="12"/>
                                <line x1="8" y1="18" x2="21" y2="18"/>
                                <line x1="3" y1="6" x2="3.01" y2="6"/>
                                <line x1="3" y1="12" x2="3.01" y2="12"/>
                                <line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <button class="comfy-mobile-form-outputs-clear" title="Clear all outputs">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
                            <path d="M10 11v6M14 11v6"/>
                        </svg>
                        <span>Clear</span>
                    </button>
                </div>
            </div>
            <div class="comfy-mobile-form-outputs-progress-bar">
                <div class="comfy-mobile-form-outputs-progress"></div>
            </div>
            <div class="comfy-mobile-form-outputs-gallery ${currentView === 'list' ? 'list-view' : ''}"></div>
        `;
        
        // View toggle handler
        const viewToggle = this.#container.querySelector('.comfy-mobile-form-view-toggle');
        viewToggle?.querySelectorAll('.comfy-mobile-form-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view') || 'grid';
                this.#setGalleryView(view);
            });
        });
        
        // Add clear button handler with confirmation
        const clearBtn = this.#container.querySelector('.comfy-mobile-form-outputs-clear');
        clearBtn?.addEventListener('click', async () => {
            // Only show confirmation if there are outputs to clear
            if (this.#outputs.length === 0) return;
            
            const confirmed = await showConfirmDialog({
                title: 'Clear All Outputs',
                message: `Are you sure you want to clear all ${this.#outputs.length} output${this.#outputs.length === 1 ? '' : 's'}? This action cannot be undone.`,
                confirmText: 'Clear All',
                cancelText: 'Keep',
                type: 'danger',
                icon: '🗑️'
            });
            
            if (confirmed) {
                this.clearOutputs();
                this.render();
            }
        });
        
        // Render output node widgets
        this.#widgetsContainer = /** @type {HTMLDivElement} */ (this.#container.querySelector('.comfy-mobile-form-outputs-widgets'));
        this.#renderOutputWidgets();
        
        const gallery = this.#container.querySelector('.comfy-mobile-form-outputs-gallery');
        if(!gallery) return;
        
        if(this.#outputs.length === 0) {
            gallery.innerHTML = `
                <div class="comfy-mobile-form-empty-state">
                    <div class="comfy-mobile-form-empty-state-icon">🖼️</div>
                    <div class="comfy-mobile-form-empty-state-title">No Outputs Yet</div>
                    <div class="comfy-mobile-form-empty-state-description">
                        Generated images, videos, and other outputs will appear here after running your workflow.
                    </div>
                    <div class="comfy-mobile-form-empty-state-hint">
                        <div class="comfy-mobile-form-empty-state-hint-item">Configure your workflow inputs</div>
                        <div class="comfy-mobile-form-empty-state-hint-item">Click "Queue Prompt" to run</div>
                        <div class="comfy-mobile-form-empty-state-hint-item">Results will show here automatically</div>
                    </div>
                </div>
            `;
            return;
        }
        
        for(const output of this.#outputs) {
            const item = this.#createOutputElement(output);
            gallery.appendChild(item);
        }
    }
    
    /**
     * Render output nodes as widgets
     */
    #renderOutputWidgets() {
        if (!this.#widgetsContainer) return;
        this.#widgetsContainer.innerHTML = '';
        
        if (this.#outputNodes.length === 0) {
            // No widgets to show
            return;
        }
        
        // Add a header for the output nodes section
        const header = document.createElement('div');
        header.classList.add('comfy-mobile-form-outputs-widgets-header');
        header.innerHTML = '<h3>Output Settings</h3>';
        this.#widgetsContainer.appendChild(header);
        
        // Create a grid container for the widgets
        const grid = document.createElement('div');
        grid.classList.add('comfy-mobile-form-outputs-widgets-grid');
        
        for (const node of this.#outputNodes) {
            const elem = document.createElement('div');
            if (createWidgetFromNode(elem, node)) {
                grid.appendChild(elem);
            }
        }
        
        this.#widgetsContainer.appendChild(grid);
    }
    
    /**
     * Create DOM element for an output item
     * @param {OutputItem} output 
     * @returns {HTMLElement}
     */
    #createOutputElement(output) {
        const item = document.createElement('div');
        item.classList.add('comfy-mobile-form-output-item');
        item.dataset.type = output.type;
        
        const url = this.#getOutputUrl(output);
        
        if(output.type === 'video') {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = 'metadata';
            
            // Add error handling
            video.addEventListener('error', () => {
                console.error('[MobileForm Outputs] Video load error:', url);
                // Show placeholder on error
                item.innerHTML = `<div class="comfy-mobile-form-output-error">
                    <span>🎬</span>
                    <span>${output.filename}</span>
                </div>`;
            });
            
            item.appendChild(video);
            
            // Play on tap
            video.addEventListener('click', () => {
                if(video.paused) video.play();
                else video.pause();
            });
        } else if(output.type === 'audio') {
            // Use the audio player component from the extension system
            const player = createAudioPlayer(url);
            item.appendChild(player);
            item.classList.add('comfy-mobile-form-output-audio');
        } else if(output.type === 'gif') {
            const img = document.createElement('img');
            img.src = url;
            img.alt = output.nodeTitle;
            img.loading = 'lazy';
            item.appendChild(img);
            
            // Fullscreen on tap
            img.addEventListener('click', () => this.#showFullscreen(url, 'image'));
        } else {
            const img = document.createElement('img');
            img.src = url;
            img.alt = output.nodeTitle;
            img.loading = 'lazy';
            item.appendChild(img);
            
            // Fullscreen on tap
            img.addEventListener('click', () => this.#showFullscreen(url, 'image'));
        }
        
        // Label
        const label = document.createElement('div');
        label.classList.add('comfy-mobile-form-output-label');
        label.textContent = output.nodeTitle;
        item.appendChild(label);
        
        // Actions bar
        const actions = document.createElement('div');
        actions.classList.add('comfy-mobile-form-output-actions');
        
        // Copy button (for images only)
        if (output.type === 'image' || output.type === 'gif') {
            const copyBtn = document.createElement('button');
            copyBtn.classList.add('comfy-mobile-form-output-action');
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>`;
            copyBtn.title = 'Copy to Clipboard';
            copyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.#copyToClipboard(url, copyBtn);
            });
            actions.appendChild(copyBtn);
        }
        
        // Fullscreen button
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.classList.add('comfy-mobile-form-output-action');
        fullscreenBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>`;
        fullscreenBtn.title = 'View Fullscreen';
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#showFullscreen(url, output.type === 'video' ? 'video' : 'image');
        });
        actions.appendChild(fullscreenBtn);
        
        // Download button
        const downloadBtn = document.createElement('a');
        downloadBtn.classList.add('comfy-mobile-form-output-action');
        downloadBtn.href = url;
        downloadBtn.download = output.filename;
        downloadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>`;
        downloadBtn.title = 'Download';
        downloadBtn.addEventListener('click', (e) => e.stopPropagation());
        actions.appendChild(downloadBtn);
        
        item.appendChild(actions);
        
        return item;
    }

    /**
     * Set the gallery view mode
     * @param {string} view - 'grid' or 'list'
     */
    #setGalleryView(view) {
        localStorage.setItem('mf-outputs-view', view);
        
        const gallery = this.#container.querySelector('.comfy-mobile-form-outputs-gallery');
        const toggle = this.#container.querySelector('.comfy-mobile-form-view-toggle');
        
        if (gallery) {
            gallery.classList.toggle('list-view', view === 'list');
        }
        
        if (toggle) {
            toggle.setAttribute('data-view', view);
            toggle.querySelectorAll('.comfy-mobile-form-view-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-view') === view);
            });
        }
    }

    /**
     * Copy image to clipboard
     * @param {string} url 
     * @param {HTMLElement} btn 
     */
    async #copyToClipboard(url, btn) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            
            // Show feedback
            btn.classList.add('success');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>`;
            setTimeout(() => {
                btn.classList.remove('success');
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>`;
            }, 2000);
        } catch (e) {
            console.error('[MobileForm] Copy failed:', e);
            btn.classList.add('error');
            setTimeout(() => btn.classList.remove('error'), 2000);
        }
    }
    
    /**
     * Get URL for an output
     * @param {OutputItem} output 
     * @returns {string}
     */
    #getOutputUrl(output) {
        // If format is 'url', the filename is already a full URL
        if (output.format === 'url') {
            return output.filename;
        }
        
        const params = new URLSearchParams({
            filename: output.filename,
            subfolder: output.subfolder,
            type: output.format || 'output'
        });
        return `/view?${params.toString()}`;
    }
    
    /**
     * Show fullscreen preview
     * @param {string} url 
     * @param {'image' | 'video'} type 
     */
    #showFullscreen(url, type) {
        const overlay = document.createElement('div');
        overlay.classList.add('comfy-mobile-form-fullscreen-overlay');
        
        if(type === 'video') {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            overlay.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = url;
            overlay.appendChild(img);
        }
        
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('comfy-mobile-form-fullscreen-close');
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => overlay.remove());
        overlay.appendChild(closeBtn);
        
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) overlay.remove();
        });
        
        document.body.appendChild(overlay);
    }
    
    /**
     * Get outputs for specific nodes
     * @param {number[]} nodeIds 
     * @returns {OutputItem[]}
     */
    getOutputsForNodes(nodeIds) {
        const results = [];
        for(const id of nodeIds) {
            const outputs = this.#nodeOutputs.get(id);
            if(outputs) results.push(...outputs);
        }
        return results;
    }
    
    /**
     * Check if currently executing
     * @returns {boolean}
     */
    get isExecuting() {
        return this.#isExecuting;
    }
}

/**
 * Create outputs display for nodes in the OUTPUTS group
 * @param {HTMLDivElement} container 
 * @param {ComfyUIGraphNode[]} nodes 
 * @returns {OutputsManager}
 */
export function createOutputsDisplay(container, nodes) {
    const manager = new OutputsManager(container);
    return manager;
}

