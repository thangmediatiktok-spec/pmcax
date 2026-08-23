const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAuthenticated } = require('../middleware/auth');
const Officer = require('../models/Officer');
const Roster = require('../models/Roster');

// RBAC Middleware for managing rosters
const isRosterManager = (req, res, next) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');
  if (['admin', 'truong_cax', 'pho_cax'].includes(user.role) || user.canManageRoster) {
    return next();
  }
  req.flash('error', 'Bạn không có quyền quản lý lịch trực');
  return res.redirect('/rosters');
};

// GET /rosters - List all rosters
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const rosters = await Roster.find().sort({ weekStart: -1 }).populate('createdBy', 'hoTen');
    
    const user = req.session.user;
    const canManage = ['admin', 'truong_cax', 'pho_cax'].includes(user.role) || user.canManageRoster;
    
    res.render('rosters/index', { title: 'Quản lý lịch trực', rosters, canManage });
  } catch (err) {
    req.flash('error', 'Lỗi tải danh sách lịch trực');
    res.redirect('/dashboard');
  }
});

// Helper to get next Monday
function getNextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7)); // Next Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMondayOfDate(date) {
  const d = new Date(date);
  const day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6:1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}

// POST /rosters/auto - Auto generate a week roster
router.post('/auto', isAuthenticated, isRosterManager, async (req, res) => {
  try {
    const { startDate } = req.body;
    let weekStart;
    
    if (startDate) {
      weekStart = getMondayOfDate(new Date(startDate));
    } else {
      weekStart = getNextMonday();
    }
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Check if exists
    const existing = await Roster.findOne({ weekStart });
    if (existing) {
      req.flash('warning', 'Tuần này đã có lịch trực. Bạn đang mở chế độ chỉnh sửa.');
      return res.redirect(`/rosters/${existing._id}/edit`);
    }

    // Auto Logic
    const officers = await Officer.find({}).sort({ chucVu: -1, hoTen: 1 });
    const commanders = officers.filter(o => o.chucVu && o.chucVu.toLowerCase().includes('trưởng'));
    const normals = officers.filter(o => !o.chucVu || !o.chucVu.toLowerCase().includes('trưởng'));

    let days = [];
    let commanderIndex = 0;
    let normalNgayIndex = 0;
    let normalDemIndex = Math.floor(normals.length / 2); // Start dem somewhere else in list

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);

      const dayObj = {
        date: d,
        trucChiHuy: [],
        trucBanNgay: [],
        trucBanDem: [],
        ghiChu: '',
        ghiChuPhu: ''
      };

      if (commanders.length > 0) {
        dayObj.trucChiHuy.push(commanders[commanderIndex % commanders.length]._id);
        commanderIndex++;
      }

      if (normals.length > 0) {
        dayObj.trucBanNgay.push(normals[normalNgayIndex % normals.length]._id);
        normalNgayIndex++;
        // If we want 2 people per shift, uncomment:
        // dayObj.trucBanNgay.push(normals[normalNgayIndex % normals.length]._id);
        // normalNgayIndex++;

        dayObj.trucBanDem.push(normals[normalDemIndex % normals.length]._id);
        normalDemIndex++;
      }

      days.push(dayObj);
    }

    const newRoster = new Roster({
      weekStart,
      weekEnd,
      days,
      createdBy: req.session.user._id
    });

    await newRoster.save();
    
    req.flash('success', 'Đã tự động tạo lịch trực. Vui lòng rà soát lại.');
    res.redirect(`/rosters/${newRoster._id}/edit`);

  } catch (err) {
    req.flash('error', 'Lỗi tạo tự động: ' + err.message);
    res.redirect('/rosters');
  }
});

// GET /rosters/create - Manual create view
router.get('/create', isAuthenticated, isRosterManager, async (req, res) => {
  res.render('rosters/create', { title: 'Tạo Lịch Trực Mới' });
});

// GET /rosters/:id/edit - Edit roster
router.get('/:id/edit', isAuthenticated, isRosterManager, async (req, res) => {
  try {
    const roster = await Roster.findById(req.params.id)
      .populate('days.trucChiHuy')
      .populate('days.trucBanNgay')
      .populate('days.trucBanDem');

    if (!roster) {
      req.flash('error', 'Không tìm thấy lịch trực');
      return res.redirect('/rosters');
    }

    const lastWeekStart = new Date(roster.weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekRoster = await Roster.findOne({ weekStart: lastWeekStart })
      .populate('days.trucChiHuy')
      .populate('days.trucBanNgay')
      .populate('days.trucBanDem');

    const officers = await Officer.find({}).sort({ chucVu: -1, hoTen: 1 });
    res.render('rosters/edit', { title: 'Chỉnh sửa Lịch trực', roster, lastWeekRoster, officers });
  } catch (err) {
    res.redirect('/rosters');
  }
});

// POST /rosters/:id/auto-smart - Smart auto generate avoiding duplicates from last week
router.post('/:id/auto-smart', isAuthenticated, isRosterManager, async (req, res) => {
  try {
    const roster = await Roster.findById(req.params.id);
    if (!roster) return res.redirect('/rosters');

    const lastWeekStart = new Date(roster.weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekRoster = await Roster.findOne({ weekStart: lastWeekStart });

    const officers = await Officer.find({}).sort({ chucVu: -1, hoTen: 1 });
    const commanders = officers.filter(o => o.chucVu && o.chucVu.toLowerCase().includes('trưởng'));
    const normals = officers.filter(o => !o.chucVu || !o.chucVu.toLowerCase().includes('trưởng'));

    let commanderIndex = 0;
    let normalNgayIndex = 0;
    let normalDemIndex = Math.floor(normals.length / 2);

    for (let i = 0; i < 7; i++) {
      roster.days[i].trucChiHuy = [];
      roster.days[i].trucBanNgay = [];
      roster.days[i].trucBanDem = [];

      // Command Shift
      if (commanders.length > 0) {
        let attempts = 0;
        let selectedCmd = null;
        while (attempts < commanders.length) {
          const cmd = commanders[(commanderIndex + attempts) % commanders.length];
          // Check last week
          let conflict = false;
          if (lastWeekRoster && lastWeekRoster.days[i] && lastWeekRoster.days[i].trucChiHuy.includes(cmd._id)) {
            conflict = true;
          }
          if (!conflict || attempts === commanders.length - 1) {
            selectedCmd = cmd;
            commanderIndex = (commanderIndex + attempts + 1) % commanders.length;
            break;
          }
          attempts++;
        }
        if (selectedCmd) roster.days[i].trucChiHuy.push(selectedCmd._id);
      }

      // Normal Day Shift
      if (normals.length > 0) {
        let attempts = 0;
        let selectedNormal = null;
        while (attempts < normals.length) {
          const n = normals[(normalNgayIndex + attempts) % normals.length];
          let conflict = false;
          if (lastWeekRoster && lastWeekRoster.days[i] && lastWeekRoster.days[i].trucBanNgay.includes(n._id)) {
            conflict = true;
          }
          if (!conflict || attempts === normals.length - 1) {
            selectedNormal = n;
            normalNgayIndex = (normalNgayIndex + attempts + 1) % normals.length;
            break;
          }
          attempts++;
        }
        if (selectedNormal) roster.days[i].trucBanNgay.push(selectedNormal._id);
      }

      // Normal Night Shift
      if (normals.length > 0) {
        let attempts = 0;
        let selectedNormal = null;
        while (attempts < normals.length) {
          const n = normals[(normalDemIndex + attempts) % normals.length];
          let conflict = false;
          if (lastWeekRoster && lastWeekRoster.days[i] && lastWeekRoster.days[i].trucBanDem.includes(n._id)) {
            conflict = true;
          }
          // Also avoid overlapping with Day Shift of SAME day
          if (roster.days[i].trucBanNgay.includes(n._id)) conflict = true;

          if (!conflict || attempts === normals.length - 1) {
            selectedNormal = n;
            normalDemIndex = (normalDemIndex + attempts + 1) % normals.length;
            break;
          }
          attempts++;
        }
        if (selectedNormal) roster.days[i].trucBanDem.push(selectedNormal._id);
      }
    }

    await roster.save();
    req.flash('success', 'Đã tự cắt lịch thông minh (đối chiếu tuần trước).');
    res.redirect(`/rosters/${roster._id}/edit`);
  } catch (err) {
    req.flash('error', 'Lỗi cắt lịch: ' + err.message);
    res.redirect(`/rosters/${req.params.id}/edit`);
  }
});

// PUT /rosters/:id - Update roster
router.put('/:id', isAuthenticated, isRosterManager, async (req, res) => {
  try {
    const roster = await Roster.findById(req.params.id);
    if (!roster) return res.redirect('/rosters');

    // Parse req.body to update days
    const body = req.body;
    // We expect arrays from form data mapped by day index
    // e.g. trucChiHuy_0[], trucBanNgay_0[]
    for (let i = 0; i < 7; i++) {
      if (roster.days[i]) {
        roster.days[i].trucChiHuy = body[`trucChiHuy_${i}`] || [];
        roster.days[i].trucBanNgay = body[`trucBanNgay_${i}`] || [];
        roster.days[i].trucBanDem = body[`trucBanDem_${i}`] || [];
        roster.days[i].ghiChu = body[`ghiChu_${i}`] || '';
        roster.days[i].ghiChuPhu = body[`ghiChuPhu_${i}`] || '';
      }
    }

    await roster.save();
    req.flash('success', 'Cập nhật lịch trực thành công');
    res.redirect(`/rosters/${roster._id}`);
  } catch (err) {
    req.flash('error', 'Lỗi cập nhật lịch trực');
    res.redirect(`/rosters/${req.params.id}/edit`);
  }
});

// GET /rosters/:id - View roster (Show)
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const roster = await Roster.findById(req.params.id)
      .populate('days.trucChiHuy')
      .populate('days.trucBanNgay')
      .populate('days.trucBanDem');
      
    if (!roster) {
      req.flash('error', 'Không tìm thấy lịch trực');
      return res.redirect('/rosters');
    }

    const user = req.session.user;
    const canManage = ['admin', 'truong_cax', 'pho_cax'].includes(user.role) || user.canManageRoster;

    res.render('rosters/show', { title: 'Lịch trực', roster, canManage });
  } catch (err) {
    res.redirect('/rosters');
  }
});

// DELETE /rosters/:id
router.delete('/:id', isAuthenticated, isRosterManager, async (req, res) => {
  try {
    await Roster.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa lịch trực');
    res.redirect('/rosters');
  } catch (err) {
    req.flash('error', 'Lỗi xóa lịch trực');
    res.redirect('/rosters');
  }
});

module.exports = router;
