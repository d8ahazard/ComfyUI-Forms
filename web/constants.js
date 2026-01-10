// @ts-check

/**
 * ComfyUI-Forms Constants
 * All magic numbers and configuration values in one place
 */

// ============================================
// Layout Constants
// ============================================

/** Maximum columns in the grid layout */
export const MAX_GRID_COLUMNS = 4;

/** Breakpoint for mobile view (pixels) */
export const MOBILE_BREAKPOINT = 768;

/** Breakpoint for narrow desktop (pixels) */
export const NARROW_BREAKPOINT = 1024;

/** Threshold for detecting row changes based on Y position difference */
export const ROW_THRESHOLD = 30;

// ============================================
// Animation Timing (milliseconds)
// ============================================

/** Standard transition duration */
export const TRANSITION_DURATION = 200;

/** Fast transition duration */
export const TRANSITION_DURATION_FAST = 150;

/** Slow transition duration */
export const TRANSITION_DURATION_SLOW = 300;

/** Delay before resetting progress bar after completion */
export const PROGRESS_RESET_DELAY = 3000;

/** Duration to show success/error feedback */
export const FEEDBACK_DURATION = 2000;

// ============================================
// Retry Intervals (milliseconds)
// ============================================

/** Intervals for retrying image preview loading */
export const IMAGE_RETRY_INTERVALS = [100, 200, 500];

/** Delay before migration check */
export const MIGRATION_DELAY = 500;

// ============================================
// Widget Heights (CSS values)
// ============================================

export const WIDGET_HEIGHTS = {
    auto: 'auto',
    compact: '80px',
    medium: '150px',
    tall: '250px'
};

// ============================================
// Widget Widths (column spans)
// ============================================

export const WIDGET_WIDTHS = ['1', '2', '3', '4'];

// ============================================
// Colors
// ============================================

export const WIDGET_COLORS = [
    'default', 'blue', 'green', 'purple', 'orange', 'cyan', 
    'pink', 'teal', 'amber', 'indigo', 'violet', 'rose', 'red'
];

// ============================================
// Storage Keys
// ============================================

export const STORAGE_KEYS = {
    settings: 'MobileFormSettings',
    outputsView: 'mf-outputs-view',
    sectionCollapsed: 'mf-section-collapsed-',
    autoShowOnMobile: 'mf-auto-show-mobile'
};

// ============================================
// Node Mode Constants
// ============================================

/** Node is active (normal) */
export const NODE_MODE_ACTIVE = 0;

/** Node is bypassed */
export const NODE_MODE_BYPASSED = 4;

// ============================================
// Limits
// ============================================

/** Maximum batch queue count */
export const MAX_BATCH_COUNT = 100;

/** Maximum outputs to show in gallery */
export const MAX_OUTPUTS_DISPLAY = 100;

/** Maximum file size for upload (50MB) */
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

