const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Kết nối MongoDB thành công');
    
    // Seed admin if missing
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const admin = new User({
        username: 'admin',
        password: 'admin',
        hoTen: 'Quản trị viên Hệ thống',
        role: 'admin'
      });
      await admin.save();
      console.log('Đã tạo tài khoản admin mặc định (admin/admin)');
    }
  } catch (err) {
    console.error('Lỗi kết nối MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
