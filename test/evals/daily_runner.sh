#!/bin/bash
# Exit on error
set -e

# Change directory to the workspace root
cd /usr/local/google/home/tushardey/chrome-enterprise-premium-mcp

# Source user's shell profile to import GEMINI_API_KEY
if [ -f "$HOME/.bashrc" ]; then
  source "$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
  source "$HOME/.bash_profile"
elif [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc"
fi

# Also load from App Data .env file if present
if [ -f "/usr/local/google/home/tushardey/.gemini/jetski/.env" ]; then
  export $(grep -v '^#' /usr/local/google/home/tushardey/.gemini/jetski/.env | xargs)
fi

# 1. Run evaluations and write JSON output
TIMESTAMP=$(date +%s)
VERSION=$(node --input-type=module -e "import fs from 'fs'; console.log(JSON.parse(fs.readFileSync('package.json', 'utf8')).version);")
npm run eval -- --output "test/evals/runs/run-${VERSION}-${TIMESTAMP}000.json"

# 2. Run reporter
node test/evals/reporter.js
