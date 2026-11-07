# Quota Glass

Visual authority: user's screenshot. Operate mode. No new visual identity is being invented.

Reference panel: approximately 1020 x 480 for four providers; circle diameter 198, header size 34, main figure 56, cycle 26, countdown 30. Horizontal pitch 235.
Two-provider version: 552 x 414; centers 159 and 394; preserve header and circle anchors while reducing space below the countdown. Default desktop scale is 80%, with a continuous 60–140% slider in settings, without fixed percentage steps; native edge resizing preserves the aspect ratio.

Dark blue-black glass, double inset edge, 76px outer radius. Foreground #ffffff; secondary #bec6d3; muted #a2acbc. White ring caps. All unselected rings use the same 58% white; selected/hover rings and provider titles use full white.
Use the installed Segoe UI / Microsoft YaHei family, appropriate for the screenshot's system typography. Use compact Command Code lettering on one line, without replacing it with Claude.

Footer: freshness on left, small controls on right. Controls remain keyboard-accessible. Details appear in a separate settings window so the floating panel's composition stays fixed.
Percentage means remaining. Command Code has three selectable rings: outer monthly (radius 90), middle weekly (72), inner 5h (54); stroke 11. Selecting a ring changes the central percentage, period and countdown. Default is monthly; remember selection. Unknown monthly allowance shows an em dash, not zero.

Native glass: transparent Electron HWND with a rounded region; disable whole-window Accent and system backdrop. A separate nonactivating, input-transparent native composition window uses HostBackdropBrush with a rounded geometric clip. Both the blur and panel obey the rounded boundary. Native blur visual opacity is 28%, blending crisp transmitted background with softened light. CSS dark tint is 36–53%, with a broad, smoothly feathered diagonal reflection without sharp bands and crisp top/side highlights for glossy glass. Footer text is 16px; icons are 18px. Reset countdown is 28px and full white; footer sits 20px from the bottom.

All controls retain the default arrow cursor. Hover brightness communicates interactivity. Center figures are display-only; ring selection and the dedicated settings button own their respective actions. Blank-space dragging uses explicit pointer events, not native caption hit regions.

Center period labels use 5h / 7d / 1m consistently for both providers; account detail labels retain their descriptive wording.

Tray menu: exactly Show (visibility checkbox), Pin, Lock, Settings, Quit. Both tray Show and double-click toggle visibility. Glass transparency: continuous 20–90%, default 55%; foreground text and rings remain opaque. Size previews update on each input event through native bounds, without timeout or animation-frame gating; the renderer scales its fixed layout with a transform, not page zoom. The resident backdrop updates the HWND region during resizing without starting helper processes per frame.

Tray Lock is a persistent checkbox (default off). When locked, the entire HUD ignores mouse input so underlying windows receive it. Unlocking from the tray restores HUD input.
