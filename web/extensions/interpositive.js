// @ts-check

/**
 * InterPositive Extension - Handles InterPositiveHelpers custom nodes
 * 
 * Supported nodes:
 * - LoadImageVideoIO
 * - SaveImageVideoIO
 * - VideoPreviewIO
 * - MMAudio nodes
 * - CombineVideoAndAudio
 */

import { ExtensionRegistry, defineNodes } from './registry.js';

/**
 * Initialize the InterPositive extension
 * @param {ExtensionRegistry} registry 
 */
export function initInterPositiveExtension(registry) {
    // ============================================
    // DECLARATIVE NODE DEFINITIONS
    // ============================================
    
    defineNodes(registry, {
        // MMAudio loaders
        'MMAudioModelLoader, MMAudioVoCoderLoader, MMAudioFeatureUtilsLoader': {
            title: 'MMAudio Loader',
            info: { icon: '🎵', text: 'MMAudio model loader' }
        },
        
        // MMAudio sampler
        'MMAudioSampler': {
            title: 'MMAudio Sampler',
            info: { icon: '🎧', text: 'Generate audio from video' }
        },
        
        // Video + Audio combiner
        'CombineVideoAndAudio': {
            title: 'Combine Video & Audio',
            info: { icon: '🎬', text: 'Combine video with audio track' }
        }
    });
    
    // ============================================
    // CUSTOM NODE HANDLERS (special logic needed)
    // ============================================
    
    // LoadImageVideoIO - Dynamic image/video detection based on file extension
    registry.registerNodeHandler('LoadImageVideoIO', (context) => {
        const { elem, node, addTitle, addWidget, addLoadedImagePreview, addLoadedVideoPreview, isWidgetHidden } = context;
        
        addTitle(elem, node.title || 'Load Image/Video', node);
        
        if (!Array.isArray(node.widgets)) return true;
        
        // Find the file widget
        const fileWidget = node.widgets.find(w => 
            w.name === 'file' || w.name === 'image' || w.name === 'video' || w.name === 'input_path'
        );
        
        // Create preview container for dynamic updates
        const previewContainer = document.createElement('div');
        previewContainer.classList.add('comfy-mobile-form-dynamic-preview');
        elem.appendChild(previewContainer);
        
        // Update preview based on file type
        const updatePreview = (filename) => {
            if (!filename) return;
            const isVideo = /\.(mp4|webm|mov|avi|mkv|gif)$/i.test(String(filename).toLowerCase());
            
            // Clear and re-add preview
            previewContainer.innerHTML = '';
            if (isVideo) {
                addLoadedVideoPreview(previewContainer, String(filename), 'input', node);
            } else {
                addLoadedImagePreview(previewContainer, String(filename), 'input', node);
            }
        };
        
        // Initial preview
        if (fileWidget?.value) {
            updatePreview(fileWidget.value);
        }
        
        // Add widgets
        const groupElem = document.createElement('div');
        groupElem.classList.add('comfy-mobile-form-group');
        
        for (const widget of node.widgets) {
            if (widget.hidden || widget.type === 'converted-widget') continue;
            if (isWidgetHidden?.(widget.name)) continue;
            
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
    
    // ============================================
    // OUTPUT NODE TYPES
    // ============================================
    
    registry.registerOutputNodeType([
        'SaveImageVideoIO',
        'VideoPreviewIO',
        'SaveVideoWithFilename',
    ]);
}

// Register the extension
ExtensionRegistry.registerExtension('interpositive', initInterPositiveExtension);

export default initInterPositiveExtension;
