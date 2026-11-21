# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio.spec.ts >> VeilShare Studio v3 - On-Device Cryptography Suite >> 5. Interactive Live Overlay Superposition simulator with drag and opacity
- Location: e2e\studio.spec.ts:154:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Alignment & Interactive Superposition')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Alignment & Interactive Superposition') with timeout 5000ms
  - waiting for locator('text=Alignment & Interactive Superposition')

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
  - heading "Live Optical Superposition Simulator" [level=3]
  - text: Aligned (0, 0) · Secret Revealed
  - button "Snap (0,0)"
  - button "Misalign layer (+14px, +10px)"
  - img "Base Share 1"
  - img "Draggable Overlay Share 2"
  - text: Drag overlay or use arrow keys · Magnetic snap at (0,0)
  - button "Back"
  - button "Stack to Reveal"
```

# Test source

```ts
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
  91  |     await expect(revealImg.first()).toBeVisible();
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
> 165 |     await expect(page.locator("text=Alignment & Interactive Superposition")).toBeVisible();
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
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
  192 |     await page.goto("/#/studio/generate");
  193 | 
  194 |     // Navbar brand and emblem
  195 |     const emblem = page.locator('img[alt="SSPU Official Emblem"]');
  196 |     await expect(emblem).toBeVisible();
  197 | 
  198 |     // Sticky bottom action bar
  199 |     const bottomBar = page.locator(".sticky.bottom-0");
  200 |     await expect(bottomBar).toBeVisible();
  201 | 
  202 |     // Demo button works on mobile
  203 |     await page.locator('button:has-text("Use Colorful Demo Image")').click();
  204 |     await expect(page.locator('button:has-text("Next: Choose Scheme")')).toBeVisible();
  205 |   });
  206 | 
  207 |   test("8. Accessibility Audit (Axe-core)", async ({ page }) => {
  208 |     await page.goto("/#/");
  209 |     const accessibilityScanResults = await new AxeBuilder({ page })
  210 |       .disableRules(["color-contrast"]) // Custom theme CSS variables
  211 |       .analyze();
  212 | 
  213 |     const criticalViolations = accessibilityScanResults.violations.filter(
  214 |       (v) => v.impact === "critical"
  215 |     );
  216 |     expect(criticalViolations.length).toBe(0);
  217 |   });
  218 | });
  219 | 
```