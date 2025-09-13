#!/bin/bash
# AthenAI ML Database Initialization Script for Unix/Linux/macOS
# This script initializes the ML service database schema

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
CHECK_ONLY=false
SKIP_SUPABASE=false
SKIP_NEO4J=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --skip-supabase)
            SKIP_SUPABASE=true
            shift
            ;;
        --skip-neo4j)
            SKIP_NEO4J=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

function print_color() {
    printf "${2}${1}${NC}\n"
}

print_color "🗄️  AthenAI ML Database Initialization" $BLUE
print_color "======================================" $BLUE

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_color "❌ .env file not found. Please run setup first." $RED
    exit 1
fi

# Load environment variables
print_color "📋 Loading environment variables..." $BLUE
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check required environment variables
required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    print_color "❌ Missing required environment variables:" $RED
    for var in "${missing_vars[@]}"; do
        print_color "   - $var" $RED
    done
    print_color "Please update your .env file with the required ML service configuration." $YELLOW
    exit 1
fi

if [ "$CHECK_ONLY" = true ]; then
    print_color "🔍 Checking ML database configuration..." $YELLOW
    
    # Check Supabase connection
    if [ "$SKIP_SUPABASE" = false ]; then
        print_color "🔗 Testing Supabase connection..." $BLUE
        if command -v curl >/dev/null 2>&1; then
            if curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
                    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
                    "$SUPABASE_URL/rest/v1/" >/dev/null; then
                print_color "✅ Supabase connection successful" $GREEN
            else
                print_color "❌ Supabase connection failed" $RED
            fi
        else
            print_color "⚠️  curl not available, skipping connection test" $YELLOW
        fi
    fi
    
    # Check Neo4j connection (if configured)
    if [ "$SKIP_NEO4J" = false ]; then
        if [ -n "$NEO4J_URI" ]; then
            print_color "🔗 Neo4j configured: $NEO4J_URI" $GREEN
        else
            print_color "⚠️  Neo4j not configured (optional)" $YELLOW
        fi
    fi
    
    print_color "✅ Database configuration check complete" $GREEN
    exit 0
fi

# Initialize Supabase ML schema
if [ "$SKIP_SUPABASE" = false ]; then
    print_color "🗄️  Initializing Supabase ML schema..." $BLUE
    
    if [ -f "db/supabase/ml_schema.sql" ]; then
        print_color "📄 Found ML schema file" $GREEN
        print_color "⚠️  Please execute the following SQL in your Supabase SQL Editor:" $YELLOW
        echo ""
        print_color "1. Go to your Supabase project dashboard" $BLUE
        print_color "2. Navigate to SQL Editor" $BLUE
        print_color "3. Create a new query" $BLUE
        print_color "4. Copy and paste the contents of: db/supabase/ml_schema.sql" $BLUE
        print_color "5. Execute the query" $BLUE
        echo ""
        print_color "This will create all ML service tables, functions, and indexes." $YELLOW
    else
        print_color "❌ ML schema file not found: db/supabase/ml_schema.sql" $RED
        exit 1
    fi
    
    # Also mention the functions file
    if [ -f "db/supabase/functions.sql" ]; then
        print_color "📄 ML functions are included in: db/supabase/functions.sql" $GREEN
        print_color "   (This includes both core and ML service functions)" $BLUE
    fi
fi

# Initialize Neo4j ML schema (if configured)
if [ "$SKIP_NEO4J" = false ]; then
    if [ -n "$NEO4J_URI" ]; then
        print_color "🗄️  Initializing Neo4j ML schema..." $BLUE
        
        if [ -f "db/neo4j/ml_schema.cypher" ]; then
            print_color "📄 Found Neo4j ML schema file" $GREEN
            print_color "⚠️  Please execute the following Cypher in your Neo4j Browser:" $YELLOW
            echo ""
            print_color "1. Open Neo4j Browser: $NEO4J_URI" $BLUE
            print_color "2. Copy and paste the contents of: db/neo4j/ml_schema.cypher" $BLUE
            print_color "3. Execute the Cypher commands" $BLUE
            echo ""
            print_color "This will create ML-specific constraints, indexes, and sample queries." $YELLOW
        else
            print_color "❌ Neo4j ML schema file not found: db/neo4j/ml_schema.cypher" $RED
        fi
        
        # Also mention the advanced schema
        if [ -f "db/neo4j/advanced_schema.cypher" ]; then
            print_color "📄 Enhanced schema with ML extensions: db/neo4j/advanced_schema.cypher" $GREEN
            print_color "   (This includes both core and ML service schema)" $BLUE
        fi
    else
        print_color "⚠️  Neo4j not configured. Skipping Neo4j ML schema initialization." $YELLOW
        print_color "   Neo4j is optional but recommended for advanced graph operations." $BLUE
    fi
fi

echo ""
print_color "🎉 ML Database Initialization Guide Complete!" $GREEN
print_color "=============================================" $GREEN
echo ""
print_color "Database Schema Files:" $BLUE
print_color "📄 Supabase ML Schema: db/supabase/ml_schema.sql" $YELLOW
print_color "📄 Supabase Functions: db/supabase/functions.sql" $YELLOW
print_color "📄 Neo4j ML Schema: db/neo4j/ml_schema.cypher" $YELLOW
print_color "📄 Neo4j Advanced Schema: db/neo4j/advanced_schema.cypher" $YELLOW
echo ""
print_color "Next steps:" $BLUE
print_color "1. Execute the SQL files in your Supabase project" $YELLOW
print_color "2. Execute the Cypher files in your Neo4j instance (if using Neo4j)" $YELLOW
print_color "3. Test ML service: npm run ml:test:unix" $YELLOW
print_color "4. Start ML service: npm run ml:service" $YELLOW
echo ""
print_color "For detailed instructions, see NEXT_STEPS_GUIDE.md" $BLUE
