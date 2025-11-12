const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Service = require('./server/models/Service');

async function checkServices() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    const services = await Service.find({});
    console.log('Found ' + services.length + ' services:');
    services.forEach(s => {
      const types = s.deviceTypes ? s.deviceTypes.join(', ') : 'none';
      console.log('- ' + s.name + ' (category: ' + s.category + ', deviceTypes: ' + types + ')');
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkServices();
