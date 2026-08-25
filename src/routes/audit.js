const express = require('express');
const router = express.Router();
const { isAuthenticated, isEditorOrAdmin } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

router.get('/', isAuthenticated, isEditorOrAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    
    // Admin and Truong CAX can see all logs, Pho CAX can only see logs of their team members?
    // For simplicity, only admin and truong_cax can see audit logs
    if (req.session.user.role !== 'admin' && req.session.user.role !== 'truong_cax') {
      req.flash('error', 'Bạn không có quyền xem Nhật ký truy cập.');
      return res.redirect('/dashboard');
    }

    const total = await AuditLog.countDocuments();
    const logs = await AuditLog.find()
      .populate('user', 'hoTen username role')
      .populate('targetOfficer', 'hoTen maSo')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('audit/index', {
      title: 'Nhật ký truy cập',
      logs,
      page,
      totalPages: Math.ceil(total / limit),
      activeMenu: 'audit'
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải nhật ký truy cập');
    res.redirect('/dashboard');
  }
});

module.exports = router;
