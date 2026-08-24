# Hướng dẫn kết nối Bot Telegram cho Nhóm Chung (Group)

Hệ thống PMCAX đã tích hợp tính năng tự động gửi tin nhắn báo cáo/nhắc nhở công việc vào Nhóm Telegram chung của Cơ quan.

Vào lúc 07:00 sáng mỗi ngày, Bot sẽ tổng hợp lại tất cả các công việc sắp đến hạn hoặc đã quá hạn, và gửi một thông báo chung lên Group. Từ đó, toàn thể anh em trong đơn vị có thể theo dõi và đôn đốc lẫn nhau.

## Bước 1: Tạo Bot (Chỉ làm 1 lần)
1. Mở Telegram, tìm kiếm `@BotFather` (có tích xanh).
2. Nhắn lệnh `/newbot` và làm theo hướng dẫn để đặt tên (ví dụ: `Trợ Lý CAX`).
3. Username của bot phải kết thúc bằng chữ `bot` (ví dụ: `cax_pmcax_bot`).
4. Copy đoạn **HTTP API Token** mà BotFather cung cấp (Ví dụ: `7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxx`).
5. **Lưu đoạn Token này lại để dùng ở Bước 3.**

## Bước 2: Thêm Bot vào Nhóm và lấy Chat ID của Nhóm
Vì Bot sẽ gửi tin nhắn vào Nhóm của cơ quan, bạn cần add Bot vào nhóm và lấy ID của Nhóm đó:
1. Mở Nhóm Telegram chung của cơ quan mà bạn vừa tạo.
2. Thêm con Bot bạn vừa tạo ở Bước 1 vào nhóm (Add Member -> Tìm tên `@cax_pmcax_bot`).
3. Để lấy được ID của nhóm, hãy thêm một con bot có tên là `@getidsbot` hoặc `@RawDataBot` vào nhóm.
4. Ngay khi được thêm vào, bot `@getidsbot` sẽ gửi một tin nhắn báo thông tin Nhóm. Hãy tìm dòng có chữ **Chat ID** (Đối với Group, ID thường bắt đầu bằng dấu trừ `-`, ví dụ: `-1001234567890`).
5. **Lưu đoạn số ID có chứa dấu trừ này lại để dùng ở Bước 3.**
6. (Tùy chọn) Bạn có thể kích (kick) con bot `@getidsbot` ra khỏi nhóm cho đỡ vướng sau khi đã lấy xong ID.

## Bước 3: Cập nhật cấu hình vào hệ thống PMCAX
1. Trên máy chủ VPS, mở file `.env` nằm trong thư mục cài đặt web (thường là `c:\Users\Administrator\PMCAX\.env`).
2. Thêm 2 dòng sau vào cuối file, thay thế bằng các thông số bạn vừa lấy được:
   ```env
   TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxx
   TELEGRAM_CHAT_ID=-1001234567890
   ```
   *(Lưu ý: Đừng quên dấu trừ `-` ở Chat ID)*
3. Lưu file lại và khởi động lại phần mềm (`pm2 restart pmcax` hoặc khởi động lại npm run dev).

## Bước 4: Test thử
Trên phần mềm PMCAX, vào mục **Quản lý công việc**, bấm nút **Test Bot Telegram** màu xanh để xem Bot đã nhảy tin nhắn vào Nhóm chung hay chưa!

🎉 **XONG!** Từ ngày mai, cứ vào lúc 07:00 sáng, Bot sẽ tự động thông báo danh sách các công việc tới hạn vào Nhóm chung của anh em!
