"""Smoke tests for Phase 2 & 3 web UI, HTML structure, security headers, and static assets."""
import re
import json
from pathlib import Path
import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_index_structure(client):
    """(1) GET / returns 200 and contains header, logo-slot, tabs, panels, exact footer, and subtitle."""
    resp = client.get("/")
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)

    assert 'header id="site-header"' in html or 'id="site-header"' in html
    assert 'id="logo-slot"' in html

    # Four tabs
    assert 'id="tab-generate"' in html
    assert 'id="tab-reconstruct"' in html
    assert 'id="tab-compare"' in html
    assert 'id="tab-about"' in html

    # Four panels
    assert 'id="panel-generate"' in html
    assert 'id="panel-reconstruct"' in html
    assert 'id="panel-compare"' in html
    assert 'id="panel-about"' in html

    # Exact footer text
    expected_footer = "Visual Cryptography | Progress Review II | SSPU | 10 October 2026"
    assert expected_footer in html

    # Exact subtitle text (allowing HTML entity &amp;)
    assert "Progress Review II · Design &amp; Implementation Review" in html or "Progress Review II · Design & Implementation Review" in html


def test_phase3_index_elements(client):
    """(2) GET / contains Phase 3 elements: theme toggle, toast region, inspector dialog, sub-tabs, and symbols."""
    resp = client.get("/")
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)

    assert 'id="theme-toggle"' in html
    assert 'id="toast-region"' in html
    assert 'id="inspector-dialog"' in html

    # Sub-tab ids
    assert 'id="rtab-overview"' in html
    assert 'id="rtab-shares"' in html
    assert 'id="rtab-metrics"' in html
    assert 'id="rtab-stack"' in html

    # Sub-panel ids
    assert 'id="rpanel-overview"' in html
    assert 'id="rpanel-shares"' in html
    assert 'id="rpanel-metrics"' in html
    assert 'id="rpanel-stack"' in html

    # Sprite symbols
    symbols = [
        "i-upload", "i-download", "i-zoom", "i-check", "i-x",
        "i-alert", "i-info", "i-sun", "i-moon", "i-trash"
    ]
    for sym in symbols:
        assert f'id="{sym}"' in html, f"Missing symbol {sym} in index.html"


def test_security_headers(client):
    """(3) GET / has Content-Security-Policy from Phase 2 and X-Content-Type-Options nosniff."""
    resp = client.get("/")
    assert resp.status_code == 200

    csp = resp.headers.get("Content-Security-Policy", "")
    expected_csp = (
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; "
        "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    )
    assert csp == expected_csp
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"


def test_static_assets_status(client):
    """(4) Every static file referenced from index.html returns 200 (css, js modules, favicon)."""
    resp = client.get("/")
    html = resp.get_data(as_text=True)

    urls = re.findall(r'(?:href|src)=["\'](/static/[^"\']+)["\']', html)
    urls.append("/static/team.json")
    urls.append("/static/img/favicon.svg")

    # Modular JS files
    urls.extend([
        "/static/js/main.js",
        "/static/js/api.js",
        "/static/js/ui.js",
        "/static/js/generate.js",
        "/static/js/reconstruct.js",
        "/static/js/compare.js",
        "/static/js/stacking.js",
        "/static/js/about.js",
        "/static/js/state.js",
        "/static/js/theme.js",
        "/static/js/toast.js",
        "/static/js/download.js",
        "/static/js/viewer.js",
        "/static/js/metrics.js",
    ])

    # CSS files
    urls.extend([
        "/static/css/tokens.css",
        "/static/css/base.css",
        "/static/css/layout.css",
        "/static/css/components.css",
    ])

    for url in set(urls):
        res = client.get(url)
        assert res.status_code == 200, f"Failed to fetch static asset: {url}"


def test_no_external_resources():
    """(5) No external resources in index.html, no url(http or @import in CSS."""
    root = Path(__file__).parent.parent
    index_html = (root / "templates" / "index.html").read_text(encoding="utf-8")

    assert not re.search(r'<script[^>]+src=["\']http', index_html, re.I)
    assert not re.search(r'<link[^>]+href=["\']http', index_html, re.I)

    for css_file in (root / "static" / "css").glob("*.css"):
        css_text = css_file.read_text(encoding="utf-8")
        assert "@import" not in css_text, f"@import found in {css_file.name}"
        assert "url(http" not in css_text.lower(), f"External url(http found in {css_file.name}"


def test_no_inline_scripts_or_styles():
    """(5) No inline script, no <style>, no style=, no on...= in index.html."""
    root = Path(__file__).parent.parent
    html = (root / "templates" / "index.html").read_text(encoding="utf-8")

    # No <style> tags
    assert "<style" not in html.lower()

    # No style="" attributes
    assert not re.search(r'\sstyle\s*=', html, re.I)

    # No inline event handlers like onclick, onload, etc.
    assert not re.search(r'\son\w+\s*=', html, re.I)

    # No inline scripts (script tags without src)
    script_tags = re.findall(r'<script\b([^>]*)>(.*?)</script>', html, re.DOTALL | re.I)
    for attrs, body in script_tags:
        assert "src=" in attrs, f"Inline script found: {body.strip()}"
        assert body.strip() == "", f"Inline script body found: {body.strip()}"


def test_forbidden_js_patterns():
    """(6) Scan every file under static/js for forbidden patterns."""
    root = Path(__file__).parent.parent
    forbidden = [
        "innerHTML", "outerHTML", "insertAdjacentHTML", "eval(", "new Function",
        "document.write", "Math.random", 'setAttribute("style"', "setAttribute('style'", "cssText"
    ]
    js_files = list((root / "static" / "js").glob("*.js"))
    assert len(js_files) > 0

    for jf in js_files:
        text = jf.read_text(encoding="utf-8")
        for pat in forbidden:
            assert pat not in text, f"Forbidden pattern '{pat}' found in {jf.name}"


def test_download_js_patterns():
    """(7) Scan static/js/download.js for the filename patterns and required strings."""
    root = Path(__file__).parent.parent
    download_js = (root / "static" / "js" / "download.js").read_text(encoding="utf-8")

    # Required filename patterns
    patterns = ["share_", "reconstruction_", "_viewing_"]
    for pat in patterns:
        assert pat in download_js, f"Pattern '{pat}' not found in static/js/download.js"

    # Required strings
    required_strings = [
        "Download stacked PNG (exact, 2× size)",
        "Download viewing copy (original size)",
        "Download reconstruction PNG (exact)",
    ]
    for req in required_strings:
        assert req in download_js, f"Required string '{req}' not found in static/js/download.js"


def test_team_json(client):
    """GET /static/team.json is valid JSON with team_name and 4 members."""
    resp = client.get("/static/team.json")
    assert resp.status_code == 200
    data = json.loads(resp.get_data(as_text=True))

    assert "team_name" in data
    assert "members" in data
    assert isinstance(data["members"], list)
    assert len(data["members"]) == 4


def test_no_harness_route(client):
    """The harness route and templates/harness.html no longer exist."""
    root = Path(__file__).parent.parent
    assert not (root / "templates" / "harness.html").exists()

    resp = client.get("/harness")
    assert resp.status_code == 404
