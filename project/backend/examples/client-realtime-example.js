/**
 * Client-side Real-time Collaboration Example
 * 
 * This example shows how to implement real-time collaboration
 * on the client side using Socket.io.
 */

// This would typically be in your frontend application
class RealtimeNoteEditor {
  constructor(noteId, userToken) {
    this.noteId = noteId;
    this.userToken = userToken;
    this.socket = null;
    this.currentVersion = 1;
    this.isConnected = false;
    this.activeUsers = new Map();
    
    // Debounce settings for optimistic updates
    this.optimisticUpdateDelay = 300; // ms
    this.optimisticUpdateTimer = null;
    this.pendingContent = null;
    
    this.initializeSocket();
  }

  initializeSocket() {
    // Connect to Socket.io server
    this.socket = io('http://localhost:5000', {
      auth: { token: this.userToken }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to real-time server');
      this.isConnected = true;
      this.joinNote();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from real-time server');
      this.isConnected = false;
    });

    // Note collaboration events
    this.socket.on('note:join', (data) => {
      if (data.note) {
        // This is our own join - load the note
        this.handleNoteJoined(data);
      } else {
        // Another user joined
        this.handleUserJoined(data);
      }
    });

    this.socket.on('note:update', (data) => {
      this.handleNoteUpdate(data);
    });

    this.socket.on('note:leave', (data) => {
      this.handleUserLeft(data);
    });

    this.socket.on('note:saved', (data) => {
      this.handleNoteSaved(data);
    });

    this.socket.on('note:conflict', (data) => {
      this.handleVersionConflict(data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.showError(error.message);
    });
  }

  // Join a note room
  joinNote() {
    if (!this.isConnected) return;
    
    console.log(`📝 Joining note: ${this.noteId}`);
    this.socket.emit('note:join', { noteId: this.noteId });
  }

  // Leave a note room
  leaveNote() {
    if (!this.isConnected) return;
    
    console.log(`👋 Leaving note: ${this.noteId}`);
    this.socket.emit('note:leave', { noteId: this.noteId });
  }

  // Handle successful note join
  handleNoteJoined(data) {
    console.log('📝 Successfully joined note:', data.note.title);
    
    // Update local state
    this.currentVersion = data.note.version;
    this.updateEditor(data.note.title, data.note.content);
    this.updateActiveUsers(data.activeUsers);
    this.updatePermissions(data.userPermission);
    
    // Show success message
    this.showMessage(`Joined "${data.note.title}" - ${data.activeUsers.length} users online`);
  }

  // Handle user joining
  handleUserJoined(data) {
    console.log(`👋 ${data.username} joined the note`);
    
    this.activeUsers.set(data.userId, {
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    
    this.updateActiveUsersDisplay();
    this.showMessage(`${data.username} joined the note`);
  }

  // Handle user leaving
  handleUserLeft(data) {
    console.log(`👋 ${data.username} left the note`);
    
    this.activeUsers.delete(data.userId);
    this.updateActiveUsersDisplay();
    
    const reason = data.reason === 'disconnect' ? ' (disconnected)' : '';
    this.showMessage(`${data.username} left the note${reason}`);
  }

  // Handle real-time note updates
  handleNoteUpdate(data) {
    if (data.optimistic) {
      // Optimistic update - show immediately but don't save
      console.log(`✏️ Optimistic update from ${data.changedBy.username}`);
      this.showOptimisticUpdate(data);
    } else {
      // Pessimistic update - this was saved to database
      console.log(`💾 Note saved by ${data.changedBy.username} (v${data.version})`);
      this.currentVersion = data.version;
      this.updateEditor(data.title, data.content);
      this.showMessage(`Note updated by ${data.changedBy.username}`);
    }
  }

  // Handle note saved confirmation
  handleNoteSaved(data) {
    console.log(`💾 Note saved successfully (v${data.version})`);
    this.currentVersion = data.version;
    this.showMessage('Note saved successfully');
    this.clearPendingChanges();
  }

  // Handle version conflicts
  handleVersionConflict(data) {
    console.warn('⚠️ Version conflict detected:', data);
    
    const message = `
      Version conflict detected!
      Your version: ${data.clientVersion}
      Server version: ${data.serverVersion}
      
      The note has been modified by another user.
      Your changes will be lost if you continue.
    `;
    
    if (confirm(message + '\n\nReload the latest version?')) {
      // Reload the note with server version
      this.currentVersion = data.serverVersion;
      this.updateEditor(data.serverNote.title, data.serverNote.content);
    }
  }

  // Send optimistic update (for real-time typing)
  sendOptimisticUpdate(title, content) {
    if (!this.isConnected) return;
    
    // Debounce optimistic updates
    if (this.optimisticUpdateTimer) {
      clearTimeout(this.optimisticUpdateTimer);
    }
    
    this.pendingContent = { title, content };
    
    this.optimisticUpdateTimer = setTimeout(() => {
      this.socket.emit('note:update', {
        noteId: this.noteId,
        title: this.pendingContent.title,
        content: this.pendingContent.content,
        optimistic: true,
      });
      
      this.optimisticUpdateTimer = null;
    }, this.optimisticUpdateDelay);
  }

  // Save note to database (pessimistic update)
  saveNote(title, content) {
    if (!this.isConnected) return;
    
    console.log('💾 Saving note to database...');
    
    this.socket.emit('note:update', {
      noteId: this.noteId,
      title,
      content,
      clientVersion: this.currentVersion,
      optimistic: false,
    });
  }

  // Explicit save with conflict detection
  explicitSave(title, content) {
    if (!this.isConnected) return;
    
    console.log('💾 Performing explicit save...');
    
    this.socket.emit('note:save', {
      noteId: this.noteId,
      title,
      content,
      clientVersion: this.currentVersion,
    });
  }

  // UI Helper Methods (these would integrate with your actual UI framework)
  updateEditor(title, content) {
    console.log('📝 Updating editor:', { title, content: content.substring(0, 50) + '...' });
    // Update your text editor here
    // document.getElementById('note-title').value = title;
    // document.getElementById('note-content').value = content;
  }

  showOptimisticUpdate(data) {
    console.log('⚡ Showing optimistic update:', data.content.substring(0, 50) + '...');
    // Show visual indicator that this is a live update
    // Maybe highlight the changed text or show user avatar
  }

  updateActiveUsers(users) {
    this.activeUsers.clear();
    users.forEach(user => {
      this.activeUsers.set(user._id, user);
    });
    this.updateActiveUsersDisplay();
  }

  updateActiveUsersDisplay() {
    const userList = Array.from(this.activeUsers.values());
    console.log('👥 Active users:', userList.map(u => u.username).join(', '));
    // Update UI to show active users
    // const userListElement = document.getElementById('active-users');
    // userListElement.innerHTML = userList.map(u => `<span>${u.username}</span>`).join('');
  }

  updatePermissions(permission) {
    console.log('🔒 User permission:', permission);
    // Update UI based on permissions
    // const isReadOnly = permission === 'read';
    // document.getElementById('note-content').readOnly = isReadOnly;
  }

  showMessage(message) {
    console.log('📢 Message:', message);
    // Show toast notification or status message
  }

  showError(error) {
    console.error('❌ Error:', error);
    // Show error notification
  }

  clearPendingChanges() {
    if (this.optimisticUpdateTimer) {
      clearTimeout(this.optimisticUpdateTimer);
      this.optimisticUpdateTimer = null;
    }
    this.pendingContent = null;
  }

  // Cleanup
  destroy() {
    this.clearPendingChanges();
    if (this.socket) {
      this.leaveNote();
      this.socket.disconnect();
    }
  }
}

// Usage Example:
/*
// Initialize the real-time editor
const noteEditor = new RealtimeNoteEditor('note_id_here', 'jwt_token_here');

// Set up event handlers for your text editor
document.getElementById('note-content').addEventListener('input', (e) => {
  const title = document.getElementById('note-title').value;
  const content = e.target.value;
  
  // Send optimistic update for real-time collaboration
  noteEditor.sendOptimisticUpdate(title, content);
});

// Auto-save every 5 seconds
setInterval(() => {
  const title = document.getElementById('note-title').value;
  const content = document.getElementById('note-content').value;
  noteEditor.saveNote(title, content);
}, 5000);

// Manual save button
document.getElementById('save-button').addEventListener('click', () => {
  const title = document.getElementById('note-title').value;
  const content = document.getElementById('note-content').value;
  noteEditor.explicitSave(title, content);
});

// Cleanup when leaving the page
window.addEventListener('beforeunload', () => {
  noteEditor.destroy();
});
*/

module.exports = RealtimeNoteEditor;
