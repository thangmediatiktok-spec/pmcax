const express = require('express');
const router = express.Router();
const AdlTask = require('../models/AdlTask');
const Team = require('../models/Team');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.use(isAuthenticated, isAdmin);

// GET /adl-tasks
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find({ trangThai: true }).sort('thuTu');
    let query = {};
    if (req.query.teamId) {
      query.team = req.query.teamId;
    } else if (teams.length > 0) {
      query.team = teams[0]._id;
      req.query.teamId = teams[0]._id.toString();
    }

    const villages = [
      'Plei Glung Mơ Lan', 'Plei Lok', 'Plei Mun Măk', 'Plei Tăng', 'Plei Ơi',
      'Thanh Thượng', 'Thôn Drok', 'Thôn Hải Yên', 'Thôn Plei Hek', 'Thôn Plei Pông',
      'Thôn Thanh Sơn', 'Thôn Tân Điệp', 'Thôn Đoàn Kết'
    ];

    const tasks = await AdlTask.find(query).populate('team').sort('-createdAt');

    // Grouping tasks by replacing village names with [THON] and time with [GIO]
    const sortedVillages = [...villages].sort((a,b) => b.length - a.length);
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const villageRegex = new RegExp(`(${sortedVillages.map(escapeRegExp).join('|')})`, 'g');

    const defaultTimes = ["Từ 7h00' đến 11h30'", "Từ 13h30' đến 17h30'", "Từ 07h00' đến 11h30'"];
    const sortedTimes = [...defaultTimes].sort((a,b) => b.length - a.length);
    const timeRegex = new RegExp(`(${sortedTimes.map(escapeRegExp).join('|')})`, 'gi');

    const groupsMap = {};
    tasks.forEach(task => {
      let basePlan = task.plan.replace(villageRegex, '[THON]').replace(timeRegex, '[GIO]');
      let baseResult = task.result.replace(villageRegex, '[THON]').replace(timeRegex, '[GIO]');
      const taskType = task.type || 'A';
      const key = taskType + '|||' + basePlan + '|||' + baseResult;
      
      if (!groupsMap[key]) {
        groupsMap[key] = {
          type: taskType,
          basePlan,
          baseResult,
          tasks: []
        };
      }
      groupsMap[key].tasks.push(task);
    });

    const taskGroups = Object.values(groupsMap);

    res.render('adl-tasks/index', {
      title: 'Quản lý Công việc Ăn định lượng (ADL)',
      activeMenu: 'adl-tasks',
      teams,
      villages,
      taskGroups,
      currentTeamId: req.query.teamId
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi tải trang');
    res.redirect('back');
  }
});

// POST /adl-tasks
router.post('/', async (req, res) => {
  try {
    const { team, plan, result, type, bulk_generate, villages, times } = req.body;
    const taskType = type || 'A';
    
    if (bulk_generate === 'on') {
      let selectedVillages = [];
      if (villages) selectedVillages = Array.isArray(villages) ? villages : [villages];
      
      let selectedTimes = [];
      if (times) selectedTimes = Array.isArray(times) ? times : [times];

      // To allow looping even if one array is empty (e.g. they only use [THON] or only [GIO])
      if (selectedVillages.length === 0) selectedVillages = [''];
      if (selectedTimes.length === 0) selectedTimes = [''];

      const tasksToCreate = [];
      selectedVillages.forEach(v => {
        selectedTimes.forEach(t => {
          let p = plan;
          let r = result;
          if (v) {
            p = p.replace(/\[THON\]/g, v);
            r = r.replace(/\[THON\]/g, v);
          }
          if (t) {
            p = p.replace(/\[GIO\]/g, t);
            r = r.replace(/\[GIO\]/g, t);
          }
          tasksToCreate.push({ team, plan: p, result: r, type: taskType });
        });
      });
      
      if (tasksToCreate.length > 0 && (tasksToCreate.length > 1 || tasksToCreate[0].plan !== plan)) {
        await AdlTask.insertMany(tasksToCreate);
        req.flash('success', `Đã sinh tự động ${tasksToCreate.length} công việc mới.`);
      } else {
        await AdlTask.create({ team, plan, result, type: taskType });
        req.flash('success', 'Đã thêm công việc mới.');
      }
    } else {
      // Single create
      await AdlTask.create({ team, plan, result, type: taskType });
      req.flash('success', 'Đã thêm công việc mới.');
    }
    
    res.redirect(`/adl-tasks?teamId=${team}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi khi thêm công việc.');
    res.redirect('back');
  }
});

// PUT /adl-tasks/:id
router.put('/:id', async (req, res) => {
  try {
    const { plan, result, type } = req.body;
    const task = await AdlTask.findByIdAndUpdate(req.params.id, { plan, result, type }, { new: true });
    req.flash('success', 'Đã cập nhật công việc.');
    res.redirect(`/adl-tasks?teamId=${task.team}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi khi cập nhật.');
    res.redirect('back');
  }
});

// DELETE /adl-tasks/bulk
router.delete('/bulk', async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (taskIds && taskIds.length > 0) {
      await AdlTask.deleteMany({ _id: { $in: taskIds } });
      req.flash('success', `Đã xóa ${taskIds.length} công việc.`);
    }
    res.redirect('back');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi khi xóa hàng loạt.');
    res.redirect('back');
  }
});

// DELETE /adl-tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await AdlTask.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa công việc.');
    res.redirect(`/adl-tasks?teamId=${task.team}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi khi xóa.');
    res.redirect('back');
  }
});

module.exports = router;
