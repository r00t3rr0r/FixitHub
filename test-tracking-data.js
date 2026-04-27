const mongoose = require('mongoose');
require('dotenv').config();

async function checkTrackingData() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    console.log('Connected successfully');

    const TrackingEvent = require('./server/models/TrackingEvent');
    
    console.log('Counting tracking events...');
    const count = await TrackingEvent.countDocuments().maxTimeMS(5000);
    console.log(`\nTotal tracking events: ${count}`);
    
    if (count > 0) {
      const recent = await TrackingEvent.find()
        .sort({ occurred_at: -1 })
        .limit(5)
        .maxTimeMS(5000)
        .lean();
      
      console.log('\nRecent tracking events:');
      recent.forEach((event, idx) => {
        console.log(`${idx + 1}. ${event.event_name} - ${event.page_path} - ${event.occurred_at}`);
      });
      
      const since5m = new Date(Date.now() - 5 * 60 * 1000);
      const recent5m = await TrackingEvent.countDocuments({ occurred_at: { $gte: since5m } }).maxTimeMS(5000);
      console.log(`\nEvents in last 5 minutes: ${recent5m}`);
      
      const since30m = new Date(Date.now() - 30 * 60 * 1000);
      const recent30m = await TrackingEvent.countDocuments({ occurred_at: { $gte: since30m } }).maxTimeMS(5000);
      console.log(`Events in last 30 minutes: ${recent30m}`);
    } else {
      console.log('\n⚠️  No tracking events found in database!');
      console.log('This is why the Live Tracking page shows no data.');
      console.log('\nTo generate test tracking data, you can:');
      console.log('1. Visit the website frontend pages (with tracking enabled)');
      console.log('2. Run: ./generate-test-tracking-data.sh (if available)');
      console.log('3. Check if tracking.js route is properly handling events');
    }
    
    await mongoose.disconnect();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.name === 'MongooseServerSelectionError') {
      console.error('\n⚠️  Could not connect to MongoDB. Is it running?');
      console.error('Try: brew services start mongodb-community');
    }
    process.exit(1);
  }
}

checkTrackingData();
