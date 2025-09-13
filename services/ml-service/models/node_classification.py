import torch
import torch.nn.functional as F
from torch_geometric.nn import GCNConv, GATConv, SAGEConv, global_mean_pool, global_max_pool
import torch.nn as nn
import logging

logger = logging.getLogger(__name__)

class DocumentClassificationGNN(torch.nn.Module):
    """
    GNN for classifying documents into categories based on their content and relationships.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.num_classes = config['num_classes']
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        self.gnn_type = config.get('gnn_type', 'gcn')
        
        # GNN layers
        if self.gnn_type == 'gcn':
            self.conv1 = GCNConv(self.input_dim, self.hidden_dim)
            self.conv2 = GCNConv(self.hidden_dim, self.hidden_dim)
            self.conv3 = GCNConv(self.hidden_dim, self.hidden_dim)
        elif self.gnn_type == 'gat':
            self.conv1 = GATConv(self.input_dim, self.hidden_dim, heads=4, concat=False)
            self.conv2 = GATConv(self.hidden_dim, self.hidden_dim, heads=4, concat=False)
            self.conv3 = GATConv(self.hidden_dim, self.hidden_dim, heads=1)
        elif self.gnn_type == 'sage':
            self.conv1 = SAGEConv(self.input_dim, self.hidden_dim)
            self.conv2 = SAGEConv(self.hidden_dim, self.hidden_dim)
            self.conv3 = SAGEConv(self.hidden_dim, self.hidden_dim)
        
        # Batch normalization
        self.bn1 = nn.BatchNorm1d(self.hidden_dim)
        self.bn2 = nn.BatchNorm1d(self.hidden_dim)
        
        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim // 2, self.num_classes)
        )
    
    def forward(self, x, edge_index, batch=None):
        # First GNN layer
        x = self.conv1(x, edge_index)
        x = self.bn1(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Second GNN layer
        x = self.conv2(x, edge_index)
        x = self.bn2(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Third GNN layer
        x = self.conv3(x, edge_index)
        
        # Global pooling for graph-level prediction
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Classification
        return self.classifier(x)

class EntityClassificationGNN(torch.nn.Module):
    """
    GNN for classifying entities (Person, Organization, Topic, etc.) based on context.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.num_classes = config['num_classes']
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        self.num_layers = config.get('num_layers', 3)
        
        # Build GNN layers
        self.convs = nn.ModuleList()
        self.batch_norms = nn.ModuleList()
        
        # Input layer
        self.convs.append(GCNConv(self.input_dim, self.hidden_dim))
        self.batch_norms.append(nn.BatchNorm1d(self.hidden_dim))
        
        # Hidden layers
        for _ in range(self.num_layers - 2):
            self.convs.append(GCNConv(self.hidden_dim, self.hidden_dim))
            self.batch_norms.append(nn.BatchNorm1d(self.hidden_dim))
        
        # Output layer
        self.convs.append(GCNConv(self.hidden_dim, self.hidden_dim))
        
        # Classification head with attention
        self.attention = nn.MultiheadAttention(self.hidden_dim, num_heads=8, batch_first=True)
        self.classifier = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim // 2, self.num_classes)
        )
    
    def forward(self, x, edge_index, batch=None):
        # Apply GNN layers
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.batch_norms[i](x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Final layer
        x = self.convs[-1](x, edge_index)
        
        # Apply self-attention for better representation
        if x.dim() == 2:
            x = x.unsqueeze(0)  # Add batch dimension for attention
        
        attended_x, _ = self.attention(x, x, x)
        
        if attended_x.dim() == 3:
            attended_x = attended_x.squeeze(0)  # Remove batch dimension
        
        # Classification
        return self.classifier(attended_x)

class TopicClassificationGNN(torch.nn.Module):
    """
    Specialized GNN for topic classification and topic modeling.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.num_topics = config['num_classes']
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        
        # Topic-aware GNN layers
        self.topic_conv1 = GATConv(self.input_dim, self.hidden_dim, heads=8, concat=False)
        self.topic_conv2 = GATConv(self.hidden_dim, self.hidden_dim, heads=4, concat=False)
        self.topic_conv3 = GATConv(self.hidden_dim, self.hidden_dim, heads=1)
        
        # Batch normalization
        self.bn1 = nn.BatchNorm1d(self.hidden_dim)
        self.bn2 = nn.BatchNorm1d(self.hidden_dim)
        
        # Topic distribution head
        self.topic_classifier = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim, self.num_topics),
            nn.Softmax(dim=-1)  # Topic distribution
        )
        
        # Topic coherence scorer
        self.coherence_scorer = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(self.hidden_dim // 2, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x, edge_index, batch=None, return_coherence=False):
        # Topic-aware convolutions with attention
        x = self.topic_conv1(x, edge_index)
        x = self.bn1(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        x = self.topic_conv2(x, edge_index)
        x = self.bn2(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        x = self.topic_conv3(x, edge_index)
        
        # Global pooling for document-level topics
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Topic classification
        topic_dist = self.topic_classifier(x)
        
        if return_coherence:
            coherence = self.coherence_scorer(x)
            return topic_dist, coherence
        
        return topic_dist

class HierarchicalClassificationGNN(torch.nn.Module):
    """
    Hierarchical GNN for multi-level classification (e.g., category -> subcategory).
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.num_levels = config.get('num_levels', 2)
        self.level_classes = config['level_classes']  # List of classes per level
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        
        # Shared GNN encoder
        self.encoder = nn.ModuleList([
            GCNConv(self.input_dim if i == 0 else self.hidden_dim, self.hidden_dim)
            for i in range(3)
        ])
        
        self.batch_norms = nn.ModuleList([
            nn.BatchNorm1d(self.hidden_dim) for _ in range(2)
        ])
        
        # Level-specific classifiers
        self.level_classifiers = nn.ModuleList()
        for level_size in self.level_classes:
            self.level_classifiers.append(
                nn.Sequential(
                    nn.Linear(self.hidden_dim, self.hidden_dim // 2),
                    nn.ReLU(),
                    nn.Dropout(self.dropout),
                    nn.Linear(self.hidden_dim // 2, level_size)
                )
            )
    
    def forward(self, x, edge_index, batch=None):
        # Shared encoding
        for i, conv in enumerate(self.encoder[:-1]):
            x = conv(x, edge_index)
            x = self.batch_norms[i](x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Final encoding layer
        x = self.encoder[-1](x, edge_index)
        
        # Global pooling
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Multi-level classification
        level_outputs = []
        for classifier in self.level_classifiers:
            level_outputs.append(classifier(x))
        
        return level_outputs

class SentimentClassificationGNN(torch.nn.Module):
    """
    GNN for sentiment analysis of documents and communications.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        self.num_sentiments = config.get('num_sentiments', 3)  # Positive, Negative, Neutral
        
        # Sentiment-aware GNN layers
        self.conv1 = SAGEConv(self.input_dim, self.hidden_dim)
        self.conv2 = SAGEConv(self.hidden_dim, self.hidden_dim)
        self.conv3 = SAGEConv(self.hidden_dim, self.hidden_dim)
        
        # Batch normalization
        self.bn1 = nn.BatchNorm1d(self.hidden_dim)
        self.bn2 = nn.BatchNorm1d(self.hidden_dim)
        
        # Sentiment classifier
        self.sentiment_classifier = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim // 2, self.num_sentiments)
        )
        
        # Confidence scorer
        self.confidence_scorer = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim // 4),
            nn.ReLU(),
            nn.Linear(self.hidden_dim // 4, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x, edge_index, batch=None, return_confidence=False):
        # GNN layers
        x = self.conv1(x, edge_index)
        x = self.bn1(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        x = self.conv2(x, edge_index)
        x = self.bn2(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        x = self.conv3(x, edge_index)
        
        # Global pooling
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Sentiment classification
        sentiment_logits = self.sentiment_classifier(x)
        
        if return_confidence:
            confidence = self.confidence_scorer(x)
            return sentiment_logits, confidence
        
        return sentiment_logits

class MultiLabelClassificationGNN(torch.nn.Module):
    """
    GNN for multi-label classification where documents can belong to multiple categories.
    """
    
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.num_labels = config['num_classes']
        self.hidden_dim = config['hidden_dim']
        self.input_dim = config['input_dim']
        self.dropout = config['dropout']
        
        # Multi-label aware GNN
        self.conv1 = GATConv(self.input_dim, self.hidden_dim, heads=4, concat=False)
        self.conv2 = GATConv(self.hidden_dim, self.hidden_dim, heads=4, concat=False)
        self.conv3 = GATConv(self.hidden_dim, self.hidden_dim, heads=1)
        
        # Batch normalization
        self.bn1 = nn.BatchNorm1d(self.hidden_dim)
        self.bn2 = nn.BatchNorm1d(self.hidden_dim)
        
        # Multi-label classifier (sigmoid for independent probabilities)
        self.multi_label_classifier = nn.Sequential(
            nn.Linear(self.hidden_dim, self.hidden_dim),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim, self.hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(self.dropout),
            nn.Linear(self.hidden_dim // 2, self.num_labels),
            nn.Sigmoid()  # Independent probabilities for each label
        )
    
    def forward(self, x, edge_index, batch=None):
        # GNN layers with attention
        x = self.conv1(x, edge_index)
        x = self.bn1(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        x = self.conv2(x, edge_index)
        x = self.bn2(x)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        
        x = self.conv3(x, edge_index)
        
        # Global pooling
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Multi-label classification
        return self.multi_label_classifier(x)

def create_classification_model(model_type: str, config: dict) -> torch.nn.Module:
    """Factory function to create classification models."""
    if model_type == 'document_classification':
        return DocumentClassificationGNN(config)
    elif model_type == 'entity_classification':
        return EntityClassificationGNN(config)
    elif model_type == 'topic_classification':
        return TopicClassificationGNN(config)
    elif model_type == 'hierarchical_classification':
        return HierarchicalClassificationGNN(config)
    elif model_type == 'sentiment_classification':
        return SentimentClassificationGNN(config)
    elif model_type == 'multi_label_classification':
        return MultiLabelClassificationGNN(config)
    else:
        raise ValueError(f"Unknown classification model type: {model_type}")

def load_classification_model(model_path: str, model_type: str, config: dict) -> torch.nn.Module:
    """Load a trained classification model from disk."""
    model = create_classification_model(model_type, config)
    model.load_state_dict(torch.load(model_path, map_location='cpu'))
    model.eval()
    logger.info(f"Loaded {model_type} model from {model_path}")
    return model
