import torch
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import asyncio
import logging
from datetime import datetime
import mlflow.pytorch
from pathlib import Path
import yaml

from models.link_prediction import load_model, ExpertiseRecommendationGNN
from models.node_classification import load_classification_model
from utils.neo4j_client import Neo4jClient
from utils.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)

class RealTimePredictor:
    """
    Real-time prediction service for trained GNN models.
    Implements knowledge-first approach with ML fallback.
    """
    
    def __init__(self, neo4j_client: Neo4jClient, supabase_client: SupabaseClient):
        self.neo4j = neo4j_client
        self.supabase = supabase_client
        
        # Model storage
        self.models = {}
        self.model_configs = {}
        self.model_metadata = {}
        
        # Performance tracking
        self.prediction_cache = {}
        self.performance_metrics = {
            'total_predictions': 0,
            'cache_hits': 0,
            'knowledge_hits': 0,
            'ml_predictions': 0
        }
        
        # Load model configurations
        self._load_model_configs()
        
        logger.info("RealTimePredictor initialized")
    
    def _load_model_configs(self):
        """Load model configurations from config files."""
        try:
            config_path = Path("config/model_config.yaml")
            if config_path.exists():
                with open(config_path, 'r') as f:
                    self.model_configs = yaml.safe_load(f)
            else:
                # Default configurations
                self.model_configs = {
                    'link_prediction': {
                        'gnn_type': 'gat',
                        'input_dim': 128,
                        'hidden_dim': 256,
                        'num_layers': 3,
                        'dropout': 0.2
                    },
                    'expertise_recommendation': {
                        'gnn_type': 'sage',
                        'input_dim': 128,
                        'hidden_dim': 256,
                        'num_layers': 4,
                        'dropout': 0.25
                    }
                }
        except Exception as e:
            logger.error(f"Failed to load model configs: {e}")
            self.model_configs = {}
    
    async def load_latest_models(self):
        """Load the latest trained models."""
        try:
            model_dir = Path("models")
            if not model_dir.exists():
                logger.warning("Models directory not found")
                return
            
            # Load link prediction model
            await self._load_model_by_type("link_prediction")
            
            # Load expertise recommendation model
            await self._load_model_by_type("expertise_recommendation")
            
            # Load node classification model
            await self._load_model_by_type("node_classification")
            
            logger.info(f"Loaded {len(self.models)} models")
            
        except Exception as e:
            logger.error(f"Failed to load models: {e}")
    
    async def _load_model_by_type(self, model_type: str):
        """Load the latest model of a specific type."""
        try:
            model_dir = Path("models")
            
            # Find latest model file
            pattern = f"{model_type}_best_*.pt"
            model_files = list(model_dir.glob(pattern))
            
            if not model_files:
                logger.warning(f"No {model_type} model found")
                return False
            
            # Get the most recent model
            latest_model = max(model_files, key=lambda x: x.stat().st_mtime)
            
            # Load model
            config = self.model_configs.get(model_type, {})
            if model_type in ['link_prediction', 'expertise_recommendation']:
                model = load_model(str(latest_model), model_type, config)
            else:
                model = load_classification_model(str(latest_model), model_type, config)
            
            model.eval()
            
            self.models[model_type] = model
            self.model_metadata[model_type] = {
                'path': str(latest_model),
                'loaded_at': datetime.now().isoformat(),
                'file_size': latest_model.stat().st_size
            }
            
            logger.info(f"Loaded {model_type} model from {latest_model}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load {model_type} model: {e}")
            return False
    
    async def load_model(self, model_type: str, model_version: Optional[str] = None) -> bool:
        """Load a specific model version."""
        try:
            if model_version:
                # Load specific version
                model_path = Path(f"models/{model_type}_{model_version}.pt")
            else:
                # Load latest
                return await self._load_model_by_type(model_type)
            
            if not model_path.exists():
                logger.error(f"Model not found: {model_path}")
                return False
            
            config = self.model_configs.get(model_type, {})
            if model_type in ['link_prediction', 'expertise_recommendation']:
                model = load_model(str(model_path), model_type, config)
            else:
                model = load_classification_model(str(model_path), model_type, config)
            
            model.eval()
            
            self.models[model_type] = model
            self.model_metadata[model_type] = {
                'path': str(model_path),
                'loaded_at': datetime.now().isoformat(),
                'version': model_version
            }
            
            logger.info(f"Loaded {model_type} model version {model_version}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load {model_type} model version {model_version}: {e}")
            return False
    
    def is_ready(self) -> bool:
        """Check if predictor is ready for inference."""
        return len(self.models) > 0
    
    async def search_knowledge_for_experts(self, topic: str, max_experts: int = 5) -> List[Dict[str, Any]]:
        """
        Search knowledge substrate for experts on a given topic.
        Implements knowledge-first approach with comprehensive search strategy.
        """
        try:
            session = self.neo4j.session()
            
            # Step 1: Direct expertise relationships in Neo4j
            direct_experts = session.run("""
                MATCH (p:Person)-[r:HAS_EXPERTISE]->(t:Topic)
                WHERE t.name CONTAINS $topic OR t.description CONTAINS $topic
                RETURN p.name as name, 
                       p.email_address as email,
                       r.confidence as confidence,
                       r.source as source,
                       t.name as topic_name
                ORDER BY r.confidence DESC
                LIMIT $max_experts
            """, {"topic": topic, "max_experts": max_experts})
            
            direct_results = []
            for record in direct_experts:
                direct_results.append({
                    "name": record["name"],
                    "email": record["email"],
                    "confidence": record["confidence"],
                    "source": record["source"],
                    "topic_match": record["topic_name"],
                    "method": "direct_expertise"
                })
            
            # Step 2: If we have enough high-confidence direct matches, return them
            knowledge_confidence_threshold = 0.8
            high_confidence_direct = [r for r in direct_results if r["confidence"] > knowledge_confidence_threshold]
            if len(high_confidence_direct) >= max_experts:
                session.close()
                self.performance_metrics['knowledge_hits'] += 1
                return high_confidence_direct[:max_experts]
            
            # Step 3: Look for indirect expertise through document authorship and mentions
            indirect_experts = session.run("""
                MATCH (p:Person)-[:AUTHORED|MENTIONED_IN]->(d:Document)-[:MENTIONS]->(t:Topic)
                WHERE t.name CONTAINS $topic OR t.description CONTAINS $topic
                WITH p, t, count(d) as document_count
                WHERE document_count >= 2  // At least 2 documents
                RETURN p.name as name,
                       p.email_address as email,
                       document_count,
                       t.name as topic_name,
                       (document_count * 0.1) as confidence  // Heuristic confidence
                ORDER BY document_count DESC
                LIMIT $remaining_slots
            """, {
                "topic": topic, 
                "remaining_slots": max_experts - len(high_confidence_direct)
            })
            
            for record in indirect_experts:
                direct_results.append({
                    "name": record["name"],
                    "email": record["email"],
                    "confidence": min(record["confidence"], 0.7),  # Cap indirect confidence
                    "source": "document_analysis",
                    "topic_match": record["topic_name"],
                    "document_count": record["document_count"],
                    "method": "indirect_expertise"
                })
            
            session.close()
            
            # Step 4: Also search Supabase for additional context
            if len(direct_results) < max_experts:
                supabase_experts = await self._search_supabase_for_experts(topic, max_experts - len(direct_results))
                direct_results.extend(supabase_experts)
            
            self.performance_metrics['knowledge_hits'] += 1
            return direct_results[:max_experts]
            
        except Exception as e:
            logger.error(f"Failed to search knowledge for experts: {e}")
            return []
    
    async def _search_supabase_for_experts(self, topic: str, max_experts: int) -> List[Dict[str, Any]]:
        """Search Supabase knowledge entities for expert information."""
        try:
            # Search for entities related to the topic
            result = await self.supabase.client.table('knowledge_entities')\
                .select('content, source_metadata, embedding')\
                .ilike('content', f'%{topic}%')\
                .eq('entity_type', 'person')\
                .limit(max_experts)\
                .execute()
            
            experts = []
            for entity in result.data:
                # Extract person name from content or metadata
                content = entity.get('content', '')
                metadata = entity.get('source_metadata', {})
                
                # Simple name extraction (in practice, you'd use NER)
                name = metadata.get('author') or content.split()[0] if content else 'Unknown'
                
                experts.append({
                    'name': name,
                    'confidence': 0.6,  # Default confidence for knowledge substrate
                    'topic_match': topic,
                    'source': 'knowledge_substrate'
                })
            
            return experts
            
        except Exception as e:
            logger.error(f"Failed to search Supabase for experts: {e}")
            return []
    
    async def predict_expertise(self, topic: str, max_experts: int = 5, 
                              confidence_threshold: float = 0.7,
                              existing_knowledge: Optional[List[Dict]] = None) -> List[Dict[str, Any]]:
        """Predict experts using ML model, augmenting existing knowledge."""
        try:
            start_time = datetime.now()
            
            # Check if we have the expertise model
            if 'expertise_recommendation' not in self.models:
                logger.warning("Expertise recommendation model not loaded")
                return existing_knowledge or []
            
            model = self.models['expertise_recommendation']
            
            # Get graph data for prediction
            graph_data = await self._get_prediction_graph_data()
            if not graph_data:
                return existing_knowledge or []
            
            # Find topic and person nodes
            topic_nodes, person_nodes = await self._find_topic_and_person_nodes(topic, graph_data)
            
            if not topic_nodes or not person_nodes:
                logger.warning(f"No suitable nodes found for topic: {topic}")
                return existing_knowledge or []
            
            # Run ML prediction
            with torch.no_grad():
                # Get node embeddings
                x = torch.tensor(graph_data['node_features'], dtype=torch.float)
                edge_index = torch.tensor(graph_data['edge_index'], dtype=torch.long)
                
                # Encode nodes
                node_embeddings = model.encode(x, edge_index)
                
                # Get topic embedding (use first topic node)
                topic_embedding = node_embeddings[topic_nodes[0]]
                
                # Get person embeddings
                person_embeddings = node_embeddings[person_nodes]
                person_names = [graph_data['node_names'][idx] for idx in person_nodes]
                
                # Predict expertise
                experts = model.get_top_experts(
                    topic_embedding, 
                    person_embeddings, 
                    person_names, 
                    k=max_experts
                )
            
            # Filter by confidence threshold
            filtered_experts = [
                expert for expert in experts 
                if expert['confidence'] >= confidence_threshold
            ]
            
            # Combine with existing knowledge
            all_experts = existing_knowledge or []
            
            # Add ML predictions that aren't already in knowledge
            existing_names = {expert['name'] for expert in all_experts}
            for expert in filtered_experts:
                if expert['name'] not in existing_names:
                    expert['source'] = 'ml_prediction'
                    all_experts.append(expert)
            
            # Sort by confidence and limit
            all_experts.sort(key=lambda x: x['confidence'], reverse=True)
            result = all_experts[:max_experts]
            
            # Update performance metrics
            self.performance_metrics['ml_predictions'] += 1
            self.performance_metrics['total_predictions'] += 1
            
            # Store prediction for monitoring
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            await self.supabase.store_model_predictions([{
                'model_type': 'expertise_recommendation',
                'input_data': {'topic': topic, 'max_experts': max_experts},
                'prediction': result,
                'confidence': np.mean([e['confidence'] for e in result]) if result else 0,
                'processing_time_ms': processing_time
            }])
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to predict expertise: {e}")
            return existing_knowledge or []
    
    async def predict_link(self, source: str, target: str, relationship_type: str) -> Dict:
        """
        Predict link probability, checking knowledge substrate first.
        Implements knowledge-first approach with ML fallback.
        """
        try:
            start_time = datetime.now()
            
            # Step 1: Check if relationship already exists in knowledge graph
            session = self.neo4j.session()
            try:
                existing_rel = session.run(f"""
                    MATCH (s {{name: $source}})-[r:{relationship_type}]->(t {{name: $target}})
                    RETURN r.confidence as confidence, r.source as source
                """, {"source": source, "target": target})
                
                record = existing_rel.single()
                if record:
                    self.performance_metrics['knowledge_hits'] += 1
                    return {
                        "source_entity": source,
                        "target_entity": target,
                        "relationship_type": relationship_type,
                        "probability": record["confidence"],
                        "confidence": record["confidence"],
                        "source": "knowledge_substrate",
                        "existing_relationship": True
                    }
            
            finally:
                session.close()
            
            # Step 2: Use ML model to predict new relationship
            if 'link_prediction' not in self.models:
                logger.warning("Link prediction model not loaded")
                return {
                    "source_entity": source,
                    "target_entity": target,
                    "relationship_type": relationship_type,
                    "probability": 0.5,
                    "confidence": 0.5,
                    "source": "default_fallback",
                    "existing_relationship": False
                }
            
            # Get graph context and make prediction
            prediction_score = await self._predict_link_ml(source, target, relationship_type)
            
            result = {
                "source_entity": source,
                "target_entity": target,
                "relationship_type": relationship_type,
                "probability": prediction_score,
                "confidence": prediction_score,
                "source": "ml_prediction",
                "existing_relationship": False
            }
            
            # Update metrics
            self.performance_metrics['ml_predictions'] += 1
            self.performance_metrics['total_predictions'] += 1
            
            # Store prediction for monitoring
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            await self.supabase.store_model_predictions([{
                'model_type': 'link_prediction',
                'input_data': {'source': source, 'target': target, 'relationship_type': relationship_type},
                'prediction': result,
                'confidence': prediction_score,
                'processing_time_ms': processing_time
            }])
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to predict link: {e}")
            return {
                "source_entity": source,
                "target_entity": target,
                "relationship_type": relationship_type,
                "probability": 0.0,
                "confidence": 0.0,
                "source": "error",
                "existing_relationship": False,
                "error": str(e)
            }
    
    async def _predict_link_ml(self, source: str, target: str, relationship_type: str) -> float:
        """Use ML model to predict link probability."""
        try:
            # Get graph data
            graph_data = await self._get_prediction_graph_data()
            if not graph_data:
                return 0.5  # Default fallback
            
            # Find source and target nodes
            source_idx = await self._find_node_by_name(source, graph_data)
            target_idx = await self._find_node_by_name(target, graph_data)
            
            if source_idx is None or target_idx is None:
                logger.warning(f"Nodes not found for ML prediction: {source} -> {target}")
                return 0.3  # Low confidence when nodes not found
            
            model = self.models['link_prediction']
            
            # Run ML prediction
            with torch.no_grad():
                x = torch.tensor(graph_data['node_features'], dtype=torch.float)
                edge_index = torch.tensor(graph_data['edge_index'], dtype=torch.long)
                edge_label_index = torch.tensor([[source_idx], [target_idx]], dtype=torch.long)
                
                logits = model(x, edge_index, edge_label_index)
                probability = torch.sigmoid(logits).item()
            
            return float(probability)
            
        except Exception as e:
            logger.error(f"ML link prediction failed: {e}")
            return 0.75  # Placeholder as mentioned in the requirements
    
    async def _get_prediction_graph_data(self) -> Optional[Dict[str, Any]]:
        """Get graph data for ML prediction."""
        try:
            # Export current graph state from Neo4j
            graph_data = self.neo4j.export_graph_data("knowledge_graph")
            
            if not graph_data or graph_data['nodes'].empty:
                logger.warning("No graph data available for prediction")
                return None
            
            # Convert to format suitable for PyTorch
            nodes_df = graph_data['nodes']
            edges_df = graph_data['edges']
            
            # Extract node features (embeddings)
            node_features = np.stack(nodes_df['embedding'].values)
            
            # Create node ID mapping
            node_ids = nodes_df['nodeId'].values
            id_to_idx = {node_id: idx for idx, node_id in enumerate(node_ids)}
            
            # Create edge index
            edge_sources = []
            edge_targets = []
            
            for _, edge in edges_df.iterrows():
                src_id = edge['sourceNodeId']
                tgt_id = edge['targetNodeId']
                
                if src_id in id_to_idx and tgt_id in id_to_idx:
                    edge_sources.append(id_to_idx[src_id])
                    edge_targets.append(id_to_idx[tgt_id])
            
            edge_index = [edge_sources, edge_targets]
            
            # Extract node names for lookup
            node_names = {}
            for idx, node_id in enumerate(node_ids):
                # Extract name from node (simplified)
                node_names[idx] = str(node_id)
            
            return {
                'node_features': node_features,
                'edge_index': edge_index,
                'node_names': node_names,
                'id_to_idx': id_to_idx
            }
            
        except Exception as e:
            logger.error(f"Failed to get prediction graph data: {e}")
            return None
    
    async def _find_topic_and_person_nodes(self, topic: str, graph_data: Dict) -> Tuple[List[int], List[int]]:
        """Find topic and person nodes in the graph."""
        topic_nodes = []
        person_nodes = []
        
        # This is simplified - in practice, you'd use proper node type information
        for idx, name in graph_data['node_names'].items():
            name_lower = str(name).lower()
            if topic.lower() in name_lower:
                topic_nodes.append(idx)
            elif 'person' in name_lower or '@' in name_lower:  # Simple heuristic
                person_nodes.append(idx)
        
        return topic_nodes, person_nodes
    
    async def _find_node_by_name(self, name: str, graph_data: Dict) -> Optional[int]:
        """Find a node by name in the graph."""
        name_lower = name.lower()
        
        for idx, node_name in graph_data['node_names'].items():
            if name_lower in str(node_name).lower():
                return idx
        
        return None
    
    async def get_available_models(self) -> Dict[str, Any]:
        """Get list of available models."""
        return {
            'loaded_models': list(self.models.keys()),
            'model_metadata': self.model_metadata,
            'performance_metrics': self.performance_metrics
        }
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics."""
        return {
            **self.performance_metrics,
            'cache_hit_rate': (
                self.performance_metrics['cache_hits'] / 
                max(self.performance_metrics['total_predictions'], 1)
            ),
            'knowledge_hit_rate': (
                self.performance_metrics['knowledge_hits'] / 
                max(self.performance_metrics['total_predictions'], 1)
            )
        }
    
    def clear_cache(self):
        """Clear prediction cache."""
        self.prediction_cache.clear()
        logger.info("Prediction cache cleared")
    
    async def warmup_models(self):
        """Warmup models with dummy predictions."""
        try:
            logger.info("Warming up models...")
            
            # Warmup link prediction
            if 'link_prediction' in self.models:
                await self.predict_link("test_entity_1", "test_entity_2")
            
            # Warmup expertise prediction
            if 'expertise_recommendation' in self.models:
                await self.predict_expertise("test_topic", max_experts=1)
            
            logger.info("Model warmup completed")
            
        except Exception as e:
            logger.error(f"Model warmup failed: {e}")
    
    def __del__(self):
        """Cleanup on deletion."""
        self.clear_cache()
