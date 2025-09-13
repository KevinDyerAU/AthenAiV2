import os
import asyncio
from typing import Dict, List, Any, Optional
from neo4j import GraphDatabase, AsyncGraphDatabase
from gds import GraphDataScience
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class Neo4jClient:
    """
    Neo4j client with Graph Data Science integration for ML pipeline.
    """
    
    def __init__(self):
        self.uri = os.getenv('NEO4J_URI')
        self.user = os.getenv('NEO4J_USER', 'neo4j')
        self.password = os.getenv('NEO4J_PASSWORD')
        
        if not all([self.uri, self.password]):
            raise ValueError("Neo4j connection parameters not found in environment variables")
        
        # Initialize drivers
        self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
        self.async_driver = AsyncGraphDatabase.driver(self.uri, auth=(self.user, self.password))
        
        # Initialize GDS client
        self.gds = GraphDataScience(self.uri, auth=(self.user, self.password))
        
        logger.info("Neo4j client initialized successfully")
    
    def session(self):
        """Create a new session."""
        return self.driver.session()
    
    async def async_session(self):
        """Create a new async session."""
        return self.async_driver.session()
    
    async def verify_connection(self) -> bool:
        """Verify Neo4j connection."""
        try:
            async with self.async_driver.session() as session:
                result = await session.run("RETURN 1 as test")
                record = await result.single()
                return record["test"] == 1
        except Exception as e:
            logger.error(f"Neo4j connection verification failed: {e}")
            return False
    
    async def get_graph_statistics(self) -> Dict[str, Any]:
        """Get basic graph statistics."""
        try:
            async with self.async_driver.session() as session:
                # Node counts by label
                node_counts = {}
                labels = ['Document', 'Person', 'Topic', 'Organization', 'Entity', 'Chunk']
                
                for label in labels:
                    result = await session.run(f"MATCH (n:{label}) RETURN count(n) as count")
                    record = await result.single()
                    node_counts[label] = record["count"] if record else 0
                
                # Relationship counts by type
                rel_counts = {}
                rel_types = ['MENTIONS', 'WORKS_FOR', 'RELATED_TO', 'HAS_EXPERTISE', 'HAS_CHUNK']
                
                for rel_type in rel_types:
                    result = await session.run(f"MATCH ()-[r:{rel_type}]-() RETURN count(r) as count")
                    record = await result.single()
                    rel_counts[rel_type] = record["count"] if record else 0
                
                return {
                    'nodes': node_counts,
                    'relationships': rel_counts,
                    'total_nodes': sum(node_counts.values()),
                    'total_relationships': sum(rel_counts.values()),
                    'timestamp': datetime.now().isoformat()
                }
        except Exception as e:
            logger.error(f"Failed to get graph statistics: {e}")
            return {}
    
    def project_graph_for_gds(self, graph_name: str = "knowledge_graph") -> bool:
        """Project graph for Graph Data Science operations."""
        try:
            # Check if graph already exists
            try:
                self.gds.graph.drop(graph_name)
                logger.info(f"Dropped existing graph projection: {graph_name}")
            except:
                pass  # Graph doesn't exist, which is fine
            
            # Project the graph
            self.gds.run_cypher(f"""
                CALL gds.graph.project(
                    '{graph_name}',
                    ['Document', 'Person', 'Topic', 'Organization', 'Entity'],
                    {{
                        MENTIONS: {{orientation: 'UNDIRECTED'}},
                        WORKS_FOR: {{orientation: 'UNDIRECTED'}},
                        RELATED_TO: {{orientation: 'UNDIRECTED'}},
                        HAS_EXPERTISE: {{orientation: 'UNDIRECTED'}}
                    }}
                )
            """)
            
            logger.info(f"Successfully projected graph: {graph_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to project graph {graph_name}: {e}")
            return False
    
    def generate_node_embeddings(self, graph_name: str = "knowledge_graph", 
                                embedding_dim: int = 128) -> bool:
        """Generate node embeddings using FastRP algorithm."""
        try:
            # Generate embeddings using FastRP
            self.gds.run_cypher(f"""
                CALL gds.fastRP.mutate(
                    '{graph_name}',
                    {{
                        embeddingDimension: {embedding_dim},
                        mutateProperty: 'embedding',
                        randomSeed: 42
                    }}
                )
            """)
            
            logger.info(f"Successfully generated embeddings for graph: {graph_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings for {graph_name}: {e}")
            return False
    
    def export_graph_data(self, graph_name: str = "knowledge_graph") -> Dict[str, Any]:
        """Export graph data for ML training."""
        try:
            # Export node data with embeddings
            node_query = f"""
                CALL gds.graph.nodeProperty.stream('{graph_name}', 'embedding')
                YIELD nodeId, propertyValue
                RETURN gds.util.asNode(nodeId) as node, propertyValue as embedding, nodeId
            """
            
            nodes_df = self.gds.run_cypher(node_query)
            
            # Export relationship data
            edge_query = f"""
                CALL gds.graph.relationshipProperty.stream('{graph_name}', 'weight', ['*'])
                YIELD sourceNodeId, targetNodeId, relationshipType
                RETURN sourceNodeId, targetNodeId, relationshipType
            """
            
            edges_df = self.gds.run_cypher(edge_query)
            
            return {
                'nodes': nodes_df,
                'edges': edges_df,
                'export_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to export graph data: {e}")
            return {}
    
    async def store_ml_predictions(self, predictions: List[Dict[str, Any]]) -> bool:
        """Store ML predictions back to the graph."""
        try:
            async with self.async_driver.session() as session:
                for prediction in predictions:
                    if prediction['type'] == 'link_prediction':
                        await self._store_link_prediction(session, prediction)
                    elif prediction['type'] == 'expertise_prediction':
                        await self._store_expertise_prediction(session, prediction)
                
                logger.info(f"Stored {len(predictions)} ML predictions")
                return True
                
        except Exception as e:
            logger.error(f"Failed to store ML predictions: {e}")
            return False
    
    async def _store_link_prediction(self, session, prediction: Dict[str, Any]):
        """Store link prediction result."""
        await session.run("""
            MATCH (s {name: $source})
            MATCH (t {name: $target})
            MERGE (s)-[r:PREDICTED_RELATIONSHIP]->(t)
            SET r.confidence = $confidence,
                r.relationship_type = $rel_type,
                r.predicted_at = datetime(),
                r.source = 'ml_prediction'
        """, {
            'source': prediction['source'],
            'target': prediction['target'],
            'confidence': prediction['confidence'],
            'rel_type': prediction['relationship_type']
        })
    
    async def _store_expertise_prediction(self, session, prediction: Dict[str, Any]):
        """Store expertise prediction result."""
        await session.run("""
            MATCH (p:Person {name: $person})
            MATCH (t:Topic {name: $topic})
            MERGE (p)-[r:PREDICTED_EXPERTISE]->(t)
            SET r.confidence = $confidence,
                r.predicted_at = datetime(),
                r.source = 'ml_prediction'
        """, {
            'person': prediction['person'],
            'topic': prediction['topic'],
            'confidence': prediction['confidence']
        })
    
    def close(self):
        """Close all connections."""
        if hasattr(self, 'driver'):
            self.driver.close()
        if hasattr(self, 'async_driver'):
            asyncio.create_task(self.async_driver.close())
        logger.info("Neo4j client connections closed")
    
    def __del__(self):
        """Cleanup on deletion."""
        self.close()
