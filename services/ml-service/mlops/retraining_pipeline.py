import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import json
import yaml
from pathlib import Path
import schedule
import threading
import time

from training.trainer import MLTrainingOrchestrator
from mlops.model_monitor import ModelMonitor, AlertSeverity
from utils.supabase_client import SupabaseClient
from utils.neo4j_client import Neo4jClient

logger = logging.getLogger(__name__)

class RetrainingTrigger(Enum):
    SCHEDULED = "scheduled"
    PERFORMANCE_DROP = "performance_drop"
    DATA_DRIFT = "data_drift"
    MANUAL = "manual"
    DATA_VOLUME = "data_volume"

@dataclass
class RetrainingJob:
    job_id: str
    trigger: RetrainingTrigger
    model_types: List[str]
    priority: int
    created_at: datetime
    config_overrides: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

class RetrainingPipeline:
    """
    Automated model retraining pipeline with intelligent triggering.
    Monitors model performance and data drift to trigger retraining when needed.
    """
    
    def __init__(self, supabase_client: SupabaseClient, neo4j_client: Neo4jClient,
                 model_monitor: ModelMonitor):
        self.supabase = supabase_client
        self.neo4j = neo4j_client
        self.monitor = model_monitor
        self.trainer = MLTrainingOrchestrator()
        
        # Pipeline configuration
        self.config = self._load_pipeline_config()
        
        # Job management
        self.active_jobs = {}
        self.job_queue = []
        self.max_concurrent_jobs = 1  # Only one retraining job at a time
        
        # Scheduling
        self.scheduler_thread = None
        self.is_running = False
        
        # Trigger conditions
        self.trigger_conditions = {
            RetrainingTrigger.PERFORMANCE_DROP: self._check_performance_trigger,
            RetrainingTrigger.DATA_DRIFT: self._check_drift_trigger,
            RetrainingTrigger.DATA_VOLUME: self._check_data_volume_trigger
        }
        
        # Callbacks for external notifications
        self.completion_callbacks: List[Callable] = []
        
        logger.info("RetrainingPipeline initialized")
    
    def _load_pipeline_config(self) -> Dict[str, Any]:
        """Load pipeline configuration."""
        try:
            config_path = Path("config/retraining_config.yaml")
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return yaml.safe_load(f)
            else:
                # Default configuration
                return {
                    'schedule': {
                        'daily_check_time': '02:00',  # 2 AM daily
                        'weekly_retrain_day': 'sunday',
                        'monthly_full_retrain_day': 1
                    },
                    'triggers': {
                        'performance_drop_threshold': 0.05,  # 5% drop
                        'drift_score_threshold': 0.3,
                        'min_new_data_points': 1000,
                        'min_days_since_last_training': 1
                    },
                    'models': {
                        'link_prediction': {
                            'retrain_frequency': 'weekly',
                            'priority': 1
                        },
                        'expertise_recommendation': {
                            'retrain_frequency': 'weekly',
                            'priority': 2
                        },
                        'node_classification': {
                            'retrain_frequency': 'monthly',
                            'priority': 3
                        }
                    },
                    'resources': {
                        'max_training_time_hours': 6,
                        'memory_limit_gb': 8,
                        'gpu_required': False
                    }
                }
        except Exception as e:
            logger.error(f"Failed to load pipeline config: {e}")
            return {}
    
    async def start_pipeline(self):
        """Start the retraining pipeline."""
        if self.is_running:
            logger.warning("Retraining pipeline already running")
            return
        
        self.is_running = True
        
        # Setup scheduled jobs
        self._setup_scheduled_jobs()
        
        # Start scheduler thread
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        # Start job processing loop
        asyncio.create_task(self._process_job_queue())
        
        logger.info("Retraining pipeline started")
    
    async def stop_pipeline(self):
        """Stop the retraining pipeline."""
        if not self.is_running:
            return
        
        self.is_running = False
        
        # Clear scheduled jobs
        schedule.clear()
        
        # Wait for active jobs to complete
        while self.active_jobs:
            logger.info(f"Waiting for {len(self.active_jobs)} active jobs to complete...")
            await asyncio.sleep(10)
        
        logger.info("Retraining pipeline stopped")
    
    def _setup_scheduled_jobs(self):
        """Setup scheduled retraining jobs."""
        config = self.config.get('schedule', {})
        
        # Daily health check
        daily_time = config.get('daily_check_time', '02:00')
        schedule.every().day.at(daily_time).do(self._scheduled_health_check)
        
        # Weekly retraining
        weekly_day = config.get('weekly_retrain_day', 'sunday')
        getattr(schedule.every(), weekly_day).at(daily_time).do(
            self._scheduled_weekly_retrain
        )
        
        # Monthly full retraining
        monthly_day = config.get('monthly_full_retrain_day', 1)
        schedule.every().month.do(self._scheduled_monthly_retrain)
        
        logger.info("Scheduled jobs configured")
    
    def _run_scheduler(self):
        """Run the job scheduler in a separate thread."""
        while self.is_running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    def _scheduled_health_check(self):
        """Scheduled health check to trigger retraining if needed."""
        asyncio.create_task(self._check_retraining_triggers())
    
    def _scheduled_weekly_retrain(self):
        """Scheduled weekly retraining."""
        weekly_models = []
        for model_type, config in self.config.get('models', {}).items():
            if config.get('retrain_frequency') == 'weekly':
                weekly_models.append(model_type)
        
        if weekly_models:
            asyncio.create_task(self.trigger_retraining(
                model_types=weekly_models,
                trigger=RetrainingTrigger.SCHEDULED,
                metadata={'schedule_type': 'weekly'}
            ))
    
    def _scheduled_monthly_retrain(self):
        """Scheduled monthly full retraining."""
        monthly_models = []
        for model_type, config in self.config.get('models', {}).items():
            if config.get('retrain_frequency') == 'monthly':
                monthly_models.append(model_type)
        
        if monthly_models:
            asyncio.create_task(self.trigger_retraining(
                model_types=monthly_models,
                trigger=RetrainingTrigger.SCHEDULED,
                metadata={'schedule_type': 'monthly'}
            ))
    
    async def _check_retraining_triggers(self):
        """Check all automatic retraining triggers."""
        try:
            for trigger_type, check_function in self.trigger_conditions.items():
                models_to_retrain = await check_function()
                
                if models_to_retrain:
                    await self.trigger_retraining(
                        model_types=models_to_retrain,
                        trigger=trigger_type,
                        metadata={'auto_triggered': True}
                    )
        
        except Exception as e:
            logger.error(f"Failed to check retraining triggers: {e}")
    
    async def _check_performance_trigger(self) -> List[str]:
        """Check if performance drop triggers retraining."""
        models_to_retrain = []
        threshold = self.config.get('triggers', {}).get('performance_drop_threshold', 0.05)
        
        try:
            # Get recent alerts for performance drops
            recent_alerts = await self.supabase.get_recent_alerts(
                alert_types=['accuracy_drop', 'high_error_rate'],
                hours=24
            )
            
            for alert in recent_alerts:
                if alert.get('severity') in ['high', 'critical']:
                    model_type = alert.get('metadata', {}).get('model_type')
                    if model_type and model_type not in models_to_retrain:
                        # Check if enough time has passed since last training
                        if await self._should_retrain_model(model_type):
                            models_to_retrain.append(model_type)
        
        except Exception as e:
            logger.error(f"Failed to check performance trigger: {e}")
        
        return models_to_retrain
    
    async def _check_drift_trigger(self) -> List[str]:
        """Check if data drift triggers retraining."""
        models_to_retrain = []
        threshold = self.config.get('triggers', {}).get('drift_score_threshold', 0.3)
        
        try:
            # Get recent drift alerts
            recent_alerts = await self.supabase.get_recent_alerts(
                alert_types=['data_drift'],
                hours=24
            )
            
            for alert in recent_alerts:
                if alert.get('current_value', 0) > threshold:
                    model_type = alert.get('metadata', {}).get('model_type')
                    if model_type and model_type not in models_to_retrain:
                        if await self._should_retrain_model(model_type):
                            models_to_retrain.append(model_type)
        
        except Exception as e:
            logger.error(f"Failed to check drift trigger: {e}")
        
        return models_to_retrain
    
    async def _check_data_volume_trigger(self) -> List[str]:
        """Check if new data volume triggers retraining."""
        models_to_retrain = []
        min_new_data = self.config.get('triggers', {}).get('min_new_data_points', 1000)
        
        try:
            # Check for new data in Neo4j
            stats = await self.neo4j.get_graph_statistics()
            
            # Get last training timestamps
            training_runs = await self.supabase.get_recent_training_runs(limit=10)
            
            for model_type in ['link_prediction', 'expertise_recommendation', 'node_classification']:
                # Find last training run for this model
                last_training = None
                for run in training_runs:
                    if run.get('model_type') == model_type:
                        last_training = datetime.fromisoformat(run['created_at'])
                        break
                
                if last_training:
                    # Estimate new data since last training (simplified)
                    # In practice, you'd track data ingestion timestamps
                    days_since_training = (datetime.now() - last_training).days
                    estimated_new_data = days_since_training * 100  # Rough estimate
                    
                    if estimated_new_data >= min_new_data:
                        if await self._should_retrain_model(model_type):
                            models_to_retrain.append(model_type)
        
        except Exception as e:
            logger.error(f"Failed to check data volume trigger: {e}")
        
        return models_to_retrain
    
    async def _should_retrain_model(self, model_type: str) -> bool:
        """Check if a model should be retrained based on timing constraints."""
        try:
            min_days = self.config.get('triggers', {}).get('min_days_since_last_training', 1)
            
            # Get last training run for this model
            training_runs = await self.supabase.get_recent_training_runs(
                model_type=model_type,
                limit=1
            )
            
            if training_runs:
                last_training = datetime.fromisoformat(training_runs[0]['created_at'])
                days_since = (datetime.now() - last_training).days
                return days_since >= min_days
            
            return True  # No previous training found
        
        except Exception as e:
            logger.error(f"Failed to check if should retrain {model_type}: {e}")
            return False
    
    async def trigger_retraining(self, model_types: List[str], trigger: RetrainingTrigger,
                               config_overrides: Optional[Dict[str, Any]] = None,
                               metadata: Optional[Dict[str, Any]] = None) -> str:
        """Trigger retraining for specified models."""
        job_id = f"retrain_{int(datetime.now().timestamp())}"
        
        # Determine priority based on trigger type
        priority_map = {
            RetrainingTrigger.MANUAL: 1,
            RetrainingTrigger.PERFORMANCE_DROP: 2,
            RetrainingTrigger.DATA_DRIFT: 3,
            RetrainingTrigger.SCHEDULED: 4,
            RetrainingTrigger.DATA_VOLUME: 5
        }
        
        job = RetrainingJob(
            job_id=job_id,
            trigger=trigger,
            model_types=model_types,
            priority=priority_map.get(trigger, 5),
            created_at=datetime.now(),
            config_overrides=config_overrides,
            metadata=metadata
        )
        
        # Add to queue
        self.job_queue.append(job)
        self.job_queue.sort(key=lambda x: x.priority)  # Sort by priority
        
        # Store job in database
        await self._store_retraining_job(job)
        
        logger.info(f"Triggered retraining job {job_id} for models {model_types} due to {trigger.value}")
        return job_id
    
    async def _process_job_queue(self):
        """Process the retraining job queue."""
        while self.is_running:
            try:
                # Check if we can start a new job
                if len(self.active_jobs) < self.max_concurrent_jobs and self.job_queue:
                    job = self.job_queue.pop(0)
                    
                    # Start job processing
                    self.active_jobs[job.job_id] = job
                    asyncio.create_task(self._execute_retraining_job(job))
                
                await asyncio.sleep(30)  # Check every 30 seconds
            
            except Exception as e:
                logger.error(f"Error in job queue processing: {e}")
                await asyncio.sleep(60)
    
    async def _execute_retraining_job(self, job: RetrainingJob):
        """Execute a retraining job."""
        try:
            logger.info(f"Starting retraining job {job.job_id}")
            
            # Update job status
            await self._update_job_status(job.job_id, 'running')
            
            # Apply config overrides
            if job.config_overrides:
                # This would update the trainer's configuration
                pass
            
            # Run training for each model type
            results = {}
            for model_type in job.model_types:
                try:
                    logger.info(f"Retraining {model_type} for job {job.job_id}")
                    
                    # Run training
                    if model_type == 'link_prediction':
                        result = await self.trainer.train_link_prediction()
                    elif model_type == 'expertise_recommendation':
                        result = await self.trainer.train_expertise_recommendation()
                    elif model_type == 'node_classification':
                        result = await self.trainer.train_node_classification()
                    else:
                        raise ValueError(f"Unknown model type: {model_type}")
                    
                    results[model_type] = {
                        'status': 'completed',
                        'metrics': result.get('metrics', {}),
                        'model_path': result.get('model_path', ''),
                        'training_time': result.get('training_time', 0)
                    }
                    
                    logger.info(f"Completed retraining {model_type} for job {job.job_id}")
                
                except Exception as e:
                    logger.error(f"Failed to retrain {model_type} for job {job.job_id}: {e}")
                    results[model_type] = {
                        'status': 'failed',
                        'error': str(e)
                    }
            
            # Update job with results
            await self._complete_retraining_job(job.job_id, results)
            
            # Notify completion callbacks
            for callback in self.completion_callbacks:
                try:
                    await callback(job.job_id, results)
                except Exception as e:
                    logger.error(f"Completion callback failed: {e}")
            
            logger.info(f"Completed retraining job {job.job_id}")
        
        except Exception as e:
            logger.error(f"Retraining job {job.job_id} failed: {e}")
            await self._update_job_status(job.job_id, 'failed', error=str(e))
        
        finally:
            # Remove from active jobs
            if job.job_id in self.active_jobs:
                del self.active_jobs[job.job_id]
    
    async def _store_retraining_job(self, job: RetrainingJob):
        """Store retraining job in database."""
        try:
            await self.supabase.client.table('ml_retraining_jobs').insert({
                'job_id': job.job_id,
                'trigger_type': job.trigger.value,
                'model_types': job.model_types,
                'priority': job.priority,
                'status': 'queued',
                'config_overrides': job.config_overrides,
                'metadata': job.metadata,
                'created_at': job.created_at.isoformat()
            }).execute()
        
        except Exception as e:
            logger.error(f"Failed to store retraining job: {e}")
    
    async def _update_job_status(self, job_id: str, status: str, error: Optional[str] = None):
        """Update job status in database."""
        try:
            update_data = {'status': status}
            
            if status == 'running':
                update_data['started_at'] = datetime.now().isoformat()
            elif status in ['completed', 'failed']:
                update_data['completed_at'] = datetime.now().isoformat()
                if error:
                    update_data['error_message'] = error
            
            await self.supabase.client.table('ml_retraining_jobs')\
                .update(update_data)\
                .eq('job_id', job_id)\
                .execute()
        
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")
    
    async def _complete_retraining_job(self, job_id: str, results: Dict[str, Any]):
        """Complete a retraining job with results."""
        try:
            await self.supabase.client.table('ml_retraining_jobs')\
                .update({
                    'status': 'completed',
                    'results': results,
                    'completed_at': datetime.now().isoformat()
                })\
                .eq('job_id', job_id)\
                .execute()
        
        except Exception as e:
            logger.error(f"Failed to complete retraining job: {e}")
    
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of a retraining job."""
        try:
            # Check active jobs first
            if job_id in self.active_jobs:
                job = self.active_jobs[job_id]
                return {
                    'job_id': job_id,
                    'status': 'running',
                    'trigger': job.trigger.value,
                    'model_types': job.model_types,
                    'created_at': job.created_at.isoformat()
                }
            
            # Check database
            result = await self.supabase.client.table('ml_retraining_jobs')\
                .select('*')\
                .eq('job_id', job_id)\
                .single()\
                .execute()
            
            if result.data:
                return result.data
            else:
                return {'job_id': job_id, 'status': 'not_found'}
        
        except Exception as e:
            logger.error(f"Failed to get job status: {e}")
            return {'job_id': job_id, 'status': 'error', 'error': str(e)}
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a queued retraining job."""
        try:
            # Remove from queue if present
            self.job_queue = [job for job in self.job_queue if job.job_id != job_id]
            
            # Update database
            await self.supabase.client.table('ml_retraining_jobs')\
                .update({
                    'status': 'cancelled',
                    'cancelled_at': datetime.now().isoformat()
                })\
                .eq('job_id', job_id)\
                .execute()
            
            logger.info(f"Cancelled retraining job {job_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to cancel job {job_id}: {e}")
            return False
    
    def add_completion_callback(self, callback: Callable):
        """Add a callback to be called when retraining jobs complete."""
        self.completion_callbacks.append(callback)
    
    def get_pipeline_status(self) -> Dict[str, Any]:
        """Get current pipeline status."""
        return {
            'is_running': self.is_running,
            'active_jobs': len(self.active_jobs),
            'queued_jobs': len(self.job_queue),
            'max_concurrent_jobs': self.max_concurrent_jobs,
            'config': self.config,
            'next_scheduled_jobs': [
                str(job) for job in schedule.jobs
            ]
        }
    
    async def get_retraining_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get retraining job history."""
        try:
            result = await self.supabase.client.table('ml_retraining_jobs')\
                .select('*')\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            
            return result.data or []
        
        except Exception as e:
            logger.error(f"Failed to get retraining history: {e}")
            return []
