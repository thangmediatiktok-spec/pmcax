const mongoose = require('mongoose');
const AdlTask = require('./src/models/AdlTask');
const Officer = require('./src/models/Officer');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pmcax').then(async () => {
  const tasks = await AdlTask.find({ type: 'CT-A' });
  console.log('CT-A Tasks Teams:');
  tasks.forEach(t => {
    console.log(`ID: ${t._id}, Team: ${t.team}`);
  });
  
  const officers = await Officer.find({});
  console.log('\nOfficers:');
  officers.forEach(o => {
    console.log(`Officer: ${o.hoTen}, Team: ${o.toCongTac}`);
  });
  process.exit(0);
}).catch(console.error);
