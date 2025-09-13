import torch
import torch.nn.functional as F
import numpy as np
from sklearn.metrics import (
    roc_auc_score, average_precision_score, precision_recall_fscore_support,
    accuracy_score, classification_report, confusion_matrix
)
from typing import Dict, List, Any, Tuple
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class ModelEvaluator:
    """
    Comprehensive model evaluation framework for GNN models.
    """
    
    def __init__(self):
        self.evaluation_history = []
        logger.info("ModelEvaluator initialized")
    
    async def evaluate_link_prediction(self, model: torch.nn.Module, data) -> Dict[str, float]:
        """Evaluate link prediction model performance."""
        
        model.eval()
        
        with torch.no_grad():
            # Get predictions
            logits = model(data.x, data.edge_index, data.edge_label_index)
            probabilities = torch.sigmoid(logits)
            
            # Convert to numpy for sklearn metrics
            y_true = data.edge_label.cpu().numpy()
            y_prob = probabilities.cpu().numpy()
            y_pred = (y_prob > 0.5).astype(int)
            
            # Calculate metrics
            auc = roc_auc_score(y_true, y_prob)
            ap = average_precision_score(y_true, y_prob)
            precision, recall, f1, _ = precision_recall_fscore_support(
                y_true, y_pred, average='binary', zero_division=0
            )
            
            metrics = {
                'auc': float(auc),
                'average_precision': float(ap),
                'precision': float(precision),
                'recall': float(recall),
                'f1': float(f1),
                'accuracy': float(accuracy_score(y_true, y_pred))
            }
            
            # Store evaluation
            self.evaluation_history.append({
                'model_type': 'link_prediction',
                'metrics': metrics,
                'timestamp': datetime.now().isoformat()
            })
            
            return metrics
    
    async def evaluate_node_classification(self, model: torch.nn.Module, data) -> Dict[str, float]:
        """Evaluate node classification model performance."""
        
        model.eval()
        
        with torch.no_grad():
            # Get predictions
            logits = model(data.x, data.edge_index)
            probabilities = F.softmax(logits, dim=1)
            predictions = torch.argmax(probabilities, dim=1)
            
            # Use appropriate mask for evaluation
            if hasattr(data, 'test_mask'):
                mask = data.test_mask
            elif hasattr(data, 'val_mask'):
                mask = data.val_mask
            else:
                mask = torch.ones(data.y.size(0), dtype=torch.bool)
            
            # Convert to numpy
            y_true = data.y[mask].cpu().numpy()
            y_pred = predictions[mask].cpu().numpy()
            y_prob = probabilities[mask].cpu().numpy()
            
            # Calculate metrics
            accuracy = accuracy_score(y_true, y_pred)
            precision, recall, f1_macro, _ = precision_recall_fscore_support(
                y_true, y_pred, average='macro', zero_division=0
            )
            _, _, f1_micro, _ = precision_recall_fscore_support(
                y_true, y_pred, average='micro', zero_division=0
            )
            _, _, f1_weighted, _ = precision_recall_fscore_support(
                y_true, y_pred, average='weighted', zero_division=0
            )
            
            # Per-class metrics
            class_report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
            
            metrics = {
                'accuracy': float(accuracy),
                'precision_macro': float(precision),
                'recall_macro': float(recall),
                'f1_macro': float(f1_macro),
                'f1_micro': float(f1_micro),
                'f1_weighted': float(f1_weighted),
                'num_classes': len(np.unique(y_true)),
                'class_report': class_report
            }
            
            # Store evaluation
            self.evaluation_history.append({
                'model_type': 'node_classification',
                'metrics': metrics,
                'timestamp': datetime.now().isoformat()
            })
            
            return metrics
    
    async def evaluate_expertise_prediction(self, model: torch.nn.Module, data) -> Dict[str, float]:
        """Evaluate expertise prediction model performance."""
        
        model.eval()
        
        with torch.no_grad():
            if hasattr(data, 'expertise_edge_index') and data.expertise_edge_index.size(1) > 0:
                # Encode nodes
                node_embeddings = model.encode(data.x, data.edge_index)
                
                # Get expertise predictions
                person_embeddings = node_embeddings[data.expertise_edge_index[0]]
                topic_embeddings = node_embeddings[data.expertise_edge_index[1]]
                
                expertise_scores = model.predict_expertise(person_embeddings, topic_embeddings)
                
                # Convert to numpy
                y_true = data.expertise_edge_labels.cpu().numpy()
                y_pred = expertise_scores.cpu().numpy()
                
                # Calculate ranking metrics
                ndcg = self._calculate_ndcg(y_true, y_pred)
                map_score = self._calculate_map(y_true, y_pred)
                precision_at_k = self._calculate_precision_at_k(y_true, y_pred, k=5)
                
                # Regression metrics
                mse = float(np.mean((y_true - y_pred) ** 2))
                mae = float(np.mean(np.abs(y_true - y_pred)))
                
                metrics = {
                    'ndcg': float(ndcg),
                    'map': float(map_score),
                    'precision_at_5': float(precision_at_k),
                    'mse': mse,
                    'mae': mae,
                    'correlation': float(np.corrcoef(y_true, y_pred)[0, 1]) if len(y_true) > 1 else 0.0
                }
            else:
                # Fallback to link prediction metrics
                metrics = await self.evaluate_link_prediction(model, data)
                metrics['ndcg'] = metrics['auc']  # Use AUC as proxy for NDCG
                metrics['map'] = metrics['average_precision']
                metrics['precision_at_5'] = metrics['precision']
            
            # Store evaluation
            self.evaluation_history.append({
                'model_type': 'expertise_prediction',
                'metrics': metrics,
                'timestamp': datetime.now().isoformat()
            })
            
            return metrics
    
    def _calculate_ndcg(self, y_true: np.ndarray, y_pred: np.ndarray, k: int = 10) -> float:
        """Calculate Normalized Discounted Cumulative Gain."""
        
        if len(y_true) == 0:
            return 0.0
        
        # Sort by predicted scores
        sorted_indices = np.argsort(y_pred)[::-1][:k]
        
        # Calculate DCG
        dcg = 0.0
        for i, idx in enumerate(sorted_indices):
            relevance = y_true[idx]
            dcg += (2 ** relevance - 1) / np.log2(i + 2)
        
        # Calculate IDCG (ideal DCG)
        ideal_indices = np.argsort(y_true)[::-1][:k]
        idcg = 0.0
        for i, idx in enumerate(ideal_indices):
            relevance = y_true[idx]
            idcg += (2 ** relevance - 1) / np.log2(i + 2)
        
        return dcg / idcg if idcg > 0 else 0.0
    
    def _calculate_map(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate Mean Average Precision."""
        
        if len(y_true) == 0:
            return 0.0
        
        # Sort by predicted scores
        sorted_indices = np.argsort(y_pred)[::-1]
        
        # Calculate AP
        relevant_count = 0
        precision_sum = 0.0
        
        for i, idx in enumerate(sorted_indices):
            if y_true[idx] > 0.5:  # Consider as relevant if > 0.5
                relevant_count += 1
                precision_at_i = relevant_count / (i + 1)
                precision_sum += precision_at_i
        
        total_relevant = np.sum(y_true > 0.5)
        return precision_sum / total_relevant if total_relevant > 0 else 0.0
    
    def _calculate_precision_at_k(self, y_true: np.ndarray, y_pred: np.ndarray, k: int = 5) -> float:
        """Calculate Precision at K."""
        
        if len(y_true) == 0:
            return 0.0
        
        # Sort by predicted scores and take top k
        sorted_indices = np.argsort(y_pred)[::-1][:k]
        
        # Count relevant items in top k
        relevant_in_top_k = np.sum(y_true[sorted_indices] > 0.5)
        
        return relevant_in_top_k / min(k, len(sorted_indices))
    
    async def evaluate_multi_task_model(self, model: torch.nn.Module, 
                                      link_data, classification_data) -> Dict[str, Any]:
        """Evaluate multi-task model on both tasks."""
        
        model.eval()
        
        # Evaluate link prediction task
        link_metrics = await self.evaluate_link_prediction(model, link_data)
        
        # Evaluate classification task
        classification_metrics = await self.evaluate_node_classification(model, classification_data)
        
        # Combined metrics
        combined_metrics = {
            'link_prediction': link_metrics,
            'node_classification': classification_metrics,
            'combined_score': (link_metrics['auc'] + classification_metrics['accuracy']) / 2
        }
        
        # Store evaluation
        self.evaluation_history.append({
            'model_type': 'multi_task',
            'metrics': combined_metrics,
            'timestamp': datetime.now().isoformat()
        })
        
        return combined_metrics
    
    def calculate_model_complexity(self, model: torch.nn.Module) -> Dict[str, Any]:
        """Calculate model complexity metrics."""
        
        total_params = sum(p.numel() for p in model.parameters())
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
        
        # Calculate model size in MB
        param_size = 0
        for param in model.parameters():
            param_size += param.nelement() * param.element_size()
        
        buffer_size = 0
        for buffer in model.buffers():
            buffer_size += buffer.nelement() * buffer.element_size()
        
        model_size_mb = (param_size + buffer_size) / 1024 / 1024
        
        return {
            'total_parameters': total_params,
            'trainable_parameters': trainable_params,
            'model_size_mb': model_size_mb,
            'parameter_efficiency': trainable_params / total_params if total_params > 0 else 0
        }
    
    def compare_models(self, model_metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compare multiple model evaluation results."""
        
        if not model_metrics:
            return {}
        
        comparison = {
            'best_model': None,
            'metric_comparison': {},
            'ranking': []
        }
        
        # Extract common metrics
        common_metrics = set(model_metrics[0]['metrics'].keys())
        for metrics in model_metrics[1:]:
            common_metrics &= set(metrics['metrics'].keys())
        
        # Compare each metric
        for metric in common_metrics:
            if isinstance(model_metrics[0]['metrics'][metric], (int, float)):
                values = [m['metrics'][metric] for m in model_metrics]
                comparison['metric_comparison'][metric] = {
                    'best_value': max(values),
                    'worst_value': min(values),
                    'mean_value': np.mean(values),
                    'std_value': np.std(values)
                }
        
        # Rank models by primary metric (AUC for link prediction, accuracy for classification)
        primary_metric = 'auc' if 'auc' in common_metrics else 'accuracy'
        if primary_metric in common_metrics:
            ranked_models = sorted(
                enumerate(model_metrics),
                key=lambda x: x[1]['metrics'][primary_metric],
                reverse=True
            )
            
            comparison['ranking'] = [
                {
                    'rank': i + 1,
                    'model_index': idx,
                    'model_type': metrics['model_type'],
                    'score': metrics['metrics'][primary_metric]
                }
                for i, (idx, metrics) in enumerate(ranked_models)
            ]
            
            comparison['best_model'] = ranked_models[0][1]
        
        return comparison
    
    def get_evaluation_summary(self) -> Dict[str, Any]:
        """Get summary of all evaluations performed."""
        
        if not self.evaluation_history:
            return {'message': 'No evaluations performed yet'}
        
        # Group by model type
        by_model_type = {}
        for eval_result in self.evaluation_history:
            model_type = eval_result['model_type']
            if model_type not in by_model_type:
                by_model_type[model_type] = []
            by_model_type[model_type].append(eval_result)
        
        # Calculate statistics for each model type
        summary = {
            'total_evaluations': len(self.evaluation_history),
            'model_types': list(by_model_type.keys()),
            'by_model_type': {}
        }
        
        for model_type, evaluations in by_model_type.items():
            # Get latest evaluation
            latest = max(evaluations, key=lambda x: x['timestamp'])
            
            # Calculate average metrics if multiple evaluations
            if len(evaluations) > 1:
                avg_metrics = {}
                for metric in latest['metrics']:
                    if isinstance(latest['metrics'][metric], (int, float)):
                        values = [e['metrics'][metric] for e in evaluations 
                                if metric in e['metrics'] and isinstance(e['metrics'][metric], (int, float))]
                        if values:
                            avg_metrics[f'avg_{metric}'] = np.mean(values)
                            avg_metrics[f'std_{metric}'] = np.std(values)
            else:
                avg_metrics = {}
            
            summary['by_model_type'][model_type] = {
                'count': len(evaluations),
                'latest_metrics': latest['metrics'],
                'latest_timestamp': latest['timestamp'],
                'average_metrics': avg_metrics
            }
        
        return summary
    
    def export_evaluation_results(self, filepath: str = None) -> Dict[str, Any]:
        """Export evaluation results to file or return as dict."""
        
        export_data = {
            'evaluation_summary': self.get_evaluation_summary(),
            'full_history': self.evaluation_history,
            'export_timestamp': datetime.now().isoformat()
        }
        
        if filepath:
            import json
            with open(filepath, 'w') as f:
                json.dump(export_data, f, indent=2)
            logger.info(f"Evaluation results exported to {filepath}")
        
        return export_data
