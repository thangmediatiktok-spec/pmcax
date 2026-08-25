# SỔ TAY HƯỚNG DẪN SỬ DỤNG PHẦN MỀM QUẢN LÝ CÔNG AN XÃ (PMCAX)

Chào mừng bạn đến với tài liệu Hướng dẫn sử dụng Phần mềm Quản lý Công an xã. Tài liệu này sẽ hướng dẫn chi tiết từ bước đăng nhập đầu tiên cho đến cách sử dụng các tính năng chuyên sâu của hệ thống.

---

## 1. Đăng nhập và Thiết lập lần đầu (Onboarding)

### 1.1. Đăng nhập lần đầu
- Truy cập vào đường dẫn trang web của đơn vị.
- Sử dụng **Tên đăng nhập** và **Mật khẩu** do Admin (Quản trị viên) cấp để đăng nhập.
- (Mật khẩu mặc định nếu được Admin import từ Excel thường là `12345678`).

### 1.2. Cập nhật thông tin và Kích hoạt 2FA (Onboarding)
Ngay sau khi đăng nhập thành công lần đầu tiên, hệ thống sẽ yêu cầu bạn hoàn thiện hồ sơ:
1. **Đổi mật khẩu:** Bạn bắt buộc phải đổi mật khẩu mới để đảm bảo an toàn.
2. **Cập nhật ảnh đại diện (Avatar):** Tải lên hình ảnh cá nhân (lưu ý dung lượng nhỏ hơn quy định của máy chủ).
3. **Bật Bảo mật 2 lớp (2FA):** 
   - Hệ thống sẽ hiển thị một **Mã QR**.
   - Sử dụng ứng dụng **Google Authenticator** (hoặc Authy) trên điện thoại để quét mã QR này.
   - Nhập 6 số hiện ra trên điện thoại vào ô xác nhận để hoàn tất.
   - *Lưu ý:* Từ các lần đăng nhập sau, ngoài mật khẩu, bạn sẽ cần mở điện thoại để nhập 6 số này.
4. Sau khi hoàn tất, hệ thống sẽ đưa bạn vào Trang chủ (Dashboard).

---

## 2. Quản lý Hồ sơ Cán bộ
Hồ sơ Cán bộ là nền tảng để hệ thống liên kết các dữ liệu (chấm công, nghỉ phép).

- **Tạo Hồ sơ mới (Chỉ dành cho Admin/Chỉ huy):** Vào menu **Hồ sơ CBCS** -> Nhấn **Thêm cán bộ mới**. Nhập đầy đủ thông tin (Họ tên, cấp bậc, chức vụ, tổ công tác, ngày sinh...).
- **Liên kết Tài khoản với Hồ sơ:** 
  Để một tài khoản có thể xin phép, chấm công, tài khoản đó phải được liên kết với một Hồ sơ Cán bộ.
  Admin vào **Hồ sơ CBCS**, chọn Sửa một hồ sơ tương ứng -> Kéo xuống phần "Tài khoản liên kết" và chọn tên đăng nhập của cán bộ đó.
- **Xem Hồ sơ:** Bấm vào nút "Xem" hình con mắt để xem chi tiết lý lịch trích ngang của cán bộ.

---

## 3. Bảng Chấm Công & Lịch Trực

Bảng chấm công là nơi tổng hợp ngày làm việc, đi công tác, nghỉ phép của toàn bộ CBCS trong tháng.

### 3.1. Phân quyền Chấm công
- Các tài khoản được Admin cấp quyền **Quản lý lịch trực** sẽ có chức năng phân công, chỉnh sửa bảng chấm công.

### 3.2. Chấm công hàng ngày
1. Vào menu **Bảng chấm công**. Chọn Tháng/Năm và Tổ công tác cần xem.
2. Tại bảng, click vào bất kỳ ô ngày nào của một cán bộ để cập nhật trạng thái:
   - `+` : Làm việc bình thường
   - `A` : Làm việc (có ăn định lượng)
   - `CT-A`: Đi công tác (có ăn định lượng)
   - `P` : Nghỉ phép
   - `NL`: Nghỉ lễ
   - `O` : Ốm
   - `K` : Không lương
3. **Ghi chú (Bắt buộc với CT-A):** Nếu chọn Đi công tác (CT-A), bạn bắt buộc phải nhập Tên Thôn/Xã nơi đi công tác vào ô Ghi chú. Ghi chú này sẽ được hệ thống dùng để tự động điền vào Giấy đi đường và Bảng Ăn định lượng.

---

## 4. Xin Nghỉ Phép & Quản lý Phép

### 4.1. Tạo đơn xin phép (Dành cho mọi cán bộ)
1. Cán bộ vào menu **Nghỉ phép** -> Nhấn **Tạo đơn xin phép**.
2. Chọn loại phép (Nghỉ thường niên, Nghỉ bù, Việc riêng...).
3. Chọn Ngày bắt đầu và Ngày kết thúc. Hệ thống sẽ tự động tính số ngày nghỉ.
4. Ghi rõ Lý do nghỉ và Nơi nghỉ.
5. Nhấn **Gửi đơn**. 
   *(Theo cấu hình hiện tại, đơn sẽ được hệ thống TỰ ĐỘNG DUYỆT ngay lập tức để giảm tải thủ tục hành chính).*

### 4.2. Đồng bộ tự động vào Bảng chấm công
- Ngay khi đơn xin phép được duyệt, hệ thống sẽ **Tự động điền mã `P` (Nghỉ phép)** vào Bảng chấm công của cán bộ đó trong các ngày tương ứng. Admin không cần chấm tay lại!

---

## 5. Bảng Ăn Định Lượng (ADL)

Đây là tính năng thông minh giúp tự động sinh Kế hoạch và Kết quả công việc cho những ngày làm việc có ăn định lượng (Mã `A` và `CT-A`).

### 5.1. Cấu hình Công việc ADL (Dành cho Admin/Quản lý)
1. Vào menu **Cấu hình ADL**. Tại đây bạn tạo một "Ngân hàng" các công việc.
2. Có thể chọn chế độ **Sinh hàng loạt** để hệ thống tự động nhân bản công việc với các biến số:
   - `[THON]`: Tự động điền danh sách các thôn/bản.
   - `[GIO]`: Tự động điền các khung giờ.
3. Chú ý các biến số Random động:
   - `[SO]`: Hệ thống sẽ tự thay thành một con số ngẫu nhiên từ 20 đến 80.
   - `[DT]`: Thay thành số đối tượng ngẫu nhiên từ 1 đến 5.
   - `[XACT]`: Dành riêng cho `CT-A`, hệ thống sẽ tự lấy chữ ở ô "Ghi chú" bảng chấm công đắp vào đây.

### 5.2. Chốt & Random Bảng ADL Của Từng Người
1. Từ **Bảng chấm công**, bấm vào tên của một Cán bộ.
2. Chọn menu **Định lượng ăn (ADL)**.
3. Hệ thống sẽ tự động load các ngày `A` và `CT-A`.
4. Nếu chữ không ưng ý, bạn có thể bấm nút **Mở khóa Random lại**, sau đó bấm các nút **Random Công việc A** hoặc **Random Công tác** (màu đỏ) ở góc trên để hệ thống "xào" lại chữ.
5. Bạn cũng có thể bấm nút Sửa (Hình cây bút) ở từng dòng để tự gõ tay nội dung.
6. Khi đã hoàn thiện, bấm **Lưu toàn bộ**. Lúc này bảng sẽ bị khóa (ĐÃ SỬA) và không bị random đè lên nữa. Có thể xuất Excel ra để nộp.

---

## 6. In Giấy Đi Đường (Công Tác Phí)

Hệ thống hỗ trợ in tự động Giấy đi đường cho Cán bộ vào cuối tháng dựa trên dữ liệu Bảng chấm công.

1. Từ **Bảng chấm công**, bấm vào tên của một Cán bộ.
2. Chọn menu **Công tác phí**.
3. Hệ thống sẽ quét toàn bộ các ngày có mã `CT-A` trong tháng, gom các ngày đi công tác liên tục tại cùng một Thôn/Xã thành một Chuyến công tác.
4. Điền Mục đích công tác chung (VD: Trực ban, Xác minh...).
5. Bấm **In Giấy Đi Đường** để xuất ra bản in PDF tuyệt đẹp, sẵn sàng trình ký.

---

## 7. Quản lý Công việc (Task Manager) & Cảnh báo Telegram

Module này giúp giao việc, theo dõi tiến độ và báo cáo kết quả thực hiện nhiệm vụ một cách chuyên nghiệp. Đặc biệt hệ thống tích hợp sâu với **Bot Telegram** để tự động gửi tin nhắn thông báo tức thì đến điện thoại của CBCS.

![Giao diện Quản lý công việc](/images/guide/task-list.png)

1. **Thêm công việc:** Vào menu **Quản lý công việc** -> Bấm nút **Thêm công việc**. Nhập tên, mô tả chi tiết, chu kỳ lặp lại (một lần, hàng ngày, hàng tuần...).
2. **Giao việc (Assign):** Chọn giao việc cho "Cá nhân" (kéo thả hoặc chọn vào bảng bên phải) hoặc giao cho "Tổ công tác" (nếu có Tổ). Đặt hạn chót (nếu cần).
   ![Giao việc cho cán bộ](/images/guide/task-assign.png)
3. **Thông báo Telegram Tự Động:** Ngay khi bạn giao việc, hệ thống sẽ tự động gọi Bot Telegram và gửi một tin nhắn nhắc việc chi tiết trực tiếp về điện thoại của cán bộ được giao nhiệm vụ!
   ![Thông báo Telegram](/images/guide/telegram-noti.png)
4. **Báo cáo trạng thái:** Người được giao việc làm xong đăng nhập vào hệ thống, bấm nút **Xong (Màu xanh)**, nhập nội dung báo cáo kết quả. Hệ thống cũng sẽ tự động chuyển tiếp kết quả này lên nhóm Telegram của Đơn vị để Chỉ huy nắm.
   ![Báo cáo kết quả](/images/guide/task-complete.png)
5. **Theo dõi đa chiều:** Chỉ huy có thể theo dõi tiến độ công việc đang chờ (Pending) hoặc đã xong (Completed) của toàn đơn vị. Cảnh báo màu vàng/đỏ cho các công việc sắp hoặc quá hạn chót.



*Cảm ơn bạn đã sử dụng Phần mềm Quản lý Công an xã. Nếu có thắc mắc trong quá trình vận hành, vui lòng liên hệ bộ phận kỹ thuật để được hỗ trợ!*
