const promClient = require('prom-client');
const si = require('systeminformation');

class PrometheusService {
  constructor() {
    // Create a Registry which registers the metrics
    this.register = new promClient.Registry();

    // Add a default label which is added to all metrics
    this.register.setDefaultLabels({
      app: 'workflow-management-system',
    });

    // Enable the collection of default metrics
    promClient.collectDefaultMetrics({
      register: this.register,
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });

    this.initializeCustomMetrics();
    this.startSystemMetricsCollection();
  }

  initializeCustomMetrics() {
    // System metrics
    this.cpuUsageGauge = new promClient.Gauge({
      name: 'system_cpu_usage_percent',
      help: 'Current CPU usage percentage',
      registers: [this.register],
    });

    this.memoryUsageGauge = new promClient.Gauge({
      name: 'system_memory_usage_percent',
      help: 'Current memory usage percentage',
      registers: [this.register],
    });

    this.diskUsageGauge = new promClient.Gauge({
      name: 'system_disk_usage_percent',
      help: 'Current disk usage percentage',
      registers: [this.register],
    });

    this.networkIOGauge = new promClient.Gauge({
      name: 'system_network_io_bytes_total',
      help: 'Total network I/O in bytes',
      labelNames: ['direction'],
      registers: [this.register],
    });

    this.uptimeGauge = new promClient.Gauge({
      name: 'system_uptime_seconds',
      help: 'System uptime in seconds',
      registers: [this.register],
    });

    this.activeConnectionsGauge = new promClient.Gauge({
      name: 'system_active_connections',
      help: 'Number of active network connections',
      registers: [this.register],
    });

    // Notification metrics
    this.notificationDeliveryCounter = new promClient.Counter({
      name: 'notification_delivery_total',
      help: 'Total notifications delivery attempts',
      labelNames: ['channel', 'status', 'type'],
      registers: [this.register],
    });

    this.notificationReadHistogram = new promClient.Histogram({
      name: 'notification_read_time_ms',
      help: 'Notification read time in ms',
      buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
      registers: [this.register],
    });

    this.notificationProcessingHistogram = new promClient.Histogram({
      name: 'notification_processing_time_ms',
      help: 'Notification processing time in ms',
      buckets: [10, 50, 100, 250, 500, 1000, 2000],
      registers: [this.register],
    });

    this.notificationRetryCounter = new promClient.Counter({
      name: 'notification_retries_total',
      help: 'Total notification retries',
      registers: [this.register],
    });

    this.notificationErrorCounter = new promClient.Counter({
      name: 'notification_errors_total',
      help: 'Notification errors by type and channel',
      labelNames: ['error_type', 'channel'],
      registers: [this.register],
    });

    this.rateLimitCounter = new promClient.Counter({
      name: 'rate_limit_events_total',
      help: 'Rate limit events',
      labelNames: ['limit_type', 'action', 'role'],
      registers: [this.register],
    });

    // API metrics
    this.apiRequestsTotal = new promClient.Counter({
      name: 'api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['method', 'endpoint', 'status_code'],
      registers: [this.register],
    });

    this.apiRequestDuration = new promClient.Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['method', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.apiErrorRate = new promClient.Gauge({
      name: 'api_error_rate_percent',
      help: 'API error rate percentage',
      registers: [this.register],
    });

    this.activeApiKeys = new promClient.Gauge({
      name: 'api_keys_active_total',
      help: 'Number of active API keys',
      registers: [this.register],
    });

    // Task metrics
    this.tasksTotal = new promClient.Gauge({
      name: 'tasks_total',
      help: 'Total number of tasks',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.taskCompletionRate = new promClient.Gauge({
      name: 'tasks_completion_rate_percent',
      help: 'Task completion rate percentage',
      registers: [this.register],
    });

    // Distributed system metrics
    this.nodeHealthGauge = new promClient.Gauge({
      name: 'node_health_status',
      help: 'Health status of distributed nodes (1=healthy, 0=unhealthy)',
      labelNames: ['node_id', 'region', 'service'],
      registers: [this.register],
    });
  }

  async startSystemMetricsCollection() {
    // Collect system metrics every 5 seconds
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        console.error('Error collecting system metrics:', error);
      }
    }, 5000);

    // Initial collection
    await this.collectSystemMetrics();
  }

  async collectSystemMetrics() {
    try {
      // CPU usage
      const cpuData = await si.currentLoad();
      this.cpuUsageGauge.set(cpuData.currentLoad);

      // Memory usage
      const memData = await si.mem();
      const memoryUsagePercent = ((memData.used / memData.total) * 100);
      this.memoryUsageGauge.set(memoryUsagePercent);

      // Disk usage
      const diskData = await si.fsSize();
      if (diskData.length > 0) {
        const totalSize = diskData.reduce((acc, disk) => acc + disk.size, 0);
        const totalUsed = diskData.reduce((acc, disk) => acc + disk.used, 0);
        const diskUsagePercent = (totalUsed / totalSize) * 100;
        this.diskUsageGauge.set(diskUsagePercent);
      }

      // Network I/O
      const networkData = await si.networkStats();
      if (networkData.length > 0) {
        const totalRx = networkData.reduce((acc, iface) => acc + iface.rx_bytes, 0);
        const totalTx = networkData.reduce((acc, iface) => acc + iface.tx_bytes, 0);
        this.networkIOGauge.set({ direction: 'rx' }, totalRx);
        this.networkIOGauge.set({ direction: 'tx' }, totalTx);
      }

      // System uptime
      const uptimeData = await si.time();
      this.uptimeGauge.set(uptimeData.uptime);

      // Active connections (approximate)
      const connectionsData = await si.networkConnections();
      this.activeConnectionsGauge.set(connectionsData.length);
    } catch (error) {
      console.error('Error in collectSystemMetrics:', error);
    }
  }

  // Record API request metrics
  recordApiRequest(method, endpoint, statusCode, duration) {
    this.apiRequestsTotal.inc({ method, endpoint, status_code: statusCode });
    this.apiRequestDuration.observe({ method, endpoint }, duration);
  }

  // Update API error rate
  updateApiErrorRate(errorRate) {
    this.apiErrorRate.set(errorRate);
  }

  // Update active API keys count
  updateActiveApiKeys(count) {
    this.activeApiKeys.set(count);
  }

  // Update task metrics
  updateTaskMetrics(taskStats) {
    this.tasksTotal.set({ status: 'pending' }, taskStats.pending || 0);
    this.tasksTotal.set({ status: 'in_progress' }, taskStats.in_progress || 0);
    this.tasksTotal.set({ status: 'completed' }, taskStats.completed || 0);
    this.tasksTotal.set({ status: 'blocked' }, taskStats.blocked || 0);

    const total = taskStats.total || 1;
    const completed = taskStats.completed || 0;
    const completionRate = (completed / total) * 100;
    this.taskCompletionRate.set(completionRate);
  }

  // Notification metric helpers
  recordNotificationDelivery(channel, success, deliveryTimeMs = 0, type = 'unknown') {
    this.notificationDeliveryCounter.inc({ channel, status: success ? 'success' : 'failed', type });
    if (deliveryTimeMs > 0) this.notificationProcessingHistogram.observe(deliveryTimeMs);
  }

  recordNotificationRead(readTimeMs = 0) {
    if (readTimeMs > 0) this.notificationReadHistogram.observe(readTimeMs);
  }

  recordNotificationError(errorType = 'unknown', channel = 'unknown') {
    this.notificationErrorCounter.inc({ error_type: errorType, channel });
  }

  recordNotificationRetry(attemptNumber = 1) {
    this.notificationRetryCounter.inc(attemptNumber);
  }

  // Rate limit metrics
  recordRateLimit(limitType, action, role) {
    this.rateLimitCounter.inc({ limit_type: limitType, action, role });
  }

  // Update node health metrics
  updateNodeHealth(nodes) {
    // Clear existing metrics
    this.nodeHealthGauge.reset();

    nodes.forEach((node) => {
      const healthValue = node.status === 'healthy' ? 1 : 0;
      node.services.forEach((service) => {
        this.nodeHealthGauge.set(
          { node_id: node.id, region: node.region, service },
          healthValue,
        );
      });
    });
  }

  // Get metrics in Prometheus format
  async getMetrics() {
    return await this.register.metrics();
  }

  // Get specific system metrics as JSON
  async getSystemMetricsJson() {
    const cpuData = await si.currentLoad();
    const memData = await si.mem();
    const diskData = await si.fsSize();
    const networkData = await si.networkStats();
    const uptimeData = await si.time();
    const connectionsData = await si.networkConnections();

    const totalDiskSize = diskData.reduce((acc, disk) => acc + disk.size, 0);
    const totalDiskUsed = diskData.reduce((acc, disk) => acc + disk.used, 0);
    const totalNetworkRx = networkData.reduce((acc, iface) => acc + iface.rx_bytes, 0);
    const totalNetworkTx = networkData.reduce((acc, iface) => acc + iface.tx_bytes, 0);

    return {
      cpu_usage: Math.round(cpuData.currentLoad * 100) / 100,
      memory_usage: Math.round(((memData.used / memData.total) * 100) * 100) / 100,
      disk_usage: Math.round((totalDiskUsed / totalDiskSize) * 100 * 100) / 100,
      network_io_bytes: totalNetworkRx + totalNetworkTx,
      uptime_seconds: uptimeData.uptime,
      active_connections: connectionsData.length,
      requests_per_second: 0, // Will be calculated from API metrics
      error_rate: 0, // Will be calculated from API metrics
    };
  }

  // Get registry for external use
  getRegistry() {
    return this.register;
  }
}

// Singleton instance
let prometheusService = null;

function getPrometheusService() {
  if (!prometheusService) {
    prometheusService = new PrometheusService();
  }
  return prometheusService;
}

module.exports = {
  PrometheusService,
  getPrometheusService,
};
