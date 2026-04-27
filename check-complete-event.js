const mongoose = require('mongoose');
require('dotenv').config();

async function checkCompleteEvent() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    
    const TrackingEvent = mongoose.model('TrackingEvent', new mongoose.Schema({}, { strict: false }));
    
    const event = await TrackingEvent.findOne({ session_id: 'complete-test-session' }).lean();
    
    if (!event) {
      console.log('❌ Complete test event not found!');
      await mongoose.connection.close();
      return;
    }
    
    console.log('✅ Found complete test event!\n');
    console.log('Event fields:');
    console.log(JSON.stringify(event, null, 2));
    
    const requiredFields = [
      'event_name', 'page_url', 'page_path', 'page_title',
      'referrer', 'source', 'medium', 'campaign',
      'session_id', 'visitor_id',
      'browser', 'browser_version', 'os', 'device_type',
      'language', 'screen_width', 'screen_height',
      'viewport_width', 'viewport_height', 'timezone',
      'country', 'city', 'custom_data'
    ];
    
    console.log('\n✅ Field check:');
    requiredFields.forEach(field => {
      const present = event.hasOwnProperty(field) && event[field] !== null && event[field] !== undefined;
      console.log(`  ${field}: ${present ? '✓' : '✗'}`);
    });
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCompleteEvent();
