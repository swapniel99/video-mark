(() => {
  const COLORS = {
    yellow: '#FFD600',
    red: '#F44336',
    blue: '#2196F3',
    green: '#4CAF50',
    purple: '#9C27B0',
  };
  const DEFAULT_COLOR = 'yellow';

  // --- Storage ---

  function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
  }

  function loadNotes(videoId, cb) {
    chrome.storage.local.get(videoId, (data) => cb(data[videoId] || []));
  }

  function saveNotes(videoId, notes) {
    chrome.storage.local.set({ [videoId]: notes });
  }

  // --- Tooltip ---

  let tooltipEl = null;

  function showTooltip(pip, text, time) {
    hideTooltip();
    tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = `
      position: fixed;
      background: rgba(15,15,25,0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.9);
      font-size: 12px;
      font-family: Inter, sans-serif;
      font-weight: 500;
      padding: 5px 10px;
      border-radius: 8px;
      max-width: 280px;
      word-wrap: break-word;
      white-space: normal;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;
    const truncated = text.length > 60 ? text.substring(0, 60) + '…' : text;
    tooltipEl.textContent = truncated;
    tooltipEl.dataset.pipNote = text;
    tooltipEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const video = document.querySelector('video');
      if (video) video.currentTime = time;
      hideTooltip();
    });
    document.body.appendChild(tooltipEl);

    const rect = pip.getBoundingClientRect();
    const tr = tooltipEl.getBoundingClientRect();
    tooltipEl.style.left = `${rect.left + rect.width / 2 - tr.width / 2}px`;
    tooltipEl.style.top = `${rect.top - tr.height - 6}px`;
  }

  function hideTooltip() {
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  }

  function setupPipHover(bar) {
    const HIT = 12; // px radius around pip center
    bar.addEventListener('mousemove', (e) => {
      const pips = document.querySelectorAll('.videomark-pip');
      let found = null;
      let minDist = HIT;
      pips.forEach(pip => {
        const r = pip.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const dist = Math.abs(e.clientX - cx);
        if (dist < minDist) { minDist = dist; found = pip; }
      });
      if (found) {
        const text = found.dataset.note;
        const time = parseFloat(found.dataset.time);
        if (!tooltipEl || tooltipEl.dataset.pipNote !== text) showTooltip(found, text, time);
      } else {
        hideTooltip();
      }
    });
    bar.addEventListener('mouseleave', hideTooltip);
  }

  // --- Pip rendering ---

  function renderPips(notes, videoId) {
    const bar = document.querySelector('.ytp-progress-list');
    if (!bar) return;

    document.querySelectorAll('.videomark-pip').forEach((el) => el.remove());

    const video = document.querySelector('video');
    if (!video || !video.duration) return;

    notes.forEach((note) => {
      const pct = (note.time / video.duration) * 100;
      const pip = document.createElement('div');
      pip.className = 'videomark-pip';
      pip.style.left = `${pct}%`;
      pip.style.background = COLORS[note.color] || COLORS.yellow;

      pip.dataset.note = note.text;
      pip.dataset.time = note.time;
      pip.dataset.color = note.color;
      pip.addEventListener('click', (e) => {
        e.stopPropagation();
        video.currentTime = note.time;
      });

      bar.appendChild(pip);
    });
  }

  // --- Popup (Shadow DOM) ---

  let popupHost = null;

  function createPopup(x, time, videoId, notes, onSave) {
    removePopup();

    const POPUP_WIDTH = 220;
    const container = document.querySelector('.ytp-chrome-bottom');
    const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth;
    const clampedX = Math.min(Math.max(x, POPUP_WIDTH / 2), containerWidth - POPUP_WIDTH / 2);

    popupHost = document.createElement('div');
    popupHost.id = 'videomark-popup-host';
    popupHost.style.cssText = `
      position: absolute;
      left: ${clampedX}px;
      bottom: 44px;
      z-index: 9999;
      transform: translateX(-50%);
    `;

    const shadow = popupHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
      :host { all: initial; }
      .popup {
        background: rgba(15, 15, 25, 0.75);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 240px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
        font-family: 'Inter', sans-serif;
        animation: vmFadeIn 0.15s ease;
      }
      @keyframes vmFadeIn {
        from { opacity:0; transform: translateY(6px); }
        to   { opacity:1; transform: translateY(0); }
      }
      .timestamp {
        color: rgba(255,255,255,0.4);
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      textarea {
        background: rgba(255,255,255,0.07);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        resize: none;
        outline: none;
        width: 100%;
        box-sizing: border-box;
        height: 64px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      textarea::placeholder { color: rgba(255,255,255,0.25); }
      textarea:focus {
        border-color: rgba(255,214,0,0.6);
        box-shadow: 0 0 0 3px rgba(255,214,0,0.12);
      }
      .colors { display: flex; gap: 7px; align-items: center; }
      .swatch {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;
        transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }
      .swatch:hover { transform: scale(1.2); }
      .swatch.active {
        border-color: #fff;
        box-shadow: 0 0 0 3px rgba(255,255,255,0.2);
        transform: scale(1.15);
      }
      .actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 2px; }
      button {
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        padding: 5px 12px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s;
      }
      button:hover { opacity: 0.85; transform: translateY(-1px); }
      button:active { transform: translateY(0); }
      .save {
        background: linear-gradient(135deg, #FFD600, #FFA000);
        color: #000;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(255,214,0,0.35);
      }
      .cancel {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .export-btn {
        background: rgba(33,150,243,0.25);
        color: #64B5F6;
        border: 1px solid rgba(33,150,243,0.3);
        font-size: 11px;
        padding: 4px 10px;
      }
      .char-count {
        font-size: 10px;
        color: rgba(255,255,255,0.35);
        text-align: right;
        margin-top: 2px;
        font-weight: 500;
      }
      .char-count.warning { color: rgba(244,67,54,0.7); }
      .divider {
        height: 1px;
        background: rgba(255,255,255,0.08);
        margin: 0 -2px;
      }
    `;

    const popup = document.createElement('div');
    popup.className = 'popup';

    const tsLabel = document.createElement('div');
    tsLabel.className = 'timestamp';
    tsLabel.textContent = `@ ${formatTime(time)}`;

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a note…';

    const charCount = document.createElement('div');
    charCount.className = 'char-count';
    charCount.textContent = '0/180';

    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len}/180`;
      charCount.classList.toggle('warning', len > 160);
    });

    // Color swatches
    let selectedColor = DEFAULT_COLOR;
    const colorRow = document.createElement('div');
    colorRow.className = 'colors';
    Object.entries(COLORS).forEach(([name, hex]) => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch' + (name === DEFAULT_COLOR ? ' active' : '');
      swatch.style.background = hex;
      swatch.addEventListener('click', () => {
        colorRow.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        selectedColor = name;
      });
      colorRow.appendChild(swatch);
    });

    // Actions
    const actions = document.createElement('div');
    actions.className = 'actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', removePopup);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save';
    saveBtn.textContent = 'Save (Enter)';

    const doSave = () => {
      const text = textarea.value.trim();
      if (!text) return;
      if (text.length > 180) {
        textarea.style.borderColor = 'rgba(244,67,54,0.6)';
        return;
      }
      onSave(text, selectedColor);
      removePopup();
    };

    saveBtn.addEventListener('click', doSave);
    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      textarea.addEventListener(evt, (e) => {
        e.stopPropagation();
        if (evt === 'keydown') {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doSave();
          }
          if (e.key === 'Escape') removePopup();
        }
      });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    popup.appendChild(tsLabel);
    popup.appendChild(textarea);
    popup.appendChild(charCount);
    popup.appendChild(colorRow);
    popup.appendChild(actions);
    shadow.appendChild(style);
    shadow.appendChild(popup);

    const player = document.querySelector('.ytp-chrome-bottom') || document.querySelector('#movie_player');
    if (player) {
      player.appendChild(popupHost);
    } else {
      document.body.appendChild(popupHost);
    }

    setTimeout(() => textarea.focus(), 50);
  }

  function removePopup() {
    if (popupHost) {
      popupHost.remove();
      popupHost = null;
    }
  }

  // --- Import drop zone ---

  function setupImportDrop() {
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.name.endsWith('.videomark')) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (!imported.videoId || !Array.isArray(imported.notes)) return;
          loadNotes(imported.videoId, (existing) => {
            const merged = mergNotes(existing, imported.notes);
            saveNotes(imported.videoId, merged);
            const vid = document.querySelector('video');
            if (vid) renderPips(merged, imported.videoId);
          });
        } catch (_) {}
      };
      reader.readAsText(file);
    });
  }

  function mergNotes(existing, incoming) {
    const map = new Map(existing.map((n) => [n.time, n]));
    incoming.forEach((n) => map.set(n.time, n)); // overwrite on duplicate
    return [...map.values()].sort((a, b) => a.time - b.time);
  }

  // --- Export ---

  function exportNotes(videoId, notes) {
    const payload = JSON.stringify({ videoId, notes }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `videomark-${videoId}.videomark`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Helpers ---

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function getTimeFromMouseX(mouseX) {
    const bar = document.querySelector('.ytp-progress-bar');
    const video = document.querySelector('video');
    if (!bar || !video) return null;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (mouseX - rect.left) / rect.width));
    return pct * video.duration;
  }

  function getPopupXFromTime(time) {
    const bar = document.querySelector('.ytp-chrome-bottom');
    const progressBar = document.querySelector('.ytp-progress-bar');
    const video = document.querySelector('video');
    if (!bar || !progressBar || !video) return 0;
    const barRect = bar.getBoundingClientRect();
    const progRect = progressBar.getBoundingClientRect();
    const pct = time / video.duration;
    return progRect.left - barRect.left + pct * progRect.width;
  }

  // --- Pip context menu ---

  let contextMenuEl = null;

  function removeContextMenu() {
    if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; }
  }

  function showSeekbarContextMenu(cx, cy, time, popupX, nearestNote, videoId, notes) {
    removeContextMenu();
    contextMenuEl = document.createElement('div');

    // Temp add to measure height
    const tempStyle = `
      position: fixed;
      left: ${cx}px;
      top: ${cy}px;
      background: rgba(15,15,25,0.82);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 5px 0;
      z-index: 999999;
      font-family: Inter, sans-serif;
      font-size: 13px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07);
      min-width: 170px;
      animation: vmFadeIn 0.12s ease;
      visibility: hidden;
    `;
    contextMenuEl.style.cssText = tempStyle;

    const mkItem = (label, color, onClick) => {
      const item = document.createElement('div');
      item.textContent = label;
      item.style.cssText = `padding:8px 16px;cursor:pointer;color:${color};font-weight:500;transition:background 0.12s;border-radius:8px;margin:1px 4px;`;
      item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.1)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', onClick);
      return item;
    };

    const video = document.querySelector('video');

    contextMenuEl.appendChild(mkItem(`Add note @ ${formatTime(time)}`, 'rgba(255,255,255,0.9)', () => {
      removeContextMenu();
      createPopup(popupX, time, videoId, notes, (text, color) => {
        const newNote = { time: parseFloat(time.toFixed(2)), text, color };
        const updated = [...notes, newNote].sort((a, b) => a.time - b.time);
        saveNotes(videoId, updated);
        renderPips(updated, videoId);
      });
    }));

    if (nearestNote) {
      const sep = document.createElement('div');
      sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:4px 0;';
      contextMenuEl.appendChild(sep);

      contextMenuEl.appendChild(mkItem('Edit note', '#fff', () => {
        removeContextMenu();
        const x = getPopupXFromTime(nearestNote.time);
        createEditPopup(x, nearestNote, videoId, notes);
      }));

      contextMenuEl.appendChild(mkItem('Delete note', '#f44336', () => {
        removeContextMenu();
        const updated = notes.filter(n => n.time !== nearestNote.time);
        saveNotes(videoId, updated);
        renderPips(updated, videoId);
      }));
    }

    const sep2 = document.createElement('div');
    sep2.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:4px 0;';
    contextMenuEl.appendChild(sep2);

    contextMenuEl.appendChild(mkItem('Import annotations', 'rgba(255,255,255,0.7)', () => {
      removeContextMenu();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.videomark';
      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (!imported.videoId || !Array.isArray(imported.notes)) return;
            loadNotes(imported.videoId, (existing) => {
              const merged = mergNotes(existing, imported.notes);
              saveNotes(imported.videoId, merged);
              const vid = document.querySelector('video');
              if (vid) renderPips(merged, imported.videoId);
            });
          } catch (_) {}
        };
        reader.readAsText(file);
      });
      input.click();
    }));

    contextMenuEl.appendChild(mkItem('Export annotations', 'rgba(255,255,255,0.7)', () => {
      removeContextMenu();
      exportNotes(videoId, notes);
    }));

    document.body.appendChild(contextMenuEl);

    // Measure height, flip if needed
    const rect = contextMenuEl.getBoundingClientRect();
    const menuH = rect.height;
    const viewportH = window.innerHeight;
    const needsFlip = cy + menuH > viewportH - 20;

    // Clamp X to viewport
    const clampedX = Math.min(Math.max(cx, 10), window.innerWidth - 180);
    const finalY = needsFlip ? Math.max(10, cy - menuH - 10) : cy;

    contextMenuEl.style.cssText = tempStyle
      .replace(`left: ${cx}px`, `left: ${clampedX}px`)
      .replace(`top: ${cy}px`, `top: ${finalY}px`)
      .replace('visibility: hidden', 'visibility: visible');

    setTimeout(() => {
      document.addEventListener('click', removeContextMenu, { once: true });
    }, 0);
  }

  function createEditPopup(x, note, videoId, notes) {
    removePopup();

    const POPUP_WIDTH = 220;
    const container = document.querySelector('.ytp-chrome-bottom');
    const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth;
    const clampedX = Math.min(Math.max(x, POPUP_WIDTH / 2), containerWidth - POPUP_WIDTH / 2);

    popupHost = document.createElement('div');
    popupHost.id = 'videomark-popup-host';
    popupHost.style.cssText = `
      position: absolute;
      left: ${clampedX}px;
      bottom: 44px;
      z-index: 9999;
      transform: translateX(-50%);
    `;

    const shadow = popupHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .popup { background:rgba(15,15,25,0.75);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:240px;box-shadow:0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.08);font-family:Inter,sans-serif;animation:vmFadeIn 0.15s ease; }
      @keyframes vmFadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
      .timestamp { color:rgba(255,255,255,0.4);font-size:10px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase; }
      textarea { background:rgba(255,255,255,0.07);color:#fff;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px 10px;font-size:13px;font-family:Inter,sans-serif;resize:none;outline:none;width:100%;box-sizing:border-box;height:64px;transition:border-color 0.2s,box-shadow 0.2s; }
      textarea::placeholder { color:rgba(255,255,255,0.25); }
      textarea:focus { border-color:rgba(255,214,0,0.6);box-shadow:0 0 0 3px rgba(255,214,0,0.12); }
      .char-count { font-size:10px;color:rgba(255,255,255,0.35);text-align:right;margin-top:2px;font-weight:500; }
      .char-count.warning { color:rgba(244,67,54,0.7); }
      .colors { display:flex;gap:7px;align-items:center; }
      .swatch { width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform 0.15s,box-shadow 0.15s;box-shadow:0 2px 6px rgba(0,0,0,0.4); }
      .swatch:hover { transform:scale(1.2); }
      .swatch.active { border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,0.2);transform:scale(1.15); }
      .actions { display:flex;gap:6px;justify-content:flex-end;margin-top:2px; }
      button { font-size:12px;font-family:Inter,sans-serif;font-weight:500;padding:5px 12px;border-radius:8px;border:none;cursor:pointer;transition:opacity 0.15s,transform 0.1s; }
      button:hover { opacity:0.85;transform:translateY(-1px); }
      .save { background:linear-gradient(135deg,#FFD600,#FFA000);color:#000;font-weight:600;box-shadow:0 2px 10px rgba(255,214,0,0.35); }
      .cancel { background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1); }
      .char-count { font-size:10px;color:rgba(255,255,255,0.35);text-align:right;margin-top:2px;font-weight:500; }
      .char-count.warning { color:rgba(244,67,54,0.7); }
    `;

    const popup = document.createElement('div');
    popup.className = 'popup';

    const tsLabel = document.createElement('div');
    tsLabel.className = 'timestamp';
    tsLabel.textContent = `@ ${formatTime(note.time)} — editing`;

    const textarea = document.createElement('textarea');
    textarea.value = note.text;

    const charCount = document.createElement('div');
    charCount.className = 'char-count';
    charCount.textContent = `${note.text.length}/180`;

    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len}/180`;
      charCount.classList.toggle('warning', len > 160);
    });

    let selectedColor = note.color || 'yellow';
    const colorRow = document.createElement('div');
    colorRow.className = 'colors';
    Object.entries(COLORS).forEach(([name, hex]) => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch' + (name === selectedColor ? ' active' : '');
      swatch.style.background = hex;
      swatch.addEventListener('click', () => {
        colorRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        selectedColor = name;
      });
      colorRow.appendChild(swatch);
    });

    const actions = document.createElement('div');
    actions.className = 'actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', removePopup);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save';
    saveBtn.textContent = 'Save (Enter)';

    const doSave = () => {
      const text = textarea.value.trim();
      if (!text) return;
      if (text.length > 180) {
        textarea.style.borderColor = 'rgba(244,67,54,0.6)';
        return;
      }
      const updated = notes.map(n => n.time === note.time ? { ...n, text, color: selectedColor } : n);
      saveNotes(videoId, updated);
      renderPips(updated, videoId);
      removePopup();
    };

    saveBtn.addEventListener('click', doSave);
    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      textarea.addEventListener(evt, (e) => {
        e.stopPropagation();
        if (evt === 'keydown') {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSave(); }
          if (e.key === 'Escape') removePopup();
        }
      });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    popup.appendChild(tsLabel);
    popup.appendChild(textarea);
    popup.appendChild(charCount);
    popup.appendChild(colorRow);
    popup.appendChild(actions);
    shadow.appendChild(style);
    shadow.appendChild(popup);

    const player = document.querySelector('.ytp-chrome-bottom') || document.querySelector('#movie_player');
    if (player) player.appendChild(popupHost);
    else document.body.appendChild(popupHost);

    setTimeout(() => textarea.focus(), 50);
  }

  // --- Main init ---

  let lastMouseX = 0;
  let initialized = false;

  function init() {
    if (initialized) return;
    const bar = document.querySelector('.ytp-progress-bar');
    const video = document.querySelector('video');
    console.log('[VideoMark] init check — bar:', !!bar, 'video:', !!video);
    if (!bar || !video) return;
    initialized = true;
    console.log('[VideoMark] initialized');

    bar.addEventListener('mousemove', (e) => { lastMouseX = e.clientX; });
    setupPipHover(bar);

    bar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const clickX = e.clientX;
      const time = getTimeFromMouseX(clickX);
      const popupX = getPopupXFromTime(time);

      // find nearest pip within 12px
      const HIT = 12;
      const pips = document.querySelectorAll('.videomark-pip');
      let nearestNote = null;
      let minDist = HIT;
      pips.forEach(pip => {
        const r = pip.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const dist = Math.abs(clickX - cx);
        if (dist < minDist) {
          minDist = dist;
          nearestNote = { time: parseFloat(pip.dataset.time), text: pip.dataset.note, color: pip.dataset.color };
        }
      });

      loadNotes(videoId, (notes) => {
        showSeekbarContextMenu(e.clientX, e.clientY, time, popupX, nearestNote, videoId, notes);
      });
    }, true);

    const videoId = getVideoId();
    if (!videoId) return;

    loadNotes(videoId, (notes) => renderPips(notes, videoId));

    // Re-render on duration change (SPA nav)
    video.addEventListener('durationchange', () => {
      loadNotes(videoId, (notes) => renderPips(notes, videoId));
    });

    document.addEventListener('keydown', (e) => {
      console.log('[VideoMark] keydown', e.key, 'alt:', e.altKey);
      if (e.altKey && (e.key === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        console.log('[VideoMark] Alt+N triggered');
        const time = video.currentTime ?? getTimeFromMouseX(lastMouseX) ?? 0;
        console.log('[VideoMark] time:', time, 'videoId:', videoId);

        const x = getPopupXFromTime(time);
        console.log('[VideoMark] popup x:', x);

        loadNotes(videoId, (notes) => {
          console.log('[VideoMark] notes loaded, creating popup');
          createPopup(x, time, videoId, notes, (text, color) => {
            const newNote = { time: parseFloat(time.toFixed(2)), text, color };
            const updated = [...notes, newNote].sort((a, b) => a.time - b.time);
            saveNotes(videoId, updated);
            renderPips(updated, videoId);
          });
        });
      }
      if (e.key === 'Escape') removePopup();
    });

    setupImportDrop();
  }

  // YouTube is a SPA — observe DOM for player readiness
  const observer = new MutationObserver(() => {
    if (!initialized) init();
    // Handle SPA navigation
    const videoId = getVideoId();
    if (videoId && initialized) {
      loadNotes(videoId, (notes) => renderPips(notes, videoId));
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  init();
})();
