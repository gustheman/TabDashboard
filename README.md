# TabDashboard

## Project Overview

TabDashboard is a powerful Chrome extension that provides a centralized interface to view, manage, and organize all of your open tabs across all browser windows and devices. It goes beyond simple tab management by adding a persistent layer of notes and context to your browsing experience.

## Key Features

### 🚀 Unified Dashboard
- **Window View:** See all your open tabs grouped by window. Drag and drop tabs between windows to reorganize effortlessly.
- **Domain View:** Automatically group tabs by their domain (e.g., all Google Docs together, all YouTube videos together) to focus on specific tasks.
- **Cross-Device Sync:** View open tabs from your other synced devices (phones, laptops) directly in the dashboard.
- **Tab Provenance:** Instantly see where a tab came from. If a tab was opened from another page, a clickable "From: [Page Title]" badge appears to take you back to the source.

### 📝 Per-Tab Notes
- **Instant Notes:** Add sticky notes to any webpage. Your notes persist even if you close the tab and come back later.
- **Keyboard Shortcuts:**
    - **Toggle Note:** Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux) to open the note for the current tab instantly.
    - **Open Dashboard:** Press `Cmd+J` (Mac) or `Ctrl+Shift+D` (Windows/Linux) to launch the TabDashboard.
    - *Shortcuts are fully configurable in `chrome://extensions/shortcuts`.*
- **Notes View:** A dedicated view in the dashboard that shows only tabs with attached notes, turning your browser into a visual to-do list.
- **Universal Compatibility:** Works perfectly on complex web apps like Google Docs, Cloud Console, and local files.

## Installation

To install and use this extension locally:

1.  **Get the Code:**
    -   Clone the repository:
        ```bash
        git clone https://github.com/gustheman/TabDashboard.git
        ```
2.  **Open Chrome Extensions:**
    -   Navigate to `chrome://extensions`.
3.  **Enable Developer Mode:**
    -   Toggle **"Developer mode"** in the top-right corner.
4.  **Load the Extension:**
    -   Click **"Load unpacked"**.
    -   Select the project folder.

## Usage

1.  **Open Dashboard:** Click the extension icon in the toolbar or use the shortcut (`Cmd+J` / `Ctrl+Shift+D`).
2.  **Add a Note:** On any webpage, press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Win) to open the note popup.
3.  **Manage Tabs:** Use the dashboard to close tabs, move them between windows, or review your notes.

## Contributing

Contributions are welcome!

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourFeature`).
3.  Commit your changes (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/YourFeature`).
5.  Open a Pull Request.