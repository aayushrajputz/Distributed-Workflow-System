/**
 * Real-time Collaboration Demo
 *
 * This script demonstrates the Socket.io real-time collaboration features
 * with optimistic updates and concurrency handling.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const User = require('../models/User');
const Note = require('../models/Note');
const { generateToken } = require('../config/jwt');
const noteSocketHandler = require('../sockets/noteSocket');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for real-time demo');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const demonstrateRealTimeCollaboration = async () => {
  console.log('\n🔄 Real-time Collaboration Demo\n');

  // Create HTTP server and Socket.io instance
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Initialize socket handlers
  noteSocketHandler(io);

  // Start server
  const PORT = 3001;
  httpServer.listen(PORT);
  console.log(`🚀 Demo server running on port ${PORT}`);

  try {
    // Clean up existing demo data
    await User.deleteMany({ email: { $regex: /@realtime-demo\.com$/ } });
    await Note.deleteMany({ title: { $regex: /^Realtime Demo/ } });

    // 1. Create Demo Users
    console.log('1️⃣ Creating Demo Users');

    const owner = await User.create({
      username: 'rtowner',
      email: 'owner@realtime-demo.com',
      password: 'SecurePass123!',
      firstName: 'Real',
      lastName: 'Owner',
    });

    const collaborator1 = await User.create({
      username: 'rtcollab1',
      email: 'collab1@realtime-demo.com',
      password: 'SecurePass123!',
      firstName: 'Collaborator',
      lastName: 'One',
    });

    const collaborator2 = await User.create({
      username: 'rtcollab2',
      email: 'collab2@realtime-demo.com',
      password: 'SecurePass123!',
      firstName: 'Collaborator',
      lastName: 'Two',
    });

    console.log('✅ Created 3 demo users');

    // 2. Create Demo Note
    console.log('\n2️⃣ Creating Demo Note');

    const demoNote = await Note.create({
      title: 'Realtime Demo Note',
      content: 'This note will be edited in real-time by multiple users.',
      tags: ['realtime', 'demo', 'collaboration'],
      owner: owner._id,
      lastEditedBy: owner._id,
    });

    // Add collaborators
    demoNote.addCollaborator(collaborator1._id, 'write', owner._id);
    demoNote.addCollaborator(collaborator2._id, 'write', owner._id);
    await demoNote.save();

    console.log('✅ Created demo note with collaborators');

    // 3. Generate JWT tokens
    const ownerToken = generateToken({ userId: owner._id });
    const collab1Token = generateToken({ userId: collaborator1._id });
    const collab2Token = generateToken({ userId: collaborator2._id });

    // 4. Create Socket.io clients
    console.log('\n3️⃣ Creating Socket.io Clients');

    const ownerClient = new Client(`http://localhost:${PORT}`, {
      auth: { token: ownerToken },
    });

    const collab1Client = new Client(`http://localhost:${PORT}`, {
      auth: { token: collab1Token },
    });

    const collab2Client = new Client(`http://localhost:${PORT}`, {
      auth: { token: collab2Token },
    });

    // Wait for connections
    await Promise.all([
      new Promise((resolve) => ownerClient.on('connect', resolve)),
      new Promise((resolve) => collab1Client.on('connect', resolve)),
      new Promise((resolve) => collab2Client.on('connect', resolve)),
    ]);

    console.log('✅ All clients connected');

    // 5. Demonstrate note:join events
    console.log('\n4️⃣ Testing note:join Events');

    // Set up event listeners
    const setupEventListeners = (client, name) => {
      client.on('note:join', (data) => {
        if (data.note) {
          console.log(`📝 ${name} joined note: ${data.note.title} (v${data.note.version})`);
        } else {
          console.log(`👋 ${name} sees ${data.username} joined the note`);
        }
      });

      client.on('note:update', (data) => {
        console.log(`✏️ ${name} received update from ${data.changedBy.username}: "${data.content?.substring(0, 50)}..."`);
      });

      client.on('note:leave', (data) => {
        if (data.success) {
          console.log(`👋 ${name} left note successfully`);
        } else {
          console.log(`👋 ${name} sees ${data.username} left the note`);
        }
      });

      client.on('note:saved', (data) => {
        console.log(`💾 ${name} sees note saved (v${data.version}) by ${data.lastEditedBy?.username}`);
      });

      client.on('note:conflict', (data) => {
        console.log(`⚠️ ${name} has version conflict: client v${data.clientVersion} vs server v${data.serverVersion}`);
      });

      client.on('error', (error) => {
        console.log(`❌ ${name} error:`, error.message);
      });
    };

    setupEventListeners(ownerClient, 'Owner');
    setupEventListeners(collab1Client, 'Collab1');
    setupEventListeners(collab2Client, 'Collab2');

    // Join note room
    ownerClient.emit('note:join', { noteId: demoNote._id.toString() });
    await new Promise((resolve) => setTimeout(resolve, 100));

    collab1Client.emit('note:join', { noteId: demoNote._id.toString() });
    await new Promise((resolve) => setTimeout(resolve, 100));

    collab2Client.emit('note:join', { noteId: demoNote._id.toString() });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 6. Demonstrate optimistic updates
    console.log('\n5️⃣ Testing Optimistic Updates');

    // Owner makes optimistic update
    ownerClient.emit('note:update', {
      noteId: demoNote._id.toString(),
      content: 'Owner is typing... This is an optimistic update.',
      optimistic: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Collaborator 1 makes optimistic update
    collab1Client.emit('note:update', {
      noteId: demoNote._id.toString(),
      content: 'Collaborator 1 is also typing... Another optimistic update.',
      optimistic: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    // 7. Demonstrate pessimistic updates (saves to database)
    console.log('\n6️⃣ Testing Pessimistic Updates (Database Saves)');

    // Owner saves changes
    ownerClient.emit('note:update', {
      noteId: demoNote._id.toString(),
      title: 'Realtime Demo Note - Updated by Owner',
      content: 'This content was saved by the owner. Last write wins!',
      optimistic: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Collaborator 2 tries to save with different content (last write wins)
    collab2Client.emit('note:update', {
      noteId: demoNote._id.toString(),
      content: 'This content was saved by collaborator 2. This should win!',
      optimistic: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    // 8. Demonstrate explicit save with version conflict
    console.log('\n7️⃣ Testing Version Conflicts');

    // Get current note version
    const currentNote = await Note.findById(demoNote._id);
    const oldVersion = currentNote.version - 1; // Simulate old version

    // Try to save with old version
    collab1Client.emit('note:save', {
      noteId: demoNote._id.toString(),
      content: 'This should cause a conflict',
      clientVersion: oldVersion,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    // 9. Demonstrate note:leave events
    console.log('\n8️⃣ Testing note:leave Events');

    // Collaborator 1 leaves explicitly
    collab1Client.emit('note:leave', { noteId: demoNote._id.toString() });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Collaborator 2 disconnects (simulates browser close)
    collab2Client.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 10. Final state
    console.log('\n9️⃣ Final Note State');
    const finalNote = await Note.findById(demoNote._id);
    console.log(`📄 Final title: ${finalNote.title}`);
    console.log(`📄 Final content: ${finalNote.content}`);
    console.log(`📄 Final version: ${finalNote.version}`);
    console.log(`📄 Last edited by: ${finalNote.lastEditedBy}`);

    console.log('\n🎉 Real-time Collaboration Demo Complete!');

    // Summary of events demonstrated
    console.log('\n📋 Events Demonstrated:');
    console.log('✅ note:join - Users joining note rooms');
    console.log('✅ note:update - Real-time content updates (optimistic & pessimistic)');
    console.log('✅ note:leave - Users leaving note rooms');
    console.log('✅ note:save - Explicit saves with conflict detection');
    console.log('✅ note:conflict - Version conflict handling');
    console.log('✅ Optimistic updates - Immediate UI updates');
    console.log('✅ Last write wins - Simple concurrency resolution');
    console.log('✅ MongoDB sync - All changes persisted to database');
  } catch (error) {
    console.error('❌ Demo error:', error.message);
  } finally {
    // Clean up
    await User.deleteMany({ email: { $regex: /@realtime-demo\.com$/ } });
    await Note.deleteMany({ title: { $regex: /^Realtime Demo/ } });
    httpServer.close();
    mongoose.connection.close();
  }
};

const runDemo = async () => {
  await connectDB();
  await demonstrateRealTimeCollaboration();
};

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = { demonstrateRealTimeCollaboration };
