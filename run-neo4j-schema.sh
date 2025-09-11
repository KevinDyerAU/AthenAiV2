#!/bin/bash
# Neo4j Schema Execution Script for AthenAI
# This script runs the Neo4j knowledge substrate schema

# Set default values from environment variables
NEO4J_URI=${NEO4J_URI:-""}
NEO4J_USER=${NEO4J_USER:-""}
NEO4J_PASSWORD=${NEO4J_PASSWORD:-""}
SCHEMA_FILE=${1:-"db/neo4j/schema.cypher"}

# Check if Neo4j environment variables are set
if [ -z "$NEO4J_URI" ]; then
    echo "Error: NEO4J_URI environment variable not set"
    echo "Please set: export NEO4J_URI=bolt://localhost:7687 (or your Neo4j URI)"
    exit 1
fi

if [ -z "$NEO4J_USER" ]; then
    echo "Error: NEO4J_USER environment variable not set"
    echo "Please set: export NEO4J_USER=neo4j (or your username)"
    exit 1
fi

if [ -z "$NEO4J_PASSWORD" ]; then
    echo "Error: NEO4J_PASSWORD environment variable not set"
    echo "Please set: export NEO4J_PASSWORD=your_password"
    exit 1
fi

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "Error: Schema file not found: $SCHEMA_FILE"
    exit 1
fi

echo "Running Neo4j Knowledge Substrate Schema..."
echo "URI: $NEO4J_URI"
echo "User: $NEO4J_USER"
echo "Schema: $SCHEMA_FILE"

# Check if cypher-shell is available
if command -v cypher-shell &> /dev/null; then
    echo "Using cypher-shell..."
    cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -f "$SCHEMA_FILE"
    
    if [ $? -eq 0 ]; then
        echo "Neo4j schema execution completed successfully!"
    else
        echo "Error executing Neo4j schema"
        exit 1
    fi
else
    echo "cypher-shell not found."
    echo "Please install Neo4j Desktop or Neo4j Server with command line tools."
    echo "Alternative: Copy the contents of $SCHEMA_FILE and paste into Neo4j Browser"
    exit 1
fi
