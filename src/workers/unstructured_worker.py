"""Enhanced Unstructured Worker with pgvector integration
Processes documents using unstructured.io and stores embeddings in PostgreSQL with pgvector
"""

import json
import os
import time
import logging
import uuid
import psutil
import pika
import psycopg2
from datetime import datetime
from typing import Dict, Any, List
from supabase import create_client, Client
import openai
from unstructured.partition.auto import partition
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import threading
from flask import Flask, jsonify, request
import requests
from flask_cors import CORS
from prometheus_client import (
    CollectorRegistry,
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    multiprocess,
)
from openai import OpenAI

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
# Local unstructured processing - no API key needed
# UNSTRUCTURED_API_KEY = os.getenv('UNSTRUCTURED_API_KEY')  # Not needed for local processing
# UNSTRUCTURED_API_URL = os.getenv('UNSTRUCTURED_API_URL', 'https://api.unstructured.io')  # Not needed for local processing
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')
WORKER_CONCURRENCY = int(os.getenv('WORKER_CONCURRENCY', '2'))
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
APP_PORT = int(os.getenv("HEALTH_CHECK_PORT", "8080"))

# RabbitMQ Configuration
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672/')
QUEUE_NAME = os.getenv('QUEUE_NAME', 'document_processing')

# PostgreSQL Configuration
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = int(os.getenv('POSTGRES_PORT', '5432'))
POSTGRES_DB = os.getenv('POSTGRES_DB', 'enhanced_ai_os')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'ai_agent_user')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')

# Initialize OpenAI client
if OPENROUTER_API_KEY:
    client = OpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1"
    )
else:
    client = OpenAI(api_key=OPENAI_API_KEY)

app = Flask(__name__)
CORS(app)

# Prometheus metrics
registry = CollectorRegistry()
if os.getenv("PROMETHEUS_MULTIPROC_DIR"):
    multiprocess.MultiProcessCollector(registry)

health_gauge = Gauge("unstructured_worker_health", "Health status (1=ok,0=down)", registry=registry)
cpu_gauge = Gauge("unstructured_worker_cpu_percent", "CPU usage percent", registry=registry)
mem_gauge = Gauge("unstructured_worker_mem_percent", "Memory usage percent", registry=registry)
requests_counter = Counter("unstructured_worker_requests_total", "Total HTTP requests", registry=registry)
processed_docs = Counter('documents_processed_total', 'Total documents processed')
processed_chunks = Counter('chunks_processed_total', 'Total chunks processed')
processing_errors = Counter('processing_errors_total', 'Total processing errors')
processing_hist = Histogram('document_processing_seconds', 'Time spent processing documents')
docs_total = Counter('documents_total', 'Total documents by status and type', ['status', 'file_type'])
embeddings_created = Counter("embeddings_created_total", "Total embeddings created", registry=registry)
queue_size_gauge = Gauge("queue_size", "Current queue size (messages)", registry=registry)

# Initialize Supabase client (with fallback)
supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")


def get_postgres_connection():
    """Get PostgreSQL connection"""
    return psycopg2.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD
    )




def create_embedding(text: str) -> List[float]:
    """Create embedding using OpenAI/OpenRouter"""
    try:
        response = client.embeddings.create(
            input=text,
            model=EMBEDDING_MODEL
        )
        embeddings_created.inc()
        return response.data[0].embedding
    except Exception as e:
        print(f"Error creating embedding: {e}")
        raise


def store_document_with_embeddings(doc_id: str, full_text: str, chunks: List[str], metadata: Dict[str, Any]):
    """Store document and embeddings in Supabase with pgvector"""
    try:
        # Store full document
        full_embedding = create_embedding(full_text)
        
        document_data = {
            'id': doc_id,
            'content': full_text,
            'metadata': metadata,
            'embedding': full_embedding,
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Upsert document
        supabase.table('documents').upsert(document_data).execute()
        
        # Store chunks with embeddings
        chunk_data = []
        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_chunk_{i}"
            chunk_embedding = create_embedding(chunk)
            
            chunk_metadata = {
                **metadata,
                'chunk_index': i,
                'parent_document_id': doc_id,
                'chunk_length': len(chunk)
            }
            
            chunk_data.append({
                'id': chunk_id,
                'document_id': doc_id,
                'content': chunk,
                'metadata': chunk_metadata,
                'embedding': chunk_embedding,
                'created_at': datetime.utcnow().isoformat()
            })
        
        # Batch insert chunks
        if chunk_data:
            supabase.table('document_chunks').upsert(chunk_data).execute()
        
        print(f"Stored document {doc_id} with {len(chunks)} chunks in Supabase")
        
    except Exception as e:
        print(f"Error storing document in Supabase: {e}")
        raise


def process_file(doc_id: str, file_path: str, content_type: str | None, metadata: Dict[str, Any] | None):
    """Process file using unstructured.io and store with embeddings"""
    start = time.perf_counter()
    file_type = (content_type or os.path.splitext(file_path)[1].lstrip(".") or "unknown").lower()
    
    try:
        # Process document with unstructured.io
        elements = partition(filename=file_path)
        texts = [e.text for e in elements if getattr(e, "text", None) and e.text.strip()]
        
        if not texts:
            raise ValueError(f"No text content extracted from {file_path}")
        
        full_text = "\n\n".join(texts)
        
        # Enhanced metadata
        enhanced_metadata = {
            **(metadata or {}),
            'file_type': file_type,
            'file_path': file_path,
            'processed_at': datetime.utcnow().isoformat(),
            'chunk_count': len(texts),
            'total_length': len(full_text),
            'processing_method': 'unstructured.io'
        }
        
        # Store with embeddings
        store_document_with_embeddings(doc_id, full_text, texts, enhanced_metadata)
        
        # Update metrics
        processed_docs.inc()
        processed_chunks.inc(len(texts))
        docs_total.labels(status="success", file_type=file_type).inc()
        
        print(f"Successfully processed {doc_id}: {len(texts)} chunks, {len(full_text)} chars")
        
    except Exception as e:
        processing_errors.inc()
        docs_total.labels(status="error", file_type=file_type).inc()
        print(f"Error processing {doc_id}: {e}")
        raise
    finally:
        processing_hist.observe(time.perf_counter() - start)


def consumer_loop():
    """RabbitMQ consumer loop"""
    while True:
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.queue_declare(queue=QUEUE_NAME, durable=True)

            def on_message(ch, method, properties, body):
                try:
                    msg = json.loads(body.decode("utf-8"))
                    doc_id = msg.get("doc_id") or msg.get("id") or str(uuid.uuid4())
                    file_path = msg.get("file_path")
                    content_type = msg.get("content_type")
                    metadata = msg.get("metadata", {})
                    
                    if not file_path:
                        raise ValueError("Missing file_path in message")
                    
                    if not os.path.exists(file_path):
                        raise ValueError(f"File not found: {file_path}")
                    
                    process_file(doc_id, file_path, content_type, metadata)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    
                except Exception as e:
                    processing_errors.inc()
                    print(f"Message processing error: {e}")
                    # Nack without requeue to avoid poison messages
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

            channel.basic_qos(prefetch_count=int(os.getenv("WORKER_CONCURRENCY", 2)))
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=on_message)
            print(f"Started consuming from queue: {QUEUE_NAME}")
            channel.start_consuming()
            
        except Exception as e:
            print(f"Consumer error: {e}")
            time.sleep(5)
            continue


def queue_metrics_loop():
    """Update queue metrics periodically"""
    while True:
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            res = channel.queue_declare(queue=QUEUE_NAME, durable=True, passive=True)
            queue_size_gauge.set(getattr(res.method, "message_count", 0))
            connection.close()
        except Exception:
            queue_size_gauge.set(-1)
        time.sleep(10)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    requests_counter.inc()
    try:
        cpu = psutil.cpu_percent(interval=0.0)
        mem = psutil.virtual_memory().percent
        cpu_gauge.set(cpu)
        mem_gauge.set(mem)
        health_gauge.set(1)
        
        # Test database connection (optional)
        postgres_connected = False
        try:
            with get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            postgres_connected = True
        except Exception as db_e:
            print(f"Database connection failed: {db_e}")
        
        return jsonify({
            "status": "ok",
            "worker_type": "unstructured-pgvector",
            "concurrency": int(os.getenv("WORKER_CONCURRENCY", 2)),
            "cpu_percent": cpu,
            "mem_percent": mem,
            "queue": QUEUE_NAME,
            "embedding_model": EMBEDDING_MODEL,
            "postgres_connected": postgres_connected,
            "supabase_configured": supabase is not None,
            "openai_configured": bool(OPENAI_API_KEY or OPENROUTER_API_KEY)
        }), 200
    except Exception as e:
        health_gauge.set(0)
        return jsonify({"status": "error", "detail": str(e)}), 500


@app.route("/metrics")
def metrics():
    """Prometheus metrics endpoint"""
    requests_counter.inc()
    data = generate_latest(registry)
    return app.response_class(data, mimetype=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    print("Starting Unstructured Worker with pgvector integration...")
    
    # Start consumer in background thread
    consumer_thread = threading.Thread(target=consumer_loop, daemon=True)
    consumer_thread.start()
    
    # Start queue metrics updater
    metrics_thread = threading.Thread(target=queue_metrics_loop, daemon=True)
    metrics_thread.start()
    
    # Run health/metrics server
    print(f"Health check server starting on port {APP_PORT}")
    app.run(host="0.0.0.0", port=APP_PORT)
