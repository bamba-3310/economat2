import os
import re


KNOWN_SLUGS = ("lecarre", "bahiafc")


def slug_from_host(host: str | None) -> str | None:
    """Extract restaurant slug from Host (lecarre.kovo-app.net → lecarre)."""
    if not host:
        return None
    host = host.split(":")[0].strip().lower()
    if not host or host in ("localhost", "127.0.0.1"):
        return None
    # First label of a multi-part host
    parts = host.split(".")
    if len(parts) >= 2 and parts[0] in KNOWN_SLUGS:
        return parts[0]
    return None


def resolve_restaurant_slug(request) -> str | None:
    """
    Priority:
    1. X-Restaurant-Slug header (Next.js adapter / explicit clients)
    2. Host subdomain
    3. DEFAULT_RESTAURANT_SLUG env (local dev without subdomains)
    """
    header = request.headers.get("X-Restaurant-Slug") or request.META.get(
        "HTTP_X_RESTAURANT_SLUG"
    )
    if header:
        slug = header.strip().lower()
        if re.fullmatch(r"[a-z0-9-]+", slug):
            return slug

    from_host = slug_from_host(request.get_host())
    if from_host:
        return from_host

    default = os.getenv("DEFAULT_RESTAURANT_SLUG", "lecarre").strip().lower()
    return default or None
