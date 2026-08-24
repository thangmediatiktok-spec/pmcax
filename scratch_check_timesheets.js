const mongoose = require('mongoose');
const Timesheet = require('./src/models/Timesheet');
const Officer = require('./src/models/Officer');
const AdlTask = require('./src/models/AdlTask');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pmcax').then(async () => {
  const timesheets = await Timesheet.find({}).populate('officer');
  if (timesheets.length === 0) return console.log('No timesheets');
  
  const ts = timesheets[timesheets.length - 1]; // latest
  console.log(`Officer: ${ts.officer.hoTen}, Team: ${ts.officer.toCongTac}`);
  
  const allTasks = await AdlTask.find({ team: ts.officer.toCongTac });
  console.log(`allTasks length: ${allTasks.length}`);
  const teamTasks = allTasks.filter(t => !t.type || t.type === 'A');
  const ctTasks = allTasks.filter(t => t.type === 'CT-A');
  
  console.log(`teamTasks: ${teamTasks.length}, ctTasks: ${ctTasks.length}`);
  
  process.exit(0);
}).catch(console.error);
