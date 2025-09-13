import os
import asyncio
from typing import Dict, List, Any, Optional
from supabase import create_client, Client
import logging
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)

class SupabaseClient:
    """
    Supabase client for ML service integration with vector operations.
    """
    
    def __init__(self):
        self.url = os.getenv('SUPABASE_URL')
        self.key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not all([self.url, self.key]):
            raise ValueError("Supabase connection parameters not found in environment variables")
        
        self.client: Client = create_client(self.url, self.key)
        logger.info("Supabase client initialized successfully")
    
    async def verify_connection(self) -> bool:
        """Verify Supabase connection."""
        try:
            result = self.client.table('knowledge_entities').select('count').limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase connection verification failed: {e}")
            return False
    
    async def get_knowledge_entities_for_training(self, limit: int = 10000) -> List[Dict[str, Any]]:
        """Get knowledge entities with embeddings for ML training."""
        try:
            result = self.client.table('knowledge_entities')\
                .select('id, content, entity_type, embedding, source_metadata')\
                .not_.is_('embedding', 'null')\
                .limit(limit)\
                .execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Failed to get knowledge entities: {e}")
            return []
    
    async def search_similar_content(self, query_embedding: List[float], 
                                   similarity_threshold: float = 0.7,
                                   match_count: int = 10) -> List[Dict[str, Any]]:
        """Search for similar content using vector similarity."""
        try:
            result = self.client.rpc('search_similar_content', {
                'query_embedding': query_embedding,
                'similarity_threshold': similarity_threshold,
                'match_count': match_count
            }).execute()
            
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Failed to search similar content: {e}")
            return []
    
    async def store_ml_training_run(self, run_data: Dict[str, Any]) -> Optional[str]:
        """Store ML training run information."""
        try:
            result = self.client.table('ml_training_runs').insert({
                'run_id': run_data['run_id'],
                'model_type': run_data['model_type'],
                'hyperparameters': run_data['hyperparameters'],
                'metrics': run_data['metrics'],
                'status': run_data['status'],
                'started_at': run_data['started_at'],
                'completed_at': run_data.get('completed_at'),
                'model_path': run_data.get('model_path'),
                'notes': run_data.get('notes')
            }).execute()
            
            return result.data[0]['id'] if result.data else None
        except Exception as e:
            logger.error(f"Failed to store training run: {e}")
            return None
    
    async def update_training_run_status(self, run_id: str, status: str, 
                                       metrics: Optional[Dict] = None) -> bool:
        """Update training run status and metrics."""
        try:
            update_data = {'status': status}
            if metrics:
                update_data['metrics'] = metrics
            if status == 'completed':
                update_data['completed_at'] = datetime.now().isoformat()
            
            result = self.client.table('ml_training_runs')\
                .update(update_data)\
                .eq('run_id', run_id)\
                .execute()
            
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Failed to update training run status: {e}")
            return False
    
    async def store_model_predictions(self, predictions: List[Dict[str, Any]]) -> bool:
        """Store model predictions for monitoring and feedback."""
        try:
            prediction_records = []
            for pred in predictions:
                prediction_records.append({
                    'model_type': pred['model_type'],
                    'input_data': pred['input_data'],
                    'prediction': pred['prediction'],
                    'confidence': pred['confidence'],
                    'timestamp': datetime.now().isoformat(),
                    'model_version': pred.get('model_version'),
                    'processing_time_ms': pred.get('processing_time_ms')
                })
            
            result = self.client.table('ml_predictions').insert(prediction_records).execute()
            return len(result.data) == len(predictions)
        except Exception as e:
            logger.error(f"Failed to store model predictions: {e}")
            return False
    
    async def get_model_performance_metrics(self, model_type: str, 
                                          days_back: int = 7) -> Dict[str, Any]:
        """Get model performance metrics for monitoring."""
        try:
            # Get recent predictions
            cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
            
            result = self.client.table('ml_predictions')\
                .select('confidence, processing_time_ms, timestamp')\
                .eq('model_type', model_type)\
                .gte('timestamp', cutoff_date)\
                .execute()
            
            if not result.data:
                return {}
            
            predictions = result.data
            confidences = [p['confidence'] for p in predictions if p['confidence']]
            processing_times = [p['processing_time_ms'] for p in predictions if p['processing_time_ms']]
            
            return {
                'total_predictions': len(predictions),
                'avg_confidence': np.mean(confidences) if confidences else 0,
                'min_confidence': np.min(confidences) if confidences else 0,
                'max_confidence': np.max(confidences) if confidences else 0,
                'avg_processing_time_ms': np.mean(processing_times) if processing_times else 0,
                'period_days': days_back
            }
        except Exception as e:
            logger.error(f"Failed to get performance metrics: {e}")
            return {}
    
    async def store_model_alert(self, alert_data: Dict[str, Any]) -> bool:
        """Store model monitoring alert."""
        try:
            result = self.client.table('ml_alerts').insert({
                'alert_type': alert_data['alert_type'],
                'message': alert_data['message'],
                'severity': alert_data['severity'],
                'model_type': alert_data.get('model_type'),
                'metadata': alert_data.get('metadata', {}),
                'timestamp': datetime.now().isoformat(),
                'resolved': False
            }).execute()
            
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Failed to store model alert: {e}")
            return False
    
    async def get_recent_alerts(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent model alerts."""
        try:
            result = self.client.table('ml_alerts')\
                .select('*')\
                .eq('resolved', False)\
                .order('timestamp', desc=True)\
                .limit(limit)\
                .execute()
            
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Failed to get recent alerts: {e}")
            return []
    
    async def store_data_drift_metrics(self, drift_data: Dict[str, Any]) -> bool:
        """Store data drift detection metrics."""
        try:
            result = self.client.table('ml_data_drift').insert({
                'feature_name': drift_data['feature_name'],
                'drift_score': drift_data['drift_score'],
                'threshold': drift_data['threshold'],
                'is_drift_detected': drift_data['is_drift_detected'],
                'statistical_test': drift_data.get('statistical_test'),
                'p_value': drift_data.get('p_value'),
                'timestamp': datetime.now().isoformat(),
                'metadata': drift_data.get('metadata', {})
            }).execute()
            
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Failed to store drift metrics: {e}")
            return False
    
    async def get_training_data_statistics(self) -> Dict[str, Any]:
        """Get statistics about training data."""
        try:
            # Get knowledge entities statistics
            entities_result = self.client.table('knowledge_entities')\
                .select('entity_type')\
                .not_.is_('embedding', 'null')\
                .execute()
            
            if not entities_result.data:
                return {}
            
            # Count by entity type
            entity_counts = {}
            for entity in entities_result.data:
                entity_type = entity['entity_type']
                entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1
            
            # Get processing logs statistics
            processing_result = self.client.table('processing_logs')\
                .select('status, source_type')\
                .execute()
            
            processing_stats = {}
            if processing_result.data:
                for log in processing_result.data:
                    source_type = log['source_type']
                    status = log['status']
                    if source_type not in processing_stats:
                        processing_stats[source_type] = {}
                    processing_stats[source_type][status] = processing_stats[source_type].get(status, 0) + 1
            
            return {
                'entity_counts': entity_counts,
                'total_entities_with_embeddings': len(entities_result.data),
                'processing_stats': processing_stats,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get training data statistics: {e}")
            return {}
    
    def table(self, table_name: str):
        """Get table reference for direct operations."""
        return self.client.table(table_name)
    
    def rpc(self, function_name: str, params: Dict[str, Any]):
        """Call remote procedure."""
        return self.client.rpc(function_name, params)
