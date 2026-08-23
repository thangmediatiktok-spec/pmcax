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

router.post('/', isAuthenticated, isEditorOrAdmin, upload.single('file'), async (req, res) => {
  try {
    const { officer, tenTaiLieu, loaiTaiLieu, ngayCap } = req.body;
    
    if (!req.file) {
      req.flash('error', 'Vui lòng chọn file đính kèm (PDF, JPG, PNG) dưới 5MB.');
      return res.redirect(`/officers/${officer}`);
    }

    const doc = new Document({
      officer,
      tenTaiLieu,
      loaiTaiLieu,
      ngayCap: ngayCap || undefined,
      fileUrl: `/uploads/documents/${req.file.filename}`,
      nguoiTaiLen: req.session.user._id
    });

    await doc.save();
    req.flash('success', 'Đã tải lên tài liệu thành công');
    res.redirect(`/officers/${officer}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi tải lên tài liệu');
    res.redirect('back');
  }
});

router.delete('/:id', isAuthenticated, isEditorOrAdmin, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      req.flash('error', 'Không tìm thấy tài liệu');
      return res.redirect('back');
    }

    const officerId = doc.officer;
    
    // Delete file from disk
    const filePath = path.join('public', doc.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Document.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa tài liệu');
    res.redirect(`/officers/${officerId}`);
  } catch (err) {
    req.flash('error', 'Lỗi xóa tài liệu');
    res.redirect('back');
  }
});

module.exports = router;
