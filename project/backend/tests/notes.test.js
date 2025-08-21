const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const User = require('../models/User');
const Note = require('../models/Note');

let mongoServer;
let ownerToken, collaboratorToken, readerToken;
let owner, collaborator, reader;
let testNote;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test users
  owner = await User.create({
    username: 'noteowner',
    email: 'owner@test.com',
    password: 'Password123!',
    firstName: 'Note',
    lastName: 'Owner',
  });

  collaborator = await User.create({
    username: 'collaborator',
    email: 'collaborator@test.com',
    password: 'Password123!',
    firstName: 'Write',
    lastName: 'Collaborator',
  });

  reader = await User.create({
    username: 'reader',
    email: 'reader@test.com',
    password: 'Password123!',
    firstName: 'Read',
    lastName: 'Only',
  });

  // Get tokens
  const ownerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner@test.com', password: 'Password123!' });
  ownerToken = ownerLogin.body.token;

  const collaboratorLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'collaborator@test.com', password: 'Password123!' });
  collaboratorToken = collaboratorLogin.body.token;

  const readerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'reader@test.com', password: 'Password123!' });
  readerToken = readerLogin.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Note.deleteMany({});
});

describe('Notes CRUD Operations', () => {
  describe('POST /api/notes', () => {
    it('should create a new note successfully', async () => {
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note content.',
        tags: ['test', 'demo'],
        isPublic: false,
      };

      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(noteData)
        .expect(201);

      expect(response.body.message).toBe('Note created successfully');
      expect(response.body.note.title).toBe(noteData.title);
      expect(response.body.note.content).toBe(noteData.content);
      expect(response.body.note.tags).toEqual(noteData.tags);
      expect(response.body.note.owner._id).toBe(owner._id.toString());
    });

    it('should require authentication', async () => {
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note content.',
      };

      await request(app)
        .post('/api/notes')
        .send(noteData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          content: 'Content without title',
        })
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/notes', () => {
    beforeEach(async () => {
      // Create test notes
      testNote = await Note.create({
        title: 'Owner Note',
        content: 'This is owner note',
        tags: ['owner'],
        owner: owner._id,
        lastEditedBy: owner._id,
      });

      const sharedNote = await Note.create({
        title: 'Shared Note',
        content: 'This is shared note',
        tags: ['shared'],
        owner: owner._id,
        lastEditedBy: owner._id,
      });

      // Add collaborator
      sharedNote.addCollaborator(collaborator._id, 'write', owner._id);
      await sharedNote.save();

      await Note.create({
        title: 'Public Note',
        content: 'This is public note',
        tags: ['public'],
        owner: owner._id,
        isPublic: true,
        lastEditedBy: owner._id,
      });
    });

    it('should get all notes for owner', async () => {
      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.notes).toHaveLength(3);
      expect(response.body.total).toBe(3);
    });

    it('should get accessible notes for collaborator', async () => {
      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(200);

      expect(response.body.notes).toHaveLength(2); // Shared + Public
    });

    it('should get only public notes for reader', async () => {
      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);

      expect(response.body.notes).toHaveLength(1); // Only public
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/notes?search=owner')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.notes).toHaveLength(1);
      expect(response.body.notes[0].title).toBe('Owner Note');
    });

    it('should support tag filtering', async () => {
      const response = await request(app)
        .get('/api/notes?tags=public')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.notes).toHaveLength(1);
      expect(response.body.notes[0].tags).toContain('public');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/notes?page=1&limit=2')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.notes).toHaveLength(2);
      expect(response.body.currentPage).toBe('1');
      expect(response.body.totalPages).toBe(2);
    });
  });

  describe('GET /api/notes/:id', () => {
    beforeEach(async () => {
      testNote = await Note.create({
        title: 'Test Note',
        content: 'Test content',
        owner: owner._id,
        lastEditedBy: owner._id,
      });
    });

    it('should get note details for owner', async () => {
      const response = await request(app)
        .get(`/api/notes/${testNote._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.note.title).toBe('Test Note');
      expect(response.body.note.userPermission).toBe('owner');
    });

    it('should deny access to unauthorized user', async () => {
      await request(app)
        .get(`/api/notes/${testNote._id}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent note', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/notes/${fakeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/notes/:id', () => {
    beforeEach(async () => {
      testNote = await Note.create({
        title: 'Test Note',
        content: 'Test content',
        owner: owner._id,
        lastEditedBy: owner._id,
      });

      // Add collaborator with write access
      testNote.addCollaborator(collaborator._id, 'write', owner._id);
      await testNote.save();
    });

    it('should update note by owner', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
        tags: ['updated'],
      };

      const response = await request(app)
        .put(`/api/notes/${testNote._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.note.title).toBe('Updated Title');
      expect(response.body.note.content).toBe('Updated content');
      expect(response.body.note.tags).toEqual(['updated']);
    });

    it('should update note by write collaborator', async () => {
      const updateData = {
        content: 'Updated by collaborator',
      };

      const response = await request(app)
        .put(`/api/notes/${testNote._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.note.content).toBe('Updated by collaborator');
    });

    it('should deny update by read-only user', async () => {
      // Add reader with read-only access
      testNote.addCollaborator(reader._id, 'read', owner._id);
      await testNote.save();

      await request(app)
        .put(`/api/notes/${testNote._id}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ content: 'Unauthorized update' })
        .expect(403);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    beforeEach(async () => {
      testNote = await Note.create({
        title: 'Test Note',
        content: 'Test content',
        owner: owner._id,
        lastEditedBy: owner._id,
      });
    });

    it('should delete note by owner', async () => {
      const response = await request(app)
        .delete(`/api/notes/${testNote._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.message).toBe('Note deleted successfully');

      // Verify soft delete
      const deletedNote = await Note.findById(testNote._id);
      expect(deletedNote.isDeleted).toBe(true);
      expect(deletedNote.deletedAt).toBeDefined();
    });

    it('should deny delete by collaborator', async () => {
      testNote.addCollaborator(collaborator._id, 'write', owner._id);
      await testNote.save();

      await request(app)
        .delete(`/api/notes/${testNote._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent note', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .delete(`/api/notes/${fakeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});
