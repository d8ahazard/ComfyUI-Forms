// @ts-check

// @ts-ignore
import { api } from "../../scripts/api.js";
import { ExtensionRegistry, createAudioPlayer, getViewUrl } from './extensions/index.js';
import { createWidgetFromNode } from './widget.js';

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
                console.log('[MobileForm Outputs] Node output:', nodeId, Object.keys(nodeOutput), nodeOutput);
                
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
                            const isVideo = ['mp4', 'webm', 'webp', 'mov', 'avi', 'mkv'].includes(ext || '');
                            const isGif = ext === 'gif';
                            
                            // Determine type based on extension or animated flag
                            /** @type {'image' | 'video' | 'gif'} */
                            let outputType = 'image';
                            if (isVideo || hasAnimatedFlag) {
                                outputType = 'video';
                            } else if (isGif) {
                                outputType = 'gif';
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
     * Setup API event listeners
     */
    #setupEventListeners() {
        // Listen for execution events
        api.addEventListener('executing', (event) => {
            const nodeId = event.detail;
            if(nodeId) {
                this.#isExecuting = true;
                this.setExecutingStatus(nodeId);
            }
        });
        
        api.addEventListener('executed', (event) => {
            const { node, output } = event.detail;
            if(output) {
                this.#handleNodeOutput(node, output);
            }
        });
        
        api.addEventListener('execution_start', () => {
            this.#isExecuting = true;
            this.clearOutputs();
            this.setStatus('Running workflow...');
        });
        
        api.addEventListener('execution_cached', (event) => {
            // Handle cached outputs
            const { nodes } = event.detail;
            if(nodes) {
                for(const nodeId of nodes) {
                    this.#checkCachedOutput(nodeId);
                }
            }
        });
        
        api.addEventListener('execution_error', (event) => {
            this.#isExecuting = false;
            this.setStatus('Error: ' + (event.detail?.exception_message || 'Unknown error'));
        });
        
        api.addEventListener('status', (event) => {
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
        
        api.addEventListener('progress', (event) => {
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
                    const isVideo = ['mp4', 'webm', 'webp', 'mov', 'avi', 'mkv'].includes(ext || '');
                    const isGif = ext === 'gif';
                    
                    // Determine type based on extension or animated flag
                    /** @type {'image' | 'video' | 'gif'} */
                    let outputType = 'image';
                    if (isVideo || hasAnimatedFlag) {
                        outputType = 'video';
                    } else if (isGif) {
                        outputType = 'gif';
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
            
            // Handle animated (videos/gifs from SaveVideo/animated format)
            // Some nodes use `animated: [true]` as a flag, others use `animated: [{filename, subfolder, type}]`
            if(output.animated && Array.isArray(output.animated)) {
                for(const anim of output.animated) {
                    // If animated item is a boolean, the actual file is in the images array
                    if (typeof anim === 'boolean') {
                        // Process images as animated videos/gifs
                        if (output.images && Array.isArray(output.images)) {
                            for (const img of output.images) {
                                const filename = img.filename;
                                const ext = String(filename).toLowerCase().split('.').pop();
                                const isVideo = ['mp4', 'webm', 'webp', 'mov', 'avi', 'mkv'].includes(ext || '');
                                const isGif = ext === 'gif';
                                
                                // Only process if it looks like an animated format
                                if (isVideo || isGif) {
                                    this.#addOutput({
                                        type: /** @type {'video' | 'image' | 'gif'} */ (isVideo ? 'video' : 'gif'),
                                        filename: filename,
                                        subfolder: img.subfolder || '',
                                        format: img.type || 'output',
                                        nodeId: nodeId,
                                        nodeTitle: nodeTitle
                                    });
                                }
                            }
                        }
                        break;
                    } else if (typeof anim === 'object' && anim.filename) {
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
     * Add an output item
     * @param {OutputItem} item 
     */
    #addOutput(item) {
        this.#outputs.push(item);
        
        // Store by node
        if(!this.#nodeOutputs.has(item.nodeId)) {
            this.#nodeOutputs.set(item.nodeId, []);
        }
        this.#nodeOutputs.get(item.nodeId)?.push(item);
        
        this.render();
        this.#onUpdate?.();
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
        this.#container.innerHTML = `
            <div class="comfy-mobile-form-outputs-widgets"></div>
            <div class="comfy-mobile-form-outputs-header">
                <h3>Generated Outputs</h3>
                <span class="comfy-mobile-form-outputs-status">Ready</span>
                <button class="comfy-mobile-form-outputs-clear" title="Clear all outputs">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
                        <path d="M10 11v6M14 11v6"/>
                    </svg>
                    <span>Clear</span>
                </button>
            </div>
            <div class="comfy-mobile-form-outputs-progress-bar">
                <div class="comfy-mobile-form-outputs-progress"></div>
            </div>
            <div class="comfy-mobile-form-outputs-gallery"></div>
        `;
        
        // Add clear button handler
        const clearBtn = this.#container.querySelector('.comfy-mobile-form-outputs-clear');
        clearBtn?.addEventListener('click', () => {
            this.clearOutputs();
            this.render();
        });
        
        // Render output node widgets
        this.#widgetsContainer = /** @type {HTMLDivElement} */ (this.#container.querySelector('.comfy-mobile-form-outputs-widgets'));
        this.#renderOutputWidgets();
        
        const gallery = this.#container.querySelector('.comfy-mobile-form-outputs-gallery');
        if(!gallery) return;
        
        if(this.#outputs.length === 0) {
            gallery.innerHTML = '<div class="comfy-mobile-form-outputs-empty">No outputs yet. Run a workflow to see results here.</div>';
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
        
        // Download button
        const downloadBtn = document.createElement('a');
        downloadBtn.classList.add('comfy-mobile-form-output-download');
        downloadBtn.href = url;
        downloadBtn.download = output.filename;
        downloadBtn.innerHTML = '⬇';
        downloadBtn.title = 'Download';
        item.appendChild(downloadBtn);
        
        return item;
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

