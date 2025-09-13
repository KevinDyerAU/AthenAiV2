from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import mlflow.pytorch
import numpy as np
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime
import logging
import os
import yaml
from pathlib import Path

from inference.real_time_predictor import RealTimePredictor
from inference.batch_predictor import BatchPredictor
from mlops.model_monitor import ModelMonitor
from utils.neo4j_client import Neo4jClient
from utils.supabase_client import SupabaseClient
from training.trainer import MLTrainingOrchestrator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration
config_path = Path("config/deployment_config.yaml")
if config_path.exists():
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
else:
    config = {
        'api': {'host': '0.0.0.0', 'port': 8000},
        'monitoring': {'prometheus_port': 9090}
    }

app = FastAPI(
    title="AthenAI ML Service",
    description="Machine Learning service for AthenAI with Graph Neural Networks",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
predictor = None
batch_predictor = None
monitor = None
neo4j_client = None
supabase_client = None
trainer = None

# Request/Response Models
class ExpertiseRequest(BaseModel):
    topic: str
    max_experts: int = 5
    confidence_threshold: float = 0.7

class LinkPredictionRequest(BaseModel):
    source_entity: str
    target_entity: str
    relationship_type: str = "RELATED_TO"

class BatchPredictionRequest(BaseModel):
    prediction_type: str
    entities: List[Dict[str, Any]]
    callback_url: Optional[str] = None

class TrainingRequest(BaseModel):
    model_types: List[str] = ["link_prediction"]
    config_overrides: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, str]

@app.on_event("startup")
async def startup_event():
    """Initialize models and services on startup."""
    global predictor, batch_predictor, monitor, neo4j_client, supabase_client, trainer
    
    try:
        logger.info("Starting AthenAI ML Service...")
        
        # Initialize clients
        neo4j_client = Neo4jClient()
        supabase_client = SupabaseClient()
        
        # Verify connections
        neo4j_connected = await neo4j_client.verify_connection()
        supabase_connected = await supabase_client.verify_connection()
        
        if not neo4j_connected:
            logger.warning("Neo4j connection failed - some features may be limited")
        if not supabase_connected:
            logger.warning("Supabase connection failed - some features may be limited")
        
        # Initialize services
        predictor = RealTimePredictor(neo4j_client, supabase_client)
        batch_predictor = BatchPredictor(neo4j_client, supabase_client)
        monitor = ModelMonitor(supabase_client)
        trainer = MLTrainingOrchestrator()
        
        # Load latest models
        await predictor.load_latest_models()
        
        # Start monitoring
        await monitor.start_monitoring()
        
        logger.info("AthenAI ML Service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start ML service: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    global predictor, batch_predictor, monitor, neo4j_client, supabase_client, trainer
    
    logger.info("Shutting down AthenAI ML Service...")
    
    if monitor:
        await monitor.stop_monitoring()
    if neo4j_client:
        neo4j_client.close()
    if trainer:
        trainer.close()

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    services = {
        "ml_service": "healthy",
        "neo4j": "healthy" if neo4j_client and await neo4j_client.verify_connection() else "unhealthy",
        "supabase": "healthy" if supabase_client and await supabase_client.verify_connection() else "unhealthy",
        "predictor": "healthy" if predictor and predictor.is_ready() else "unhealthy"
    }
    
    overall_status = "healthy" if all(status == "healthy" for status in services.values()) else "degraded"
    
    return HealthResponse(
        status=overall_status,
        timestamp=datetime.now().isoformat(),
        services=services
    )

@app.post("/predict/expertise")
async def predict_expertise(request: ExpertiseRequest):
    """Predict experts for a given topic using knowledge-first approach."""
    try:
        if not predictor:
            raise HTTPException(status_code=503, detail="Predictor service not available")
        
        # Monitor request
        monitor.log_request("expertise_prediction", request.dict())
        
        # Step 1: Search knowledge substrate first
        knowledge_experts = await predictor.search_knowledge_for_experts(
            topic=request.topic,
            max_experts=request.max_experts
        )
        
        # Step 2: Evaluate if knowledge substrate results are sufficient
        if knowledge_experts and len(knowledge_experts) >= request.max_experts:
            # Knowledge substrate provided sufficient results
            monitor.log_response("expertise_prediction", {
                "source": "knowledge_substrate",
                "experts": knowledge_experts,
                "ml_prediction_used": False
            })
            
            return {
                "topic": request.topic,
                "experts": knowledge_experts,
                "source": "knowledge_substrate",
                "timestamp": datetime.now().isoformat()
            }
        
        # Step 3: Use ML prediction to augment knowledge substrate results
        ml_experts = await predictor.predict_expertise(
            topic=request.topic,
            max_experts=request.max_experts,
            confidence_threshold=request.confidence_threshold,
            existing_knowledge=knowledge_experts
        )
        
        # Step 4: Store high-confidence ML predictions back to knowledge substrate
        await _store_expertise_predictions(request.topic, ml_experts)
        
        # Monitor response
        monitor.log_response("expertise_prediction", {
            "source": "ml_enhanced",
            "experts": ml_experts,
            "knowledge_experts_count": len(knowledge_experts) if knowledge_experts else 0
        })
        
        return {
            "topic": request.topic,
            "experts": ml_experts,
            "source": "ml_enhanced",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        monitor.log_error("expertise_prediction", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/link")
async def predict_link(request: LinkPredictionRequest):
    """Predict the probability of a link between two entities."""
    try:
        if not predictor:
            raise HTTPException(status_code=503, detail="Predictor service not available")
        
        monitor.log_request("link_prediction", request.dict())
        
        prediction = await predictor.predict_link(
            source=request.source_entity,
            target=request.target_entity,
            relationship_type=request.relationship_type
        )
        
        # Store high-confidence predictions
        if prediction['confidence'] > 0.8:
            await _store_link_prediction(request, prediction)
        
        monitor.log_response("link_prediction", prediction)
        
        return prediction
        
    except Exception as e:
        monitor.log_error("link_prediction", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch")
async def predict_batch(request: BatchPredictionRequest, background_tasks: BackgroundTasks):
    """Submit a batch prediction job."""
    try:
        if not batch_predictor:
            raise HTTPException(status_code=503, detail="Batch predictor service not available")
        
        job_id = await batch_predictor.submit_job(
            prediction_type=request.prediction_type,
            entities=request.entities,
            callback_url=request.callback_url
        )
        
        # Start background processing
        background_tasks.add_task(batch_predictor.process_job, job_id)
        
        return {
            "job_id": job_id,
            "status": "submitted",
            "estimated_completion": "5-10 minutes"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/batch/{job_id}/status")
async def get_batch_status(job_id: str):
    """Get status of a batch prediction job."""
    try:
        if not batch_predictor:
            raise HTTPException(status_code=503, detail="Batch predictor service not available")
        
        status = await batch_predictor.get_job_status(job_id)
        return status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model/status")
async def get_model_status():
    """Get current model status and performance metrics."""
    try:
        if not monitor:
            raise HTTPException(status_code=503, detail="Monitor service not available")
        
        return await monitor.get_model_status()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/model/retrain")
async def trigger_retraining(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Trigger model retraining."""
    try:
        if not trainer:
            raise HTTPException(status_code=503, detail="Training service not available")
        
        # Start background retraining
        background_tasks.add_task(
            _retrain_models, 
            request.model_types, 
            request.config_overrides
        )
        
        return {
            "status": "retraining_started",
            "model_types": request.model_types,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/training/status")
async def get_training_status():
    """Get training pipeline status and statistics."""
    try:
        if not trainer:
            raise HTTPException(status_code=503, detail="Training service not available")
        
        return await trainer.get_training_statistics()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/data/statistics")
async def get_data_statistics():
    """Get comprehensive data statistics."""
    try:
        stats = {}
        
        if neo4j_client:
            stats['neo4j'] = await neo4j_client.get_graph_statistics()
        
        if supabase_client:
            stats['supabase'] = await supabase_client.get_training_data_statistics()
        
        if trainer:
            stats['training'] = await trainer.get_training_statistics()
        
        return {
            "statistics": stats,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models/available")
async def get_available_models():
    """Get list of available trained models."""
    try:
        if not predictor:
            raise HTTPException(status_code=503, detail="Predictor service not available")
        
        return await predictor.get_available_models()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/load/{model_type}")
async def load_model(model_type: str, model_version: Optional[str] = None):
    """Load a specific model version."""
    try:
        if not predictor:
            raise HTTPException(status_code=503, detail="Predictor service not available")
        
        success = await predictor.load_model(model_type, model_version)
        
        if success:
            return {
                "status": "success",
                "model_type": model_type,
                "model_version": model_version,
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail=f"Model {model_type} version {model_version} not found")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/monitoring/alerts")
async def get_monitoring_alerts():
    """Get recent monitoring alerts."""
    try:
        if not supabase_client:
            raise HTTPException(status_code=503, detail="Database service not available")
        
        alerts = await supabase_client.get_recent_alerts()
        return {"alerts": alerts}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics/prometheus")
async def get_prometheus_metrics():
    """Get Prometheus-formatted metrics."""
    try:
        if not monitor:
            raise HTTPException(status_code=503, detail="Monitor service not available")
        
        return await monitor.get_prometheus_metrics()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions
async def _store_expertise_predictions(topic: str, experts: List[Dict]):
    """Store expertise predictions in Neo4j."""
    if not neo4j_client:
        return
    
    predictions = []
    for expert in experts:
        if expert.get('confidence', 0) > 0.7:  # Only store high-confidence predictions
            predictions.append({
                'type': 'expertise_prediction',
                'person': expert['name'],
                'topic': topic,
                'confidence': expert['confidence']
            })
    
    if predictions:
        await neo4j_client.store_ml_predictions(predictions)

async def _store_link_prediction(request: LinkPredictionRequest, prediction: Dict):
    """Store high-confidence link predictions in Neo4j."""
    if not neo4j_client:
        return
    
    predictions = [{
        'type': 'link_prediction',
        'source': request.source_entity,
        'target': request.target_entity,
        'relationship_type': request.relationship_type,
        'confidence': prediction['confidence']
    }]
    
    await neo4j_client.store_ml_predictions(predictions)

async def _retrain_models(model_types: List[str], config_overrides: Optional[Dict[str, Any]] = None):
    """Background task for model retraining."""
    try:
        logger.info(f"Starting retraining for models: {model_types}")
        
        # Apply config overrides if provided
        if config_overrides:
            # This would update the trainer's configuration
            pass
        
        # Run training pipeline
        results = await trainer.run_training_pipeline(model_types)
        
        # Update predictor with new models
        for model_type, result in results.items():
            if result['status'] == 'completed':
                await predictor.load_latest_model(model_type)
                logger.info(f"Updated {model_type} model after retraining")
        
        logger.info("Model retraining completed")
        
    except Exception as e:
        logger.error(f"Model retraining failed: {e}")

if __name__ == "__main__":
    import uvicorn
    
    host = config['api'].get('host', '0.0.0.0')
    port = config['api'].get('port', 8000)
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
