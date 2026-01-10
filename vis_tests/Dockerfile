FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Python runtime with built frontend
FROM python:3.11-slim

WORKDIR /app

# Install Node.js for serving the frontend
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy Python requirements (create if needed)
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Install common Python packages for graph visualization
RUN pip install --no-cache-dir \
    graphistry \
    pandas \
    networkx \
    numpy

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./dist

# Copy all source files
COPY . .

# Expose port for Vite preview server
EXPOSE 4173

# Install serve globally for production serving
RUN npm install -g serve

# Default command to serve the built frontend
CMD ["serve", "-s", "dist", "-l", "4173"]