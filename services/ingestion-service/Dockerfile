FROM node:18-alpine

WORKDIR /app

# Install system dependencies for document processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    poppler-utils \
    tesseract-ocr \
    imagemagick

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port for health checks
EXPOSE 3002

# Run the service
CMD ["npm", "start"]
