"""Tests verifying all validation errors, status codes, and error codes in Section 7."""
import io
from unittest.mock import patch
import pytest
from PIL import Image
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def make_png_bytes(width: int, height: int, fill: int = 0) -> bytes:
    img = Image.new("L", (width, height), fill)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_no_file(client):
    # No file field
    resp = client.post("/api/generate", data={})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "NO_FILE"


def test_bad_extension(client):
    # Wrong extension (.txt)
    resp = client.post(
        "/api/generate",
        data={"file": (io.BytesIO(b"dummy text content"), "secret.txt")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "BAD_EXTENSION"


def test_file_too_large(client):
    # 6 MB file
    large_data = b"X" * (6 * 1024 * 1024)
    resp = client.post(
        "/api/generate",
        data={"file": (io.BytesIO(large_data), "large.png")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 413
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "FILE_TOO_LARGE"


def test_not_an_image(client):
    # Text file renamed .png
    resp = client.post(
        "/api/generate",
        data={"file": (io.BytesIO(b"This is not a PNG file"), "fake.png")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 415
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "NOT_AN_IMAGE"


def test_image_too_small(client):
    # 8x8 image
    png_bytes = make_png_bytes(8, 8)
    resp = client.post(
        "/api/generate",
        data={"file": (io.BytesIO(png_bytes), "tiny.png")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "IMAGE_TOO_SMALL"


def test_bad_mode(client):
    png_bytes = make_png_bytes(32, 32)
    resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(png_bytes), "valid.png"),
            "mode": "rot13",
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "BAD_MODE"


def test_bad_n_overlay(client):
    png_bytes = make_png_bytes(32, 32)
    resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(png_bytes), "valid.png"),
            "mode": "overlay",
            "n": 3,
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "BAD_N"


def test_bad_n_xor(client):
    png_bytes = make_png_bytes(32, 32)
    resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(png_bytes), "valid.png"),
            "mode": "xor",
            "n": 7,
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "BAD_N"


def test_bad_preprocess(client):
    png_bytes = make_png_bytes(32, 32)
    resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(png_bytes), "valid.png"),
            "preprocess": "blur",
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "BAD_PREPROCESS"


def test_bad_threshold(client):
    png_bytes = make_png_bytes(32, 32)
    resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(png_bytes), "valid.png"),
            "preprocess": "threshold",
            "threshold": 300,
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "BAD_THRESHOLD"


def test_no_shares(client):
    resp = client.post(
        "/api/reconstruct",
        data={"mode": "overlay", "n_total": 2},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "NO_SHARES"


def test_too_many_shares(client):
    # 3 shares for overlay (requires n_total=2)
    sh = make_png_bytes(32, 32)
    resp = client.post(
        "/api/reconstruct",
        data={
            "shares": [
                (io.BytesIO(sh), "s1.png"),
                (io.BytesIO(sh), "s2.png"),
                (io.BytesIO(sh), "s3.png"),
            ],
            "mode": "overlay",
            "n_total": 2,
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "TOO_MANY_SHARES"


def test_share_size_mismatch(client):
    # Shares with different dimensions
    sh1 = make_png_bytes(32, 32)
    sh2 = make_png_bytes(64, 64)
    resp = client.post(
        "/api/reconstruct",
        data={
            "shares": [
                (io.BytesIO(sh1), "s1.png"),
                (io.BytesIO(sh2), "s2.png"),
            ],
            "mode": "overlay",
            "n_total": 2,
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "SHARE_SIZE_MISMATCH"


def test_share_odd_size(client):
    # Overlay shares with odd dimensions (33x33)
    sh = make_png_bytes(33, 33)
    resp = client.post(
        "/api/reconstruct",
        data={
            "shares": [
                (io.BytesIO(sh), "s1.png"),
                (io.BytesIO(sh), "s2.png"),
            ],
            "mode": "overlay",
            "n_total": 2,
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "SHARE_ODD_SIZE"


def test_share_not_binary(client):
    # Grayscale share containing 128
    sh = make_png_bytes(32, 32, fill=128)
    resp = client.post(
        "/api/reconstruct",
        data={
            "shares": [
                (io.BytesIO(sh), "s1.png"),
                (io.BytesIO(sh), "s2.png"),
            ],
            "mode": "overlay",
            "n_total": 2,
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "SHARE_NOT_BINARY"


def test_not_found_endpoint(client):
    resp = client.get("/api/unknown_route")
    assert resp.status_code == 404
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "NOT_FOUND"


def test_method_not_allowed(client):
    resp = client.get("/api/generate")
    assert resp.status_code == 405
    data = resp.get_json()
    assert data["ok"] is False
    assert data["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_internal_error_handling(client):
    png_bytes = make_png_bytes(32, 32)
    with patch("vc.service.generate", side_effect=RuntimeError("Unexpected crash")):
        resp = client.post(
            "/api/generate",
            data={"file": (io.BytesIO(png_bytes), "test.png")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 500
        data = resp.get_json()
        assert data["ok"] is False
        assert data["error"]["code"] == "INTERNAL"
        assert "Unexpected crash" not in str(data)  # Never leak stack trace
