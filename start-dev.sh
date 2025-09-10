#!/usr/bin/env bash
# AthenAI Simplified Startup Script
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

log()  { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
info() { echo -e "${CYAN}[INFO]${NC} $*" | tee -a "$LOG_FILE"; }
success(){ echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; exit 1; }

usage() {
  cat <<'EOF'
AthenAI Simplified Startup & Initialization

Usage: ./start-dev.sh [--dev | --check | --start | --help]

Options:
  --dev     Development mode: install deps, setup env, start server
  --check   Check configuration and dependencies only
  --start   Start the application server
  --help    Show this help and exit

Phases:
  1) Environment setup and validation
  2) Dependency installation
  3) Database configuration guidance
  4) Application startup
EOF
}

# --- Args ---
DEV_MODE=false; CHECK_ONLY=false; START_ONLY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev) DEV_MODE=true ;;
    --check) CHECK_ONLY=true ;;
    --start) START_ONLY=true ;;
    --help|-h) usage; exit 0 ;;
    *) warn "Unknown option: $1"; usage; exit 1 ;;
  esac
  shift
done

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Ensure .env file exists
ensure_env(){
  if [[ -f "$ENV_FILE" ]]; then log ".env found"; return; fi
  if [[ -f "$PROJECT_DIR/.env.simplified.example" ]]; then 
    cp "$PROJECT_DIR/.env.simplified.example" "$ENV_FILE"
    warn "Created .env from .env.simplified.example. Review secrets before first run"
    return
  fi
  err "No .env found. Add $ENV_FILE first."
}

# Generate a simple secret
generate_secret(){
  local len="${1:-32}"
  head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9!#$%&@' | head -c "$len"
}

# Set env var if missing
set_env_if_missing(){
  local key="$1" val="$2"
  grep -qE "^\s*${key}\s*=" "$ENV_FILE" 2>/dev/null || { 
    printf '%s\n' "${key}=${val}" >>"$ENV_FILE"
    log "Initialized ${key} in .env"
  }
}

# Read a key's value from .env
get_dotenv_value(){
  local key="$1"
  [[ -f "$ENV_FILE" ]] || { echo ""; return; }
  local line
  line=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" | head -n1 || true)
  if [[ -z "$line" ]]; then echo ""; return; fi
  local val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "${val:0:1}" == '"' && "${val: -1}" == '"' ]] || [[ "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then
    val="${val:1:${#val}-2}"
  fi
  echo "$val"
}

# Check PostgreSQL configuration
check_postgres() {
    info "🔍 Checking PostgreSQL configuration..."
    
    local supabase_url
    supabase_url="$(get_dotenv_value SUPABASE_URL)"
    
    if [[ -z "$supabase_url" ]] || [[ "$supabase_url" == "https://your-project.supabase.co" ]]; then
        warn "⚠️  Supabase URL not configured. Please update SUPABASE_URL in your .env file."
        return 1
    fi
    
    success "✅ Supabase configuration found."
    return 0
}

# Check Neo4j configuration
check_neo4j() {
    info "🔍 Checking Neo4j configuration..."
    
    local neo4j_uri
    neo4j_uri="$(get_dotenv_value NEO4J_URI)"
    
    if [[ -z "$neo4j_uri" ]] || [[ "$neo4j_uri" == "neo4j+s://your-instance.databases.neo4j.io" ]]; then
        warn "⚠️  Neo4j URI not configured. Please update NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in your .env file."
        return 1
    fi
    
    success "✅ Neo4j configuration found."
    return 0
}

# Initialize PostgreSQL schema
init_postgres() {
    info "🐘 Initializing PostgreSQL schema..."
    
    if [[ ! -f "db/postgres/schema.sql" ]]; then
        err "❌ PostgreSQL schema file not found at db/postgres/schema.sql"
        return 1
    fi
    
    success "✅ PostgreSQL schema file found."
    warn "📝 Note: Please run the schema manually in your Supabase SQL editor:"
    info "   1. Open your Supabase dashboard"
    info "   2. Go to SQL Editor"
    info "   3. Copy and paste the contents of db/postgres/schema.sql"
    info "   4. Run the query"
    
    return 0
}

# Initialize Neo4j schema
init_neo4j() {
    info "🕸️  Initializing Neo4j schema..."
    
    if [[ ! -f "db/neo4j/schema.cypher" ]]; then
        err "❌ Neo4j schema file not found at db/neo4j/schema.cypher"
        return 1
    fi
    
    success "✅ Neo4j schema file found."
    warn "📝 Note: Please run the schema manually in Neo4j Browser:"
    info "   1. Open Neo4j Browser at your instance URL"
    info "   2. Login with your credentials"
    info "   3. Copy and paste the contents of db/neo4j/schema.cypher"
    info "   4. Run the query"
    
    return 0
}

# Install Node.js dependencies
install_dependencies() {
    info "📦 Installing Node.js dependencies..."
    
    if [[ ! -f "package.json" ]]; then
        err "❌ package.json not found"
        return 1
    fi
    
    if command_exists npm; then
        info "🔧 Running npm install..."
        npm install --legacy-peer-deps
        success "✅ Dependencies installed successfully"
    else
        err "❌ npm not found. Please install Node.js first."
        return 1
    fi
}

# Test database connections
test_connections() {
    info "🧪 Testing database connections..."
    
    if command_exists npm; then
        info "🔧 Running connection tests..."
        npm test -- --testNamePattern="database" --verbose || true
        warn "📝 Note: Some tests may fail if databases are not fully configured."
    else
        warn "⚠️  npm not found. Skipping connection tests."
    fi
}

# Start the application server
start_server() {
    info "🚀 Starting AthenAI server..."
    
    local port
    port="$(get_dotenv_value PORT)"
    if [[ -z "$port" ]]; then port="3000"; fi
    
    if command_exists npm; then
        info "🔧 Starting server on port $port..."
        success "🌐 Server will be available at http://localhost:$port"
        npm run dev
    else
        err "❌ npm not found. Please install Node.js first."
        return 1
    fi
}

# Check system requirements
check_requirements() {
    info "🔍 Checking system requirements..."
    
    if ! command_exists node; then
        err "❌ Node.js not found. Please install Node.js 18+ first."
        return 1
    fi
    
    if ! command_exists npm; then
        err "❌ npm not found. Please install Node.js with npm first."
        return 1
    fi
    
    local node_version
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$node_version" -lt 18 ]]; then
        warn "⚠️  Node.js version $node_version detected. Recommend Node.js 18+"
    else
        success "✅ Node.js $(node --version) found"
    fi
    
    success "✅ System requirements check passed"
}

# Ensure basic secrets are set
ensure_basic_secrets() {
    info "🔐 Ensuring basic configuration..."
    
    set_env_if_missing NODE_ENV development
    set_env_if_missing PORT 3000
    set_env_if_missing APP_NAME athenai
    
    # Only generate secrets if they don't exist
    local api_secret
    api_secret="$(get_dotenv_value API_SECRET_KEY)"
    if [[ -z "$api_secret" ]] || [[ "$api_secret" == "your-secret-key" ]]; then
        local new_secret
        new_secret="$(generate_secret 48)"
        set_env_if_missing API_SECRET_KEY "$new_secret"
        warn "Generated new API_SECRET_KEY"
    fi
    
    success "✅ Basic configuration ensured"
}

# Main execution
main() {
    : >"$LOG_FILE"
    log "🎯 Starting AthenAI simplified initialization..."
    
    # Handle different modes
    if [[ "$CHECK_ONLY" == true ]]; then
        check_requirements
        ensure_env
        check_postgres || true
        check_neo4j || true
        success "Configuration check complete"
        exit 0
    fi
    
    if [[ "$START_ONLY" == true ]]; then
        ensure_env
        start_server
        exit 0
    fi
    
    # Default or dev mode
    check_requirements
    ensure_env
    ensure_basic_secrets
    
    if [[ "$DEV_MODE" == true ]]; then
        install_dependencies
        
        # Check and initialize databases
        if check_postgres; then
            init_postgres
        fi
        
        if check_neo4j; then
            init_neo4j
        fi
        
        test_connections
        
        success "🎉 Development setup complete!"
        info "📋 Next steps:"
        info "  1. Update your .env file with actual database credentials"
        info "  2. Run the SQL/Cypher schemas in your respective database consoles"
        info "  3. Start the application with: ./start-dev.sh --start"
        info "  4. Visit http://localhost:3000 to test the application"
        warn "💡 Tip: Use 'npm test' to verify your setup"
    else
        # Basic mode - just setup
        install_dependencies
        success "🎉 Basic initialization complete!"
        info "📋 Use --dev for full development setup or --start to run the server"
    fi
}

# Run main function
main "$@"
