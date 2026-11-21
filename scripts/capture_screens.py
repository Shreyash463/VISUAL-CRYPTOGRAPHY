"""Capture screenshots of the VeilShare UI using system Chrome."""
import threading
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server
from app import create_app

class ServerThread(threading.Thread):
    def __init__(self, app, port=5055):
        super().__init__()
        self.server = make_server("127.0.0.1", port, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()

def capture():
    app = create_app()
    server = ServerThread(app, port=5055)
    server.start()
    time.sleep(1)

    out_dir = Path("docs/screens")
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})

            # 1. Landing Hero
            page.goto("http://127.0.0.1:5055/landing")
            page.wait_for_timeout(1000)
            page.screenshot(path=str(out_dir / "01_landing_hero.png"), full_page=False)
            print("Captured: 01_landing_hero.png")

            # 2. Landing How it works & simulator
            slider = page.locator("#hero-slider")
            if slider.count() > 0:
                slider.fill("75")
                page.wait_for_timeout(500)
            page.screenshot(path=str(out_dir / "02_landing_revealed.png"), full_page=False)
            print("Captured: 02_landing_revealed.png")

            # 3. Studio Generate Tab
            page.goto("http://127.0.0.1:5055/app")
            page.wait_for_timeout(1000)
            page.screenshot(path=str(out_dir / "03_studio_generate.png"), full_page=False)
            print("Captured: 03_studio_generate.png")

            # 4. Trigger Demo Mode
            demo_btn = page.locator("#btn-demo-mode")
            if demo_btn.count() > 0:
                demo_btn.click()
                page.wait_for_timeout(2500)
                page.screenshot(path=str(out_dir / "04_studio_demo_result.png"), full_page=False)
                print("Captured: 04_studio_demo_result.png")

            # 5. Reconstruct Tab
            tab_rec = page.locator("#tab-reconstruct")
            if tab_rec.count() > 0:
                tab_rec.click()
                page.wait_for_timeout(800)
                page.screenshot(path=str(out_dir / "05_studio_reconstruct.png"), full_page=False)
                print("Captured: 05_studio_reconstruct.png")

            # 6. Compare Tab
            tab_comp = page.locator("#tab-compare")
            if tab_comp.count() > 0:
                tab_comp.click()
                page.wait_for_timeout(800)
                page.screenshot(path=str(out_dir / "06_studio_compare.png"), full_page=False)
                print("Captured: 06_studio_compare.png")

            # 7. About Tab
            tab_about = page.locator("#tab-about")
            if tab_about.count() > 0:
                tab_about.click()
                page.wait_for_timeout(800)
                page.screenshot(path=str(out_dir / "07_studio_about.png"), full_page=False)
                print("Captured: 07_studio_about.png")

            browser.close()
    finally:
        server.shutdown()
        server.join()
        print("Server shutdown cleanly.")

if __name__ == "__main__":
    capture()
