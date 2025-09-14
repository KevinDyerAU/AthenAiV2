#!/usr/bin/env bash
# AthenAI Knowledge Substrate Setup Script
# This script helps set up the complete knowledge substrate for AthenAI

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
CHECK_ONLY=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --help|-h)
            SHOW_HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

show_usage() {
    cat << EOF
AthenAI Knowledge Substrate Setup

Usage: ./setup-knowledge-substrate.sh [--check-only] [--help]

Options:
  --check-only    Check configuration and files only (no setup)
  --help, -h      Show this help and exit

This script will:
  1. Verify knowledge substrate files exist
  2. Check database configurations
  3. Provide setup instructions for Supabase and Neo4j
  4. Validate the knowledge substrate implementation
EOF
}

if [ "$SHOW_HELP" = true ]; then
    show_usage
    exit 0
fi

echo -e "${GREEN}🧠 AthenAI Knowledge Substrate Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check if knowledge substrate files exist
check_knowledge_substrate_files() {
    echo -e "${BLUE}📁 Checking knowledge substrate files...${NC}"
    
    declare -A files=(
        ["db/postgres/schema.sql"]="Supabase PostgreSQL schema"
        ["db/neo4j/advanced_schema.cypher"]="Neo4j graph database schema"
        ["KNOWLEDGE_SUBSTRATE_README.md"]="Documentation"
        ["src/services/database.js"]="Database service implementation"
    )
    
    local all_found=true
    for file in "${!files[@]}"; do
        if [ -f "$file" ]; then
            echo -e "  ${GREEN}✅ ${files[$file]}: $file${NC}"
        else
            echo -e "  ${RED}❌ Missing ${files[$file]}: $file${NC}"
            all_found=false
        fi
    done
    
    [ "$all_found" = true ]
}

# Check environment configuration
check_environment_config() {
    echo -e "${BLUE}🔧 Checking environment configuration...${NC}"
    
    if [ ! -f ".env" ]; then
        echo -e "  ${RED}❌ .env file not found${NC}"
        return 1
    fi
    
    # Load environment variables
    source .env
    
    declare -A configs=(
        ["SUPABASE_URL"]="Supabase database URL"
        ["SUPABASE_SERVICE_ROLE_KEY"]="Supabase service role key"
        ["NEO4J_URI"]="Neo4j database URI"
        ["NEO4J_USER"]="Neo4j username"
        ["NEO4J_PASSWORD"]="Neo4j password"
    )
    
    local all_configured=true
    for config in "${!configs[@]}"; do
        local value="${!config:-}"
        if [ -z "$value" ] || [[ "$value" == *"your-"* ]] || [[ "$value" == *"example"* ]]; then
            echo -e "  ${YELLOW}⚠️  ${configs[$config]} not configured: $config${NC}"
            all_configured=false
        else
            echo -e "  ${GREEN}✅ ${configs[$config]} configured${NC}"
        fi
    done
    
    [ "$all_configured" = true ]
}

# Check database service implementation
check_database_service_implementation() {
    echo -e "${BLUE}🔍 Checking database service implementation...${NC}"
    
    if [ ! -f "src/services/database.js" ]; then
        echo -e "  ${RED}❌ Database service not found${NC}"
        return 1
    fi
    
    local required_methods=(
        "createKnowledgeEntity"
        "getKnowledgeEntitiesByDomain"
        "storeResearchInsights"
        "getResearchInsightsByQueryHash"
        "storeQAInsights"
        "getQAInsightsByContentHash"
        "storeWebSearchCache"
        "getWebSearchCache"
    )
    
    local all_implemented=true
    for method in "${required_methods[@]}"; do
        if grep -q "async[[:space:]]*$method[[:space:]]*(" "src/services/database.js"; then
            echo -e "  ${GREEN}✅ Method implemented: $method${NC}"
        else
            echo -e "  ${RED}❌ Method missing: $method${NC}"
            all_implemented=false
        fi
    done
    
    [ "$all_implemented" = true ]
}

# Provide setup instructions
show_setup_instructions() {
    echo -e "${BLUE}📋 Knowledge Substrate Setup Instructions${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
    
    echo -e "${YELLOW}1. Supabase PostgreSQL Setup:${NC}"
    echo -e "   • Open your Supabase dashboard"
    echo -e "   • Navigate to SQL Editor"
    echo -e "   • Copy and paste the contents of: db/postgres/schema.sql"
    echo -e "   • Execute the SQL script"
    echo ""
    
    echo -e "${YELLOW}2. Neo4j Graph Database Setup:${NC}"
    echo -e "   • Open Neo4j Browser at your instance URL"
    echo -e "   • Login with your credentials"
    echo -e "   • Copy and paste the contents of: db/neo4j/advanced_schema.cypher"
    echo -e "   • Execute the Cypher script"
    echo ""
    
    echo -e "${YELLOW}3. Environment Configuration:${NC}"
    echo -e "   • Update .env file with your actual database credentials"
    echo -e "   • Ensure all required environment variables are set"
    echo ""
    
    echo -e "${YELLOW}4. Verification:${NC}"
    echo -e "   • Run: npm test -- --testNamePattern='database'"
    echo -e "   • Start the application: npm run dev"
    echo -e "   • Test the chat interface at: http://localhost:3000/chat.html"
    echo ""
}

# Show knowledge substrate features
show_knowledge_substrate_features() {
    echo -e "${BLUE}🧠 Knowledge Substrate Features${NC}"
    echo -e "${BLUE}===============================${NC}"
    echo ""
    
    echo -e "${YELLOW}Research Agent Integration:${NC}"
    echo -e "  • Caches web search results for 24 hours"
    echo -e "  • Stores research insights and patterns"
    echo -e "  • Retrieves similar research by domain and query hash"
    echo -e "  • Creates knowledge entities for significant findings"
    echo ""
    
    echo -e "${YELLOW}Quality Assurance Agent Integration:${NC}"
    echo -e "  • Stores QA insights and quality metrics"
    echo -e "  • Tracks improvement patterns"
    echo -e "  • Retrieves similar assessments by content hash"
    echo -e "  • Builds knowledge base of quality patterns"
    echo ""
    
    echo -e "${YELLOW}Domain Classification:${NC}"
    echo -e "  • ai, software, security, performance, data, api, general"
    echo ""
    
    echo -e "${YELLOW}Performance Features:${NC}"
    echo -e "  • Vector similarity search with pgvector"
    echo -e "  • Intelligent caching with Redis support"
    echo -e "  • Optimized indexes for fast retrieval"
    echo -e "  • Confidence scoring and provenance tracking"
    echo ""
}

# Main execution
main() {
    local files_ok=true
    local config_ok=true
    local implementation_ok=true
    
    if ! check_knowledge_substrate_files; then
        files_ok=false
    fi
    echo ""
    
    if ! check_environment_config; then
        config_ok=false
    fi
    echo ""
    
    if ! check_database_service_implementation; then
        implementation_ok=false
    fi
    echo ""
    
    if [ "$CHECK_ONLY" = true ]; then
        if [ "$files_ok" = true ] && [ "$config_ok" = true ] && [ "$implementation_ok" = true ]; then
            echo -e "${GREEN}✅ Knowledge substrate is ready for setup!${NC}"
        else
            echo -e "${YELLOW}⚠️  Knowledge substrate needs attention before setup${NC}"
        fi
        return
    fi
    
    show_setup_instructions
    show_knowledge_substrate_features
    
    echo -e "${BLUE}📚 Additional Resources:${NC}"
    echo -e "  • Read KNOWLEDGE_SUBSTRATE_README.md for detailed documentation"
    echo -e "  • Check src/services/database.js for API reference"
    echo -e "  • Review agent implementations in src/agents/"
    echo ""
    
    if [ "$files_ok" = true ] && [ "$config_ok" = true ] && [ "$implementation_ok" = true ]; then
        echo -e "${GREEN}🎉 Knowledge substrate is ready! Follow the setup instructions above.${NC}"
    else
        echo -e "${YELLOW}⚠️  Please address the issues above before proceeding with setup.${NC}"
    fi
}

# Run main function
main "$@"
