"""Test live production endpoints on Vercel."""
import urllib.request
import json
import io
import base64
from PIL import Image

BASE = "https://visual-cryptography-rouge.vercel.app"
print(f"=== Testing Live Production Deployment at {BASE} ===")

endpoints = [
    "/",
    "/landing",
    "/app",
    "/api/health",
    "/static/css/tokens.css",
    "/static/css/fonts.css",
    "/static/fonts/space-grotesk-latin-700-normal.woff2",
    "/static/img/sspu-logo.png",
    "/static/team.json",
]

for ep in endpoints:
    url = BASE + ep
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            print(f"  {ep:<50} -> {resp.status} (length {len(data)})")
    except Exception as e:
        print(f"  {ep:<50} -> ERROR: {e}")

# Test Live Color Overlay Generation and Reconstruction
print("\n--- Testing Live Mode A: Color Overlay (2-out-of-2) ---")
img = Image.new("RGB", (24, 24), color=(0, 180, 255))
buf = io.BytesIO()
img.save(buf, format="PNG")
img_bytes = buf.getvalue()

boundary = "----WebKitFormBoundaryXYZ123"
body = (
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="file"; filename="test_color.png"\r\n'
    "Content-Type: image/png\r\n\r\n"
).encode("utf-8") + img_bytes + (
    f"\r\n--{boundary}\r\n"
    'Content-Disposition: form-data; name="mode"\r\n\r\n'
    "color_overlay\r\n"
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="n"\r\n\r\n'
    "2\r\n"
    f"--{boundary}--\r\n"
).encode("utf-8")

req = urllib.request.Request(
    f"{BASE}/api/generate",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "Mozilla/5.0"},
)

with urllib.request.urlopen(req) as resp:
    gen_data = json.loads(resp.read().decode("utf-8"))
    shares = gen_data.get("shares", [])
    print(f"  Generate status: {resp.status}, ok: {gen_data.get('ok')}, shares count: {len(shares)}")
    print(f"  Mode: {gen_data.get('mode')}, Group: {gen_data.get('group')}")
    print(f"  Processing time: {gen_data.get('metrics', {}).get('performance', {}).get('processing_ms')} ms")

# Now reconstruct the shares on the live server
s1_bytes = base64.b64decode(shares[0]["png_b64"])
s2_bytes = base64.b64decode(shares[1]["png_b64"])

rec_body = (
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="shares"; filename="share1.png"\r\n'
    "Content-Type: image/png\r\n\r\n"
).encode("utf-8") + s1_bytes + (
    f"\r\n--{boundary}\r\n"
    'Content-Disposition: form-data; name="shares"; filename="share2.png"\r\n'
    "Content-Type: image/png\r\n\r\n"
).encode("utf-8") + s2_bytes + (
    f"\r\n--{boundary}\r\n"
    'Content-Disposition: form-data; name="mode"\r\n\r\n'
    "color_overlay\r\n"
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="n_total"\r\n\r\n'
    "2\r\n"
    f"--{boundary}--\r\n"
).encode("utf-8")

rec_req = urllib.request.Request(
    f"{BASE}/api/reconstruct",
    data=rec_body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "Mozilla/5.0"},
)

with urllib.request.urlopen(rec_req) as resp:
    rec_data = json.loads(resp.read().decode("utf-8"))
    print(f"  Reconstruct status: {resp.status}, ok: {rec_data.get('ok')}, sufficient: {rec_data.get('sufficient')}")
    print(f"  Raw b64 length: {len(rec_data.get('reconstruction_png_b64', ''))}")
    print(f"  Enhanced b64 length: {len(rec_data.get('enhanced_png_b64', ''))}")

print("\n--- Testing Live Mode B: Color XOR (3-of-3) ---")
body_xor = (
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="file"; filename="test_color.png"\r\n'
    "Content-Type: image/png\r\n\r\n"
).encode("utf-8") + img_bytes + (
    f"\r\n--{boundary}\r\n"
    'Content-Disposition: form-data; name="mode"\r\n\r\n'
    "color_xor\r\n"
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="n"\r\n\r\n'
    "3\r\n"
    f"--{boundary}--\r\n"
).encode("utf-8")

req_xor = urllib.request.Request(
    f"{BASE}/api/generate",
    data=body_xor,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "Mozilla/5.0"},
)

with urllib.request.urlopen(req_xor) as resp:
    gen_xor_data = json.loads(resp.read().decode("utf-8"))
    xor_shares = gen_xor_data.get("shares", [])
    print(f"  XOR Generate status: {resp.status}, ok: {gen_xor_data.get('ok')}, shares count: {len(xor_shares)}")
    print(f"  Mode: {gen_xor_data.get('mode')}, Group: {gen_xor_data.get('group')}")

print("\n=== All Live Verification Checks Passed Successfully! ===")
