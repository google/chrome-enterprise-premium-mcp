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
