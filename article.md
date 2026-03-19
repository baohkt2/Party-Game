Đây là bản tóm tắt toàn diện cho dự án web game **\"Hành trình Vua Trò
Chơi\"** dựa trên ý tưởng của bạn, được thiết kế để triển khai nhanh
trên Vercel cho các buổi tiệc cuối năm.

## 🏗️ Cấu trúc Hệ thống

-   **Khởi tạo**: Mỗi người tham gia đăng nhập vào hệ thống bằng tên
    > riêng của mình.

-   **Bảng xếp hạng**: Hệ thống tự động theo dõi và cập nhật điểm số để
    > tìm ra \"Vua Trò Chơi\" cuối cùng.

-   **Tiến trình**: Trò chơi bao gồm **5 vòng** đấu liên tục với các
    > hình thức thử thách khác nhau.

## 🎮 Chi tiết 5 Vòng Chơi

Vòng 1: Thử Thách Phản Xạ

-   **Mục tiêu**: Kiểm tra độ tỉnh táo và phản xạ nhanh.

-   **Cách chơi**: Người chơi đặt ngón tay lên màn hình hoặc chuẩn bị
    > bấm nút.

-   **Logic**: Màn hình chuyển từ **Đỏ** sang **Xanh** ngẫu nhiên.

-   **Hình phạt**: Người bấm chậm nhất hoặc bấm trước khi chuyển màu sẽ
    > phải uống.

Vòng 2: Hại Người - Hại Mình

-   **Mục tiêu**: Khuấy động không khí bằng những thử thách cá nhân hóa.

-   **Cách chơi**: Mỗi người tự soạn **3 yêu cầu** (thẻ bài) đưa vào hệ
    > thống.

-   **Cơ chế**: Quay vòng quay để chọn ngẫu nhiên một thẻ và thực hiện
    > yêu cầu đó.

-   **Điểm số**: Thành công nhận **+3 điểm**. Thất bại bị **trừ 1 điểm**
    > và phạt uống **nửa ly**.

Vòng 3: Ai Là Kẻ Tội Đồ?

-   **Mục tiêu**: Tương tác nhóm và khui những sự thật hài hước.

-   **Cách chơi**: Hệ thống hiển thị các câu hỏi dạng \"Ai là
    > người\...?\". Sau 3 giây đếm ngược, tất cả phải chỉ tay vào người
    > khớp với mô tả nhất.

-   **Hình phạt**: Người bị nhiều người chỉ tay vào nhất phải uống.

Vòng 4: Thật Hay Thách

-   Vòng này tập trung vào việc lựa chọn giữa việc tiết lộ sự thật hoặc
    > thực hiện các thử thách lầy lội để tích lũy điểm số cho bảng xếp
    > hạng.

Vòng 5: Cào Tố Tam Khúc

Đây là vòng đấu trí cuối cùng, kết hợp giữa bài cào 3 lá và cách cược
của Poker.

-   **Tiến trình**: Chia làm 3 giai đoạn, mỗi giai đoạn người chơi nhận
    > thêm 1 lá bài.

-   **Lựa chọn**: Ở mỗi vòng chia bài, người chơi có quyền **Tăng cược,
    > Theo cược hoặc Bỏ bài**.

-   **Bỏ bài**: Người bỏ cuộc ngay vòng đầu sẽ bị phạt **1 đơn vị bia**
    > và dừng ván.

-   **Đơn vị cược**: Có thể quy đổi 1 đơn vị tương đương 1 ngụm hoặc 1/4
    > ly bia.

## 🍺 Cơ chế Hình phạt Vòng 5

Người thắng cuộc sẽ không phải uống. Những người thua cuộc sẽ phải chịu
hình phạt dựa trên tổng lượng bia đã cược trong hũ (Pot).

**Công thức tính lượng bia phải uống:**

\$\$Uống = (Số\\:bia\\:cược\\:thua) +
\\frac{Số\\:bia\\:người\\:thắng\\:cược}{Tổng\\:số\\:người\\:thua}\$\$

> **Ví dụ**: Nếu người thắng cược 10 đơn vị và có 2 người thua (mỗi
> người cũng đã cược 10 đơn vị), thì mỗi người thua sẽ phải uống tổng
> cộng **15 đơn vị bia**.