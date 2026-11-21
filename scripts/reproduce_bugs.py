"""Drive the real site in system Chrome to reproduce and capture bugs."""
import time
from playwright.sync_api import sync_playwright

def test_production():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        console_logs = []
        page_errors = []

        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print("Navigating to production...")
        page.goto("https://visual-cryptography-rouge.vercel.app/app")
        page.wait_for_timeout(2000)

        # 1. Check scheme cards state
        cards = page.locator(".radio-card")
        print(f"Total scheme cards: {cards.count()}")
        for i in range(cards.count()):
            c = cards.nth(i)
            c_id = c.get_attribute("id")
            badge = c.locator(".badge")
            radio = c.locator("input[type='radio']")
            is_radio_checked = radio.is_checked()
            is_badge_visible = badge.is_visible() if badge.count() > 0 else False
            classes = c.get_attribute("class")
            print(f"Card {c_id}: checked={is_radio_checked}, badge_visible={is_badge_visible}, classes='{classes}'")

        # 2. Try clicking XOR scheme card
        print("\nClicking Colour XOR card...")
        page.click("#card-color-xor")
        page.wait_for_timeout(1000)

        overlay_note = page.locator("#panel-generate p.help-text:has-text('fixed for overlay')")
        xor_select = page.locator("#panel-generate select.form-select")
        print("After clicking Colour XOR:")
        print(f"  Overlay note visible: {overlay_note.is_visible() if overlay_note.count() > 0 else 'N/A'}")
        if xor_select.count() > 0:
            print(f"  XOR select visible: {xor_select.first.is_visible()}")

        # 3. Create a synthetic colour image and upload it
        from PIL import Image
        import io
        img = Image.new("RGB", (64, 64), color=(255, 100, 50))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="JPEG")

        file_payload = {
            "name": "sample_color.jpg",
            "mimeType": "image/jpeg",
            "buffer": img_bytes.getvalue(),
        }

        print("\nUploading sample_color.jpg...")
        page.set_input_files("#gen-file-input", file_payload)
        page.wait_for_timeout(1500)

        col_badge = page.locator(".color-detect-badge")
        print(f"Color detect badge visible: {col_badge.is_visible() if col_badge.count() > 0 else False}")

        # Check scheme cards after upload
        for i in range(cards.count()):
            c = cards.nth(i)
            c_id = c.get_attribute("id")
            badge = c.locator(".badge")
            radio = c.locator("input[type='radio']")
            is_radio_checked = radio.is_checked()
            is_badge_visible = badge.is_visible() if badge.count() > 0 else False
            print(f"Card {c_id}: checked={is_radio_checked}, badge_visible={is_badge_visible}")

        # 4. Click Split Secret Into Shares
        print("\nClicking Split Secret Into Shares...")
        submit_btn = page.locator("#panel-generate button[type='submit']")
        print(f"Submit button found: {submit_btn.count()}, text: '{submit_btn.text_content()}'")
        submit_btn.click()
        page.wait_for_timeout(5000)

        # Check for errors in error slot or console
        alerts = page.locator("#panel-generate .alert")
        print(f"Alert elements count: {alerts.count()}")
        for i in range(alerts.count()):
            print(f"  Alert {i}: '{alerts.nth(i).text_content()}'")

        # Check results column
        res_col = page.locator("#panel-generate .results-col")
        print("Results col text preview:")
        print(res_col.text_content()[:300] if res_col.count() > 0 else "None")

        page.screenshot(path="docs/screens/debug_reproduce.png")
        print("Saved debug screenshot to docs/screens/debug_reproduce.png")

        print(f"\nPage errors ({len(page_errors)}):")
        for err in page_errors:
            print("  ", err)

        print(f"\nConsole logs ({len(console_logs)}):")
        for log in console_logs:
            print("  ", log)

        browser.close()

if __name__ == "__main__":
    test_production()
