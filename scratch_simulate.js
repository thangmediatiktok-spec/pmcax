const mongoose = require('mongoose');
const Timesheet = require('./src/models/Timesheet');
const Officer = require('./src/models/Officer');
const AdlTask = require('./src/models/AdlTask');
require('dotenv').config();

function seededRand(seed) {
    let x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
}

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pmcax').then(async () => {
  const timesheets = await Timesheet.find({}).populate('officer');

  for (let ts of timesheets) {
    const officer = ts.officer;
    const adlRecords = ts.records.filter(r => r.code === 'A' || r.code === 'CT-A');
    if (adlRecords.some(r => r.code === 'CT-A')) {
      console.log(`\nOfficer: ${officer.hoTen}, Month: ${ts.month}`);
      const allTasks = await AdlTask.find({ team: officer.toCongTac });
      const ctTasks = allTasks.filter(t => t.type === 'CT-A');
      console.log(`ctTasks length: ${ctTasks.length}`);
      
      adlRecords.filter(r => r.code === 'CT-A').forEach(r => {
        const isManual = r.adlPlan || r.adlResult;
        console.log(`Day: ${r.day}, isManual: ${!!isManual}, savedResult: ${r.adlResult}`);
        if (!isManual) {
            let res = '';
            if (ctTasks.length > 0) {
              const idx = Math.floor(seededRand(r.day) * ctTasks.length);
              const randSo = Math.floor(seededRand(r.day + 999) * 61) + 20;
              const randDt = Math.floor(seededRand(r.day + 888) * 5) + 1;
              res = ctTasks[idx].result.replace(/\[SO\]/g, randSo).replace(/\[DT\]/g, randDt).replace(/\[XACT\]/g, r.note || 'địa bàn');
            } else {
              res = `Từ 07h30 đến 17h30 công tác tại ${r.note || 'địa bàn'} để xác minh đối tượng`;
            }
            console.log(`   -> Generated Result: ${res}`);
        }
      });
    }
  }
  
  process.exit(0);
}).catch(console.error);
