const { getPrometheusService } = require('./prometheusService');
const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationMetricsService {
  constructor() {
    this.metrics = {
      // Delivery metrics
      totalSent: 0,
      totalFailed: 0,
      channelMetrics: {
        inApp: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        email: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        push: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        websocket: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        slack: { sent: 0, failed: 0, avgDeliveryTime: 0 },
      },
      
      // Type-based metrics
      typeMetrics: {},
      
      // User engagement metrics
      engagementMetrics: {
        totalRead: 0,
        totalUnread: 0,
        avgReadTime: 0,
        readRate: 0,
      },
      
      // Performance metrics
      performanceMetrics: {
        avgProcessingTime: 0,
        avgDeliveryTime: 0,
        peakThroughput: 0,
        currentThroughput: 0,
      },
      
      // Error metrics
      errorMetrics: {
        totalErrors: 0,
        errorsByType: {},
        retryAttempts: 0,
        escalations: 0,
      },
      
      // System health metrics
      healthMetrics: {
        cacheHitRate: 0,
        queueDepth: 0,
        activeConnections: 0,
        systemLoad: 0,
      },
    };

    // Time-based metrics storage
    this.timeSeriesData = {
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map(),
    };

    // Real-time tracking
    this.realtimeMetrics = {
      lastMinuteDeliveries: [],
      currentMinuteCount: 0,
      peakMinuteCount: 0,
    };

    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Start periodic metrics collection
   */
  startMetricsCollection() {
    // Collect metrics every minute
    this.metricsInterval = setInterval(() => {
      this.collectRealtimeMetrics();
    }, 60 * 1000);

    // Aggregate metrics every hour
    this.aggregationInterval = setInterval(() => {
      this.aggregateHourlyMetrics();
    }, 60 * 60 * 1000);

    // Clean up old metrics daily
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 24 * 60 * 60 * 1000);

    console.log('📊 Notification metrics service started');
  }

  /**
   * Stop metrics collection
   */
  stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    console.log('📊 Notification metrics service stopped');
  }

  /**
   * Record notification delivery
   * @param {string} channel - Delivery channel
   * @param {boolean} success - Delivery success
   * @param {number} deliveryTime - Delivery time in ms
   * @param {string} type - Notification type
   */
  recordDelivery(channel, success, deliveryTime = 0, type = 'unknown') {
    // Update total metrics
    if (success) {
      this.metrics.totalSent++;
    } else {
      this.metrics.totalFailed++;
    }

    // Update channel metrics
    if (this.metrics.channelMetrics[channel]) {
      if (success) {
        this.metrics.channelMetrics[channel].sent++;
        this.updateAverageDeliveryTime(channel, deliveryTime);
      } else {
        this.metrics.channelMetrics[channel].failed++;
      }
    }

    // Update type metrics
    if (!this.metrics.typeMetrics[type]) {
      this.metrics.typeMetrics[type] = { sent: 0, failed: 0, avgDeliveryTime: 0 };
    }
    
    if (success) {
      this.metrics.typeMetrics[type].sent++;
    } else {
      this.metrics.typeMetrics[type].failed++;
    }

    // Update real-time metrics
    this.realtimeMetrics.currentMinuteCount++;
    this.realtimeMetrics.lastMinuteDeliveries.push({
      timestamp: Date.now(),
      channel,
      success,
      deliveryTime,
      type,
    });

    // Record to Prometheus
    this.recordPrometheusMetrics(channel, success, deliveryTime, type);
  }

  /**
   * Record notification read event
   * @param {string} notificationId - Notification ID
   * @param {number} readTime - Time to read in ms
   */
  recordRead(notificationId, readTime = 0) {
    this.metrics.engagementMetrics.totalRead++;
    
    if (readTime > 0) {
      this.updateAverageReadTime(readTime);
    }

    // Update read rate
    const totalNotifications = this.metrics.engagementMetrics.totalRead + this.metrics.engagementMetrics.totalUnread;
    if (totalNotifications > 0) {
      this.metrics.engagementMetrics.readRate = (this.metrics.engagementMetrics.totalRead / totalNotifications) * 100;
    }

    // Record to Prometheus
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordNotificationRead(readTime);
      }
    } catch (error) {
      console.error('❌ Failed to record read metrics to Prometheus:', error);
    }
  }

  /**
   * Record notification error
   * @param {string} errorType - Type of error
   * @param {string} channel - Channel where error occurred
   * @param {string} message - Error message
   */
  recordError(errorType, channel = 'unknown', message = '') {
    this.metrics.errorMetrics.totalErrors++;
    
    if (!this.metrics.errorMetrics.errorsByType[errorType]) {
      this.metrics.errorMetrics.errorsByType[errorType] = 0;
    }
    this.metrics.errorMetrics.errorsByType[errorType]++;

    // Record to Prometheus
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordNotificationError(errorType, channel);
      }
    } catch (error) {
      console.error('❌ Failed to record error metrics to Prometheus:', error);
    }
  }

  /**
   * Record retry attempt
   * @param {string} notificationId - Notification ID
   * @param {number} attemptNumber - Retry attempt number
   */
  recordRetry(notificationId, attemptNumber) {
    this.metrics.errorMetrics.retryAttempts++;

    // Record to Prometheus
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordNotificationRetry(attemptNumber);
      }
    } catch (error) {
      console.error('❌ Failed to record retry metrics to Prometheus:', error);
    }
  }

  /**
   * Record escalation event
   * @param {string} notificationId - Notification ID
   * @param {string} reason - Escalation reason
   */
  recordEscalation(notificationId, reason) {
    this.metrics.errorMetrics.escalations++;

    // Record to Prometheus
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordNotificationEscalation(reason);
      }
    } catch (error) {
      console.error('❌ Failed to record escalation metrics to Prometheus:', error);
    }
  }

  /**
   * Record processing time
   * @param {number} processingTime - Processing time in ms
   */
  recordProcessingTime(processingTime) {
    this.updateAverageProcessingTime(processingTime);

    // Record to Prometheus
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordNotificationProcessingTime(processingTime);
      }
    } catch (error) {
      console.error('❌ Failed to record processing time to Prometheus:', error);
    }
  }

  /**
   * Record cache metrics
   * @param {string} operation - Cache operation (hit, miss, set, etc.)
   * @param {string} cacheType - Type of cache
   */
  recordCacheMetrics(operation, cacheType) {
    // Update cache hit rate calculation
    if (operation === 'hit' || operation === 'miss') {
      // This would be calculated based on cache service metrics
      // For now, we'll record to Prometheus
    }

    // Record to Prometheus
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordCacheOperation(cacheType, operation);
      }
    } catch (error) {
      console.error('❌ Failed to record cache metrics to Prometheus:', error);
    }
  }

  /**
   * Update average delivery time for a channel
   * @param {string} channel - Delivery channel
   * @param {number} deliveryTime - New delivery time
   */
  updateAverageDeliveryTime(channel, deliveryTime) {
    const channelMetrics = this.metrics.channelMetrics[channel];
    if (channelMetrics) {
      const totalDeliveries = channelMetrics.sent;
      channelMetrics.avgDeliveryTime = 
        ((channelMetrics.avgDeliveryTime * (totalDeliveries - 1)) + deliveryTime) / totalDeliveries;
    }
  }

  /**
   * Update average read time
   * @param {number} readTime - New read time
   */
  updateAverageReadTime(readTime) {
    const totalReads = this.metrics.engagementMetrics.totalRead;
    this.metrics.engagementMetrics.avgReadTime = 
      ((this.metrics.engagementMetrics.avgReadTime * (totalReads - 1)) + readTime) / totalReads;
  }

  /**
   * Update average processing time
   * @param {number} processingTime - New processing time
   */
  updateAverageProcessingTime(processingTime) {
    const totalProcessed = this.metrics.totalSent + this.metrics.totalFailed;
    if (totalProcessed > 0) {
      this.metrics.performanceMetrics.avgProcessingTime = 
        ((this.metrics.performanceMetrics.avgProcessingTime * (totalProcessed - 1)) + processingTime) / totalProcessed;
    }
  }

  /**
   * Collect real-time metrics
   */
  collectRealtimeMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Clean up old real-time data
    this.realtimeMetrics.lastMinuteDeliveries = this.realtimeMetrics.lastMinuteDeliveries
      .filter(delivery => delivery.timestamp > oneMinuteAgo);

    // Update peak throughput
    if (this.realtimeMetrics.currentMinuteCount > this.realtimeMetrics.peakMinuteCount) {
      this.realtimeMetrics.peakMinuteCount = this.realtimeMetrics.currentMinuteCount;
      this.metrics.performanceMetrics.peakThroughput = this.realtimeMetrics.peakMinuteCount;
    }

    // Update current throughput
    this.metrics.performanceMetrics.currentThroughput = this.realtimeMetrics.lastMinuteDeliveries.length;

    // Reset current minute count
    this.realtimeMetrics.currentMinuteCount = 0;
  }

  /**
   * Aggregate hourly metrics
   */
  aggregateHourlyMetrics() {
    const hour = new Date().getHours();
    const hourKey = `${new Date().toDateString()}-${hour}`;

    // Store current metrics snapshot
    this.timeSeriesData.hourly.set(hourKey, {
      timestamp: new Date(),
      totalSent: this.metrics.totalSent,
      totalFailed: this.metrics.totalFailed,
      channelMetrics: JSON.parse(JSON.stringify(this.metrics.channelMetrics)),
      engagementMetrics: JSON.parse(JSON.stringify(this.metrics.engagementMetrics)),
      errorMetrics: JSON.parse(JSON.stringify(this.metrics.errorMetrics)),
    });

    // Aggregate daily metrics
    this.aggregateDailyMetrics();
  }

  /**
   * Aggregate daily metrics
   */
  aggregateDailyMetrics() {
    const today = new Date().toDateString();
    const todayHours = Array.from(this.timeSeriesData.hourly.entries())
      .filter(([key]) => key.startsWith(today))
      .map(([, data]) => data);

    if (todayHours.length > 0) {
      const dailyMetrics = {
        timestamp: new Date(),
        totalSent: todayHours[todayHours.length - 1].totalSent,
        totalFailed: todayHours[todayHours.length - 1].totalFailed,
        peakHourThroughput: Math.max(...todayHours.map(h => h.totalSent)),
        avgHourlyThroughput: todayHours.reduce((sum, h) => sum + h.totalSent, 0) / todayHours.length,
      };

      this.timeSeriesData.daily.set(today, dailyMetrics);
    }
  }

  /**
   * Clean up old metrics data
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Clean up hourly data older than 1 week
    for (const [key, data] of this.timeSeriesData.hourly.entries()) {
      if (data.timestamp.getTime() < oneWeekAgo) {
        this.timeSeriesData.hourly.delete(key);
      }
    }

    // Clean up daily data older than 1 month
    for (const [key, data] of this.timeSeriesData.daily.entries()) {
      if (data.timestamp.getTime() < oneMonthAgo) {
        this.timeSeriesData.daily.delete(key);
      }
    }

    console.log('🧹 Cleaned up old notification metrics data');
  }

  /**
   * Get comprehensive metrics dashboard data
   * @returns {Object} - Dashboard metrics
   */
  async getDashboardMetrics() {
    // Get database metrics
    const dbMetrics = await this.getDatabaseMetrics();
    
    return {
      overview: {
        totalSent: this.metrics.totalSent,
        totalFailed: this.metrics.totalFailed,
        successRate: this.getSuccessRate(),
        avgProcessingTime: Math.round(this.metrics.performanceMetrics.avgProcessingTime),
        currentThroughput: this.metrics.performanceMetrics.currentThroughput,
        peakThroughput: this.metrics.performanceMetrics.peakThroughput,
      },
      
      channels: Object.entries(this.metrics.channelMetrics).map(([channel, metrics]) => ({
        channel,
        sent: metrics.sent,
        failed: metrics.failed,
        successRate: this.getChannelSuccessRate(channel),
        avgDeliveryTime: Math.round(metrics.avgDeliveryTime),
      })),
      
      engagement: {
        totalRead: this.metrics.engagementMetrics.totalRead,
        totalUnread: this.metrics.engagementMetrics.totalUnread,
        readRate: Math.round(this.metrics.engagementMetrics.readRate * 100) / 100,
        avgReadTime: Math.round(this.metrics.engagementMetrics.avgReadTime),
      },
      
      errors: {
        totalErrors: this.metrics.errorMetrics.totalErrors,
        retryAttempts: this.metrics.errorMetrics.retryAttempts,
        escalations: this.metrics.errorMetrics.escalations,
        errorsByType: this.metrics.errorMetrics.errorsByType,
      },
      
      types: Object.entries(this.metrics.typeMetrics).map(([type, metrics]) => ({
        type,
        sent: metrics.sent,
        failed: metrics.failed,
        successRate: this.getTypeSuccessRate(type),
      })),
      
      database: dbMetrics,
      
      timeSeries: {
        hourly: Array.from(this.timeSeriesData.hourly.entries()).slice(-24), // Last 24 hours
        daily: Array.from(this.timeSeriesData.daily.entries()).slice(-30), // Last 30 days
      },
    };
  }

  /**
   * Get database-based metrics
   * @returns {Object} - Database metrics
   */
  async getDatabaseMetrics() {
    try {
      const [
        totalNotifications,
        unreadNotifications,
        recentNotifications,
        activeUsers,
      ] = await Promise.all([
        Notification.countDocuments({}),
        Notification.countDocuments({ 'channels.inApp.read': false }),
        Notification.countDocuments({ 
          createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        }),
        User.countDocuments({ 
          isActive: true,
          lastLoginAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
      ]);

      return {
        totalNotifications,
        unreadNotifications,
        recentNotifications,
        activeUsers,
        readRate: totalNotifications > 0 
          ? ((totalNotifications - unreadNotifications) / totalNotifications * 100).toFixed(2)
          : 0,
      };
    } catch (error) {
      console.error('❌ Failed to get database metrics:', error);
      return {
        totalNotifications: 0,
        unreadNotifications: 0,
        recentNotifications: 0,
        activeUsers: 0,
        readRate: 0,
      };
    }
  }

  /**
   * Get success rate
   * @returns {number} - Success rate percentage
   */
  getSuccessRate() {
    const total = this.metrics.totalSent + this.metrics.totalFailed;
    return total > 0 ? (this.metrics.totalSent / total * 100).toFixed(2) : 0;
  }

  /**
   * Get channel success rate
   * @param {string} channel - Channel name
   * @returns {number} - Channel success rate percentage
   */
  getChannelSuccessRate(channel) {
    const channelMetrics = this.metrics.channelMetrics[channel];
    if (!channelMetrics) return 0;
    
    const total = channelMetrics.sent + channelMetrics.failed;
    return total > 0 ? (channelMetrics.sent / total * 100).toFixed(2) : 0;
  }

  /**
   * Get type success rate
   * @param {string} type - Notification type
   * @returns {number} - Type success rate percentage
   */
  getTypeSuccessRate(type) {
    const typeMetrics = this.metrics.typeMetrics[type];
    if (!typeMetrics) return 0;
    
    const total = typeMetrics.sent + typeMetrics.failed;
    return total > 0 ? (typeMetrics.sent / total * 100).toFixed(2) : 0;
  }

  /**
   * Record metrics to Prometheus
   * @param {string} channel - Delivery channel
   * @param {boolean} success - Delivery success
   * @param {number} deliveryTime - Delivery time
   * @param {string} type - Notification type
   */
  recordPrometheusMetrics(channel, success, deliveryTime, type) {
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordNotificationDelivery(channel, success, deliveryTime, type);
      }
    } catch (error) {
      console.error('❌ Failed to record Prometheus metrics:', error);
    }
  }

  /**
   * Get real-time metrics
   * @returns {Object} - Real-time metrics
   */
  getRealtimeMetrics() {
    return {
      currentThroughput: this.metrics.performanceMetrics.currentThroughput,
      peakThroughput: this.metrics.performanceMetrics.peakThroughput,
      lastMinuteDeliveries: this.realtimeMetrics.lastMinuteDeliveries.length,
      avgDeliveryTime: this.calculateRealtimeAvgDeliveryTime(),
      successRate: this.calculateRealtimeSuccessRate(),
    };
  }

  /**
   * Calculate real-time average delivery time
   * @returns {number} - Average delivery time in ms
   */
  calculateRealtimeAvgDeliveryTime() {
    const deliveries = this.realtimeMetrics.lastMinuteDeliveries;
    if (deliveries.length === 0) return 0;
    
    const totalTime = deliveries.reduce((sum, delivery) => sum + delivery.deliveryTime, 0);
    return Math.round(totalTime / deliveries.length);
  }

  /**
   * Calculate real-time success rate
   * @returns {number} - Success rate percentage
   */
  calculateRealtimeSuccessRate() {
    const deliveries = this.realtimeMetrics.lastMinuteDeliveries;
    if (deliveries.length === 0) return 100;
    
    const successful = deliveries.filter(delivery => delivery.success).length;
    return (successful / deliveries.length * 100).toFixed(2);
  }

  /**
   * Export metrics for external monitoring
   * @returns {Object} - Exportable metrics
   */
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      timeSeries: {
        hourly: Object.fromEntries(this.timeSeriesData.hourly),
        daily: Object.fromEntries(this.timeSeriesData.daily),
      },
      realtime: this.getRealtimeMetrics(),
    };
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  resetMetrics() {
    this.metrics = {
      totalSent: 0,
      totalFailed: 0,
      channelMetrics: {
        inApp: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        email: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        push: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        websocket: { sent: 0, failed: 0, avgDeliveryTime: 0 },
        slack: { sent: 0, failed: 0, avgDeliveryTime: 0 },
      },
      typeMetrics: {},
      engagementMetrics: {
        totalRead: 0,
        totalUnread: 0,
        avgReadTime: 0,
        readRate: 0,
      },
      performanceMetrics: {
        avgProcessingTime: 0,
        avgDeliveryTime: 0,
        peakThroughput: 0,
        currentThroughput: 0,
      },
      errorMetrics: {
        totalErrors: 0,
        errorsByType: {},
        retryAttempts: 0,
        escalations: 0,
      },
      healthMetrics: {
        cacheHitRate: 0,
        queueDepth: 0,
        activeConnections: 0,
        systemLoad: 0,
      },
    };

    this.timeSeriesData.hourly.clear();
    this.timeSeriesData.daily.clear();
    this.realtimeMetrics.lastMinuteDeliveries = [];
    this.realtimeMetrics.currentMinuteCount = 0;
    this.realtimeMetrics.peakMinuteCount = 0;

    console.log('📊 Notification metrics reset');
  }

  /**
   * Get health status
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      metricsCollectionActive: !!this.metricsInterval,
      totalMetricsCollected: this.metrics.totalSent + this.metrics.totalFailed,
      lastCollectionTime: new Date(),
      memoryUsage: process.memoryUsage(),
    };
  }
}

// Create singleton instance
const notificationMetricsService = new NotificationMetricsService();

module.exports = notificationMetricsService;