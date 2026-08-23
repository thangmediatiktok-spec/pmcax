# QUY TRÌNH CẬP NHẬT CODE TỪ MÁY TÍNH LÊN MÁY CHỦ (VPS)

Mỗi khi bạn có chỉnh sửa hoặc nâng cấp phần mềm trên máy tính cá nhân, bạn cần làm theo 2 bước sau đây để mã nguồn mới được đồng bộ lên máy chủ VPS đang chạy thực tế.

---

## BƯỚC 1: TRÊN MÁY TÍNH CÁ NHÂN (Đẩy code lên GitHub)

Mở Terminal (PowerShell) trên máy tính tại thư mục dự án `c:\Users\Administrator\PMCAX` và chạy lần lượt 3 lệnh sau:

```bash
# 1. Quét và gom tất cả các file vừa chỉnh sửa
git add .

# 2. Đóng gói các thay đổi với một ghi chú (thay nội dung trong ngoặc kép bằng mô tả sửa đổi)
git commit -m "Cập nhật tính năng mới"

# 3. Đẩy gói code này lên kho lưu trữ GitHub
git push
```

*(Nếu báo lỗi chưa đăng nhập, hệ thống sẽ tự bật trình duyệt để bạn xác thực với GitHub).*

---

## BƯỚC 2: TRÊN MÁY CHỦ VPS (Kéo code về và khởi động lại)

Kết nối SSH vào VPS của bạn và chạy 2 lệnh sau:

```bash
# 1. Kéo phiên bản code mới nhất từ GitHub về thư mục web
cd /var/www/pmcax && sudo git pull

# 2. Khởi động lại phần mềm để áp dụng dòng code mới
pm2 restart pmcax
```

> **Mẹo nhỏ:** Nếu bạn có cài đặt thêm thư viện NPM mới (chạy lệnh `npm install ...` trên máy tính), thì sau khi chạy `sudo git pull` ở VPS, bạn cần chạy thêm lệnh `npm install` trước khi khởi động lại pm2 nhé.
