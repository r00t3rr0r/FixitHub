const mongoose = require('mongoose');
require('dotenv').config();

const TrackingEventSchema = new mongoose.Schema({
  event_name: String,
  occurred_at: Date,
  page_url: String,
  page_path: String,
  session_id: String,
  visitor_id: String,
}, { strict: false });

const TrackingEvent = mongoose.model('TrackingEvent', TrackingEventSchema);

async function checkTracking() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');
    
    const count = await TrackingEvent.countDocuments();
    console.log(`📊 Total tracking events: ${count}`);
    
    if (count > 0) {
      const recent = await TrackingEvent.find().sort({ occurred_at: -1 }).limit(5);
      console.log('\n📝 Recent events:');
      recent.forEach((e, i) => {
        console.log(`${i+1}. ${e.event_name} - ${e.page_path} - ${e.occurred_at}`);
      });
      
      const sessions = await TrackingEvent.distinct('session_id');
      console.log(`\n👥 Unique sessions: ${sessions.length}`);
      
      const visitors = await TrackingEvent.distinct('visitor_id');
      console.log(`👤 Unique visitors: ${visitors.length}`);
    } else {
      console.log('\n⚠️  No tracking events found in database!');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTracking();
