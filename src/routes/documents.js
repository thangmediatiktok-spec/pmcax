const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated, isEditorOrAdmin } = require('../middleware/auth');
const Document = require('../models/Document');
const Officer = require('../models/Officer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads/documents';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpeg|jpg|png/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.post('/', isAuthenticated, upload.array('files', 10), async (req, res) => {
  try {
    const { officer, tenTaiLieu, loaiTaiLieu, ngayCap } = req.body;
    const user = req.session.user;

    if (!req.files || req.files.length === 0) {
      req.flash('error', 'Vui lòng chọn file đính kèm (PDF, JPG, PNG) dưới 5MB.');
      return res.redirect(`/officers/${officer}/documents`);
    }

    // Kiểm tra quyền: Admin/Trưởng/Phó có thể upload cho bất kỳ ai
    // CBCS chỉ được upload tài liệu của chính mình
    if (user.role === 'cbcs') {
      if (!user.officerProfile || user.officerProfile.toString() !== officer.toString()) {
        req.flash('error', 'Bạn không có quyền tải tài liệu cho cán bộ khác');
        return res.redirect(`/officers/${officer}/documents`);
      }
    } else if (!['admin', 'truong_cax', 'pho_cax'].includes(user.role)) {
      req.flash('error', 'Bạn không có quyền thực hiện thao tác này');
      return res.redirect('/dashboard');
    }

    const doc = new Document({
      officer,
      tenTaiLieu,
      loaiTaiLieu,
      ngayCap: ngayCap || undefined,
      fileUrls: req.files.map(f => `/uploads/documents/${f.filename}`),
      nguoiTaiLen: user._id
    });

    await doc.save();
    req.flash('success', 'Đã tải lên tài liệu thành công');
    res.redirect(`/officers/${officer}/documents`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi tải lên tài liệu');
    res.redirect('back');
  }
});

// Upload nhanh từ form chỉnh sửa hồ sơ - trả về JSON (AJAX)
router.post('/quick-upload', isAuthenticated, upload.array('files', 10), async (req, res) => {
  try {
    const { officer, tenTaiLieu, loaiTaiLieu, ngayCap, nguonTruong } = req.body;
    const user = req.session.user;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 file (PDF, JPG, PNG) dưới 5MB.' });
    }

    if (!officer || !tenTaiLieu || !loaiTaiLieu) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }

    // Kiểm tra quyền
    if (user.role === 'cbcs') {
      if (!user.officerProfile || user.officerProfile.toString() !== officer.toString()) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền tải tài liệu cho cán bộ khác.' });
      }
    } else if (!['admin', 'truong_cax', 'pho_cax'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
    }

    const doc = new Document({
      officer,
      tenTaiLieu,
      loaiTaiLieu,
      ngayCap: ngayCap || undefined,
      fileUrls: req.files.map(f => `/uploads/documents/${f.filename}`),
      nguoiTaiLen: user._id,
      nguonTruong: nguonTruong || undefined
    });

    await doc.save();

    // Đếm tổng tài liệu theo nguonTruong này
    const count = await Document.countDocuments({ officer, nguonTruong });

    return res.json({
      success: true,
      message: 'Đã tải lên thành công',
      docId: doc._id,
      fileCount: req.files.length,
      totalCount: count
    });
  } catch (err) {
    console.error('Quick upload error:', err);
    // Xóa file đã upload nếu lưu DB thất bại
    if (req.files) {
      req.files.forEach(f => {
        const fp = path.join('public/uploads/documents', f.filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
    }
    return res.status(500).json({ success: false, message: 'Lỗi server khi tải lên tài liệu.' });
  }
});

// Lấy số lượng tài liệu theo nguonTruong cho 1 officer (JSON)
router.get('/count/:officerId', isAuthenticated, async (req, res) => {
  try {
    const { officerId } = req.params;
    const user = req.session.user;

    // Chỉ cho phép xem count của chính mình hoặc admin/truong/pho
    if (user.role === 'cbcs' && (!user.officerProfile || user.officerProfile.toString() !== officerId)) {
      return res.status(403).json({ success: false });
    }

    const docs = await Document.aggregate([
      { $match: { officer: require('mongoose').Types.ObjectId.createFromHexString(officerId), nguonTruong: { $exists: true, $ne: null } } },
      { $group: { _id: '$nguonTruong', count: { $sum: 1 } } }
    ]);

    const counts = {};
    docs.forEach(d => { counts[d._id] = d.count; });

    return res.json({ success: true, counts });
  } catch (err) {
    console.error('Count error:', err);
    return res.status(500).json({ success: false });
  }
});



router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      req.flash('error', 'Không tìm thấy tài liệu');
      return res.redirect('back');
    }

    const user = req.session.user;
    const officerId = doc.officer;

    // Kiểm tra quyền xóa:
    // - Admin/Trưởng/Phó xóa được tất cả
    // - CBCS chỉ xóa tài liệu do chính mình upload
    const isEditorPlus = ['admin', 'truong_cax', 'pho_cax'].includes(user.role);
    const isOwnDocument = doc.nguoiTaiLen && doc.nguoiTaiLen.toString() === user._id.toString();
    const isOwnOfficer = user.officerProfile && user.officerProfile.toString() === officerId.toString();

    if (!isEditorPlus && !(isOwnDocument && isOwnOfficer)) {
      req.flash('error', 'Bạn không có quyền xóa tài liệu này');
      return res.redirect(`/officers/${officerId}/documents`);
    }
    
    // Delete files from disk
    if (doc.fileUrls && doc.fileUrls.length > 0) {
      doc.fileUrls.forEach(url => {
        const filePath = path.join('public', url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } else if (doc.fileUrl) {
      // Fallback for old documents that haven't been migrated
      const filePath = path.join('public', doc.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Document.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa tài liệu');
    res.redirect(`/officers/${officerId}/documents`);
  } catch (err) {
    req.flash('error', 'Lỗi xóa tài liệu');
    res.redirect('back');
  }
});

module.exports = router;
