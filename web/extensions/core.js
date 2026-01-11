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

import { ExtensionRegistry, defineNodes, createAudioPlayer, getViewUrl } from './registry.js';

/**
 * Initialize the core extension
 * @param {ExtensionRegistry} registry 
 */
export function initCoreExtension(registry) {
    // ============================================
    // DECLARATIVE NODE DEFINITIONS
    // ============================================
    
    defineNodes(registry, {
        // Image loading nodes
        'LoadImage, LoadImageMask': {
            title: 'Load Image',
            preview: { type: 'image', widget: 'image', folder: 'input' }
        },
        
        'LoadImageOutput, LoadImageFromOutputFolder, Load Image From Output Folder': {
            title: 'Load Image (Output)',
            preview: { 
                type: 'image', 
                widget: ['image', 'filename', 'file'], 
                folder: 'output',
                subfolderWidget: ['subfolder', 'folder']
            }
        },
        
        // Video loading
        'LoadVideo': {
            title: 'Load Video',
            preview: { type: 'video', widget: ['file', 'video'], folder: 'input' }
        },
        
        // Audio loading
        'LoadAudio': {
            title: 'Load Audio',
            preview: { type: 'audio', widget: 'audio', folder: 'input' }
        },
        
        // Info-only nodes
        'WebcamCapture': {
            title: 'Webcam Capture',
            info: { icon: '📷', text: 'Webcam capture - image captured when workflow runs' },
            skipWidgets: ['image']
        },
        
        'RecordAudio': {
            title: 'Record Audio',
            info: { icon: '🎤', text: 'Audio recording - record in ComfyUI when workflow runs' }
        },
        
        'PreviewAny': {
            title: 'Preview Any',
            info: { icon: '📝', text: 'Text preview - displays value after execution' }
        }
    });
    
    // ============================================
    // CUSTOM NODE HANDLERS (special logic needed)
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
    
    // Note - Shows text content (no editable widgets)
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
    
    // ============================================
    // WIDGET HANDLERS
    // ============================================
    
    // Audio upload widget
    registry.registerWidgetHandler(['audio', 'audioupload'], (context) => {
        const { elem, widget } = context;
        
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
