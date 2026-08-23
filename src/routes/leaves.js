const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAuthenticated, isEditorOrAdmin } = require('../middleware/auth');
const Officer = require('../models/Officer');
const Leave = require('../models/Leave');

function countWorkingDays(start, end) {
  let count = 0;
  let cur = new Date(start);
  const endDate = new Date(end);
  cur.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);
  
  if (endDate < cur) return 0;
  
  while (cur <= endDate) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function calculateAllowedLeave(ngayNhapNgu, currentYear) {
  if (!ngayNhapNgu) return 15;
  const nnYear = new Date(ngayNhapNgu).getFullYear();
  const seniority = currentYear - nnYear;
  if (seniority < 0) return 15;
  const bonus = Math.floor(seniority / 5);
  return 15 + bonus;
}

async function getLeaveStats(year, user) {
  let officerQuery = { trangThai: { $ne: 'Đã xuất ngũ' } };
  
  if (user && user.role === 'pho_cax') {
    if (user.officerProfile) {
      const phoCax = await Officer.findById(user.officerProfile);
      if (phoCax && phoCax.toCongTac) {
        officerQuery.toCongTac = phoCax.toCongTac;
      } else {
        officerQuery._id = null; // Pho CAX without team sees nothing
      }
    } else {
      officerQuery._id = null;
    }
  } else if (user && user.role === 'cbcs') {
    if (user.officerProfile) {
      officerQuery._id = user.officerProfile;
    } else {
      officerQuery._id = null; // CBCS without profile sees nothing
    }
  }

  const officers = await Officer.find(officerQuery).populate('toCongTac').sort({ hoTen: 1 });
  const officerIds = officers.map(o => o._id);
  
  const leaves = await Leave.find({ nam: year, officer: { $in: officerIds } }).populate('officer').sort({ tuNgay: -1 });
  
  const leaveMap = {};
  const pendingLeaves = [];

  leaves.forEach(l => {
    const id = l.officer ? l.officer._id.toString() : null;
    if (!id) return;

    if (!leaveMap[id]) leaveMap[id] = 0;
    
    const isPhepNam = !l.loaiPhep || l.loaiPhep === 'Phép năm';
    const isDaDuyet = !l.trangThai || l.trangThai === 'Đã duyệt';
    
    if (isPhepNam && isDaDuyet) {
      leaveMap[id] += l.soNgayNghi;
    }

    if (l.trangThai === 'Chờ duyệt') {
      pendingLeaves.push(l);
    }
  });

  const results = officers.map(o => {
    const allowed = calculateAllowedLeave(o.ngayNhapNgu, year);
    const taken = leaveMap[o._id.toString()] || 0;
    return {
      officer: o,
      allowed,
      taken,
      remaining: allowed - taken
    };
  });

  const order = { "Trưởng Công an xã": 1, "Phó Trưởng Công an xã": 2, "Cán bộ": 3 };
  results.sort((a, b) => {
    const valA = order[a.officer.chucVu] || 4;
    const valB = order[b.officer.chucVu] || 4;
    return valA - valB || a.officer.hoTen.localeCompare(b.officer.hoTen);
  });

  const daNghi = results.filter(r => r.taken > 0);
  const chuaNghi = results.filter(r => r.taken === 0);
  const currentlyOnLeave = leaves.filter(l => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const isDaDuyet = !l.trangThai || l.trangThai === 'Đã duyệt';
    return isDaDuyet && new Date(l.tuNgay) <= today && new Date(l.denNgay) >= today;
  });

  return { year, results, daNghi, chuaNghi, pendingLeaves, currentlyOnLeave, allLeaves: leaves };
}

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === 'cbcs') {
      if (user.officerProfile) {
        return res.redirect(`/leaves/${user.officerProfile}`);
      } else {
        req.flash('error', 'Vui lòng cập nhật hồ sơ cá nhân trước để xem phép');
        return res.redirect('/dashboard');
      }
    }

    const year = parseInt(req.query.year) || new Date().getFullYear();
    const stats = await getLeaveStats(year, req.session.user);

    res.render('leaves/requests', {
      title: 'Danh sách đơn nghỉ phép',
      year: stats.year,
      pendingLeaves: stats.pendingLeaves,
      currentlyOnLeave: stats.currentlyOnLeave,
      allLeaves: stats.allLeaves,
      daNghiLength: stats.daNghi.length,
      activeMenu: 'leaves_requests'
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải danh sách nghỉ phép');
    res.redirect('/dashboard');
  }
});

router.get('/taken', isAuthenticated, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const stats = await getLeaveStats(year, req.session.user);

    res.render('leaves/taken', {
      title: 'Cán bộ đã nghỉ phép',
      year: stats.year,
      daNghi: stats.daNghi,
      activeMenu: 'leaves_taken'
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải danh sách đã nghỉ phép');
    res.redirect('/dashboard');
  }
});

router.get('/not-taken', isAuthenticated, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const stats = await getLeaveStats(year, req.session.user);

    res.render('leaves/not_taken', {
      title: 'Cán bộ chưa nghỉ phép',
      year: stats.year,
      chuaNghi: stats.chuaNghi,
      activeMenu: 'leaves_not_taken'
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải danh sách chưa nghỉ phép');
    res.redirect('/dashboard');
  }
});

router.get('/print-form', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const year = new Date().getFullYear();
    
    let officerQuery = { trangThai: { $ne: 'Đã xuất ngũ' } };
    if (user.role === 'pho_cax') {
      if (user.officerProfile) {
        const phoCax = await Officer.findById(user.officerProfile);
        if (phoCax && phoCax.toCongTac) {
          officerQuery.toCongTac = phoCax.toCongTac;
        } else {
          officerQuery._id = null;
        }
      } else {
        officerQuery._id = null;
      }
    } else if (user.role === 'cbcs') {
      if (user.officerProfile) {
        officerQuery._id = user.officerProfile;
      } else {
        officerQuery._id = null;
      }
    }

    const officers = await Officer.find(officerQuery).sort({ hoTen: 1 });
    const officerIds = officers.map(o => o._id);
    
    const leaves = await Leave.find({ nam: year, officer: { $in: officerIds } });
    const leaveMap = {};
    leaves.forEach(l => {
      const id = l.officer ? l.officer.toString() : null;
      if (!id) return;
      if (!leaveMap[id]) leaveMap[id] = 0;
      const isPhepNam = !l.loaiPhep || l.loaiPhep === 'Phép năm';
      const isDaDuyet = !l.trangThai || l.trangThai === 'Đã duyệt';
      if (isPhepNam && isDaDuyet) leaveMap[id] += l.soNgayNghi;
    });

    const officersData = officers.map(o => {
      const allowed = calculateAllowedLeave(o.ngayNhapNgu, year);
      const taken = leaveMap[o._id.toString()] || 0;
      return {
        _id: o._id,
        hoTen: o.hoTen,
        chucVu: o.chucVu,
        ngayNhapNgu: o.ngayNhapNgu,
        taken: taken,
        allowed: allowed,
        remaining: allowed - taken
      };
    });

    res.render('leaves/print', {
      title: 'In đơn xin nghỉ phép',
      officersData: JSON.stringify(officersData),
      activeMenu: 'leaves_print'
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải trang in đơn');
    res.redirect('/leaves');
  }
});

router.get('/:officerId', isAuthenticated, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const officer = await Officer.findById(req.params.officerId).populate('toCongTac');
    if (!officer) {
      req.flash('error', 'Không tìm thấy cán bộ');
      return res.redirect('/leaves');
    }

    // RBAC Check
    const user = req.session.user;
    let canView = false;
    if (user.role === 'admin' || user.role === 'truong_cax') canView = true;
    else if (user.role === 'cbcs' && user.officerProfile === officer._id.toString()) canView = true;
    else if (user.role === 'pho_cax' && user.officerProfile) {
      const phoCax = await Officer.findById(user.officerProfile);
      if (phoCax && phoCax.toCongTac && officer.toCongTac && phoCax.toCongTac.toString() === officer.toCongTac._id.toString()) canView = true;
    }

    if (!canView) {
      req.flash('error', 'Bạn không có quyền xem thông tin nghỉ phép này');
      return res.redirect('/dashboard');
    }

    const history = await Leave.find({ officer: officer._id, nam: year }).populate('nguoiDuyet').sort({ tuNgay: -1 });
    
    const allowed = calculateAllowedLeave(officer.ngayNhapNgu, year);
    const taken = history.reduce((sum, l) => {
      const isPhepNam = !l.loaiPhep || l.loaiPhep === 'Phép năm';
      const isDaDuyet = !l.trangThai || l.trangThai === 'Đã duyệt';
      return (isPhepNam && isDaDuyet) ? sum + l.soNgayNghi : sum;
    }, 0);

    res.render('leaves/show', {
      title: `Nghỉ phép: ${officer.hoTen}`,
      officer,
      year,
      history,
      allowed,
      taken,
      remaining: allowed - taken,
      activeMenu: 'leaves' // Show active on parent menu
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải chi tiết nghỉ phép');
    res.redirect('/leaves');
  }
});

router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { officer, tuNgay, denNgay, lyDo, loaiPhep } = req.body;
    
    const start = new Date(tuNgay);
    const end = new Date(denNgay);
    
    if (end < start) {
      req.flash('error', 'Ngày kết thúc phải sau ngày bắt đầu');
      return res.redirect(`/leaves/${officer}`);
    }

    const nam = start.getFullYear();
    const soNgayNghi = countWorkingDays(start, end);

    if (soNgayNghi === 0) {
      req.flash('error', 'Khoảng thời gian không có ngày làm việc nào');
      return res.redirect(`/leaves/${officer}`);
    }

    const user = req.session.user;

    // Security RBAC validation
    if (user.role === 'cbcs' && (!user.officerProfile || user.officerProfile.toString() !== officer.toString())) {
      req.flash('error', 'Bạn không có quyền nộp đơn cho người khác');
      return res.redirect('back');
    }
    if (user.role === 'pho_cax') {
      const targetOfficer = await Officer.findById(officer);
      const phoCax = await Officer.findById(user.officerProfile);
      if (!targetOfficer || !phoCax || !targetOfficer.toCongTac || targetOfficer.toCongTac.toString() !== phoCax.toCongTac.toString()) {
        req.flash('error', 'Bạn chỉ có quyền nộp đơn cho thành viên trong tổ');
        return res.redirect('back');
      }
    }

    const trangThai = (user && ['admin', 'truong_cax'].includes(user.role)) ? 'Đã duyệt' : 'Chờ duyệt';
    const nguoiDuyet = trangThai === 'Đã duyệt' ? user._id : undefined;

    await Leave.create({ officer, tuNgay, denNgay, soNgayNghi, lyDo, nam, loaiPhep: loaiPhep || 'Phép năm', trangThai, nguoiDuyet });
    
    req.flash('success', trangThai === 'Đã duyệt' ? 'Thêm lượt nghỉ phép thành công' : 'Đã gửi đơn xin nghỉ phép chờ duyệt');
    res.redirect(`/leaves/${officer}?year=${nam}`);
  } catch (err) {
    req.flash('error', 'Lỗi thêm nghỉ phép');
    res.redirect('/leaves');
  }
});

router.patch('/:id/status', isAuthenticated, isEditorOrAdmin, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('officer');
    if (!leave) {
      req.flash('error', 'Không tìm thấy đơn nghỉ phép');
      return res.redirect('back');
    }

    const user = req.session.user;
    if (user.role === 'pho_cax') {
      const phoCax = await Officer.findById(user.officerProfile);
      if (!phoCax || !leave.officer.toCongTac || phoCax.toCongTac.toString() !== leave.officer.toCongTac.toString()) {
        req.flash('error', 'Bạn không có quyền duyệt phép cho thành viên ngoài tổ');
        return res.redirect('back');
      }
    }
    
    leave.trangThai = req.body.trangThai;
    if (leave.trangThai === 'Đã duyệt' || leave.trangThai === 'Từ chối') {
      leave.nguoiDuyet = user._id;
    }
    await leave.save();
    
    req.flash('success', `Đã cập nhật trạng thái thành: ${leave.trangThai}`);
    res.redirect('back');
  } catch (err) {
    req.flash('error', 'Lỗi cập nhật trạng thái');
    res.redirect('back');
  }
});

router.delete('/:id', isAuthenticated, isEditorOrAdmin, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('officer');
    if (!leave) {
      req.flash('error', 'Không tìm thấy lịch sử phép');
      return res.redirect('/leaves');
    }
    
    const user = req.session.user;
    if (user.role === 'pho_cax') {
      const phoCax = await Officer.findById(user.officerProfile);
      if (!phoCax || !leave.officer.toCongTac || phoCax.toCongTac.toString() !== leave.officer.toCongTac.toString()) {
        req.flash('error', 'Bạn không có quyền xóa phép của thành viên ngoài tổ');
        return res.redirect('back');
      }
    }

    const officerId = leave.officer._id;
    const year = leave.nam;
    await Leave.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa lượt nghỉ phép');
    res.redirect(`/leaves/${officerId}?year=${year}`);
  } catch (err) {
    req.flash('error', 'Lỗi xóa nghỉ phép');
    res.redirect('/leaves');
  }
});

module.exports = router;
