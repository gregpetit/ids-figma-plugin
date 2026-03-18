# IDS — Making your first Figma plugin!

## Prompt 1

Build a headless Figma plugin that renames frames based on their largest text layer.

- Look at each selected frame on the current page
- Find the text layer with the biggest font size; break ties by layer order (top wins)
- Skip frames with no text, or text layers with mixed font sizes
- Rename each frame to match that text content
- Show a notification: "Renamed 3 frames"
- If nothing is selected, close with "Please select at least one frame"

## Prompt 2

Build a Figma plugin (320×320px UI) that helps organise presentation slides.

**Arrange slides** — Sort selected frames (or all top-level frames if none selected) numerically by name, then lay them out left to right with a configurable gap (default 40px). Include a toggle in the UI: if "Wrap in auto-layout" is checked, place the frames inside a new horizontal auto-layout frame called "Slides AutoLayout"; otherwise just reposition them in place. Show a gap input (number field) and the toggle checkbox in the UI.

**Renumber slides** — Sort selected frames (or all top-level frames if none selected) left to right by position. Rename each using a configurable prefix (default `"Slide "`) and a configurable start number (default `1`) — e.g. "Slide 1", "Slide 2". Show a prefix text input and a start-number input in the UI.

Show a status notification after each action.

## Prompt 3

Build a Figma plugin (360×520px UI) that audits unstyled text across the current page.

### Scanning logic (`code.js`)

- Recursively walk every node on `figma.currentPage` and collect all `TextNode`s
- A node is **unstyled** if `textStyleId === ""` or `textStyleId === figma.mixed`
- For each unstyled node, serialise: `id`, `name`, 60-char `preview` of `.characters`, `fontFamily`, `fontStyle`, `fontSize` (all guarded against `figma.mixed`), and a `fontKey` string (`"Family Style Size"`) used for grouping
- On startup and on every rescan, post a `RESULTS` message to the UI with the node array
- Listen for messages back from the UI:
  - `SELECT_NODE { id }` — select that single node and scroll the viewport to it
  - `SELECT_NODES { ids[] }` — select multiple nodes and scroll to them
  - `RESCAN` — re-run the scan and post fresh `RESULTS`

### UI panel (`ui.html`)

**States**
- **Loading** — spinner shown while the first scan runs
- **All styled** — green empty state ("All text layers are styled") with a Rescan button
- **Results** — grouped list of unstyled nodes

**Header**
- Plugin icon + title "Unstyled Text Audit"
- Badge: amber `X unstyled` or green `✓ All styled`

**Toolbar** (visible when results exist)
- Info line: `N unstyled nodes across G font groups`
- ↺ Rescan button
- **Select All** button (primary) — sends `SELECT_NODES` with every node id

**Results list** — nodes grouped by `fontKey`
- Each group has a sticky header showing the font key, node count, and a **Select similar** button that sends `SELECT_NODES` for that group's ids
- Each node row shows: a "T" type icon, the layer name, an italic 60-char text preview, and a **Select** button (revealed on hover) that sends `SELECT_NODE`

**Footer**
- Hint copy: "Click a row to preview · Select Similar picks nodes with the same raw font"

## Visual Design

Figma native UI conventions: 11px Inter, `#333` body on white, no border-radius on container. Buttons: `#18A0FB`, 6px border-radius, weight 500, 30px tall. Dividers: `1px solid #e5e5e5`. Section labels: `#888`, 11px, uppercase, `letter-spacing: 0.6px`. No shadows.

---

> **For the AI:** Use only vanilla JS compatible with Figma's plugin runtime — no optional chaining, nullish coalescing, or parameter destructuring. Headless plugins: wrap logic in `async function main()` and call it. Manifest fields: `name`, `id`, `api`, `main`, `editorType` (add `ui` only if there's a UI).
