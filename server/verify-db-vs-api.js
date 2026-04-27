const mongoose = require('mongoose');

// MongoDB connection string
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/fixithub';

async function verifyData() {
  try {
    console.log('🔌 Connecting to MongoDB:', DATABASE_URL);
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected!\n');
    
    const TrackingEvent = mongoose.model('TrackingEvent', new mongoose.Schema({}, { strict: false }));
    
    // Get all events
    const allEvents = await TrackingEvent.find().sort({ occurred_at: -1 }).limit(10).lean();
    
    console.log('📊 DATABASE - Last 10 Events:');
    console.log('================================');
    allEvents.forEach((event, idx) => {
      console.log(`${idx + 1}. ${event.event_name} - ${event.page_path}`);
      console.log(`   Session: ${event.session_id}`);
      console.log(`   Time: ${event.occurred_at}`);
      console.log(`   Browser: ${event.browser} ${event.browser_version}`);
      console.log(`   Device: ${event.device_type}`);
      console.log('');
    });
    
    // Get counts
    const now = new Date();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);
    const thirtyMinAgo = new Date(now - 30 * 60 * 1000);
    
    const events5m = await TrackingEvent.countDocuments({ occurred_at: { $gte: fiveMinAgo } });
    const events30m = await TrackingEvent.countDocuments({ occurred_at: { $gte: thirtyMinAgo } });
    const totalEvents = await TrackingEvent.countDocuments();
    
    console.log('📈 STATISTICS:');
    console.log('================================');
    console.log(`Total Events: ${totalEvents}`);
    console.log(`Events (last 5m): ${events5m}`);
    console.log(`Events (last 30m): ${events30m}`);
    console.log('');
    
    // Get unique sessions
    const sessions = await TrackingEvent.aggregate([
      { $match: { occurred_at: { $gte: thirtyMinAgo } } },
      { 
        $group: { 
          _id: '$session_id',
          event_count: { $sum: 1 },
          last_event: { $max: '$occurred_at' },
          first_event: { $min: '$occurred_at' }
        } 
      }
    ]);
    
    console.log(`📋 ACTIVE SESSIONS (30m): ${sessions.length}`);
    console.log('================================');
    sessions.slice(0, 5).forEach((session, idx) => {
      console.log(`${idx + 1}. Session: ${session._id}`);
      console.log(`   Events: ${session.event_count}`);
      console.log(`   First: ${session.first_event}`);
      console.log(`   Last: ${session.last_event}`);
      console.log('');
    });
    
    await mongoose.connection.close();
    console.log('✅ Database verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyData();
