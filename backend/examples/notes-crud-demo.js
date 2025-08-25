/**
 * Notes CRUD Module Demo
 *
 * This script demonstrates the complete Notes CRUD functionality
 * with role-based access control and collaboration features.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Note = require('../models/Note');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for Notes CRUD demo');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const demonstrateNotesCRUD = async () => {
  console.log('\n📝 Notes CRUD Module Demo\n');

  try {
    // Clean up existing demo data
    await User.deleteMany({ email: { $in: ['owner@demo.com', 'collaborator@demo.com', 'reader@demo.com'] } });
    await Note.deleteMany({ title: { $regex: /^Demo Note/ } });

    // 1. Create Demo Users
    console.log('1️⃣ Creating Demo Users');

    const owner = await User.create({
      username: 'noteowner',
      email: 'owner@demo.com',
      password: 'SecurePass123!',
      firstName: 'Note',
      lastName: 'Owner',
    });

    const collaborator = await User.create({
      username: 'collaborator',
      email: 'collaborator@demo.com',
      password: 'SecurePass123!',
      firstName: 'Write',
      lastName: 'Collaborator',
    });

    const reader = await User.create({
      username: 'reader',
      email: 'reader@demo.com',
      password: 'SecurePass123!',
      firstName: 'Read',
      lastName: 'Only',
    });

    console.log('✅ Created 3 demo users: Owner, Write Collaborator, Read-only User');

    // 2. Create Notes (Owner)
    console.log('\n2️⃣ Creating Notes (Owner)');

    const personalNote = await Note.create({
      title: 'Demo Note - Personal',
      content: 'This is a personal note that only the owner can see and edit.',
      tags: ['personal', 'private'],
      owner: owner._id,
      lastEditedBy: owner._id,
    });

    const sharedNote = await Note.create({
      title: 'Demo Note - Shared',
      content: 'This note will be shared with collaborators.',
      tags: ['shared', 'collaboration'],
      owner: owner._id,
      lastEditedBy: owner._id,
    });

    const publicNote = await Note.create({
      title: 'Demo Note - Public',
      content: 'This is a public note that everyone can read.',
      tags: ['public', 'announcement'],
      owner: owner._id,
      isPublic: true,
      lastEditedBy: owner._id,
    });

    console.log('✅ Created 3 notes: Personal, Shared, Public');

    // 3. Add Collaborators
    console.log('\n3️⃣ Adding Collaborators');

    // Add write collaborator to shared note
    sharedNote.addCollaborator(collaborator._id, 'write', owner._id);
    await sharedNote.save();

    // Add read-only collaborator to shared note
    sharedNote.addCollaborator(reader._id, 'read', owner._id);
    await sharedNote.save();

    console.log('✅ Added collaborators to shared note:');
    console.log('   - Write Collaborator: write access');
    console.log('   - Read-only User: read access');

    // 4. Test Access Control
    console.log('\n4️⃣ Testing Access Control');

    // Owner access
    console.log('\n👑 Owner Access:');
    console.log('Personal Note:', personalNote.hasAccess(owner._id, 'write') ? '✅ Write' : '❌ No Access');
    console.log('Shared Note:', sharedNote.hasAccess(owner._id, 'write') ? '✅ Write' : '❌ No Access');
    console.log('Public Note:', publicNote.hasAccess(owner._id, 'write') ? '✅ Write' : '❌ No Access');

    // Write Collaborator access
    console.log('\n✏️ Write Collaborator Access:');
    console.log('Personal Note:', personalNote.hasAccess(collaborator._id, 'write') ? '✅ Write' : '❌ No Access');
    console.log('Shared Note:', sharedNote.hasAccess(collaborator._id, 'write') ? '✅ Write' : '❌ No Access');
    console.log('Public Note:', publicNote.hasAccess(collaborator._id, 'write') ? '✅ Write' : '❌ No Access');

    // Read-only User access
    console.log('\n👁️ Read-only User Access:');
    console.log('Personal Note:', personalNote.hasAccess(reader._id, 'read') ? '✅ Read' : '❌ No Access');
    console.log('Shared Note:', sharedNote.hasAccess(reader._id, 'read') ? '✅ Read' : '❌ No Access');
    console.log('Public Note:', publicNote.hasAccess(reader._id, 'read') ? '✅ Read' : '❌ No Access');

    // 5. Test Permission Levels
    console.log('\n5️⃣ Testing Permission Levels');

    console.log('\n📋 Permission Matrix:');
    console.log('Note: Personal | Owner:', personalNote.getUserPermission(owner._id));
    console.log('Note: Personal | Collaborator:', personalNote.getUserPermission(collaborator._id) || 'No Access');
    console.log('Note: Personal | Reader:', personalNote.getUserPermission(reader._id) || 'No Access');

    console.log('\nNote: Shared | Owner:', sharedNote.getUserPermission(owner._id));
    console.log('Note: Shared | Collaborator:', sharedNote.getUserPermission(collaborator._id));
    console.log('Note: Shared | Reader:', sharedNote.getUserPermission(reader._id));

    console.log('\nNote: Public | Owner:', publicNote.getUserPermission(owner._id));
    console.log('Note: Public | Collaborator:', publicNote.getUserPermission(collaborator._id));
    console.log('Note: Public | Reader:', publicNote.getUserPermission(reader._id));

    // 6. Update Note (Collaborator)
    console.log('\n6️⃣ Testing Note Updates');

    // Collaborator updates shared note
    if (sharedNote.hasAccess(collaborator._id, 'write')) {
      sharedNote.content += '\n\nUpdated by write collaborator!';
      sharedNote.lastEditedBy = collaborator._id;
      await sharedNote.save();
      console.log('✅ Write collaborator successfully updated shared note');
    }

    // Reader tries to update (should fail)
    if (!sharedNote.hasAccess(reader._id, 'write')) {
      console.log('❌ Read-only user correctly denied write access to shared note');
    }

    // 7. Query Notes for Each User
    console.log('\n7️⃣ Testing Note Queries');

    // Owner's notes
    const ownerNotes = await Note.find({
      $and: [
        { isDeleted: false },
        {
          $or: [
            { owner: owner._id },
            { 'collaborators.user': owner._id },
            { isPublic: true },
          ],
        },
      ],
    });
    console.log(`👑 Owner can see ${ownerNotes.length} notes`);

    // Collaborator's notes
    const collaboratorNotes = await Note.find({
      $and: [
        { isDeleted: false },
        {
          $or: [
            { owner: collaborator._id },
            { 'collaborators.user': collaborator._id },
            { isPublic: true },
          ],
        },
      ],
    });
    console.log(`✏️ Collaborator can see ${collaboratorNotes.length} notes`);

    // Reader's notes
    const readerNotes = await Note.find({
      $and: [
        { isDeleted: false },
        {
          $or: [
            { owner: reader._id },
            { 'collaborators.user': reader._id },
            { isPublic: true },
          ],
        },
      ],
    });
    console.log(`👁️ Reader can see ${readerNotes.length} notes`);

    // 8. Test Search and Filtering
    console.log('\n8️⃣ Testing Search and Filtering');

    // Search by content
    const searchResults = await Note.find({
      $and: [
        { isDeleted: false },
        { owner: owner._id },
        {
          $or: [
            { title: { $regex: 'shared', $options: 'i' } },
            { content: { $regex: 'shared', $options: 'i' } },
          ],
        },
      ],
    });
    console.log(`🔍 Search for "shared": found ${searchResults.length} notes`);

    // Filter by tags
    const tagResults = await Note.find({
      $and: [
        { isDeleted: false },
        { owner: owner._id },
        { tags: { $in: ['public'] } },
      ],
    });
    console.log(`🏷️ Filter by "public" tag: found ${tagResults.length} notes`);

    // 9. Test Soft Delete
    console.log('\n9️⃣ Testing Soft Delete');

    personalNote.isDeleted = true;
    personalNote.deletedAt = new Date();
    await personalNote.save();

    const activeNotes = await Note.find({ owner: owner._id, isDeleted: false });
    console.log(`🗑️ After soft delete: ${activeNotes.length} active notes remaining`);

    console.log('\n🎉 Notes CRUD Demo Complete!');
  } catch (error) {
    console.error('❌ Demo error:', error.message);
  } finally {
    // Clean up
    await User.deleteMany({ email: { $in: ['owner@demo.com', 'collaborator@demo.com', 'reader@demo.com'] } });
    await Note.deleteMany({ title: { $regex: /^Demo Note/ } });
    mongoose.connection.close();
  }
};

const runDemo = async () => {
  await connectDB();
  await demonstrateNotesCRUD();
};

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = { demonstrateNotesCRUD };
