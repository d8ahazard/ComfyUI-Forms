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

import { ExtensionRegistry, defineNodes } from './registry.js';

/**
 * Initialize the VHS extension
 * @param {ExtensionRegistry} registry 
 */
export function initVHSExtension(registry) {
    // ============================================
    // DECLARATIVE NODE DEFINITIONS
    // ============================================
    
    defineNodes(registry, {
        // Video loading with preview
        'VHS_LoadVideo, LoadVideoUpload': {
            title: 'Load Video (VHS)',
            preview: { type: 'video', widget: ['video', 'video_path'], folder: 'input' }
        },
        
        'LoadVideoFFmpegUpload': {
            title: 'Load Video (FFmpeg)',
            preview: { type: 'video', widget: 'video', folder: 'input' }
        },
        
        // Path-based video loading (info only)
        'LoadVideoPath, LoadVideoFFmpegPath': {
            title: 'Load Video (Path)',
            info: { icon: '🎬', text: 'Path-based video loading' }
        },
        
        // Audio loading with preview
        'VHS_LoadAudio, LoadAudioUpload': {
            title: 'Load Audio (VHS)',
            preview: { type: 'audio', widget: ['audio', 'audio_file'], folder: 'input' }
        },
        
        // Directory loading (info only)
        'LoadImagesFromDirectoryUpload, LoadImagesFromDirectoryPath': {
            title: 'Load Images (Directory)',
            info: { icon: '📁', text: 'Load images from a directory' }
        },
        
        // Path-based image loading (info only)
        'LoadImagePath': {
            title: 'Load Image (Path)',
            info: { icon: '🖼️', text: 'Path-based image loading' }
        }
    });
    
    // ============================================
    // OUTPUT NODE TYPES
    // ============================================
    
    registry.registerOutputNodeType([
        'VHS_VideoCombine',
        'VHS_VideoInfo',
    ]);
}

// Register the extension
ExtensionRegistry.registerExtension('vhs', initVHSExtension);

export default initVHSExtension;
