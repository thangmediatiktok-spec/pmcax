const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticator } = require('otplib');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 lần sai từ 1 IP
  message: 'Quá nhiều nỗ lực đăng nhập. Vui lòng thử lại sau 15 phút.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Đăng nhập - PMCAX' });
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).populate('officerProfile');
    
    if (!user) {
      req.flash('error', 'Tên đăng nhập hoặc mật khẩu không đúng');
      return res.redirect('/login');
    }

    if (!user.trangThai) {
      req.flash('error', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');
      return res.redirect('/login');
    }

    if (!(await user.comparePassword(password))) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.trangThai = false;
        await user.save();
        req.flash('error', 'Tài khoản đã bị khóa do đăng nhập sai quá 5 lần.');
      } else {
        await user.save();
        req.flash('error', `Tên đăng nhập hoặc mật khẩu không đúng (Sai ${user.failedLoginAttempts}/5 lần)`);
      }
      return res.redirect('/login');
    }

    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    await user.save();

    if (req.app.locals.require2FA && user.twoFactorEnabled) {
      req.session.tempUserId = user._id;
      return res.redirect('/login/2fa');
    }

    req.session.user = { 
      _id: user._id, 
      username: user.username, 
      hoTen: user.hoTen, 
      role: user.role,
      officerProfile: user.officerProfile ? user.officerProfile._id : null,
      capBac: user.officerProfile ? user.officerProfile.capBac : '',
      anhDaiDien: user.officerProfile ? user.officerProfile.anhDaiDien : null,
      maSo: user.officerProfile ? user.officerProfile.maSo : '',
      twoFactorEnabled: user.twoFactorEnabled
    };
    req.flash('success', `Chào mừng ${user.hoTen}!`);
    res.redirect('/dashboard');
  } catch (err) {
    req.flash('error', 'Đã có lỗi xảy ra');
    res.redirect('/login');
  }
});

router.get('/login/2fa', (req, res) => {
  if (!req.session.tempUserId) return res.redirect('/login');
  res.render('auth/2fa', { title: 'Xác thực 2 bước (2FA)' });
});

router.post('/login/2fa', loginLimiter, async (req, res) => {
  try {
    if (!req.session.tempUserId) return res.redirect('/login');
    const { token } = req.body;
    
    const user = await User.findById(req.session.tempUserId).populate('officerProfile');
    if (!user) {
      req.flash('error', 'Tài khoản không tồn tại');
      return res.redirect('/login');
    }

    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.trangThai = false;
        await user.save();
        req.session.tempUserId = null;
        req.flash('error', 'Tài khoản đã bị khóa do nhập sai mã quá 5 lần.');
        return res.redirect('/login');
      } else {
        await user.save();
        req.flash('error', `Mã xác thực không chính xác (Sai ${user.failedLoginAttempts}/5 lần)`);
        return res.redirect('/login/2fa');
      }
    }

    user.failedLoginAttempts = 0;
    await user.save();

    req.session.tempUserId = null;
    req.session.user = { 
      _id: user._id, 
      username: user.username, 
      hoTen: user.hoTen, 
      role: user.role,
      officerProfile: user.officerProfile ? user.officerProfile._id : null,
      capBac: user.officerProfile ? user.officerProfile.capBac : '',
      anhDaiDien: user.officerProfile ? user.officerProfile.anhDaiDien : null,
      maSo: user.officerProfile ? user.officerProfile.maSo : '',
      twoFactorEnabled: user.twoFactorEnabled
    };
    req.flash('success', `Chào mừng ${user.hoTen}!`);
    res.redirect('/dashboard');
  } catch (err) {
    req.flash('error', 'Lỗi xác thực 2 bước');
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
