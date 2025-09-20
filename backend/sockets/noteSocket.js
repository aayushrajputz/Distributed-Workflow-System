const Note = require('../models/Note');
const User = require('../models/User');
const { verifyToken } = require('../config/jwt');

const activeUsers = new Map();
const userSockets = new Map();

const noteSocketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    userSockets.set(socket.userId, socket.id);

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
          socket.emit('error', { message: 'Write access denied' });
          return;
        }

        // Leave previous rooms
        Array.from(socket.rooms).forEach((room) => {
          if (room !== socket.id && room.startsWith('note-')) {
            const prevNoteId = room.replace('note-', '');
            socket.leave(room);

            if (activeUsers.has(prevNoteId)) {
              const users = activeUsers.get(prevNoteId);
              users.delete(socket.userId);

              socket.to(room).emit('note:leave', {
                noteId: prevNoteId,
                userId: socket.userId,
                username: socket.user.username,
                timestamp: new Date()
              });

              if (users.size === 0) {
                activeUsers.delete(prevNoteId);
              }
            }
          }
        });

        // Join new room
        const roomName = `note-${noteId}`;
        socket.join(roomName);

        if (!activeUsers.has(noteId)) {
          activeUsers.set(noteId, new Set());
        }
        activeUsers.get(noteId).add(socket.userId);

        // Get active users
        const currentUsers = Array.from(activeUsers.get(noteId));
        const userDetails = await User.find({ _id: { $in: currentUsers } })
          .select('username firstName lastName');

        // Get note data
        const noteData = await Note.findById(noteId)
          .populate('owner', 'username firstName lastName')
          .populate('lastEditedBy', 'username firstName lastName')
          .populate('collaborators.user', 'username firstName lastName');

        const userPermission = note.getUserPermission(socket.userId);
        const fullNoteData = noteData.toObject();

        // Send note data to joining user
        socket.emit('note:join', {
          noteId,
          note: {
            _id: fullNoteData._id,
            title: fullNoteData.title,
            content: fullNoteData.content,
            version: fullNoteData.version,
            lastEditedAt: fullNoteData.lastEditedAt,
            lastEditedBy: fullNoteData.lastEditedBy,
            owner: fullNoteData.owner,
            collaborators: fullNoteData.collaborators,
            isShared: fullNoteData.isShared,
            isPublic: fullNoteData.isPublic,
            tags: fullNoteData.tags,
            createdAt: fullNoteData.createdAt,
            updatedAt: fullNoteData.updatedAt
          },
          activeUsers: userDetails,
          userPermission,
          timestamp: new Date()
        });

        // Notify others
        socket.to(roomName).emit('note:join', {
          noteId,
          userId: socket.userId,
          username: socket.user.username,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Join note error:', error);
        socket.emit('error', { message: 'Failed to join note' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      userSockets.delete(socket.userId);
      
      Array.from(socket.rooms).forEach((room) => {
        if (room.startsWith('note-')) {
          const noteId = room.replace('note-', '');
          if (activeUsers.has(noteId)) {
            const users = activeUsers.get(noteId);
            users.delete(socket.userId);

            socket.to(room).emit('note:leave', {
              noteId,
              userId: socket.userId,
              username: socket.user.username,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName,
              reason: 'disconnect',
              timestamp: new Date()
            });

            if (users.size === 0) {
              activeUsers.delete(noteId);
            }
          }
        }
      });
    });

    socket.on('note:update', async (data) => {
      try {
        const { noteId, title, content, clientVersion, optimistic = true, cursorPosition, selection } = data;
        const note = await Note.findById(noteId);

        if (!note || note.isDeleted) {
          socket.emit('error', { message: 'Note not found' });
          return;
        }

        if (!note.hasAccess(socket.userId, 'write')) {
          socket.emit('error', { message: 'Write access denied' });
          return;
        }

        if (optimistic) {
          socket.to(`note-${noteId}`).emit('note:update', {
            noteId,
            content,
            title,
            version: note.version,
            changedBy: {
              userId: socket.userId,
              username: socket.user.username,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName
            },
            cursorPosition,
            selection,
            optimistic: true,
            timestamp: new Date()
          });
        } else {
          let hasChanges = false;

          if (title !== undefined) {
            note.title = title;
            hasChanges = true;
          }

          if (content !== undefined) {
            note.content = content;
            hasChanges = true;
          }

          if (hasChanges) {
            note.lastEditedBy = socket.userId;
            await note.save();

            io.to(`note-${noteId}`).emit('note:update', {
              noteId,
              title: note.title,
              content: note.content,
              version: note.version,
              changedBy: {
                userId: socket.userId,
                username: socket.user.username,
                firstName: socket.user.firstName,
                lastName: socket.user.lastName
              },
              lastEditedAt: note.lastEditedAt,
              optimistic: false,
              saved: true,
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        console.error('Note update error:', error);
        socket.emit('error', { message: 'Failed to process note update' });
      }
    });

    socket.on('cursor-position', (data) => {
      const { noteId, position, selection } = data;
      socket.to(`note-${noteId}`).emit('cursor-updated', {
        userId: socket.userId,
        username: socket.user.username,
        position,
        selection,
        timestamp: new Date()
      });
    });

    socket.on('typing-start', (data) => {
      const { noteId } = data;
      socket.to(`note-${noteId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: true
      });
    });

    socket.on('typing-stop', (data) => {
      const { noteId } = data;
      socket.to(`note-${noteId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: false
      });
    });

    socket.on('note:leave', async (data) => {
      try {
        const { noteId } = data;
        const roomName = `note-${noteId}`;

        socket.leave(roomName);

        const user = await User.findById(socket.userId).select('username firstName lastName');

        if (activeUsers.has(noteId)) {
          const users = activeUsers.get(noteId);
          users.delete(socket.userId);

          socket.to(roomName).emit('note:leave', {
            noteId,
            userId: socket.userId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            timestamp: new Date(),
            reason: 'explicit'
          });

          if (users.size === 0) {
            activeUsers.delete(noteId);
          }
        }

        socket.emit('note:leave', {
          noteId,
          userId: socket.userId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          success: true,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Leave note error:', error);
        socket.emit('error', { message: 'Failed to leave note' });
      }
    });

    socket.on('note:save', async (data) => {
      try {
        const { noteId, title, content, clientVersion } = data;
        const note = await Note.findById(noteId);

        if (!note || note.isDeleted) {
          socket.emit('error', { message: 'Note not found' });
          return;
        }

        if (!note.hasAccess(socket.userId, 'write')) {
          socket.emit('error', { message: 'Write access denied' });
          return;
        }

        if (clientVersion !== undefined && clientVersion < note.version) {
          const conflict = {
            noteId,
            clientVersion,
            serverVersion: note.version,
            currentContent: note.content,
            proposedContent: content,
            currentTitle: note.title,
            proposedTitle: title,
            lastEditedAt: note.lastEditedAt,
            lastEditedBy: note.lastEditedBy
          };

          socket.emit('note:conflict', conflict);
          return;
        }

        let hasChanges = false;
        const oldVersion = note.version;

        if (title !== undefined) {
          note.title = title;
          hasChanges = true;
        }

        if (content !== undefined) {
          note.content = content;
          hasChanges = true;
        }

        if (hasChanges) {
          note.lastEditedBy = socket.userId;
          note.version = (oldVersion || 1) + 1;
          await note.save();

          io.to(`note-${noteId}`).emit('note:saved', {
            noteId,
            title: note.title,
            content: note.content,
            version: note.version,
            previousVersion: oldVersion,
            lastEditedBy: {
              userId: socket.userId,
              username: socket.user.username,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName
            },
            lastEditedAt: note.lastEditedAt,
            saved: true,
            timestamp: new Date()
          });
        } else {
          socket.emit('note:saved', {
            noteId,
            version: note.version,
            message: 'No changes detected',
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Save note error:', error);
        socket.emit('error', { message: 'Failed to save note' });
      }
    });
  });
};

module.exports = noteSocketHandler;
