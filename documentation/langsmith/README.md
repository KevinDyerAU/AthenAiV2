# LangSmith Integration Guide

## Overview

LangSmith is integrated into the NeoV3 platform to provide comprehensive tracing, monitoring, and observability for AI workflows and LangChain operations. This integration enables detailed tracking of workflow executions, performance metrics, and debugging capabilities.

## Features

- **Distributed Tracing**: Track execution flows across n8n workflows and AI operations
- **Performance Monitoring**: Monitor latency, throughput, and error rates
- **Debugging Support**: Detailed trace information for troubleshooting
- **Metrics Collection**: Integration with Prometheus and Grafana for visualization
- **Session Management**: Organize traces by user sessions and projects

## Configuration

### Environment Variables

The following environment variables control LangSmith integration:

```bash
# Enable LangSmith tracing (true/false)
LANGCHAIN_TRACING_V2=true

# LangSmith API endpoint
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com

# Your LangSmith API key (required for tracing)
LANGCHAIN_API_KEY=your_langsmith_api_key_here

# Project name in LangSmith
LANGCHAIN_PROJECT=enhanced-ai-os

# Session identifier for grouping traces
LANGCHAIN_SESSION=n8n-session
```

### Getting Your API Key

1. Visit [LangSmith](https://smith.langchain.com)
2. Sign up or log in to your account
3. Navigate to Settings → API Keys
4. Create a new API key
5. Copy the key to your `.env` file

## Architecture

### Components

1. **n8n Service**: Enhanced with OpenTelemetry tracing
2. **OpenTelemetry Collector**: Collects and exports traces to LangSmith
3. **Prometheus**: Scrapes metrics from the OTEL collector
4. **Grafana**: Visualizes LangSmith metrics and traces

### Data Flow

```
n8n Workflows → OpenTelemetry → LangSmith API
                     ↓
              Prometheus Metrics → Grafana Dashboard
```

## Usage

### Enabling Tracing in n8n Workflows

Tracing is automatically enabled for:
- LangChain agent nodes
- Code nodes with external module access
- HTTP requests and API calls
- Database operations

### Viewing Traces

1. **LangSmith Dashboard**: Visit https://smith.langchain.com to view detailed traces
2. **Grafana Dashboard**: Access the LangSmith monitoring dashboard at `http://localhost:3000/d/langsmith-monitoring`
3. **Local Portal**: Use the index.html page for quick access to all monitoring tools

### Organizing Traces

Traces are organized by:
- **Project**: Set via `LANGCHAIN_PROJECT` environment variable
- **Session**: Set via `LANGCHAIN_SESSION` environment variable
- **Workflow**: Automatically tagged with workflow name and execution ID

## Monitoring and Alerting

### Key Metrics

The integration provides the following metrics:

- `langchain_traces_total`: Total number of traces sent
- `langchain_request_duration_seconds`: Request latency distribution
- `langchain_errors_total`: Error count by type
- `langchain_active_sessions`: Number of active tracing sessions
- `langchain_trace_size_bytes`: Size of trace data

### Grafana Dashboard

The LangSmith monitoring dashboard includes:

1. **Trace Rate**: Traces per second over time
2. **Active Sessions**: Current number of active sessions
3. **Request Latency**: P50 and P95 latency percentiles
4. **Error Rate**: Errors per second
5. **Trace Size**: Average trace payload size
6. **Top Workflows**: Most executed n8n workflows

### Health Checks

The deployment script includes LangSmith health checks:

```powershell
# Manual health check
Test-LangSmithHealth
```

## Troubleshooting

### Common Issues

#### 1. Traces Not Appearing

**Symptoms**: No traces visible in LangSmith dashboard

**Solutions**:
- Verify `LANGCHAIN_API_KEY` is set correctly
- Check `LANGCHAIN_TRACING_V2=true` in environment
- Ensure n8n container has network access to api.smith.langchain.com
- Check container logs: `docker logs enhanced-ai-n8n`

#### 2. High Latency

**Symptoms**: Slow workflow execution

**Solutions**:
- Monitor trace size - reduce if too large
- Check network connectivity to LangSmith API
- Consider batching traces for high-volume workflows

#### 3. Authentication Errors

**Symptoms**: 401/403 errors in logs

**Solutions**:
- Regenerate API key in LangSmith dashboard
- Verify API key format (should start with `ls__`)
- Check project permissions in LangSmith

### Debug Commands

```bash
# Check n8n container environment
docker exec enhanced-ai-n8n env | grep LANGCHAIN

# View OpenTelemetry logs
docker logs enhanced-ai-n8n | grep -i otel

# Test LangSmith API connectivity
curl -H "x-api-key: $LANGCHAIN_API_KEY" \
     https://api.smith.langchain.com/api/v1/sessions
```

## Best Practices

### Performance

1. **Sampling**: For high-volume workflows, consider implementing trace sampling
2. **Batching**: Use batch span processors for better performance
3. **Filtering**: Filter out noisy or low-value traces

### Security

1. **API Key Management**: Store API keys securely, never commit to version control
2. **Network Security**: Ensure secure communication with LangSmith API
3. **Data Privacy**: Be mindful of sensitive data in traces

### Organization

1. **Project Naming**: Use descriptive project names for different environments
2. **Session Management**: Group related workflows in sessions
3. **Tagging**: Use consistent tags for filtering and organization

## Integration with Other Services

### Prometheus Integration

LangSmith metrics are automatically scraped by Prometheus:

```yaml
- job_name: 'langsmith-otel'
  static_configs:
    - targets: ['otel-collector:8889']
  scrape_interval: 30s
```

### Grafana Integration

The LangSmith dashboard is automatically provisioned and includes:
- Real-time metrics visualization
- Historical trend analysis
- Alert integration capabilities

### n8n Integration

LangSmith tracing is enabled in n8n through:
- OpenTelemetry instrumentation
- Environment variable configuration
- External module support for LangChain nodes

## API Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LANGCHAIN_TRACING_V2` | No | `true` | Enable/disable tracing |
| `LANGCHAIN_ENDPOINT` | No | `https://api.smith.langchain.com` | LangSmith API endpoint |
| `LANGCHAIN_API_KEY` | Yes | - | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | `enhanced-ai-os` | Project name |
| `LANGCHAIN_SESSION` | No | `n8n` | Session identifier |

### Health Check Endpoints

- **LangSmith API**: `GET https://api.smith.langchain.com/api/v1/sessions`
- **OpenTelemetry Metrics**: `GET http://otel-collector:8889/metrics`
- **n8n Health**: `GET http://n8n:5678/healthz`

## Support

For issues related to:
- **LangSmith Platform**: Visit [LangSmith Documentation](https://docs.smith.langchain.com)
- **Integration Issues**: Check the troubleshooting section above
- **Performance**: Monitor the Grafana dashboard for insights

## Changelog

### v1.0.0 (Current)
- Initial LangSmith integration
- OpenTelemetry tracing setup
- Grafana dashboard creation
- Health check implementation
- Documentation and deployment scripts
