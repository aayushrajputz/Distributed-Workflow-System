const Task = require('../models/Task');
const notificationService = require('./notificationService');

class OverdueScannerService {
  constructor() {
    this.interval = null;
    this.scanIntervalMs = parseInt(process.env.OVERDUE_SCAN_INTERVAL_MS || '3600000', 10); // default 1h
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => this.scanAndNotify().catch((e) => console.error('Overdue scan error:', e)), this.scanIntervalMs);
    // Run once on startup after slight delay
    setTimeout(() => this.scanAndNotify().catch((e) => console.error('Overdue initial scan error:', e)), 15000);
    console.log(`⏰ OverdueScannerService started (every ${Math.round(this.scanIntervalMs / 60000)} min)`);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async scanAndNotify() {
    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find active, not completed tasks that are overdue
    const tasks = await Task.find({
      isActive: true,
      status: { $ne: 'completed' },
      dueDate: { $lt: now },
    }).select('title project priority assignedTo assignedBy dueDate');

    for (const task of tasks) {
      try {
        const recipients = [];
        if (task.assignedTo) recipients.push(task.assignedTo);
        if (task.assignedBy && task.assignedBy.toString() !== (task.assignedTo?.toString() || '')) {
          recipients.push(task.assignedBy);
        }

        // Avoid spamming: only send once per 24h per user per task
        for (const rid of recipients) {
          const Notification = require('../models/Notification');
          const alreadySent = await Notification.findOne({
            recipient: rid,
            type: 'task_overdue',
            'data.taskId': task._id,
            createdAt: { $gt: oneDayAgo },
            isActive: true,
          }).lean();

          if (alreadySent) continue;

          await notificationService.sendNotification({
            recipient: rid,
            sender: task.assignedBy || rid,
            type: 'task_overdue',
            title: `Task Overdue: ${task.title}`,
            message: `The task "${task.title}" is overdue. Please review and update its status.`,
            priority: task.priority,
            data: { taskId: task._id, projectName: task.project, priority: task.priority, dueDate: task.dueDate },
            channels: { inApp: { sent: false, read: false }, email: { sent: false }, websocket: { sent: false } },
          });
        }
      } catch (e) {
        console.error('Failed to send overdue notification for task', task._id?.toString(), e.message);
      }
    }

    console.log(`⏰ Overdue scan complete: checked ${tasks.length} tasks`);
  }
}

module.exports = new OverdueScannerService();


