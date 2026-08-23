const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const Officer = require('../models/Officer');
const Team = require('../models/Team');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const activeCondition = { trangThai: { $nin: ['Đã xuất ngũ', 'Đã nghỉ hưu'] } };

    const [totalOfficers, banChiHuyCount, dangVienCount, daiHocCount] = await Promise.all([
      Officer.countDocuments(activeCondition),
      Officer.countDocuments({ ...activeCondition, chucVu: { $in: ['Trưởng Công an xã', 'Phó Trưởng Công an xã'] } }),
      Officer.countDocuments({ ...activeCondition, dangVien: true }),
      Officer.countDocuments({ ...activeCondition, hocVan: { $in: ['Đại học', 'Thạc sĩ', 'Tiến sĩ'] } })
    ]);

    // 1. Cơ cấu cấp bậc
    const capBacRaw = await Officer.aggregate([
      { $match: activeCondition },
      { $group: { _id: { $ifNull: ['$capBac', 'Chưa có'] }, count: { $sum: 1 } } }
    ]);
    
    // Sắp xếp cấp bậc theo thứ tự
    const ranksOrder = [
      'Đại tướng', 'Thượng tướng', 'Trung tướng', 'Thiếu tướng',
      'Đại tá', 'Thượng tá', 'Trung tá', 'Thiếu tá',
      'Đại úy', 'Thượng úy', 'Trung úy', 'Thiếu úy',
      'Thượng sĩ', 'Trung sĩ', 'Hạ sĩ',
      'Binh nhất', 'Binh nhì', 'Chưa có'
    ];
    capBacRaw.sort((a, b) => ranksOrder.indexOf(a._id) - ranksOrder.indexOf(b._id));
    
    const capBacLabels = capBacRaw.map(x => x._id);
    const capBacData = capBacRaw.map(x => x.count);

    // 2. Phân bổ theo tổ
    const toCongTacRaw = await Officer.aggregate([
      { $match: activeCondition },
      { $group: { _id: '$toCongTac', count: { $sum: 1 } } },
      { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 'team' } },
      { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
      { $project: { _id: { $ifNull: ['$team.ten', 'Chưa phân công'] }, count: 1 } }
    ]);
    const toCongTacLabels = toCongTacRaw.map(x => x._id);
    const toCongTacData = toCongTacRaw.map(x => x.count);

    // 3. Phân bổ độ tuổi
    const officers = await Officer.find(activeCondition, 'ngaySinh');
    const ageGroups = { '<25': 0, '25-30': 0, '31-40': 0, '41-50': 0, '>50': 0 };
    const today = new Date();
    
    officers.forEach(o => {
      if (o.ngaySinh) {
        let age = today.getFullYear() - o.ngaySinh.getFullYear();
        const m = today.getMonth() - o.ngaySinh.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < o.ngaySinh.getDate())) age--;
        
        if (age < 25) ageGroups['<25']++;
        else if (age <= 30) ageGroups['25-30']++;
        else if (age <= 40) ageGroups['31-40']++;
        else if (age <= 50) ageGroups['41-50']++;
        else ageGroups['>50']++;
      }
    });

    // 4. Trình độ học vấn
    const hocVanRaw = await Officer.aggregate([
      { $match: activeCondition },
      { $group: { _id: { $ifNull: ['$hocVan', 'Chưa cập nhật'] }, count: { $sum: 1 } } }
    ]);
    const hocVanLabels = hocVanRaw.map(x => x._id);
    const hocVanData = hocVanRaw.map(x => x.count);

    // 5. Kiểm tra thông tin hồ sơ của cá nhân
    let missingFieldsStatus = null;
    if (req.session.user && req.session.user.officerProfile) {
      const myProfile = await Officer.findById(req.session.user.officerProfile);
      if (myProfile) {
        const fieldsToCheck = [
          'queQuan', 'diaChiThuongTru', 'soCCCD', 'ngayCapCCCD', 'soDienThoai', 'email', 'capBac',
          'chucDanh', 'hocVan', 'chuyenNganh',
          'nghiepVuCA', 'truongDaoTaoCA', 'ngoaiNgu', 'tinHoc', 'lyLuanChinhTri'
        ];
        let missingFieldsCount = 0;
        fieldsToCheck.forEach(f => {
          if (myProfile[f] === undefined || myProfile[f] === null || myProfile[f] === '') {
            missingFieldsCount++;
          }
        });
        if (myProfile.dangVien && !myProfile.ngayVaoDang) missingFieldsCount++;

        missingFieldsStatus = {
          count: missingFieldsCount,
          officerId: myProfile._id
        };
      }
    }

    res.render('dashboard/index', {
      title: 'Dashboard - PMCAX',
      totalOfficers,
      banChiHuyCount,
      dangVienCount,
      daiHocCount,
      charts: {
        capBac: { labels: capBacLabels, data: capBacData },
        toCongTac: { labels: toCongTacLabels, data: toCongTacData },
        doTuoi: { labels: Object.keys(ageGroups), data: Object.values(ageGroups) },
        hocVan: { labels: hocVanLabels, data: hocVanData }
      },
      missingFieldsStatus
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi tải dashboard');
    res.redirect('/login');
  }
});

module.exports = router;
