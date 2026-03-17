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

**Arrange slides** — Place selected frames (or all top-level frames if none selected) into a new horizontal auto-layout frame called "Slides", left to right, 40px gap.

**Renumber slides** — Rename selected frames in left-to-right visual order starting from "01" — e.g. "01 Intro", "02 Agenda". Keep existing name after the prefix, or just the number if none. Show "Please select frames to renumber" if nothing is selected.

Show a status message after each action.

## Prompt 3

Build a headless Figma plugin that swaps text styles across a page.

Hardcode at the top of the file:

- FROM: `"Body/Default"`
- TO: `"Body/Strong"`

Find every text node on the current page using the FROM style and switch it to TO. If the TO style doesn't exist, show "Could not find style: Body/Strong". Otherwise show "Swapped 5 text layers".

## Visual Design

Figma native UI conventions: 11px Inter, `#333` body on white, no border-radius on container. Buttons: `#18A0FB`, 6px border-radius, weight 500, 30px tall. Dividers: `1px solid #e5e5e5`. Section labels: `#888`, 11px, uppercase, `letter-spacing: 0.6px`. No shadows.

---

> **For the AI:** Use only vanilla JS compatible with Figma's plugin runtime — no optional chaining, nullish coalescing, or parameter destructuring. Headless plugins: wrap logic in `async function main()` and call it. Manifest fields: `name`, `id`, `api`, `main`, `editorType` (add `ui` only if there's a UI).
