#!/bin/bash
set -e 
set -x

BUILD_ROOT="${KOKORO_ARTIFACTS_DIR}/github/chrome-enterprise-premium-mcp"
cd "${BUILD_ROOT}"

echo "Installing dependencies..."
npm ci

echo "Running presubmit checks..."
npm run presubmit

echo "Build completed successfully."
