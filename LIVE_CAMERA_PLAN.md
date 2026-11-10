# Live camera preview: plan

> **Status: DEFERRED (decided 2026-11-10).** Not part of the launch. Photo mode with smart wall selection ships first.
>
> **Reopen if either is true:**
>
> 1. Clients or your father ask for it after using photo mode.
> 2. Testing on real phones (one Android, one iPhone) shows most devices are fast enough (WebGPU or an acceptable WebAssembly wait) and have a working gyroscope.
>
> **If reopened:** start with L0 and L1 only, and continue to L2 only if the color stays on the wall on 5 different walls with drift under about 5% of the image width during a slow pan (the decision gate in section 5).

**Goal:** the client points their phone at a room, taps a wall, and sees the chosen color on that wall while they move the phone around. This builds on the photo visualizer that already works.

## 1. What is realistic in a browser (PWA)

| Approach                                     | Verdict                                                                                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real AR (ARKit / ARCore plane tracking)**  | Not available in iPhone Safari (no WebXR). Android Chrome has WebXR but only gives a flat plane, not the wall's outline. A native app would be needed, which we ruled out.                                                               |
| **Run wall detection on every video frame**  | Too slow. SlimSAM takes about 1 s per image on a laptop with WebGPU and 4 s or more without. A model that is fast enough per frame (a small SegFormer) has a non-commercial license.                                                     |
| **Freeze, select, then track (recommended)** | Show the live camera. When the client taps a wall, grab that frame, run SlimSAM once, then keep the painted mask glued to the wall as the phone moves by estimating the camera's motion. Re-run the model now and then to correct drift. |

So "live" means **a live viewfinder with a mask that follows the wall**, not full per-frame understanding.

## 2. How the tracking would work

1. **Camera:** `getUserMedia` with the rear camera, shown in a `<video>`. Works on iOS Safari and Android Chrome.
2. **Selection:** tapping grabs the current frame (scaled to about 1024 px) and runs the existing SlimSAM code. This is the same one-time wait as photo mode (about 1 s with WebGPU, 4 s or more without), shown as "Analyzing…".
3. **Following the wall, two sources of motion:**
   - **Phone gyroscope** (`DeviceOrientation` / `DeviceMotion`): when someone pans or tilts a phone, almost all of the movement is rotation. A rotation gives an exact image warp (a homography) that doesn't depend on what is in the picture. This matters because **a plain painted wall has almost no features for image-based tracking to lock onto**. On iPhone this needs a permission prompt (`DeviceMotionEvent.requestPermission`).
   - **Image tracking** (feature points and optical flow on a small grayscale copy, for example with OpenCV.js or a small hand-written Lucas-Kanade) refines the gyro estimate using edges, frames and furniture, and handles the phone moving sideways, not just turning.
4. **Drawing:** warp the mask with the estimated transform and recolor on the GPU (a WebGL shader doing the same "keep light and shadow, swap hue" as `recolor.ts`). Doing this per frame on the CPU is too slow at video rates.
5. **Correction:** every 1 to 2 s (when the phone is steady and the model is fast enough), re-run SlimSAM on the current frame from the same tap points and blend in the new mask. If the wall is lost, show a "tap the wall again" hint.

## 3. Milestones

| Step                      | What it delivers                                                                                                 | Rough effort       | Risk                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------- |
| **L0. Camera viewfinder** | In the visualizer, "Take photo" opens a live camera view with a capture button, then continues as today.         | 2 to 3 days        | Low                                          |
| **L1. Freeze-and-follow** | Tap in the live view, wait for selection, then the color follows the wall using the gyro only, drawn with WebGL. | about 1 to 2 weeks | Medium: gyro drift and unknown field of view |
| **L2. Image tracking**    | Add feature tracking to refine the gyro, plus periodic re-selection.                                             | about 1 to 2 weeks | High: textureless walls, jitter, heat        |
| **L3. Polish**            | Exposure lock, "move slowly" hint, battery and temperature guard, fall back to photo mode on slow phones.        | about 1 week       | Medium                                       |

These are estimates for one developer with Claude. They assume everything works on the first real phone, which is unlikely. Device testing will take a large share of the time.

## 4. Risks and honest limits

- **Plain walls are hard to track visually.** That's why the gyro comes first. Even so, the paint will drift or wobble when the phone moves sideways or closer, and it can slide off when a wall is passed or occluded.
- **Unknown camera field of view.** A gyro warp needs the camera's field of view. Phones differ, so we'd assume a typical value and offer a quick calibration, or accept a small error.
- **Auto-exposure and white balance** change the look of the video as the phone moves, so the preview colors will shift. Lock exposure where the browser allows it.
- **Speed and heat.** Per-frame GPU drawing is fine, but running the model repeatedly drains battery and heats the phone. Limit re-selection and stop it when the phone is steady.
- **No WebGPU:** analysis takes 4 s or more on a laptop and likely 10 to 20 s on a mid-range phone, so a "freeze and wait" experience is poor there. Those phones should keep photo mode.
- **Impression risk:** a jittery or drifting preview looks worse than a clean photo preview. A poor live mode could hurt trust in the whole tool.

## 5. Recommendation

1. **First, test the current photo mode on real phones** (one Android, one iPhone). The result tells us how slow the model is on the devices your clients use, which decides whether live mode is possible at all.
2. **Build L0 and L1, then judge.** They are the smallest steps that show the idea. If the color stays on the wall well enough on 5 different walls while panning slowly, continue to L2. If not, ship L0 plus photo mode and stop.
3. **Keep photo mode as the default.** Live mode is an extra for capable phones (WebGPU, gyroscope), offered as "Live preview (beta)".
4. **Decision gate before L2:** drift under about 5% of the image width during a slow pan of about 30°, on at least 5 test walls, on both Android and iPhone.

## 6. What I'd need from you

- Access to a phone or two for testing, or your father's own phone.
- A decision on how much this matters to the business: the request flow and the photo preview already do the main job, so the live camera is mainly a "wow" feature.
