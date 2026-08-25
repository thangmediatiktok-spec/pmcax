const express = require('express');
const router = express.Router();
const { isAuthenticated, isEditorOrAdmin } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

router.get('/', isAuthenticated, isEditorOrAdmin, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin' && req.session.user.role !== 'truong_cax') {
      req.flash('error', 'Bạn không có quyền xem Nhật ký truy cập.');
      return res.redirect('/dashboard');
    }

    // Limit to recent 1000 logs to prevent memory issues, DataTables will handle client-side pagination
    const logs = await AuditLog.find()
      .populate('user', 'hoTen username role')
      .populate('targetOfficer', 'hoTen maSo')
      .sort({ createdAt: -1 })
      .limit(1000);

    res.render('audit/index', {
      title: 'Nhật ký truy cập',
      logs,
      activeMenu: 'audit'
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải nhật ký truy cập');
    res.redirect('/dashboard');
  }
});

module.exports = router;
