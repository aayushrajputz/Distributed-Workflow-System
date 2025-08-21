# Real-time Collaboration Documentation

## Overview

The real-time collaboration system enables multiple users to edit notes simultaneously using Socket.io WebSockets. It implements optimistic updates for immediate UI feedback and pessimistic updates for data persistence, with a "last write wins" concurrency model.

## Features

- ✅ **Real-time Editing** - Multiple users can edit notes simultaneously
- ✅ **Optimistic Updates** - Immediate UI updates for better UX
- ✅ **Pessimistic Updates** - Database persistence with conflict detection
- ✅ **Last Write Wins** - Simple concurrency resolution
- ✅ **User Presence** - See who's currently editing the note
- ✅ **Access Control** - Respect note permissions in real-time
- ✅ **Version Tracking** - Detect and handle version conflicts
- ✅ **Auto-sync** - Changes automatically sync to MongoDB

## Socket.io Events

### Client to Server Events

#### `note:join`
Join a note room for real-time collaboration.

**Payload:**
```javascript
{
  noteId: "note_id_string"
}
```

**Response:** `note:join` event with note data

#### `note:update`
Send note updates (optimistic or pessimistic).

**Payload:**
```javascript
{
  noteId: "note_id_string",
  title: "Updated title",           // optional
  content: "Updated content",       // optional
  optimistic: true,                 // true for real-time, false for save
  clientVersion: 5,                 // for conflict detection
  cursorPosition: 150,              // optional cursor info
  selection: { start: 100, end: 150 } // optional selection info
}
```

#### `note:save`
Explicitly save note with conflict detection.

**Payload:**
```javascript
{
  noteId: "note_id_string",
  title: "Final title",
  content: "Final content",
  clientVersion: 5                  // required for conflict detection
}
```

#### `note:leave`
Leave a note room.

**Payload:**
```javascript
{
  noteId: "note_id_string"
}
```

### Server to Client Events

#### `note:join`
Sent when user joins or when another user joins.

**Own Join Response:**
```javascript
{
  noteId: "note_id",
  note: {
    _id: "note_id",
    title: "Note Title",
    content: "Note content...",
    version: 3,
    lastEditedAt: "2023-12-01T10:00:00.000Z",
    lastEditedBy: { username: "editor", ... }
  },
  activeUsers: [
    { _id: "user1", username: "user1", firstName: "John", lastName: "Doe" }
  ],
  userPermission: "write",
  timestamp: "2023-12-01T10:00:00.000Z"
}
```

**Other User Join Notification:**
```javascript
{
  noteId: "note_id",
  userId: "user_id",
  username: "username",
  firstName: "John",
  lastName: "Doe",
  timestamp: "2023-12-01T10:00:00.000Z"
}
```

#### `note:update`
Sent when note is updated (optimistic or pessimistic).

**Optimistic Update:**
```javascript
{
  noteId: "note_id",
  title: "Updated title",
  content: "Updated content",
  version: 3,                       // current version
  changedBy: {
    userId: "user_id",
    username: "username",
    firstName: "John",
    lastName: "Doe"
  },
  cursorPosition: 150,
  selection: { start: 100, end: 150 },
  optimistic: true,
  timestamp: "2023-12-01T10:00:00.000Z"
}
```

**Pessimistic Update (Saved):**
```javascript
{
  noteId: "note_id",
  title: "Saved title",
  content: "Saved content",
  version: 4,                       // incremented version
  changedBy: { ... },
  lastEditedAt: "2023-12-01T10:00:00.000Z",
  optimistic: false,
  saved: true,
  timestamp: "2023-12-01T10:00:00.000Z"
}
```

#### `note:saved`
Confirmation that note was saved successfully.

```javascript
{
  noteId: "note_id",
  title: "Saved title",
  content: "Saved content",
  version: 4,
  lastEditedBy: {
    userId: "user_id",
    username: "username",
    firstName: "John",
    lastName: "Doe"
  },
  lastEditedAt: "2023-12-01T10:00:00.000Z",
  timestamp: "2023-12-01T10:00:00.000Z"
}
```

#### `note:conflict`
Sent when version conflict is detected.

```javascript
{
  noteId: "note_id",
  clientVersion: 3,
  serverVersion: 5,
  serverNote: {
    title: "Current server title",
    content: "Current server content",
    version: 5,
    lastEditedAt: "2023-12-01T10:00:00.000Z",
    lastEditedBy: "other_user_id"
  },
  message: "Note has been modified by another user. Please refresh and try again."
}
```

#### `note:leave`
Sent when user leaves note room.

**Own Leave Confirmation:**
```javascript
{
  noteId: "note_id",
  userId: "user_id",
  success: true,
  timestamp: "2023-12-01T10:00:00.000Z"
}
```

**Other User Leave Notification:**
```javascript
{
  noteId: "note_id",
  userId: "user_id",
  username: "username",
  reason: "disconnect",             // optional: "disconnect" for unexpected leave
  timestamp: "2023-12-01T10:00:00.000Z"
}
```

## Implementation Guide

### 1. Client-side Setup

```javascript
// Initialize Socket.io connection
const socket = io('http://localhost:5000', {
  auth: { token: 'jwt_token_here' }
});

// Join note room
socket.emit('note:join', { noteId: 'note_id_here' });

// Listen for events
socket.on('note:join', (data) => {
  if (data.note) {
    // Load note data
    updateEditor(data.note.title, data.note.content);
    currentVersion = data.note.version;
  } else {
    // Another user joined
    showUserJoined(data.username);
  }
});

socket.on('note:update', (data) => {
  if (data.optimistic) {
    // Show real-time update
    showOptimisticUpdate(data);
  } else {
    // Apply saved changes
    updateEditor(data.title, data.content);
    currentVersion = data.version;
  }
});
```

### 2. Optimistic Updates (Real-time Typing)

```javascript
// Send optimistic updates while typing
let optimisticTimer;
textEditor.addEventListener('input', (e) => {
  clearTimeout(optimisticTimer);
  
  optimisticTimer = setTimeout(() => {
    socket.emit('note:update', {
      noteId: currentNoteId,
      content: e.target.value,
      optimistic: true
    });
  }, 300); // Debounce 300ms
});
```

### 3. Pessimistic Updates (Saving)

```javascript
// Save to database
function saveNote() {
  socket.emit('note:update', {
    noteId: currentNoteId,
    title: titleInput.value,
    content: contentInput.value,
    clientVersion: currentVersion,
    optimistic: false
  });
}

// Auto-save every 5 seconds
setInterval(saveNote, 5000);
```

### 4. Conflict Resolution

```javascript
socket.on('note:conflict', (data) => {
  const message = `
    Version conflict detected!
    Your version: ${data.clientVersion}
    Server version: ${data.serverVersion}
    
    The note has been modified by another user.
  `;
  
  if (confirm(message + '\n\nReload the latest version?')) {
    // Reload server version
    updateEditor(data.serverNote.title, data.serverNote.content);
    currentVersion = data.serverVersion;
  }
});
```

## Concurrency Model

### Optimistic Updates
- **Purpose**: Immediate UI feedback for better user experience
- **Behavior**: Changes are broadcast to other users but not saved to database
- **Use Case**: Real-time typing, cursor movements

### Pessimistic Updates
- **Purpose**: Persist changes to database
- **Behavior**: Changes are saved to MongoDB and broadcast to all users
- **Concurrency**: Last write wins (simple conflict resolution)

### Version Tracking
- Each note has a version number that increments on content changes
- Clients track the version they're working with
- Server detects conflicts when client version < server version
- Conflicts trigger `note:conflict` event for manual resolution

## Security

### Authentication
- All Socket.io connections require JWT authentication
- Token is validated on connection and stored in socket session

### Authorization
- Note access permissions are checked for every operation
- Users can only join notes they have access to
- Write operations require write permission
- Read-only users cannot send updates

### Rate Limiting
- Optimistic updates are debounced on client-side
- Server can implement rate limiting for excessive updates

## Performance Considerations

### Scalability
- Each note creates a separate Socket.io room
- Active users are tracked per note room
- Memory usage scales with concurrent users and active notes

### Optimization
- Debounce optimistic updates to reduce network traffic
- Use MongoDB indexes for fast note lookups
- Consider Redis for session storage in multi-server deployments

## Testing

### Run Tests
```bash
npm test -- tests/realtime-collaboration.test.js
```

### Run Demo
```bash
npm run demo:realtime
```

### Manual Testing
1. Open multiple browser tabs with the same note
2. Type in one tab and see real-time updates in others
3. Test save conflicts by editing offline and reconnecting
4. Test user presence by joining/leaving notes

## Deployment Considerations

### WebSocket Support
- Ensure your hosting platform supports WebSockets
- Configure load balancer for sticky sessions if using multiple servers

### CORS Configuration
- Configure Socket.io CORS for your frontend domain
- Update `CLIENT_URL` environment variable

### Monitoring
- Monitor active connections and room counts
- Track message rates and error rates
- Set up alerts for connection failures

## Example Integration

See `examples/client-realtime-example.js` for a complete client-side implementation example that demonstrates:
- Connection management
- Event handling
- Optimistic/pessimistic updates
- Conflict resolution
- User presence
- Error handling
