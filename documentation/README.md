# AthenAI Documentation

This directory contains supplementary documentation for AthenAI. **The main documentation is in the root [README.md](../README.md)**.

## Current Documentation Structure

### Active Documentation
- **[self-healing/](self-healing/)** - Self-healing agent with AI integration and knowledge substrate
  - `KNOWLEDGE_INTEGRATION_GUIDE.md` - Comprehensive guide for self-healing knowledge integration
- **[database/](database/)** - Database schemas and migration guides
- **[api/](api/)** - API reference and validation documentation

### Deprecated Documentation
The following directories contain outdated documentation that references previous system versions:

- **[configuration/](configuration/)** - **DEPRECATED** - Environment config now in main README.md
- **[workflows/](workflows/)** - **DEPRECATED** - n8n workflows no longer used
- **[operations/](operations/)** - **DEPRECATED** - Kubernetes deployment replaced with Docker Compose
- **[langsmith/](langsmith/)** - **DEPRECATED** - LangSmith integration details outdated
- **[training/](training/)** - **DEPRECATED** - Training procedures outdated
- **[maintenance/](maintenance/)** - **DEPRECATED** - Maintenance procedures outdated

## Quick Reference

For current AthenAI information, always refer to:

1. **[Main README.md](../README.md)** - Complete system overview, setup, and configuration
2. **[Self-Healing Guide](self-healing/KNOWLEDGE_INTEGRATION_GUIDE.md)** - AI-powered self-healing capabilities
3. **Database Schemas** - Located in `db/supabase/` and `db/neo4j/` directories
4. **Environment Configuration** - See main README.md Configuration section

## Documentation Maintenance

This documentation structure is being consolidated to reduce redundancy and improve maintainability. Deprecated files have been updated with deprecation notices and redirects to current documentation.

For questions about AthenAI architecture, setup, or usage, please refer to the main README.md file first.
