"""Tests verifying NFR-3 privacy and statelessness (no files written to disk or temp)."""
import io
import base64
import tempfile
from pathlib import Path
from app import create_app
from tests.patterns import generate_checkerboard
from vc.imageio import bits_to_png_bytes


def test_stateless_privacy(tmp_path, monkeypatch):
    """Set tempfile.tempdir to tmp_path, run generate+reconstruct+compare, assert no files created."""
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))

    project_root = Path(__file__).parent.parent

    def get_listing():
        items = []
        for p in project_root.rglob("*"):
            rel = p.relative_to(project_root)
            parts = rel.parts
            if any(part in (".pytest_cache", "__pycache__") or part.endswith(".pyc") for part in parts):
                continue
            items.append(str(rel))
        return set(items)

    before_listing = get_listing()

    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    checker_bytes = bits_to_png_bytes(generate_checkerboard())

    # 1. POST /api/generate
    gen_resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(checker_bytes), "checker.png"),
            "mode": "overlay",
            "n": 2,
        },
        content_type="multipart/form-data",
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.get_json()

    # 2. POST /api/reconstruct
    shares = gen_data["shares"]
    rec_resp = client.post(
        "/api/reconstruct",
        data={
            "shares": [
                (io.BytesIO(base64.b64decode(s["png_b64"])), f"share_{s['index']}.png")
                for s in shares
            ],
            "mode": "overlay",
            "n_total": 2,
        },
        content_type="multipart/form-data",
    )
    assert rec_resp.status_code == 200

    # 3. POST /api/compare
    comp_resp = client.post(
        "/api/compare",
        data={"file": (io.BytesIO(checker_bytes), "checker.png")},
        content_type="multipart/form-data",
    )
    assert comp_resp.status_code == 200

    # Assert tmp_path is completely empty
    tmp_files = list(tmp_path.iterdir())
    assert len(tmp_files) == 0, f"Expected empty tempdir, found: {tmp_files}"

    # Assert project listing is unchanged
    after_listing = get_listing()
    assert after_listing == before_listing, (
        f"Project directory listing modified: diff={after_listing ^ before_listing}"
    )
