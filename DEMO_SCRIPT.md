# Visual Cryptography — Progress Review II Demo Script

**Project:** Visual Cryptography  
**Institution:** Symbiosis Skills & Professional University, Pune  
**Event:** Semester Integrated Project — Progress Review II  
**Date:** 10 October 2026  

---

### Step 1. Open the application
- **Action:** Open a modern web browser and navigate to `http://127.0.0.1:5000/`.
- **Expected Result:** The header displays "Visual Cryptography", the subtitle indicates Progress Review II, the logo slot displays the official logo (or designated placeholder), and the Generate tab loads by default with full navigation tabs visible.

### Step 2. Upload an image and generate Overlay shares
- **Action:** In the Generate tab, upload a sample secret image and click the "Generate shares" button with Overlay 2-out-of-2 mode selected.
- **Expected Result:** The preprocessed secret image, combined reconstruction, and two distinct noise-like share cards appear on screen with separate "Download PNG" buttons.

### Step 3. Point to the metrics panel
- **Action:** Scroll down to the Metrics & Verification panel of the generated result.
- **Expected Result:** Pixel expansion displays 4× (4 subpixels per secret pixel), relative difference measures 0.500 with a green "matches theory" badge, and the reconstruction check shows "Passed".

### Step 4. Demonstrate single-share security and absence of leakage
- **Action:** Review the single-share leakage analysis table in the metrics panel.
- **Expected Result:** Both shares exhibit a black pixel proportion near 0.5000 across all regions (secret-black and secret-white) within the mathematical tolerance rule, and an "All passed" badge confirms no visual information leaks.

### Step 5. Demonstrate transparency stacking with manual alignment
- **Action:** Interact with the Stacking demo below the share cards by dragging Share 2 over Share 1, and then clicking the "Align shares" button.
- **Expected Result:** The shares start deliberately misaligned (+37 px, +23 px); dragging shows partial interference, and clicking "Align shares" resets the offset to (0, 0), revealing the reconstructed secret image clearly.

### Step 6. Reconstruct from downloaded shares
- **Action:** Download both generated shares to your local computer, switch to the Reconstruct tab, upload both share PNG files, and click "Reconstruct".
- **Expected Result:** The combined reconstructed image appears with the confirmation message: "All required shares supplied. Shown: the combined result."

### Step 7. Demonstrate threshold security with insufficient shares
- **Action:** On the Reconstruct tab, remove one share (providing only 1 of 2 required shares) and click "Reconstruct".
- **Expected Result:** A prominent warning alert appears stating: "Fewer than the required shares (1 of 2). No recognisable secret is expected. A result built from too few shares shows no recognisable secret (FR-7)."

### Step 8. Run comparative analysis
- **Action:** Navigate to the Compare tab, upload the secret image, and click "Compare modes".
- **Expected Result:** Side-by-side columns display Overlay (P1) alongside XOR (P6), and the summary table highlights Overlay's 4× pixel expansion and 0.500 contrast versus XOR's 1× expansion, 1.000 contrast, and bit-identical exact reconstruction.
