const User = require('../models/User');
const Task = require('../models/Task');
const emailService = require('./emailService');

class DigestService {
  constructor() {
    this.interval = null;
    this.tickMs = 15 * 60 * 1000; // check every 15 minutes
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => this.run().catch(e => console.error('Digest error:', e)), this.tickMs);
    console.log('🗞️ DigestService started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async run() {
    const now = new Date();
    const users = await User.find({ isActive: true, 'digestSettings.frequency': { $ne: 'off' } })
      .select('email firstName timezone digestSettings');

    for (const user of users) {
      const hourLocal = this._getLocalHour(now, user.timezone || 'America/Los_Angeles');
      if (hourLocal !== (user.digestSettings?.sendHourLocal ?? 8)) continue;

      // Build digest for today/week depending on frequency
      const rangeStart = new Date(now);
      if (user.digestSettings.frequency === 'daily') {
        rangeStart.setDate(now.getDate() - 1);
      } else {
        rangeStart.setDate(now.getDate() - 7);
      }

      const tasks = await Task.find({
        isActive: true,
        $or: [ { assignedTo: user._id }, { assignedBy: user._id } ],
        updatedAt: { $gte: rangeStart },
      }).select('title status priority project dueDate updatedAt');

      if (tasks.length === 0) continue;

      await emailService.sendDigestEmail({ user, tasks, frequency: user.digestSettings.frequency });
      console.log(`🗞️ Digest sent to ${user.email} (${tasks.length} tasks)`);
    }
  }

  _getLocalHour(date, tz) {
    try {
      return Number.parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: tz }).format(date), 10);
    } catch {
      return date.getHours();
    }
  }
}

module.exports = new DigestService();


