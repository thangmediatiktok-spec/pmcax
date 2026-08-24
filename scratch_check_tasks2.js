const mongoose = require('mongoose');
const AdlTask = require('./src/models/AdlTask');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pmcax').then(async () => {
  const tasks = await AdlTask.find({});
  tasks.forEach(t => {
    if (t.type && t.type.includes('CT-A')) {
      console.log(`ID: ${t._id}, Type: '${t.type}', Length: ${t.type.length}`);
    }
  });
  process.exit(0);
}).catch(console.error);
