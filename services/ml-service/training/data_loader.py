import torch
from torch_geometric.data import Data, DataLoader
import numpy as np
from gds import GraphDataScience
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from utils.neo4j_client import Neo4jClient
from utils.supabase_client import SupabaseClient
import logging
from typing import Dict, List, Any, Tuple, Optional
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class GraphDataLoader:
    """
    Loads graph data from Neo4j and converts it to PyTorch Geometric format.
    Integrates with Supabase for additional features and metadata.
    """
    
    def __init__(self, neo4j_client: Neo4jClient, supabase_client: SupabaseClient, config: dict):
        self.neo4j = neo4j_client
        self.supabase = supabase_client
        self.gds = neo4j_client.gds
        self.config = config
        
        # Label encoders for categorical data
        self.node_type_encoder = LabelEncoder()
        self.relationship_type_encoder = LabelEncoder()
        
        logger.info("GraphDataLoader initialized successfully")
    
    async def load_link_prediction_data(self, graph_name: str = "knowledge_graph") -> Data:
        """Load data for link prediction task from Neo4j Aura."""
        
        try:
            # Project the graph in GDS
            success = self.neo4j.project_graph_for_gds(graph_name)
            if not success:
                raise RuntimeError(f"Failed to project graph {graph_name}")
            
            # Generate node embeddings using FastRP
            success = self.neo4j.generate_node_embeddings(
                graph_name, 
                self.config['embedding_dim']
            )
            if not success:
                raise RuntimeError(f"Failed to generate embeddings for {graph_name}")
            
            # Export graph data
            graph_data = self.neo4j.export_graph_data(graph_name)
            if not graph_data:
                raise RuntimeError("Failed to export graph data")
            
            # Convert to PyTorch Geometric format
            pyg_data = self._convert_to_pyg_data(
                graph_data['nodes'], 
                graph_data['edges']
            )
            
            logger.info(f"Loaded link prediction data: {pyg_data.num_nodes} nodes, {pyg_data.num_edges} edges")
            return pyg_data
            
        except Exception as e:
            logger.error(f"Failed to load link prediction data: {e}")
            raise
    
    async def load_node_classification_data(self, graph_name: str = "knowledge_graph") -> Data:
        """Load data for node classification task."""
        
        try:
            # Get graph data
            graph_data = await self._get_enhanced_graph_data(graph_name)
            
            # Get node labels from Supabase
            node_labels = await self._get_node_labels()
            
            # Convert to PyTorch Geometric format with labels
            pyg_data = self._convert_to_classification_data(
                graph_data['nodes'],
                graph_data['edges'],
                node_labels
            )
            
            logger.info(f"Loaded node classification data: {pyg_data.num_nodes} nodes, {pyg_data.num_classes} classes")
            return pyg_data
            
        except Exception as e:
            logger.error(f"Failed to load node classification data: {e}")
            raise
    
    async def load_expertise_prediction_data(self, graph_name: str = "knowledge_graph") -> Data:
        """Load data specifically for expertise prediction."""
        
        try:
            # Get expertise-specific graph projection
            await self._project_expertise_graph(graph_name)
            
            # Export expertise graph data
            graph_data = self.neo4j.export_graph_data(f"{graph_name}_expertise")
            
            # Get expertise labels from knowledge substrate
            expertise_data = await self._get_expertise_labels()
            
            # Convert to PyTorch format
            pyg_data = self._convert_to_expertise_data(
                graph_data['nodes'],
                graph_data['edges'],
                expertise_data
            )
            
            logger.info(f"Loaded expertise prediction data: {pyg_data.num_nodes} nodes")
            return pyg_data
            
        except Exception as e:
            logger.error(f"Failed to load expertise prediction data: {e}")
            raise
    
    async def _get_enhanced_graph_data(self, graph_name: str) -> Dict[str, Any]:
        """Get enhanced graph data with Supabase integration."""
        
        # Project graph if not exists
        self.neo4j.project_graph_for_gds(graph_name)
        self.neo4j.generate_node_embeddings(graph_name, self.config['embedding_dim'])
        
        # Export from Neo4j
        graph_data = self.neo4j.export_graph_data(graph_name)
        
        # Enhance with Supabase data
        enhanced_nodes = await self._enhance_nodes_with_supabase(graph_data['nodes'])
        
        return {
            'nodes': enhanced_nodes,
            'edges': graph_data['edges']
        }
    
    async def _enhance_nodes_with_supabase(self, nodes_df: pd.DataFrame) -> pd.DataFrame:
        """Enhance node data with information from Supabase."""
        
        try:
            # Get additional node features from knowledge entities
            knowledge_entities = await self.supabase.get_knowledge_entities_for_training()
            
            # Create mapping from node names to additional features
            entity_features = {}
            for entity in knowledge_entities:
                if entity['content']:
                    # Extract features from content
                    features = self._extract_content_features(entity)
                    entity_features[entity['content'][:50]] = features  # Use content prefix as key
            
            # Add features to nodes dataframe
            enhanced_nodes = nodes_df.copy()
            enhanced_nodes['supabase_features'] = enhanced_nodes.apply(
                lambda row: entity_features.get(str(row['node'])[:50], {}), axis=1
            )
            
            return enhanced_nodes
            
        except Exception as e:
            logger.warning(f"Failed to enhance nodes with Supabase data: {e}")
            return nodes_df
    
    def _extract_content_features(self, entity: Dict[str, Any]) -> Dict[str, float]:
        """Extract numerical features from entity content."""
        
        content = entity.get('content', '')
        metadata = entity.get('source_metadata', {})
        
        features = {
            'content_length': len(content),
            'word_count': len(content.split()) if content else 0,
            'has_embedding': 1.0 if entity.get('embedding') else 0.0,
            'entity_type_encoded': hash(entity.get('entity_type', '')) % 1000 / 1000.0,
            'source_type_encoded': hash(metadata.get('source_type', '')) % 1000 / 1000.0
        }
        
        return features
    
    async def _get_node_labels(self) -> Dict[str, int]:
        """Get node classification labels from various sources."""
        
        try:
            # Get document classifications from processing logs
            result = await self.supabase.client.table('processing_logs')\
                .select('external_id, source_type, metadata')\
                .execute()
            
            node_labels = {}
            label_mapping = {
                'email': 0,
                'document': 1,
                'attachment': 2,
                'web_content': 3,
                'user_input': 4
            }
            
            for log in result.data:
                external_id = log['external_id']
                source_type = log['source_type']
                label = label_mapping.get(source_type, 5)  # 5 for unknown
                node_labels[external_id] = label
            
            return node_labels
            
        except Exception as e:
            logger.error(f"Failed to get node labels: {e}")
            return {}
    
    async def _project_expertise_graph(self, base_graph_name: str):
        """Project a specialized graph for expertise prediction."""
        
        expertise_graph_name = f"{base_graph_name}_expertise"
        
        try:
            # Drop existing graph if exists
            try:
                self.gds.graph.drop(expertise_graph_name)
            except:
                pass
            
            # Project expertise-focused graph
            self.gds.run_cypher(f"""
                CALL gds.graph.project(
                    '{expertise_graph_name}',
                    ['Person', 'Topic', 'Organization', 'Document'],
                    {{
                        HAS_EXPERTISE: {{orientation: 'UNDIRECTED'}},
                        WORKS_FOR: {{orientation: 'UNDIRECTED'}},
                        MENTIONS: {{orientation: 'UNDIRECTED'}},
                        RELATED_TO: {{orientation: 'UNDIRECTED'}}
                    }}
                )
            """)
            
            # Generate embeddings
            self.gds.run_cypher(f"""
                CALL gds.fastRP.mutate(
                    '{expertise_graph_name}',
                    {{
                        embeddingDimension: {self.config['embedding_dim']},
                        mutateProperty: 'embedding',
                        randomSeed: 42
                    }}
                )
            """)
            
            logger.info(f"Successfully projected expertise graph: {expertise_graph_name}")
            
        except Exception as e:
            logger.error(f"Failed to project expertise graph: {e}")
            raise
    
    async def _get_expertise_labels(self) -> Dict[str, Any]:
        """Get expertise labels and relationships."""
        
        try:
            # Query Neo4j for existing expertise relationships
            session = self.neo4j.session()
            result = session.run("""
                MATCH (p:Person)-[r:HAS_EXPERTISE]->(t:Topic)
                RETURN p.name as person, t.name as topic, 
                       coalesce(r.confidence, 0.5) as confidence
            """)
            
            expertise_data = {
                'person_topic_pairs': [],
                'confidences': []
            }
            
            for record in result:
                expertise_data['person_topic_pairs'].append({
                    'person': record['person'],
                    'topic': record['topic']
                })
                expertise_data['confidences'].append(record['confidence'])
            
            session.close()
            return expertise_data
            
        except Exception as e:
            logger.error(f"Failed to get expertise labels: {e}")
            return {'person_topic_pairs': [], 'confidences': []}
    
    def _convert_to_pyg_data(self, nodes_df: pd.DataFrame, edges_df: pd.DataFrame) -> Data:
        """Convert pandas DataFrames to PyTorch Geometric Data object."""
        
        try:
            # Create node feature matrix from embeddings
            embeddings = np.stack(nodes_df['embedding'].values)
            x = torch.tensor(embeddings, dtype=torch.float)
            
            # Create node ID mapping
            node_ids = nodes_df['nodeId'].values
            id_to_idx = {node_id: idx for idx, node_id in enumerate(node_ids)}
            
            # Create edge index with proper mapping
            edge_sources = [id_to_idx[src] for src in edges_df['sourceNodeId'].values if src in id_to_idx]
            edge_targets = [id_to_idx[tgt] for tgt in edges_df['targetNodeId'].values if tgt in id_to_idx]
            
            edge_index = torch.tensor([edge_sources, edge_targets], dtype=torch.long)
            
            # Create edge labels for link prediction
            edge_labels = torch.ones(edge_index.size(1), dtype=torch.float)
            
            # Generate negative samples
            negative_edges = self._generate_negative_samples(
                edge_index, num_nodes=x.size(0), num_neg_samples=edge_index.size(1)
            )
            
            # Combine positive and negative edges
            all_edges = torch.cat([edge_index, negative_edges], dim=1)
            all_labels = torch.cat([
                torch.ones(edge_index.size(1)),
                torch.zeros(negative_edges.size(1))
            ])
            
            return Data(
                x=x,
                edge_index=edge_index,
                edge_label_index=all_edges,
                edge_label=all_labels,
                num_nodes=x.size(0)
            )
            
        except Exception as e:
            logger.error(f"Failed to convert to PyG data: {e}")
            raise
    
    def _convert_to_classification_data(self, nodes_df: pd.DataFrame, 
                                      edges_df: pd.DataFrame, 
                                      node_labels: Dict[str, int]) -> Data:
        """Convert to PyTorch Geometric data for node classification."""
        
        try:
            # Create node features
            embeddings = np.stack(nodes_df['embedding'].values)
            x = torch.tensor(embeddings, dtype=torch.float)
            
            # Create node labels
            node_ids = nodes_df['nodeId'].values
            labels = []
            for node_id in node_ids:
                # Try to find label, default to 0 if not found
                label = node_labels.get(str(node_id), 0)
                labels.append(label)
            
            y = torch.tensor(labels, dtype=torch.long)
            
            # Create edge index
            id_to_idx = {node_id: idx for idx, node_id in enumerate(node_ids)}
            edge_sources = [id_to_idx[src] for src in edges_df['sourceNodeId'].values if src in id_to_idx]
            edge_targets = [id_to_idx[tgt] for tgt in edges_df['targetNodeId'].values if tgt in id_to_idx]
            
            edge_index = torch.tensor([edge_sources, edge_targets], dtype=torch.long)
            
            return Data(
                x=x,
                edge_index=edge_index,
                y=y,
                num_nodes=x.size(0),
                num_classes=len(set(labels))
            )
            
        except Exception as e:
            logger.error(f"Failed to convert to classification data: {e}")
            raise
    
    def _convert_to_expertise_data(self, nodes_df: pd.DataFrame, 
                                 edges_df: pd.DataFrame,
                                 expertise_data: Dict[str, Any]) -> Data:
        """Convert to PyTorch Geometric data for expertise prediction."""
        
        try:
            # Create node features
            embeddings = np.stack(nodes_df['embedding'].values)
            x = torch.tensor(embeddings, dtype=torch.float)
            
            # Create edge index
            node_ids = nodes_df['nodeId'].values
            id_to_idx = {node_id: idx for idx, node_id in enumerate(node_ids)}
            
            edge_sources = [id_to_idx[src] for src in edges_df['sourceNodeId'].values if src in id_to_idx]
            edge_targets = [id_to_idx[tgt] for tgt in edges_df['targetNodeId'].values if tgt in id_to_idx]
            
            edge_index = torch.tensor([edge_sources, edge_targets], dtype=torch.long)
            
            # Create expertise edge labels
            expertise_edges = []
            expertise_labels = []
            
            for pair, confidence in zip(expertise_data['person_topic_pairs'], 
                                      expertise_data['confidences']):
                # Find node indices for person and topic
                person_idx = None
                topic_idx = None
                
                for idx, node_id in enumerate(node_ids):
                    # This is simplified - in practice, you'd need better node identification
                    if str(node_id).find(pair['person']) != -1:
                        person_idx = idx
                    if str(node_id).find(pair['topic']) != -1:
                        topic_idx = idx
                
                if person_idx is not None and topic_idx is not None:
                    expertise_edges.append([person_idx, topic_idx])
                    expertise_labels.append(confidence)
            
            if expertise_edges:
                expertise_edge_index = torch.tensor(expertise_edges, dtype=torch.long).t()
                expertise_edge_labels = torch.tensor(expertise_labels, dtype=torch.float)
            else:
                expertise_edge_index = torch.empty((2, 0), dtype=torch.long)
                expertise_edge_labels = torch.empty(0, dtype=torch.float)
            
            return Data(
                x=x,
                edge_index=edge_index,
                expertise_edge_index=expertise_edge_index,
                expertise_edge_labels=expertise_edge_labels,
                num_nodes=x.size(0)
            )
            
        except Exception as e:
            logger.error(f"Failed to convert to expertise data: {e}")
            raise
    
    def _generate_negative_samples(self, edge_index: torch.Tensor, 
                                 num_nodes: int, num_neg_samples: int) -> torch.Tensor:
        """Generate negative edge samples for training."""
        
        # Create adjacency set for fast lookup
        edge_set = set(map(tuple, edge_index.t().numpy()))
        
        negative_edges = []
        max_attempts = num_neg_samples * 10  # Prevent infinite loop
        attempts = 0
        
        while len(negative_edges) < num_neg_samples and attempts < max_attempts:
            src = np.random.randint(0, num_nodes)
            dst = np.random.randint(0, num_nodes)
            attempts += 1
            
            if src != dst and (src, dst) not in edge_set and (dst, src) not in edge_set:
                negative_edges.append([src, dst])
        
        if len(negative_edges) < num_neg_samples:
            logger.warning(f"Could only generate {len(negative_edges)} negative samples out of {num_neg_samples} requested")
        
        return torch.tensor(negative_edges, dtype=torch.long).t()
    
    def create_data_splits(self, data: Data, 
                          train_ratio: float = 0.7, 
                          val_ratio: float = 0.15) -> Tuple[Data, Data, Data]:
        """Split data into train/validation/test sets."""
        
        if hasattr(data, 'edge_label_index'):
            # Link prediction splits
            return self._split_link_prediction_data(data, train_ratio, val_ratio)
        elif hasattr(data, 'y'):
            # Node classification splits
            return self._split_node_classification_data(data, train_ratio, val_ratio)
        else:
            raise ValueError("Unknown data format for splitting")
    
    def _split_link_prediction_data(self, data: Data, 
                                  train_ratio: float, 
                                  val_ratio: float) -> Tuple[Data, Data, Data]:
        """Split link prediction data."""
        
        num_edges = data.edge_label_index.size(1)
        indices = torch.randperm(num_edges)
        
        train_size = int(train_ratio * num_edges)
        val_size = int(val_ratio * num_edges)
        
        train_indices = indices[:train_size]
        val_indices = indices[train_size:train_size + val_size]
        test_indices = indices[train_size + val_size:]
        
        train_data = Data(
            x=data.x,
            edge_index=data.edge_index,
            edge_label_index=data.edge_label_index[:, train_indices],
            edge_label=data.edge_label[train_indices],
            num_nodes=data.num_nodes
        )
        
        val_data = Data(
            x=data.x,
            edge_index=data.edge_index,
            edge_label_index=data.edge_label_index[:, val_indices],
            edge_label=data.edge_label[val_indices],
            num_nodes=data.num_nodes
        )
        
        test_data = Data(
            x=data.x,
            edge_index=data.edge_index,
            edge_label_index=data.edge_label_index[:, test_indices],
            edge_label=data.edge_label[test_indices],
            num_nodes=data.num_nodes
        )
        
        return train_data, val_data, test_data
    
    def _split_node_classification_data(self, data: Data, 
                                      train_ratio: float, 
                                      val_ratio: float) -> Tuple[Data, Data, Data]:
        """Split node classification data."""
        
        num_nodes = data.num_nodes
        indices = torch.randperm(num_nodes)
        
        train_size = int(train_ratio * num_nodes)
        val_size = int(val_ratio * num_nodes)
        
        train_mask = torch.zeros(num_nodes, dtype=torch.bool)
        val_mask = torch.zeros(num_nodes, dtype=torch.bool)
        test_mask = torch.zeros(num_nodes, dtype=torch.bool)
        
        train_mask[indices[:train_size]] = True
        val_mask[indices[train_size:train_size + val_size]] = True
        test_mask[indices[train_size + val_size:]] = True
        
        # Create copies with masks
        train_data = data.clone()
        train_data.train_mask = train_mask
        
        val_data = data.clone()
        val_data.val_mask = val_mask
        
        test_data = data.clone()
        test_data.test_mask = test_mask
        
        return train_data, val_data, test_data
    
    async def get_data_statistics(self) -> Dict[str, Any]:
        """Get comprehensive data statistics."""
        
        try:
            # Neo4j statistics
            neo4j_stats = await self.neo4j.get_graph_statistics()
            
            # Supabase statistics
            supabase_stats = await self.supabase.get_training_data_statistics()
            
            return {
                'neo4j_stats': neo4j_stats,
                'supabase_stats': supabase_stats,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get data statistics: {e}")
            return {}
    
    def close(self):
        """Clean up resources."""
        if hasattr(self, 'neo4j'):
            self.neo4j.close()
        logger.info("GraphDataLoader closed")
