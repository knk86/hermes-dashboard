#!/bin/bash
# Test the chat endpoint
curl -s -X POST http://localhost:8080/api/agents/1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Say hello in one sentence."}'