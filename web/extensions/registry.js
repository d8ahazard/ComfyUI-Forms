// @ts-check

/**
 * @typedef {import('../types').ComfyUIGraphNode} ComfyUIGraphNode
 * @typedef {import('../types').ComfyUIGraphWidget} ComfyUIGraphWidget
 */

/**
 * @typedef {Object} NodeHandlerContext
 * @property {HTMLDivElement} elem - The container element to render into
 * @property {ComfyUIGraphNode} node - The node being rendered
 * @property {function(HTMLDivElement, string, ComfyUIGraphNode=): void} addTitle - Helper to add a title (optional node for rename support)
 * @property {function(HTMLDivElement, ComfyUIGraphWidget, ComfyUIGraphNode): boolean} addWidget - Helper to add a widget
 * @property {function(HTMLDivElement, string, string, ComfyUIGraphNode): (newFilename: string) => void} addLoadedImagePreview - Helper to add image preview from file, returns update function
 * @property {function(HTMLDivElement, string, string, ComfyUIGraphNode): (newFilename: string) => void} addLoadedVideoPreview - Helper to add video preview from file, returns update function
 * @property {function(HTMLDivElement, ComfyUIGraphNode): void} addNodeImagePreview - Helper to add execution result images (node.images)
 * @property {function(HTMLDivElement, ComfyUIGraphNode): void} addNodeImgsPreview - Helper to add execution result images (node.imgs)
 * @property {function(string): boolean} isWidgetHidden - Check if a specific widget should be hidden
 */

/**
 * @typedef {Object} WidgetHandlerContext
 * @property {HTMLDivElement} elem - The container element to render into
 * @property {ComfyUIGraphWidget} widget - The widget being rendered
 * @property {ComfyUIGraphNode} [node] - The parent node (optional)
 */

/**
 * @typedef {Object} OutputHandlerContext
 * @property {HTMLDivElement} container - The container element to render into
 * @property {Object} output - The output data from execution
 * @property {number} nodeId - The node ID
 * @property {string} nodeTitle - The node title
 */

/**
 * @callback NodeHandler
 * @param {NodeHandlerContext} context
 * @returns {boolean} - Whether the handler rendered content
 */

/**
 * @callback WidgetHandler
 * @param {WidgetHandlerContext} context
 * @returns {boolean} - Whether the handler rendered content
 */

/**
 * @callback OutputHandler
 * @param {OutputHandlerContext} context
 * @returns {boolean} - Whether the handler rendered content
 */

/**
 * Extension Registry - Central registry for node, widget, and output handlers
 */
class ExtensionRegistryClass {
    constructor() {
        /** @type {Map<string, NodeHandler>} */
        this.nodeHandlers = new Map();
        
        /** @type {Map<string, WidgetHandler>} */
        this.widgetHandlers = new Map();
        
        /** @type {Map<string, OutputHandler>} */
        this.outputHandlers = new Map();
        
        /** @type {Set<string>} */
        this.outputNodeTypes = new Set();
        
        /** @type {Map<string, Function>} */
        this.extensions = new Map();
    }
    
    /**
     * Register a handler for specific node types
     * @param {string | string[]} types - Node type(s) to handle
     * @param {NodeHandler} handler - Handler function
     */
    registerNodeHandler(types, handler) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            this.nodeHandlers.set(type, handler);
        }
    }
    
    /**
     * Register a handler for specific widget types
     * @param {string | string[]} types - Widget type(s) to handle (case-insensitive)
     * @param {WidgetHandler} handler - Handler function
     */
    registerWidgetHandler(types, handler) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            this.widgetHandlers.set(type.toLowerCase(), handler);
        }
    }
    
    /**
     * Register a handler for specific output node types
     * @param {string | string[]} types - Node type(s) to handle
     * @param {OutputHandler} handler - Handler function
     */
    registerOutputHandler(types, handler) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            this.outputHandlers.set(type, handler);
            this.outputNodeTypes.add(type);
        }
    }
    
    /**
     * Register output node types that should be tracked (uses default image/video/gif handling)
     * @param {string | string[]} types - Node type(s) to track
     */
    registerOutputNodeType(types) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            this.outputNodeTypes.add(type);
        }
    }
    
    /**
     * Get handler for a node type
     * @param {string} type 
     * @returns {NodeHandler | undefined}
     */
    getNodeHandler(type) {
        return this.nodeHandlers.get(type);
    }
    
    /**
     * Get handler for a widget type
     * @param {string} type 
     * @returns {WidgetHandler | undefined}
     */
    getWidgetHandler(type) {
        return this.widgetHandlers.get(type?.toLowerCase?.() || type);
    }
    
    /**
     * Get handler for an output node type
     * @param {string} type 
     * @returns {OutputHandler | undefined}
     */
    getOutputHandler(type) {
        return this.outputHandlers.get(type);
    }
    
    /**
     * Check if a node type is an output node
     * @param {string} type 
     * @returns {boolean}
     */
    isOutputNodeType(type) {
        return this.outputNodeTypes.has(type);
    }
    
    /**
     * Get all registered output node types
     * @returns {string[]}
     */
    getOutputNodeTypes() {
        return Array.from(this.outputNodeTypes);
    }
    
    /**
     * Register an extension
     * @param {string} name - Extension name
     * @param {Function} initFn - Initialization function
     */
    registerExtension(name, initFn) {
        this.extensions.set(name, initFn);
    }
    
    /**
     * Initialize all registered extensions
     */
    initializeExtensions() {
        for (const [name, initFn] of this.extensions) {
            try {
                initFn(this);
            } catch (e) {
                console.error(`[MobileForm] Failed to load extension: ${name}`, e);
            }
        }
    }
}

// Singleton instance
export const ExtensionRegistry = new ExtensionRegistryClass();

// ============================================
// DECLARATIVE NODE DEFINITION SYSTEM
// ============================================

/**
 * @typedef {Object} NodePreviewConfig
 * @property {'image' | 'video' | 'audio'} type - Media type
 * @property {string | string[]} widget - Widget name(s) to find for the preview source
 * @property {'input' | 'output' | 'temp'} [folder='input'] - File location
 * @property {string | string[]} [subfolderWidget] - Widget name(s) for subfolder
 */

/**
 * @typedef {Object} NodeInfoConfig
 * @property {string} icon - Icon emoji
 * @property {string} text - Description text
 */

/**
 * @typedef {Object} NodeConfig
 * @property {string} [title] - Display title (fallback: node.title or node.type)
 * @property {NodePreviewConfig} [preview] - Media preview configuration
 * @property {NodeInfoConfig} [info] - Info banner configuration
 * @property {string[]} [skipWidgets] - Widget names to exclude
 * @property {NodeHandler} [custom] - Custom handler for special cases (overrides all other config)
 */

/**
 * Create a handler from a declarative node config
 * @param {NodeConfig} config 
 * @returns {NodeHandler}
 */
export function createHandlerFromConfig(config) {
    // If custom handler provided, use it directly
    if (config.custom) {
        return config.custom;
    }
    
    return function(context) {
        const { elem, node, addTitle, addWidget, addLoadedImagePreview, addLoadedVideoPreview, isWidgetHidden } = context;
        
        // Add title
        const displayTitle = config.title || node.title || node.type || 'Node';
        addTitle(elem, displayTitle, node);
        
        // Add info banner if configured
        if (config.info) {
            const infoElem = document.createElement('div');
            infoElem.classList.add('comfy-mobile-form-info');
            infoElem.innerHTML = `
                <div class="comfy-mobile-form-info-icon">${config.info.icon}</div>
                <div class="comfy-mobile-form-info-text">${config.info.text}</div>
            `;
            elem.appendChild(infoElem);
        }
        
        if (!Array.isArray(node.widgets)) return true;
        
        // Handle media preview if configured
        let updatePreview = null;
        let previewWidget = null;
        let subfolderWidget = null;
        
        if (config.preview) {
            const previewWidgetNames = Array.isArray(config.preview.widget) 
                ? config.preview.widget 
                : [config.preview.widget];
            const folder = config.preview.folder || 'input';
            
            // Find the preview widget
            previewWidget = node.widgets.find(w => previewWidgetNames.includes(w.name));
            
            // Find subfolder widget if configured
            if (config.preview.subfolderWidget) {
                const subfolderNames = Array.isArray(config.preview.subfolderWidget)
                    ? config.preview.subfolderWidget
                    : [config.preview.subfolderWidget];
                subfolderWidget = node.widgets.find(w => subfolderNames.includes(w.name));
            }
            
            // Helper to get full path with subfolder
            const getFullPath = () => {
                const subfolder = subfolderWidget?.value ? String(subfolderWidget.value) : '';
                const filename = previewWidget?.value ? String(previewWidget.value) : '';
                return subfolder ? `${subfolder}/${filename}` : filename;
            };
            
            // Add preview with update function
            if (previewWidget?.value) {
                const fullPath = getFullPath();
                if (config.preview.type === 'image') {
                    updatePreview = addLoadedImagePreview(elem, fullPath, folder, node);
                } else if (config.preview.type === 'video') {
                    updatePreview = addLoadedVideoPreview(elem, fullPath, folder, node);
                } else if (config.preview.type === 'audio') {
                    const audioUrl = getViewUrl(fullPath, folder);
                    const player = createAudioPlayer(audioUrl);
                    elem.appendChild(player);
                }
            }
        }
        
        // Add widgets in a group
        const groupElem = document.createElement('div');
        groupElem.classList.add('comfy-mobile-form-group');
        
        const skipWidgets = config.skipWidgets || [];
        let widgetCount = 0;
        
        for (const widget of node.widgets) {
            if (widget.hidden || widget.type === 'converted-widget') continue;
            if (skipWidgets.includes(widget.name)) continue;
            if (isWidgetHidden?.(widget.name)) continue;
            
            const widgetWrapper = document.createElement('div');
            widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
            
            addTitle(widgetWrapper, widget.name);
            
            // Wrap callback for preview widgets to update preview
            if (updatePreview && (widget === previewWidget || widget === subfolderWidget)) {
                const originalCallback = widget.callback;
                const getFullPath = () => {
                    const subfolder = subfolderWidget?.value ? String(subfolderWidget.value) : '';
                    const filename = previewWidget?.value ? String(previewWidget.value) : '';
                    return subfolder ? `${subfolder}/${filename}` : filename;
                };
                widget.callback = (value) => {
                    updatePreview(getFullPath());
                    originalCallback?.(value);
                };
            }
            
            if (addWidget(widgetWrapper, widget, node)) {
                groupElem.appendChild(widgetWrapper);
                widgetCount++;
            }
        }
        
        if (widgetCount > 0) {
            elem.appendChild(groupElem);
        }
        
        return true;
    };
}

/**
 * Define a node handler using declarative configuration
 * @param {ExtensionRegistryClass} registry - The extension registry
 * @param {string | string[]} types - Node type(s) to handle
 * @param {NodeConfig} config - Node configuration
 */
export function defineNode(registry, types, config) {
    const handler = createHandlerFromConfig(config);
    registry.registerNodeHandler(types, handler);
}

/**
 * Batch define multiple nodes at once
 * @param {ExtensionRegistryClass} registry - The extension registry
 * @param {Record<string, NodeConfig>} definitions - Map of node type(s) to config
 */
export function defineNodes(registry, definitions) {
    for (const [types, config] of Object.entries(definitions)) {
        // Support comma-separated types in the key
        const typeArray = types.includes(',') ? types.split(',').map(t => t.trim()) : types;
        defineNode(registry, typeArray, config);
    }
}

// Legacy compatibility - createStandardNodeHandler still works but uses new system
/**
 * Helper to create a node handler that shows widgets in a group
 * @param {Object} options
 * @param {string[]} [options.previewWidgets] - Widget names to show as previews (image/video)
 * @param {string} [options.previewType] - Type of preview: 'image' | 'video' | 'audio'
 * @param {string} [options.previewFolder] - Folder type: 'input' | 'output' | 'temp'
 * @param {string[]} [options.skipWidgets] - Widget names to skip
 * @returns {NodeHandler}
 * @deprecated Use defineNode() with config instead
 */
export function createStandardNodeHandler(options = {}) {
    const { previewWidgets = [], previewType = 'image', previewFolder = 'input', skipWidgets = [] } = options;
    
    /** @type {NodeConfig} */
    const config = {
        skipWidgets
    };
    
    // Convert old preview format to new
    if (previewWidgets.length > 0) {
        config.preview = {
            type: /** @type {'image' | 'video' | 'audio'} */ (previewType),
            widget: previewWidgets,
            folder: /** @type {'input' | 'output' | 'temp'} */ (previewFolder)
        };
    }
    
    return createHandlerFromConfig(config);
}

/**
 * Helper to create an audio player element
 * @param {string} src - Audio source URL
 * @returns {HTMLDivElement}
 */
export function createAudioPlayer(src) {
    const container = document.createElement('div');
    container.classList.add('comfy-mobile-form-audio-player');
    
    const audio = document.createElement('audio');
    audio.src = src;
    audio.preload = 'metadata';
    
    const playBtn = document.createElement('button');
    playBtn.classList.add('comfy-mobile-form-audio-play-btn');
    playBtn.innerHTML = '▶';
    playBtn.type = 'button';
    
    const timeDisplay = document.createElement('span');
    timeDisplay.classList.add('comfy-mobile-form-audio-time');
    timeDisplay.textContent = '0:00 / --:--';
    
    const progressContainer = document.createElement('div');
    progressContainer.classList.add('comfy-mobile-form-audio-progress-container');
    
    const progressBar = document.createElement('div');
    progressBar.classList.add('comfy-mobile-form-audio-progress');
    progressContainer.appendChild(progressBar);
    
    // Format time helper
    const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Update time display
    const updateTime = () => {
        timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        if (audio.duration > 0) {
            progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
        }
    };
    
    // Play/pause toggle
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playBtn.innerHTML = '⏸';
            playBtn.classList.add('playing');
        } else {
            audio.pause();
            playBtn.innerHTML = '▶';
            playBtn.classList.remove('playing');
        }
    });
    
    // Progress click to seek
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    });
    
    audio.addEventListener('loadedmetadata', updateTime);
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', () => {
        playBtn.innerHTML = '▶';
        playBtn.classList.remove('playing');
    });
    
    container.appendChild(playBtn);
    container.appendChild(progressContainer);
    container.appendChild(timeDisplay);
    container.appendChild(audio);
    
    return container;
}

/**
 * Get the view URL for a file
 * @param {string} filename 
 * @param {string} [type='input'] - 'input' | 'output' | 'temp'
 * @param {string} [subfolder='']
 * @returns {string}
 */
export function getViewUrl(filename, type = 'input', subfolder = '') {
    const params = new URLSearchParams({
        filename: filename,
        type: type
    });
    if (subfolder) {
        params.set('subfolder', subfolder);
    }
    return `/view?${params.toString()}`;
}

export default ExtensionRegistry;
