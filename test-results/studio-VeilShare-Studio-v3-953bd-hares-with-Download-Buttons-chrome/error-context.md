# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio.spec.ts >> VeilShare Studio v3 - On-Device Cryptography Suite >> 2. 1366x768 Viewport: Demo Image -> Scheme Select -> Generate 2 Noise Shares with Download Buttons
- Location: e2e\studio.spec.ts:32:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('img[alt="Optical Overlay Reconstruction"], img[alt="Enhanced Colour Recovery"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('img[alt="Optical Overlay Reconstruction"], img[alt="Enhanced Colour Recovery"]').first() with timeout 5000ms
  - waiting for locator('img[alt="Optical Overlay Reconstruction"], img[alt="Enhanced Colour Recovery"]').first()

```

```yaml
- banner:
  - link "SSPU Official Emblem VeilShare SSPU Final Review":
    - /url: "#/"
    - img "SSPU Official Emblem"
    - text: VeilShare SSPU Final Review
  - navigation "Studio Navigation":
    - link "Generate":
      - /url: "#/studio/generate"
    - link "Reconstruct":
      - /url: "#/studio/reconstruct"
    - link "Compare":
      - /url: "#/studio/compare"
    - link "About":
      - /url: "#/studio/about"
  - text: "Data Sent: 0"
  - button "Toggle visual theme (Noise / Pastel)"
  - button "Wipe all volatile images and shares from memory": Wipe Esc
- main:
  - heading "Generate Visual Shares" [level=1]
  - paragraph: Step 3 of 3 · Noise Shares & Stacking
  - text: 1 2 3
  - button "Visual Shares (2)"
  - button "Reconstruction Reveal"
  - button "Live Superposition"
  - button "Fidelity Metrics"
  - button "Regenerate"
  - button "Download All (ZIP)"
  - button "Send to Reconstruct"
  - heading "Reconstructed Secret" [level=3]
  - button "Colour Recovery"
  - button "Raw Stack"
  - paragraph: Subtractive transparency overlay simulation. Raw Stack demonstrates physical light absorption; Colour Recovery extracts continuous full-colour RGB gamut.
  - text: "Scheme: color_overlay Fidelity: PSNR 21.38 dB Resolution: 320 × 320 px"
  - heading "Reconstructed Secret" [level=3]
  - paragraph: Result of stacking all visual shares
  - text: Reveal
  - img "Reconstructed Secret"
  - button "Inspect Reconstructed Secret full size"
  - button "Download veilshare-reveal-color_overlay-ec26acd6.png"
  - text: 320 × 320 px
  - button "Download Reveal PNG"
  - button "Back"
  - button "Stack to Reveal"
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import AxeBuilder from "@axe-core/playwright";
  3   | 
  4   | test.describe("VeilShare Studio v3 - On-Device Cryptography Suite", () => {
  5   |   test("1. Landing page loads, hero headline, scroll storytelling, and Open Studio navigation", async ({ page }) => {
  6   |     await page.goto("/#/");
  7   |     await expect(page).toHaveTitle(/VeilShare/i);
  8   | 
  9   |     // Verify Brand, SSPU Emblem, and Hero headline
  10  |     const emblem = page.locator('img[alt="SSPU Official Emblem"]');
  11  |     await expect(emblem).toBeVisible();
  12  | 
  13  |     const heroTitle = page.locator("h1");
  14  |     await expect(heroTitle).toContainText("Two noises");
  15  | 
  16  |     // Check privacy badge
  17  |     await expect(page.locator("text=Zero Cloud Transmission")).toBeVisible();
  18  | 
  19  |     // Scroll to check storytelling
  20  |     await page.evaluate(() => window.scrollTo(0, 1000));
  21  |     await page.waitForTimeout(300);
  22  | 
  23  |     // Click "Open Studio"
  24  |     const openStudioBtn = page.locator('a:has-text("Open Studio"), button:has-text("Open Studio")').first();
  25  |     await openStudioBtn.click();
  26  | 
  27  |     // Verify navigation to /#/studio/generate
  28  |     await page.waitForURL(/.*#\/studio\/generate/);
  29  |     await expect(page.locator("h1")).toContainText("Generate Visual Shares");
  30  |   });
  31  | 
  32  |   test("2. 1366x768 Viewport: Demo Image -> Scheme Select -> Generate 2 Noise Shares with Download Buttons", async ({ page }) => {
  33  |     await page.setViewportSize({ width: 1366, height: 768 });
  34  |     await page.goto("/#/studio/generate");
  35  | 
  36  |     // Click "Use Colorful Demo Image"
  37  |     const demoBtn = page.locator('button:has-text("Use Colorful Demo Image")');
  38  |     await expect(demoBtn).toBeVisible();
  39  |     await demoBtn.click();
  40  | 
  41  |     // Verify Step 1 preview is shown and "Colour detected" badge appears
  42  |     await expect(page.locator("text=Colour detected")).toBeVisible();
  43  | 
  44  |     // Click "Next: Choose Scheme"
  45  |     const nextBtn = page.locator('button:has-text("Next: Choose Scheme")');
  46  |     await expect(nextBtn).toBeEnabled();
  47  |     await nextBtn.click();
  48  | 
  49  |     // STEP 2: Scheme selection
  50  |     // Verify all 4 scheme cards are present
  51  |     const colorOverlayCard = page.locator('div[role="radio"]:has-text("Colour Overlay 2-of-2")');
  52  |     const colorXorCard = page.locator('div[role="radio"]:has-text("Colour XOR (n, n) Exact")');
  53  |     const bwOverlayCard = page.locator('div[role="radio"]:has-text("B/W Overlay 2-of-2")');
  54  |     const bwXorCard = page.locator('div[role="radio"]:has-text("B/W XOR (n, n)")');
  55  | 
  56  |     await expect(colorOverlayCard).toBeVisible();
  57  |     await expect(colorXorCard).toBeVisible();
  58  |     await expect(bwOverlayCard).toBeVisible();
  59  |     await expect(bwXorCard).toBeVisible();
  60  | 
  61  |     // By default for colour image, Colour Overlay should be selected
  62  |     await expect(colorOverlayCard).toHaveAttribute("aria-checked", "true");
  63  |     await expect(colorXorCard).toHaveAttribute("aria-checked", "false");
  64  | 
  65  |     // Click "Split Secret Into Shares"
  66  |     const splitBtn = page.locator('button:has-text("Split Secret Into Shares")');
  67  |     await expect(splitBtn).toBeEnabled();
  68  |     await splitBtn.click();
  69  | 
  70  |     // STEP 3: Wait for generation to finish and Step 3 results to appear
  71  |     await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });
  72  | 
  73  |     // Verify 2 noise shares are shown side-by-side with dedicated Download PNG buttons
  74  |     await expect(page.locator('text=Noise Share 1 of 2')).toBeVisible();
  75  |     await expect(page.locator('text=Noise Share 2 of 2')).toBeVisible();
  76  | 
  77  |     // Verify download button triggers file download
  78  |     const downloadShare1 = page.locator('button:has-text("Download Share PNG")').first();
  79  |     const [downloadEvent] = await Promise.all([
  80  |       page.waitForEvent("download"),
  81  |       downloadShare1.click(),
  82  |     ]);
  83  |     expect(downloadEvent.suggestedFilename()).toContain("share-1");
  84  | 
  85  |     // Switch to "Reconstruction Reveal" tab
  86  |     const revealTab = page.locator('button:has-text("Reconstruction Reveal")');
  87  |     await revealTab.click();
  88  | 
  89  |     // Verify reconstructed image is rendered
  90  |     const revealImg = page.locator('img[alt="Optical Overlay Reconstruction"], img[alt="Enhanced Colour Recovery"]');
> 91  |     await expect(revealImg.first()).toBeVisible();
      |                                     ^ Error: expect(locator).toBeVisible() failed
  92  | 
  93  |     // Switch to "Fidelity Metrics"
  94  |     const metricsTab = page.locator('button:has-text("Fidelity Metrics")');
  95  |     await metricsTab.click();
  96  |     await expect(page.locator("text=Peak Signal-to-Noise Ratio")).toBeVisible();
  97  |   });
  98  | 
  99  |   test("3. Mode B (Colour XOR) achieves byte-exact 100% reconstruction", async ({ page }) => {
  100 |     await page.goto("/#/studio/generate");
  101 | 
  102 |     // Use Demo image
  103 |     await page.locator('button:has-text("Use Colorful Demo Image")').click();
  104 |     await page.locator('button:has-text("Next: Choose Scheme")').click();
  105 | 
  106 |     // Select Colour XOR
  107 |     const colorXorCard = page.locator('div[role="radio"]:has-text("Colour XOR (n, n) Exact")');
  108 |     await colorXorCard.click();
  109 |     await expect(colorXorCard).toHaveAttribute("aria-checked", "true");
  110 | 
  111 |     // Check share count selector
  112 |     await expect(page.locator("#xor-n-select")).toBeVisible();
  113 | 
  114 |     // Split
  115 |     await page.locator('button:has-text("Split Secret Into Shares")').click();
  116 |     await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });
  117 | 
  118 |     // Switch to Fidelity Metrics
  119 |     await page.locator('button:has-text("Fidelity Metrics")').click();
  120 | 
  121 |     // Exact Match must say YES (100%)
  122 |     await expect(page.locator("text=YES (100%)")).toBeVisible();
  123 |   });
  124 | 
  125 |   test("4. Reconstruct Studio: session handoff & secret reveal", async ({ page }) => {
  126 |     // Generate shares in step 1 & 2 first
  127 |     await page.goto("/#/studio/generate");
  128 |     await page.locator('button:has-text("Use Colorful Demo Image")').click();
  129 |     await page.locator('button:has-text("Next: Choose Scheme")').click();
  130 |     await page.locator('button:has-text("Split Secret Into Shares")').click();
  131 |     await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });
  132 | 
  133 |     // Click "Send to Reconstruct"
  134 |     await page.locator('button:has-text("Send to Reconstruct")').click();
  135 |     await page.waitForURL(/.*#\/studio\/reconstruct/);
  136 | 
  137 |     // One-click load from session
  138 |     const loadSessionBtn = page.locator('button:has-text("Load shares from current session")');
  139 |     await expect(loadSessionBtn).toBeVisible();
  140 |     await loadSessionBtn.click();
  141 | 
  142 |     // Verify slots populated
  143 |     await expect(page.locator("text=Ready for Reconstruction")).toBeVisible();
  144 | 
  145 |     // Click "Reconstruct & Reveal Secret"
  146 |     const revealBtn = page.locator('button:has-text("Reconstruct & Reveal Secret")');
  147 |     await expect(revealBtn).toBeEnabled();
  148 |     await revealBtn.click();
  149 | 
  150 |     // Verify reconstructed output appears
  151 |     await expect(page.locator("text=Secret Revealed Successfully")).toBeVisible({ timeout: 15000 });
  152 |   });
  153 | 
  154 |   test("5. Interactive Live Overlay Superposition simulator with drag and opacity", async ({ page }) => {
  155 |     await page.goto("/#/studio/generate");
  156 |     await page.locator('button:has-text("Use Colorful Demo Image")').click();
  157 |     await page.locator('button:has-text("Next: Choose Scheme")').click();
  158 |     await page.locator('button:has-text("Split Secret Into Shares")').click();
  159 |     await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });
  160 | 
  161 |     // Open Live Superposition
  162 |     await page.locator('button:has-text("Live Superposition")').click();
  163 | 
  164 |     // Verify simulator controls
  165 |     await expect(page.locator("text=Alignment & Interactive Superposition")).toBeVisible();
  166 |     await expect(page.locator("text=Drag the top layer")).toBeVisible();
  167 | 
  168 |     // Click "Perfect Alignment (0, 0)"
  169 |     const alignBtn = page.locator('button:has-text("Perfect Alignment (0, 0)")');
  170 |     await expect(alignBtn).toBeVisible();
  171 |     await alignBtn.click();
  172 | 
  173 |     // Verify offset reads 0 px
  174 |     await expect(page.locator("text=Offset: 0 px, 0 px")).toBeVisible();
  175 |   });
  176 | 
  177 |   test("6. Privacy and Memory Wipe with ESC Key", async ({ page }) => {
  178 |     await page.goto("/#/studio/generate");
  179 |     await page.locator('button:has-text("Use Colorful Demo Image")').click();
  180 |     await expect(page.locator("text=Colour detected")).toBeVisible();
  181 | 
  182 |     // Press Escape to wipe session
  183 |     await page.keyboard.press("Escape");
  184 | 
  185 |     // Verify Wipe resets state
  186 |     await page.waitForTimeout(600);
  187 |     await expect(page.locator("text=Drop secret image here")).toBeVisible();
  188 |   });
  189 | 
  190 |   test("7. Mobile Viewport (390x844) Responsiveness", async ({ page }) => {
  191 |     await page.setViewportSize({ width: 390, height: 844 });
```