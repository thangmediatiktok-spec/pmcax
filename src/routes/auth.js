const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Đăng nhập - PMCAX' });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, trangThai: true }).populate('officerProfile');
    if (!user || !(await user.comparePassword(password))) {
      req.flash('error', 'Tên đăng nhập hoặc mật khẩu không đúng');
      return res.redirect('/login');
    }
    user.lastLogin = new Date();
    await user.save();
    req.session.user = { 
      _id: user._id, 
      username: user.username, 
      hoTen: user.hoTen, 
      role: user.role,
      officerProfile: user.officerProfile ? user.officerProfile._id : null,
      capBac: user.officerProfile ? user.officerProfile.capBac : '',
      anhDaiDien: user.officerProfile ? user.officerProfile.anhDaiDien : null,
      maSo: user.officerProfile ? user.officerProfile.maSo : ''
    };
    req.flash('success', `Chào mừng ${user.hoTen}!`);
    res.redirect('/dashboard');
  } catch (err) {
    req.flash('error', 'Đã có lỗi xảy ra');
    res.redirect('/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

router.post('/change-password', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
      req.flash('error', 'Mật khẩu xác nhận không khớp');
      return res.redirect('back');
    }
    const user = await User.findById(req.session.user._id);
    if (!user || !(await user.comparePassword(oldPassword))) {
      req.flash('error', 'Mật khẩu cũ không chính xác');
      return res.redirect('back');
    }
    user.password = newPassword;
    await user.save();
    req.flash('success', 'Đổi mật khẩu thành công');
    res.redirect('back');
  } catch (err) {
    req.flash('error', 'Lỗi đổi mật khẩu');
    res.redirect('back');
  }
});

router.get('/', (req, res) => res.redirect('/dashboard'));

module.exports = router;
