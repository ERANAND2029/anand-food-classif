# Python 3.10 slim image
FROM python:3.10-slim

# Install system dependencies needed for OpenCV and Image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Create non-root user required by Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user
RUN chown -R user:user /app
USER user

# Hugging Face Spaces standard port is 7860
EXPOSE 7860

# Run FastAPI via Uvicorn on 0.0.0.0:7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
