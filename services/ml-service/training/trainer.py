import torch
import torch.nn.functional as F
from torch_geometric.loader import DataLoader
import mlflow
import mlflow.pytorch
from datetime import datetime
import yaml
import os
import asyncio
import logging
from typing import Dict, Any, Tuple, Optional
import numpy as np
from pathlib import Path

from models.link_prediction import LinkPredictionGNN, ExpertiseRecommendationGNN, create_model
from models.node_classification import create_classification_model
from training.data_loader import GraphDataLoader
from training.evaluation import ModelEvaluator
from utils.neo4j_client import Neo4jClient
from utils.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)

class MLTrainingOrchestrator:
    """
    Orchestrates the complete ML training pipeline with MLflow tracking.
    """
    
    def __init__(self, config_path: str = "config/training_config.yaml"):
        # Load configuration
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        # Initialize clients
        self.neo4j_client = Neo4jClient()
        self.supabase_client = SupabaseClient()
        self.data_loader = GraphDataLoader(
            self.neo4j_client, 
            self.supabase_client, 
            self.config['data']
        )
        self.evaluator = ModelEvaluator()
        
        # Setup MLflow
        mlflow_uri = os.getenv('MLFLOW_TRACKING_URI', self.config['mlflow']['tracking_uri'])
        mlflow.set_tracking_uri(mlflow_uri)
        mlflow.set_experiment(self.config['mlflow']['experiment_name'])
        
        # Create model directory
        self.model_dir = Path("models")
        self.model_dir.mkdir(exist_ok=True)
        
        logger.info("MLTrainingOrchestrator initialized successfully")
    
    async def train_link_prediction_model(self) -> Tuple[torch.nn.Module, Dict[str, float]]:
        """Train a link prediction model with full MLflow tracking."""
        
        run_name = f"link_prediction_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with mlflow.start_run(run_name=run_name):
            try:
                # Log hyperparameters
                mlflow.log_params(self.config['model'])
                mlflow.log_params(self.config['training'])
                
                # Store training run in Supabase
                run_id = mlflow.active_run().info.run_id
                await self.supabase_client.store_ml_training_run({
                    'run_id': run_id,
                    'model_type': 'link_prediction',
                    'hyperparameters': {**self.config['model'], **self.config['training']},
                    'metrics': {},
                    'status': 'running',
                    'started_at': datetime.now().isoformat()
                })
                
                # Load and prepare data
                logger.info("Loading graph data from Neo4j...")
                data = await self.data_loader.load_link_prediction_data()
                
                # Split data
                train_data, val_data, test_data = self.data_loader.create_data_splits(
                    data, 
                    self.config['data']['train_ratio'],
                    self.config['data']['val_ratio']
                )
                
                # Initialize model
                model = create_model('link_prediction', self.config['model'])
                optimizer = self._create_optimizer(model)
                scheduler = self._create_scheduler(optimizer)
                
                # Training loop
                best_val_auc = 0
                patience_counter = 0
                training_history = []
                
                logger.info(f"Starting training for {self.config['training']['max_epochs']} epochs...")
                
                for epoch in range(self.config['training']['max_epochs']):
                    # Training
                    model.train()
                    train_loss = self._train_epoch(model, optimizer, train_data)
                    
                    # Validation
                    model.eval()
                    with torch.no_grad():
                        val_metrics = await self.evaluator.evaluate_link_prediction(model, val_data)
                    
                    # Learning rate scheduling
                    if scheduler:
                        scheduler.step(val_metrics['auc'])
                    
                    # Logging
                    epoch_metrics = {
                        'epoch': epoch,
                        'train_loss': train_loss,
                        'val_auc': val_metrics['auc'],
                        'val_ap': val_metrics['average_precision'],
                        'learning_rate': optimizer.param_groups[0]['lr']
                    }
                    
                    training_history.append(epoch_metrics)
                    
                    mlflow.log_metrics({
                        'train_loss': train_loss,
                        'val_auc': val_metrics['auc'],
                        'val_ap': val_metrics['average_precision'],
                        'learning_rate': optimizer.param_groups[0]['lr']
                    }, step=epoch)
                    
                    if epoch % self.config['monitoring']['log_interval'] == 0:
                        logger.info(f"Epoch {epoch}: Train Loss: {train_loss:.4f}, Val AUC: {val_metrics['auc']:.4f}")
                    
                    # Early stopping and model saving
                    if val_metrics['auc'] > best_val_auc:
                        best_val_auc = val_metrics['auc']
                        patience_counter = 0
                        
                        # Save best model
                        model_path = self.model_dir / f"link_prediction_best_{run_id}.pt"
                        torch.save(model.state_dict(), model_path)
                        mlflow.log_artifact(str(model_path))
                        
                        # Log as MLflow model
                        mlflow.pytorch.log_model(model, "best_model")
                        
                    else:
                        patience_counter += 1
                        if patience_counter >= self.config['training']['patience']:
                            logger.info(f"Early stopping at epoch {epoch}")
                            break
                
                # Final evaluation on test set
                logger.info("Evaluating on test set...")
                test_metrics = await self.evaluator.evaluate_link_prediction(model, test_data)
                
                # Log final metrics
                final_metrics = {
                    'test_auc': test_metrics['auc'],
                    'test_ap': test_metrics['average_precision'],
                    'test_precision': test_metrics['precision'],
                    'test_recall': test_metrics['recall'],
                    'test_f1': test_metrics['f1'],
                    'best_val_auc': best_val_auc,
                    'total_epochs': epoch + 1
                }
                
                mlflow.log_metrics(final_metrics)
                
                # Update training run status
                await self.supabase_client.update_training_run_status(
                    run_id, 'completed', final_metrics
                )
                
                logger.info(f"Training completed. Test AUC: {test_metrics['auc']:.4f}")
                
                return model, test_metrics
                
            except Exception as e:
                logger.error(f"Training failed: {e}")
                # Update training run status
                if 'run_id' in locals():
                    await self.supabase_client.update_training_run_status(
                        run_id, 'failed'
                    )
                raise
    
    async def train_node_classification_model(self) -> Tuple[torch.nn.Module, Dict[str, float]]:
        """Train a node classification model."""
        
        run_name = f"node_classification_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with mlflow.start_run(run_name=run_name):
            try:
                # Log parameters
                mlflow.log_params(self.config['model'])
                mlflow.log_params(self.config['training'])
                
                # Load data
                logger.info("Loading node classification data...")
                data = await self.data_loader.load_node_classification_data()
                
                # Split data
                train_data, val_data, test_data = self.data_loader.create_data_splits(data)
                
                # Initialize model
                classification_config = {**self.config['model'], 'num_classes': data.num_classes}
                model = create_classification_model('document_classification', classification_config)
                optimizer = self._create_optimizer(model)
                scheduler = self._create_scheduler(optimizer)
                
                # Training loop
                best_val_acc = 0
                patience_counter = 0
                
                for epoch in range(self.config['training']['max_epochs']):
                    # Training
                    model.train()
                    train_loss = self._train_classification_epoch(model, optimizer, train_data)
                    
                    # Validation
                    model.eval()
                    with torch.no_grad():
                        val_metrics = await self.evaluator.evaluate_node_classification(model, val_data)
                    
                    # Scheduling
                    if scheduler:
                        scheduler.step(val_metrics['accuracy'])
                    
                    # Logging
                    mlflow.log_metrics({
                        'train_loss': train_loss,
                        'val_accuracy': val_metrics['accuracy'],
                        'val_f1': val_metrics['f1_macro']
                    }, step=epoch)
                    
                    if epoch % self.config['monitoring']['log_interval'] == 0:
                        logger.info(f"Epoch {epoch}: Train Loss: {train_loss:.4f}, Val Acc: {val_metrics['accuracy']:.4f}")
                    
                    # Early stopping
                    if val_metrics['accuracy'] > best_val_acc:
                        best_val_acc = val_metrics['accuracy']
                        patience_counter = 0
                        
                        # Save best model
                        model_path = self.model_dir / f"node_classification_best_{mlflow.active_run().info.run_id}.pt"
                        torch.save(model.state_dict(), model_path)
                        mlflow.log_artifact(str(model_path))
                        
                    else:
                        patience_counter += 1
                        if patience_counter >= self.config['training']['patience']:
                            logger.info(f"Early stopping at epoch {epoch}")
                            break
                
                # Final evaluation
                test_metrics = await self.evaluator.evaluate_node_classification(model, test_data)
                
                mlflow.log_metrics({
                    'test_accuracy': test_metrics['accuracy'],
                    'test_f1_macro': test_metrics['f1_macro'],
                    'test_f1_micro': test_metrics['f1_micro']
                })
                
                logger.info(f"Node classification training completed. Test Accuracy: {test_metrics['accuracy']:.4f}")
                
                return model, test_metrics
                
            except Exception as e:
                logger.error(f"Node classification training failed: {e}")
                raise
    
    async def train_expertise_recommendation_model(self) -> Tuple[torch.nn.Module, Dict[str, float]]:
        """Train an expertise recommendation model."""
        
        run_name = f"expertise_recommendation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with mlflow.start_run(run_name=run_name):
            try:
                # Log parameters
                mlflow.log_params(self.config['model'])
                mlflow.log_params(self.config['training'])
                
                # Load expertise data
                logger.info("Loading expertise prediction data...")
                data = await self.data_loader.load_expertise_prediction_data()
                
                # Split data
                train_data, val_data, test_data = self.data_loader.create_data_splits(data)
                
                # Initialize expertise model
                model = create_model('expertise_recommendation', self.config['model'])
                optimizer = self._create_optimizer(model)
                scheduler = self._create_scheduler(optimizer)
                
                # Training loop
                best_val_score = 0
                patience_counter = 0
                
                for epoch in range(self.config['training']['max_epochs']):
                    # Training
                    model.train()
                    train_loss = self._train_expertise_epoch(model, optimizer, train_data)
                    
                    # Validation
                    model.eval()
                    with torch.no_grad():
                        val_metrics = await self.evaluator.evaluate_expertise_prediction(model, val_data)
                    
                    # Scheduling
                    if scheduler:
                        scheduler.step(val_metrics['ndcg'])
                    
                    # Logging
                    mlflow.log_metrics({
                        'train_loss': train_loss,
                        'val_ndcg': val_metrics['ndcg'],
                        'val_map': val_metrics['map']
                    }, step=epoch)
                    
                    if epoch % self.config['monitoring']['log_interval'] == 0:
                        logger.info(f"Epoch {epoch}: Train Loss: {train_loss:.4f}, Val NDCG: {val_metrics['ndcg']:.4f}")
                    
                    # Early stopping
                    if val_metrics['ndcg'] > best_val_score:
                        best_val_score = val_metrics['ndcg']
                        patience_counter = 0
                        
                        # Save best model
                        model_path = self.model_dir / f"expertise_recommendation_best_{mlflow.active_run().info.run_id}.pt"
                        torch.save(model.state_dict(), model_path)
                        mlflow.log_artifact(str(model_path))
                        
                    else:
                        patience_counter += 1
                        if patience_counter >= self.config['training']['patience']:
                            logger.info(f"Early stopping at epoch {epoch}")
                            break
                
                # Final evaluation
                test_metrics = await self.evaluator.evaluate_expertise_prediction(model, test_data)
                
                mlflow.log_metrics({
                    'test_ndcg': test_metrics['ndcg'],
                    'test_map': test_metrics['map'],
                    'test_precision_at_5': test_metrics['precision_at_5']
                })
                
                logger.info(f"Expertise recommendation training completed. Test NDCG: {test_metrics['ndcg']:.4f}")
                
                return model, test_metrics
                
            except Exception as e:
                logger.error(f"Expertise recommendation training failed: {e}")
                raise
    
    def _create_optimizer(self, model: torch.nn.Module) -> torch.optim.Optimizer:
        """Create optimizer based on configuration."""
        
        optimizer_config = self.config['training']
        
        if self.config.get('optimizer', {}).get('type', 'adam').lower() == 'adam':
            return torch.optim.Adam(
                model.parameters(),
                lr=optimizer_config['learning_rate'],
                weight_decay=optimizer_config['weight_decay'],
                betas=self.config.get('optimizer', {}).get('betas', [0.9, 0.999]),
                eps=self.config.get('optimizer', {}).get('eps', 1e-8)
            )
        else:
            return torch.optim.SGD(
                model.parameters(),
                lr=optimizer_config['learning_rate'],
                weight_decay=optimizer_config['weight_decay'],
                momentum=0.9
            )
    
    def _create_scheduler(self, optimizer: torch.optim.Optimizer) -> Optional[torch.optim.lr_scheduler._LRScheduler]:
        """Create learning rate scheduler based on configuration."""
        
        scheduler_config = self.config.get('scheduler', {})
        
        if scheduler_config.get('type') == 'reduce_on_plateau':
            return torch.optim.lr_scheduler.ReduceLROnPlateau(
                optimizer,
                mode='max',
                factor=scheduler_config.get('factor', 0.5),
                patience=scheduler_config.get('patience', 10),
                min_lr=scheduler_config.get('min_lr', 1e-6)
            )
        elif scheduler_config.get('type') == 'cosine':
            return torch.optim.lr_scheduler.CosineAnnealingLR(
                optimizer,
                T_max=self.config['training']['max_epochs']
            )
        else:
            return None
    
    def _train_epoch(self, model: torch.nn.Module, 
                    optimizer: torch.optim.Optimizer, 
                    data) -> float:
        """Train for one epoch (link prediction)."""
        
        model.train()
        optimizer.zero_grad()
        
        # Forward pass
        out = model(data.x, data.edge_index, data.edge_label_index)
        loss = F.binary_cross_entropy_with_logits(out, data.edge_label)
        
        # Backward pass
        loss.backward()
        
        # Gradient clipping
        if self.config['training'].get('gradient_clip'):
            torch.nn.utils.clip_grad_norm_(
                model.parameters(), 
                self.config['training']['gradient_clip']
            )
        
        optimizer.step()
        
        return loss.item()
    
    def _train_classification_epoch(self, model: torch.nn.Module, 
                                  optimizer: torch.optim.Optimizer, 
                                  data) -> float:
        """Train for one epoch (node classification)."""
        
        model.train()
        optimizer.zero_grad()
        
        # Forward pass
        out = model(data.x, data.edge_index)
        
        # Use training mask if available
        if hasattr(data, 'train_mask'):
            loss = F.cross_entropy(out[data.train_mask], data.y[data.train_mask])
        else:
            loss = F.cross_entropy(out, data.y)
        
        # Backward pass
        loss.backward()
        
        # Gradient clipping
        if self.config['training'].get('gradient_clip'):
            torch.nn.utils.clip_grad_norm_(
                model.parameters(), 
                self.config['training']['gradient_clip']
            )
        
        optimizer.step()
        
        return loss.item()
    
    def _train_expertise_epoch(self, model: torch.nn.Module, 
                             optimizer: torch.optim.Optimizer, 
                             data) -> float:
        """Train for one epoch (expertise prediction)."""
        
        model.train()
        optimizer.zero_grad()
        
        # Forward pass for expertise prediction
        if hasattr(data, 'expertise_edge_index') and data.expertise_edge_index.size(1) > 0:
            # Encode nodes
            node_embeddings = model.encode(data.x, data.edge_index)
            
            # Predict expertise
            person_embeddings = node_embeddings[data.expertise_edge_index[0]]
            topic_embeddings = node_embeddings[data.expertise_edge_index[1]]
            
            expertise_scores = model.predict_expertise(person_embeddings, topic_embeddings)
            
            # Loss calculation
            loss = F.mse_loss(expertise_scores, data.expertise_edge_labels)
        else:
            # Fallback to regular link prediction if no expertise edges
            out = model(data.x, data.edge_index, data.edge_label_index)
            loss = F.binary_cross_entropy_with_logits(out, data.edge_label)
        
        # Backward pass
        loss.backward()
        
        # Gradient clipping
        if self.config['training'].get('gradient_clip'):
            torch.nn.utils.clip_grad_norm_(
                model.parameters(), 
                self.config['training']['gradient_clip']
            )
        
        optimizer.step()
        
        return loss.item()
    
    async def run_training_pipeline(self, model_types: list = None) -> Dict[str, Any]:
        """Run complete training pipeline for specified model types."""
        
        if model_types is None:
            model_types = ['link_prediction', 'node_classification', 'expertise_recommendation']
        
        results = {}
        
        for model_type in model_types:
            try:
                logger.info(f"Starting training for {model_type}")
                
                if model_type == 'link_prediction':
                    model, metrics = await self.train_link_prediction_model()
                elif model_type == 'node_classification':
                    model, metrics = await self.train_node_classification_model()
                elif model_type == 'expertise_recommendation':
                    model, metrics = await self.train_expertise_recommendation_model()
                else:
                    logger.warning(f"Unknown model type: {model_type}")
                    continue
                
                results[model_type] = {
                    'model': model,
                    'metrics': metrics,
                    'status': 'completed'
                }
                
                logger.info(f"Completed training for {model_type}")
                
            except Exception as e:
                logger.error(f"Failed to train {model_type}: {e}")
                results[model_type] = {
                    'model': None,
                    'metrics': {},
                    'status': 'failed',
                    'error': str(e)
                }
        
        return results
    
    async def get_training_statistics(self) -> Dict[str, Any]:
        """Get comprehensive training statistics."""
        
        try:
            # Data statistics
            data_stats = await self.data_loader.get_data_statistics()
            
            # MLflow experiments
            experiment = mlflow.get_experiment_by_name(self.config['mlflow']['experiment_name'])
            runs = mlflow.search_runs(experiment_ids=[experiment.experiment_id])
            
            # Recent training runs from Supabase
            recent_runs = await self.supabase_client.table('ml_training_runs')\
                .select('*')\
                .order('started_at', desc=True)\
                .limit(10)\
                .execute()
            
            return {
                'data_statistics': data_stats,
                'total_mlflow_runs': len(runs) if runs is not None else 0,
                'recent_runs': recent_runs.data if recent_runs.data else [],
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get training statistics: {e}")
            return {}
    
    def close(self):
        """Clean up resources."""
        if hasattr(self, 'data_loader'):
            self.data_loader.close()
        if hasattr(self, 'neo4j_client'):
            self.neo4j_client.close()
        logger.info("MLTrainingOrchestrator closed")

if __name__ == "__main__":
    async def main():
        trainer = MLTrainingOrchestrator()
        try:
            # Run training pipeline
            results = await trainer.run_training_pipeline(['link_prediction'])
            
            for model_type, result in results.items():
                if result['status'] == 'completed':
                    print(f"{model_type} training completed successfully")
                    print(f"Metrics: {result['metrics']}")
                else:
                    print(f"{model_type} training failed: {result.get('error', 'Unknown error')}")
        
        finally:
            trainer.close()
    
    asyncio.run(main())
