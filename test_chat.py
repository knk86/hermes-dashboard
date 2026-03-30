#!/usr/bin/env python3
import urllib.request, json, sys

data = json.dumps({"message": "Say hello in one sentence."}).encode()
req = urllib.request.Request(
    "http://localhost:8080/api/agents/1/chat",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        print("Status:", r.status)
        print("Response:", body[:1000])
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode()[:500])
except Exception as e:
    print("Error:", type(e).__name__, str(e))
