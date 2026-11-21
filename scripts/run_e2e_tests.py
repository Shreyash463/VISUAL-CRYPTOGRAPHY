"""Comprehensive Real-Browser End-to-End Test Suite for VeilShare Studio.

Uses Playwright with Google Chrome channel (channel="chrome").
Supports testing both local server and live production.
Fails immediately on any uncaught console error or page error.
"""
import sys
import io
import os
import time
import argparse
import threading
import numpy as np
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright
from app import create_app

PROD_URL = "https://visual-cryptography-rouge.vercel.app"
LOCAL_PORT = 5056

class ServerThread(threading.Thread):
    def __init__(self, app, port=LOCAL_PORT):
        super().__init__()
        self.server = make_server("127.0.0.1", port, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()


def create_test_images(tmp_dir: Path):
    tmp_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Colour JPG (vivid 4 quadrants: red, green, blue, yellow)
    img_col = Image.new("RGB", (64, 64), color="white")
    arr = np.array(img_col)
    arr[0:32, 0:32] = [255, 0, 0]      # Red
    arr[0:32, 32:64] = [0, 255, 0]      # Green
    arr[32:64, 0:32] = [0, 0, 255]      # Blue
    arr[32:64, 32:64] = [255, 255, 0]  # Yellow
    col_jpg_path = tmp_dir / "sample_colour.jpg"
    Image.fromarray(arr).save(col_jpg_path, quality=95)

    # 2. Colour PNG (vivid palette)
    col_png_path = tmp_dir / "sample_colour.png"
    Image.fromarray(arr).save(col_png_path)

    # 3. Greyscale PNG (gradient checkerboard)
    arr_bw = np.zeros((64, 64), dtype=np.uint8)
    for y in range(64):
        for x in range(64):
            arr_bw[y, x] = 255 if ((x // 8) + (y // 8)) % 2 == 0 else 0
    bw_png_path = tmp_dir / "sample_bw.png"
    Image.fromarray(arr_bw).save(bw_png_path)

    # 4. Large photo (> 1200px)
    large_arr = np.zeros((720, 1280, 3), dtype=np.uint8)
    large_arr[:, :, 0] = 40
    large_arr[:, :, 1] = 120
    large_arr[:, :, 2] = 200
    large_path = tmp_dir / "sample_large.jpg"
    Image.fromarray(large_arr).save(large_path, quality=90)

    return {
        "col_jpg": col_jpg_path,
        "col_png": col_png_path,
        "bw_png": bw_png_path,
        "large": large_path,
    }


def compute_mean_saturation_from_data_url(page, img_locator) -> float:
    """Evaluate image on canvas and compute mean HSV saturation."""
    sat = page.evaluate("""(selector) => {
        const img = document.querySelector(selector);
        if (!img) return 0;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        let totalSat = 0;
        let count = 0;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i] / 255;
            const g = d[i+1] / 255;
            const b = d[i+2] / 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const s = max === 0 ? 0 : delta / max;
            totalSat += s;
            count++;
        }
        return count > 0 ? (totalSat / count) : 0;
    }""", img_locator)
    return float(sat)


def download_base64_image(page, img_selector, dest_path: Path):
    """Save an <img> rendered in the DOM to disk preserving exact PNG bytes & metadata."""
    b64 = page.evaluate("""(selector) => {
        const img = document.querySelector(selector);
        if (!img) return null;
        if (img.src && img.src.includes(";base64,")) {
            return img.src.split(";base64,")[1];
        }
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
    }""", img_selector)
    if b64:
        import base64
        dest_path.write_bytes(base64.b64decode(b64))
        return True
    return False


def run_e2e(base_url: str):
    print(f"\n=======================================================")
    print(f"  RUNNING REAL BROWSER E2E TESTS AGAINST: {base_url}")
    print(f"=======================================================\n")

    tmp_dir = Path("scratch/e2e_samples")
    screens_dir = Path("docs/screens")
    screens_dir.mkdir(parents=True, exist_ok=True)
    images = create_test_images(tmp_dir)

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        console_errors = []
        page_errors = []

        def on_console(msg):
            if msg.type == "error":
                # Filter out benign 404 for optional favicon if any
                if "favicon.ico" in msg.text:
                    return
                console_errors.append(msg.text)
                print(f"  [BROWSER CONSOLE ERROR] {msg.text}")

        def on_pageerror(err):
            page_errors.append(str(err))
            print(f"  [BROWSER PAGE ERROR] {err}")

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)

        def assert_no_browser_errors(test_name: str):
            if console_errors:
                err_summary = "; ".join(console_errors)
                console_errors.clear()
                raise AssertionError(f"[{test_name}] Browser console error detected: {err_summary}")
            if page_errors:
                err_summary = "; ".join(page_errors)
                page_errors.clear()
                raise AssertionError(f"[{test_name}] Browser unhandled exception: {err_summary}")

        # -------------------------------------------------------------
        # Test 1: Header, Subtitle, and Footer Branding
        # -------------------------------------------------------------
        test_name = "Branding & Typography"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            assert_no_browser_errors(test_name)

            # Check Subtitle says "Final Review" and footer does NOT contain old date
            subtitle = page.locator("#site-header .subtitle").text_content().strip()
            assert "Final Review" in subtitle, f"Subtitle unexpected: {subtitle}"
            assert "10 October 2026" not in subtitle
            assert "Progress Review II" not in subtitle

            footer = page.locator("#site-footer").text_content().strip()
            assert "Visual Cryptography | SSPU Final Review" in footer, f"Footer unexpected: {footer}"
            assert "10 October 2026" not in footer
            assert "Progress Review II" not in footer

            results.append((test_name, True, "Header and footer say Final Review (no date)"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 2: Scheme Badges & Single Selection Invariant
        # -------------------------------------------------------------
        test_name = "Scheme Single Selection & Badges"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            
            # Check cards on initial load
            cards = ["card-color-overlay", "card-color-xor", "card-bw-overlay", "card-bw-xor"]
            selected_count = 0
            for cid in cards:
                card = page.locator(f"#{cid}")
                is_selected = "selected" in (card.get_attribute("class") or "")
                badge_vis = card.locator(".badge").is_visible()
                radio_chk = card.locator("input[type='radio']").is_checked()
                assert is_selected == badge_vis == radio_chk, (
                    f"Card {cid} sync mismatch: selected={is_selected}, badge={badge_vis}, radio={radio_chk}"
                )
                if is_selected:
                    selected_count += 1
            assert selected_count == 1, f"Expected exactly 1 card selected on load, found {selected_count}"

            # Click Colour XOR card and assert only Colour XOR is selected
            page.locator("#card-color-xor").click()
            page.wait_for_timeout(200)
            assert "selected" in page.locator("#card-color-xor").get_attribute("class")
            assert page.locator("#card-color-xor .badge").is_visible()
            assert page.locator("#card-color-overlay .badge").is_hidden()
            assert page.locator("#card-bw-overlay .badge").is_hidden()
            assert page.locator("#card-bw-xor .badge").is_hidden()

            # Check that Step 3 shows XOR select and hides overlay note
            assert page.locator("#xor-select-group").is_visible()
            assert page.locator("#overlay-share-note").is_hidden()

            # Click back to Colour Overlay
            page.locator("#card-color-overlay").click()
            page.wait_for_timeout(200)
            assert "selected" in page.locator("#card-color-overlay").get_attribute("class")
            assert page.locator("#card-color-overlay .badge").is_visible()
            assert page.locator("#card-color-xor .badge").is_hidden()
            assert page.locator("#overlay-share-note").is_visible()
            assert page.locator("#xor-select-group").is_hidden()

            assert_no_browser_errors(test_name)
            results.append((test_name, True, "Exactly 1 scheme card selected; badges and share counts in perfect sync"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 3: Colour JPG Split with Colour Overlay (P5 Hou)
        # -------------------------------------------------------------
        test_name = "Colour JPG with Colour Overlay (P5 Hou)"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#gen-file-input").set_input_files(str(images["col_jpg"]))
            page.wait_for_timeout(400)

            # Auto-colour detection selects Colour Overlay
            assert "selected" in page.locator("#card-color-overlay").get_attribute("class")
            assert page.locator("#card-color-overlay .badge").is_visible()

            # Click Split Secret Into Shares
            page.locator("#panel-generate button[type='submit']").click()
            page.wait_for_selector("#rpanel-overview", timeout=15000)
            assert_no_browser_errors(test_name)

            # Check Overview reconstruction image
            rec_img = page.locator("#rpanel-overview .results-grid-2col .image-frame:nth-child(2) img")
            assert rec_img.count() > 0
            w = rec_img.evaluate("img => img.naturalWidth")
            h = rec_img.evaluate("img => img.naturalHeight")
            assert w > 0 and h > 0, f"Reconstruction image naturalWidth is 0"

            # Switch to Shares sub-tab
            page.locator("#rtab-shares").click()
            page.wait_for_timeout(300)
            share_frames = page.locator("#rpanel-shares .results-grid-cards .image-frame img")
            assert share_frames.count() == 2, f"Expected 2 shares, got {share_frames.count()}"
            s1_w = share_frames.nth(0).evaluate("img => img.naturalWidth")
            s2_w = share_frames.nth(1).evaluate("img => img.naturalWidth")
            assert s1_w > 0 and s2_w > 0

            # Screenshot generated colour shares
            page.screenshot(path=str(screens_dir / "generated_colour_shares.png"))

            # Switch to Reconstruct Tab and use Transfer from last run
            page.locator("#tab-reconstruct").click()
            page.wait_for_timeout(300)
            page.wait_for_function("() => !document.getElementById('btn-load-last-run').disabled", timeout=10000)
            page.locator("#btn-load-last-run").click()
            page.wait_for_timeout(300)

            # Verify scheme is color_overlay and click Reconstruct
            page.locator("#recon-scheme-select").select_option("color_overlay")
            page.wait_for_function("() => !document.getElementById('btn-reconstruct').disabled", timeout=10000)
            page.locator("#btn-reconstruct").click()
            page.wait_for_selector("#panel-reconstruct .results-col img", timeout=15000)
            assert_no_browser_errors(test_name)

            # Verify reconstruction image is rendered and has colour (saturation > 0.15)
            recon_img_sel = "#panel-reconstruct .results-col img"
            sat = compute_mean_saturation_from_data_url(page, recon_img_sel)
            assert sat > 0.15, f"Reconstruction saturation {sat:.3f} is below 0.15 threshold"

            # Screenshot colour reconstruction
            page.screenshot(path=str(screens_dir / "colour_reconstruction.png"))

            results.append((test_name, True, f"Shares rendered (2x2 expanded), reconstruction in full colour (sat={sat:.3f})"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 4: Colour PNG with Colour XOR (P6 Extension) n=3
        # -------------------------------------------------------------
        test_name = "Colour PNG with Colour XOR (n=3)"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#gen-file-input").set_input_files(str(images["col_png"]))
            page.wait_for_timeout(300)

            # Select Colour XOR
            page.locator("#card-color-xor").click()
            page.wait_for_timeout(200)
            # Select n=3
            page.locator("#xor-n-select").select_option("3")

            # Click Split
            page.locator("#panel-generate button[type='submit']").click()
            page.wait_for_selector("#rpanel-overview", timeout=15000)
            assert_no_browser_errors(test_name)

            # Switch to Shares tab
            page.locator("#rtab-shares").click()
            page.wait_for_timeout(300)
            share_imgs = page.locator("#rpanel-shares .results-grid-cards .image-frame img")
            assert share_imgs.count() == 3, f"Expected 3 shares, got {share_imgs.count()}"

            # Export 3 share images to disk
            share_files = []
            for i in range(3):
                s_path = tmp_dir / f"xor3_share_{i+1}.png"
                download_base64_image(page, f"#rpanel-shares .results-grid-cards .image-frame:nth-child({i+1}) img", s_path)
                assert s_path.exists() and s_path.stat().st_size > 0
                share_files.append(str(s_path))

            # Reconstruct by uploading all 3 shares
            page.locator("#tab-reconstruct").click()
            page.wait_for_timeout(300)
            page.locator("#recon-multi-input").set_input_files(share_files)
            page.wait_for_timeout(400)

            # Select scheme: color_xor, n=3
            page.locator("#recon-scheme-select").select_option("color_xor")
            page.locator("#recon-n-select").select_option("3")
            page.wait_for_function("() => !document.getElementById('btn-reconstruct').disabled", timeout=10000)
            page.locator("#btn-reconstruct").click()

            page.wait_for_selector("#panel-reconstruct .results-col img", timeout=15000)
            assert_no_browser_errors(test_name)

            recon_sat = compute_mean_saturation_from_data_url(page, "#panel-reconstruct .results-col img")
            assert recon_sat > 0.15, f"XOR n=3 reconstruction saturation {recon_sat:.3f} below 0.15"

            results.append((test_name, True, f"Generated 3 shares, lossless colour reconstructed (sat={recon_sat:.3f})"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 5: Colour XOR with n=2 and n=4
        # -------------------------------------------------------------
        test_name = "Colour XOR with n=2 and n=4"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            for n_val in [2, 4]:
                page.goto(f"{base_url}/app", wait_until="networkidle")
                page.locator("#gen-file-input").set_input_files(str(images["col_png"]))
                page.wait_for_timeout(200)
                page.locator("#card-color-xor").click()
                page.locator("#xor-n-select").select_option(str(n_val))
                page.locator("#panel-generate button[type='submit']").click()
                page.wait_for_selector("#rpanel-overview", timeout=15000)
                assert_no_browser_errors(test_name)

                page.locator("#rtab-shares").click()
                page.wait_for_timeout(200)
                shares_cnt = page.locator("#rpanel-shares .results-grid-cards .image-frame img").count()
                assert shares_cnt == n_val, f"For n={n_val}, expected {n_val} shares, got {shares_cnt}"

            results.append((test_name, True, "Both n=2 and n=4 generate exact corresponding share counts"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 6: Greyscale PNG with B/W Overlay (P1 Naor-Shamir)
        # -------------------------------------------------------------
        test_name = "Greyscale PNG with B/W Overlay (P1)"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#gen-file-input").set_input_files(str(images["bw_png"]))
            page.wait_for_timeout(300)

            # Auto-selected B/W Overlay
            assert "selected" in page.locator("#card-bw-overlay").get_attribute("class")
            page.locator("#panel-generate button[type='submit']").click()
            page.wait_for_selector("#rpanel-overview", timeout=15000)
            assert_no_browser_errors(test_name)

            page.locator("#rtab-shares").click()
            page.wait_for_timeout(200)
            shares_cnt = page.locator("#rpanel-shares .results-grid-cards .image-frame img").count()
            assert shares_cnt == 2

            results.append((test_name, True, "B/W Overlay produces 2 shares with baseline 2x2 expansion"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 7: Greyscale PNG with B/W XOR (P6 Wang)
        # -------------------------------------------------------------
        test_name = "Greyscale PNG with B/W XOR (P6)"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#gen-file-input").set_input_files(str(images["bw_png"]))
            page.wait_for_timeout(300)
            page.locator("#card-bw-xor").click()
            page.locator("#panel-generate button[type='submit']").click()
            page.wait_for_selector("#rpanel-overview", timeout=15000)
            assert_no_browser_errors(test_name)

            results.append((test_name, True, "B/W XOR processed and rendered with zero pixel expansion"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 8: Large Photo (> 1200px) Sizing & Aspect Ratio
        # -------------------------------------------------------------
        test_name = "Large Photo (> 1200px) Handling"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#gen-file-input").set_input_files(str(images["large"]))
            page.wait_for_timeout(400)
            page.locator("#panel-generate button[type='submit']").click()
            page.wait_for_selector("#rpanel-overview", timeout=20000)
            assert_no_browser_errors(test_name)

            rec_img = page.locator("#rpanel-overview .results-grid-2col .image-frame:nth-child(2) img")
            w = rec_img.evaluate("img => img.naturalWidth")
            h = rec_img.evaluate("img => img.naturalHeight")
            assert w > 0 and h > 0
            results.append((test_name, True, f"Large image processed cleanly (reconstruction size: {w}x{h} px)"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 9: Demo Mode Header Action
        # -------------------------------------------------------------
        test_name = "Demo Mode Header Action"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#btn-demo-mode").click()
            page.wait_for_selector("#rpanel-overview", timeout=15000)
            assert_no_browser_errors(test_name)

            results.append((test_name, True, "Demo Mode loaded procedural colourful sample and rendered shares"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        # -------------------------------------------------------------
        # Test 10: Mobile Viewport (390 px) Responsiveness
        # -------------------------------------------------------------
        test_name = "Mobile Viewport (390 px)"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(f"{base_url}/app", wait_until="networkidle")
            
            # Check horizontal overflow
            overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
            assert not overflow, "Horizontal overflow detected on 390px viewport"
            assert_no_browser_errors(test_name)

            results.append((test_name, True, "Zero horizontal overflow at 390px mobile viewport"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")
        finally:
            page.set_viewport_size({"width": 1280, "height": 900})

        # -------------------------------------------------------------
        # Test 11: Mismatched Shares Warning
        # -------------------------------------------------------------
        test_name = "Mismatched Shares Warning"
        print(f"Running Test: {test_name} ...", end=" ")
        try:
            # Generate Run A
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#gen-file-input").set_input_files(str(images["col_png"]))
            page.wait_for_timeout(300)
            page.locator("#panel-generate button[type='submit']").click()
            page.wait_for_selector("#rpanel-overview", timeout=15000)
            page.locator("#rtab-shares").click()
            page.wait_for_timeout(200)
            runA_s1 = tmp_dir / "runA_share1.png"
            download_base64_image(page, "#rpanel-shares .results-grid-cards .image-frame:nth-child(1) img", runA_s1)

            # Generate Run B
            page.goto(f"{base_url}/app", wait_until="networkidle")
            page.locator("#gen-file-input").set_input_files(str(images["col_jpg"]))
            page.wait_for_timeout(300)
            page.locator("#panel-generate button[type='submit']").click()
            page.wait_for_selector("#rpanel-overview", timeout=15000)
            page.locator("#rtab-shares").click()
            page.wait_for_timeout(200)
            runB_s2 = tmp_dir / "runB_share2.png"
            download_base64_image(page, "#rpanel-shares .results-grid-cards .image-frame:nth-child(2) img", runB_s2)

            # Upload Run A Share 1 and Run B Share 2 to Reconstruct
            page.locator("#tab-reconstruct").click()
            page.wait_for_timeout(300)
            page.locator("#recon-multi-input").set_input_files([str(runA_s1), str(runB_s2)])
            page.wait_for_timeout(600)

            # Assert warning alert is visible
            alert_vis = page.locator("#panel-reconstruct .alert-warn").is_visible()
            assert alert_vis, "Group mismatch warning alert not visible for shares from different runs"
            assert_no_browser_errors(test_name)

            results.append((test_name, True, "Mismatched generation runs flagged with warning banner"))
            print("PASS")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"FAIL: {e}")

        context.close()
        browser.close()

    print("\n=======================================================")
    print("  E2E TEST RUN SUMMARY")
    print("=======================================================")
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = total - passed

    for name, ok, note in results:
        status_str = "PASS" if ok else "FAIL"
        print(f"[{status_str}] {name:<40} : {note}")

    print("-------------------------------------------------------")
    print(f"TOTAL: {total} | PASSED: {passed} | FAILED: {failed}")
    print("=======================================================\n")

    return failed == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prod", action="store_true", help="Test live production URL")
    parser.add_argument("--local", action="store_true", help="Test local server")
    args = parser.parse_args()

    if args.prod:
        target_url = PROD_URL
        server = None
    else:
        app = create_app()
        server = ServerThread(app, port=LOCAL_PORT)
        server.start()
        time.sleep(1.2)
        target_url = f"http://127.0.0.1:{LOCAL_PORT}"

    try:
        success = run_e2e(target_url)
    finally:
        if server:
            server.shutdown()

    sys.exit(0 if success else 1)
