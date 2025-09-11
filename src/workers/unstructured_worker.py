"""Enhanced Unstructured Worker with pgvector integration
Processes documents using unstructured.io and stores embeddings in PostgreSQL with pgvector
"""

import json
import os
import threading
import time
import hashlib
import uuid
from typing import List, Dict, Any
from datetime import datetime

import psutil
import pika
import psycopg2
import numpy as np
from flask import Flask, jsonify
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
from unstructured.partition.auto import partition
import openai
from openai import OpenAI

# Configuration
APP_PORT = int(os.getenv("HEALTH_CHECK_PORT", "8080"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
QUEUE_NAME = os.getenv("UNSTRUCTURED_QUEUE", "documents.process")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://athenai_user:password@localhost:5432/athenai")

# OpenAI/OpenRouter configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

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
processed_docs = Counter("unstructured_worker_documents_processed_total", "Documents processed", registry=registry)
processed_chunks = Counter("unstructured_worker_chunks_processed_total", "Chunks processed", registry=registry)
processing_errors = Counter("unstructured_worker_processing_errors_total", "Processing errors", registry=registry)
docs_total = Counter("documents_processed_total", "Total documents processed", ["status", "file_type"], registry=registry)
processing_hist = Histogram("document_processing_seconds", "Time spent processing a document", registry=registry)
queue_size_gauge = Gauge("queue_size", "Current queue size (messages)", registry=registry)
embeddings_created = Counter("embeddings_created_total", "Total embeddings created", registry=registry)


def get_postgres_connection():
    """Get PostgreSQL connection"""
    return psycopg2.connect(POSTGRES_URL)


def create_embedding(text: str) -> List[float]:
    """Create embedding using OpenAI/OpenRouter"""
    try:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text
        )
        embeddings_created.inc()
        return response.data[0].embedding
    except Exception as e:
        print(f"Error creating embedding: {e}")
        return []


def store_document_with_embeddings(doc_id: str, content: str, chunks: List[str], metadata: Dict[str, Any]):
    """Store document and chunks with embeddings in PostgreSQL"""
    try:
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                # Create document embedding
                doc_embedding = create_embedding(content[:8000])  # Limit content for embedding
                
                # Store main document
                cur.execute("""
                    INSERT INTO knowledge_entities (
                        id, entity_type, content, metadata, embedding, 
                        created_at, updated_at, version
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        content = EXCLUDED.content,
                        metadata = EXCLUDED.metadata,
                        embedding = EXCLUDED.embedding,
                        updated_at = EXCLUDED.updated_at,
                        version = knowledge_entities.version + 1
                """, (
                    doc_id,
                    'document',
                    content,
                    json.dumps(metadata),
                    doc_embedding,
                    datetime.utcnow(),
                    datetime.utcnow(),
                    1
                ))
                
                # Store chunks with embeddings
                for idx, chunk_text in enumerate(chunks):
                    if not chunk_text.strip():
                        continue
                        
                    chunk_id = f"{doc_id}:chunk:{idx}"
                    chunk_embedding = create_embedding(chunk_text)
                    
                    cur.execute("""
                        INSERT INTO knowledge_entities (
                            id, entity_type, content, metadata, embedding,
                            created_at, updated_at, version, parent_id
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding,
                            updated_at = EXCLUDED.updated_at,
                            version = knowledge_entities.version + 1
                    """, (
                        chunk_id,
                        'chunk',
                        chunk_text,
                        json.dumps({**metadata, 'chunk_index': idx}),
                        chunk_embedding,
                        datetime.utcnow(),
                        datetime.utcnow(),
                        1,
                        doc_id
                    ))
                
                conn.commit()
                print(f"Stored document {doc_id} with {len(chunks)} chunks and embeddings")
                
    except Exception as e:
        print(f"Error storing document with embeddings: {e}")
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
        
        # Test database connection
        with get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        
        return jsonify({
            "status": "ok",
            "worker_type": "unstructured-pgvector",
            "concurrency": int(os.getenv("WORKER_CONCURRENCY", 2)),
            "cpu_percent": cpu,
            "mem_percent": mem,
            "queue": QUEUE_NAME,
            "embedding_model": EMBEDDING_MODEL,
            "postgres_connected": True
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
