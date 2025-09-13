import asyncio
import uuid
from typing import Dict, List, Any, Optional
import logging
from datetime import datetime, timedelta
import json
import aiohttp
from pathlib import Path
import pandas as pd
import numpy as np
import torch

from utils.neo4j_client import Neo4jClient
from utils.supabase_client import SupabaseClient
from inference.real_time_predictor import RealTimePredictor

logger = logging.getLogger(__name__)

class BatchPredictor:
    """
    Batch prediction service for processing large-scale ML inference jobs.
    Handles asynchronous processing with progress tracking and callbacks.
    """
    
    def __init__(self, neo4j_client: Neo4jClient, supabase_client: SupabaseClient):
        self.neo4j = neo4j_client
        self.supabase = supabase_client
        self.real_time_predictor = RealTimePredictor(neo4j_client, supabase_client)
        
        # Job management
        self.active_jobs = {}
        self.job_results = {}
        self.max_concurrent_jobs = 5
        self.job_timeout = timedelta(hours=2)
        
        # Processing configuration
        self.batch_size = 100
        self.max_retries = 3
        
        logger.info("BatchPredictor initialized")
    
    async def submit_job(self, prediction_type: str, entities: List[Dict[str, Any]], 
                        callback_url: Optional[str] = None) -> str:
        """Submit a batch prediction job."""
        job_id = str(uuid.uuid4())
        
        job_data = {
            'job_id': job_id,
            'prediction_type': prediction_type,
            'entities': entities,
            'callback_url': callback_url,
            'status': 'submitted',
            'created_at': datetime.now(),
            'total_entities': len(entities),
            'processed_entities': 0,
            'failed_entities': 0,
            'results': []
        }
        
        self.active_jobs[job_id] = job_data
        
        # Store job in database
        await self._store_job_metadata(job_data)
        
        logger.info(f"Submitted batch job {job_id} with {len(entities)} entities")
        return job_id
    
    async def process_job(self, job_id: str):
        """Process a batch prediction job."""
        if job_id not in self.active_jobs:
            logger.error(f"Job {job_id} not found")
            return
        
        job_data = self.active_jobs[job_id]
        
        try:
            job_data['status'] = 'processing'
            job_data['started_at'] = datetime.now()
            
            await self._update_job_status(job_id, 'processing')
            
            # Process based on prediction type
            if job_data['prediction_type'] == 'expertise_batch':
                await self._process_expertise_batch(job_data)
            elif job_data['prediction_type'] == 'link_prediction_batch':
                await self._process_link_prediction_batch(job_data)
            elif job_data['prediction_type'] == 'node_classification_batch':
                await self._process_node_classification_batch(job_data)
            else:
                raise ValueError(f"Unknown prediction type: {job_data['prediction_type']}")
            
            job_data['status'] = 'completed'
            job_data['completed_at'] = datetime.now()
            
            await self._update_job_status(job_id, 'completed')
            
            # Send callback if provided
            if job_data['callback_url']:
                await self._send_callback(job_data)
            
            # Move to results storage
            self.job_results[job_id] = job_data
            del self.active_jobs[job_id]
            
            logger.info(f"Completed batch job {job_id}")
            
        except Exception as e:
            logger.error(f"Failed to process job {job_id}: {e}")
            job_data['status'] = 'failed'
            job_data['error'] = str(e)
            job_data['failed_at'] = datetime.now()
            
            await self._update_job_status(job_id, 'failed', error=str(e))
            
            # Still send callback on failure
            if job_data['callback_url']:
                await self._send_callback(job_data)
    
    async def _process_expertise_batch(self, job_data: Dict):
        """Process batch expertise predictions."""
        entities = job_data['entities']
        results = []
        
        # Process in batches
        for i in range(0, len(entities), self.batch_size):
            batch = entities[i:i + self.batch_size]
            batch_results = []
            
            for entity in batch:
                try:
                    topic = entity.get('topic', '')
                    max_experts = entity.get('max_experts', 5)
                    confidence_threshold = entity.get('confidence_threshold', 0.7)
                    
                    # Use real-time predictor for individual predictions
                    experts = await self.real_time_predictor.predict_expertise(
                        topic=topic,
                        max_experts=max_experts,
                        confidence_threshold=confidence_threshold
                    )
                    
                    batch_results.append({
                        'entity_id': entity.get('id', ''),
                        'topic': topic,
                        'experts': experts,
                        'status': 'success'
                    })
                    
                    job_data['processed_entities'] += 1
                    
                except Exception as e:
                    logger.error(f"Failed to process entity {entity}: {e}")
                    batch_results.append({
                        'entity_id': entity.get('id', ''),
                        'topic': entity.get('topic', ''),
                        'experts': [],
                        'status': 'failed',
                        'error': str(e)
                    })
                    
                    job_data['failed_entities'] += 1
            
            results.extend(batch_results)
            
            # Update progress
            progress = (job_data['processed_entities'] + job_data['failed_entities']) / job_data['total_entities']
            await self._update_job_progress(job_data['job_id'], progress)
            
            # Small delay to prevent overwhelming the system
            await asyncio.sleep(0.1)
        
        job_data['results'] = results
    
    async def _process_link_prediction_batch(self, job_data: Dict):
        """Process batch link predictions."""
        entities = job_data['entities']
        results = []
        
        for i in range(0, len(entities), self.batch_size):
            batch = entities[i:i + self.batch_size]
            batch_results = []
            
            for entity in batch:
                try:
                    source = entity.get('source', '')
                    target = entity.get('target', '')
                    relationship_type = entity.get('relationship_type', 'RELATED_TO')
                    
                    prediction = await self.real_time_predictor.predict_link(
                        source=source,
                        target=target,
                        relationship_type=relationship_type
                    )
                    
                    batch_results.append({
                        'entity_id': entity.get('id', ''),
                        'source': source,
                        'target': target,
                        'relationship_type': relationship_type,
                        'prediction': prediction,
                        'status': 'success'
                    })
                    
                    job_data['processed_entities'] += 1
                    
                except Exception as e:
                    logger.error(f"Failed to process link prediction {entity}: {e}")
                    batch_results.append({
                        'entity_id': entity.get('id', ''),
                        'source': entity.get('source', ''),
                        'target': entity.get('target', ''),
                        'prediction': None,
                        'status': 'failed',
                        'error': str(e)
                    })
                    
                    job_data['failed_entities'] += 1
            
            results.extend(batch_results)
            
            # Update progress
            progress = (job_data['processed_entities'] + job_data['failed_entities']) / job_data['total_entities']
            await self._update_job_progress(job_data['job_id'], progress)
            
            await asyncio.sleep(0.1)
        
        job_data['results'] = results
    
    async def _process_node_classification_batch(self, job_data: Dict):
        """Process batch node classifications."""
        entities = job_data['entities']
        results = []
        
        # Load node classification model if not already loaded
        if 'node_classification' not in self.real_time_predictor.models:
            await self.real_time_predictor._load_model_by_type('node_classification')
        
        if 'node_classification' not in self.real_time_predictor.models:
            raise ValueError("Node classification model not available")
        
        model = self.real_time_predictor.models['node_classification']
        
        # Get graph data for batch processing
        graph_data = await self.real_time_predictor._get_prediction_graph_data()
        if not graph_data:
            raise ValueError("No graph data available for node classification")
        
        # Process in batches
        for i in range(0, len(entities), self.batch_size):
            batch = entities[i:i + self.batch_size]
            batch_results = []
            
            # Find nodes for this batch
            batch_node_indices = []
            batch_entity_ids = []
            
            for entity in batch:
                node_name = entity.get('node_name', '')
                node_idx = await self.real_time_predictor._find_node_by_name(node_name, graph_data)
                
                if node_idx is not None:
                    batch_node_indices.append(node_idx)
                    batch_entity_ids.append(entity.get('id', ''))
                else:
                    batch_results.append({
                        'entity_id': entity.get('id', ''),
                        'node_name': node_name,
                        'classification': None,
                        'status': 'failed',
                        'error': 'Node not found'
                    })
                    job_data['failed_entities'] += 1
            
            # Run batch prediction
            if batch_node_indices:
                try:
                    with torch.no_grad():
                        x = torch.tensor(graph_data['node_features'], dtype=torch.float)
                        edge_index = torch.tensor(graph_data['edge_index'], dtype=torch.long)
                        
                        # Get predictions for batch nodes
                        logits = model(x, edge_index)
                        predictions = torch.softmax(logits[batch_node_indices], dim=1)
                        
                        # Process predictions
                        for idx, (entity_id, node_idx) in enumerate(zip(batch_entity_ids, batch_node_indices)):
                            pred_probs = predictions[idx].numpy()
                            predicted_class = np.argmax(pred_probs)
                            confidence = float(pred_probs[predicted_class])
                            
                            batch_results.append({
                                'entity_id': entity_id,
                                'node_name': graph_data['node_names'][node_idx],
                                'classification': {
                                    'predicted_class': int(predicted_class),
                                    'confidence': confidence,
                                    'class_probabilities': pred_probs.tolist()
                                },
                                'status': 'success'
                            })
                            
                            job_data['processed_entities'] += 1
                
                except Exception as e:
                    logger.error(f"Batch prediction failed: {e}")
                    # Mark all batch items as failed
                    for entity_id in batch_entity_ids:
                        batch_results.append({
                            'entity_id': entity_id,
                            'classification': None,
                            'status': 'failed',
                            'error': str(e)
                        })
                        job_data['failed_entities'] += 1
            
            results.extend(batch_results)
            
            # Update progress
            progress = (job_data['processed_entities'] + job_data['failed_entities']) / job_data['total_entities']
            await self._update_job_progress(job_data['job_id'], progress)
            
            await asyncio.sleep(0.1)
        
        job_data['results'] = results
    
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of a batch job."""
        # Check active jobs first
        if job_id in self.active_jobs:
            job_data = self.active_jobs[job_id]
            return {
                'job_id': job_id,
                'status': job_data['status'],
                'progress': (job_data['processed_entities'] + job_data['failed_entities']) / job_data['total_entities'],
                'total_entities': job_data['total_entities'],
                'processed_entities': job_data['processed_entities'],
                'failed_entities': job_data['failed_entities'],
                'created_at': job_data['created_at'].isoformat(),
                'started_at': job_data.get('started_at', '').isoformat() if job_data.get('started_at') else None
            }
        
        # Check completed jobs
        if job_id in self.job_results:
            job_data = self.job_results[job_id]
            return {
                'job_id': job_id,
                'status': job_data['status'],
                'progress': 1.0,
                'total_entities': job_data['total_entities'],
                'processed_entities': job_data['processed_entities'],
                'failed_entities': job_data['failed_entities'],
                'created_at': job_data['created_at'].isoformat(),
                'started_at': job_data.get('started_at', '').isoformat() if job_data.get('started_at') else None,
                'completed_at': job_data.get('completed_at', '').isoformat() if job_data.get('completed_at') else None,
                'results_available': True
            }
        
        # Check database for historical jobs
        try:
            result = await self.supabase.client.table('ml_batch_jobs')\
                .select('*')\
                .eq('job_id', job_id)\
                .single()\
                .execute()
            
            if result.data:
                return {
                    'job_id': job_id,
                    'status': result.data['status'],
                    'progress': result.data.get('progress', 0),
                    'total_entities': result.data.get('total_entities', 0),
                    'processed_entities': result.data.get('processed_entities', 0),
                    'failed_entities': result.data.get('failed_entities', 0),
                    'created_at': result.data['created_at'],
                    'results_available': result.data['status'] == 'completed'
                }
        
        except Exception as e:
            logger.error(f"Failed to get job status from database: {e}")
        
        return {
            'job_id': job_id,
            'status': 'not_found',
            'error': 'Job not found'
        }
    
    async def get_job_results(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get results of a completed batch job."""
        if job_id in self.job_results:
            return self.job_results[job_id]['results']
        
        # Try to load from database
        try:
            result = await self.supabase.client.table('ml_batch_jobs')\
                .select('results')\
                .eq('job_id', job_id)\
                .eq('status', 'completed')\
                .single()\
                .execute()
            
            if result.data:
                return result.data['results']
        
        except Exception as e:
            logger.error(f"Failed to get job results: {e}")
        
        return None
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel an active batch job."""
        if job_id in self.active_jobs:
            job_data = self.active_jobs[job_id]
            job_data['status'] = 'cancelled'
            job_data['cancelled_at'] = datetime.now()
            
            await self._update_job_status(job_id, 'cancelled')
            
            # Move to results
            self.job_results[job_id] = job_data
            del self.active_jobs[job_id]
            
            logger.info(f"Cancelled batch job {job_id}")
            return True
        
        return False
    
    async def _store_job_metadata(self, job_data: Dict):
        """Store job metadata in database."""
        try:
            await self.supabase.client.table('ml_batch_jobs').insert({
                'job_id': job_data['job_id'],
                'prediction_type': job_data['prediction_type'],
                'status': job_data['status'],
                'total_entities': job_data['total_entities'],
                'processed_entities': job_data['processed_entities'],
                'failed_entities': job_data['failed_entities'],
                'callback_url': job_data['callback_url'],
                'created_at': job_data['created_at'].isoformat(),
                'metadata': {
                    'batch_size': self.batch_size,
                    'max_retries': self.max_retries
                }
            }).execute()
        
        except Exception as e:
            logger.error(f"Failed to store job metadata: {e}")
    
    async def _update_job_status(self, job_id: str, status: str, error: Optional[str] = None):
        """Update job status in database."""
        try:
            update_data = {'status': status}
            
            if status == 'processing':
                update_data['started_at'] = datetime.now().isoformat()
            elif status == 'completed':
                update_data['completed_at'] = datetime.now().isoformat()
            elif status == 'failed':
                update_data['failed_at'] = datetime.now().isoformat()
                if error:
                    update_data['error_message'] = error
            elif status == 'cancelled':
                update_data['cancelled_at'] = datetime.now().isoformat()
            
            await self.supabase.client.table('ml_batch_jobs')\
                .update(update_data)\
                .eq('job_id', job_id)\
                .execute()
        
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")
    
    async def _update_job_progress(self, job_id: str, progress: float):
        """Update job progress in database."""
        try:
            await self.supabase.client.table('ml_batch_jobs')\
                .update({
                    'progress': progress,
                    'processed_entities': self.active_jobs[job_id]['processed_entities'],
                    'failed_entities': self.active_jobs[job_id]['failed_entities']
                })\
                .eq('job_id', job_id)\
                .execute()
        
        except Exception as e:
            logger.error(f"Failed to update job progress: {e}")
    
    async def _send_callback(self, job_data: Dict):
        """Send callback notification for completed job."""
        if not job_data['callback_url']:
            return
        
        try:
            callback_payload = {
                'job_id': job_data['job_id'],
                'status': job_data['status'],
                'total_entities': job_data['total_entities'],
                'processed_entities': job_data['processed_entities'],
                'failed_entities': job_data['failed_entities'],
                'completed_at': job_data.get('completed_at', '').isoformat() if job_data.get('completed_at') else None,
                'results_url': f"/batch/{job_data['job_id']}/results"
            }
            
            if job_data['status'] == 'failed':
                callback_payload['error'] = job_data.get('error', 'Unknown error')
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    job_data['callback_url'],
                    json=callback_payload,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        logger.info(f"Callback sent successfully for job {job_data['job_id']}")
                    else:
                        logger.warning(f"Callback failed with status {response.status} for job {job_data['job_id']}")
        
        except Exception as e:
            logger.error(f"Failed to send callback for job {job_data['job_id']}: {e}")
    
    async def cleanup_old_jobs(self, max_age_days: int = 7):
        """Clean up old completed jobs."""
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        
        # Clean up in-memory results
        jobs_to_remove = []
        for job_id, job_data in self.job_results.items():
            if job_data.get('completed_at', datetime.now()) < cutoff_date:
                jobs_to_remove.append(job_id)
        
        for job_id in jobs_to_remove:
            del self.job_results[job_id]
        
        logger.info(f"Cleaned up {len(jobs_to_remove)} old job results")
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get batch processing system status."""
        return {
            'active_jobs': len(self.active_jobs),
            'completed_jobs': len(self.job_results),
            'max_concurrent_jobs': self.max_concurrent_jobs,
            'batch_size': self.batch_size,
            'job_timeout_hours': self.job_timeout.total_seconds() / 3600,
            'system_healthy': len(self.active_jobs) < self.max_concurrent_jobs
        }
