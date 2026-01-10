# ComfyUI MobileForm

A fully-featured form interface extension for [ComfyUI](https://github.com/comfyanonymous/ComfyUI) that provides a clean, mobile-friendly UI for controlling workflows and viewing outputs.

![Mobile UI Example](./docs/example-ui.png)

## Features

### Input Support
- **All native widget types**: Numbers, text, dropdowns, toggles, sliders, seeds, and more
- **Smart number inputs**: With increment/decrement buttons, min/max/step constraints
- **Multi-line text**: Auto-resizing textareas for prompts
- **Searchable dropdowns**: For lists with many options
- **Image upload**: With drag-drop, file picker, and camera capture on mobile
- **Video upload**: Full video file support

### Output Display
- **Real-time previews**: See generated images and videos as they complete
- **Gallery view**: Scrollable grid of all outputs
- **Fullscreen preview**: Tap to view images/videos in fullscreen
- **Download buttons**: Quick download of any output
- **Progress tracking**: Live progress bar and status updates

### User Interface
- **Mobile-first design**: Touch-optimized with large tap targets
- **Desktop support**: Side panel mode for desktop use
- **Dark theme**: Automatically inherits ComfyUI's theme
- **Tabs**: Switch between Inputs and Outputs
- **Queue controls**: Queue, Queue to Front, and Cancel buttons built-in

## Installation

### Via ComfyUI Manager
1. Open ComfyUI Manager
2. Search for "MobileForm"
3. Click Install

### Manual Installation
Clone this repository into your `custom_nodes` directory:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/123jimin/ComfyUI-MobileForm
```

## How to Use

### Setting Up Input Groups

1. Create a group in your workflow named **"Mobile Form"**, **"Mobile UI"**, or **"Mobile Inputs"**
2. Place input nodes inside the group (primitives, samplers, etc.)
3. The form will automatically generate controls for all widgets

### Setting Up Output Groups

1. Create a group named **"Outputs"** or **"Mobile Outputs"**
2. Place output nodes inside (PreviewImage, SaveImage, VHS_VideoCombine, etc.)
3. Generated outputs will appear in the Outputs tab

### Accessing the Form

**On Mobile:**
- Add `#mobile` to your URL to auto-show the form
- Or tap the mobile phone icon in the sidebar

**On Desktop:**
- Click the "Form" button in the top menu bar
- Or click the mobile phone icon in the sidebar
- Use the settings to enable "Side panel mode" for a split view

### Keyboard Shortcut

You can access the form programmatically:

```javascript
window.MobileFormUI.toggle()  // Toggle visibility
window.MobileFormUI.show()    // Show the form
window.MobileFormUI.hide()    // Hide the form
```

## Supported Widget Types

| Widget Type | Form Control | Features |
|-------------|--------------|----------|
| `combo` | Dropdown select | Searchable for long lists |
| `number` | Number input | +/- buttons, min/max/step |
| `INT` | Integer input | Whole numbers only |
| `FLOAT` | Decimal input | Configurable precision |
| `string`/`text` | Text input | Single line |
| `customtext` | Textarea | Multi-line, auto-resize |
| `boolean`/`toggle` | Toggle switch | On/Off |
| `button` | Button | Triggers callbacks |
| `slider` | Range slider | Visual value selection |
| `seed` | Seed input | Random button + last seed |
| `image` | File upload | Drag-drop, camera |
| `video` | File upload | Video files |

## Supported Output Nodes

- PreviewImage
- SaveImage
- VHS_VideoCombine
- ADE_AnimateDiffCombine
- SaveAnimatedWEBP
- SaveAnimatedPNG
- CR Image Output
- And more...

## Settings

Access settings via the gear icon next to the Form button:

- **Auto-show on mobile**: Automatically show form view on mobile devices
- **Side panel mode**: Display as a side panel instead of fullscreen (desktop)

## Example Workflow

![Workflow Example](./docs/example-workflow.png)

A simple SDXL workflow with:
- Input group containing: prompt, seed, steps, cfg
- Output group containing: PreviewImage node

## Tips

1. **Organize nodes by rows**: Nodes at similar Y positions will appear in the same row
2. **Use descriptive titles**: Node titles become form labels
3. **Collapse complex nodes**: Nodes with 3+ widgets auto-collapse with an expand button
4. **Use Note nodes**: Add instructions or descriptions to your form

## Troubleshooting

**Form not showing?**
- Make sure you have a group titled "Mobile Form" or "Mobile UI"
- Try adding `#mobile` to your URL and refreshing
- Check browser console for errors

**Widgets not appearing?**
- Ensure nodes are inside the group bounds (top-left corner must be in the group)
- Some converted or hidden widgets may not display

**Outputs not showing?**
- Make sure output nodes are in an "Outputs" group
- Run the workflow first to generate outputs

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Credits

Originally created by [123jimin](https://github.com/123jimin).
Enhanced with full widget support, output display, and desktop UI.
