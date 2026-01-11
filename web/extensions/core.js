// @ts-check

/**
 * Core Extension - Handles built-in ComfyUI nodes
 * 
 * Supported nodes:
 * - LoadImage, LoadImageMask, LoadImageOutput
 * - LoadVideo
 * - LoadAudio, PreviewAudio, SaveAudio
 * - MaskPreview
 * - PreviewAny
 * - WebcamCapture
 * - RecordAudio
 * - PrimitiveNode, Note
 */

import { ExtensionRegistry, createAudioPlayer, getViewUrl, createStandardNodeHandler } from './registry.js';

/**
 * Initialize the core extension
 * @param {typeof ExtensionRegistry} registry 
 */
export function initCoreExtension(registry) {
    // ============================================
    // NODE HANDLERS
    // ============================================
    
    // PrimitiveNode - Shows just the value widget
    registry.registerNodeHandler('PrimitiveNode', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        if (!Array.isArray(node.widgets)) return false;
        
        for (const widget of node.widgets) {
            if (widget.name === 'value') {
                addTitle(elem, node.title || 'Primitive', node);
                addWidget(elem, widget, node);
                return true;
            }
        }
        return false;
    });
    
    // Note - Shows text content
    registry.registerNodeHandler('Note', (context) => {
        const { elem, node } = context;
        
        if (!Array.isArray(node.widgets)) return false;
        
        for (const widget of node.widgets) {
            if (widget.type === 'customtext') {
                const noteElem = document.createElement('div');
                noteElem.classList.add('comfy-mobile-form-note');
                noteElem.textContent = String(widget.value || '');
                elem.appendChild(noteElem);
                return true;
            }
        }
        return false;
    });
    
    // LoadImage / LoadImageMask - Image preview from input folder
    registry.registerNodeHandler(['LoadImage', 'LoadImageMask'], (context) => {
        const { elem, node, addTitle, addWidget, addLoadedImagePreview } = context;
        
        addTitle(elem, node.title || node.type || 'Load Image', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        const imageWidget = node.widgets.find(w => w.name === 'image');
        
        // Add preview that can be updated
        let updatePreview = null;
        if (imageWidget?.value) {
            updatePreview = addLoadedImagePreview(elem, String(imageWidget.value), 'input', node);
        }
        
        // Add other widgets in a group
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
    
    // LoadImageOutput / LoadImageFromOutputFolder - Image from output folder
    registry.registerNodeHandler(['LoadImageOutput', 'LoadImageFromOutputFolder', 'Load Image From Output Folder'], (context) => {
        const { elem, node, addTitle, addWidget, addLoadedImagePreview } = context;
        
        addTitle(elem, node.title || 'Load Image (Output)', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        const imageWidget = node.widgets.find(w => 
            w.name === 'image' || w.name === 'filename' || w.name === 'file'
        );
        const subfolderWidget = node.widgets.find(w => 
            w.name === 'subfolder' || w.name === 'folder'
        );
        
        // Add preview that can be updated
        let updatePreview = null;
        const getFullPath = () => {
            const subfolder = subfolderWidget?.value ? String(subfolderWidget.value) : '';
            return subfolder ? `${subfolder}/${imageWidget?.value || ''}` : String(imageWidget?.value || '');
        };
        
        if (imageWidget?.value) {
            updatePreview = addLoadedImagePreview(elem, getFullPath(), 'output', node);
        }
        
        // Add widgets
        const groupElem = document.createElement('div');
        groupElem.classList.add('comfy-mobile-form-group');
        
        for (const widget of node.widgets) {
            if (widget.hidden || widget.type === 'converted-widget') continue;
            
            const widgetWrapper = document.createElement('div');
            widgetWrapper.classList.add('comfy-mobile-form-widget-wrapper');
            
            addTitle(widgetWrapper, widget.name);
            
            // Wrap callback for image or subfolder widgets to update preview
            if ((widget === imageWidget || widget === subfolderWidget) && updatePreview) {
                const originalCallback = widget.callback;
                widget.callback = (value) => {
                    updatePreview(getFullPath());
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
    
    // LoadVideo (core) - Video preview from input folder
    registry.registerNodeHandler('LoadVideo', (context) => {
        const { elem, node, addTitle, addWidget, addLoadedVideoPreview } = context;
        
        addTitle(elem, node.title || 'Load Video', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        const videoWidget = node.widgets.find(w => w.name === 'file' || w.name === 'video');
        
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
    
    // LoadAudio - Audio preview from input folder
    registry.registerNodeHandler('LoadAudio', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Load Audio', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        const audioWidget = node.widgets.find(w => w.name === 'audio');
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
    
    // WebcamCapture - Show info display
    registry.registerNodeHandler('WebcamCapture', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Webcam Capture', node);
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">📷</div>
            <div class="comfy-mobile-form-info-text">Webcam capture - image captured when workflow runs</div>
        `;
        elem.appendChild(infoElem);
        
        // Add widgets (like capture_on_queue toggle)
        if (Array.isArray(node.widgets)) {
            const groupElem = document.createElement('div');
            groupElem.classList.add('comfy-mobile-form-group');
            
            for (const widget of node.widgets) {
                if (widget.hidden || widget.type === 'converted-widget') continue;
                if (widget.name === 'image') continue; // Skip the webcam image widget
                
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
    
    // RecordAudio - Show info display
    registry.registerNodeHandler('RecordAudio', (context) => {
        const { elem, node, addTitle, addWidget } = context;
        
        addTitle(elem, node.title || 'Record Audio', node);
        
        // Show info
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">🎤</div>
            <div class="comfy-mobile-form-info-text">Audio recording - record in ComfyUI when workflow runs</div>
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
    
    // PreviewAny - Text display
    registry.registerNodeHandler('PreviewAny', (context) => {
        const { elem, node, addTitle } = context;
        
        addTitle(elem, node.title || 'Preview Any', node);
        
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">📝</div>
            <div class="comfy-mobile-form-info-text">Text preview - displays value after execution</div>
        `;
        elem.appendChild(infoElem);
        
        return true;
    });
    
    // ============================================
    // WIDGET HANDLERS
    // ============================================
    
    // Audio upload widget
    registry.registerWidgetHandler(['audio', 'audioupload'], (context) => {
        const { elem, widget } = context;
        
        // Create a file select dropdown similar to image upload
        const container = document.createElement('div');
        container.classList.add('comfy-mobile-form-audio-upload');
        
        if (widget.options?.values && Array.isArray(widget.options.values)) {
            const select = document.createElement('select');
            select.classList.add('comfy-mobile-form-select');
            
            for (const value of widget.options.values) {
                const option = document.createElement('option');
                option.value = String(value);
                option.textContent = String(value);
                if (value === widget.value) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
            
            select.addEventListener('change', () => {
                widget.value = select.value;
                if (widget.callback) {
                    widget.callback(select.value);
                }
            });
            
            container.appendChild(select);
        }
        
        // Add audio player preview if we have a value
        if (widget.value) {
            const audioUrl = getViewUrl(String(widget.value), 'input');
            const player = createAudioPlayer(audioUrl);
            container.appendChild(player);
        }
        
        elem.appendChild(container);
        return true;
    });
    
    // WEBCAM widget type
    registry.registerWidgetHandler('webcam', (context) => {
        const { elem } = context;
        
        const infoElem = document.createElement('div');
        infoElem.classList.add('comfy-mobile-form-info');
        infoElem.innerHTML = `
            <div class="comfy-mobile-form-info-icon">📷</div>
            <div class="comfy-mobile-form-info-text">Webcam input</div>
        `;
        elem.appendChild(infoElem);
        return true;
    });
    
    // ============================================
    // OUTPUT NODE TYPES
    // ============================================
    
    // Register standard output node types (use default image/video/gif handling)
    registry.registerOutputNodeType([
        'PreviewImage',
        'SaveImage',
        'PreviewVideo',
        'SaveVideo',
        'SaveWEBM',
        'SaveAnimatedWEBP',
        'SaveAnimatedPNG',
        'MaskPreview',
    ]);
    
    // PreviewAudio / SaveAudio - Custom audio output handler
    registry.registerOutputHandler(['PreviewAudio', 'SaveAudio', 'SaveAudioMP3', 'SaveAudioOpus'], (context) => {
        const { container, output, nodeTitle } = context;
        
        if (!output.audio || !Array.isArray(output.audio)) return false;
        
        for (const audioFile of output.audio) {
            const itemElem = document.createElement('div');
            itemElem.classList.add('comfy-mobile-form-output-item', 'comfy-mobile-form-output-audio');
            
            const titleElem = document.createElement('div');
            titleElem.classList.add('comfy-mobile-form-output-title');
            titleElem.textContent = nodeTitle;
            itemElem.appendChild(titleElem);
            
            const audioUrl = getViewUrl(audioFile.filename, audioFile.type || 'output', audioFile.subfolder || '');
            const player = createAudioPlayer(audioUrl);
            itemElem.appendChild(player);
            
            container.appendChild(itemElem);
        }
        
        return true;
    });
}

// Register the extension
ExtensionRegistry.registerExtension('core', initCoreExtension);

export default initCoreExtension;

