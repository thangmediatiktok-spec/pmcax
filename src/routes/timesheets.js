const express = require('express');
const router = express.Router();
const Timesheet = require('../models/Timesheet');
const Officer = require('../models/Officer');

const TIMESHEET_CODES = [
  { code: '+', label: 'Làm việc bình thường', requireNote: false },
  { code: 'A', label: 'Làm việc (đảm bảo ăn định lượng)', requireNote: false },
  { code: 'CT-A', label: 'Đi công tác (đảm bảo ăn định lượng)', requireNote: true },
  { code: 'P', label: 'Nghỉ phép', requireNote: false },
  { code: 'NL', label: 'Nghỉ lễ', requireNote: false },
  { code: 'O', label: 'Ốm', requireNote: false },
  { code: 'K', label: 'Nghỉ không lương', requireNote: false }
];

// Check authentication
const isAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  req.flash('error', 'Vui lòng đăng nhập');
  res.redirect('/login');
};

// GET /timesheets/me (Redirect to personal timesheet)
router.get('/me', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    if (!user.officerProfile) {
      req.flash('error', 'Tài khoản chưa được liên kết hồ sơ cán bộ.');
      return res.redirect('/dashboard');
    }
    const now = new Date();
    const targetMonth = parseInt(req.query.month) || (now.getMonth() + 1);
    const targetYear = parseInt(req.query.year) || now.getFullYear();
    return res.redirect(`/timesheets/${targetYear}/${targetMonth}/${user.officerProfile}`);
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
  }
});

// GET /timesheets
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const targetMonth = parseInt(req.query.month) || currentMonth;
    const targetYear = parseInt(req.query.year) || currentYear;

    let query = { month: targetMonth, year: targetYear };
    
    // CBCS only see their own
    if (user.role === 'cbcs') {
      if (!user.officerProfile) {
        req.flash('error', 'Tài khoản chưa được liên kết hồ sơ cán bộ.');
        return res.redirect('/dashboard');
      }
      return res.redirect(`/timesheets/${targetYear}/${targetMonth}/${user.officerProfile}`);
    }

    // Role-based access logic for the list
    let officerQuery = {};
    if (user.role === 'pho_cax') {
      if (!user.officerProfile) {
        req.flash('error', 'Tài khoản chưa liên kết cán bộ.');
        return res.redirect('/dashboard');
      }
      const me = await Officer.findById(user.officerProfile);
      if (me && me.toCongTac) {
        officerQuery.toCongTac = me.toCongTac;
      } else {
        officerQuery._id = me._id;
      }
    }

    const officers = await Officer.find(officerQuery).sort({ hoTen: 1 }).lean();
    const officerIds = officers.map(o => o._id);

    const timesheets = await Timesheet.find({ ...query, officer: { $in: officerIds } }).populate('officer').lean();
    
    const tsMap = {};
    timesheets.forEach(ts => {
      tsMap[ts.officer._id.toString()] = ts;
    });

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    res.render('timesheets/index', {
      title: 'Quản lý bảng chấm công',
      targetMonth,
      targetYear,
      daysInMonth,
      officers,
      tsMap,
      activeMenu: 'timesheets'
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi tải danh sách chấm công');
    res.redirect('/dashboard');
  }
});

// GET /timesheets/adl-summary
router.get('/adl-summary', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === 'cbcs') {
      req.flash('error', 'Chỉ lãnh đạo mới có quyền truy cập');
      return res.redirect('/timesheets');
    }
    
    const now = new Date();
    const targetMonth = parseInt(req.query.month) || (now.getMonth() + 1);
    const targetYear = parseInt(req.query.year) || now.getFullYear();

    let officerQuery = {};
    if (user.role === 'pho_cax') {
      const me = await Officer.findById(user.officerProfile);
      if (me && me.toCongTac) officerQuery.toCongTac = me.toCongTac;
      else officerQuery._id = me._id;
    }

    const officers = await Officer.find(officerQuery).sort({ hoTen: 1 }).lean();
    const officerIds = officers.map(o => o._id);
    
    // Fetch all timesheets for these officers for this month
    const timesheets = await Timesheet.find({ month: targetMonth, year: targetYear, officer: { $in: officerIds } }).lean();
    const tsMap = {};
    timesheets.forEach(ts => tsMap[ts.officer.toString()] = ts);

    // Filter out officers who don't have any A or CT-A records
    const validOfficers = officers.filter(o => {
      const ts = tsMap[o._id.toString()];
      if (!ts || !ts.records) return false;
      return ts.records.some(r => r.code === 'A' || r.code === 'CT-A');
    });

    res.render('timesheets/adl-summary', {
      title: 'Tổng hợp Ăn định lượng',
      activeMenu: 'adl-summary',
      targetMonth,
      targetYear,
      officers: validOfficers,
      tsMap
    });

  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi tải trang tổng hợp ADL');
    res.redirect('/timesheets');
  }
});

// GET /timesheets/:year/:month/:officerId
router.get('/:year/:month/:officerId', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const { year, month, officerId } = req.params;

    // Access control
    let hasAccess = false;
    if (user.role === 'admin' || user.role === 'truong_cax') hasAccess = true;
    else if (String(user.officerProfile) === String(officerId)) hasAccess = true;
    else if (user.role === 'pho_cax') {
      const me = await Officer.findById(user.officerProfile);
      const target = await Officer.findById(officerId);
      if (me && target && String(me.toCongTac) === String(target.toCongTac)) hasAccess = true;
    }

    if (!hasAccess) {
      req.flash('error', 'Bạn không có quyền xem chấm công của cán bộ này');
      return res.redirect('/timesheets');
    }

    const officer = await Officer.findById(officerId).lean();
    if (!officer) {
      req.flash('error', 'Không tìm thấy cán bộ');
      return res.redirect('/timesheets');
    }

    let timesheet = await Timesheet.findOne({ officer: officerId, month, year });
    if (!timesheet) {
      timesheet = new Timesheet({
        officer: officerId,
        month,
        year,
        records: [],
        status: 'draft'
      });
      await timesheet.save();
    }

    const daysInMonth = new Date(year, month, 0).getDate();

    const recordMap = {};
    timesheet.records.forEach(r => {
      recordMap[r.day] = r;
    });

    // Only owner or admin can edit
    const canEdit = String(user.officerProfile) === String(officerId) || user.role === 'admin';

    const activeMenu = String(user.officerProfile) === String(officerId) ? 'my_timesheet' : 'timesheets';

    const User = require('../models/User');
    const signers = await User.find({ role: { $in: ['truong_cax', 'pho_cax'] } }).populate('officerProfile').lean();

    res.render('timesheets/show', {
      title: `Chấm công: ${officer.hoTen} - ${month}/${year}`,
      officer,
      timesheet,
      year: parseInt(year),
      month: parseInt(month),
      daysInMonth,
      recordMap,
      TIMESHEET_CODES,
      canEdit,
      activeMenu,
      signers
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi tải bảng chấm công');
    res.redirect('/timesheets');
  }
});

// POST /timesheets/:id
router.post('/:id', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const timesheet = await Timesheet.findById(req.params.id).populate('officer');
    
    if (!timesheet) {
      req.flash('error', 'Không tìm thấy bảng chấm công');
      return res.redirect('back');
    }

    const isOwner = String(user.officerProfile) === String(timesheet.officer._id);
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      req.flash('error', 'Bạn không có quyền cập nhật bảng chấm công này');
      return res.redirect('back');
    }

    const records = [];
    const daysInMonth = new Date(timesheet.year, timesheet.month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const code = req.body.code && req.body.code[day];
      const note = req.body.note && req.body.note[day];
      
      if (code) {
        const codeConfig = TIMESHEET_CODES.find(c => c.code === code);
        if (codeConfig && codeConfig.requireNote && (!note || note.trim() === '')) {
          req.flash('error', `Ngày ${day}: Mã '${code}' yêu cầu phải nhập ghi chú.`);
          return res.redirect('back');
        }
        
        records.push({
          day,
          code,
          note: note ? note.trim() : ''
        });
      }
    }

    timesheet.records = records;
    await timesheet.save();
    
    req.flash('success', 'Đã lưu bảng chấm công thành công');
    res.redirect(`/timesheets/${timesheet.year}/${timesheet.month}/${timesheet.officer._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi lưu bảng chấm công');
    res.redirect('back');
  }
});

// GET /timesheets/:id/print-ctp
router.get('/:id/print-ctp', isAuthenticated, async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id).populate('officer');
    if (!timesheet) return res.status(404).send('Không tìm thấy bảng chấm công');

    const officer = timesheet.officer;
    const { signerId, purpose } = req.query;

    const User = require('../models/User'); // Import dynamically or at top
    
    let bRank = '', bName = '', roleTitle = 'Lãnh đạo', signerRole = 'pho_cax';
    if (signerId) {
      const signerUser = await User.findById(signerId).populate('officerProfile');
      if (signerUser) {
        signerRole = signerUser.role;
        roleTitle = signerUser.role === 'truong_cax' ? 'Trưởng Công an xã' : 'Phó Trưởng Công an xã';
        if (signerUser.officerProfile) {
          bRank = signerUser.officerProfile.capBac || '';
          bName = signerUser.officerProfile.hoTen || '';
        } else {
          bRank = 'Đồng chí';
          bName = signerUser.username;
        }
      }
    }

    // Gộp các ngày đi công tác
    // CT-A là mã đi công tác
    const ctRecords = timesheet.records.filter(r => r.code === 'CT-A').sort((a,b) => a.day - b.day);
    
    const plans = [];
    if (ctRecords.length > 0) {
      let currentPlan = { start: ctRecords[0].day, end: ctRecords[0].day, loc: ctRecords[0].note };
      
      for (let i = 1; i < ctRecords.length; i++) {
        const r = ctRecords[i];
        if (r.day === currentPlan.end + 1 && r.note === currentPlan.loc) {
          currentPlan.end = r.day;
        } else {
          plans.push(currentPlan);
          currentPlan = { start: r.day, end: r.day, loc: r.note };
        }
      }
      plans.push(currentPlan);
    }

    res.render('timesheets/print-ctp', {
      layout: false, // Don't use standard layout
      officer,
      timesheet,
      plans,
      bRank,
      bName,
      signerRole,
      purpose: purpose || 'Xác minh'
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi máy chủ');
  }
});

// GET /timesheets/:id/adl-preview
router.get('/:id/adl-preview', isAuthenticated, async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id).populate('officer');
    if (!timesheet) return res.status(404).send('Không tìm thấy bảng chấm công');

    const officer = timesheet.officer;
    
    // Chỉ lấy các ngày A hoặc CT-A
    const adlRecords = timesheet.records.filter(r => r.code === 'A' || r.code === 'CT-A').sort((a,b) => a.day - b.day);
    
    // Fetch ADL Tasks for this officer's team
    const AdlTask = require('../models/AdlTask');
    const teamTasks = await AdlTask.find({ team: officer.toCongTac });

    // Seed logic for deterministic random
    function seededRand(seed) {
        let x = Math.sin(seed + 1) * 10000;
        return x - Math.floor(x);
    }

    // Auto-fill adlPlan and adlResult if empty
    adlRecords.forEach(r => {
      const isManual = r.adlPlan || r.adlResult;
      r.isManual = !!isManual;
      
      if (!isManual) {
        if (r.code === 'A') {
          if (teamTasks.length > 0) {
            const idx = Math.floor(seededRand(r.day) * teamTasks.length);
            r.adlPlan = teamTasks[idx].plan;
            r.adlResult = teamTasks[idx].result;
          } else {
            r.adlPlan = ''; // Để trống cho người dùng gõ
            r.adlResult = '';
          }
        } else if (r.code === 'CT-A') {
          r.adlPlan = `Đi công tác tại ${r.note || 'địa bàn'}`;
          r.adlResult = `Từ 07h30 đến 17h30 công tác tại ${r.note || 'địa bàn'} để xác minh đối tượng`;
        }
      }
    });

    res.render('timesheets/adl-preview', {
      layout: req.query.layout !== 'false',
      title: 'Bảng Ăn định lượng',
      activeMenu: 'timesheets',
      officer,
      timesheet,
      adlRecords,
      hasTasks: teamTasks.length > 0,
      teamTasksJson: JSON.stringify(teamTasks)
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi tải trang ADL');
    res.redirect('back');
  }
});

// GET /timesheets/:id/adl-view (Read-only view for Leaders)
router.get('/:id/adl-view', isAuthenticated, async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id).populate('officer');
    if (!timesheet) {
      req.flash('error', 'Không tìm thấy bảng chấm công.');
      return res.redirect('back');
    }

    const officer = timesheet.officer;
    // Filter records for ADL: 'A' and 'CT-A'
    const adlRecords = timesheet.records
      .filter(r => r.code === 'A' || r.code === 'CT-A')
      .sort((a, b) => a.day - b.day);

    res.render('timesheets/adl-view', {
      layout: req.query.layout !== 'false',
      title: 'Xem Bảng Ăn định lượng',
      activeMenu: 'timesheets',
      officer,
      timesheet,
      adlRecords
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Lỗi khi tải bảng ADL.');
    res.redirect('back');
  }
});

// POST /timesheets/:id/adl-update
router.post('/:id/adl-update', isAuthenticated, async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) return res.status(404).send('Không tìm thấy bảng chấm công');

    const updates = req.body; // { plan_12: '...', result_12: '...' }
    
    timesheet.records.forEach(r => {
      if (updates[`plan_${r.day}`] !== undefined) {
        r.adlPlan = updates[`plan_${r.day}`];
      }
      if (updates[`result_${r.day}`] !== undefined) {
        r.adlResult = updates[`result_${r.day}`];
      }
    });

    await timesheet.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
