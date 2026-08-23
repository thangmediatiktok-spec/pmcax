const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const User = require('../models/User');

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.render('users/index', { title: 'Quản lý tài khoản', users });
});

router.get('/create', isAuthenticated, isAdmin, (req, res) => {
  res.render('users/create', { title: 'Thêm tài khoản mới' });
});

router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const data = { ...req.body };
    data.canManageRoster = data.canManageRoster === 'on' || data.canManageRoster === 'true';
    await User.create(data);
    req.flash('success', 'Tạo tài khoản thành công');
    res.redirect('/users');
  } catch (err) {
    req.flash('error', err.code === 11000 ? 'Tên đăng nhập đã tồn tại' : 'Lỗi tạo tài khoản');
    res.redirect('/users/create');
  }
});

router.get('/:id/edit', isAuthenticated, isAdmin, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { req.flash('error', 'Không tìm thấy tài khoản'); return res.redirect('/users'); }
  res.render('users/edit', { title: 'Chỉnh sửa tài khoản', user });
});

router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { username, hoTen, email, role, trangThai, password, canManageRoster } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) { req.flash('error', 'Không tìm thấy'); return res.redirect('/users'); }
    user.username = username;
    user.hoTen = hoTen;
    user.email = email;
    user.role = role;
    user.trangThai = trangThai === 'true';
    user.canManageRoster = canManageRoster === 'on' || canManageRoster === 'true';
    if (password && password.trim()) user.password = password;
    await user.save();
    req.flash('success', 'Cập nhật tài khoản thành công');
    res.redirect('/users');
  } catch {
    req.flash('error', 'Lỗi cập nhật');
    res.redirect(`/users/${req.params.id}/edit`);
  }
});

router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  if (req.params.id === req.session.user._id.toString()) {
    req.flash('error', 'Không thể xóa tài khoản đang đăng nhập');
    return res.redirect('/users');
  }
  await User.findByIdAndDelete(req.params.id);
  req.flash('success', 'Đã xóa tài khoản');
  res.redirect('/users');
});

router.post('/:id/toggle-lock', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Không tìm thấy tài khoản');
      return res.redirect('/users');
    }
    
    if (user._id.toString() === req.session.user._id.toString()) {
      req.flash('error', 'Không thể tự khóa tài khoản của chính mình');
      return res.redirect('/users');
    }

    user.trangThai = !user.trangThai;
    if (user.trangThai) {
      // If unlocking, reset failed attempts
      user.failedLoginAttempts = 0;
    }
    
    await user.save();
    req.flash('success', user.trangThai ? `Đã mở khóa tài khoản ${user.username}` : `Đã khóa tài khoản ${user.username}`);
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Lỗi khi thay đổi trạng thái tài khoản');
    res.redirect('/users');
  }
});

module.exports = router;
