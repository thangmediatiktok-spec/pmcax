# Hướng Dẫn Cấu Hình Cloudflare Để Chạy HTTPS

Việc sử dụng Cloudflare không chỉ giúp website của bạn có HTTPS miễn phí vĩnh viễn (không cần gia hạn như Certbot), mà còn giúp ẩn IP thật của VPS để chống tấn công DDoS và tăng tốc độ tải trang (CDN).

Dưới đây là các bước chi tiết:

## BƯỚC 1: Đăng ký & Thêm tên miền vào Cloudflare
1. Truy cập [Cloudflare.com](https://dash.cloudflare.com/sign-up) và tạo một tài khoản miễn phí.
2. Tại màn hình chính (Dashboard), bấm nút **"Add a Site"**.
3. Nhập tên miền của bạn (`chuathai.io.vn`) và bấm **Continue**.
4. Kéo xuống dưới cùng và chọn gói **Free ($0)**, sau đó bấm **Continue**.
5. Cloudflare sẽ tự động quét các bản ghi DNS hiện tại của tên miền. Đảm bảo bạn có 1 bản ghi loại **A**, tên là `@` (hoặc `chuathai.io.vn`), trỏ về địa chỉ IP của VPS (`34.124.135.105`).
6. Đảm bảo trạng thái **Proxy status** (đám mây) đang bật màu cam ☁️. Bấm **Continue**.

## BƯỚC 2: Trỏ Nameserver (Từ nhà cung cấp tên miền về Cloudflare)
Cloudflare sẽ cung cấp cho bạn 2 địa chỉ Nameserver (ví dụ: `ns1.cloudflare.com` và `ns2.cloudflare.com`).

1. Đăng nhập vào trang quản lý của nơi bạn đã mua tên miền `chuathai.io.vn` (như iNET, Tenten, Mắt Bão...).
2. Tìm đến phần cấu hình **Đổi Nameserver** (hoặc Máy chủ DNS).
3. Xóa các Nameserver cũ mặc định đi và **nhập 2 Nameserver của Cloudflare** vào.
4. Lưu lại. Thao tác này có thể mất từ 5 phút đến 24 giờ để nhà cung cấp mạng cập nhật toàn cầu. 

Trở lại Cloudflare, bấm nút **"Check nameservers"**. Khi nào Cloudflare báo "Great news! Cloudflare is now protecting your site", bạn chuyển sang bước tiếp theo.

## BƯỚC 3: Cấu hình mã hóa SSL/TLS trên Cloudflare (Cực kỳ quan trọng)
Truy cập menu bên trái của Cloudflare, chọn mục **SSL/TLS** -> **Overview**.

Tại đây, bạn sẽ thấy các chế độ mã hóa. Tùy thuộc vào VPS của bạn đã cài Certbot HTTPS chưa mà chọn cho đúng:

* **Trường hợp 1 (Khuyên dùng): Chọn chế độ `Full (strict)`**
  * **Sử dụng khi:** Trên VPS bạn ĐÃ cài đặt thành công Certbot như lúc nãy.
  * **Giải thích:** Cloudflare mã hóa từ Người dùng <-> Cloudflare, và VPS cũng mã hóa từ Cloudflare <-> VPS. Đây là chế độ bảo mật cao nhất tuyệt đối an toàn.

* **Trường hợp 2: Chọn chế độ `Flexible`**
  * **Sử dụng khi:** Trên VPS của bạn CHỈ có Nginx chạy cổng 80 HTTP (chưa cài đặt hoặc cài Certbot bị lỗi).
  * **Giải thích:** Cloudflare vẫn cấp ổ khóa HTTPS cho người dùng. Nhưng đoạn kết nối từ Cloudflare về VPS của bạn sẽ chạy qua HTTP thường. (Bạn không cần dùng lệnh `certbot` trên VPS nữa).

## BƯỚC 4: Ép buộc toàn bộ người dùng dùng HTTPS
Vẫn trong menu **SSL/TLS**, chuyển sang thẻ **Edge Certificates**.

Kéo xuống tìm mục **"Always Use HTTPS"** và bật công tắc sang màu xanh (ON).

*(Thiết lập này giúp bất cứ ai gõ `http://chuathai.io.vn` đều bị bắt ép chuyển sang ổ khóa an toàn `https://chuathai.io.vn`)*.

---

**Xong rồi đó!** Giờ bạn chỉ cần ngồi chờ mạng Internet cập nhật Nameserver. Khi truy cập vào `https://chuathai.io.vn`, bạn bấm vào biểu tượng ổ khóa 🔒 trên trình duyệt, mục "Connection is secure" sẽ ghi rõ "Verified by: Cloudflare Inc".
