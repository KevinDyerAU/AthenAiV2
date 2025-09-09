// OpenTelemetry tracing setup for n8n with LangSmith integration
// Gracefully handle missing OpenTelemetry dependencies

// Check if OpenTelemetry modules are available
function checkOpenTelemetryAvailability() {
  try {
    require.resolve('@opentelemetry/sdk-node');
    require.resolve('@opentelemetry/resources');
    require.resolve('@opentelemetry/semantic-conventions');
    require.resolve('@opentelemetry/sdk-trace-base');
    require.resolve('@opentelemetry/exporter-trace-otlp-http');
    require.resolve('@opentelemetry/instrumentation');
    require.resolve('@opentelemetry/instrumentation-http');
    require.resolve('@opentelemetry/instrumentation-express');
    require.resolve('@opentelemetry/sdk-trace-node');
    return true;
  } catch (error) {
    console.log('OpenTelemetry modules not available, skipping tracing setup:', error.message);
    return false;
  }
}

// Only initialize if LangSmith is enabled AND OpenTelemetry modules are available
if (process.env.LANGCHAIN_TRACING_V2 === 'true' && process.env.LANGCHAIN_API_KEY && checkOpenTelemetryAvailability()) {
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { Resource } = require('@opentelemetry/resources');
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
    const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { registerInstrumentations } = require('@opentelemetry/instrumentation');
    const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
    const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
    const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
    
    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'n8n',
        'langchain.project': process.env.LANGCHAIN_PROJECT || 'n8n-workflows',
        'langchain.session': process.env.LANGCHAIN_SESSION || 'default-session',
      }),
    });

    // Configure LangSmith exporter if API key is provided
    if (process.env.LANGCHAIN_API_KEY && process.env.LANGCHAIN_ENDPOINT) {
      const langsmithExporter = new OTLPTraceExporter({
        url: `${process.env.LANGCHAIN_ENDPOINT}/api/traces`,
        headers: {
          'x-api-key': process.env.LANGCHAIN_API_KEY,
        },
      });

      provider.addSpanProcessor(new BatchSpanProcessor(langsmithExporter));
    }

    // Register the provider
    provider.register();

    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
      ],
      tracerProvider: provider,
    });

    console.log('OpenTelemetry tracing initialized with LangSmith exporter');
  } catch (error) {
    console.log('Failed to initialize OpenTelemetry tracing:', error.message);
  }
} else {
  console.log('OpenTelemetry tracing disabled - LangSmith not configured or modules not available');
}

// Export a no-op function to satisfy the require in NODE_OPTIONS
module.exports = () => {};
