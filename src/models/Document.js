const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  officer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    required: true
  },
  tenTaiLieu: {
    type: String,
    required: true,
    trim: true
  },
  loaiTaiLieu: {
    type: String,
    enum: ['Quyết định', 'Bằng cấp/Chứng chỉ', 'Căn cước công dân', 'Hồ sơ lý lịch', 'Khác'],
    required: true
  },
  fileUrls: {
    type: [String],
    required: true
  },
  ngayCap: {
    type: Date
  },
  nguoiTaiLen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Trường nguồn: ghi nhận tài liệu upload nhanh từ trường nào trong form chỉnh sửa
  // VD: 'ngayNhanCapBac', 'dangVien', 'hocVan', 'lyLuanChinhTri', 'tinHoc', 'ngoaiNgu', 'chucDanh', 'ngayNhapNgu'
  nguonTruong: {
    type: String,
    trim: true
  }

}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
