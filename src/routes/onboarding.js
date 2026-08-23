const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const Officer = require('../models/Officer');
const User = require('../models/User');
const Team = require('../models/Team');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

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
  // If user already has a profile or is admin, go to step 2 (2FA) or dashboard
  if (req.session.user.role === 'admin' || req.session.user.officerProfile) {
    if (!req.session.user.twoFactorEnabled) {
      return res.redirect('/onboarding/2fa');
    }
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
    if (!req.session.user.twoFactorEnabled) {
      return res.redirect('/onboarding/2fa');
    }
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

    req.flash('success', 'Khai báo thông tin thành công! Vui lòng thiết lập Bảo mật 2 lớp.');
    res.redirect('/onboarding/2fa');
  } catch (err) {
    console.error(err);
    req.flash('error', err.code === 11000 ? 'Mã số đã tồn tại, vui lòng kiểm tra lại' : 'Lỗi lưu thông tin');
    res.redirect('/onboarding');
  }
});

router.get('/2fa', isAuthenticated, async (req, res) => {
  if (req.session.user.twoFactorEnabled) {
    return res.redirect('/dashboard');
  }
  
  const user = await User.findById(req.session.user._id);
  
  // Generate secret if not exists
  if (!user.twoFactorSecret) {
    user.twoFactorSecret = authenticator.generateSecret();
    await user.save();
  }

  const otpauth = authenticator.keyuri(user.username, 'PMCAX', user.twoFactorSecret);
  const qrCodeUrl = await qrcode.toDataURL(otpauth);

  res.render('onboarding/2fa', {
    title: 'Thiết lập bảo mật 2 lớp (2FA)',
    qrCodeUrl,
    secret: user.twoFactorSecret,
    layout: false
  });
});

router.post('/2fa/verify', isAuthenticated, async (req, res) => {
  if (req.session.user.twoFactorEnabled) {
    return res.redirect('/dashboard');
  }

  const { token } = req.body;
  const user = await User.findById(req.session.user._id);

  const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });

  if (isValid) {
    user.twoFactorEnabled = true;
    await user.save();
    req.session.user.twoFactorEnabled = true;
    req.flash('success', 'Thiết lập bảo mật 2 lớp (2FA) thành công!');
    res.redirect('/dashboard');
  } else {
    req.flash('error', 'Mã xác nhận không chính xác. Vui lòng thử lại.');
    res.redirect('/onboarding/2fa');
  }
});

module.exports = router;
