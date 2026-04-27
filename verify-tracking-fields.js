const mongoose = require('mongoose');
require('dotenv').config();

const requiredFields = [
  'event_name',
  'occurred_at',
  'page_url',
  'page_path',
  'page_title',
  'referrer',
  'source',
  'medium',
  'campaign',
  'session_id',
  'visitor_id',
  'browser',
  'browser_version',
  'os',
  'device_type',
  'language',
  'screen_width',
  'screen_height',
  'viewport_width',
  'viewport_height',
  'timezone',
  'ip_hash',
  'country',
  'city',
  'custom_data'
];

async function verifyFields() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');
    
    const TrackingEvent = mongoose.model('TrackingEvent', new mongoose.Schema({}, { strict: false }));
    
    // Get one sample event
    const sample = await TrackingEvent.findOne().lean();
    
    if (!sample) {
      console.log('⚠️  No tracking events found. Send a test event first!');
      console.log('\nRun: ./generate-test-tracking-data.sh');
      await mongoose.connection.close();
      return;
    }
    
    console.log('📋 Checking required fields in sample event:\n');
    
    const presentFields = [];
    const missingFields = [];
    
    requiredFields.forEach(field => {
      if (sample.hasOwnProperty(field)) {
        const value = sample[field];
        const valueType = value === null ? 'null' : typeof value;
        const valuePreview = value === null ? 'null' : 
                            valueType === 'object' ? JSON.stringify(value).substring(0, 50) :
                            String(value).substring(0, 50);
        console.log(`✅ ${field.padEnd(20)} ${valueType.padEnd(10)} ${valuePreview}`);
        presentFields.push(field);
      } else {
        console.log(`❌ ${field.padEnd(20)} MISSING`);
        missingFields.push(field);
      }
    });
    
    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`   Total required fields: ${requiredFields.length}`);
    console.log(`   Present: ${presentFields.length}`);
    console.log(`   Missing: ${missingFields.length}`);
    
    if (missingFields.length > 0) {
      console.log(`\n⚠️  Missing fields: ${missingFields.join(', ')}`);
      console.log('\n💡 These fields may be optional or need to be added to the tracking payload.');
    } else {
      console.log('\n✅ All required fields are present!');
    }
    
    // Check model schema
    console.log('\n📐 Checking TrackingEvent model schema...');
    const TrackingEventModel = require('./server/models/TrackingEvent');
    const schema = TrackingEventModel.schema.obj;
    
    console.log('\nModel fields:');
    Object.keys(schema).forEach(key => {
      const fieldDef = schema[key];
      const isRequired = fieldDef.required === true;
      const typeStr = fieldDef.type ? fieldDef.type.name : 'Mixed';
      console.log(`  ${key.padEnd(20)} ${typeStr.padEnd(10)} ${isRequired ? '(required)' : ''}`);
    });
    
    await mongoose.connection.close();
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyFields();
