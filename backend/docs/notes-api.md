# Notes CRUD API Documentation

## Overview

The Notes CRUD module provides complete functionality for creating, reading, updating, and deleting notes with advanced collaboration features and role-based access control.

## Features

- ✅ **Full CRUD Operations** - Create, Read, Update, Delete notes
- ✅ **Role-based Access Control** - Owner, Write Collaborator, Read-only access
- ✅ **Real-time Collaboration** - Multiple users can edit notes simultaneously
- ✅ **Advanced Search** - Search by title, content, and tags
- ✅ **Pagination** - Efficient handling of large note collections
- ✅ **Soft Delete** - Notes are marked as deleted, not permanently removed
- ✅ **Version Tracking** - Track note versions and last edited information

## Data Model

### Note Schema

```javascript
{
  title: String,           // Required, max 200 characters
  content: String,         // Optional, unlimited length
  tags: [String],          // Array of tags, max 30 chars each
  owner: ObjectId,         // Reference to User (required)
  collaborators: [{
    user: ObjectId,        // Reference to User
    permission: String,    // "read" | "write"
    addedAt: Date,         // When collaborator was added
    addedBy: ObjectId      // Who added the collaborator
  }],
  isPublic: Boolean,       // Public notes are readable by everyone
  version: Number,         // Auto-incremented on content changes
  lastEditedBy: ObjectId,  // Reference to User who last edited
  lastEditedAt: Date,      // When note was last edited
  isDeleted: Boolean,      // Soft delete flag
  deletedAt: Date,         // When note was deleted
  createdAt: Date,         // Auto-generated
  updatedAt: Date          // Auto-generated
}
```

## API Endpoints

### 1. Create Note

**POST** `/api/notes`

Creates a new note owned by the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "My New Note",
  "content": "This is the note content...",
  "tags": ["work", "important"],
  "isPublic": false
}
```

**Response (201):**
```json
{
  "message": "Note created successfully",
  "note": {
    "_id": "note_id",
    "title": "My New Note",
    "content": "This is the note content...",
    "tags": ["work", "important"],
    "owner": {
      "_id": "user_id",
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe"
    },
    "collaborators": [],
    "isPublic": false,
    "version": 1,
    "lastEditedBy": "user_id",
    "lastEditedAt": "2023-12-01T10:00:00.000Z",
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### 2. Get All Notes

**GET** `/api/notes`

Retrieves all notes accessible to the authenticated user (owned, collaborated, or public).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of notes per page (default: 10, max: 100)
- `search` (optional): Search term for title and content
- `tags` (optional): Comma-separated list of tags to filter by

**Examples:**
```
GET /api/notes?page=1&limit=20
GET /api/notes?search=meeting
GET /api/notes?tags=work,important
GET /api/notes?search=project&tags=work&page=2
```

**Response (200):**
```json
{
  "notes": [
    {
      "_id": "note_id",
      "title": "My Note",
      "content": "Note content...",
      "tags": ["work"],
      "owner": { ... },
      "collaborators": [ ... ],
      "userPermission": "owner",
      "version": 3,
      "lastEditedBy": { ... },
      "lastEditedAt": "2023-12-01T10:00:00.000Z",
      "createdAt": "2023-12-01T09:00:00.000Z",
      "updatedAt": "2023-12-01T10:00:00.000Z"
    }
  ],
  "totalPages": 5,
  "currentPage": 1,
  "total": 47
}
```

### 3. Get Single Note

**GET** `/api/notes/:id`

Retrieves a specific note by ID if the user has access.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "note": {
    "_id": "note_id",
    "title": "My Note",
    "content": "Full note content...",
    "tags": ["work", "important"],
    "owner": {
      "_id": "owner_id",
      "username": "owner",
      "firstName": "Note",
      "lastName": "Owner"
    },
    "collaborators": [
      {
        "user": {
          "_id": "collaborator_id",
          "username": "collaborator",
          "firstName": "John",
          "lastName": "Collaborator"
        },
        "permission": "write",
        "addedAt": "2023-12-01T09:30:00.000Z",
        "addedBy": "owner_id"
      }
    ],
    "userPermission": "write",
    "isPublic": false,
    "version": 3,
    "lastEditedBy": {
      "_id": "editor_id",
      "username": "editor",
      "firstName": "Last",
      "lastName": "Editor"
    },
    "lastEditedAt": "2023-12-01T10:00:00.000Z",
    "createdAt": "2023-12-01T09:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### 4. Update Note

**PUT** `/api/notes/:id`

Updates a note. Requires write access (owner or write collaborator).

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "tags": ["updated", "work"],
  "isPublic": true
}
```

**Response (200):**
```json
{
  "message": "Note updated successfully",
  "note": {
    // Updated note object with incremented version
    "version": 4,
    "lastEditedBy": "current_user_id",
    "lastEditedAt": "2023-12-01T11:00:00.000Z",
    // ... other fields
  }
}
```

### 5. Delete Note

**DELETE** `/api/notes/:id`

Soft deletes a note. Only the owner can delete notes.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "message": "Note deleted successfully"
}
```

## Permission Levels

### Owner
- **Full Access**: Can read, write, delete, and manage collaborators
- **Permissions**: `owner`

### Write Collaborator
- **Read/Write Access**: Can read and edit note content
- **Cannot**: Delete note or manage other collaborators
- **Permissions**: `write`

### Read Collaborator
- **Read-only Access**: Can only view note content
- **Cannot**: Edit, delete, or manage collaborators
- **Permissions**: `read`

### Public Access
- **Read-only Access**: Anyone can read public notes
- **Cannot**: Edit or delete
- **Permissions**: `read`

## Error Responses

### 400 Bad Request
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title is required and cannot exceed 200 characters"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "Access denied. No token provided.",
  "code": "NO_TOKEN"
}
```

### 403 Forbidden
```json
{
  "message": "Write access denied"
}
```

### 404 Not Found
```json
{
  "message": "Note not found"
}
```

## Usage Examples

### Create and Share a Note

```javascript
// 1. Create note
const createResponse = await fetch('/api/notes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Team Meeting Notes',
    content: 'Agenda: Project updates, Q4 planning',
    tags: ['meeting', 'team']
  })
});

const { note } = await createResponse.json();

// 2. Share with collaborator (using sharing API)
await fetch(`/api/notes/${note._id}/share`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userEmail: 'collaborator@example.com',
    permission: 'write'
  })
});
```

### Search and Filter Notes

```javascript
// Search for notes containing "project"
const searchResponse = await fetch('/api/notes?search=project', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Filter by tags
const tagResponse = await fetch('/api/notes?tags=work,important', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Combined search with pagination
const combinedResponse = await fetch('/api/notes?search=meeting&tags=team&page=1&limit=10', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Testing

Run the comprehensive test suite:
```bash
npm test -- tests/notes.test.js
```

Run the interactive demo:
```bash
npm run demo:notes
```
