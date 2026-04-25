# VideoMark — YouTube Video Annotations

Add high-precision, color-coded notes to any YouTube video. Your annotations are saved locally per video.

## Install

1. Download/clone this repo
2. Open Chrome, go to `chrome://extensions`
3. Turn on "Developer mode" (top-right toggle)
4. Click "Load unpacked" → select this folder
5. Extension now active on youtube.com

## Usage

### Add Annotation
- **Right-click on seekbar** → click "Add"
- Type annotation (max 180 chars)
- Pick color (yellow, red, blue, green, purple)
- Click "Save" or Enter
- Pip appears on seekbar at current timestamp
- **Alternate:** Press **Alt+N** (Mac: **Option+N**) to add at current time

### Navigate to Annotation
- **Click pip** or **click tooltip** → video seeks to that timestamp
- Tooltip appears when hovering near pip (stays visible briefly when moving to click it)

### Edit/Delete
- Hover over pip on seekbar → tooltip shows note
- Right-click seekbar → "Edit" to modify or "Delete" to remove
- Character limit enforced; warning turns text red at 160+ chars

### Export Annotations
- Right-click seekbar → "Export"
- Downloads `.videomark` JSON file with all notes for this video

### Import Annotations
- Right-click seekbar → "Import"
- Select `.videomark` file or drag-drop into dialog
- Matching timestamps overwrite existing notes

## Design

- **Glassmorphic UI**: semi-transparent popups with blur, blends with page
- **Seekbar Integration**: pips sized 3px wide, scales on hover for better targeting
- **Viewport-Aware**: popups auto-position to stay on-screen, context menu flips in fullscreen
- **No Interruptions**: annotations don't pause/resume video

## Data

Notes stored in browser's local storage, keyed by video ID. Exported `.videomark` files are plain JSON:

```json
[
  { "time": 45.5, "text": "Key moment", "color": "red" },
  { "time": 120, "text": "Definition", "color": "blue" }
]
```

## Context Menu

Right-click on seekbar for quick access:
- **Add** — Create new annotation
- **Edit** — Modify existing annotation (hover pip first)
- **Delete** — Remove annotation
- **Import** — Load .videomark file
- **Export** — Save annotations to file

## Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| Alt+N (Mac: Opt+N) | New annotation at current time |

## Compatibility

- Chrome/Edge only (MV3 extension)
- Tested on Mac + Linux
- Works with YouTube's built-in chapters/ads without interference

## Troubleshooting

**Alt+N not working?**
- Ensure extension is loaded (check `chrome://extensions`)
- Hard-refresh YouTube tab (Cmd+Shift+R on Mac)
- On Mac, use Option key, not Alt

**Pips not showing?**
- Reload extension and refresh YouTube
- Check DevTools console for errors

**Context menu not appearing?**
- Use right-click directly on the seekbar (the gray progress bar)
- Fullscreen mode? It will flip upward if needed

**Import overwrites my notes?**
- Matching timestamps will be replaced; non-matching notes kept
- Export first if unsure
