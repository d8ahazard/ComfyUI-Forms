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

import { ExtensionRegistry, defineNodes } from './registry.js';

/**
 * Initialize the KJNodes extension
 * @param {ExtensionRegistry} registry 
 */
export function initKJNodesExtension(registry) {
    // ============================================
    // DECLARATIVE NODE DEFINITIONS
    // ============================================
    
    defineNodes(registry, {
        // Image loading with preview
        'LoadAndResizeImage': {
            title: 'Load & Resize Image',
            preview: { type: 'image', widget: 'image', folder: 'input' }
        },
        
        // Folder loading (info only)
        'LoadImagesFromFolderKJ': {
            title: 'Load Images From Folder',
            info: { icon: '📁', text: 'Load images from a folder' }
        },
        
        'LoadVideosFromFolder': {
            title: 'Load Videos From Folder',
            info: { icon: '🎬', text: 'Load videos from a folder' }
        }
    });
    
    // ============================================
    // OUTPUT NODE TYPES
    // ============================================
    
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
