# PRD: VideoMark (Chrome Extension)

## 1. Product Overview
**VideoMark** is a Chrome extension that allows users to create high-precision annotations on YouTube videos. It overlays visual markers (pips) on the seekbar and uses a context-aware popup to capture notes without breaking the user's flow.

---

## 2. Core Features

### A. Context-Aware Annotation Engine
* **Dynamic Positioning:** When the "New Note" shortcut (`Alt + N`) is triggered, the annotation popup appears **directly above the playhead/mouse position** on the seekbar.
* **Auto-Pause/Resume:** * The video **pauses** immediately upon opening the popup to ensure the note is frame-accurate.
    * The video **resumes** playback automatically once the note is saved (`Enter`).
* **Default Color State:** New notes default to **VideoMark Yellow**, but users can toggle between a set of vibrant category colors within the popup.

### B. The "Heat Map" Seekbar
* **Visual Pips:** Custom-injected DOM elements on the YouTube `.ytp-progress-bar`.
* **Color-Coded Nav:** Pips reflect the category color chosen during note creation.
* **Hover Logic:** Hovering over a pip displays a tooltip with the note text, while clicking it instantly seeks the video to that timestamp.

### C. Data & Portability
* **Local Storage:** All data is stored in `chrome.storage.local`. Notes are mapped to the unique YouTube `v=` URL parameter.
* **JSON Sharing (The "Portability" Flow):**
    * **Export:** A "Share" button generates a `.videomark` (JSON) file containing all timestamps, notes, and colors for that specific video.
    * **Import:** A recipient with the extension can "Drop" this file into their player to overlay the sender's annotations onto their own view of the video.

---

## 3. Technical Implementation Details

| Feature | Technical Approach |
| :--- | :--- |
| **Positioning** | Calculate `clientX` of the mouse or the `%` width of the `.ytp-play-progress` bar to set the `left` CSS property of the popup. |
| **UI Isolation** | Use **Shadow DOM** to prevent YouTube's global styles from affecting the popup and color picker. |
| **Storage Key** | `const storageKey = new URLSearchParams(window.location.search).get('v');` |
| **Marker Injection** | Append `abs-positioned` div elements to the `.ytp-progress-list` container. |

---

## 4. User Flow: The "Study Session"
1.  **Spotting:** User is watching a tutorial and sees a complex diagram at **05:12**.
2.  **Trigger:** User hovers over the seekbar and hits `Alt + N`.
3.  **Creation:** The video pauses. A small text box pops up **exactly at the 05:12 position** on the bar.
4.  **Action:** User types "Check this diagram for exam," selects **Red**, and hits **Enter**.
5.  **Persistence:** The popup vanishes, the video resumes, and a Red pip is now permanently fixed at **05:12**.
6.  **Sharing:** The user exports their "Study Map" and emails the small JSON file to a friend.

---

## 5. Success Metrics
* **Note Speed:** Time from trigger to save should be under 5 seconds.
* **UI Stability:** Markers must maintain their correct timestamp position even if the YouTube player enters Fullscreen or Theater mode.
