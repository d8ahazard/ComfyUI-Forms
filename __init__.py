class MobileFormSettings:
    """
    Stores MobileForm layout settings (widget sizes, colors, breaks) as part of the workflow.
    Add this node to your workflow to persist form layout when saving/loading.
    The settings are stored in a hidden multiline text field that the frontend manages.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # Using a visible widget so it persists in widgets_values
                # The frontend will hide this and manage it automatically
                "settings_json": ("STRING", {
                    "default": "{}",
                    "multiline": True,
                    "dynamicPrompts": False
                })
            },
            "optional": {},
        }
    
    RETURN_TYPES = ()
    FUNCTION = "store"
    CATEGORY = "MobileForm"
    OUTPUT_NODE = True
    
    def store(self, settings_json="{}"):
        # This node doesn't execute anything - it just stores settings
        return {}
    
    @classmethod
    def IS_CHANGED(cls, settings_json="{}"):
        # Always consider changed so settings updates persist
        return float("nan")


NODE_CLASS_MAPPINGS = {
    "MobileFormSettings": MobileFormSettings
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MobileFormSettings": "Mobile Form Settings"
}

WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
