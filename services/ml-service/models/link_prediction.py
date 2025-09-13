import torch
import torch.nn.functional as F
from torch_geometric.nn import GCNConv, GATConv, SAGEConv
from torch_geometric.nn import global_mean_pool, global_max_pool
import torch.nn as nn
import logging

logger = logging.getLogger(__name__)

class LinkPredictionGNN(torch.nn.Module):
    """
    Graph Neural Network for predicting links between entities in the knowledge graph.
    Supports multiple GNN architectures: GCN, GAT, GraphSAGE.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.num_layers = config['num_layers']
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        self.gnn_type = config['gnn_type']
        
        # Build GNN layers
        self.convs = nn.ModuleList()
        self.batch_norms = nn.ModuleList()
        
        # Input layer
        if self.gnn_type == 'gcn':
            self.convs.append(GCNConv(self.input_dim, self.hidden_dim))
        elif self.gnn_type == 'gat':
            self.convs.append(GATConv(self.input_dim, self.hidden_dim, heads=4, concat=False))
        elif self.gnn_type == 'sage':
            self.convs.append(SAGEConv(self.input_dim, self.hidden_dim))
        
        self.batch_norms.append(nn.BatchNorm1d(self.hidden_dim))
        
        # Hidden layers
        for _ in range(self.num_layers - 2):
            if self.gnn_type == 'gcn':
                self.convs.append(GCNConv(self.hidden_dim, self.hidden_dim))
            elif self.gnn_type == 'gat':
                self.convs.append(GATConv(self.hidden_dim, self.hidden_dim, heads=4, concat=False))
            elif self.gnn_type == 'sage':
                self.convs.append(SAGEConv(self.hidden_dim, self.hidden_dim))
            
            self.batch_norms.append(nn.BatchNorm1d(self.hidden_dim))
        
        # Output layer
        if self.gnn_type == 'gcn':
            self.convs.append(GCNConv(self.hidden_dim, self.hidden_dim))
        elif self.gnn_type == 'gat':
            self.convs.append(GATConv(self.hidden_dim, self.hidden_dim, heads=1))
        elif self.gnn_type == 'sage':
            self.convs.append(SAGEConv(self.hidden_dim, self.hidden_dim))
        
        # Link prediction head
        self.link_predictor = nn.Sequential(
            nn.Linear(self.hidden_dim * 2, self.hidden_dim),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim // 2, 1)
        )
    
    def encode(self, x, edge_index, batch=None):
        """Encode nodes into embeddings."""
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.batch_norms[i](x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Final layer without activation
        x = self.convs[-1](x, edge_index)
        return x
    
    def decode(self, z, edge_label_index):
        """Decode edge probabilities from node embeddings."""
        # Get embeddings for source and target nodes
        src_embeddings = z[edge_label_index[0]]
        dst_embeddings = z[edge_label_index[1]]
        
        # Concatenate embeddings
        edge_embeddings = torch.cat([src_embeddings, dst_embeddings], dim=1)
        
        # Predict link probability
        return self.link_predictor(edge_embeddings).squeeze()
    
    def forward(self, x, edge_index, edge_label_index, batch=None):
        """Full forward pass for training."""
        z = self.encode(x, edge_index, batch)
        return self.decode(z, edge_label_index)

class ExpertiseRecommendationGNN(LinkPredictionGNN):
    """
    Specialized GNN for recommending experts based on topics and relationships.
    """
    
    def __init__(self, config):
        super().__init__(config)
        
        # Additional layers for expertise scoring
        self.expertise_scorer = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim // 2, 1),
            nn.Sigmoid()  # Expertise score between 0 and 1
        )
    
    def predict_expertise(self, person_embeddings, topic_embeddings):
        """Predict expertise level of persons for given topics."""
        # Compute similarity between person and topic embeddings
        similarity = F.cosine_similarity(person_embeddings, topic_embeddings, dim=1)
        
        # Use expertise scorer to get final expertise probability
        expertise_scores = self.expertise_scorer(person_embeddings)
        
        # Combine similarity and expertise scores
        final_scores = similarity * expertise_scores.squeeze()
        return final_scores
    
    def get_top_experts(self, topic_embedding, person_embeddings, person_names, k=5):
        """Get top k experts for a given topic."""
        # Expand topic embedding to match person embeddings
        topic_expanded = topic_embedding.unsqueeze(0).expand(person_embeddings.size(0), -1)
        
        # Predict expertise scores
        expertise_scores = self.predict_expertise(person_embeddings, topic_expanded)
        
        # Get top k experts
        top_k_indices = torch.topk(expertise_scores, k=min(k, len(expertise_scores))).indices
        
        experts = []
        for idx in top_k_indices:
            experts.append({
                'name': person_names[idx],
                'confidence': expertise_scores[idx].item(),
                'index': idx.item()
            })
        
        return experts

class MultiTaskGNN(torch.nn.Module):
    """
    Multi-task GNN that can perform both link prediction and node classification.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        self.num_classes = config.get('num_classes', 10)
        
        # Shared GNN encoder
        self.shared_encoder = LinkPredictionGNN(config)
        
        # Task-specific heads
        self.node_classifier = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim // 2, self.num_classes)
        )
        
        # Link predictor is inherited from LinkPredictionGNN
        self.link_predictor = self.shared_encoder.link_predictor
    
    def forward(self, x, edge_index, edge_label_index=None, task='link_prediction', batch=None):
        """Forward pass for specified task."""
        # Get node embeddings from shared encoder
        node_embeddings = self.shared_encoder.encode(x, edge_index, batch)
        
        if task == 'link_prediction' and edge_label_index is not None:
            return self.shared_encoder.decode(node_embeddings, edge_label_index)
        elif task == 'node_classification':
            if batch is not None:
                # Graph-level classification
                graph_embeddings = global_mean_pool(node_embeddings, batch)
                return self.node_classifier(graph_embeddings)
            else:
                # Node-level classification
                return self.node_classifier(node_embeddings)
        else:
            return node_embeddings  # Return embeddings for other uses

class AttentionPooling(nn.Module):
    """
    Attention-based pooling for graph-level representations.
    """
    
    def __init__(self, hidden_dim):
        super().__init__()
        self.attention = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.Tanh(),
            nn.Linear(hidden_dim // 2, 1)
        )
    
    def forward(self, x, batch):
        """Apply attention pooling."""
        # Compute attention weights
        attention_weights = self.attention(x)
        attention_weights = F.softmax(attention_weights, dim=0)
        
        # Apply attention weights
        weighted_x = x * attention_weights
        
        # Pool by batch
        return global_mean_pool(weighted_x, batch)

class GraphTransformerGNN(torch.nn.Module):
    """
    Graph Transformer-based GNN for advanced relationship modeling.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.num_heads = config.get('num_heads', 8)
        self.num_layers = config['num_layers']
        self.dropout = config['dropout']
        
        # Input projection
        self.input_proj = nn.Linear(self.input_dim, self.hidden_dim)
        
        # Transformer layers
        self.transformer_layers = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=self.hidden_dim,
                nhead=self.num_heads,
                dim_feedforward=self.hidden_dim * 2,
                dropout=self.dropout,
                batch_first=True
            ) for _ in range(self.num_layers)
        ])
        
        # Output layers
        self.link_predictor = nn.Sequential(
            nn.Linear(self.hidden_dim * 2, self.hidden_dim),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim, 1)
        )
    
    def forward(self, x, edge_index, edge_label_index, batch=None):
        """Forward pass using transformer architecture."""
        # Project input features
        x = self.input_proj(x)
        
        # Add batch dimension if needed
        if x.dim() == 2:
            x = x.unsqueeze(0)
        
        # Apply transformer layers
        for layer in self.transformer_layers:
            x = layer(x)
        
        # Remove batch dimension
        if x.dim() == 3:
            x = x.squeeze(0)
        
        # Link prediction
        src_embeddings = x[edge_label_index[0]]
        dst_embeddings = x[edge_label_index[1]]
        edge_embeddings = torch.cat([src_embeddings, dst_embeddings], dim=1)
        
        return self.link_predictor(edge_embeddings).squeeze()

def create_model(model_type: str, config: dict) -> torch.nn.Module:
    """Factory function to create models based on type."""
    if model_type == 'link_prediction':
        return LinkPredictionGNN(config)
    elif model_type == 'expertise_recommendation':
        return ExpertiseRecommendationGNN(config)
    elif model_type == 'multi_task':
        return MultiTaskGNN(config)
    elif model_type == 'graph_transformer':
        return GraphTransformerGNN(config)
    else:
        raise ValueError(f"Unknown model type: {model_type}")

def load_model(model_path: str, model_type: str, config: dict) -> torch.nn.Module:
    """Load a trained model from disk."""
    model = create_model(model_type, config)
    model.load_state_dict(torch.load(model_path, map_location='cpu'))
    model.eval()
    logger.info(f"Loaded {model_type} model from {model_path}")
    return model
