const express = require('express');
const router = express.Router();
const TelegramCommand = require('../models/TelegramCommand');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Lấy danh sách lệnh
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const commands = await TelegramCommand.find().sort({ createdAt: -1 });
    res.render('settings/telegram', {
      title: 'Cấu hình Bot Telegram',
      commands
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi tải danh sách lệnh');
    res.redirect('/dashboard');
  }
});

// Thêm lệnh mới (Chỉ hỗ trợ thêm lệnh tĩnh trên UI)
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    let { command, description, staticText, scheduleTime } = req.body;
    
    command = command.replace('/', '').toLowerCase().trim();
    
    // Kiểm tra trùng
    const exists = await TelegramCommand.findOne({ command });
    if (exists) {
      req.flash('error', `Lệnh /${command} đã tồn tại!`);
      return res.redirect('/telegram-config');
    }

    await TelegramCommand.create({
      command,
      description,
      type: 'static',
      staticText,
      scheduleTime: scheduleTime || ''
    });

    req.flash('success', `Đã thêm lệnh /${command} thành công`);
    res.redirect('/telegram-config');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi thêm lệnh');
    res.redirect('/telegram-config');
  }
});

// Sửa lệnh
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { description, staticText, scheduleTime } = req.body;
    const cmd = await TelegramCommand.findById(req.params.id);
    
    if (!cmd) {
      req.flash('error', 'Không tìm thấy lệnh');
      return res.redirect('/telegram-config');
    }

    cmd.description = description;
    cmd.scheduleTime = scheduleTime || '';
    if (cmd.type === 'static') {
      cmd.staticText = staticText;
    }
    
    await cmd.save();

    req.flash('success', `Cập nhật lệnh /${cmd.command} thành công`);
    res.redirect('/telegram-config');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi cập nhật lệnh');
    res.redirect('/telegram-config');
  }
});

// Đổi trạng thái Bật/Tắt
router.put('/:id/toggle', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const cmd = await TelegramCommand.findById(req.params.id);
    if (!cmd) return res.redirect('/telegram-config');

    cmd.isActive = !cmd.isActive;
    await cmd.save();

    req.flash('success', `Đã ${cmd.isActive ? 'Bật' : 'Tắt'} lệnh /${cmd.command}`);
    res.redirect('/telegram-config');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi hệ thống');
    res.redirect('/telegram-config');
  }
});

// Xóa lệnh (Chỉ xóa lệnh tĩnh)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const cmd = await TelegramCommand.findById(req.params.id);
    if (!cmd) return res.redirect('/telegram-config');

    if (cmd.type === 'dynamic') {
      req.flash('error', 'Không thể xóa các lệnh động (lệnh hệ thống).');
      return res.redirect('/telegram-config');
    }

    await TelegramCommand.findByIdAndDelete(req.params.id);
    req.flash('success', `Đã xóa lệnh /${cmd.command}`);
    res.redirect('/telegram-config');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi xóa lệnh');
    res.redirect('/telegram-config');
  }
});

module.exports = router;
