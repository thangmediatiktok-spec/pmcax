require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Rank = require('../models/Rank');
const Officer = require('../models/Officer');

const ranks = [
  { ten: 'Hạ sĩ', capBac: 'Hạ sĩ quan', thuTu: 1, moTa: 'Cấp bậc hạ sĩ' },
  { ten: 'Trung sĩ', capBac: 'Hạ sĩ quan', thuTu: 2, moTa: 'Cấp bậc trung sĩ' },
  { ten: 'Thượng sĩ', capBac: 'Hạ sĩ quan', thuTu: 3, moTa: 'Cấp bậc thượng sĩ' },
  { ten: 'Thiếu úy', capBac: 'Sĩ quan cấp cơ sở', thuTu: 4, moTa: 'Cấp bậc thiếu úy' },
  { ten: 'Trung úy', capBac: 'Sĩ quan cấp cơ sở', thuTu: 5, moTa: 'Cấp bậc trung úy' },
  { ten: 'Thượng úy', capBac: 'Sĩ quan cấp cơ sở', thuTu: 6, moTa: 'Cấp bậc thượng úy' },
  { ten: 'Đại úy', capBac: 'Sĩ quan cấp cơ sở', thuTu: 7, moTa: 'Cấp bậc đại úy' },
  { ten: 'Thiếu tá', capBac: 'Sĩ quan cấp trung', thuTu: 8, moTa: 'Cấp bậc thiếu tá' },
  { ten: 'Trung tá', capBac: 'Sĩ quan cấp trung', thuTu: 9, moTa: 'Cấp bậc trung tá' },
  { ten: 'Thượng tá', capBac: 'Sĩ quan cấp trung', thuTu: 10, moTa: 'Cấp bậc thượng tá' }
];

const officers = [
  {
    maSo: 'CAX001', hoTen: 'Nguyễn Văn Minh', ngaySinh: new Date('1982-05-12'), gioiTinh: 'Nam',
    queQuan: 'Hà Nội', soDienThoai: '0901234567', chucVu: 'Trưởng Công an xã',
    ngayVaoBieu: new Date('2005-09-01'), ngayNhapNgu: new Date('2003-02-15'), hocVan: 'Đại học',
    chuyenNganh: 'Luật', lyLuanChinhTri: 'Cao cấp', dangVien: true, ngayVaoDang: new Date('2008-06-15'), trangThai: 'Đang công tác'
  },
  {
    maSo: 'CAX002', hoTen: 'Trần Thị Hương', ngaySinh: new Date('1988-11-23'), gioiTinh: 'Nữ',
    queQuan: 'Hải Phòng', soDienThoai: '0912345678', chucVu: 'Phó Trưởng Công an xã',
    ngayVaoBieu: new Date('2010-08-01'), hocVan: 'Đại học', chuyenNganh: 'An ninh',
    lyLuanChinhTri: 'Trung cấp', dangVien: true, ngayVaoDang: new Date('2013-05-20'), trangThai: 'Đang công tác'
  },
  {
    maSo: 'CAX003', hoTen: 'Lê Hoàng Nam', ngaySinh: new Date('1992-03-08'), gioiTinh: 'Nam',
    queQuan: 'Nghệ An', soDienThoai: '0923456789', chucVu: 'Trung đội trưởng',
    ngayNhapNgu: new Date('2012-09-01'), hocVan: 'Cao đẳng', chuyenNganh: 'Nghiệp vụ Công an',
    dangVien: false, trangThai: 'Đang công tác'
  }
];

async function seed() {
  try {
    await connectDB();
    await Rank.deleteMany({});
    await Officer.deleteMany({});
    const insertedRanks = await Rank.insertMany(ranks);
    const rankByName = Object.fromEntries(insertedRanks.map(rank => [rank.ten, rank._id]));
    officers[0].capBac = rankByName['Trung tá'];
    officers[1].capBac = rankByName['Thiếu tá'];
    officers[2].capBac = rankByName['Thượng úy'];
    await Officer.insertMany(officers);

    const admin = await User.findOneAndUpdate(
      { username: 'admin' },
      {
        username: 'admin',
        hoTen: 'Quản trị viên',
        email: 'admin@conganxa.gov.vn',
        role: 'admin',
        trangThai: true
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    admin.password = 'admin123';
    admin.markModified('password');
    await admin.save();

    console.log('Khởi tạo dữ liệu thành công.');
    console.log('Tài khoản: admin / admin123');
    await mongoose.connection.close();
  } catch (error) {
    console.error('Lỗi seed dữ liệu:', error);
    await mongoose.connection.close();
    process.exitCode = 1;
  }
}

seed();
