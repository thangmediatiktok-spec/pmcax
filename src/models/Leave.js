const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  officer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    required: true
  },
  nam: {
    type: Number,
    required: true,
    default: () => new Date().getFullYear()
  },
  tuNgay: {
    type: Date,
    required: true
  },
  denNgay: {
    type: Date,
    required: true
  },
  soNgayNghi: {
    type: Number,
    required: true,
    min: 0.5
  },
  lyDo: {
    type: String,
    required: true,
    trim: true
  },
  loaiPhep: {
    type: String,
    enum: ['Phép năm', 'Nghỉ bù', 'Việc riêng', 'Ốm đau', 'Thai sản', 'Khác'],
    default: 'Phép năm'
  },
  trangThai: {
    type: String,
    enum: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'],
    default: 'Chờ duyệt'
  },
  nguoiDuyet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
