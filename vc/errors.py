"""Error definitions for Visual Cryptography engine."""


class VCError(Exception):
    """Domain exception carrying error code, friendly message, and HTTP status."""

    def __init__(self, code: str, message: str, http_status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status

    def to_dict(self) -> dict:
        return {
            "ok": False,
            "error": {
                "code": self.code,
                "message": self.message,
            },
        }
