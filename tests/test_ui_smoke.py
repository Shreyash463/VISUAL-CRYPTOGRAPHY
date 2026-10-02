"""Smoke tests for Phase 2 web UI, HTML structure, security headers, and static assets."""
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
    """(1) GET / returns 200 and contains header, logo-slot, tabs, panels, and exact footer."""
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


def test_security_headers(client):
    """(2) GET / has Content-Security-Policy from 2.4 and X-Content-Type-Options nosniff."""
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
    """(3) Every static file referenced from index.html + team.json returns 200."""
    resp = client.get("/")
    html = resp.get_data(as_text=True)

    # Collect static links from HTML
    urls = re.findall(r'(?:href|src)=["\'](/static/[^"\']+)["\']', html)
    urls.append("/static/team.json")

    # Also test all modular JS files imported by main.js
    urls.extend([
      "/static/js/api.js",
      "/static/js/ui.js",
      "/static/js/generate.js",
      "/static/js/reconstruct.js",
      "/static/js/compare.js",
      "/static/js/stacking.js",
      "/static/js/about.js",
    ])

    for url in set(urls):
        res = client.get(url)
        assert res.status_code == 200, f"Failed to fetch static asset: {url}"


def test_no_external_resources():
    """(4) No external resources in index.html, no url(http or @import in CSS."""
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


def test_team_json(client):
    """(6) GET /static/team.json is valid JSON with team_name and 4 members."""
    resp = client.get("/static/team.json")
    assert resp.status_code == 200
    data = json.loads(resp.get_data(as_text=True))

    assert "team_name" in data
    assert "members" in data
    assert isinstance(data["members"], list)
    assert len(data["members"]) == 4


def test_no_harness_route(client):
    """(7) The harness route and templates/harness.html no longer exist."""
    root = Path(__file__).parent.parent
    assert not (root / "templates" / "harness.html").exists()

    resp = client.get("/harness")
    assert resp.status_code == 404
