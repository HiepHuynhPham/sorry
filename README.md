# Website hồ sơ xin lỗi

Website tĩnh chạy trên GitHub Pages, dùng Supabase Auth + PostgreSQL/RLS để quản trị hồ sơ đang công khai. Hồ sơ 001 được lưu nguyên bản tại `cases/case-001.html`; hồ sơ 002 nằm tại `cases/case-002.html`.

## Cài Supabase từng bước

1. Tạo project tại Supabase Dashboard và chờ database sẵn sàng.
2. Mở **SQL Editor**, mở `supabase/schema.sql`, thay đúng chuỗi `ADMIN_EMAIL_HERE` bằng email admin thật rồi chạy toàn bộ file. Không dùng dấu ngoặc nhọn và không tự tạo email khác.
3. Vào **Authentication → Providers → Email**, bật Email/Password.
4. Tắt public sign-up trong **Authentication → Settings** (`Allow new users to sign up`) vì website không có luồng đăng ký.
5. Vào **Authentication → Users → Add user**, tạo thủ công tài khoản có đúng email đã đặt trong SQL và chọn auto-confirm nếu phù hợp.
6. Lấy **Project URL** và **anon/public key** tại **Project Settings → API**. Không bao giờ lấy `service_role` key.
7. Sao chép `assets/js/config.example.js` thành `assets/js/config.js`, thay `SUPABASE_URL` và `SUPABASE_ANON_KEY`. Hai giá trị này là thông tin public được RLS bảo vệ, không phải secret.
8. Trong **Authentication → URL Configuration**, đặt Site URL là `https://hiephuynhpham.github.io/sorry/` và thêm `https://hiephuynhpham.github.io/sorry/admin.html` vào Redirect URLs.
9. Commit/push `assets/js/config.js`, chờ GitHub Pages deploy rồi mở `/admin.html` để đăng nhập.

> Email placeholder nằm trong `supabase/schema.sql`, tại hàm `public.is_site_admin()`. Tìm chính xác `ADMIN_EMAIL_HERE`. Nếu đổi email sau khi đã chạy schema, chạy lại câu `create or replace function` với email mới.

## Cách hoạt động

- `index.html` chỉ hỏi Supabase hồ sơ đang active rồi tải giao diện tương ứng. Không có danh sách hay nút đổi hồ sơ trên trang public.
- `admin.html` dùng Supabase Email/Password Auth. Supabase SDK giữ và tự làm mới session trình duyệt; không có mật khẩu trong frontend.
- Dashboard bị ẩn cho tới khi có session. RLS vẫn kiểm tra email từ JWT ở database nên sửa JavaScript phía client không giúp vượt quyền.
- Anonymous chỉ có `SELECT` hồ sơ active và setting công khai. Anonymous không có quyền insert/update/delete.

## Kiểm tra RLS

Trong SQL Editor, kiểm tra anonymous không cập nhật được (hãy dùng REST client với anon key và không gửi access token người dùng). Kỳ vọng HTTP 401/403 hoặc không có hàng nào được cập nhật:

```bash
curl -X PATCH "$SUPABASE_URL/rest/v1/site_settings?id=eq.1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active_case_id":2}'
```

Sau đó đăng nhập `/admin.html`, chọn hồ sơ khác, xác nhận và tải lại link chính. Đăng xuất rồi xác nhận dashboard biến mất.

## Thêm hồ sơ mới

1. Tạo `cases/case-003.html` độc lập, semantic, responsive và không chứa secret.
2. Mở rộng allow-list slug trong `assets/js/app.js` (hiện là `case-001`/`case-002`).
3. Thêm hàng `case-003` vào bảng `cases` bằng SQL Editor.
4. Kiểm thử preview admin, accessibility, mobile và các hiệu ứng trước khi công khai.

## Chạy local

Do ES modules cần HTTP server:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Mở `http://127.0.0.1:8765/`. Nếu chưa cấu hình Supabase, trang hiện thông báo thân thiện và console nêu rõ file cần cấu hình.

## Rollback

Không force-push. Xem lịch sử bằng `git log --oneline`, sau đó dùng `git revert <commit-hash>` và push commit revert lên `main`. Baseline trước nâng cấp là commit `094b7e5`; branch local `backup/case-001-2026-07-22` cũng trỏ tới baseline này.

## Bảo mật

- Không commit password, service-role key hoặc secret key.
- Anon key được phép xuất hiện ở frontend nhưng phải đi cùng RLS.
- Không dùng query string để chọn case và không dùng localStorage như một cờ quyền admin.
- Nội dung HTML của case là asset tĩnh trên GitHub Pages; không đặt thông tin bí mật trong bất kỳ case nào.

## Hệ thống âm thanh

Âm thanh phía public được tổng hợp hoàn toàn bằng Web Audio API trong `assets/js/audio-manager.js`; dự án không tải file nhạc, không dùng CDN âm thanh và không sao chép giai điệu có bản quyền. `assets/js/case-audio.js` nối Audio Manager với các nút của từng hồ sơ. Trang admin không import hai module này nên không phát âm thanh.

- Khi trang vừa tải, AudioContext chưa được tạo và không có âm thanh.
- Nút mở hồ sơ là thao tác mở khóa âm thanh, phát hiệu ứng mở rồi fade-in nhạc riêng của case.
- Case 001 dùng âm sắc music-box/marimba nhẹ; case 002 dùng piano/chuông và tick-tock nhỏ.
- Hiệu ứng né nút có giới hạn 250 ms. Hiệu ứng tha lỗi tự duck nhạc nền rồi trả lại âm lượng.
- Nút âm thanh cố định xuất hiện sau khi mở hồ sơ. Trạng thái tắt, âm lượng nhạc và âm lượng hiệu ứng dùng namespace `sorry-site.audio.*` trong localStorage; chúng không liên quan xác thực admin.
- Khi tab bị ẩn, nhạc fade-out và AudioContext tạm dừng. Khi quay lại, nhạc chỉ tiếp tục nếu người xem chưa tắt.

Âm lượng mặc định nằm trong constructor của `AudioManager`: `musicVolume = 0.18` và `effectVolume = 0.34`. Có thể đổi bằng `setMusicVolume()` và `setEffectVolume()`. Muốn thêm case mới, thêm motif trong `scheduleMusicLoop()`, hiệu ứng thích hợp trong các hàm `play*Effect`, rồi đặt `data-case` và nạp `case-audio.js` ở HTML của case.

Nếu sau này thay bằng file local, đặt file tự tạo hoặc có giấy phép rõ ràng trong `assets/audio/`, ghi nguồn/giấy phép tại đây và giữ fallback để giao diện không phụ thuộc file. Không sử dụng nhạc có bản quyền khi chưa được phép.

Để vô hiệu hóa toàn bộ hệ thống khi xử lý sự cố, bỏ thẻ `case-audio.js` và `audio-control.css` khỏi hai trang case; nội dung, animation và các nút vẫn hoạt động độc lập.
