const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated, isEditorOrAdmin } = require('../middleware/auth');
const xlsx = require('xlsx');
const Officer = require('../models/Officer');
const Team = require('../models/Team');
const Document = require('../models/Document');

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

const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') return cb(null, false);
    cb(null, true);
  }
});

function parseDateStr(str) {
  if (!str) return null;
  const parts = String(str).split('/');
  if (parts.length === 3) {
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  if (!isNaN(str)) {
    const d = new Date(Math.round((str - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return d;
  }
  return null;
}

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    
    // CBCS shouldn't see the list, redirect to their profile
    if (user.role === 'cbcs') {
      if (!user.officerProfile) return res.redirect('/onboarding');
      return res.redirect(`/officers/${user.officerProfile}`);
    }

    const { search, chucVu, capBac, toCongTac, dangVien, page = 1 } = req.query;
    const limit = 10;
    const query = {};

    // Pho CAX can only see their team
    if (user.role === 'pho_cax' && user.officerProfile) {
      const phoCaxProfile = await Officer.findById(user.officerProfile);
      if (phoCaxProfile) {
        query.toCongTac = phoCaxProfile.toCongTac;
      }
    } else if (toCongTac) {
      query.toCongTac = toCongTac; // Only apply filter if admin/truong_cax
    }

    if (search) query.$or = [
      { hoTen: { $regex: search, $options: 'i' } },
      { maSo: { $regex: search, $options: 'i' } },
      { soDienThoai: { $regex: search, $options: 'i' } }
    ];
    if (chucVu) query.chucVu = chucVu;
    if (capBac) query.capBac = capBac;
    if (dangVien === 'true') query.dangVien = true;
    if (dangVien === 'false') query.dangVien = false;

    const total = await Officer.countDocuments(query);
    
    let officers = await Officer.aggregate([
      { $match: query },
      { $addFields: {
          order: {
            $switch: {
              branches: [
                { case: { $eq: ["$chucVu", "Trưởng Công an xã"] }, then: 1 },
                { case: { $eq: ["$chucVu", "Phó Trưởng Công an xã"] }, then: 2 },
                { case: { $eq: ["$chucVu", "Cán bộ"] }, then: 3 }
              ],
              default: 4
            }
          }
        }
      },
      { $sort: { order: 1, hoTen: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]);
    
    officers = await Officer.populate(officers, { path: 'toCongTac' });

    const ranks = Officer.schema.path('capBac').enumValues;
    const teams = await Team.find({ trangThai: true }).sort({ thuTu: 1 });

    res.render('officers/index', {
      title: 'Danh sách cán bộ chiến sĩ',
      officers,
      ranks,
      teams,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      query: req.query
    });
  } catch (err) {
    req.flash('error', 'Lỗi tải danh sách');
    res.redirect('/dashboard');
  }
});

router.get('/template', isAuthenticated, isEditorOrAdmin, (req, res) => {
  const wb = xlsx.utils.book_new();
  const wsData = [
    ['Số hiệu CAND (*)', 'Họ và tên (*)', 'Ngày sinh (DD/MM/YYYY) (*)', 'Giới tính (Nam/Nữ) (*)', 'Số CCCD', 'Ngày cấp CCCD (DD/MM/YYYY)', 'Số điện thoại', 'Quê quán', 'Địa chỉ thường trú', 'Email', 'Chức vụ (*)', 'Cấp bậc', 'Tổ công tác (*)', 'Đơn vị công tác', 'Ngày nhập ngũ (DD/MM/YYYY) (*)', 'Đảng viên (Có/Không)', 'Ngày vào Đảng (DD/MM/YYYY)', 'Học vấn', 'Chuyên ngành', 'Lý luận chính trị', 'Nghiệp vụ CA', 'Trường đào tạo CA', 'Ngoại ngữ', 'Tin học'],
    ['123-456', 'Nguyễn Văn A', '01/01/1990', 'Nam', '001090123456', '01/01/2021', '0987654321', 'Hà Nội', 'Xã X, Huyện Y, Hà Nội', 'a@example.com', 'Cán bộ', 'Đại úy', 'Tổ Cảnh sát khu vực', 'Công an xã', '01/01/2010', 'Có', '01/01/2015', 'Đại học', 'Luật', 'Trung cấp', 'Đại học - Luật', 'Đại học CSND', 'B1', 'Ứng dụng CNTT cơ bản']
  ];
  const ws = xlsx.utils.aoa_to_sheet(wsData);
  
  const wscols = [
    {wch: 15}, {wch: 20}, {wch: 22}, {wch: 20}, {wch: 15}, {wch: 22},
    {wch: 15}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 15}, {wch: 15},
    {wch: 20}, {wch: 15}, {wch: 22}, {wch: 20}, {wch: 22}, {wch: 15},
    {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 15}
  ];
  ws['!cols'] = wscols;

  xlsx.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Can_Bo');
  
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="Mau_Nhap_Can_Bo.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

router.post('/import', isAuthenticated, isEditorOrAdmin, excelUpload.single('file'), async (req, res) => {
  if (!req.file) {
    req.flash('error', 'Vui lòng chọn file Excel hợp lệ');
    return res.redirect('/officers');
  }

  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    if (data.length <= 1) {
      req.flash('error', 'File không có dữ liệu');
      return res.redirect('/officers');
    }

    const rows = data.slice(1);
    
    const teams = await Team.find();
    const teamMap = {};
    teams.forEach(t => teamMap[t.ten.toLowerCase()] = t._id);

    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      // Bỏ qua dòng trống hoàn toàn
      if (!row || row.length === 0 || (!row[0] && !row[1])) continue;

      if (!row[0] || !row[1] || !row[2] || !row[3] || !row[10] || !row[12] || !row[14]) {
        console.log(`Lỗi thiếu trường bắt buộc ở dòng có dữ liệu:`, row);
        errorCount++;
        continue;
      }

      const maSo = String(row[0]).trim();
      
      const exists = await Officer.findOne({ maSo });
      if (exists) {
        console.log(`Lỗi trùng lặp mã số: ${maSo}`);
        errorCount++;
        continue;
      }

      const teamName = String(row[12]).normalize('NFC').trim().toLowerCase();
      const toCongTac = teamMap[teamName];
      if (!toCongTac) {
        console.log(`Lỗi không tìm thấy tổ công tác: ${teamName}`);
        errorCount++;
        continue;
      }

      const officerData = {
        maSo,
        hoTen: String(row[1]).normalize('NFC').trim(),
        ngaySinh: parseDateStr(row[2]),
        gioiTinh: String(row[3]).normalize('NFC').trim(),
        soCCCD: row[4] ? String(row[4]).trim() : undefined,
        ngayCapCCCD: parseDateStr(row[5]),
        soDienThoai: row[6] ? String(row[6]).trim() : undefined,
        queQuan: row[7] ? String(row[7]).normalize('NFC').trim() : undefined,
        diaChiThuongTru: row[8] ? String(row[8]).normalize('NFC').trim() : undefined,
        email: row[9] ? String(row[9]).trim() : undefined,
        chucVu: String(row[10]).normalize('NFC').trim(),
        capBac: row[11] ? String(row[11]).normalize('NFC').trim() : undefined,
        toCongTac,
        donViCongTac: row[13] ? String(row[13]).normalize('NFC').trim() : 'Công an xã',
        ngayNhapNgu: parseDateStr(row[14]),
        dangVien: row[15] && String(row[15]).normalize('NFC').trim().toLowerCase() === 'có',
        ngayVaoDang: parseDateStr(row[16]),
        hocVan: row[17] ? String(row[17]).normalize('NFC').trim() : undefined,
        chuyenNganh: row[18] ? String(row[18]).normalize('NFC').trim() : undefined,
        lyLuanChinhTri: row[19] ? String(row[19]).normalize('NFC').trim() : undefined,
        nghiepVuCA: row[20] ? String(row[20]).normalize('NFC').trim() : undefined,
        truongDaoTaoCA: row[21] ? String(row[21]).normalize('NFC').trim() : undefined,
        ngoaiNgu: row[22] ? String(row[22]).normalize('NFC').trim() : undefined,
        tinHoc: row[23] ? String(row[23]).normalize('NFC').trim() : undefined
      };

      try {
        await Officer.create(officerData);
        successCount++;
      } catch (err) {
        console.error(`Lỗi tạo cán bộ ${maSo}:`, err.message);
        errorCount++;
      }
    }

    req.flash('success', `Đã nhập thành công ${successCount} cán bộ, bỏ qua ${errorCount} dòng lỗi hoặc trùng lặp.`);
    res.redirect('/officers');
  } catch (err) {
    req.flash('error', 'Lỗi xử lý file Excel');
    res.redirect('/officers');
  }
});

router.get('/create', isAuthenticated, isEditorOrAdmin, async (req, res) => {
  const ranks = Officer.schema.path('capBac').enumValues;
  const teams = await Team.find({ trangThai: true }).sort({ thuTu: 1 });
  res.render('officers/create', { title: 'Thêm cán bộ mới', ranks, teams });
});

router.post('/', isAuthenticated, isEditorOrAdmin, upload.single('anhDaiDien'), async (req, res) => {
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

    await Officer.create(data);
    req.flash('success', 'Thêm cán bộ thành công');
    res.redirect('/officers');
  } catch (err) {
    req.flash('error', err.code === 11000 ? 'Mã số đã tồn tại' : 'Lỗi thêm cán bộ');
    res.redirect('/officers/create');
  }
});

router.get('/export/excel', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const query = {};

    if (user.role === 'cbcs') {
      if (!user.officerProfile) {
        req.flash('error', 'Bạn chưa có hồ sơ cán bộ.');
        return res.redirect('/');
      }
      query._id = user.officerProfile;
    } else if (user.role === 'pho_cax' && user.officerProfile) {
      const phoCaxProfile = await Officer.findById(user.officerProfile);
      if (phoCaxProfile && phoCaxProfile.toCongTac) {
        query.toCongTac = phoCaxProfile.toCongTac;
      } else {
        query._id = user.officerProfile; // Fallback
      }
    }

    const officers = await Officer.find(query)
      .populate('toCongTac')
      .sort({ chucVu: -1, hoTen: 1 }); // Basic sort

    const data = officers.map((o, i) => ({
      'STT': i + 1,
      'Số hiệu CAND': o.maSo || '',
      'Họ và tên': o.hoTen || '',
      'Ngày sinh': o.ngaySinh ? new Date(o.ngaySinh).toLocaleDateString('vi-VN') : '',
      'Giới tính': o.gioiTinh || '',
      'Số CCCD': o.soCCCD || '',
      'Ngày cấp CCCD': o.ngayCapCCCD ? new Date(o.ngayCapCCCD).toLocaleDateString('vi-VN') : '',
      'Số điện thoại': o.soDienThoai || '',
      'Email': o.email || '',
      'Quê quán': o.queQuan || '',
      'Địa chỉ thường trú': o.diaChiThuongTru || '',
      'Chức vụ': o.chucVu || '',
      'Cấp bậc': o.capBac || '',
      'Tổ công tác': o.toCongTac ? o.toCongTac.ten : '',
      'Ngày nhập ngũ': o.ngayNhapNgu ? new Date(o.ngayNhapNgu).toLocaleDateString('vi-VN') : '',
      'Đảng viên': o.dangVien ? 'Có' : 'Không',
      'Ngày vào Đảng': o.ngayVaoDang ? new Date(o.ngayVaoDang).toLocaleDateString('vi-VN') : '',
      'Học vấn': o.hocVan || '',
      'Chuyên ngành': o.chuyenNganh || '',
      'Lý luận chính trị': o.lyLuanChinhTri || '',
      'Nghiệp vụ CA': o.nghiepVuCA || '',
      'Trường đào tạo CA': o.truongDaoTaoCA || '',
      'Ngoại ngữ': o.ngoaiNgu || '',
      'Tin học': o.tinHoc || ''
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    // Auto-fit columns
    const wscols = Object.keys(data[0] || {}).map(() => ({ wch: 18 }));
    ws['!cols'] = wscols;

    xlsx.utils.book_append_sheet(wb, ws, 'DanhSach_CBCS');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    const fileName = `DanhSach_CBCS_${Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Export Excel Error:', err);
    req.flash('error', 'Lỗi xuất file Excel.');
    res.redirect('back');
  }
});

router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const officer = await Officer.findById(req.params.id).populate('toCongTac');
    if (!officer) { req.flash('error', 'Không tìm thấy cán bộ'); return res.redirect('/officers'); }
    
    // RBAC Check
    const user = req.session.user;
    let canEdit = false;
    if (user.role === 'admin' || user.role === 'truong_cax') {
      canEdit = true;
    } else if (user.role === 'cbcs' && String(user.officerProfile) === String(officer._id)) {
      canEdit = true;
    } else if (user.role === 'pho_cax' && user.officerProfile) {
      const phoCax = await Officer.findById(user.officerProfile);
      if (phoCax && phoCax.toCongTac && officer.toCongTac && phoCax.toCongTac.toString() === officer.toCongTac._id.toString()) {
        canEdit = true;
      }
    }

    if (!canEdit && user.role === 'cbcs') {
      req.flash('error', 'Bạn không có quyền xem hồ sơ này');
      return res.redirect('/dashboard');
    }
    
    const strUser = String(user.officerProfile);
    const strOfficer = String(officer._id);
    const activeMenu = strUser === strOfficer ? 'personal_profile' : 'officers';
    
    console.log(`[DEBUG GET /:id] user.officerProfile=${user.officerProfile}, type=${typeof user.officerProfile}`);
    console.log(`[DEBUG GET /:id] officer._id=${officer._id}, type=${typeof officer._id}`);
    console.log(`[DEBUG GET /:id] strUser=${strUser}, strOfficer=${strOfficer}, match=${strUser === strOfficer}, activeMenu=${activeMenu}`);
    
    res.render('officers/show', { title: officer.hoTen, officer, canEdit, activeMenu });
  } catch (err) {
    console.error(err);
    res.redirect('/officers');
  }
});

router.get('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const [officer, teams] = await Promise.all([
      Officer.findById(req.params.id).populate('toCongTac'),
      Team.find({ trangThai: true }).sort({ thuTu: 1 })
    ]);
    if (!officer) { req.flash('error', 'Không tìm thấy cán bộ'); return res.redirect('/officers'); }

    // RBAC Check
    const user = req.session.user;
    let canEdit = false;
    if (user.role === 'admin' || user.role === 'truong_cax') canEdit = true;
    else if (user.role === 'cbcs' && String(user.officerProfile) === String(officer._id)) canEdit = true;
    else if (user.role === 'pho_cax' && user.officerProfile) {
      const phoCax = await Officer.findById(user.officerProfile);
      if (phoCax && phoCax.toCongTac && officer.toCongTac && phoCax.toCongTac.toString() === officer.toCongTac._id.toString()) canEdit = true;
    }

    if (!canEdit) {
      req.flash('error', 'Bạn không có quyền chỉnh sửa hồ sơ này');
      return res.redirect(`/officers/${officer._id}`);
    }

    const ranks = Officer.schema.path('capBac').enumValues;
    const activeMenu = String(user.officerProfile) === String(officer._id) ? 'personal_profile' : 'officers';
    res.render('officers/edit', { title: 'Chỉnh sửa cán bộ', officer, ranks, teams, activeMenu });
  } catch {
    res.redirect('/officers');
  }
});

router.get('/:id/documents', isAuthenticated, async (req, res) => {
  try {
    const officer = await Officer.findById(req.params.id).populate('toCongTac');
    if (!officer) { req.flash('error', 'Không tìm thấy cán bộ'); return res.redirect('/officers'); }
    
    // RBAC Check
    const user = req.session.user;
    let canEdit = false;
    if (user.role === 'admin' || user.role === 'truong_cax') {
      canEdit = true;
    } else if (user.role === 'cbcs' && String(user.officerProfile) === String(officer._id)) {
      canEdit = true;
    } else if (user.role === 'pho_cax' && user.officerProfile) {
      const phoCax = await Officer.findById(user.officerProfile);
      if (phoCax && phoCax.toCongTac && officer.toCongTac && phoCax.toCongTac.toString() === officer.toCongTac._id.toString()) {
        canEdit = true;
      }
    }

    if (!canEdit && user.role === 'cbcs') {
      req.flash('error', 'Bạn không có quyền xem tài liệu này');
      return res.redirect('/dashboard');
    }

    const documents = await Document.find({ officer: officer._id }).populate('nguoiTaiLen', 'hoTen').sort({ createdAt: -1 });
    const activeMenu = String(user.officerProfile) === String(officer._id) ? 'personal_documents' : 'officers';
    
    res.render('officers/documents', { title: `Tài liệu: ${officer.hoTen}`, officer, documents, canEdit, activeMenu });
  } catch (err) {
    console.error(err);
    res.redirect('/officers');
  }
});

router.put('/:id', isAuthenticated, upload.single('anhDaiDien'), async (req, res) => {
  try {
    const officer = await Officer.findById(req.params.id);
    if (!officer) return res.redirect('/officers');

    // RBAC Check
    const user = req.session.user;
    let canEdit = false;
    if (user.role === 'admin' || user.role === 'truong_cax') canEdit = true;
    else if (user.role === 'cbcs' && String(user.officerProfile) === String(officer._id)) canEdit = true;
    else if (user.role === 'pho_cax' && user.officerProfile) {
      const phoCax = await Officer.findById(user.officerProfile);
      if (phoCax && phoCax.toCongTac && officer.toCongTac && phoCax.toCongTac.toString() === officer.toCongTac.toString()) canEdit = true;
    }

    if (!canEdit) {
      req.flash('error', 'Bạn không có quyền cập nhật hồ sơ này');
      return res.redirect(`/officers/${officer._id}`);
    }

    const data = { ...req.body };
    if (req.file) data.anhDaiDien = `/uploads/officers/${req.file.filename}`;
    data.dangVien = data.dangVien === 'true';
    if (!data.capBac) delete data.capBac;
    if (!data.ngayVaoDang) delete data.ngayVaoDang;
    if (!data.ngayNhapNgu) delete data.ngayNhapNgu;
    if (!data.ngayCapCCCD) delete data.ngayCapCCCD;
    if (!data.ngayNhanCapBac) delete data.ngayNhanCapBac;
    if (!data.thoiHanTangCap) delete data.thoiHanTangCap;

    // Prevent changing Role-based critical fields unless Admin/Truong_CAX
    if (user.role !== 'admin' && user.role !== 'truong_cax') {
       delete data.maSo;
       delete data.hoTen;
       delete data.ngaySinh;
       delete data.gioiTinh;
       delete data.chucVu;
       delete data.ngayNhapNgu;
       delete data.toCongTac;
    }

    await Officer.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    req.flash('success', 'Cập nhật thành công');
    res.redirect(`/officers/${req.params.id}`);
  } catch (err) {
    console.error("Lỗi cập nhật PUT /officers/:id :", err);
    req.flash('error', 'Lỗi cập nhật: ' + err.message);
    res.redirect(`/officers/${req.params.id}/edit`);
  }
});

router.delete('/:id', isAuthenticated, isEditorOrAdmin, async (req, res) => {
  try {
    const officer = await Officer.findById(req.params.id);
    if (officer?.anhDaiDien) {
      const filePath = path.join('public', officer.anhDaiDien);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await Officer.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa cán bộ');
  } catch {
    req.flash('error', 'Lỗi xóa cán bộ');
  }
  res.redirect('/officers');
});

module.exports = router;
