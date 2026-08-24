const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const xlsx = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.render('users/index', { title: 'Quản lý tài khoản', users });
});

router.get('/create', isAuthenticated, isAdmin, (req, res) => {
  res.render('users/create', { title: 'Thêm tài khoản mới' });
});

router.get('/template-excel', isAuthenticated, isAdmin, (req, res) => {
  const wb = xlsx.utils.book_new();
  
  // Create sample data for the template
  const wsData = [
    ['Tên đăng nhập (Bắt buộc)', 'Họ tên (Bắt buộc)', 'Mật khẩu (Tùy chọn)', 'Email (Tùy chọn)', 'Vai trò (admin, truong_cax, pho_cax, cbcs)', 'Trạng thái (1: Hoạt động, 0: Khóa)', 'Quản lý lịch trực (1: Có, 0: Không)'],
    ['nguyenvana', 'Nguyễn Văn A', '123456', 'nva@example.com', 'cbcs', 1, 0],
    ['tranhaib', 'Trần Hải B', '', '', 'pho_cax', 1, 1]
  ];
  
  const ws = xlsx.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 30 }, { wch: 35 }
  ];
  
  xlsx.utils.book_append_sheet(wb, ws, 'TaiKhoan');
  
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', 'attachment; filename="Mau_Nhap_Tai_Khoan.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

router.post('/import-excel', isAuthenticated, isAdmin, upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'Vui lòng chọn file Excel');
      return res.redirect('/users');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length <= 1) {
      req.flash('error', 'File Excel không có dữ liệu');
      return res.redirect('/users');
    }
    
    let successCount = 0;
    let skipCount = 0;
    let skippedUsers = [];

    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows

      const username = String(row[0]).trim();
      if (!username) continue;

      const hoTen = row[1] ? String(row[1]).trim() : username;
      const password = row[2] ? String(row[2]).trim() : '123456';
      const email = row[3] ? String(row[3]).trim() : '';
      let role = row[4] ? String(row[4]).trim() : 'cbcs';
      const validRoles = ['admin', 'truong_cax', 'pho_cax', 'cbcs'];
      if (!validRoles.includes(role)) role = 'cbcs';
      
      const trangThai = row[5] === undefined ? true : (String(row[5]).trim() === '1' || String(row[5]).trim().toLowerCase() === 'true');
      const canManageRoster = row[6] === undefined ? false : (String(row[6]).trim() === '1' || String(row[6]).trim().toLowerCase() === 'true');

      // Check if username exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        skipCount++;
        skippedUsers.push(username);
        continue;
      }

      await User.create({
        username,
        password,
        hoTen,
        email,
        role,
        trangThai,
        canManageRoster
      });
      successCount++;
    }

    let flashMsg = `Đã nhập thành công ${successCount} tài khoản.`;
    if (skipCount > 0) {
      flashMsg += ` Bỏ qua ${skipCount} tài khoản đã tồn tại (${skippedUsers.slice(0, 3).join(', ')}${skipCount > 3 ? '...' : ''}).`;
    }

    req.flash(skipCount > 0 ? 'warning' : 'success', flashMsg);
    res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Có lỗi xảy ra khi xử lý file Excel');
    res.redirect('/users');
  }
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

router.post('/:id/reset-2fa', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Không tìm thấy tài khoản');
      return res.redirect('/users');
    }
    
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();
    
    req.flash('success', `Đã tắt tính năng 2FA cho tài khoản ${user.username}. Lần đăng nhập tiếp theo, người này sẽ phải cài đặt lại 2FA.`);
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Lỗi khi đặt lại 2FA');
    res.redirect('/users');
  }
});

module.exports = router;
