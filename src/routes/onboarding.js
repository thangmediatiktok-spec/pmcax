const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const Officer = require('../models/Officer');
const User = require('../models/User');
const Team = require('../models/Team');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads/officers';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `officer_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.get('/', isAuthenticated, async (req, res) => {
  // If user already has a profile or is admin, redirect to dashboard
  if (req.session.user.role === 'admin' || req.session.user.officerProfile) {
    return res.redirect('/dashboard');
  }

  const ranks = Officer.schema.path('capBac').enumValues;
  const teams = await Team.find({ trangThai: true }).sort({ thuTu: 1 });
  
  res.render('onboarding/index', { 
    title: 'Khai báo thông tin cá nhân', 
    ranks, 
    teams,
    layout: false // Custom layout for onboarding
  });
});

router.post('/', isAuthenticated, upload.single('anhDaiDien'), async (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.officerProfile) {
    return res.redirect('/dashboard');
  }

  try {
    const data = { ...req.body };
    if (req.file) data.anhDaiDien = `/uploads/officers/${req.file.filename}`;
    data.dangVien = data.dangVien === 'true';
    if (!data.capBac) delete data.capBac;
    if (!data.ngayVaoDang) delete data.ngayVaoDang;
    if (!data.ngayNhapNgu) delete data.ngayNhapNgu;
    if (!data.ngayCapCCCD) delete data.ngayCapCCCD;
    if (!data.ngayNhanCapBac) delete data.ngayNhanCapBac;
    if (!data.thoiHanTangCap) delete data.thoiHanTangCap;

    // Set chucVu based on User role to prevent tampering
    if (req.session.user.role === 'truong_cax') data.chucVu = 'Trưởng Công an xã';
    else if (req.session.user.role === 'pho_cax') data.chucVu = 'Phó Trưởng Công an xã';
    else data.chucVu = 'Cán bộ';
    
    // Link to User
    data.userId = req.session.user._id;

    const newOfficer = await Officer.create(data);
    
    // Update User
    await User.findByIdAndUpdate(req.session.user._id, { officerProfile: newOfficer._id });
    
    // Update session
    req.session.user.officerProfile = newOfficer._id;

    req.flash('success', 'Khai báo thông tin thành công!');
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', err.code === 11000 ? 'Mã số đã tồn tại, vui lòng kiểm tra lại' : 'Lỗi lưu thông tin');
    res.redirect('/onboarding');
  }
});

module.exports = router;
