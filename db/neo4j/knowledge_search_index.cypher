// Neo4j Knowledge Search Index Creation
// Run these commands in Neo4j Browser to create full-text search indexes

// Create full-text search index for knowledge entities
CALL db.index.fulltext.createNodeIndex(
  "knowledge_search", 
  ["Document", "Chunk", "Entity", "Person", "Topic", "Organization"], 
  ["content", "name", "description", "title", "text"]
);

// Create full-text search index for relationships
CALL db.index.fulltext.createRelationshipIndex(
  "relationship_search",
  ["HAS_EXPERTISE", "MENTIONS", "AUTHORED", "RELATED_TO", "WORKS_FOR"],
  ["description", "context", "source"]
);

// Create composite indexes for better performance
CREATE INDEX person_name_index IF NOT EXISTS FOR (p:Person) ON (p.name);
CREATE INDEX person_email_index IF NOT EXISTS FOR (p:Person) ON (p.email_address);
CREATE INDEX topic_name_index IF NOT EXISTS FOR (t:Topic) ON (t.name);
CREATE INDEX document_title_index IF NOT EXISTS FOR (d:Document) ON (d.title);
CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type);

// Create constraint for unique person emails
CREATE CONSTRAINT person_email_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.email_address IS UNIQUE;

// Create constraint for unique document IDs
CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;

// Verify indexes were created
SHOW INDEXES;

// Example queries to test the full-text search
// Search for knowledge about a specific topic:
// CALL db.index.fulltext.queryNodes("knowledge_search", "machine learning") 
// YIELD node, score 
// RETURN node, score 
// ORDER BY score DESC 
// LIMIT 10;

// Search with relationship context:
// CALL db.index.fulltext.queryNodes("knowledge_search", "artificial intelligence")
// YIELD node, score
// MATCH (node)-[r*1..2]-(related)
// RETURN node, related, r, score
// ORDER BY score DESC
// LIMIT 20;
