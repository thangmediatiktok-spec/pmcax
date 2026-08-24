const cron = require('node-cron');
const axios = require('axios');
const moment = require('moment');
const WorkTask = require('../models/WorkTask');
const Setting = require('../models/Setting');

// Hàm gửi tin nhắn Telegram
const sendTelegramMessage = async (message) => {
  const tokenSetting = await Setting.findOne({ key: 'TELEGRAM_BOT_TOKEN' });
  const chatSetting = await Setting.findOne({ key: 'TELEGRAM_CHAT_ID' });
  
  const botToken = (tokenSetting && tokenSetting.value) ? tokenSetting.value : process.env.TELEGRAM_BOT_TOKEN;
  const chatId = (chatSetting && chatSetting.value) ? chatSetting.value : process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('Chưa cấu hình Telegram Bot Token hoặc thiếu Chat ID của Quản lý');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML' // Để dùng được các thẻ in đậm <b> </b>
    return true;
  } catch (error) {
    console.error('Lỗi khi gửi Telegram:', error.response ? error.response.data : error.message);
    const errorMsg = error.response && error.response.data && error.response.data.description ? error.response.data.description : error.message;
    throw new Error(errorMsg);
  }
};

// Hàm rà soát và gửi thông báo
const runTelegramCheck = async () => {
  console.log('Đang chạy tác vụ kiểm tra công việc tới hạn (Manual/Cron)...');

  try {
    const today = moment().startOf('day');
    
    // Lấy tất cả công việc chưa hoàn thành, có hạn chót, và lấy thông tin người được giao
    const pendingTasks = await WorkTask.find({ 
      status: 'pending',
      dueDate: { $ne: null }
    }).populate('assignee');

    let urgentTasks = [];

    pendingTasks.forEach(task => {
      const dueDate = moment(task.dueDate).startOf('day');
      const diffDays = dueDate.diff(today, 'days');

      // Lọc các công việc trễ hạn (diffDays < 0) hoặc sắp đến hạn (0 <= diffDays <= 2)
      if (diffDays <= 2) {
        urgentTasks.push({ task, diffDays });
      }
    });

    if (urgentTasks.length > 0) {
      let message = `🚨 <b>THÔNG BÁO CÔNG VIỆC SẮP ĐẾN HẠN / QUÁ HẠN</b> 🚨\n\n`;
      message += `Kính gửi toàn thể các đồng chí, dưới đây là danh sách các công việc sắp đến hạn hoặc đã quá hạn cần khẩn trương thực hiện:\n\n`;

      urgentTasks.forEach(({ task, diffDays }) => {
        const assigneeName = task.assignee ? `${task.assignee.capBac} ${task.assignee.hoTen}` : 'Chưa giao cho ai';
        const dueStatus = diffDays < 0 ? `ĐÃ TRỄ HẠN ${Math.abs(diffDays)} NGÀY!` : (diffDays === 0 ? 'HÔM NAY' : `Còn ${diffDays} ngày`);
        
        message += `🔹 <b>Công việc:</b> ${task.title}\n`;
        message += `👤 <b>Phụ trách:</b> ${assigneeName}\n`;
        message += `⏰ <b>Hạn chót:</b> ${moment(task.dueDate).format('DD/MM/YYYY')} (<b>${dueStatus}</b>)\n`;
        message += `-------------------------------\n`;
      });

      message += `\n👉 <i>Đề nghị các đồng chí có tên trên nhanh chóng hoàn thành nhiệm vụ!</i>`;

      try {
        await sendTelegramMessage(message);
        return { success: true, message: 'Đã gửi báo cáo Telegram thành công.' };
      } catch (telegramErr) {
        return { success: false, message: 'Lỗi từ Telegram: ' + telegramErr.message };
      }
    } else {
      console.log('Không có công việc nào sắp đến hạn cần nhắc nhở.');
      return { success: true, message: 'Không có công việc nào sắp đến hạn (Không có gì để gửi).' };
    }
  } catch (err) {
    console.error('Lỗi khi rà soát công việc cron job:', err);
    return { success: false, message: 'Lỗi rà soát công việc.' };
  }
};

// Khởi tạo Cron Job chạy vào 07:00 sáng mỗi ngày
const initCronJobs = () => {
  console.log('Khởi tạo Cron Jobs: Thông báo Telegram...');
  
  // Cú pháp: 'phút giờ ngày tháng thứ'
  // '0 7 * * *' = 7 giờ 0 phút sáng mỗi ngày
  cron.schedule('0 7 * * *', async () => {
    await runTelegramCheck();
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });
};

module.exports = {
  initCronJobs,
  runTelegramCheck,
  sendTelegramMessage // Export ra ngoài nhỡ lúc nào cần gọi thủ công
};
