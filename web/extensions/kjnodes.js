// @ts-check

/**
 * KJNodes Extension - Handles KJNodes custom nodes
 * 
 * Supported nodes:
 * - LoadAndResizeImage
 * - LoadImagesFromFolderKJ
 * - LoadVideosFromFolder
 * - SaveImageWithAlpha, SaveImageKJ
 * - ImageAndMaskPreview
 * - PreviewAnimation, FastPreview
 */

import { ExtensionRegistry } from './registry.js';

/**
 * Initialize the KJNodes extension
 * @param {typeof ExtensionRegistry} registry 
 */
export function initKJNodesExtension(registry) {
    // ============================================
    // NODE HANDLERS
    // ============================================
    
    // LoadAndResizeImage - Image loading with resize options
    registry.registerNodeHandler('LoadAndResizeImage', (context) => {
        const { elem, node, addTitle, addWidget, addLoadedImagePreview } = context;
        
        addTitle(elem, node.title || 'Load & Resize Image');
        
        if (!Array.isArray(node.widgets)) return true;
        
        const imageWidget = node.widgets.find(w => w.name === 'image');
        
        // Add preview that can be updated
        let updatePreview = null;
        if (imageWidget?.value) {
            updatePreview = addLoadedImagePreview(elem, String(imageWidget.value), 'input', node);
        }
        
        // Add other widgets
        const groupElem = document.createElement('div');
        groupElem.classList.add('comfy-mobile-form-group');
        
        for (const widget of node.widgets) {
            if (widget.hidden || widget.type === 'converted-widget') continue;
            
            const widgetWrapper = document.createElement('div');
            widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
            
            addTitle(widgetWrapper, widget.name);
            
            // Wrap callback for image widget to update preview
            if (widget === imageWidget && updatePreview) {
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
    
    // LoadImagesFromFolderKJ - Load images from a folder
    registry.registerNodeHandler('LoadImagesFromFolderKJ', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Load Images From Folder');
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">📁</div>
            <div class="comfy-mobile-form-info-text">Load images from a folder</div>
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
    
    // LoadVideosFromFolder - Load videos from a folder
    registry.registerNodeHandler('LoadVideosFromFolder', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Load Videos From Folder');
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">🎬</div>
            <div class="comfy-mobile-form-info-text">Load videos from a folder</div>
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
    
    // Register KJNodes output nodes (use default image handling)
    registry.registerOutputNodeType([
        'SaveImageWithAlpha',
        'SaveImageKJ',
        'ImageAndMaskPreview',
        'PreviewAnimation',
        'FastPreview',
    ]);
}

// Register the extension
ExtensionRegistry.registerExtension('kjnodes', initKJNodesExtension);

export default initKJNodesExtension;

