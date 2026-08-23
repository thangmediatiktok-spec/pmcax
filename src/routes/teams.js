const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const Team = require('../models/Team');
const Officer = require('../models/Officer');

const teamData = body => ({
  ten: typeof body.ten === 'string' ? body.ten.trim() : body.ten,
  thuTu: body.thuTu === '' ? 0 : body.thuTu,
  moTa: typeof body.moTa === 'string' ? body.moTa.trim() : body.moTa,
  trangThai: body.trangThai === 'true' || body.trangThai === true
});

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  const teams = await Team.find().sort({ thuTu: 1, ten: 1 });
  res.render('teams/index', { title: 'Quản lý tổ công tác', teams });
});

router.get('/create', isAuthenticated, isAdmin, (req, res) => {
  res.render('teams/create', { title: 'Thêm tổ công tác' });
});

router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await Team.create(teamData(req.body));
    req.flash('success', 'Thêm tổ công tác thành công');
    res.redirect('/teams');
  } catch (err) {
    req.flash('error', err.code === 11000 ? 'Tên tổ công tác đã tồn tại' : 'Lỗi thêm tổ công tác');
    res.redirect('/teams/create');
  }
});

router.get('/:id/edit', isAuthenticated, isAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    req.flash('error', 'Tổ công tác không hợp lệ');
    return res.redirect('/teams');
  }
  const team = await Team.findById(req.params.id);
  if (!team) {
    req.flash('error', 'Không tìm thấy tổ công tác');
    return res.redirect('/teams');
  }
  res.render('teams/edit', { title: 'Chỉnh sửa tổ công tác', team });
});

router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, teamData(req.body), {
      new: true,
      runValidators: true
    });
    if (!team) {
      req.flash('error', 'Không tìm thấy tổ công tác');
      return res.redirect('/teams');
    }
    req.flash('success', 'Cập nhật tổ công tác thành công');
    res.redirect('/teams');
  } catch (err) {
    req.flash('error', err.code === 11000 ? 'Tên tổ công tác đã tồn tại' : 'Lỗi cập nhật tổ công tác');
    res.redirect(`/teams/${req.params.id}/edit`);
  }
});

router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const officerCount = await Officer.countDocuments({ toCongTac: req.params.id });
    if (officerCount > 0) {
      req.flash('error', `Không thể xóa: tổ đang có ${officerCount} cán bộ. Hãy vô hiệu hóa hoặc chuyển cán bộ trước.`);
      return res.redirect('/teams');
    }
    await Team.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa tổ công tác');
  } catch {
    req.flash('error', 'Lỗi xóa tổ công tác');
  }
  res.redirect('/teams');
});

module.exports = router;
