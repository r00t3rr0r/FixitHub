const mongoose = require('mongoose');
require('dotenv').config();

const TrackingEventSchema = new mongoose.Schema({}, { strict: false });
const TrackingEvent = mongoose.model('TrackingEvent', TrackingEventSchema);

async function testAPI() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Testing Admin Live Tracking API logic...\n');
    
    // Test getAdminSummary logic
    const minutes = 30;
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const since5m = new Date(Date.now() - 5 * 60 * 1000);
    
    console.log(`📅 Looking for events since: ${since.toISOString()}`);
    console.log(`📅 5-min window: ${since5m.toISOString()}\n`);
    
    const result = await TrackingEvent.aggregate([
      { $match: { occurred_at: { $gte: since } } },
      {
        $facet: {
          active_visitors_5m: [
            { $match: { occurred_at: { $gte: since5m } } },
            { $group: { _id: '$visitor_id' } },
            { $count: 'count' }
          ],
          active_visitors_30m: [
            { $group: { _id: '$visitor_id' } },
            { $count: 'count' }
          ],
          page_views_5m: [
            { $match: { occurred_at: { $gte: since5m }, event_name: 'page_view' } },
            { $count: 'count' }
          ],
        }
      }
    ]);
    
    const summary = result[0] || {};
    console.log('📊 Summary Result:');
    console.log('Active visitors (5m):', summary.active_visitors_5m?.[0]?.count || 0);
    console.log('Active visitors (30m):', summary.active_visitors_30m?.[0]?.count || 0);
    console.log('Page views (5m):', summary.page_views_5m?.[0]?.count || 0);
    
    console.log('\n📋 Active Sessions:');
    const sessions = await TrackingEvent.aggregate([
      { $match: { occurred_at: { $gte: since } } },
      { $sort: { occurred_at: 1 } },
      {
        $group: {
          _id: '$session_id',
          last_activity: { $max: '$occurred_at' },
          first_activity: { $min: '$occurred_at' },
          current_page: { $last: '$page_path' },
          event_count: { $sum: 1 },
        }
      },
      { $sort: { last_activity: -1 } },
      { $limit: 5 }
    ]);
    
    sessions.forEach((s, i) => {
      console.log(`${i+1}. Session ${s._id}: ${s.event_count} events, last: ${s.current_page}`);
    });
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAPI();
