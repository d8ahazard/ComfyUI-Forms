// @ts-check

/**
 * Extensions Index - Loads and initializes all extensions
 */

import { ExtensionRegistry } from './registry.js';

// Import extensions - they register themselves when imported
import './core.js';
import './vhs.js';
import './kjnodes.js';
import './interpositive.js';

/**
 * Initialize all extensions
 * This should be called once after the DOM is ready
 */
export function initializeExtensions() {
    ExtensionRegistry.initializeExtensions();
}

// Re-export registry for convenience
export { ExtensionRegistry } from './registry.js';
export { createAudioPlayer, getViewUrl, createStandardNodeHandler } from './registry.js';

export default ExtensionRegistry;

