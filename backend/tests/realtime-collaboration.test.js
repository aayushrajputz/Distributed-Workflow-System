const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Note = require('../models/Note');
const { generateToken } = require('../config/jwt');
const noteSocketHandler = require('../sockets/noteSocket');

let mongoServer;
let httpServer;
let io;
let serverSocket;
let clientSocket1, clientSocket2;
let user1, user2, testNote;
let token1, token2;

beforeAll(async () => {
  // Setup MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test users
  user1 = await User.create({
    username: 'user1',
    email: 'user1@test.com',
    password: 'Password123!',
    firstName: 'User',
    lastName: 'One',
  });

  user2 = await User.create({
    username: 'user2',
    email: 'user2@test.com',
    password: 'Password123!',
    firstName: 'User',
    lastName: 'Two',
  });

  // Generate tokens
  token1 = generateToken({ userId: user1._id });
  token2 = generateToken({ userId: user2._id });

  // Setup Socket.io server
  httpServer = createServer();
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  
  noteSocketHandler(io);
  
  await new Promise((resolve) => {
    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      // Create client connections
      clientSocket1 = new Client(`http://localhost:${port}`, {
        auth: { token: token1 }
      });
      
      clientSocket2 = new Client(`http://localhost:${port}`, {
        auth: { token: token2 }
      });
      
      resolve();
    });
  });

  // Wait for connections
  await Promise.all([
    new Promise(resolve => clientSocket1.on('connect', resolve)),
    new Promise(resolve => clientSocket2.on('connect', resolve)),
  ]);
});

afterAll(async () => {
  clientSocket1?.disconnect();
  clientSocket2?.disconnect();
  httpServer?.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Note.deleteMany({});
  
  // Create test note
  testNote = await Note.create({
    title: 'Test Note',
    content: 'Initial content',
    owner: user1._id,
    lastEditedBy: user1._id,
  });

  // Add user2 as collaborator
  testNote.addCollaborator(user2._id, 'write', user1._id);
  await testNote.save();
});

describe('Real-time Collaboration', () => {
  describe('note:join events', () => {
    it('should allow user to join note room', (done) => {
      clientSocket1.on('note:join', (data) => {
        expect(data.noteId).toBe(testNote._id.toString());
        expect(data.note).toBeDefined();
        expect(data.note.title).toBe('Test Note');
        expect(data.note.version).toBe(1);
        expect(data.userPermission).toBe('owner');
        done();
      });

      clientSocket1.emit('note:join', { noteId: testNote._id.toString() });
    });

    it('should notify other users when someone joins', (done) => {
      let joinCount = 0;

      const handleJoin = (data) => {
        joinCount++;
        if (joinCount === 1) {
          // First join is user1's own join
          expect(data.note).toBeDefined();
        } else if (joinCount === 2) {
          // Second join is notification about user2
          expect(data.userId).toBe(user2._id.toString());
          expect(data.username).toBe('user2');
          done();
        }
      };

      clientSocket1.on('note:join', handleJoin);
      clientSocket2.on('note:join', handleJoin);

      // User1 joins first
      clientSocket1.emit('note:join', { noteId: testNote._id.toString() });
      
      setTimeout(() => {
        // User2 joins second
        clientSocket2.emit('note:join', { noteId: testNote._id.toString() });
      }, 100);
    });

    it('should deny access to unauthorized users', (done) => {
      // Create note owned by user1, no collaborators
      Note.create({
        title: 'Private Note',
        content: 'Private content',
        owner: user1._id,
        lastEditedBy: user1._id,
      }).then(privateNote => {
        clientSocket2.on('error', (error) => {
          expect(error.message).toBe('Access denied');
          done();
        });

        clientSocket2.emit('note:join', { noteId: privateNote._id.toString() });
      });
    });
  });

  describe('note:update events', () => {
    beforeEach((done) => {
      // Both users join the note
      let joinCount = 0;
      const handleJoin = () => {
        joinCount++;
        if (joinCount === 2) done();
      };

      clientSocket1.on('note:join', handleJoin);
      clientSocket2.on('note:join', handleJoin);

      clientSocket1.emit('note:join', { noteId: testNote._id.toString() });
      setTimeout(() => {
        clientSocket2.emit('note:join', { noteId: testNote._id.toString() });
      }, 50);
    });

    it('should broadcast optimistic updates to other users', (done) => {
      clientSocket2.on('note:update', (data) => {
        expect(data.content).toBe('Optimistic update from user1');
        expect(data.optimistic).toBe(true);
        expect(data.changedBy.userId).toBe(user1._id.toString());
        done();
      });

      clientSocket1.emit('note:update', {
        noteId: testNote._id.toString(),
        content: 'Optimistic update from user1',
        optimistic: true,
      });
    });

    it('should save pessimistic updates to database', (done) => {
      clientSocket1.on('note:update', (data) => {
        expect(data.content).toBe('Saved update');
        expect(data.optimistic).toBe(false);
        expect(data.saved).toBe(true);
        expect(data.version).toBe(2); // Version should increment
        
        // Verify database was updated
        Note.findById(testNote._id).then(updatedNote => {
          expect(updatedNote.content).toBe('Saved update');
          expect(updatedNote.version).toBe(2);
          done();
        });
      });

      clientSocket1.emit('note:update', {
        noteId: testNote._id.toString(),
        content: 'Saved update',
        optimistic: false,
      });
    });

    it('should implement last write wins for concurrent updates', (done) => {
      let updateCount = 0;
      
      const handleUpdate = (data) => {
        updateCount++;
        if (updateCount === 2) {
          // Check final state in database
          Note.findById(testNote._id).then(finalNote => {
            // Last write should win
            expect(finalNote.content).toBe('Update from user2');
            expect(finalNote.version).toBe(3); // Two updates
            done();
          });
        }
      };

      clientSocket1.on('note:update', handleUpdate);
      clientSocket2.on('note:update', handleUpdate);

      // Send concurrent updates
      clientSocket1.emit('note:update', {
        noteId: testNote._id.toString(),
        content: 'Update from user1',
        optimistic: false,
      });

      setTimeout(() => {
        clientSocket2.emit('note:update', {
          noteId: testNote._id.toString(),
          content: 'Update from user2',
          optimistic: false,
        });
      }, 10);
    });

    it('should deny updates from users without write access', (done) => {
      // Remove write access from user2
      testNote.collaborators[0].permission = 'read';
      testNote.save().then(() => {
        clientSocket2.on('error', (error) => {
          expect(error.message).toBe('Write access denied');
          done();
        });

        clientSocket2.emit('note:update', {
          noteId: testNote._id.toString(),
          content: 'Unauthorized update',
          optimistic: false,
        });
      });
    });
  });

  describe('note:save events with conflict detection', () => {
    beforeEach((done) => {
      clientSocket1.on('note:join', () => done());
      clientSocket1.emit('note:join', { noteId: testNote._id.toString() });
    });

    it('should save note successfully with correct version', (done) => {
      clientSocket1.on('note:saved', (data) => {
        expect(data.noteId).toBe(testNote._id.toString());
        expect(data.version).toBe(2);
        expect(data.content).toBe('Explicitly saved content');
        done();
      });

      clientSocket1.emit('note:save', {
        noteId: testNote._id.toString(),
        content: 'Explicitly saved content',
        clientVersion: 1,
      });
    });

    it('should detect version conflicts', (done) => {
      // First, update the note to increment version
      testNote.content = 'Updated by someone else';
      testNote.save().then(() => {
        clientSocket1.on('note:conflict', (data) => {
          expect(data.clientVersion).toBe(1);
          expect(data.serverVersion).toBe(2);
          expect(data.message).toContain('modified by another user');
          done();
        });

        // Try to save with old version
        clientSocket1.emit('note:save', {
          noteId: testNote._id.toString(),
          content: 'This should conflict',
          clientVersion: 1, // Old version
        });
      });
    });
  });

  describe('note:leave events', () => {
    beforeEach((done) => {
      let joinCount = 0;
      const handleJoin = () => {
        joinCount++;
        if (joinCount === 2) done();
      };

      clientSocket1.on('note:join', handleJoin);
      clientSocket2.on('note:join', handleJoin);

      clientSocket1.emit('note:join', { noteId: testNote._id.toString() });
      setTimeout(() => {
        clientSocket2.emit('note:join', { noteId: testNote._id.toString() });
      }, 50);
    });

    it('should handle explicit leave', (done) => {
      clientSocket1.on('note:leave', (data) => {
        if (data.success) {
          expect(data.noteId).toBe(testNote._id.toString());
          expect(data.userId).toBe(user2._id.toString());
          done();
        }
      });

      clientSocket2.on('note:leave', (data) => {
        if (data.userId === user2._id.toString()) {
          expect(data.username).toBe('user2');
        }
      });

      clientSocket2.emit('note:leave', { noteId: testNote._id.toString() });
    });

    it('should handle disconnect as leave', (done) => {
      clientSocket1.on('note:leave', (data) => {
        expect(data.userId).toBe(user2._id.toString());
        expect(data.reason).toBe('disconnect');
        done();
      });

      // Simulate disconnect
      clientSocket2.disconnect();
    });
  });

  describe('Concurrency and optimistic updates', () => {
    it('should handle rapid optimistic updates', (done) => {
      let updateCount = 0;
      const expectedUpdates = 3;

      clientSocket2.on('note:update', (data) => {
        updateCount++;
        expect(data.optimistic).toBe(true);
        
        if (updateCount === expectedUpdates) {
          done();
        }
      });

      // Both users join
      clientSocket1.emit('note:join', { noteId: testNote._id.toString() });
      clientSocket2.emit('note:join', { noteId: testNote._id.toString() });

      setTimeout(() => {
        // Send rapid optimistic updates
        for (let i = 0; i < expectedUpdates; i++) {
          clientSocket1.emit('note:update', {
            noteId: testNote._id.toString(),
            content: `Rapid update ${i}`,
            optimistic: true,
          });
        }
      }, 100);
    });
  });
});
