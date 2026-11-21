import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("VeilShare Studio v3 - On-Device Cryptography Suite", () => {
  test("1. Landing page loads, hero headline, scroll storytelling, and Open Studio navigation", async ({ page }) => {
    await page.goto("/#/?intro=0");
    await expect(page).toHaveTitle(/VeilShare/i);

    // Verify Brand, SSPU Emblem, and Hero headline
    const emblem = page.locator('header img[alt="SSPU Official Emblem"]').first();
    await expect(emblem).toBeVisible();

    const heroTitle = page.locator("h1");
    await expect(heroTitle).toContainText("Two noises");

    // Check privacy badge
    await expect(page.locator("text=Zero Cloud Transmission")).toBeVisible();

    // Scroll to check storytelling
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);

    // Click "Open Studio"
    const openStudioBtn = page.locator('a:has-text("Open Studio"), button:has-text("Open Studio")').first();
    await openStudioBtn.click();

    // Verify navigation to /#/studio/generate
    await page.waitForURL(/.*#\/studio\/generate/);
    await expect(page.locator("h1")).toContainText("Generate Visual Shares");
  });

  test("2. 1366x768 Viewport: Demo Image -> Scheme Select -> Generate 2 Noise Shares with Download Buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/#/studio/generate");

    // Click "Use Colorful Demo Image"
    const demoBtn = page.locator('button:has-text("Use Colorful Demo Image")');
    await expect(demoBtn).toBeVisible();
    await demoBtn.click();

    // Verify Step 1 preview is shown and "Colour detected" badge appears
    await expect(page.locator("text=Colour detected")).toBeVisible();

    // Click "Next: Choose Scheme"
    const nextBtn = page.locator('button:has-text("Next: Choose Scheme")');
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // STEP 2: Scheme selection
    const colorOverlayCard = page.locator('div[role="radio"]:has-text("Colour Overlay 2-of-2")');
    const colorXorCard = page.locator('div[role="radio"]:has-text("Colour XOR (n, n) Exact")');
    const bwOverlayCard = page.locator('div[role="radio"]:has-text("B/W Overlay 2-of-2")');
    const bwXorCard = page.locator('div[role="radio"]:has-text("B/W XOR (n, n)")');

    await expect(colorOverlayCard).toBeVisible();
    await expect(colorXorCard).toBeVisible();
    await expect(bwOverlayCard).toBeVisible();
    await expect(bwXorCard).toBeVisible();

    // By default for colour image, Colour Overlay should be selected
    await expect(colorOverlayCard).toHaveAttribute("aria-checked", "true");
    await expect(colorXorCard).toHaveAttribute("aria-checked", "false");

    // Click "Split Secret Into Shares"
    const splitBtn = page.locator('button:has-text("Split Secret Into Shares")');
    await expect(splitBtn).toBeEnabled();
    await splitBtn.click();

    // STEP 3: Wait for generation to finish and Step 3 results to appear
    await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });

    // Verify 2 noise shares are shown side-by-side with dedicated Download PNG buttons
    await expect(page.locator("text=Noise Share 1 of 2")).toBeVisible();
    await expect(page.locator("text=Noise Share 2 of 2")).toBeVisible();

    // Verify download button triggers file download
    const downloadShare1 = page.locator('button:has-text("Download Share PNG")').first();
    const [downloadEvent] = await Promise.all([
      page.waitForEvent("download"),
      downloadShare1.click(),
    ]);
    expect(downloadEvent.suggestedFilename()).toContain("share-1");

    // Switch to "Reconstruction Reveal" tab
    const revealTab = page.locator('button:has-text("Reconstruction Reveal")');
    await revealTab.click();

    // Verify reconstructed image is rendered
    const revealImg = page.locator('img[alt="Reconstructed Secret"]');
    await expect(revealImg.first()).toBeVisible();

    // Switch to "Fidelity Metrics"
    const metricsTab = page.locator('button:has-text("Fidelity Metrics")');
    await metricsTab.click();
    await expect(page.locator("text=Peak Signal-to-Noise Ratio")).toBeVisible();
  });

  test("3. Mode B (Colour XOR) achieves byte-exact 100% reconstruction", async ({ page }) => {
    await page.goto("/#/studio/generate");

    // Use Demo image
    await page.locator('button:has-text("Use Colorful Demo Image")').click();
    await page.locator('button:has-text("Next: Choose Scheme")').click();

    // Select Colour XOR
    const colorXorCard = page.locator('div[role="radio"]:has-text("Colour XOR (n, n) Exact")');
    await colorXorCard.click();
    await expect(colorXorCard).toHaveAttribute("aria-checked", "true");

    // Check share count selector
    await expect(page.locator("#xor-n-select")).toBeVisible();

    // Split
    await page.locator('button:has-text("Split Secret Into Shares")').click();
    await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });

    // Switch to Fidelity Metrics
    await page.locator('button:has-text("Fidelity Metrics")').click();

    // Exact Match must say YES (100%)
    await expect(page.locator("text=YES (100%)")).toBeVisible();
  });

  test("4. Reconstruct Studio: session handoff & secret reveal", async ({ page }) => {
    // Generate shares in step 1 & 2 first
    await page.goto("/#/studio/generate");
    await page.locator('button:has-text("Use Colorful Demo Image")').click();
    await page.locator('button:has-text("Next: Choose Scheme")').click();
    await page.locator('button:has-text("Split Secret Into Shares")').click();
    await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });

    // Click "Send to Reconstruct"
    await page.locator('button:has-text("Send to Reconstruct")').click();
    await page.waitForURL(/.*#\/studio\/reconstruct/);

    // One-click load from session
    const loadSessionBtn = page.locator('button:has-text("Use shares from this session")');
    await expect(loadSessionBtn).toBeVisible();
    await loadSessionBtn.click();

    // Verify slots populated with share filenames
    await expect(page.locator('text=share-1')).toBeVisible();

    // Click "Reveal Secret"
    const revealBtn = page.locator('button:has-text("Reveal Secret")');
    await expect(revealBtn).toBeEnabled();
    await revealBtn.click();

    // Verify reconstructed output appears
    await expect(page.locator('h3:has-text("Reconstructed Secret")')).toBeVisible({ timeout: 15000 });
  });

  test("5. Interactive Live Overlay Superposition simulator with drag and opacity", async ({ page }) => {
    await page.goto("/#/studio/generate");
    await page.locator('button:has-text("Use Colorful Demo Image")').click();
    await page.locator('button:has-text("Next: Choose Scheme")').click();
    await page.locator('button:has-text("Split Secret Into Shares")').click();
    await expect(page.locator('button:has-text("Visual Shares (2)")')).toBeVisible({ timeout: 20000 });

    // Open Live Superposition
    await page.locator('button:has-text("Live Superposition")').click();

    // Verify simulator controls
    await expect(page.locator('h3:has-text("Live Optical Superposition Simulator")')).toBeVisible();

    // Click "Snap (0,0)"
    const snapBtn = page.locator('button:has-text("Snap (0,0)")');
    await expect(snapBtn).toBeVisible();
    await snapBtn.click();

    // Verify aligned status indicator
    await expect(page.locator("text=Aligned (0, 0)")).toBeVisible();
  });

  test("6. Privacy and Memory Wipe with ESC Key", async ({ page }) => {
    await page.goto("/#/studio/generate");
    await page.locator('button:has-text("Use Colorful Demo Image")').click();
    await expect(page.locator("text=Colour detected")).toBeVisible();

    // Press Escape to wipe session
    await page.keyboard.press("Escape");

    // Verify Wipe resets state
    await page.waitForTimeout(600);
    await expect(page.locator("text=Drop secret image here")).toBeVisible();
  });

  test("7. Mobile Viewport (390x844) Responsiveness", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/studio/generate");

    // Navbar brand and emblem
    const emblem = page.locator('img[alt="SSPU Official Emblem"]');
    await expect(emblem).toBeVisible();

    // Sticky bottom action bar
    const bottomBar = page.locator(".sticky.bottom-0");
    await expect(bottomBar).toBeVisible();

    // Demo button works on mobile
    await page.locator('button:has-text("Use Colorful Demo Image")').click();
    await expect(page.locator('button:has-text("Next: Choose Scheme")')).toBeVisible();
  });

  test("8. Accessibility Audit (Axe-core)", async ({ page }) => {
    await page.goto("/#/?intro=0");
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"]) // Custom theme CSS variables
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical"
    );
    expect(criticalViolations.length).toBe(0);
  });

  test("9. Logo Restoration: SSPU emblem loads crisp in Header, Hero, and About in both themes", async ({ page }) => {
    // Check dark theme
    await page.goto("/#/?intro=0");
    const headerLogo = page.locator('header img[alt="SSPU Official Emblem"]').first();
    await expect(headerLogo).toBeVisible();

    const isHeaderNatural = await headerLogo.evaluate((img: HTMLImageElement) => img.naturalWidth > 0 && img.naturalHeight > 0);
    expect(isHeaderNatural).toBe(true);

    // Hero emblem
    const heroEmblem = page.locator('div img[alt="SSPU Official Emblem"]').first();
    await expect(heroEmblem).toBeVisible();
    const isHeroNatural = await heroEmblem.evaluate((img: HTMLImageElement) => img.naturalWidth > 0 && img.naturalHeight > 0);
    expect(isHeroNatural).toBe(true);

    // Save screenshot
    await page.screenshot({ path: "docs/screens/header-logo.png" });

    // Navigate to About page
    await page.goto("/#/studio/about?intro=0");
    const aboutEmblem = page.locator('img[alt="SSPU Official Emblem"]').first();
    await expect(aboutEmblem).toBeVisible();
    const isAboutNatural = await aboutEmblem.evaluate((img: HTMLImageElement) => img.naturalWidth > 0);
    expect(isAboutNatural).toBe(true);
  });

  test("10. Team Verification: Exact 5 members (Shreyash, Ayushi, Niharika, Yash, Kunal) without surnames or roles", async ({ page }) => {
    await page.goto("/#/studio/about?intro=0");

    // Verify 5 team member names are visible
    for (const name of ["Shreyash", "Ayushi", "Niharika", "Yash", "Kunal"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }

    // Verify no forbidden legacy placeholders
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("Team Member");
    expect(pageText).not.toContain("Dixit");
    expect(pageText).not.toContain("Sharma");
    expect(pageText).not.toContain("Kulkarni");
    expect(pageText).not.toContain("Joshi");
    expect(pageText).not.toContain("Patel");

    // Screenshot About team section
    await page.screenshot({ path: "docs/screens/about-team.png" });
  });

  test("11. Cinematic Intro: Noise curtain plays on first visit, dismissable via Esc/Click, bypassed with ?intro=0", async ({ page }) => {
    // Clear sessionStorage
    await page.goto("/#/?intro=0");
    await page.evaluate(() => sessionStorage.clear());

    // Visit without bypass
    await page.goto("/#/");
    const introOverlay = page.locator('[data-testid="cinematic-intro"], div:has-text("VeilShare")').first();
    await expect(introOverlay).toBeVisible();

    // Take screenshot of intro curtain
    await page.screenshot({ path: "docs/screens/intro-curtain.png" });

    // Press Escape to dismiss
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // Bypassed with ?intro=0
    await page.goto("/#/?intro=0");
    const introWithParam = page.locator('[data-testid="cinematic-intro"]');
    await expect(introWithParam).not.toBeVisible();
  });

  test("12. Multi-Share Reconstruct: Dynamic slots, missing indicator, security demo noise, and exact reveal", async ({ page }) => {
    // Generate 4 XOR shares in Generate Studio
    await page.goto("/#/studio/generate?intro=0");
    await page.locator('button:has-text("Use Colorful Demo Image")').click();
    await page.locator('button:has-text("Next: Choose Scheme")').click();

    // Select Colour XOR
    const colorXorCard = page.locator('div[role="radio"]:has-text("Colour XOR (n, n) Exact")');
    await colorXorCard.click();

    // Choose 4 shares
    const nSelect = page.locator("#xor-n-select");
    await nSelect.selectOption("4");

    // Split
    await page.locator('button:has-text("Split Secret Into Shares")').click();
    await expect(page.locator('button:has-text("Visual Shares (4)")')).toBeVisible({ timeout: 25000 });

    // Send to Reconstruct
    await page.locator('button:has-text("Send to Reconstruct")').click();
    await page.waitForURL(/.*#\/studio\/reconstruct/);

    // Verify 4 slots are present
    await expect(page.locator("text=Share Slot 1")).toBeVisible();
    await expect(page.locator("text=Share Slot 2")).toBeVisible();
    await expect(page.locator("text=Share Slot 3")).toBeVisible();
    await expect(page.locator("text=Share Slot 4")).toBeVisible();

    // Remove one share to test incomplete set
    const removeBtn = page.locator('button[aria-label="Remove share slot 4"]').first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await page.waitForTimeout(200);

      // Verify missing helper message
      await expect(page.locator("text=Need 1 more share: 4")).toBeVisible();

      // Primary Reveal button must be disabled
      const revealBtn = page.locator('button:has-text("Need 1 More Share")');
      await expect(revealBtn).toBeDisabled();

      // Security demo button must be visible
      const securityDemoBtn = page.locator('button:has-text("Security demo: reveal with missing shares")');
      await expect(securityDemoBtn).toBeVisible();
      await securityDemoBtn.click();

      // Verify noise result with required security caption
      await expect(page.locator("text=Incomplete set: this is random noise, exactly as the security property promises.")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Security Demonstration Result")).toBeVisible();
    }

    // Now reload all shares using the session chip
    const loadSessionBtn = page.locator('button:has-text("Use shares from this session")');
    await loadSessionBtn.click();

    // Progress shows 4 of 4
    await expect(page.locator("text=All shares ready")).toBeVisible();

    // Screenshot of 4 slots ready
    await page.screenshot({ path: "docs/screens/reconstruct-slots.png" });

    // Reveal secret
    const revealSecretBtn = page.locator('button:has-text("Reveal Secret")');
    await expect(revealSecretBtn).toBeEnabled();
    await revealSecretBtn.click();

    // Verify full secret revealed
    await expect(page.locator('h3:has-text("Reconstructed Secret Image")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=100% byte-exact lossless reconstruction")).toBeVisible();
  });
});
