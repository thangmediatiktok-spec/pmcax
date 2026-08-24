const express = require('express');
const router = express.Router();
const WorkTask = require('../models/WorkTask');
const Officer = require('../models/Officer');
const Team = require('../models/Team');
const { isAuthenticated } = require('../middleware/auth');
const { runTelegramCheck } = require('../services/cronJobs');
const { sendToGroup } = require('../services/telegramBot');
const moment = require('moment');

// Lấy danh sách công việc
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    let query = {};
    if (user.role === 'cbcs' && user.officerProfile) {
      query = {
        $or: [
          { assignee: user.officerProfile },
          { createdBy: user._id }
        ]
      };
    }
    
    const tasks = await WorkTask.find(query).populate('assignee').sort({ createdAt: -1 });
    const officers = await Officer.find().sort({ hoTen: 1 });
    const teams = await Team.find({ trangThai: true }).sort({ thuTu: 1 });

    // Tính toán thống kê cho tháng hiện tại
    const currentMonth = moment().month();
    const currentYear = moment().year();

    const tasksThisMonth = tasks.filter(t => {
      const created = moment(t.createdAt);
      const due = t.dueDate ? moment(t.dueDate) : null;
      const completed = t.completedAt ? moment(t.completedAt) : null;
      
      return (created.month() === currentMonth && created.year() === currentYear) ||
             (due && due.month() === currentMonth && due.year() === currentYear) ||
             (completed && completed.month() === currentMonth && completed.year() === currentYear);
    });

    // Tính toán cảnh báo gấp/trễ
    let overdueCount = 0;
    let urgentCount = 0;
    const today = moment().startOf('day');

    tasks.forEach(t => {
      if (t.status === 'pending' && t.dueDate) {
        const diffDays = moment(t.dueDate).startOf('day').diff(today, 'days');
        if (diffDays < 0) overdueCount++;
        else if (diffDays <= 2) urgentCount++;
      }
    });

    const onceTasks = tasksThisMonth.filter(t => t.frequency === 'once');
    const recurringTasks = tasksThisMonth.filter(t => t.frequency !== 'once');

    const calcStats = (arr) => {
      const total = arr.length;
      const completed = arr.filter(t => t.status === 'completed').length;
      return {
        total,
        completed,
        pending: total - completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    };

    res.render('work-tasks/index', {
      title: 'Quản lý công việc',
      tasks,
      statsOnce: calcStats(onceTasks),
      statsRecurring: calcStats(recurringTasks),
      overdueCount,
      urgentCount,
      currentMonthName: moment().format('MM/YYYY'),
      officers,
      teams,
      activeMenu: 'work-tasks'
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi tải danh sách công việc');
    res.redirect('/dashboard');
  }
});

// Route test gửi Telegram thủ công (Dành cho Quản lý test thử)
router.get('/test-telegram', isAuthenticated, async (req, res) => {
  try {
    const result = await runTelegramCheck();
    if (result.success) {
      req.flash('success', result.message);
    } else {
      req.flash('error', result.message || 'Có lỗi xảy ra khi test Telegram');
    }
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi thực thi test Telegram.');
  }
  res.redirect('/work-tasks');
});

// Thêm công việc mới
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { title, description, frequency, dueDate, assignType, assignees, assignTeam } = req.body;
    let finalAssignees = [];

    if (req.session.user.role === 'cbcs') {
      finalAssignees = [req.session.user.officerProfile];
    } else {
      if (assignType === 'team' && assignTeam) {
        // Lấy tất cả cán bộ trong tổ
        const teamOfficers = await Officer.find({ toCongTac: assignTeam });
        finalAssignees = teamOfficers.map(o => o._id);
      } else if (assignType === 'individual' && assignees) {
        // assignees có thể là mảng (nếu chọn nhiều) hoặc chuỗi (nếu chọn 1)
        if (Array.isArray(assignees)) {
          finalAssignees = assignees;
        } else {
          finalAssignees = [assignees];
        }
      }
    }

    if (finalAssignees.length === 0) {
      // Nếu không có ai được giao, vẫn tạo 1 công việc không có assignee (nếu muốn) 
      // hoặc mặc định báo lỗi. Ở đây ta vẫn cho phép tạo 1 việc trống nếu muốn.
      finalAssignees = [null];
    }

    const tasksToCreate = finalAssignees.map(oId => ({
      title,
      description,
      frequency: frequency || 'once',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignee: oId,
      createdBy: req.session.user._id
    }));

    await WorkTask.insertMany(tasksToCreate);

    // Gửi thông báo Telegram
    if (finalAssignees.length > 0 && finalAssignees[0] !== null) {
      const assignedOfficers = await Officer.find({ _id: { $in: finalAssignees } });
      const officerNames = assignedOfficers.map(o => `${o.capBac || ''} ${o.hoTen}`).join(', ');
      
      let message = `📢 <b>CÔNG VIỆC MỚI ĐƯỢC GIAO</b>\n\n`;
      message += `📌 Tên việc: <b>${title}</b>\n`;
      message += `👥 Người thực hiện: ${officerNames}\n`;
      if (dueDate) {
        message += `⏰ Hạn chót: ${moment(dueDate).format('DD/MM/YYYY')}\n`;
      } else {
        message += `⏰ Hạn chót: Không có hạn\n`;
      }
      if (description) {
        message += `📝 Chi tiết: ${description}\n`;
      }
      message += `\n👉 <a href="${process.env.APP_URL}/work-tasks">Xem chi tiết trên hệ thống</a>`;
      
      await sendToGroup(message);
    }

    req.flash('success', 'Thêm công việc thành công');
    res.redirect('/work-tasks');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi thêm công việc');
    res.redirect('/work-tasks');
  }
});

// Cập nhật công việc (sửa thông tin)
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const task = await WorkTask.findById(req.params.id);
    if (!task) return res.redirect('/work-tasks');

    if (req.session.user.role === 'cbcs' && task.createdBy.toString() !== req.session.user._id.toString()) {
      req.flash('error', 'Bạn chỉ được sửa công việc do mình tự tạo!');
      return res.redirect('/work-tasks');
    }

    const { title, description, frequency, dueDate, assignee } = req.body;
    let finalAssignee = assignee || null;
    if (req.session.user.role === 'cbcs') {
      finalAssignee = req.session.user.officerProfile;
    }

    await WorkTask.findByIdAndUpdate(req.params.id, {
      title,
      description,
      frequency,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignee: finalAssignee
    });
    req.flash('success', 'Cập nhật công việc thành công');
    res.redirect('/work-tasks');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi cập nhật công việc');
    res.redirect('/work-tasks');
  }
});

// Chuyển đổi trạng thái (Hoàn thành / Chưa hoàn thành)
router.put('/:id/toggle', isAuthenticated, async (req, res) => {
  try {
    const task = await WorkTask.findById(req.params.id);
    if (!task) {
      req.flash('error', 'Không tìm thấy công việc');
      return res.redirect('/work-tasks');
    }

    const { result } = req.body;

    if (task.status === 'pending') {
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result || '';
      await task.save();

      // Nếu là công việc định kỳ, tự động sinh ra công việc cho chu kỳ tiếp theo
      if (task.frequency !== 'once') {
        let nextDueDate = task.dueDate ? moment(task.dueDate) : moment();
        let suffix = '';
        
        switch(task.frequency) {
          case 'weekly': 
            nextDueDate.add(1, 'weeks'); 
            suffix = `(Tuần ${nextDueDate.week()})`;
            break;
          case 'monthly': 
            nextDueDate.add(1, 'months'); 
            suffix = `(Tháng ${nextDueDate.format('M/YYYY')})`;
            break;
          case 'quarterly': 
            nextDueDate.add(3, 'months'); 
            suffix = `(Quý ${nextDueDate.quarter()}/${nextDueDate.year()})`;
            break;
          case 'yearly': 
            nextDueDate.add(1, 'years'); 
            suffix = `(Năm ${nextDueDate.year()})`;
            break;
        }

        // Xóa hậu tố cũ nếu có (ví dụ "(Tuần 37)")
        const baseTitle = task.title.replace(/\s*\([^)]*\)$/, '').trim();
        const newTitle = `${baseTitle} ${suffix}`;

        await WorkTask.create({
          title: newTitle,
          description: task.description,
          frequency: task.frequency,
          dueDate: nextDueDate.toDate(),
          status: 'pending',
          assignee: task.assignee,
          createdBy: task.createdBy
        });
      }
      req.flash('success', 'Đã đánh dấu hoàn thành công việc');
    } else {
      task.status = 'pending';
      task.completedAt = null;
      task.result = null;
      await task.save();
      req.flash('success', 'Đã đánh dấu chưa hoàn thành');
    }

    res.redirect('/work-tasks');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi cập nhật trạng thái');
    res.redirect('/work-tasks');
  }
});

// Xóa công việc
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const task = await WorkTask.findById(req.params.id);
    if (!task) return res.redirect('/work-tasks');

    if (req.session.user.role === 'cbcs' && task.createdBy.toString() !== req.session.user._id.toString()) {
      req.flash('error', 'Bạn chỉ được xóa công việc do mình tự tạo!');
      return res.redirect('/work-tasks');
    }

    await WorkTask.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa công việc thành công');
    res.redirect('/work-tasks');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi xóa công việc');
    res.redirect('/work-tasks');
  }
});

module.exports = router;
