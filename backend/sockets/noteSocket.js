const Note = require('../models/Note');
const User = require('../models/User');
const { verifyToken } = require('../config/jwt');

// Store active users for each note
const activeUsers = new Map(); // noteId -> Set of user objects
const userSockets = new Map(); // userId -> socketId

const noteSocketHandler = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const { token } = socket.handshake.auth;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected: ${socket.id}`);

    // Store user socket mapping
    userSockets.set(socket.userId, socket.id);

    // Join note room - Updated to match specifications
    socket.on('note:join', async (data) => {
      try {
        const { noteId } = data;
        const note = await Note.findById(noteId);

        if (!note || note.isDeleted) {
          socket.emit('error', { message: 'Note not found' });
          return;
        }

        // Check if user has access
        if (!note.hasAccess(socket.userId)) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Leave previous rooms and emit leave events
        const rooms = Array.from(socket.rooms);
        rooms.forEach((room) => {
          if (room !== socket.id && room.startsWith('note-')) {
            const prevNoteId = room.replace('note-', '');
            socket.leave(room);

            // Remove from active users
            if (activeUsers.has(prevNoteId)) {
              const users = activeUsers.get(prevNoteId);
              users.delete(socket.userId);

              // Emit note:leave event
              socket.to(room).emit('note:leave', {
                noteId: prevNoteId,
                userId: socket.userId,
                username: socket.user.username,
                timestamp: new Date(),
              });

              if (users.size === 0) {
                activeUsers.delete(prevNoteId);
              }
            }
          }
        });

        // Join new note room
        const roomName = `note-${noteId}`;
        socket.join(roomName);

        // Add to active users
        if (!activeUsers.has(noteId)) {
          activeUsers.set(noteId, new Set());
        }
        activeUsers.get(noteId).add(socket.userId);

        // Get current active users for this note
        const currentUsers = Array.from(activeUsers.get(noteId));
        const userDetails = await User.find({
          _id: { $in: currentUsers },
        }).select('username firstName lastName');

        // Get current note data with version for optimistic updates
        const noteData = await Note.findById(noteId)
          .populate('owner', 'username firstName lastName')
          .populate('lastEditedBy', 'username firstName lastName');

        // Notify user of successful join
        socket.emit('note:join', {
          noteId,
          note: {
            _id: noteData._id,
            title: noteData.title,
            content: noteData.content,
            version: noteData.version,
            lastEditedAt: noteData.lastEditedAt,
            lastEditedBy: noteData.lastEditedBy,
          },
          activeUsers: userDetails,
          userPermission: noteData.getUserPermission(socket.userId),
          timestamp: new Date(),
        });

        // Notify others that user joined
        socket.to(roomName).emit('note:join', {
          noteId,
          userId: socket.userId,
          username: socket.user.username,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Join note error:', error);
        socket.emit('error', { message: 'Failed to join note' });
      }
    });

    // Handle real-time note updates with optimistic concurrency
    socket.on('note:update', async (data) => {
      try {
        const {
          noteId,
          title,
          content,
          clientVersion,
          optimistic = true,
          cursorPosition,
          selection,
        } = data;

        const note = await Note.findById(noteId);
        if (!note || note.isDeleted) {
          socket.emit('error', { message: 'Note not found' });
          return;
        }

        // Check write access
        if (!note.hasAccess(socket.userId, 'write')) {
          socket.emit('error', { message: 'Write access denied' });
          return;
        }

        // Optimistic update handling
        if (optimistic) {
          // For optimistic updates, just broadcast to other users
          // Don't save to database yet
          socket.to(`note-${noteId}`).emit('note:update', {
            noteId,
            title,
            content,
            version: note.version, // Current version
            changedBy: {
              userId: socket.userId,
              username: socket.user.username,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName,
            },
            cursorPosition,
            selection,
            optimistic: true,
            timestamp: new Date(),
          });
        } else {
          // Pessimistic update - save to database (last write wins)
          let hasChanges = false;

          if (title !== undefined && title !== note.title) {
            note.title = title;
            hasChanges = true;
          }

          if (content !== undefined && content !== note.content) {
            note.content = content;
            hasChanges = true;
          }

          if (hasChanges) {
            note.lastEditedBy = socket.userId;
            await note.save(); // This increments version automatically

            // Broadcast the saved changes to all users (including sender)
            io.to(`note-${noteId}`).emit('note:update', {
              noteId,
              title: note.title,
              content: note.content,
              version: note.version,
              changedBy: {
                userId: socket.userId,
                username: socket.user.username,
                firstName: socket.user.firstName,
                lastName: socket.user.lastName,
              },
              lastEditedAt: note.lastEditedAt,
              optimistic: false,
              saved: true,
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        console.error('Note update error:', error);
        socket.emit('error', { message: 'Failed to process note update' });
      }
    });

    // Handle cursor position updates
    socket.on('cursor-position', (data) => {
      const { noteId, position, selection } = data;

      socket.to(`note-${noteId}`).emit('cursor-updated', {
        userId: socket.userId,
        username: socket.user.username,
        position,
        selection,
        timestamp: new Date(),
      });
    });

    // Handle explicit note save (for manual saves)
    socket.on('note:save', async (data) => {
      try {
        const {
          noteId, title, content, clientVersion,
        } = data;

        const note = await Note.findById(noteId);
        if (!note || note.isDeleted) {
          socket.emit('error', { message: 'Note not found' });
          return;
        }

        // Check write access
        if (!note.hasAccess(socket.userId, 'write')) {
          socket.emit('error', { message: 'Write access denied' });
          return;
        }

        // Check for version conflicts (optimistic concurrency control)
        if (clientVersion && clientVersion < note.version) {
          // Version conflict - client is behind
          socket.emit('note:conflict', {
            noteId,
            clientVersion,
            serverVersion: note.version,
            serverNote: {
              title: note.title,
              content: note.content,
              version: note.version,
              lastEditedAt: note.lastEditedAt,
              lastEditedBy: note.lastEditedBy,
            },
            message: 'Note has been modified by another user. Please refresh and try again.',
          });
          return;
        }

        // Last write wins - update note
        let hasChanges = false;

        if (title !== undefined && title !== note.title) {
          note.title = title;
          hasChanges = true;
        }

        if (content !== undefined && content !== note.content) {
          note.content = content;
          hasChanges = true;
        }

        if (hasChanges) {
          note.lastEditedBy = socket.userId;
          await note.save();

          // Notify all users in the room about the save
          io.to(`note-${noteId}`).emit('note:saved', {
            noteId,
            title: note.title,
            content: note.content,
            version: note.version,
            lastEditedBy: {
              userId: socket.userId,
              username: socket.user.username,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName,
            },
            lastEditedAt: note.lastEditedAt,
            timestamp: new Date(),
          });
        } else {
          // No changes, just acknowledge
          socket.emit('note:saved', {
            noteId,
            version: note.version,
            message: 'No changes to save',
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error('Save note error:', error);
        socket.emit('error', { message: 'Failed to save note' });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      const { noteId } = data;
      socket.to(`note-${noteId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: true,
      });
    });

    socket.on('typing-stop', (data) => {
      const { noteId } = data;
      socket.to(`note-${noteId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: false,
      });
    });

    // Handle explicit note leave
    socket.on('note:leave', (data) => {
      try {
        const { noteId } = data;
        const roomName = `note-${noteId}`;

        // Leave the room
        socket.leave(roomName);

        // Remove from active users
        if (activeUsers.has(noteId)) {
          const users = activeUsers.get(noteId);
          users.delete(socket.userId);

          // Emit note:leave event to remaining users
          socket.to(roomName).emit('note:leave', {
            noteId,
            userId: socket.userId,
            username: socket.user.username,
            timestamp: new Date(),
          });

          if (users.size === 0) {
            activeUsers.delete(noteId);
          }
        }

        // Acknowledge the leave
        socket.emit('note:leave', {
          noteId,
          userId: socket.userId,
          success: true,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Leave note error:', error);
        socket.emit('error', { message: 'Failed to leave note' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.username} disconnected: ${socket.id}`);

      // Remove from user sockets mapping
      userSockets.delete(socket.userId);

      // Remove from all active note rooms and emit leave events
      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (room.startsWith('note-')) {
          const noteId = room.replace('note-', '');
          if (activeUsers.has(noteId)) {
            const users = activeUsers.get(noteId);
            users.delete(socket.userId);

            // Emit note:leave event for disconnect
            socket.to(room).emit('note:leave', {
              noteId,
              userId: socket.userId,
              username: socket.user.username,
              reason: 'disconnect',
              timestamp: new Date(),
            });

            if (users.size === 0) {
              activeUsers.delete(noteId);
            }
          }
        }
      });
    });
  });
};

module.exports = noteSocketHandler;
