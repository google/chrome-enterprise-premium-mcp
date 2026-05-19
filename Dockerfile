# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Use the official Node.js 22-slim image for a smaller security footprint.
FROM node:22-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# Copying this first prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies.
RUN npm install --omit=dev

# Copy local code to the container image.
COPY . .

# Expose the port that the server will listen on.
# Default to 8080 as per Cloud Run conventions.
ENV PORT=8080
EXPOSE 8080

# Run the MCP server on container startup.
CMD [ "node", "mcp-server.js" ]
