/**
 * ML Service Client - Optional ML Service Integration
 * Provides graceful fallback when ML services are not available
 */

const axios = require('axios');
const { logger } = require('./logger');

class MLServiceClient {
  constructor() {
    this.enabled = process.env.ENABLE_ML_SERVICE === 'true';
    this.host = process.env.ML_SERVICE_HOST || 'ml-service';
    this.port = process.env.ML_SERVICE_PORT || '8001';
    this.baseURL = `http://${this.host}:${this.port}`;
    this.available = false;
    this.lastHealthCheck = null;
    this.healthCheckInterval = 30000; // 30 seconds
    
    if (this.enabled) {
      this.checkHealth();
      // Periodic health checks
      setInterval(() => this.checkHealth(), this.healthCheckInterval);
    }
  }

  async checkHealth() {
    if (!this.enabled) {
      this.available = false;
      return false;
    }

    try {
      const response = await axios.get(`${this.baseURL}/ml/health`, {
        timeout: 5000
      });
      
      this.available = response.status === 200;
      this.lastHealthCheck = new Date();
      
      if (this.available) {
        logger.info('ML Service is available');
      }
      
      return this.available;
    } catch (error) {
      this.available = false;
      this.lastHealthCheck = new Date();
      logger.debug('ML Service not available:', error.message);
      return false;
    }
  }

  isAvailable() {
    return this.enabled && this.available;
  }

  async predictExpertise(topic, options = {}) {
    if (!this.isAvailable()) {
      logger.debug('ML Service not available, skipping expertise prediction');
      return {
        success: false,
        reason: 'ml_service_unavailable',
        fallback: true,
        experts: []
      };
    }

    try {
      const response = await axios.post(`${this.baseURL}/ml/predict/expertise`, {
        topic,
        max_experts: options.maxExperts || 5,
        confidence_threshold: options.confidenceThreshold || 0.7
      }, {
        timeout: 10000
      });

      return {
        success: true,
        experts: response.data.experts || [],
        confidence: response.data.confidence || 0.5,
        source: 'ml_service'
      };
    } catch (error) {
      logger.error('ML expertise prediction failed:', error.message);
      return {
        success: false,
        reason: 'prediction_error',
        error: error.message,
        fallback: true,
        experts: []
      };
    }
  }

  async predictLink(source, target, relationshipType = 'RELATED_TO') {
    if (!this.isAvailable()) {
      logger.debug('ML Service not available, skipping link prediction');
      return {
        success: false,
        reason: 'ml_service_unavailable',
        fallback: true,
        probability: 0.5
      };
    }

    try {
      const response = await axios.post(`${this.baseURL}/ml/predict/link`, {
        source,
        target,
        relationship_type: relationshipType
      }, {
        timeout: 10000
      });

      return {
        success: true,
        probability: response.data.probability || 0.5,
        confidence: response.data.confidence || 0.5,
        source: 'ml_service'
      };
    } catch (error) {
      logger.error('ML link prediction failed:', error.message);
      return {
        success: false,
        reason: 'prediction_error',
        error: error.message,
        fallback: true,
        probability: 0.5
      };
    }
  }

  async classifyNode(nodeData, classificationType = 'general') {
    if (!this.isAvailable()) {
      logger.debug('ML Service not available, skipping node classification');
      return {
        success: false,
        reason: 'ml_service_unavailable',
        fallback: true,
        classification: 'unknown'
      };
    }

    try {
      const response = await axios.post(`${this.baseURL}/ml/classify/node`, {
        node_data: nodeData,
        classification_type: classificationType
      }, {
        timeout: 10000
      });

      return {
        success: true,
        classification: response.data.classification || 'unknown',
        confidence: response.data.confidence || 0.5,
        source: 'ml_service'
      };
    } catch (error) {
      logger.error('ML node classification failed:', error.message);
      return {
        success: false,
        reason: 'classification_error',
        error: error.message,
        fallback: true,
        classification: 'unknown'
      };
    }
  }

  async getModelStatus() {
    if (!this.isAvailable()) {
      return {
        available: false,
        models: [],
        reason: 'ml_service_unavailable'
      };
    }

    try {
      const response = await axios.get(`${this.baseURL}/ml/models/status`, {
        timeout: 5000
      });

      return {
        available: true,
        models: response.data.loaded_models || [],
        metadata: response.data.model_metadata || {},
        performance: response.data.performance_metrics || {}
      };
    } catch (error) {
      logger.error('Failed to get ML model status:', error.message);
      return {
        available: false,
        models: [],
        error: error.message
      };
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      available: this.available,
      baseURL: this.baseURL,
      lastHealthCheck: this.lastHealthCheck
    };
  }
}

// Singleton instance
const mlServiceClient = new MLServiceClient();

module.exports = mlServiceClient;
