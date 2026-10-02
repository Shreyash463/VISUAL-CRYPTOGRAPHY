"""Flask application factory and API endpoints for Visual Cryptography engine."""
import logging
from flask import Flask, request, jsonify, render_template
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from vc.config import MAX_CONTENT_LENGTH, ERROR_MESSAGES
from vc.errors import VCError
from vc import service

logger = logging.getLogger("vc")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__, template_folder="templates")
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    @app.after_request
    def set_security_headers(response):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; "
            "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
        )
        return response

    @app.errorhandler(VCError)
    def handle_vc_error(error: VCError):
        logger.info(f"VCError code={error.code} status={error.http_status}")
        return jsonify(error.to_dict()), error.http_status

    @app.errorhandler(413)
    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(error):
        logger.info("RequestEntityTooLarge code=FILE_TOO_LARGE status=413")
        return jsonify({
            "ok": False,
            "error": {
                "code": "FILE_TOO_LARGE",
                "message": ERROR_MESSAGES["FILE_TOO_LARGE"],
            },
        }), 413

    @app.errorhandler(404)
    def handle_not_found(error):
        if request.path.startswith("/api"):
            return jsonify({
                "ok": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": ERROR_MESSAGES["NOT_FOUND"],
                },
            }), 404
        return "Not Found", 404

    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        if request.path.startswith("/api"):
            return jsonify({
                "ok": False,
                "error": {
                    "code": "METHOD_NOT_ALLOWED",
                    "message": ERROR_MESSAGES["METHOD_NOT_ALLOWED"],
                },
            }), 405
        return "Method Not Allowed", 405

    @app.errorhandler(Exception)
    def handle_unhandled_exception(error):
        if isinstance(error, VCError):
            return jsonify(error.to_dict()), error.http_status
        if isinstance(error, HTTPException):
            if request.path.startswith("/api"):
                return jsonify({
                    "ok": False,
                    "error": {
                        "code": "INTERNAL" if error.code == 500 else str(error.code),
                        "message": error.description if error.code != 500 else ERROR_MESSAGES["INTERNAL"],
                    },
                }), error.code
            return error

        logger.error("Unhandled error code=INTERNAL")
        return jsonify({
            "ok": False,
            "error": {
                "code": "INTERNAL",
                "message": ERROR_MESSAGES["INTERNAL"],
            },
        }), 500

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.route("/api/health", methods=["GET"])
    def api_health():
        return jsonify({"ok": True, "status": "ok"})

    @app.route("/api/generate", methods=["POST"])
    def api_generate():
        if "file" not in request.files:
            raise VCError("NO_FILE", ERROR_MESSAGES["NO_FILE"], 400)

        file = request.files["file"]
        if not file or not file.filename:
            raise VCError("NO_FILE", ERROR_MESSAGES["NO_FILE"], 400)

        file_bytes = file.read()
        mode = request.form.get("mode", "overlay")
        n = request.form.get("n", 2)
        preprocess = request.form.get("preprocess", "halftone")
        threshold = request.form.get("threshold", 128)

        res = service.generate(
            file_bytes=file_bytes,
            filename=file.filename,
            mode=mode,
            n=n,
            preprocess=preprocess,
            threshold=threshold,
        )
        logger.info(
            f"Generate success mode={res['mode']} n={res['n']} "
            f"processing_ms={res['metrics']['processing_ms']} "
            f"total_ms={res['metrics']['total_ms']}"
        )
        return jsonify(res)

    @app.route("/api/reconstruct", methods=["POST"])
    def api_reconstruct():
        shares_files = request.files.getlist("shares")
        if not shares_files:
            raise VCError("NO_SHARES", ERROR_MESSAGES["NO_SHARES"], 400)

        # Collect share tuples
        shares_data = [
            (f.filename or "", f.read())
            for f in shares_files
            if f and f.filename
        ]
        if not shares_data:
            raise VCError("NO_SHARES", ERROR_MESSAGES["NO_SHARES"], 400)

        mode = request.form.get("mode", "overlay")
        n_total = request.form.get("n_total", 2)

        res = service.reconstruct(
            share_files=shares_data,
            mode=mode,
            n_total=n_total,
        )
        logger.info(
            f"Reconstruct success mode={res['mode']} "
            f"supplied={res['supplied']} required={res['required']} "
            f"sufficient={res['sufficient']}"
        )
        return jsonify(res)

    @app.route("/api/compare", methods=["POST"])
    def api_compare():
        if "file" not in request.files:
            raise VCError("NO_FILE", ERROR_MESSAGES["NO_FILE"], 400)

        file = request.files["file"]
        if not file or not file.filename:
            raise VCError("NO_FILE", ERROR_MESSAGES["NO_FILE"], 400)

        file_bytes = file.read()
        preprocess = request.form.get("preprocess", "halftone")
        threshold = request.form.get("threshold", 128)

        res = service.compare(
            file_bytes=file_bytes,
            filename=file.filename,
            preprocess=preprocess,
            threshold=threshold,
        )
        logger.info("Compare success")
        return jsonify(res)

    return app


app = create_app()

# Normalize serverless / reverse-proxy PATH_INFO prefix
_original_wsgi = app.wsgi_app


def _vercel_wsgi_app(environ, start_response):
    path = environ.get("PATH_INFO", "")
    for prefix in ("/app.py", "/app", "/index.py", "/index"):
        if path == prefix:
            environ["PATH_INFO"] = "/"
            break
        elif path.startswith(f"{prefix}/"):
            environ["PATH_INFO"] = path[len(prefix) :]
            break
    return _original_wsgi(environ, start_response)


app.wsgi_app = _vercel_wsgi_app

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
