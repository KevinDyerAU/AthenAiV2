#!/usr/bin/env bash
# AthenAI Simplified Startup & Initialization Script
# Simplified version of deploy-local.sh for basic local development

set -euo pipefail

# --- Paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
ENV_FILE="$PROJECT_DIR/.env"
LOG_FILE="$PROJECT_DIR/startup.log"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.simplified.example...${NC}"
    if [ -f .env.simplified.example ]; then
        cp .env.simplified.example .env
        echo -e "${GREEN}✅ Created .env file. Please update it with your credentials.${NC}"
    else
        echo -e "${RED}❌ .env.simplified.example not found. Please create .env manually.${NC}"
        exit 1
    fi
fi

# Load environment variables
source .env

echo -e "${BLUE}📋 Configuration loaded:${NC}"
echo "  - Node Environment: ${NODE_ENV:-development}"
echo "  - Port: ${PORT:-3000}"
echo "  - App Name: ${APP_NAME:-athenai}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check PostgreSQL connection
check_postgres() {
    echo -e "${BLUE}🔍 Checking PostgreSQL connection...${NC}"
    
    if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "https://your-project.supabase.co" ]; then
        echo -e "${YELLOW}⚠️  Supabase URL not configured. Skipping PostgreSQL initialization.${NC}"
        echo "   Please update SUPABASE_URL in your .env file."
        return 1
    fi
    
    echo -e "${GREEN}✅ Supabase configuration found.${NC}"
    return 0
}

# Function to check Neo4j connection
check_neo4j() {
    echo -e "${BLUE}🔍 Checking Neo4j connection...${NC}"
    
    if [ -z "$NEO4J_URI" ] || [ "$NEO4J_URI" = "neo4j+s://your-instance.databases.neo4j.io" ]; then
        echo -e "${YELLOW}⚠️  Neo4j URI not configured. Skipping Neo4j initialization.${NC}"
        echo "   Please update NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in your .env file."
        return 1
    fi
    
    echo -e "${GREEN}✅ Neo4j configuration found.${NC}"
    return 0
}

# Function to initialize PostgreSQL schema
init_postgres() {
    echo -e "${BLUE}🐘 Initializing PostgreSQL schema...${NC}"
    
    if [ ! -f "db/postgres/schema.sql" ]; then
        echo -e "${RED}❌ PostgreSQL schema file not found at db/postgres/schema.sql${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ PostgreSQL schema file found.${NC}"
    echo -e "${YELLOW}📝 Note: Please run the schema manually in your Supabase SQL editor:${NC}"
    echo "   1. Open your Supabase dashboard"
    echo "   2. Go to SQL Editor"
    echo "   3. Copy and paste the contents of db/postgres/schema.sql"
    echo "   4. Run the query"
    
    return 0
}

# Function to initialize Neo4j schema
init_neo4j() {
    echo -e "${BLUE}🕸️  Initializing Neo4j schema...${NC}"
    
    if [ ! -f "db/neo4j/schema.cypher" ]; then
        echo -e "${RED}❌ Neo4j schema file not found at db/neo4j/schema.cypher${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Neo4j schema file found.${NC}"
    echo -e "${YELLOW}📝 Note: Please run the schema manually in Neo4j Browser:${NC}"
    echo "   1. Open Neo4j Browser at your instance URL"
    echo "   2. Login with your credentials"
    echo "   3. Copy and paste the contents of db/neo4j/schema.cypher"
    echo "   4. Run the query"
    
    return 0
}

# Function to install Node.js dependencies
install_dependencies() {
    echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found${NC}"
        return 1
    fi
    
    if command_exists npm; then
        echo -e "${BLUE}🔧 Running npm install...${NC}"
        npm install
        echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ npm not found. Please install Node.js first.${NC}"
        return 1
    fi
}

# Function to run database tests
test_connections() {
    echo -e "${BLUE}🧪 Testing database connections...${NC}"
    
    if command_exists npm; then
        echo -e "${BLUE}🔧 Running connection tests...${NC}"
        npm test -- --testNamePattern="database" --verbose || true
        echo -e "${YELLOW}📝 Note: Some tests may fail if databases are not fully configured.${NC}"
    else
        echo -e "${YELLOW}⚠️  npm not found. Skipping connection tests.${NC}"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}🎯 Starting AthenAI database initialization...${NC}"
    echo ""
    
    # Install dependencies first
    install_dependencies
    echo ""
    
    # Check and initialize PostgreSQL
    if check_postgres; then
        init_postgres
    fi
    echo ""
    
    # Check and initialize Neo4j
    if check_neo4j; then
        init_neo4j
    fi
    echo ""
    
    # Test connections
    test_connections
    echo ""
    
    echo -e "${GREEN}🎉 Database initialization complete!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo "  1. Update your .env file with actual database credentials"
    echo "  2. Run the SQL/Cypher schemas in your respective database consoles"
    echo "  3. Start the application with: npm run dev"
    echo "  4. Visit http://localhost:3000 to test the application"
    echo ""
    echo -e "${YELLOW}💡 Tip: Use 'npm test' to verify your setup${NC}"
}

# Run main function
main "$@"
