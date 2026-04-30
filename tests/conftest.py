# tests/conftest.py
# Shared pytest configuration for all Mosupisi tests

import pytest
import requests

# ---------------------------------------------------------------------------
# Service availability fixtures
# ---------------------------------------------------------------------------

SERVICES = {
    "profile":      "http://localhost:8003/health",
    "notification": "http://localhost:8004/health",
    "weather":      "http://localhost:8002/health",
    "pest":         "http://localhost:8001/health",
    "planting":     "http://localhost:3001/health",
    "llm":          "http://localhost:3004/health",
    "chat_python":  "http://localhost:3003/health",
    "chat_node":    "http://localhost:3002/api/health",
}


def is_service_up(url: str) -> bool:
    try:
        r = requests.get(url, timeout=5)
        return r.status_code == 200
    except Exception:
        return False


@pytest.fixture(scope="session", autouse=True)
def check_services_on_start():
    """Print service availability at the start of the test session."""
    print("\n" + "=" * 60)
    print("  MOSUPISI TEST SUITE — Service Status")
    print("=" * 60)
    unavailable = []
    for name, url in SERVICES.items():
        up = is_service_up(url)
        status = "✓ UP" if up else "✗ DOWN"
        print(f"  {name:<16} {status}  ({url})")
        if not up:
            unavailable.append(name)
    print("=" * 60)
    if unavailable:
        print(f"\n  WARNING: {len(unavailable)} service(s) not running: {', '.join(unavailable)}")
        print("  Tests requiring these services will be skipped.\n")
    else:
        print("\n  All services up — full test suite will run.\n")


# ---------------------------------------------------------------------------
# Skip markers for services that might not be running
# ---------------------------------------------------------------------------

def pytest_collection_modifyitems(config, items):
    """Auto-skip integration/functional tests if required services are down."""
    for item in items:
        # Skip tests in integration/ or functional/ if services are down
        if "integration" in str(item.fspath) or "functional" in str(item.fspath):
            if not is_service_up("http://localhost:8002/health"):
                item.add_marker(
                    pytest.mark.skip(reason="Weather service not running")
                )