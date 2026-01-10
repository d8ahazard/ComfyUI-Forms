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
| 🔍 **Smart Search** | Filter widgets instantly by name |
| 📦 **Batch Queue** | Queue multiple runs with auto-incrementing seeds |
| ⌨️ **Keyboard Shortcuts** | Full keyboard navigation support |
| 🎯 **Drag & Drop** | Reorganize widgets with intuitive drag-and-drop |
| 💾 **Workflow Persistence** | Layout settings saved with your workflow |
| 🎬 **Output Gallery** | Grid/list views, copy to clipboard, fullscreen preview |
| 🔔 **Live Status** | Real-time progress, node count, and ETA |
| ♿ **Accessible** | ARIA labels, focus trapping, keyboard navigation |

---

## 🚀 What's New (v2.0)

### Layout Customization
- **Per-widget settings**: Customize width (1-4 columns), height, and color for each widget
- **Context menu**: Right-click any widget's ⚙️ dot to access settings
- **Bypass nodes**: Toggle bypass directly from the form with visual feedback
- **Collapsible sections**: Organize widgets into collapsible groups
- **Custom tooltips**: Add helpful hints to any widget

### Enhanced Outputs
- **Gallery views**: Toggle between grid and list layouts
- **Copy to clipboard**: One-click copy images to clipboard
- **Video support**: Full video playback with error handling
- **Clear outputs**: Remove all outputs with confirmation dialog

### Productivity Features
- **Batch queue**: Queue multiple runs with seed increment
- **Search/filter**: Find widgets instantly with `/` shortcut
- **Keyboard shortcuts**: `Q` queue, `E` edit mode, `Tab` switch tabs
- **Status bar**: Node progress (3/15), ETA, and completion time

### Quality of Life
- **Persistent settings**: All customizations saved with workflow
- **Smooth animations**: Section collapse, widget fade-in, progress pulse
- **Empty states**: Beautiful illustrated guides when getting started
- **Confirmation dialogs**: Protect against accidental data loss

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
git clone https://github.com/your-repo/ComfyUI-Forms
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

### 4. Open the Form
- **Mobile**: Add `#mobile` to URL or tap the 📱 icon in the sidebar
- **Desktop**: Click the "Form" button in the menu bar

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Q` | Queue prompt |
| `Shift+Q` | Queue to front |
| `E` | Toggle edit mode |
| `Tab` | Switch between Inputs/Outputs |
| `/` | Focus search bar |
| `Escape` | Close dialogs / exit edit mode |

---

## 🎨 Customizing Widgets

### Accessing Widget Settings
Click the ⚙️ dot on any widget to open the context menu:

- **Width**: Set column span (1-4)
- **Height**: Auto, Compact, Medium, or Tall
- **Color**: 12+ colors including blue, green, purple, pink, amber
- **New Row**: Start this widget on a new line
- **Bypass Node**: Toggle node bypass on/off
- **Move**: Reorder widgets up/down
- **Edit Tooltip**: Add custom help text

### Layout Tips
1. **Use subgroups**: Nodes in subgroups within Mobile Form automatically get grouped into sections
2. **Color coding**: Use colors to categorize related settings
3. **Row breaks**: Add "new row" to logically separate widget groups
4. **Column widths**: Wide widgets (2-4) work great for prompts and images

---

## 📤 Output Features

### Gallery Controls
- **Grid/List toggle**: Switch between thumbnail grid and detailed list view
- **Fullscreen**: Click any output to view fullscreen
- **Copy**: Copy images directly to clipboard (📋 button)
- **Download**: Save outputs with original filename

### Video Support
Full support for video outputs from nodes like:
- VHS_VideoCombine
- SaveVideo
- Animated WebP/GIF outputs

---

## 📦 Batch Queue

Queue multiple generations with automatic seed increment:

1. Click the **📦 Batch** button
2. Set number of runs (1-100)
3. Enable "Increment seed for each run"
4. Click **Queue Batch**

Each run will use an incrementing seed value, perfect for generating variations!

---

## 💾 Saving Your Layout

### Automatic Persistence
Add a `MobileFormSettings` node to your workflow. All widget customizations (width, height, color, order, tooltips) are automatically saved with the workflow file.

### Migration from v1
If you have existing localStorage settings, they'll automatically migrate to your workflow the first time you add the MobileFormSettings node.

---

## 🔌 Extension System

ComfyUI-Forms supports additional node packs through its extension system:

### Built-in Support
- **Core ComfyUI**: All standard nodes
- **VHS (Video Helper Suite)**: Video combine, load video
- **KJNodes**: Special input types
- **InterPositive**: Custom helpers

### Adding Custom Extensions
Extensions can register handlers for custom node types, widgets, and outputs:

```javascript
import { ExtensionRegistry } from './extensions/registry.js';

ExtensionRegistry.registerNodeHandler('MyCustomNode', (elem, node) => {
  // Create custom widget UI
  return true;
});
```

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
- Some widget types may not be supported yet

### Outputs not showing?
- Create a "Mobile Outputs" group
- Place output nodes inside the group
- Run the workflow to generate outputs

### Layout not saving?
- Add a `MobileFormSettings` node to your workflow
- Save the workflow after customizing

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development
```bash
# Clone the repo
git clone https://github.com/your-repo/ComfyUI-Forms
cd ComfyUI-Forms

# The extension uses vanilla JavaScript with JSDoc types
# No build step required - edit files directly
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

[Report Bug](https://github.com/your-repo/ComfyUI-Forms/issues) · [Request Feature](https://github.com/your-repo/ComfyUI-Forms/issues)

</div>
