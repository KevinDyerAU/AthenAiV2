import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from dataclasses import dataclass
from enum import Enum
import json
import torch
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest
from scipy import stats
import warnings

from utils.supabase_client import SupabaseClient
from utils.neo4j_client import Neo4jClient

logger = logging.getLogger(__name__)

class AlertSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class ModelAlert:
    alert_type: str
    severity: AlertSeverity
    message: str
    metric_name: str
    current_value: float
    threshold: float
    timestamp: datetime
    model_type: Optional[str] = None
    additional_data: Optional[Dict] = None

class ModelMonitor:
    """
    Comprehensive model monitoring and drift detection system.
    Tracks model performance, data drift, and system health.
    """
    
    def __init__(self, supabase_client: SupabaseClient, neo4j_client: Optional[Neo4jClient] = None):
        self.supabase = supabase_client
        self.neo4j = neo4j_client
        
        # Monitoring configuration
        self.monitoring_interval = 300  # 5 minutes
        self.drift_detection_window = 24  # hours
        self.performance_window = 1  # hour
        self.alert_cooldown = 3600  # 1 hour
        
        # Performance thresholds
        self.thresholds = {
            'accuracy_drop': 0.05,  # 5% drop in accuracy
            'latency_increase': 2.0,  # 2x increase in latency
            'error_rate': 0.1,  # 10% error rate
            'drift_score': 0.3,  # Drift detection threshold
            'memory_usage': 0.8,  # 80% memory usage
            'cpu_usage': 0.9  # 90% CPU usage
        }
        
        # Prometheus metrics
        self.registry = CollectorRegistry()
        self._setup_prometheus_metrics()
        
        # Monitoring state
        self.is_monitoring = False
        self.monitoring_task = None
        self.last_alerts = {}
        
        # Baseline data for drift detection
        self.baseline_data = {}
        self.reference_distributions = {}
        
        logger.info("ModelMonitor initialized")
    
    def _setup_prometheus_metrics(self):
        """Setup Prometheus metrics for monitoring."""
        self.metrics = {
            'predictions_total': Counter(
                'ml_predictions_total',
                'Total number of predictions made',
                ['model_type', 'prediction_type'],
                registry=self.registry
            ),
            'prediction_latency': Histogram(
                'ml_prediction_latency_seconds',
                'Prediction latency in seconds',
                ['model_type'],
                registry=self.registry
            ),
            'model_accuracy': Gauge(
                'ml_model_accuracy',
                'Current model accuracy',
                ['model_type'],
                registry=self.registry
            ),
            'drift_score': Gauge(
                'ml_data_drift_score',
                'Data drift score',
                ['model_type', 'feature_type'],
                registry=self.registry
            ),
            'error_rate': Gauge(
                'ml_error_rate',
                'Model error rate',
                ['model_type'],
                registry=self.registry
            ),
            'system_memory_usage': Gauge(
                'ml_system_memory_usage_ratio',
                'System memory usage ratio',
                registry=self.registry
            ),
            'active_models': Gauge(
                'ml_active_models',
                'Number of active models',
                registry=self.registry
            )
        }
    
    async def start_monitoring(self):
        """Start the monitoring loop."""
        if self.is_monitoring:
            logger.warning("Monitoring already started")
            return
        
        self.is_monitoring = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        
        # Initialize baseline data
        await self._initialize_baselines()
        
        logger.info("Model monitoring started")
    
    async def stop_monitoring(self):
        """Stop the monitoring loop."""
        if not self.is_monitoring:
            return
        
        self.is_monitoring = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Model monitoring stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop."""
        while self.is_monitoring:
            try:
                await self._run_monitoring_cycle()
                await asyncio.sleep(self.monitoring_interval)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitoring cycle failed: {e}")
                await asyncio.sleep(self.monitoring_interval)
    
    async def _run_monitoring_cycle(self):
        """Run a single monitoring cycle."""
        logger.debug("Running monitoring cycle")
        
        # Check model performance
        await self._check_model_performance()
        
        # Check data drift
        await self._check_data_drift()
        
        # Check system health
        await self._check_system_health()
        
        # Update Prometheus metrics
        await self._update_prometheus_metrics()
        
        # Clean up old alerts
        await self._cleanup_old_alerts()
    
    async def _check_model_performance(self):
        """Check model performance metrics."""
        try:
            # Get recent predictions and their outcomes
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=self.performance_window)
            
            # Query recent predictions from database
            predictions_result = await self.supabase.client.table('ml_model_predictions')\
                .select('*')\
                .gte('created_at', start_time.isoformat())\
                .lte('created_at', end_time.isoformat())\
                .execute()
            
            if not predictions_result.data:
                logger.debug("No recent predictions found for performance monitoring")
                return
            
            predictions_df = pd.DataFrame(predictions_result.data)
            
            # Group by model type
            for model_type in predictions_df['model_type'].unique():
                model_predictions = predictions_df[predictions_df['model_type'] == model_type]
                
                # Calculate performance metrics
                await self._calculate_performance_metrics(model_type, model_predictions)
        
        except Exception as e:
            logger.error(f"Failed to check model performance: {e}")
    
    async def _calculate_performance_metrics(self, model_type: str, predictions_df: pd.DataFrame):
        """Calculate performance metrics for a specific model."""
        try:
            # Calculate average confidence
            avg_confidence = predictions_df['confidence'].mean()
            
            # Calculate error rate (predictions with very low confidence)
            low_confidence_threshold = 0.3
            error_rate = (predictions_df['confidence'] < low_confidence_threshold).mean()
            
            # Calculate average processing time
            avg_processing_time = predictions_df['processing_time_ms'].mean() / 1000.0  # Convert to seconds
            
            # Update Prometheus metrics
            self.metrics['error_rate'].labels(model_type=model_type).set(error_rate)
            self.metrics['model_accuracy'].labels(model_type=model_type).set(avg_confidence)
            
            # Check thresholds and create alerts
            if error_rate > self.thresholds['error_rate']:
                await self._create_alert(
                    alert_type='high_error_rate',
                    severity=AlertSeverity.HIGH,
                    message=f"High error rate detected for {model_type}: {error_rate:.2%}",
                    metric_name='error_rate',
                    current_value=error_rate,
                    threshold=self.thresholds['error_rate'],
                    model_type=model_type
                )
            
            # Check for performance degradation
            if model_type in self.baseline_data:
                baseline_confidence = self.baseline_data[model_type].get('avg_confidence', avg_confidence)
                confidence_drop = baseline_confidence - avg_confidence
                
                if confidence_drop > self.thresholds['accuracy_drop']:
                    await self._create_alert(
                        alert_type='accuracy_drop',
                        severity=AlertSeverity.MEDIUM,
                        message=f"Accuracy drop detected for {model_type}: {confidence_drop:.2%}",
                        metric_name='accuracy_drop',
                        current_value=confidence_drop,
                        threshold=self.thresholds['accuracy_drop'],
                        model_type=model_type
                    )
            
            # Check latency increase
            if model_type in self.baseline_data:
                baseline_latency = self.baseline_data[model_type].get('avg_processing_time', avg_processing_time)
                latency_ratio = avg_processing_time / max(baseline_latency, 0.001)  # Avoid division by zero
                
                if latency_ratio > self.thresholds['latency_increase']:
                    await self._create_alert(
                        alert_type='latency_increase',
                        severity=AlertSeverity.MEDIUM,
                        message=f"Latency increase detected for {model_type}: {latency_ratio:.1f}x",
                        metric_name='latency_increase',
                        current_value=latency_ratio,
                        threshold=self.thresholds['latency_increase'],
                        model_type=model_type
                    )
        
        except Exception as e:
            logger.error(f"Failed to calculate performance metrics for {model_type}: {e}")
    
    async def _check_data_drift(self):
        """Check for data drift in input features."""
        try:
            # Get recent prediction inputs
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=self.drift_detection_window)
            
            predictions_result = await self.supabase.client.table('ml_model_predictions')\
                .select('input_data, model_type, created_at')\
                .gte('created_at', start_time.isoformat())\
                .lte('created_at', end_time.isoformat())\
                .execute()
            
            if not predictions_result.data:
                return
            
            predictions_df = pd.DataFrame(predictions_result.data)
            
            # Group by model type and check drift
            for model_type in predictions_df['model_type'].unique():
                model_predictions = predictions_df[predictions_df['model_type'] == model_type]
                await self._detect_drift_for_model(model_type, model_predictions)
        
        except Exception as e:
            logger.error(f"Failed to check data drift: {e}")
    
    async def _detect_drift_for_model(self, model_type: str, predictions_df: pd.DataFrame):
        """Detect data drift for a specific model."""
        try:
            if model_type not in self.reference_distributions:
                logger.debug(f"No reference distribution for {model_type}, skipping drift detection")
                return
            
            # Extract features from input data
            current_features = []
            for _, row in predictions_df.iterrows():
                input_data = row['input_data']
                if isinstance(input_data, str):
                    input_data = json.loads(input_data)
                
                # Extract numerical features (simplified)
                features = self._extract_numerical_features(input_data)
                if features:
                    current_features.append(features)
            
            if not current_features:
                return
            
            current_features = np.array(current_features)
            reference_features = self.reference_distributions[model_type]
            
            # Calculate drift score using KL divergence or KS test
            drift_scores = []
            
            for i in range(min(current_features.shape[1], reference_features.shape[1])):
                current_feature = current_features[:, i]
                reference_feature = reference_features[:, i]
                
                # Use Kolmogorov-Smirnov test for drift detection
                ks_statistic, p_value = stats.ks_2samp(reference_feature, current_feature)
                drift_scores.append(ks_statistic)
            
            avg_drift_score = np.mean(drift_scores) if drift_scores else 0
            
            # Update Prometheus metric
            self.metrics['drift_score'].labels(
                model_type=model_type, 
                feature_type='input_features'
            ).set(avg_drift_score)
            
            # Check drift threshold
            if avg_drift_score > self.thresholds['drift_score']:
                await self._create_alert(
                    alert_type='data_drift',
                    severity=AlertSeverity.HIGH,
                    message=f"Data drift detected for {model_type}: score {avg_drift_score:.3f}",
                    metric_name='drift_score',
                    current_value=avg_drift_score,
                    threshold=self.thresholds['drift_score'],
                    model_type=model_type,
                    additional_data={'feature_drift_scores': drift_scores}
                )
        
        except Exception as e:
            logger.error(f"Failed to detect drift for {model_type}: {e}")
    
    def _extract_numerical_features(self, input_data: Dict) -> Optional[List[float]]:
        """Extract numerical features from input data."""
        features = []
        
        try:
            # Extract common numerical features
            if 'confidence_threshold' in input_data:
                features.append(float(input_data['confidence_threshold']))
            
            if 'max_experts' in input_data:
                features.append(float(input_data['max_experts']))
            
            # Extract text-based features (length, word count, etc.)
            for key in ['topic', 'source', 'target']:
                if key in input_data and isinstance(input_data[key], str):
                    text = input_data[key]
                    features.extend([
                        len(text),  # Character length
                        len(text.split()),  # Word count
                        len(set(text.lower().split()))  # Unique word count
                    ])
            
            return features if features else None
        
        except Exception as e:
            logger.error(f"Failed to extract numerical features: {e}")
            return None
    
    async def _check_system_health(self):
        """Check system health metrics."""
        try:
            import psutil
            
            # Get system metrics
            memory_usage = psutil.virtual_memory().percent / 100.0
            cpu_usage = psutil.cpu_percent() / 100.0
            
            # Update Prometheus metrics
            self.metrics['system_memory_usage'].set(memory_usage)
            
            # Check thresholds
            if memory_usage > self.thresholds['memory_usage']:
                await self._create_alert(
                    alert_type='high_memory_usage',
                    severity=AlertSeverity.HIGH,
                    message=f"High memory usage: {memory_usage:.1%}",
                    metric_name='memory_usage',
                    current_value=memory_usage,
                    threshold=self.thresholds['memory_usage']
                )
            
            if cpu_usage > self.thresholds['cpu_usage']:
                await self._create_alert(
                    alert_type='high_cpu_usage',
                    severity=AlertSeverity.HIGH,
                    message=f"High CPU usage: {cpu_usage:.1%}",
                    metric_name='cpu_usage',
                    current_value=cpu_usage,
                    threshold=self.thresholds['cpu_usage']
                )
        
        except ImportError:
            logger.warning("psutil not available, skipping system health checks")
        except Exception as e:
            logger.error(f"Failed to check system health: {e}")
    
    async def _update_prometheus_metrics(self):
        """Update Prometheus metrics with current values."""
        try:
            # Count active models (simplified)
            active_models = len(self.baseline_data)
            self.metrics['active_models'].set(active_models)
            
            # Update prediction counters from recent data
            end_time = datetime.now()
            start_time = end_time - timedelta(minutes=self.monitoring_interval // 60)
            
            predictions_result = await self.supabase.client.table('ml_model_predictions')\
                .select('model_type, prediction')\
                .gte('created_at', start_time.isoformat())\
                .lte('created_at', end_time.isoformat())\
                .execute()
            
            if predictions_result.data:
                predictions_df = pd.DataFrame(predictions_result.data)
                
                for model_type in predictions_df['model_type'].unique():
                    count = len(predictions_df[predictions_df['model_type'] == model_type])
                    
                    # This is a simplified way to update counters
                    # In practice, you'd increment counters as predictions are made
                    self.metrics['predictions_total'].labels(
                        model_type=model_type,
                        prediction_type='batch'
                    )._value._value += count
        
        except Exception as e:
            logger.error(f"Failed to update Prometheus metrics: {e}")
    
    async def _create_alert(self, alert_type: str, severity: AlertSeverity, message: str,
                           metric_name: str, current_value: float, threshold: float,
                           model_type: Optional[str] = None, additional_data: Optional[Dict] = None):
        """Create and store an alert."""
        try:
            # Check alert cooldown
            alert_key = f"{alert_type}_{model_type or 'system'}"
            now = datetime.now()
            
            if alert_key in self.last_alerts:
                time_since_last = (now - self.last_alerts[alert_key]).total_seconds()
                if time_since_last < self.alert_cooldown:
                    return  # Skip alert due to cooldown
            
            alert = ModelAlert(
                alert_type=alert_type,
                severity=severity,
                message=message,
                metric_name=metric_name,
                current_value=current_value,
                threshold=threshold,
                timestamp=now,
                model_type=model_type,
                additional_data=additional_data
            )
            
            # Store alert in database
            await self.supabase.create_alert(
                alert_type=alert_type,
                severity=severity.value,
                message=message,
                metadata={
                    'metric_name': metric_name,
                    'current_value': current_value,
                    'threshold': threshold,
                    'model_type': model_type,
                    'additional_data': additional_data
                }
            )
            
            # Update last alert time
            self.last_alerts[alert_key] = now
            
            logger.warning(f"Alert created: {alert.message}")
        
        except Exception as e:
            logger.error(f"Failed to create alert: {e}")
    
    async def _initialize_baselines(self):
        """Initialize baseline data for drift detection."""
        try:
            # Get historical data for baseline
            end_time = datetime.now() - timedelta(days=1)  # Start from 1 day ago
            start_time = end_time - timedelta(days=7)  # Use 7 days of historical data
            
            predictions_result = await self.supabase.client.table('ml_model_predictions')\
                .select('*')\
                .gte('created_at', start_time.isoformat())\
                .lte('created_at', end_time.isoformat())\
                .execute()
            
            if not predictions_result.data:
                logger.warning("No historical data found for baseline initialization")
                return
            
            predictions_df = pd.DataFrame(predictions_result.data)
            
            # Create baselines for each model type
            for model_type in predictions_df['model_type'].unique():
                model_predictions = predictions_df[predictions_df['model_type'] == model_type]
                
                # Calculate baseline performance metrics
                self.baseline_data[model_type] = {
                    'avg_confidence': model_predictions['confidence'].mean(),
                    'avg_processing_time': model_predictions['processing_time_ms'].mean() / 1000.0,
                    'prediction_count': len(model_predictions),
                    'created_at': datetime.now().isoformat()
                }
                
                # Create reference distribution for drift detection
                features = []
                for _, row in model_predictions.iterrows():
                    input_data = row['input_data']
                    if isinstance(input_data, str):
                        input_data = json.loads(input_data)
                    
                    feature_vector = self._extract_numerical_features(input_data)
                    if feature_vector:
                        features.append(feature_vector)
                
                if features:
                    self.reference_distributions[model_type] = np.array(features)
            
            logger.info(f"Initialized baselines for {len(self.baseline_data)} model types")
        
        except Exception as e:
            logger.error(f"Failed to initialize baselines: {e}")
    
    async def _cleanup_old_alerts(self):
        """Clean up old alerts from database."""
        try:
            cutoff_time = datetime.now() - timedelta(days=30)
            
            await self.supabase.client.table('ml_alerts')\
                .delete()\
                .lt('created_at', cutoff_time.isoformat())\
                .execute()
        
        except Exception as e:
            logger.error(f"Failed to cleanup old alerts: {e}")
    
    async def get_model_status(self) -> Dict[str, Any]:
        """Get current model status and metrics."""
        try:
            # Get recent alerts
            recent_alerts = await self.supabase.get_recent_alerts(limit=10)
            
            # Get system metrics
            system_metrics = {}
            try:
                import psutil
                system_metrics = {
                    'memory_usage': psutil.virtual_memory().percent / 100.0,
                    'cpu_usage': psutil.cpu_percent() / 100.0,
                    'disk_usage': psutil.disk_usage('/').percent / 100.0
                }
            except ImportError:
                pass
            
            return {
                'monitoring_active': self.is_monitoring,
                'baseline_models': list(self.baseline_data.keys()),
                'recent_alerts': recent_alerts,
                'system_metrics': system_metrics,
                'thresholds': self.thresholds,
                'monitoring_config': {
                    'interval_seconds': self.monitoring_interval,
                    'drift_window_hours': self.drift_detection_window,
                    'performance_window_hours': self.performance_window
                }
            }
        
        except Exception as e:
            logger.error(f"Failed to get model status: {e}")
            return {'error': str(e)}
    
    async def get_prometheus_metrics(self) -> str:
        """Get Prometheus-formatted metrics."""
        try:
            return generate_latest(self.registry).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to generate Prometheus metrics: {e}")
            return f"# Error generating metrics: {e}\n"
    
    def log_request(self, prediction_type: str, request_data: Dict):
        """Log a prediction request for monitoring."""
        try:
            model_type = self._infer_model_type(prediction_type)
            self.metrics['predictions_total'].labels(
                model_type=model_type,
                prediction_type=prediction_type
            ).inc()
        except Exception as e:
            logger.error(f"Failed to log request: {e}")
    
    def log_response(self, prediction_type: str, response_data: Dict):
        """Log a prediction response for monitoring."""
        try:
            model_type = self._infer_model_type(prediction_type)
            
            # Log latency if available
            if 'processing_time_ms' in response_data:
                latency_seconds = response_data['processing_time_ms'] / 1000.0
                self.metrics['prediction_latency'].labels(model_type=model_type).observe(latency_seconds)
        except Exception as e:
            logger.error(f"Failed to log response: {e}")
    
    def log_error(self, prediction_type: str, error_message: str):
        """Log a prediction error for monitoring."""
        try:
            model_type = self._infer_model_type(prediction_type)
            logger.error(f"Prediction error for {model_type}: {error_message}")
        except Exception as e:
            logger.error(f"Failed to log error: {e}")
    
    def _infer_model_type(self, prediction_type: str) -> str:
        """Infer model type from prediction type."""
        if 'expertise' in prediction_type:
            return 'expertise_recommendation'
        elif 'link' in prediction_type:
            return 'link_prediction'
        elif 'classification' in prediction_type:
            return 'node_classification'
        else:
            return 'unknown'
