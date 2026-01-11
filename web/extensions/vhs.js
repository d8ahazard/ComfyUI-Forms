// @ts-check

/**
 * VHS Extension - Handles VideoHelperSuite nodes
 * 
 * Supported nodes:
 * - VHS_LoadVideo, LoadVideoUpload, LoadVideoPath, LoadVideoFFmpegUpload, LoadVideoFFmpegPath
 * - VHS_LoadAudio, LoadAudioUpload
 * - LoadImagesFromDirectoryUpload, LoadImagesFromDirectoryPath
 * - LoadImagePath
 * - VHS_VideoCombine
 */

import { ExtensionRegistry, createAudioPlayer, getViewUrl } from './registry.js';

/**
 * Initialize the VHS extension
 * @param {typeof ExtensionRegistry} registry 
 */
export function initVHSExtension(registry) {
    // ============================================
    // NODE HANDLERS
    // ============================================
    
    // VHS_LoadVideo / LoadVideoUpload - Video preview from input folder
    registry.registerNodeHandler(['VHS_LoadVideo', 'LoadVideoUpload'], (context) => {
        const { elem, node, addTitle, addWidget, addLoadedVideoPreview } = context;
        
        addTitle(elem, node.title || 'Load Video (VHS)', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        const videoWidget = node.widgets.find(w => w.name === 'video' || w.name === 'video_path');
        
        // Add preview that can be updated
        let updatePreview = null;
        if (videoWidget?.value) {
            updatePreview = addLoadedVideoPreview(elem, String(videoWidget.value), 'input', node);
        }
        
        // Add other widgets
        const groupElem = document.createElement('div');
        groupElem.classList.add('comfy-mobile-form-group');
        
        for (const widget of node.widgets) {
            if (widget.hidden || widget.type === 'converted-widget') continue;
            
            const widgetWrapper = document.createElement('div');
            widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
            
            addTitle(widgetWrapper, widget.name);
            
            // Wrap callback for video widget to update preview
            if (widget === videoWidget && updatePreview) {
                const originalCallback = widget.callback;
                widget.callback = (value) => {
                    updatePreview(String(value));
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
    
    // LoadVideoPath / LoadVideoFFmpegPath - Path-based video loading
    registry.registerNodeHandler(['LoadVideoPath', 'LoadVideoFFmpegPath'], (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Load Video (Path)', node);
        
        // Show info about path-based loading
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">🎬</div>
            <div class="comfy-mobile-form-info-text">Path-based video loading</div>
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
    
    // LoadVideoFFmpegUpload - FFmpeg video loading with upload
    registry.registerNodeHandler('LoadVideoFFmpegUpload', (context) => {
        const { elem, node, addTitle, addWidget, addLoadedVideoPreview } = context;
        
        addTitle(elem, node.title || 'Load Video (FFmpeg)', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        const videoWidget = node.widgets.find(w => w.name === 'video');
        
        // Add preview that can be updated
        let updatePreview = null;
        if (videoWidget?.value) {
            updatePreview = addLoadedVideoPreview(elem, String(videoWidget.value), 'input', node);
        }
        
        // Add other widgets
        const groupElem = document.createElement('div');
        groupElem.classList.add('comfy-mobile-form-group');
        
        for (const widget of node.widgets) {
            if (widget.hidden || widget.type === 'converted-widget') continue;
            
            const widgetWrapper = document.createElement('div');
            widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
            
            addTitle(widgetWrapper, widget.name);
            
            // Wrap callback for video widget to update preview
            if (widget === videoWidget && updatePreview) {
                const originalCallback = widget.callback;
                widget.callback = (value) => {
                    updatePreview(String(value));
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
    
    // VHS_LoadAudio / LoadAudioUpload - Audio loading with preview
    registry.registerNodeHandler(['VHS_LoadAudio', 'LoadAudioUpload'], (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Load Audio (VHS)', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        const audioWidget = node.widgets.find(w => w.name === 'audio' || w.name === 'audio_file');
        if (audioWidget?.value) {
            const audioUrl = getViewUrl(String(audioWidget.value), 'input');
            const player = createAudioPlayer(audioUrl);
            elem.appendChild(player);
        }
        
        // Add other widgets
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
        
        return true;
    });
    
    // LoadImagesFromDirectoryUpload / LoadImagesFromDirectoryPath - Directory loading
    registry.registerNodeHandler(['LoadImagesFromDirectoryUpload', 'LoadImagesFromDirectoryPath'], (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Load Images (Directory)', node);
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">📁</div>
            <div class="comfy-mobile-form-info-text">Load images from a directory</div>
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
    
    // LoadImagePath - Path-based image loading
    registry.registerNodeHandler('LoadImagePath', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Load Image (Path)', node);
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">🖼️</div>
            <div class="comfy-mobile-form-info-text">Path-based image loading</div>
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
    
    // Register VHS output nodes
    registry.registerOutputNodeType([
        'VHS_VideoCombine',
        'VHS_VideoInfo',
    ]);
}

// Register the extension
ExtensionRegistry.registerExtension('vhs', initVHSExtension);

export default initVHSExtension;

