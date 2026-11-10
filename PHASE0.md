# Phase 0 results: does "tap the wall" look convincing?

**Question:** when a client taps a wall in their photo, does the app paint the wall (and only the wall) so that it looks like real paint?

**Test:** 20 interior photos from `~/Downloads/paint-resources` (stock and designer photos, not your father's own jobs). I tapped one or two points on the main wall of each photo and applied a light green and a dark navy. To repeat the test, copy photos into `apps/web/phase0-photos/` named `p01`…`p20`, start `npm run dev -w @app/web`, and open `http://localhost:5173/phase0.html`. That page is dev-only and is not part of the app build. The photos are third-party images, so they are git-ignored.

## Summary

|                                                                      | First version of tap-to-select | Improved version (now in the app) |
| -------------------------------------------------------------------- | ------------------------------ | --------------------------------- |
| Clean (wall painted, almost nothing else)                            | about 5 of 20                  | **9 of 20**                       |
| Usable after a few brush strokes                                     | about 6                        | **6**                             |
| Poor (paints furniture, floor or stairs, or misses much of the wall) | about 9                        | **5**                             |

Of the 20 photos, 7 are deliberately hard surfaces that a painter would rarely repaint (wood panels, stone, wallpaper, 3D relief, concrete look). On the **13 ordinary painted walls**, the improved version gave **7 clean, 4 usable and 2 poor**.

## What the improvement was

The first version accepted any pixel within one color distance of the tapped spot. That is too loose for light walls: the ceiling, rugs, white sofas and floors are all "close enough", so the paint leaked. Making the distance stricter stopped the leaks but missed the shaded parts of the wall, so one threshold could not do both.

The improved version (`floodSelect` in `apps/web/src/lib/recolor.ts`) grows the selection step by step:

- A neighbouring pixel joins only if its hue and saturation stay close to the tapped wall.
- Its brightness may differ from the tapped spot (walls get lighter and darker with the light), but it may not jump suddenly from the pixel next to it. A ceiling line, furniture edge or frame is a jump; shading is gradual.
- Thin leaks are then cut off by opening the mask.

Selection takes 20 to 60 ms on these photos (up to about 190 ms on the 1024 px one), which feels instant on a phone.

## Results per photo (improved version)

| #   | Result | What happened                                                                                     |
| --- | ------ | ------------------------------------------------------------------------------------------------- |
| 1   | Clean  | Beige wall and door frame painted; sofa, art and door untouched. Slight leak onto the floor edge. |
| 2   | Clean  | Wall painted around the framed prints; a small gap below the frames.                              |
| 3   | Usable | Wall painted; parts of the window glass also painted.                                             |
| 4   | Usable | Pink walls painted; the white ceiling is painted too. The rug and sofas are untouched.            |
| 5   | Clean  | Only the small white side wall was tapped (the wood panels are not paintable).                    |
| 6   | Usable | Green walls and fireplace painted; some leak onto the table and floor at the bottom.              |
| 7   | Clean  | Dark grey wall painted well; shading kept.                                                        |
| 8   | Clean  | Wood plank wall painted as one surface; sofa untouched.                                           |
| 9   | Clean  | Plain beige wall; the chair is partly painted at its edge.                                        |
| 10  | Clean  | Plain wall; no leaks.                                                                             |
| 11  | Poor   | Stone chimney: white sofas painted as well.                                                       |
| 12  | Poor   | Dark wood 3D panels: orange highlights left unpainted.                                            |
| 13  | Clean  | White wall around frames, TV and bulbs.                                                           |
| 14  | Poor   | Green wall painted, but the pale sofa and blanket are also painted in patches.                    |
| 15  | Usable | Wallpaper pattern painted; the curtain is painted too.                                            |
| 16  | Clean  | Yellow wall; a cushion is painted by mistake.                                                     |
| 17  | Poor   | 3D relief: the sculpture is painted in patches and the sofa leaks.                                |
| 18  | Usable | Concrete-look wall painted; leak at the sofa and floor edge.                                      |
| 19  | Poor   | Stairs and floor painted along with the wall.                                                     |
| 20  | Usable | Dark red wall painted; a few holes where the wall is lighter.                                     |

## What this tells us

1. **The recolor itself is good.** In every photo, shadows, light and texture stayed natural. Navy on a white wall, light green on a dark wall, and red turned to blue all look like paint rather than a flat overlay.
2. **Tap-to-select works for ordinary painted walls**, with about half needing no fixing and most of the rest needing a few brush strokes. It is good enough to ship in the first version, as long as the brush and undo stay easy to find.
3. **Where it fails**, the cause is always the same: a neighbouring surface (white ceiling, pale sofa, light floor or stairs) is nearly the same color as the wall, so the boundary can't be found from color alone. Better thresholds won't fix this. Wall detection by an AI model, which recognizes "this is a wall" rather than comparing colors, is the proper fix.
4. **Not tested:** photos taken on a phone in poor light, photos with strong glare, exterior walls, and your father's real jobs. This set is professionally lit, so a real client photo will likely do somewhat worse.

## Recommendation

- **Ship the first version with tap-to-select, the brush, undo and the "colors vary" note.** It already helps a client decide.
- **Add one small UX hint:** if more than about 70% of the photo is selected, suggest the brush to remove the extra area.
- **Treat automatic wall detection (Phase 2) as a quality upgrade, not a blocker.** Revisit it after real clients have tried the first version and your father has said which photos look wrong.
- **Next test:** run the same page on 10 to 20 real phone photos from your father or his clients. That is the check that matters most before launch.

---

# Part 2: pretrained wall detection (SegFormer)

**Model tried:** `Xenova/segformer-b0-finetuned-ade-512-512`, a small SegFormer trained on the ADE20K indoor/outdoor scene dataset, in its quantized form (4.4 MB). It labels every pixel as wall, ceiling, floor, sofa, window, painting and so on (150 categories). It runs in the browser with `@huggingface/transformers` (ONNX Runtime, WebAssembly), so no server or per-use cost. Tapping a pixel selects everything the model labels the same as that pixel (`apps/web/src/phase0/seg.ts`, open `/phase0-seg.html` to repeat).

## Result on the same 20 photos

|                                  | Color-based tap-select (current) | SegFormer |
| -------------------------------- | -------------------------------- | --------- |
| Clean                            | 9                                | **16**    |
| Usable after a few brush strokes | 6                                | **3**     |
| Poor                             | 5                                | **1**     |

The cases the color-based version couldn't solve now work, because the model knows what a wall is rather than comparing colors:

- No more paint on ceilings, floors, stairs or rugs (photos 4, 19, 18).
- White and pale sofas, curtains and the window glass stay untouched (11, 14, 15, 16, 3).
- The stone chimney in 11 is painted as a wall while the sofas stay clean.
- Dark and unevenly lit walls come out complete (20: the holes are gone).

## Where SegFormer is still weak

1. **Photo 17 failed:** the 3D relief wall was labelled "ceiling", so the tapped wall was not selected.
2. **Rough edges:** the model works at low resolution, so the wall boundary against the ceiling and furniture is a little jagged (visible in 1, 3, 4, 6). Fixable with edge refinement; not yet done.
3. **Tapping a non-wall object selects that object** (in photo 4 the first tap hit a picture frame and painted the frames). The app should ignore taps on non-wall labels and use the nearest wall.
4. **Intersecting the model's result with color** (a fourth column on the test page) did not help overall and sometimes created holes, so I would not use it.

## Speed

About 0.8 to 1 s per photo on this Mac in the browser (the first photo about 2 to 2.5 s, including warm-up), plus a one-time 4.4 MB model download after which the PWA can cache it. On a mid-range phone, expect roughly 2 to 5 s. This is fine for photo mode. A smooth live camera preview would need a faster path (smaller input, or running every few frames), so keep live mode as a later extra.

## License: must be resolved before using it in the app

The model is a conversion of NVIDIA's SegFormer. Its Hugging Face page lists the license only as "other". The original NVlabs SegFormer code is released under NVIDIA's research license, which, from my reading, does not allow commercial use. I have not confirmed the exact terms. A painter's booking site is a commercial use, so **do not ship this model until the license is checked**. Options if it's not allowed:

- Another wall-labelling model with a commercial-friendly license (for example UPerNet or Mask2Former models trained on ADE20K, some of which are MIT or Apache 2.0). They are larger, so I'd need to test size and speed.
- Google's MediaPipe interactive segmenter (Apache 2.0), which works from a tap.
- Train or fine-tune a small model on our own wall photos (more work).

## Updated recommendation

1. **Plan on pretrained wall detection for the app.** The improvement is large (16 of 20 clean versus 9), and it removes the biggest failure type (leaks onto neighbouring surfaces).
2. **Resolve the license first**, then test a permissively licensed model on these same 20 photos with the same page.
3. **Keep the current tap-select as the fallback** if the model can't load (offline, old phone), plus the brush and undo for fixing mistakes.
4. **Add edge refinement** and "ignore taps that land on non-wall objects".
5. **Still to do:** test on real phone photos from your father's clients.

---

# Part 3: a commercially licensed alternative (SlimSAM)

**Why:** SegFormer's license looked non-commercial (see Part 2). I looked for models whose license allows commercial use and that run in the browser.

| Model                                                                             | License (as listed on Hugging Face) | Download                                                           | Notes                                                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `Xenova/slimsam-77-uniform` (SlimSAM, a small version of Meta's Segment Anything) | **Apache 2.0**                      | about 14 MB (image encoder 8.9 MB + tap decoder 4.9 MB, quantized) | You tap and it outlines that object. Same flow as today. **Tested.**                      |
| `facebook/detr-resnet-50-panoptic` (Xenova ONNX build)                            | Apache 2.0                          | about 45 MB quantized                                              | Labels walls, ceilings and floors from the COCO dataset. Not tested; larger than SlimSAM. |
| `shi-labs/oneformer_ade20k_swin_tiny`, `openmmlab/upernet-convnext-tiny`          | MIT                                 | about 200 MB or more                                               | Too large for a phone. Not tested.                                                        |
| `facebook/mask2former-swin-tiny-coco-panoptic`                                    | "other"                             | -                                                                  | Unclear license. Skipped.                                                                 |

Test page: `/phase0-sam.html` (add `?gpu=1` for WebGPU). The code is `apps/web/src/phase0/sam.ts`. In the page, the third column is the model's best-scoring mask for each tap, and the fourth column is its largest mask.

## Result on the same 20 photos (best-scoring mask)

|                                  | Color-based tap-select | SegFormer | SlimSAM |
| -------------------------------- | ---------------------- | --------- | ------- |
| Clean                            | 9                      | 16        | **17**  |
| Usable after a few brush strokes | 6                      | 3         | **2**   |
| Poor                             | 5                      | 1         | **1**   |

- **Edges are the crispest of the three.** Picture frames, plants, chair legs, sofas and curtains are outlined cleanly and left unpainted (photos 2, 3, 4, 13, 15). SegFormer's edges were blocky and jagged.
- **It picks the thing you tapped, whatever it is.** It doesn't need to know the word "wall". Tapping the wall behind a sofa outlines the wall, not the sofa.
- **The stairs, floors, ceilings and white sofas that fooled the color-based version stay clean** (19, 14, 4, 11).
- **Weak spots:**
  - Photo 17 (3D relief wall) is still wrong: the tap selects the ceiling, or the wall with holes.
  - Photo 6 is left with unpainted patches.
  - Photo 4 has a thin dotted line along the ceiling edge and white halos around the frames. A second tap or the brush fixes these.
  - Walls split by furniture or frames may need one tap per part.

## Speed (the main cost)

|                                      | Analyze the photo once                             | Each tap afterwards |
| ------------------------------------ | -------------------------------------------------- | ------------------- |
| WebAssembly (works everywhere)       | about 4.2 s on this Mac (7.5 s for the very first) | 0.2 to 0.5 s        |
| WebGPU (recent Chrome, newer phones) | **about 1.0 s**                                    | 0.1 to 0.3 s        |

The photo is analyzed once, when it is chosen, and every tap after that is fast. Phones are slower than this Mac, so with WebAssembly only, expect roughly 10 to 20 s on a mid-range phone, which is too long to wait in silence. Mitigations: start the analysis as soon as the photo is chosen, show a short "getting ready" message, and use WebGPU where available. **This must be tested on a real phone before committing.**

## License notes

- SlimSAM is listed as Apache 2.0, which allows commercial use. I have not audited the training-data terms, and a lawyer should look at that if you want to be certain.
- The ADE20K dataset that SegFormer, OneFormer and UPerNet were trained on is described as for non-commercial research. That makes any ADE20K-trained model, not only SegFormer, a licensing question for a business. This is another reason to prefer SlimSAM.

## Recommendation

1. **Use SlimSAM as the wall selector in the app.** It matches the "tap the wall" experience, has the best edges, and has the cleanest license of the options I found.
2. **Keep the color-based tap-select as the fallback** when the model can't load (offline, very old phone, memory), plus the brush and undo.
3. **Load the model only when the visualizer opens, and cache it** in the PWA, so the first page stays light. Self-host the files rather than downloading from Hugging Face on every visit.
4. **Test on a real mid-range phone** (Android and iPhone) for speed and memory before launch.
5. Later, if the wait is still too long, try a smaller or faster model, or analyze at a lower image size.

---

# Part 4: integrated into the app

SlimSAM is now the default wall selector in the visualizer (`apps/web/src/lib/segmenter.ts`, `apps/web/src/components/request/Visualizer.tsx`), with the color-based selection kept as the fallback. How it behaves:

- The model downloads when the visitor picks a photo (about 14 MB the first time, then cached), and the photo is analyzed straight away. A status line shows "Getting smart selection ready… 58%", then "Analyzing your photo…", then the normal tap hint. Taps made before it is ready show a short wait message, and a "Use quick selection" button lets the visitor skip the wait.
- If anything fails, the visualizer switches to quick selection and says "Smart selection isn't available on this device".
- The outline is grown by 2 pixels after each tap to hide the pale halo the model leaves around furniture and frames.
- Verified in the browser against the **production build served with the real security policy**: the model and runtime load only from our own site (no jsdelivr request), a tap on the wall paints the wall and leaves frames, plant, lamp, ceiling and sofas untouched. Load plus analysis took about 1.7 to 5 s on this Mac with WebGPU.
- Bug found and fixed on the way: a `NODE_ENV=development` line copied into `.env` made the production build behave as a development build, which dropped the self-hosting setting; the app now detects the dev server from the module URL instead, and the line is removed from `.env.example`.

**Not yet verified:** speed and memory on real phones, the WebAssembly-only path on a phone, and Safari on iPhone.
