const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const Setting = require('../models/Setting');

router.get('/', isAuthenticated, isAdmin, (req, res) => {
  res.render('settings/index', { title: 'Cấu hình hệ thống' });
});

router.post('/2fa/toggle', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { require2FA } = req.body;
    const isEnabled = require2FA === 'true';
    
    let setting = await Setting.findOne({ key: 'GLOBAL_2FA_ENABLED' });
    if (!setting) {
      setting = new Setting({ key: 'GLOBAL_2FA_ENABLED' });
    }
    
    setting.value = isEnabled;
    await setting.save();
    
    req.app.locals.require2FA = isEnabled;
    
    req.flash('success', isEnabled ? 'Đã BẬT tính năng bảo mật 2 lớp cho toàn hệ thống.' : 'Đã TẮT tính năng bảo mật 2 lớp cho toàn hệ thống.');
    res.redirect('/settings');
  } catch (err) {
    req.flash('error', 'Lỗi khi cập nhật cấu hình hệ thống');
    res.redirect('/settings');
  }
});

module.exports = router;
