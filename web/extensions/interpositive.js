// @ts-check

/**
 * InterPositive Extension - Handles InterPositiveHelpers custom nodes
 * 
 * Supported nodes:
 * - LoadImageVideoIO
 * - SaveImageVideoIO
 * - VideoPreviewIO
 */

import { ExtensionRegistry, createAudioPlayer, getViewUrl } from './registry.js';

/**
 * Initialize the InterPositive extension
 * @param {typeof ExtensionRegistry} registry 
 */
export function initInterPositiveExtension(registry) {
    // ============================================
    // NODE HANDLERS
    // ============================================
    
    // LoadImageVideoIO - Universal image/video loader
    registry.registerNodeHandler('LoadImageVideoIO', (context) => {
        const { elem, node, addTitle, addWidget, addLoadedImagePreview, addLoadedVideoPreview } = context;
        
        addTitle(elem, node.title || 'Load Image/Video');
        
        if (!Array.isArray(node.widgets)) return true;
        
        // Try to find the file widget and determine if it's image or video
        const fileWidget = node.widgets.find(w => 
            w.name === 'file' || w.name === 'image' || w.name === 'video' || w.name === 'input_path'
        );
        
        // Create preview container and update function
        let updateImagePreview = null;
        let updateVideoPreview = null;
        const previewContainer = document.createElement('div');
        previewContainer.classList.add('comfy-mobile-form-dynamic-preview');
        elem.appendChild(previewContainer);
        
        const updatePreview = (filename) => {
            if (!filename) return;
            const isVideo = /\.(mp4|webm|mov|avi|mkv|gif)$/i.test(String(filename).toLowerCase());
            
            // Clear and re-add preview
            previewContainer.innerHTML = '';
            if (isVideo) {
                updateVideoPreview = addLoadedVideoPreview(previewContainer, String(filename), 'input', node);
            } else {
                updateImagePreview = addLoadedImagePreview(previewContainer, String(filename), 'input', node);
            }
        };
        
        // Initial preview
        if (fileWidget?.value) {
            updatePreview(fileWidget.value);
        }
        
        // Add other widgets
        const groupElem = document.createElement('div');
        groupElem.classList.add('comfy-mobile-form-group');
        
        for (const widget of node.widgets) {
            if (widget.hidden || widget.type === 'converted-widget') continue;
            
            const widgetWrapper = document.createElement('div');
            widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
            
            addTitle(widgetWrapper, widget.name);
            
            // Wrap callback for file widget to update preview
            if (widget === fileWidget) {
                const originalCallback = widget.callback;
                widget.callback = (value) => {
                    updatePreview(value);
                    originalCallback?.(value);
                };
            }
            
            if (addWidget(widgetWrapper, widget, node)) {
                groupElem.appendChild(widgetWrapper);
            }
        }
        
        if (groupElem.children.length > 0) {
            elem.appendChild(groupElem);
        }
        
        return true;
    });
    
    // MMAudio nodes - Audio generation/loading
    registry.registerNodeHandler(['MMAudioModelLoader', 'MMAudioVoCoderLoader', 'MMAudioFeatureUtilsLoader'], (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || node.type || 'MMAudio Loader');
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">🎵</div>
            <div class="comfy-mobile-form-info-text">MMAudio model loader</div>
        `;
        elem.appendChild(infoElem);
        
        // Add widgets
        if (Array.isArray(node.widgets)) {
            const groupElem = document.createElement('div');
            groupElem.classList.add('comfy-mobile-form-group');
            
            for (const widget of node.widgets) {
                if (widget.hidden || widget.type === 'converted-widget') continue;
                
                const widgetWrapper = document.createElement('div');
                widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
                
                addTitle(widgetWrapper, widget.name);
                if (addWidget(widgetWrapper, widget, node)) {
                    groupElem.appendChild(widgetWrapper);
                }
            }
            
            if (groupElem.children.length > 0) {
                elem.appendChild(groupElem);
            }
        }
        
        return true;
    });
    
    // MMAudioSampler - Audio generation
    registry.registerNodeHandler('MMAudioSampler', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'MMAudio Sampler');
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">🎧</div>
            <div class="comfy-mobile-form-info-text">Generate audio from video</div>
        `;
        elem.appendChild(infoElem);
        
        // Add widgets (especially the prompt)
        if (Array.isArray(node.widgets)) {
            const groupElem = document.createElement('div');
            groupElem.classList.add('comfy-mobile-form-group');
            
            for (const widget of node.widgets) {
                if (widget.hidden || widget.type === 'converted-widget') continue;
                
                const widgetWrapper = document.createElement('div');
                widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
                
                addTitle(widgetWrapper, widget.name);
                if (addWidget(widgetWrapper, widget, node)) {
                    groupElem.appendChild(widgetWrapper);
                }
            }
            
            if (groupElem.children.length > 0) {
                elem.appendChild(groupElem);
            }
        }
        
        return true;
    });
    
    // CombineVideoAndAudio - Combine video with audio
    registry.registerNodeHandler('CombineVideoAndAudio', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Combine Video & Audio');
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">🎬</div>
            <div class="comfy-mobile-form-info-text">Combine video with audio track</div>
        `;
        elem.appendChild(infoElem);
        
        // Add widgets
        if (Array.isArray(node.widgets)) {
            const groupElem = document.createElement('div');
            groupElem.classList.add('comfy-mobile-form-group');
            
            for (const widget of node.widgets) {
                if (widget.hidden || widget.type === 'converted-widget') continue;
                
                const widgetWrapper = document.createElement('div');
                widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
                
                addTitle(widgetWrapper, widget.name);
                if (addWidget(widgetWrapper, widget, node)) {
                    groupElem.appendChild(widgetWrapper);
                }
            }
            
            if (groupElem.children.length > 0) {
                elem.appendChild(groupElem);
            }
        }
        
        return true;
    });
    
    // ============================================
    // OUTPUT NODE TYPES
    // ============================================
    
    // Register InterPositive output nodes
    registry.registerOutputNodeType([
        'SaveImageVideoIO',
        'VideoPreviewIO',
        'SaveVideoWithFilename',
    ]);
}

// Register the extension
ExtensionRegistry.registerExtension('interpositive', initInterPositiveExtension);

export default initInterPositiveExtension;

