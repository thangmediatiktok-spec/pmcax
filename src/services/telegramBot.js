const TelegramBot = require('node-telegram-bot-api');
const TelegramCommand = require('../models/TelegramCommand');
const WorkTask = require('../models/WorkTask');
const Officer = require('../models/Officer');
const Leave = require('../models/Leave');
const Roster = require('../models/Roster');
const moment = require('moment-timezone');
const cron = require('node-cron');
const cronJobs = require('./cronJobs'); // Để dùng lại logic gửi tin nếu cần

const Setting = require('../models/Setting');

let bot = null;

const initTelegramBot = async () => {
  const tokenSetting = await Setting.findOne({ key: 'TELEGRAM_BOT_TOKEN' });
  const token = (tokenSetting && tokenSetting.value) ? tokenSetting.value : process.env.TELEGRAM_BOT_TOKEN;
  
  if (bot) {
    try {
      await bot.stopPolling();
    } catch (e) {
      console.error('Lỗi khi stop polling bot cũ:', e);
    }
    bot = null;
  }
  
  if (!token) {
    console.log('Chưa cấu hình TELEGRAM_BOT_TOKEN. Bỏ qua khởi tạo Bot 2 chiều.');
    return;
  }

  // Khởi tạo bot với chế độ polling
  bot = new TelegramBot(token, { polling: true });
  console.log('Khởi tạo Telegram Bot (Polling) thành công!');

  // Lắng nghe sự kiện nhắn tin
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    // Nếu không phải là lệnh (bắt đầu bằng /), bỏ qua
    if (!text.startsWith('/')) return;

    // Phân tích lệnh
    // Lệnh có thể ở dạng /viewcv, /viewcv+duong, /viewcv duong
    // Lấy phần lệnh chính và tham số
    let fullCommand = text.split(' ')[0].split('@')[0]; // bỏ @botname nếu có
    let param = '';
    
    // Xử lý dấu + hoặc khoảng trắng
    if (fullCommand.includes('+')) {
      const parts = fullCommand.split('+');
      fullCommand = parts[0];
      param = parts[1];
    } else {
      const parts = text.split(' ');
      if (parts.length > 1) {
        param = parts[1];
      }
    }

    const commandName = fullCommand.substring(1).toLowerCase(); // bỏ dấu /

    try {
      // 1. Kiểm tra lệnh trong Database
      const cmdRecord = await TelegramCommand.findOne({ command: commandName, isActive: true });
      
      if (!cmdRecord) {
        // Có thể là lệnh mặc định (ví dụ: start)
        if (commandName === 'start') {
          bot.sendMessage(chatId, `Chào mừng bạn! Tôi là Bot Trợ Lý CAX.\nHãy cấu hình tôi vào nhóm và sử dụng lệnh đã cài đặt.`);
        }
        return;
      }

      // 2. Xử lý lệnh tĩnh (Static)
      if (cmdRecord.type === 'static') {
        try {
          await bot.sendMessage(chatId, cmdRecord.staticText, { parse_mode: 'HTML' });
        } catch (sendErr) {
          // Fallback nếu người dùng gõ sai thẻ HTML
          await bot.sendMessage(chatId, cmdRecord.staticText);
        }
        return;
      }

      // 3. Xử lý lệnh động (Dynamic)
      if (cmdRecord.type === 'dynamic') {
        switch (commandName) {
          case 'viewcv':
            await handleViewCv(chatId, param);
            break;
          case 'lichtruc':
            await handleLichTruc(chatId, param);
            break;
          case 'nghiphep':
            await handleNghiPhep(chatId, param);
            break;
          case 'danhba':
            await handleDanhBa(chatId, param);
            break;
          case 'thongke':
            await handleThongKe(chatId);
            break;
          case 'hdsd':
            await handleHdsd(chatId);
            break;
          default:
            try { await bot.sendMessage(chatId, `Lệnh hệ thống chưa được hỗ trợ.`); } catch (e) {}
        }
      }

    } catch (err) {
      console.error('Lỗi khi xử lý lệnh Telegram:', err);
      try { await bot.sendMessage(chatId, `❌ Lỗi khi xử lý lệnh: ${err.message}`); } catch (e) {}
    }
  });

  bot.on("polling_error", (msg) => console.log('Telegram Polling Error:', msg));

  if (global.telegramCronJob) {
    global.telegramCronJob.stop();
  }

  // Thiết lập CronJob tự động chạy các lệnh đã lên lịch
  global.telegramCronJob = cron.schedule('* * * * *', async () => {
    const chatSetting = await Setting.findOne({ key: 'TELEGRAM_CHAT_ID' });
    const groupChatId = (chatSetting && chatSetting.value) ? chatSetting.value : process.env.TELEGRAM_CHAT_ID;
    if (!groupChatId) return;

    // Lấy giờ hiện tại theo định dạng HH:mm ở múi giờ VN
    const nowHHMM = moment().tz('Asia/Ho_Chi_Minh').format('HH:mm');
    
    try {
      // Tìm tất cả các lệnh có cài đặt giờ
      const cmdsWithSchedule = await TelegramCommand.find({ 
        scheduleTime: { $ne: '' }, 
        isActive: true 
      });

      for (const cmdRecord of cmdsWithSchedule) {
        // Tách chuỗi giờ thành mảng (hỗ trợ nhiều giờ, ví dụ: "07:30, 17:00")
        const times = cmdRecord.scheduleTime.split(',').map(t => t.trim());
        
        // Nếu giờ hiện tại nằm trong mảng giờ đã cài đặt
        if (times.includes(nowHHMM)) {
          if (cmdRecord.type === 'static') {
          try {
            await bot.sendMessage(groupChatId, cmdRecord.staticText, { parse_mode: 'HTML' });
          } catch (sendErr) {
            await bot.sendMessage(groupChatId, cmdRecord.staticText);
          }
        } else if (cmdRecord.type === 'dynamic') {
          switch (cmdRecord.command) {
            case 'viewcv': await handleViewCv(groupChatId, ''); break;
            case 'lichtruc': await handleLichTruc(groupChatId, ''); break;
            case 'nghiphep': await handleNghiPhep(groupChatId, ''); break;
            case 'danhba': await handleDanhBa(groupChatId, ''); break;
            case 'thongke': await handleThongKe(groupChatId); break;
            case 'hdsd': await handleHdsd(groupChatId); break;
          }
        }
      }
      }
    } catch (err) {
      console.error('Lỗi khi chạy cron scheduleTime:', err);
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });
};

// Hàm xử lý riêng cho lệnh /viewcv
const handleViewCv = async (chatId, username) => {
  try {
    let query = { status: 'pending' };
    let officerNameDisplay = 'Toàn cơ quan';

    if (username) {
      // Tìm officer theo tên (không phân biệt hoa thường, tìm gần đúng hoặc username nếu có)
      // Hiện tại Officer không có username, ta tìm theo hoTen (tìm từ khóa)
      const keyword = username.toLowerCase();
      
      // Tạo một regex linh hoạt
      const officers = await Officer.find();
      const matchedOfficer = officers.find(o => 
        o.hoTen.toLowerCase().includes(keyword) || 
        o.soDienThoai.includes(keyword)
      );

      if (matchedOfficer) {
        query.assignee = matchedOfficer._id;
        officerNameDisplay = `Đ/c ${matchedOfficer.capBac} ${matchedOfficer.hoTen}`;
      } else {
        bot.sendMessage(chatId, `❌ Không tìm thấy cán bộ nào có tên/SĐT khớp với "${username}".`);
        return;
      }
    }

    const tasks = await WorkTask.find(query).populate('assignee').sort({ dueDate: 1, createdAt: -1 });

    if (tasks.length === 0) {
      await bot.sendMessage(chatId, `✅ <b>${officerNameDisplay}</b> hiện không có công việc nào đang chờ thực hiện.`, { parse_mode: 'HTML' });
      return;
    }

    let message = `📋 <b>DANH SÁCH CÔNG VIỆC ĐANG CHỜ (${officerNameDisplay})</b>\n\n`;
    const today = moment().startOf('day');

    tasks.forEach((task, index) => {
      let dueStatus = 'Không có hạn';
      let dueEmoji = '⚪';
      if (task.dueDate) {
        const diffDays = moment(task.dueDate).startOf('day').diff(today, 'days');
        if (diffDays < 0) {
          dueStatus = `Quá hạn ${Math.abs(diffDays)} ngày!`;
          dueEmoji = '🔴';
        } else if (diffDays <= 2) {
          dueStatus = `Còn ${diffDays} ngày`;
          dueEmoji = '🟡';
        } else {
          dueStatus = `Còn ${diffDays} ngày`;
          dueEmoji = '🟢';
        }
      }

      const assigneeName = task.assignee ? task.assignee.hoTen : 'Chưa giao';
      
      message += `${index + 1}. <b>${task.title}</b>\n`;
      if (!username) {
        message += `   👤 Phụ trách: ${assigneeName}\n`;
      }
      message += `   ${dueEmoji} Hạn chót: ${task.dueDate ? moment(task.dueDate).format('DD/MM/YYYY') : 'Không'} (${dueStatus})\n`;
      message += `-------------------------------\n`;
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

  } catch (err) {
    console.error('Lỗi khi handleViewCv:', err);
    try { await bot.sendMessage(chatId, `❌ Đã xảy ra lỗi khi truy xuất công việc.`); } catch (e) {}
  }
};

// Hàm xử lý /danhba
const handleDanhBa = async (chatId, username) => {
  if (!username) {
    try { await bot.sendMessage(chatId, `ℹ️ <b>Hướng dẫn tra cứu SĐT:</b>\nVui lòng gõ <code>/danhba [tên hoặc SĐT]</code>\nVí dụ: <code>/danhba Nam</code>`, { parse_mode: 'HTML' }); } catch (e) {}
    return;
  }
  
  try {
    const keyword = username.toLowerCase();
    const officers = await Officer.find().populate('toCongTac');
    const matchedOfficers = officers.filter(o => o.hoTen.toLowerCase().includes(keyword) || (o.soDienThoai && o.soDienThoai.includes(keyword)));
    
    if (matchedOfficers.length === 0) {
      try { await bot.sendMessage(chatId, `❌ Không tìm thấy cán bộ nào khớp với "${username}".`); } catch (e) {}
      return;
    }
    
    let message = `📞 <b>KẾT QUẢ TRA CỨU DANH BẠ</b>\n\n`;
    matchedOfficers.forEach(o => {
      message += `👤 <b>${o.capBac || ''} ${o.hoTen}</b>\n`;
      message += `🔹 Chức vụ: ${o.chucVu}\n`;
      message += `🔹 Tổ: ${o.toCongTac ? o.toCongTac.ten : 'Chưa phân công'}\n`;
      message += `📱 <b>SĐT:</b> <code>${o.soDienThoai || 'Chưa cập nhật'}</code>\n\n`;
    });
    
    try { await bot.sendMessage(chatId, message, { parse_mode: 'HTML' }); } catch (e) {}
  } catch (err) {
    console.error(err);
    try { await bot.sendMessage(chatId, `❌ Lỗi tra cứu danh bạ.`); } catch (e) {}
  }
};

// Hàm xử lý /nghiphep
const handleNghiPhep = async (chatId, username) => {
  try {
    const today = moment().startOf('day');
    
    let matchQuery = {
      trangThai: 'Đã duyệt',
      tuNgay: { $lte: today.toDate() },
      denNgay: { $gte: today.toDate() }
    };

    const leaves = await Leave.find(matchQuery).populate('officer');
    
    if (username) {
      const keyword = username.toLowerCase();
      const filteredLeaves = leaves.filter(l => l.officer.hoTen.toLowerCase().includes(keyword));
      if (filteredLeaves.length === 0) {
        try { await bot.sendMessage(chatId, `✅ Đồng chí <b>${username}</b> hiện không trong thời gian nghỉ phép.`, { parse_mode: 'HTML' }); } catch (e) {}
        return;
      }
      
      let message = `🏖️ <b>THÔNG TIN NGHỈ PHÉP</b>\n\n`;
      filteredLeaves.forEach(l => {
        message += `👤 Đ/c: <b>${l.officer.capBac} ${l.officer.hoTen}</b>\n`;
        message += `🔹 Loại phép: ${l.loaiPhep}\n`;
        message += `🔹 Thời gian: Từ ${moment(l.tuNgay).format('DD/MM/YYYY')} đến ${moment(l.denNgay).format('DD/MM/YYYY')}\n`;
        message += `🔹 Lý do: ${l.lyDo}\n\n`;
      });
      try { await bot.sendMessage(chatId, message, { parse_mode: 'HTML' }); } catch (e) {}
      return;
    }
    
    if (leaves.length === 0) {
      try { await bot.sendMessage(chatId, `✅ Hôm nay không có đồng chí nào nghỉ phép.`); } catch (e) {}
      return;
    }
    
    let message = `🏖️ <b>DANH SÁCH NGHỈ PHÉP HÔM NAY</b>\n\n`;
    leaves.forEach((l, i) => {
      message += `${i+1}. <b>${l.officer.hoTen}</b> (${l.loaiPhep})\n   Đến hết: ${moment(l.denNgay).format('DD/MM/YYYY')}\n`;
    });
    try { await bot.sendMessage(chatId, message, { parse_mode: 'HTML' }); } catch (e) {}
    
  } catch (err) {
    console.error(err);
    try { await bot.sendMessage(chatId, `❌ Lỗi truy xuất dữ liệu nghỉ phép.`); } catch (e) {}
  }
};

// Hàm xử lý /lichtruc
const handleLichTruc = async (chatId, param) => {
  try {
    let targetDate = moment().startOf('day');
    let dateStr = 'HÔM NAY';
    
    if (param === 'ngaymai' || param === 'mai') {
      targetDate = moment().add(1, 'days').startOf('day');
      dateStr = 'NGÀY MAI';
    }
    
    const weekStart = targetDate.clone().startOf('isoWeek');
    const roster = await Roster.findOne({ weekStart: weekStart.toDate() })
      .populate({ path: 'days.trucChiHuy', select: 'hoTen capBac' })
      .populate({ path: 'days.trucBanNgay', select: 'hoTen capBac' })
      .populate({ path: 'days.trucBanDem', select: 'hoTen capBac' });

    if (!roster) {
      try { await bot.sendMessage(chatId, `⚠️ Chưa có lịch trực cho tuần này.`); } catch (e) {}
      return;
    }
    
    const dayData = roster.days.find(d => moment(d.date).isSame(targetDate, 'day'));
    if (!dayData) {
      try { await bot.sendMessage(chatId, `⚠️ Không tìm thấy dữ liệu trực cho ${dateStr.toLowerCase()}.`); } catch (e) {}
      return;
    }
    
    const formatNames = (officers) => officers.map(o => `${o.capBac || ''} ${o.hoTen}`).join(', ') || 'Chưa phân công';
    
    let message = `🛡️ <b>LỊCH TRỰC ${dateStr} (${targetDate.format('DD/MM/YYYY')})</b>\n\n`;
    message += `👮‍♂️ <b>Trực Chỉ Huy:</b>\n- ${formatNames(dayData.trucChiHuy)}\n\n`;
    message += `☀️ <b>Trực Ban Ngày:</b>\n- ${formatNames(dayData.trucBanNgay)}\n\n`;
    message += `🌙 <b>Trực Ban Đêm:</b>\n- ${formatNames(dayData.trucBanDem)}\n`;
    
    if (dayData.ghiChu) {
      message += `\n📝 Ghi chú: ${dayData.ghiChu}`;
    }
    
    try { await bot.sendMessage(chatId, message, { parse_mode: 'HTML' }); } catch (e) {}
    
  } catch (err) {
    console.error(err);
    try { await bot.sendMessage(chatId, `❌ Lỗi truy xuất lịch trực.`); } catch (e) {}
  }
};

// Hàm xử lý /thongke
const handleThongKe = async (chatId) => {
  try {
    const today = moment().startOf('day');
    
    const totalOfficers = await Officer.countDocuments({ trangThai: 'Đang công tác' });
    const leavesToday = await Leave.countDocuments({ 
      trangThai: 'Đã duyệt', 
      tuNgay: { $lte: today.toDate() }, 
      denNgay: { $gte: today.toDate() } 
    });
    
    const pendingTasks = await WorkTask.countDocuments({ status: 'pending' });
    const overdueTasks = await WorkTask.countDocuments({ status: 'pending', dueDate: { $lt: today.toDate() } });
    
    let message = `📊 <b>THỐNG KÊ TỔNG HỢP NHANH</b>\n\n`;
    message += `👥 Quân số đang công tác: <b>${totalOfficers}</b> đ/c\n`;
    message += `🏖️ Đang nghỉ phép hôm nay: <b>${leavesToday}</b> đ/c\n`;
    message += `✅ Quân số làm việc: <b>${totalOfficers - leavesToday}</b> đ/c\n`;
    message += `-------------------------------\n`;
    message += `📋 Công việc đang xử lý: <b>${pendingTasks}</b> việc\n`;
    message += `🔴 Công việc đã quá hạn: <b>${overdueTasks}</b> việc\n`;
    
    try { await bot.sendMessage(chatId, message, { parse_mode: 'HTML' }); } catch (e) {}
    
  } catch (err) {
    console.error(err);
    try { await bot.sendMessage(chatId, `❌ Lỗi khi thống kê.`); } catch (e) {}
  }
};

// Hàm xử lý /hdsd
const handleHdsd = async (chatId) => {
  try {
    const commands = await TelegramCommand.find({ isActive: true }).sort({ type: 1, command: 1 });
    
    let message = `🤖 <b>HƯỚNG DẪN SỬ DỤNG BOT</b>\n\n`;
    message += `Dưới đây là danh sách các câu lệnh bạn có thể sử dụng (chỉ cần gõ lệnh và gửi vào nhóm):\n\n`;
    
    const dynamicCmds = commands.filter(c => c.type === 'dynamic');
    const staticCmds = commands.filter(c => c.type === 'static');

    if (dynamicCmds.length > 0) {
      message += `🛠️ <b>Lệnh hệ thống:</b>\n`;
      dynamicCmds.forEach(c => {
        message += `▪️ <code>/${c.command}</code> : ${c.description}\n`;
      });
      message += `\n`;
    }

    if (staticCmds.length > 0) {
      message += `💬 <b>Lệnh hỏi đáp nhanh:</b>\n`;
      staticCmds.forEach(c => {
        message += `▪️ <code>/${c.command}</code> : ${c.description}\n`;
      });
    }

    try { await bot.sendMessage(chatId, message, { parse_mode: 'HTML' }); } catch (e) {}
    
  } catch (err) {
    console.error(err);
    try { await bot.sendMessage(chatId, `❌ Lỗi khi tải hướng dẫn sử dụng.`); } catch (e) {}
  }
};

// Hàm gửi tin nhắn chủ động vào Group (Dùng cho thông báo giao việc, duyệt phép...)
const sendToGroup = async (message) => {
  if (!bot) {
    console.log('Bot chưa được khởi tạo, không thể gửi tin nhắn.');
    return;
  }
  const chatSetting = await Setting.findOne({ key: 'TELEGRAM_CHAT_ID' });
  const groupChatId = (chatSetting && chatSetting.value) ? chatSetting.value : process.env.TELEGRAM_CHAT_ID;
  if (!groupChatId) {
    console.log('Chưa cấu hình TELEGRAM_CHAT_ID.');
    return;
  }
  try {
    await bot.sendMessage(groupChatId, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Lỗi khi gửi tin nhắn Telegram chủ động:', err);
  }
};

module.exports = {
  initTelegramBot,
  sendToGroup
};
