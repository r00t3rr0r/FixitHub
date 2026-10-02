// K03-Vorbereitung (nur e2e_after): 55 zusaetzliche Auftraege des Partnerkunden mit je einer Kundennachricht,
// damit die zentrale Liste ueber die 25er-Seite und die 50er-Grenze hinausgeht. Aelteste zuerst angelegt.
const path = require('path'); const fs = require('fs');
const SERVER = '/home/adar/Projects/FixitHub/server';
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27099/e2e_after');
  const db = mongoose.connection.db;
  const partner = await db.collection('users').findOne({ email: 'partner@e2e.invalid' });
  const already = await db.collection('orders').countDocuments({ orderNumber: /^ORD-K03-/ });
  if (already) { console.log('bereits vorhanden', already); await mongoose.disconnect(); return; }
  const base = Date.now() - 60 * 24 * 3600 * 1000;
  for (let i = 1; i <= 55; i += 1) {
    const at = new Date(base + i * 3600 * 1000);
    const o = await db.collection('orders').insertOne({ orderNumber: `ORD-K03-${String(i).padStart(3, '0')}`, customerId: partner._id, deviceBrand: 'Apple', deviceModel: 'iPhone 13', deviceType: 'Smartphone', errorDescription: 'K03', totalCost: 10, discount: 0, status: 'pending', progress: 0, timeline: [], createdAt: at, updatedAt: at, services: [] });
    await db.collection('inspectioncommunications').insertOne({ orderId: o.insertedId, status: 'active', createdAt: at, lastMessageAt: at, pendingFeedbackCount: 0, pendingActionsCount: 0, messages: [{ _id: new mongoose.Types.ObjectId(), senderId: partner._id, senderType: 'customer', senderName: 'Paula Partner', senderRole: 'customer', messageType: 'text', content: `K03-Nachricht Nr. ${i}`, readBy: [], attachments: [], createdAt: at }] });
  }
  console.log('55 Threads angelegt');
  await mongoose.disconnect();
})();
