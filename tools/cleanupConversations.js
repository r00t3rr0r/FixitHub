// tools/cleanupConversations.js
// Script: Löscht ALLE Conversation-Dokumente aus der Datenbank (hart!)
// Nutzung: node tools/cleanupConversations.js

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Conversation = require('../server/models/Conversation');

async function cleanup() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost/fixithub');
    const countBefore = await Conversation.countDocuments();
    console.log('Conversations vor Löschung:', countBefore);
    const result = await Conversation.deleteMany({});
    const countAfter = await Conversation.countDocuments();
    console.log('Gelöscht:', result.deletedCount);
    console.log('Conversations nach Löschung:', countAfter);
    process.exit(0);
  } catch (err) {
    console.error('Fehler beim Löschen:', err);
    process.exit(1);
  }
}

cleanup();
