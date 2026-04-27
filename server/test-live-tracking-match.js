require('dotenv').config();
const mongoose = require('mongoose');

async function verifyMatch() {
  try {
    console.log('🔌 Connecting to MongoDB:', process.env.DATABASE_URL);
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected!\n');
    
    const TrackingEvent = mongoose.model('TrackingEvent', new mongoose.Schema({}, { strict: false, collection: 'trackingevents' }));
    
    const now = new Date();
    const thirtyMinAgo = new Date(now - 30 * 60 * 1000);
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);
    
    console.log('📊 DATABASE VERIFICATION:');
    console.log('================================\n');
    
    // Total events
    const totalEvents = await TrackingEvent.countDocuments();
    console.log('✅ Total Events:', totalEvents);
    
    // Events in last 30 minutes
    const events30m = await TrackingEvent.countDocuments({ occurred_at: { $gte: thirtyMinAgo } });
    console.log('✅ Events (last 30m):', events30m);
    
    // Events in last 5 minutes  
    const events5m = await TrackingEvent.countDocuments({ occurred_at: { $gte: fiveMinAgo } });
    console.log('✅ Events (last 5m):', events5m);
    
    // Unique sessions in last 30 minutes
    const sessions = await TrackingEvent.aggregate([
      { $match: { occurred_at: { $gte: thirtyMinAgo } } },
      { $group: { 
          _id: '$session_id',
          event_count: { $sum: 1 },
          last_activity: { $max: '$occurred_at' },
          first_activity: { $min: '$occurred_at' }
        } 
      }
    ]);
    console.log('✅ Active Sessions (30m):', sessions.length);
    
    // Page views in last 5 minutes
    const pageViews5m = await TrackingEvent.countDocuments({ 
      occurred_at: { $gte: fiveMinAgo },
      event_name: 'page_view'
    });
    console.log('✅ Page Views (5m):', pageViews5m);
    
    console.log('\n📋 RECENT EVENTS (last 10):');
    console.log('================================\n');
    
    const recentEvents = await TrackingEvent.find()
      .sort({ occurred_at: -1 })
      .limit(10)
      .lean();
    
    recentEvents.forEach((event, idx) => {
      const timeAgo = Math.floor((now - new Date(event.occurred_at)) / 1000 / 60);
      console.log(`${idx + 1}. ${event.event_name} - ${event.page_path}`);
      console.log(`   Time: ${timeAgo} minutes ago`);
      console.log(`   Session: ${event.session_id}`);
      console.log(`   Browser: ${event.browser} ${event.browser_version}`);
      console.log('');
    });
    
    console.log('📈 EXPECTED API RESULTS:');
    console.log('================================');
    console.log('getAdminSummary(30) should return:');
    console.log(`  - active_visitors_30m: ${sessions.length}`);
    console.log(`  - page_views_5m: ${pageViews5m}`);
    console.log('');
    console.log('getActiveSessions(30) should return:');
    console.log(`  - ${sessions.length} sessions`);
    console.log('');
    console.log('getRecentEvents(10, 30) should return:');
    console.log(`  - Up to 10 events from last 30 minutes`);
    console.log(`  - Actually available: ${Math.min(events30m, 10)} events`);
    
    await mongoose.connection.close();
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyMatch();
