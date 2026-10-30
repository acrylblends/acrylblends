# Slice 2: the frame comparison

The ACRYL frame after slice 2's client half is wired: the workspace canvas, the Projects left pane, the
right panel and real terminal tabs, on the same page DSH serves. This note records the comparison with the
ACRYL reference set, the numbers, and what still keeps some views above 2%. The gate is
`node scripts/frame-compare.mjs check scripts/frame-reference <url> <out> --max 2` against an app booted from
this checkout (18 views: 9 names at 1440x900 and 1024x768). The numbers below are from the alpha-aware
comparison (main `dcbb451b`: a reference pixel with alpha 0 is no colour to compare, the same treatment as a
masked region).

## Numbers, 2026-10-30

All 18 views were captured. 4 of 18 are within 2%.

| View | 1440x900 | 1024x768 |
| --- | --- | --- |
| frame | 3.66% | 6.23% |
| frame-dark | 3.66% | 6.23% |
| frame-light | 2.29% | 3.97% |
| left-panel-collapsed | 14.32% | 19.60% |
| right-panel-open | 4.50% | 6.60% |
| terminal-tab | 0.49% pass | 0.93% pass |
| settings-general | 3.31% | 4.27% |
| settings-models | 1.64% pass | 2.99% |
| settings-shortcuts | 1.87% pass | 2.39% |

## Why the remaining views are above 2%

The reference PNGs are captures of ACRYL's Electron page with a transparent page background: the frame's
sidebar surface is deliberately transparent (`--dsw-specific-sidebar-fill: transparent` in the shell), and on
the desktop the native window material shows through it. Those pixels have alpha 0 and are now skipped.

What is left in the sidebar is its text and icons, which in the reference were drawn anti-aliased against
transparency. A glyph's edge pixel stores its opaque-source RGB with a partial alpha (white at, say, alpha
128), while the web candidate stores the same edge already blended over the page background (`#808080` over
`#121212`). The comparator reads the RGB channels, so every anti-aliased glyph edge whose alpha is not 0
counts as differing even where the glyph looks identical. That is the 2.3-6.2% of the frame views. An opaque
reference background makes those edge pixels comparable, which is what the recapture below does.

`left-panel-collapsed` has an independent cause: its reference still carries DSH's "Add an API key to get
started" dialog, which slice 1 switched off in the generated profile (`credentialOnboarding: false`). The
dialog's opaque pixels add roughly 9-11%.

Two small web-only artifacts also count: DSH's "Enable notifications" prompt in the bottom-right corner, which
the desktop does not show, and the dock's right-panel list (the reference offers Browser where this build
offers Comments). Both are being checked against the recapture.

The candidate images themselves show the product working: `right-panel-open` has Files, Changes, New terminal,
Review, Checks, Comments and a running terminal in the right column, the Projects tree in the left, and the
conversation in the middle; `terminal-tab` has a real PTY at the app folder; `left-panel-collapsed` has the
56px rail. The door's page script runs (`window.__acrylDoor` is a function), and the boot gate asserts the
rendered frame, the Projects panel and the door script in a real browser.

## Next

1. Recapture the reference set with an opaque background (`Emulation.setDefaultBackgroundColorOverride` set to
   the frame's own background), the same method and isolated homes as the first set, and with the API-key
   dialog genuinely absent from the run. The five frame views then compare on real pixels.
2. Re-run all 18 views and judge the three target views on the new set.

## Evidence

- `ide-slice2-frame-evidence/right-panel-open@1440x900.compare.png`
- `ide-slice2-frame-evidence/terminal-tab@1440x900.compare.png`
- `ide-slice2-frame-evidence/left-panel-collapsed@1440x900.compare.png`

Each image is reference | candidate | difference (red where a pixel differs). The full run's report and all 18
compare images were produced by the command above.
