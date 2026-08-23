const mongoose = require('mongoose');

const officerSchema = new mongoose.Schema({
  maSo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\d{3}-\d{3}$/, 'Số hiệu CAND phải có dạng xxx-xxx']
  },
  hoTen: { type: String, required: true, trim: true },
  ngaySinh: { type: Date, required: true },
  gioiTinh: { type: String, enum: ['Nam', 'Nữ'], required: true },
  queQuan: { type: String, trim: true },
  diaChiThuongTru: { type: String, trim: true },
  soCCCD: { type: String, trim: true },
  ngayCapCCCD: { type: Date },
  soDienThoai: { type: String, trim: true },
  email: { type: String, trim: true },
  capBac: {
    type: String,
    enum: [
      'Đại tướng', 'Thượng tướng', 'Trung tướng', 'Thiếu tướng',
      'Đại tá', 'Thượng tá', 'Trung tá', 'Thiếu tá',
      'Đại úy', 'Thượng úy', 'Trung úy', 'Thiếu úy',
      'Thượng sĩ', 'Trung sĩ', 'Hạ sĩ',
      'Binh nhất', 'Binh nhì'
    ]
  },
  chucVu: {
    type: String,
    enum: [
      'Trưởng Công an xã',
      'Phó Trưởng Công an xã',
      'Cán bộ'
    ],
    required: true
  },
  toCongTac: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  donViCongTac: { type: String, default: 'Công an xã' },
  ngayNhapNgu: { type: Date, required: true },
  ngayNhanCapBac: { type: Date },
  thoiHanTangCap: { type: Date },
  chucDanh: { type: String, trim: true },
  quaTrinhCongTac: { type: String, trim: true },
  hocVan: {
    type: String,
    enum: ['Tiểu học', 'THCS', 'THPT', 'Trung cấp', 'Cao đẳng', 'Đại học', 'Thạc sĩ', 'Tiến sĩ']
  },
  chuyenNganh: { type: String, trim: true },
  nghiepVuCA: { type: String, trim: true },
  truongDaoTaoCA: { type: String, trim: true },
  ngoaiNgu: { type: String, trim: true },
  tinHoc: { type: String, trim: true },
  lyLuanChinhTri: {
    type: String,
    enum: ['Sơ cấp', 'Trung cấp', 'Cao cấp', 'Cử nhân']
  },
  dangVien: { type: Boolean, default: false },
  ngayVaoDang: { type: Date },
  khenThuong: [{ type: String }],
  kyLuat: [{ type: String }],
  anhDaiDien: { type: String, default: null },
  trangThai: {
    type: String,
    enum: ['Đang công tác', 'Nghỉ phép', 'Công tác xa', 'Đã xuất ngũ', 'Đã nghỉ hưu'],
    default: 'Đang công tác'
  },
  ghiChu: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

officerSchema.virtual('tuoi').get(function() {
  if (!this.ngaySinh) return null;
  const today = new Date();
  const birth = new Date(this.ngaySinh);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

officerSchema.set('toJSON', { virtuals: true });
officerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Officer', officerSchema);
