#!/bin/bash
set -e 
set -x

BUILD_ROOT="${KOKORO_ARTIFACTS_DIR}/github/chrome-enterprise-premium-mcp"
cd "${BUILD_ROOT}"

echo "Installing dependencies..."
npm ci

echo "Running presubmit checks..."
npm run presubmit

# Run the release pipeline for post-merge (continuous) jobs
if [ "${JOB_TYPE}" = "continuous" ]; then
  echo "Running release pipeline..."

  # TODO(feel): Replace "github-bot-token" with your actual Keystore Key Name
  TOKEN_PATH="${KOKORO_KEYSTORE_DIR}/github-bot-token"
  if [ -f "${TOKEN_PATH}" ]; then
    GITHUB_TOKEN=$(cat "${TOKEN_PATH}")
    
    # Run the release-please CLI tool to create or update the Release PR
    npx release-please manifest-pr \
      --token="${GITHUB_TOKEN}" \
      --repo-url="google/chrome-enterprise-premium-mcp"

    # Run the release-please CLI tool to tag and release when the PR is merged
    npx release-please manifest-release \
      --token="${GITHUB_TOKEN}" \
      --repo-url="google/chrome-enterprise-premium-mcp"
  else
    echo "Error: GitHub token not found in Keystore directory."
    exit 1
  fi
fi

echo "Build completed successfully."
