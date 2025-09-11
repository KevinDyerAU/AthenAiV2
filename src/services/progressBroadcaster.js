// src/services/progressBroadcaster.js
const { logger } = require('../utils/logger');

class ProgressBroadcaster {
  constructor() {
    this.io = null;
    this.activeProgresses = new Map(); // sessionId -> progress data
  }

  initialize(socketIoInstance) {
    this.io = socketIoInstance;
    logger.info('Progress broadcaster initialized');
  }

  // Start a new progress session
  startProgress(sessionId, agentType, taskDescription) {
    const progressId = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const progressData = {
      id: progressId,
      sessionId,
      agentType,
      taskDescription,
      status: 'started',
      currentPhase: 'initializing',
      phases: [],
      startTime: Date.now(),
      lastUpdate: Date.now()
    };

    this.activeProgresses.set(sessionId, progressData);
    
    this.broadcast(sessionId, {
      type: 'progress_start',
      progressId,
      agentType,
      taskDescription,
      timestamp: new Date().toISOString()
    });

    return progressId;
  }

  // Update progress with current phase
  updateProgress(sessionId, phase, description, details = {}) {
    const progress = this.activeProgresses.get(sessionId);
    if (!progress) {
      logger.warn('Progress update for unknown session', { sessionId });
      return;
    }

    progress.currentPhase = phase;
    progress.lastUpdate = Date.now();
    progress.phases.push({
      phase,
      description,
      timestamp: Date.now(),
      details
    });

    this.broadcast(sessionId, {
      type: 'progress_update',
      progressId: progress.id,
      agentType: progress.agentType,
      phase,
      description,
      details,
      timestamp: new Date().toISOString()
    });

    logger.info('Progress updated', { sessionId, phase, description });
  }

  // Update thinking process
  updateThinking(sessionId, thinkingStep, content) {
    const progress = this.activeProgresses.get(sessionId);
    if (!progress) return;

    this.broadcast(sessionId, {
      type: 'thinking_update',
      progressId: progress.id,
      agentType: progress.agentType,
      thinkingStep,
      content,
      timestamp: new Date().toISOString()
    });

    logger.info('Thinking update', { sessionId, thinkingStep });
  }

  // Complete progress
  completeProgress(sessionId, result = {}) {
    const progress = this.activeProgresses.get(sessionId);
    if (!progress) return;

    progress.status = 'completed';
    progress.endTime = Date.now();
    progress.duration = progress.endTime - progress.startTime;

    this.broadcast(sessionId, {
      type: 'progress_complete',
      progressId: progress.id,
      agentType: progress.agentType,
      duration: progress.duration,
      result,
      timestamp: new Date().toISOString()
    });

    // Clean up after a delay
    setTimeout(() => {
      this.activeProgresses.delete(sessionId);
    }, 30000); // Keep for 30 seconds for any late updates

    logger.info('Progress completed', { sessionId, duration: progress.duration });
  }

  // Handle errors
  errorProgress(sessionId, error) {
    const progress = this.activeProgresses.get(sessionId);
    if (!progress) return;

    progress.status = 'error';
    progress.error = error.message || error;

    this.broadcast(sessionId, {
      type: 'progress_error',
      progressId: progress.id,
      agentType: progress.agentType,
      error: error.message || error,
      timestamp: new Date().toISOString()
    });

    logger.error('Progress error', { sessionId, error: error.message || error });
  }

  // Broadcast to specific session/room
  broadcast(sessionId, data) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized for progress broadcasting');
      return;
    }

    // Broadcast to the specific room/session and general room
    this.io.to(sessionId).emit('agent_progress', data);
    this.io.to('general').emit('agent_progress', data);
    
    // Also broadcast to all connected clients as fallback
    this.io.emit('agent_progress', data);
  }

  // Get current progress for a session
  getProgress(sessionId) {
    return this.activeProgresses.get(sessionId) || null;
  }

  // Get all active progresses
  getAllProgresses() {
    return Array.from(this.activeProgresses.values());
  }

  // Clean up old progresses
  cleanup(maxAgeMs = 300000) { // 5 minutes default
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, progress] of this.activeProgresses.entries()) {
      if (now - progress.lastUpdate > maxAgeMs) {
        this.activeProgresses.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old progresses', { count: cleaned });
    }

    return cleaned;
  }
}

// Singleton instance
const progressBroadcaster = new ProgressBroadcaster();

module.exports = { progressBroadcaster };
