# VideoMark Extension Development

## Project Overview
Chrome extension for high-precision YouTube video annotations. Adds colored pips to seekbar with context-aware popup UI for adding/editing/deleting notes.

## Files
- **manifest.json** — MV3config, content script injection for youtube.com
- **content.js** — Core logic: annotation storage, pip rendering, UI, keyboard/context menu handlers
- **content.css** — Pip styling (3px width, hover transforms, drop-shadow)
- **icons/** — 16x48x128 extension icons (dark circle + white play + yellow pip dot)

## Key Implementation Details

### Storage & Video ID
- YouTube video ID via `URLSearchParams.get('v')`
- Notes stored in chrome.storage.local keyed by videoId
- Structure: `{ time: number, text: string, color: string }[]`

### Pip Rendering & Interaction
- Rendered into `.ytp-progress-list` at `(note.time / duration) * 100` position
- Width: 3px, height: 100% + 2px overflow
- Click pip → seek video to annotation timestamp
- Hover proximity detection (12pt radius) on progress bar mousemove
- Tooltip shows truncated text (max 60 chars) with glassmorphic styling
- Tooltip is clickable → seek to timestamp, persists with 100ms delay when leaving bar/tooltip

### UI Components (Shadow DOM)
- **Add/Edit Popup**: glassmorphic, auto-positioned to viewport edges
  - Textarea + color picker + char counter (max 180 chars, warning at 160+)
  - Alt+N (Mac: Option mapped via e.code==='KeyN') triggers add
- **Context Menu**: right-click on seekbar, viewport-aware positioning
  - Add, Edit, Delete, Import, Export (separator before Import)
  - Import: drag-drop or file picker, overwrites existing notes on duplicate timestamps
  - Export: downloads .videomark JSON file
  - Gray styling (rgba(255,255,255,0.7)) for Import/Export

### Keyboard & Events
- Right-click context menu primary method for all operations (add/edit/delete/import/export)
- Alt+N alternate for new annotation (Mac uses e.code==='KeyN' not e.key)
- Right-click capture phase listener with stopImmediatePropagation
- Textarea stopPropagation on keydown/up/press to prevent YouTube shortcuts
- MutationObserver for SPA navigation, durationchange listener for duration updates

### Character Limits
- Max 180 chars
- Warning (red border) at 160+ chars
- Real-time counter: "X/180"
- Validates on save, prevents exceeding limit

### Viewport Edge Handling
- Add/Edit popup: clamped X to viewport bounds
- Context menu: flips upward if would exceed viewport height

## Mac-Specific Issues Solved
- Alt+N dead key issue: use e.code==='KeyN' instead of e.key
- Keyboard shortcuts conflicting with YouTube (c=subtitles, k=pause): stopPropagation in textarea

## No Build Tool
- Plain JS/CSS, runs directly in browser
- Icons generated programmatically (PNG binary encoded in script during earlier setup)

## Testing
1. Load unpacked extension in Chrome (chrome://extensions → Load unpacked → project root)
2. Navigate to any YouTube video
3. Alt+N to add annotation, right-click seekbar for context menu
4. Fullscreen mode: context menu flips if near bottom edge
5. Import/Export: .videomark JSON files

## Future Considerations
- Sync across devices (Firebase, manual server)
- Bulk operations, advanced filtering, search
- Performance: debounce pip re-renders on rapid note changes
- Deployment: Chrome Web Store review & submission
