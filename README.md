# ComfyUI Forms

> **The Ultimate Form Interface for ComfyUI** — Transform your complex workflows into beautiful, user-friendly forms with real-time output previews, customizable layouts, and a stunning modern UI.

<div align="center">

![Mobile UI Example](./docs/example-ui.png)

**Turn any ComfyUI workflow into an intuitive form interface**

</div>

---

## ✨ Features at a Glance

| Feature | Description |
|---------|-------------|
| 📱 **Mobile-First** | Touch-optimized design with large tap targets |
| 🖥️ **Desktop Support** | Side panel mode for split-view editing |
| 🎨 **Customizable Layouts** | Per-widget width, height, color, and positioning |
| 🔍 **Smart Search** | Filter widgets instantly by name (`/` shortcut) |
| 📦 **Batch Queue** | Queue multiple runs with auto-incrementing seeds |
| ⌨️ **Keyboard Shortcuts** | Full keyboard navigation support |
| 🎯 **Drag & Drop** | Reorganize widgets with intuitive drag-and-drop |
| 💾 **Workflow Persistence** | Layout settings saved with your workflow |
| 🎬 **Output Gallery** | Grid/list views, copy to clipboard, fullscreen preview |
| 🔔 **Live Status** | Real-time progress with node count (3/15) and ETA |
| 🎚️ **Field Visibility** | Show/hide individual widgets per node |
| 💡 **Custom Tooltips** | Add helpful hints to any widget |
| ⏭️ **Node Bypass** | Toggle bypass directly from the form |
| 📁 **Collapsible Sections** | Organize widgets into collapsible groups |
| ♿ **Accessible** | ARIA labels, focus trapping, keyboard navigation |

---

## 🚀 What's New (v2.0)

### Layout Customization
- **Per-widget settings**: Customize width (1-4 columns), height, and color for each widget
- **Context menu**: Click any widget's ⚙️ dot to access settings
- **Bypass nodes**: Toggle bypass directly from the form with visual feedback
- **Collapsible sections**: Organize widgets into collapsible groups
- **Custom tooltips**: Add helpful hints to any widget
- **Field visibility**: Show/hide individual fields within any node

### Enhanced Outputs
- **Gallery views**: Toggle between grid and list layouts
- **Copy to clipboard**: One-click copy images to clipboard
- **Video support**: Full video playback with error handling
- **Clear outputs**: Remove all outputs with confirmation dialog
- **Fullscreen preview**: Click any output for fullscreen viewing

### Productivity Features
- **Batch queue**: Queue multiple runs with seed increment (`Shift+Q` to open)
- **Search/filter**: Find widgets instantly with `/` shortcut
- **Keyboard shortcuts**: `Q` queue, `E` edit mode, `Tab` switch tabs
- **Status bar**: Node progress (3/15), ETA, and completion time

### Quality of Life
- **Persistent settings**: All customizations saved with workflow
- **Smooth animations**: Section collapse, widget fade-in, progress pulse
- **Empty states**: Beautiful illustrated guides when getting started
- **Confirmation dialogs**: Protect against accidental data loss
- **Inline renaming**: Double-click titles to rename nodes

---

## 📦 Installation

### Via ComfyUI Manager (Recommended)
1. Open ComfyUI Manager
2. Search for "**ComfyUI-Forms**"
3. Click **Install**
4. Restart ComfyUI

### Manual Installation
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/123jimin/ComfyUI-Forms
```

---

## 🎯 Quick Start

### 1. Create a Mobile Form Group
Create a group in your workflow named one of:
- `Mobile Form`
- `Mobile UI`
- `Mobile Inputs`

### 2. Add Your Nodes
Place input nodes inside the group:
- Primitive nodes (strings, numbers, etc.)
- KSampler for settings like steps, cfg
- Load Image/Video nodes
- Any node with configurable widgets

### 3. Create an Outputs Group (Optional)
Create a group named:
- `Mobile Outputs` (recommended)
- `Outputs`

Place your output nodes inside (SaveImage, PreviewImage, VHS_VideoCombine, etc.)

### 4. Add Settings Node (Recommended)
Add a `MobileFormSettings` node to your workflow. This saves all your widget customizations with the workflow file.

### 5. Open the Form
- **Mobile**: Add `#mobile` to URL or tap the 📱 icon in the sidebar
- **Desktop**: Click the "Form" button in the menu bar

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Q` | Queue prompt |
| `Shift+Q` | Queue to front |
| `E` | Toggle edit mode (drag & drop reordering) |
| `Tab` | Switch between Inputs/Outputs tabs |
| `/` | Focus search bar |
| `Escape` | Close dialogs → Exit edit mode → Close form |

---

## 🎨 Customizing Widgets

### Accessing Widget Settings
Click the ⚙️ dot on any widget to open the context menu:

**Layout**
| Option | Description |
|--------|-------------|
| **Width** | Set column span (1-4) |
| **Height** | Auto, Compact, Medium, or Tall |
| **Color** | 12+ colors: blue, green, purple, pink, amber, red, cyan, indigo, violet, teal, rose, orange |
| **New Row** | Start this widget on a new line |

**Actions**
| Option | Description |
|--------|-------------|
| **Bypass Node** | Toggle node bypass on/off (greyed out when bypassed) |
| **Edit Tooltip** | Add custom help text |
| **Rename** | Change the display name (double-click title also works) |
| **Move Up/Down** | Reorder widgets |

**Advanced**
| Option | Description |
|--------|-------------|
| **Show/Hide Fields** | Toggle visibility of individual widgets within a node |

### Layout Tips
1. **Use subgroups**: Nodes in subgroups within Mobile Form automatically get grouped into sections with matching colors
2. **Color coding**: Use colors to categorize related settings (e.g., all prompt fields in purple)
3. **Row breaks**: Add "New Row" to logically separate widget groups
4. **Column widths**: Wide widgets (2-4) work great for prompts and images
5. **Hide clutter**: Use Show/Hide Fields to hide widgets you rarely change

---

## 📤 Output Features

### Gallery Controls
- **Grid/List toggle**: Switch between thumbnail grid and detailed list view
- **Fullscreen**: Click any output to view fullscreen
- **Copy**: Copy images directly to clipboard (📋 button)
- **Download**: Save outputs with original filename
- **Clear**: Remove all outputs with confirmation

### Video Support
Full support for video outputs from nodes like:
- VHS_VideoCombine
- SaveVideo
- Animated WebP/GIF outputs

---

## 📦 Batch Queue

Queue multiple generations with automatic seed increment:

1. Click the **Batch** button (grid icon)
2. Set number of runs (1-100)
3. Enable "Increment seed for each run"
4. Click **Queue Batch**

Each run will use an incrementing seed value, perfect for generating variations!

---

## 💾 Saving Your Layout

### Automatic Persistence
Add a `MobileFormSettings` node to your workflow. All widget customizations are automatically saved:
- Width, height, color settings
- Widget order
- Row breaks
- Custom tooltips
- Hidden fields
- Section collapse states

### Migration from v1
If you have existing localStorage settings, they'll automatically migrate to your workflow the first time you add the MobileFormSettings node.

---

## 🔌 Extension System

ComfyUI-Forms uses a powerful declarative extension system for supporting custom nodes.

### Built-in Support
- **Core ComfyUI**: All standard nodes (LoadImage, LoadVideo, LoadAudio, etc.)
- **VHS (Video Helper Suite)**: VHS_LoadVideo, VHS_VideoCombine, LoadVideoUpload
- **KJNodes**: LoadAndResizeImage, LoadImagesFromFolderKJ, LoadVideosFromFolder
- **InterPositive**: LoadImageVideoIO, MMAudio nodes, CombineVideoAndAudio

### Creating Custom Extensions

Extensions use a simple declarative API:

```javascript
import { ExtensionRegistry, defineNodes } from './extensions/registry.js';

// Define multiple nodes at once
defineNodes(registry, {
    // Image preview + all widgets
    'MyLoadImage': {
        title: 'My Image Loader',
        preview: { type: 'image', widget: 'image', folder: 'input' }
    },
    
    // Video preview with subfolder support
    'MyLoadVideo': {
        title: 'My Video Loader',
        preview: { 
            type: 'video', 
            widget: 'video_path', 
            folder: 'output',
            subfolderWidget: 'subfolder'
        }
    },
    
    // Info banner + widgets
    'MyBatchLoader': {
        title: 'Batch Loader',
        info: { icon: '📁', text: 'Load files from a directory' }
    },
    
    // Custom handler for complex logic
    'MySpecialNode': {
        custom: (context) => {
            const { elem, node, addTitle, addWidget } = context;
            // Custom rendering logic
            addTitle(elem, 'Special Node', node);
            return true;
        }
    }
});

// Register output node types
registry.registerOutputNodeType(['MySaveImage', 'MyPreviewVideo']);
```

### Configuration Options

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Display title (fallback: node.title) |
| `preview.type` | `'image' \| 'video' \| 'audio'` | Media type for preview |
| `preview.widget` | `string \| string[]` | Widget name(s) containing filename |
| `preview.folder` | `'input' \| 'output' \| 'temp'` | File location |
| `preview.subfolderWidget` | `string \| string[]` | Widget for subfolder path |
| `info.icon` | `string` | Icon emoji for info banner |
| `info.text` | `string` | Description text |
| `skipWidgets` | `string[]` | Widget names to exclude |
| `custom` | `function` | Custom handler (overrides all other config) |

---

## 🎛️ Settings

Access settings via the ⚙️ button next to the Form menu item:

| Setting | Description |
|---------|-------------|
| Auto-show on mobile | Automatically display form on mobile devices |
| Side panel mode | Show form as side panel instead of overlay |

---

## 🔧 Troubleshooting

### Form not appearing?
- Ensure you have a group named "Mobile Form" or similar
- Check that nodes are fully inside the group boundaries
- Try adding `#mobile` to your URL

### Widgets missing?
- Converted (socket) widgets don't show in the form
- Hidden widgets are excluded
- Check Show/Hide Fields in context menu
- Some widget types may not be supported yet

### Outputs not showing?
- Create a "Mobile Outputs" group
- Place output nodes inside the group
- Run the workflow to generate outputs
- Outputs persist between page reloads

### Layout not saving?
- Add a `MobileFormSettings` node to your workflow
- Save the workflow after customizing

### Video thumbnails broken?
- Check the video file exists in the output folder
- Video files embedded in the `images` array are auto-detected
- Supported formats: .mp4, .webm, .mov, .avi, .mkv

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development
```bash
# Clone the repo
git clone https://github.com/123jimin/ComfyUI-Forms
cd ComfyUI-Forms

# The extension uses vanilla JavaScript with JSDoc types
# No build step required - edit files directly
```

### Project Structure
```
ComfyUI-Forms/
├── __init__.py           # Python node definitions
├── web/
│   ├── index.js          # Main entry point
│   ├── ui.js             # Form UI logic
│   ├── widget.js         # Widget rendering & settings
│   ├── outputs.js        # Output gallery management
│   ├── style.css         # All styles
│   ├── constants.js      # Shared constants
│   └── extensions/
│       ├── registry.js   # Extension system core
│       ├── core.js       # Core ComfyUI nodes
│       ├── vhs.js        # VHS node support
│       ├── kjnodes.js    # KJNodes support
│       └── interpositive.js  # InterPositive support
```

---

## 📜 License

MIT License - See [LICENSE](./LICENSE) for details.

---

## 🙏 Credits

- Originally created by [123jimin](https://github.com/123jimin)
- Enhanced with extensive features by the community
- Built for the amazing ComfyUI ecosystem

---

<div align="center">

**Made with ❤️ for the ComfyUI Community**

[Report Bug](https://github.com/123jimin/ComfyUI-Forms/issues) · [Request Feature](https://github.com/123jimin/ComfyUI-Forms/issues)

</div>
