require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Note = require('../models/Note');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for seeding');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Note.deleteMany({});
    console.log('Cleared existing data');

    // Create sample users
    const users = await User.create([
      {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      },
      {
        username: 'jane_smith',
        email: 'jane@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
      },
      {
        username: 'bob_wilson',
        email: 'bob@example.com',
        password: 'password123',
        firstName: 'Bob',
        lastName: 'Wilson',
      },
    ]);

    console.log('Created sample users');

    // Create sample notes
    const notes = await Note.create([
      {
        title: 'Welcome to Distributed Notes',
        content: `# Welcome to Distributed Notes!

This is a collaborative note-taking system where multiple users can edit notes in real-time.

## Features:
- Real-time collaboration
- Role-based sharing
- Rich text editing
- Tag organization
- Version tracking

Try sharing this note with other users and see the magic happen!`,
        tags: ['welcome', 'tutorial', 'collaboration'],
        owner: users[0]._id,
        lastEditedBy: users[0]._id,
      },
      {
        title: 'Project Planning',
        content: `# Project Planning Notes

## Phase 1: Research
- [ ] Market analysis
- [ ] Competitor research
- [ ] User interviews

## Phase 2: Development
- [ ] Backend API
- [ ] Frontend UI
- [ ] Real-time features

## Phase 3: Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] User acceptance testing`,
        tags: ['project', 'planning', 'todo'],
        owner: users[0]._id,
        collaborators: [
          {
            user: users[1]._id,
            permission: 'write',
            addedBy: users[0]._id,
          },
        ],
        lastEditedBy: users[0]._id,
      },
      {
        title: 'Meeting Notes - Team Sync',
        content: `# Team Sync Meeting - ${new Date().toLocaleDateString()}

## Attendees
- John Doe
- Jane Smith
- Bob Wilson

## Agenda
1. Project updates
2. Blockers discussion
3. Next steps

## Action Items
- [ ] John: Complete API documentation
- [ ] Jane: Review UI mockups
- [ ] Bob: Set up deployment pipeline

## Next Meeting
Date: Next Friday
Time: 2:00 PM`,
        tags: ['meeting', 'team', 'sync'],
        owner: users[1]._id,
        collaborators: [
          {
            user: users[0]._id,
            permission: 'read',
            addedBy: users[1]._id,
          },
          {
            user: users[2]._id,
            permission: 'write',
            addedBy: users[1]._id,
          },
        ],
        lastEditedBy: users[1]._id,
      },
      {
        title: 'Code Snippets',
        content: `# Useful Code Snippets

## JavaScript Array Methods

\`\`\`javascript
// Filter array
const filtered = array.filter(item => item.active);

// Map array
const mapped = array.map(item => ({ ...item, processed: true }));

// Reduce array
const sum = numbers.reduce((acc, num) => acc + num, 0);
\`\`\`

## MongoDB Queries

\`\`\`javascript
// Find with conditions
const users = await User.find({ isActive: true });

// Populate references
const notes = await Note.find().populate('owner', 'username email');

// Aggregation
const stats = await Note.aggregate([
  { $group: { _id: '$owner', count: { $sum: 1 } } }
]);
\`\`\``,
        tags: ['code', 'snippets', 'reference'],
        owner: users[2]._id,
        isPublic: true,
        lastEditedBy: users[2]._id,
      },
    ]);

    console.log('Created sample notes');
    console.log(`
Seed data created successfully!

Sample Users:
- john@example.com / password123
- jane@example.com / password123  
- bob@example.com / password123

Sample Notes: ${notes.length} notes created with various sharing permissions
    `);

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    mongoose.connection.close();
  }
};

const runSeed = async () => {
  await connectDB();
  await seedData();
};

runSeed();
