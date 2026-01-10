export type ComfyUIApp = {
    graph: ComfyUIGraph;
    queuePrompt: (number?: number) => Promise<void>;
    menu?: {
        settingsGroup?: {
            element: HTMLElement;
        };
    };
};

export interface ComfyUIGraph {
    _groups: ComfyUIGraphGroup[];
    _nodes: ComfyUIGraphNode[];
    getNodeById: (id: number) => ComfyUIGraphNode | null;
}

export interface ComfyUIGraphGroup {
    title: string;
    _bounding: Float32Array | [number, number, number, number];
}

export interface ComfyUIGraphNode {
    id: number;
    title: string;
    type: string;
    pos: Float32Array | [number, number];
    size: Float32Array | [number, number];
    widgets?: ComfyUIGraphWidget[];
    widgets_values?: any[];
    images?: Array<{
        filename: string;
        subfolder?: string;
        type?: string;
    }>;
    imgs?: HTMLImageElement[];
}

export interface ComfyUIGraphWidget {
    name: string;
    type: WidgetType;
    value: any;
    options?: WidgetOptions;
    callback?: (value: any) => void;
    hidden?: boolean;
}

export type WidgetType = 
    | 'combo'
    | 'number'
    | 'float'
    | 'int'
    | 'string'
    | 'text'
    | 'customtext'
    | 'multiline'
    | 'boolean'
    | 'toggle'
    | 'button'
    | 'slider'
    | 'seed'
    | 'image'
    | 'imageupload'
    | 'video'
    | 'videoupload'
    | 'converted-widget'
    | string;

export interface WidgetOptions {
    values?: string[] | (() => string[]);
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    multiline?: boolean;
    dynamicPrompts?: boolean;
    placeholder?: string;
    maxLength?: number;
}

export interface ComfyUIApi {
    addEventListener: (event: string, callback: (event: CustomEvent) => void) => void;
    removeEventListener: (event: string, callback: (event: CustomEvent) => void) => void;
    interrupt: () => Promise<void>;
    fetchApi: (url: string, options?: RequestInit) => Promise<Response>;
}

declare global {
    interface Window {
        MobileFormUI: {
            show: () => void;
            hide: () => void;
            toggle: () => void;
            isVisible: () => boolean;
        };
    }
}
