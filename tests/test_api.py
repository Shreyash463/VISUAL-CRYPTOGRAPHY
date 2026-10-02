"""Tests for API endpoints, workflows, header verification, and image formats."""
import io
import base64
import pytest
import numpy as np
from PIL import Image

from app import create_app
from vc.imageio import png_bytes_to_bits, bits_to_png_bytes
from tests.patterns import generate_checkerboard


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def make_test_image(format_name: str, mode: str = "RGB", size: tuple = (64, 64)) -> bytes:
    if mode == "RGBA":
        img = Image.new("RGBA", size, (255, 0, 0, 128))
    elif mode == "RGB":
        img = Image.new("RGB", size, (100, 150, 200))
    else:
        img = Image.new("L", size, 128)

    buf = io.BytesIO()
    img.save(buf, format=format_name)
    return buf.getvalue()


def test_api_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.headers.get("Cache-Control") == "no-store"
    assert resp.get_json() == {"ok": True, "status": "ok"}


def test_generate_and_reconstruct_reproducibility(client):
    """(1) generate then reconstruct using returned shares reproduces server's reconstruction."""
    img_bytes = make_test_image("PNG")

    for mode, n in [("overlay", 2), ("xor", 3)]:
        gen_resp = client.post(
            "/api/generate",
            data={
                "file": (io.BytesIO(img_bytes), "test.png"),
                "mode": mode,
                "n": n,
            },
            content_type="multipart/form-data",
        )
        assert gen_resp.status_code == 200
        assert gen_resp.headers.get("Cache-Control") == "no-store"
        gen_data = gen_resp.get_json()
        assert gen_data["ok"] is True

        shares = gen_data["shares"]
        shares_files = [
            (io.BytesIO(base64.b64decode(s["png_b64"])), f"share_{s['index']}.png")
            for s in shares
        ]

        rec_resp = client.post(
            "/api/reconstruct",
            data={
                "shares": shares_files,
                "mode": mode,
                "n_total": n,
            },
            content_type="multipart/form-data",
        )
        assert rec_resp.status_code == 200
        rec_data = rec_resp.get_json()
        assert rec_data["ok"] is True
        assert rec_data["sufficient"] is True
        assert rec_data["reconstruction_png_b64"] == gen_data["reconstruction_png_b64"]


def test_overlay_reconstruct_single_share(client):
    """(2) overlay reconstruct with only share 1 -> sufficient false, returned image equals share 1."""
    img_bytes = make_test_image("PNG")
    gen_resp = client.post(
        "/api/generate",
        data={"file": (io.BytesIO(img_bytes), "test.png"), "mode": "overlay", "n": 2},
        content_type="multipart/form-data",
    )
    gen_data = gen_resp.get_json()
    share1_b64 = gen_data["shares"][0]["png_b64"]

    rec_resp = client.post(
        "/api/reconstruct",
        data={
            "shares": [(io.BytesIO(base64.b64decode(share1_b64)), "share_1.png")],
            "mode": "overlay",
            "n_total": 2,
        },
        content_type="multipart/form-data",
    )
    rec_data = rec_resp.get_json()
    assert rec_data["ok"] is True
    assert rec_data["sufficient"] is False
    assert rec_data["supplied"] == 1
    assert rec_data["required"] == 2
    assert rec_data["reconstruction_png_b64"] == share1_b64


def test_xor_insufficient_shares_leakage(client):
    """(3) xor n=4 with 3 shares -> sufficient false, message matches, diff from secret in 35%-65%."""
    checker = generate_checkerboard()
    checker_bytes = bits_to_png_bytes(checker)

    gen_resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(checker_bytes), "checker.png"),
            "mode": "xor",
            "n": 4,
            "preprocess": "threshold",
            "threshold": 128,
        },
        content_type="multipart/form-data",
    )
    gen_data = gen_resp.get_json()
    shares = gen_data["shares"][:3]  # Supply only 3 of 4 shares

    rec_resp = client.post(
        "/api/reconstruct",
        data={
            "shares": [
                (io.BytesIO(base64.b64decode(s["png_b64"])), f"s_{s['index']}.png")
                for s in shares
            ],
            "mode": "xor",
            "n_total": 4,
        },
        content_type="multipart/form-data",
    )
    rec_data = rec_resp.get_json()
    assert rec_data["ok"] is True
    assert rec_data["sufficient"] is False
    assert rec_data["supplied"] == 3
    assert rec_data["required"] == 4
    assert (
        rec_data["message"]
        == "Fewer than the required shares (3 of 4). No recognisable secret is expected."
    )

    rec_bits = png_bytes_to_bits(base64.b64decode(rec_data["reconstruction_png_b64"]))
    secret_bits = png_bytes_to_bits(base64.b64decode(gen_data["secret_png_b64"]))
    diff_fraction = float(np.mean(rec_bits != secret_bits))
    assert 0.35 <= diff_fraction <= 0.65, (
        f"Diff fraction {diff_fraction} outside [0.35, 0.65]"
    )


def test_compare_endpoint(client):
    """(4) /api/compare returns both blocks and expansion 4.0 vs 1.0."""
    img_bytes = make_test_image("PNG")
    resp = client.post(
        "/api/compare",
        data={"file": (io.BytesIO(img_bytes), "test.png")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ok"] is True
    assert "overlay" in data
    assert "xor" in data
    assert data["overlay"]["metrics"]["pixel_expansion"] == 4.0
    assert data["xor"]["metrics"]["pixel_expansion"] == 1.0


def test_cache_control_headers(client):
    """(5) every /api response has Cache-Control: no-store."""
    endpoints = [
        ("GET", "/api/health", None),
        ("POST", "/api/generate", {}),
        ("POST", "/api/reconstruct", {}),
        ("POST", "/api/compare", {}),
        ("GET", "/api/nonexistent", None),
    ]
    for method, path, data in endpoints:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, data=data or {})
        assert resp.headers.get("Cache-Control") == "no-store", f"Failed for {method} {path}"
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"


def test_image_formats_support(client):
    """(6) JPEG, BMP and PNG uploads all work; RGBA PNG with transparency works."""
    formats = [
        ("JPEG", "RGB", "test.jpg"),
        ("JPEG", "RGB", "test.jpeg"),
        ("BMP", "RGB", "test.bmp"),
        ("PNG", "RGB", "test.png"),
        ("PNG", "RGBA", "test_alpha.png"),
    ]
    for fmt, mode, filename in formats:
        img_bytes = make_test_image(fmt, mode=mode)
        resp = client.post(
            "/api/generate",
            data={"file": (io.BytesIO(img_bytes), filename), "mode": "overlay", "n": 2},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 200, f"Failed for format {fmt} filename {filename}"
        data = resp.get_json()
        assert data["ok"] is True
        assert data["metrics"]["reconstruction_check"]["passed"] is True
