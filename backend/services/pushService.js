class PushService {
  constructor() {
    this.enabled = true;
  }

  async sendPush(tokens = [], payload = {}) {
    try {
      if (!this.enabled || tokens.length === 0) return { success: true };
      // Placeholder: integrate with FCM/APNs/Web Push here
      console.log(`📲 Sending push to ${tokens.length} device(s):`, payload.title || payload.type);
      return { success: true };
    } catch (e) {
      console.error('Push send failed:', e.message);
      return { success: false, error: e.message };
    }
  }
}

module.exports = new PushService();


