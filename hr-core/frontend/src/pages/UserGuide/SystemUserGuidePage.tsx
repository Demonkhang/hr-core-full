import React, { useState, useMemo } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  BookOutlined,
  SearchOutlined,
  BellOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  ArrowRightOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { useSetPageTitle } from '@/components/Layout/AppLayout';
import { ROUTES } from '@/utils/constants';

const { Title, Text, Paragraph } = Typography;

interface FieldGuideItem {
  fieldName: string;
  requiredText: string;
  exampleText: string;
  explainText: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface FriendlyGuideModule {
  id: string;
  numberLabel: string;
  title: string;
  subtitle: string;
  category: 'ALL' | 'START' | 'ORG_HR' | 'PROFILE_BNV' | 'ALERT_SALARY' | 'MOBILE_APP' | 'CALENDAR_APP';
  badgeColor: string;
  route?: string;
  whoShouldRead: string[];
  summaryForBeginner: string;
  whereToFindOnScreen: string[];
  stepByStepGuides: Array<{
    stepTitle: string;
    whereToClick: string;
    whatToType: string;
    whatHappensNext: string;
  }>;
  inputGuides: FieldGuideItem[];
  importantNotes: string[];
  commonQuestions: FaqItem[];
}

const FRIENDLY_GUIDE_MODULES: FriendlyGuideModule[] = [
  {
    id: 'getting-started',
    numberLabel: 'PHẦN 1',
    title: 'Làm quen Phần mềm: Cách Đăng nhập, Đổi mật khẩu & Chuyển qua lại giữa Nhân sự và Lịch trực',
    subtitle: 'Hướng dẫn dành cho người mới bắt đầu sử dụng lần đầu tiên trên máy tính và điện thoại',
    category: 'START',
    badgeColor: '#7c3aed',
    route: ROUTES.HOME,
    whoShouldRead: ['Tất cả Cán bộ, Viên chức, Người lao động', 'Ban Giám đốc & Trưởng/Phó các phòng'],
    summaryForBeginner:
      'Phần mềm của cơ quan gồm 2 khu vực làm việc chính liên kết sẵn với nhau: (1) Khu vực "Quản lý Nhân sự & Hồ sơ Lý lịch" và (2) Khu vực "Quản lý Lịch trực, Nghỉ phép & Làm thêm giờ". Bạn chỉ cần 1 tài khoản duy nhất để sử dụng cả hai nơi mà không cần đăng nhập lại.',
    whereToFindOnScreen: [
      'Thanh Menu bên trái màn hình: Nơi chứa danh sách tất cả các mục công việc (Tổng quan, Tổ chức, Nhân sự, Hồ sơ lý lịch, Cảnh báo nghiệp vụ, Hướng dẫn sử dụng).',
      'Nút "🏛️ HR Core ▾" (ở góc trên cùng bên phải màn hình): Bấm vào đây để chuyển nhanh sang phần mềm "📅 Quản lý Lịch (Calendar)" chỉ bằng 1 cú nhấp chuột.',
      'Biểu tượng Mặt trăng / Mặt trời (ở góc trên bên phải): Bấm vào để đổi màu nền sáng hoặc nền tối giúp đỡ mỏi mắt khi làm việc lâu.',
      'Tên của bạn (ở góc ngoài cùng bên phải): Bấm vào để xem Thông tin cá nhân, Đổi mật khẩu hoặc Đăng xuất khi hết giờ làm việc.',
    ],
    stepByStepGuides: [
      {
        stepTitle: 'Bước 1: Đăng nhập vào phần mềm',
        whereToClick: 'Mở trang phần mềm trên trình duyệt máy tính hoặc điện thoại.',
        whatToType:
          'Nhập "Tên đăng nhập" và "Mật khẩu" được phòng Tổ chức - Hành chính cấp. Nếu dùng máy tính cá nhân của riêng mình, bạn có thể tích vào ô "Duy trì đăng nhập" để những ngày sau không phải gõ lại mật khẩu. Sau đó bấm nút màu tím "Đăng nhập".',
        whatHappensNext:
          'Nếu bạn đăng nhập trên máy tính (hoặc bạn là Lãnh đạo/Trưởng phòng), màn hình Quản lý chung sẽ mở ra. Nếu bạn là Chuyên viên/Nhân viên đăng nhập bằng Điện thoại di động, phần mềm sẽ tự động mở ra Giao diện Điện thoại dành riêng cho cá nhân bạn.',
      },
      {
        stepTitle: 'Bước 2: Đổi mật khẩu mới trong lần đầu tiên sử dụng',
        whereToClick: 'Ngay khi đăng nhập lần đầu, một hộp thoại "Yêu cầu đổi mật khẩu" sẽ tự động hiện lên giữa màn hình.',
        whatToType:
          'Gõ mật khẩu mới của riêng bạn vào cả 2 ô "Mật khẩu mới" và "Xác nhận mật khẩu". Để bảo vệ tài khoản của bạn không bị người lạ đoán được, mật khẩu cần có ít nhất 8 ký tự, trong đó có chữ IN HOA, chữ thường, chữ số và ký tự đặc biệt (ví dụ: HoangDuong@2026). Xong bấm nút "Đổi mật khẩu".',
        whatHappensNext: 'Mật khẩu mới được lưu lại ngay, từ lần sau bạn dùng mật khẩu mới này để đăng nhập.',
      },
      {
        stepTitle: 'Bước 3: Chuyển sang phần mềm Quản lý Lịch trực, Nghỉ phép & Làm thêm giờ',
        whereToClick: 'Nhìn lên góc trên cùng bên phải màn hình, bấm vào nút "🏛️ HR Core ▾" rồi chọn dòng "📅 Quản lý Lịch (Calendar)".',
        whatToType: 'Không cần gõ lại tên đăng nhập hay mật khẩu.',
        whatHappensNext:
          'Màn hình sẽ tự động chuyển sang bên Quản lý Lịch công tác với sẵn tên tài khoản của bạn. Khi muốn quay về bên Quản lý Nhân sự, bạn cũng bấm vào nút "📅 Calendar ▾" ở góc phải trên cùng rồi chọn "🏛️ Quản lý Nhân sự (HR Core)".',
      },
    ],
    inputGuides: [
      {
        fieldName: 'Tên đăng nhập',
        requiredText: 'Bắt buộc',
        exampleText: 'Ví dụ: hvduong, dakhang, hoặc email công vụ',
        explainText: 'Mỗi cán bộ có một tên đăng nhập riêng được cấp khi tạo hồ sơ nhân sự.',
      },
      {
        fieldName: 'Mật khẩu',
        requiredText: 'Bắt buộc',
        exampleText: 'Ví dụ: Mbs@2026!',
        explainText: 'Phải có từ 8 ký tự trở lên, gồm chữ hoa, chữ thường, chữ số và ký tự như @, #, !, $.',
      },
    ],
    importantNotes: [
      'Nếu bạn nhập sai mật khẩu quá 5 lần liên tiếp trong vòng 1 phút, phần mềm sẽ tạm nghỉ 1 phút để bảo vệ tài khoản khỏi người lạ dò mật khẩu.',
      'Khi dùng xong trên máy tính dùng chung của cơ quan, hãy bấm vào tên mình ở góc phải trên cùng và chọn "Đăng xuất".',
    ],
    commonQuestions: [
      {
        question: 'Tôi lỡ quên mật khẩu đăng nhập thì phải làm sao?',
        answer:
          'Bạn chỉ cần báo cho cán bộ Quản trị hoặc phòng Tổ chức - Hành chính. Cán bộ quản trị sẽ bấm nút "Đặt lại mật khẩu" cho tài khoản của bạn chỉ trong vài giây và gửi mật khẩu tạm để bạn đăng nhập lại.',
      },
      {
        question: 'Tại sao đồng nghiệp của tôi đăng nhập trên điện thoại lại ra giao diện khác với máy tính?',
        answer:
          'Phần mềm được thiết kế thông minh: Khi Chuyên viên hoặc Nhân viên mở bằng điện thoại di động, phần mềm tự động hiển thị Giao diện Điện thoại gọn nhẹ (chỉ gồm Lịch của riêng mình, Xin nghỉ phép, Đăng ký làm thêm giờ và Xem hồ sơ cá nhân) để dễ bấm bằng một tay.',
      },
    ],
  },
  {
    id: 'org-setup',
    numberLabel: 'PHẦN 2',
    title: 'Quản lý Phòng ban, Chức vụ, Vị trí việc làm & Nơi làm việc',
    subtitle: 'Hướng dẫn dành cho Cán bộ Tổ chức - Hành chính thiết lập danh sách đơn vị của cơ quan',
    category: 'ORG_HR',
    badgeColor: '#2563eb',
    route: ROUTES.DEPARTMENTS,
    whoShouldRead: ['Cán bộ Tổ chức - Hành chính', 'Ban Giám đốc', 'Quản trị viên'],
    summaryForBeginner:
      'Trước khi nhập danh sách cán bộ vào phần mềm, chúng ta cần khai báo cơ quan có những Phòng ban nào, những Chức vụ nào, các Vị trí việc làm nào và các Trụ sở / Khu liên hợp nào.',
    whereToFindOnScreen: [
      'Nhìn vào thanh Menu bên trái → bấm vào mục "Tổ chức" sẽ xổ ra 4 mục con:',
      '1. "Phòng ban": Nơi quản lý Văn phòng, Phòng Kế hoạch - Tài chính, Phòng Quản lý dự án, Phòng Kiểm tra Môi trường, Phòng Giám sát Khu liên hợp, Phòng Giám sát Khối lượng...',
      '2. "Chức vụ": Nơi quản lý các chức danh (Giám đốc, Trưởng phòng, Phó Trưởng phòng, Chánh Văn phòng, Chuyên viên, Kế toán viên...) và phân quyền cho từng chức vụ.',
      '3. "Vị trí việc làm": Nơi quy định từng vị trí cần bằng cấp gì, chuyên môn gì và định biên tối đa bao nhiêu người.',
      '4. "Nơi làm việc": Nơi khai báo Trụ sở chính, Trụ sở 2 và các Khu liên hợp / Công trường.',
    ],
    stepByStepGuides: [
      {
        stepTitle: 'Cách 1: Thêm hoặc sửa một Phòng ban',
        whereToClick: 'Vào menu bên trái "Tổ chức" → chọn "Phòng ban" → bấm nút màu tím "+ Thêm phòng ban" ở góc phải phía trên.',
        whatToType:
          'Điền "Tên phòng ban" (ví dụ: Phòng Kiểm tra Môi trường), "Mã phòng" viết tắt (ví dụ: P.KTMT) và ghi chú nếu có. Sau đó bấm nút dấu tích màu tím (✓) ở cuối dòng để lưu lại.',
        whatHappensNext: 'Phòng ban mới sẽ xuất hiện ngay trong bảng danh sách và có thể chọn khi thêm nhân sự.',
      },
      {
        stepTitle: 'Cách 2: Phân quyền công việc cho từng Chức vụ',
        whereToClick: 'Vào menu "Tổ chức" → chọn "Chức vụ" → bấm vào biểu tượng cây bút (✎) ở dòng chức vụ muốn chỉnh sửa.',
        whatToType:
          'Ở cột "Phạm vi": Chọn "Toàn cơ quan" (dành cho Ban Giám đốc), chọn "Phòng ban" (dành cho Trưởng/Phó phòng chỉ quản lý nhân viên trong phòng mình), hoặc chọn "Cá nhân" (dành cho Chuyên viên/Nhân viên). Tiếp theo, gạt bật các nút quyền tương ứng rồi bấm nút dấu tích (✓) để lưu.',
        whatHappensNext:
          'Tất cả cán bộ đang giữ chức vụ đó sẽ lập tức có quyền xem và làm việc đúng với phạm vi bạn vừa bật.',
      },
      {
        stepTitle: 'Cách 3: Điều chỉnh Số lượng tối đa (Định biên) của Vị trí việc làm',
        whereToClick: 'Vào menu "Tổ chức" → chọn "Vị trí việc làm" → bấm biểu tượng cây bút (✎) ở vị trí muốn sửa.',
        whatToType:
          'Tại cột "Số lượng (hiện tại / tối đa)", bạn gõ số lượng định biên tối đa mới vào ô số bên phải dấu gạch chéo (ví dụ: đổi từ 2 lên 5), chọn Bằng cấp, Chuyên môn, Nơi làm việc rồi bấm nút dấu tích màu tím (✓).',
        whatHappensNext:
          'Phần mềm lưu lại định biên mới và đổi màu thẻ số lượng (Màu xanh lá là còn chỉ tiêu, màu cam/đỏ là đã đủ hoặc vượt định biên).',
      },
    ],
    inputGuides: [
      {
        fieldName: 'Mã viết tắt (Mã phòng / Mã chức vụ / Mã vị trí)',
        requiredText: 'Bắt buộc',
        exampleText: 'Ví dụ: VP, P.KHTC, CV, TP, CNTT',
        explainText: 'Viết tắt ngắn gọn, không trùng nhau để phần mềm nhận diện nhanh khi nhập từ file Excel.',
      },
      {
        fieldName: 'Phạm vi xem dữ liệu (Tại mục Chức vụ)',
        requiredText: 'Bắt buộc',
        exampleText: 'Toàn cơ quan / Phòng ban / Cá nhân',
        explainText:
          'Giúp bảo mật thông tin: Trưởng phòng chỉ thấy nhân sự của phòng mình, Chuyên viên chỉ thấy thông tin cá nhân của mình.',
      },
      {
        fieldName: 'Làm việc giờ hành chính (Tại mục Nơi làm việc)',
        requiredText: 'Chọn Có hoặc Không',
        exampleText: 'Trụ sở chính: Bật (Có) | Khu liên hợp/Công trường: Tắt (Không)',
        explainText: 'Để phân biệt nơi làm giờ hành chính cố định với nơi phải xếp lịch trực theo ca sáng/chiều/đêm.',
      },
    ],
    importantNotes: [
      'Để tránh mất dữ liệu nhầm lẫn, nếu một Phòng ban hoặc một Vị trí việc làm đang có nhân sự làm việc bên trong thì phần mềm sẽ không cho xóa cho đến khi bạn chuyển hết nhân sự sang phòng khác.',
    ],
    commonQuestions: [
      {
        question: 'Tôi muốn nhập hàng loạt danh sách Vị trí việc làm từ file Excel có được không?',
        answer:
          'Được! Tại màn hình "Vị trí việc làm", bạn bấm nút "Nhập Excel" ở góc trên bên phải, có thể bấm "Tải file mẫu" về điền rồi tải lên là xong.',
      },
    ],
  },
  {
    id: 'employee-and-contract',
    numberLabel: 'PHẦN 3',
    title: 'Quản lý Danh sách Nhân sự, Nhập từ Excel, Tạo Tài khoản Hàng loạt & Hợp đồng Lao động',
    subtitle: 'Cách thêm nhân sự mới, xem trước và nạp danh sách từ Excel, chỉnh sửa bằng hộp thoại và quản lý hợp đồng',
    category: 'ORG_HR',
    badgeColor: '#059669',
    route: ROUTES.EMPLOYEES,
    whoShouldRead: ['Cán bộ Tổ chức - Hành chính', 'Ban Giám đốc', 'Trưởng/Phó các phòng'],
    summaryForBeginner:
      'Đây là nơi quản lý danh sách toàn bộ cán bộ, viên chức và người lao động trong cơ quan. Bạn có thể thêm từng người, hoặc nạp một lần cả trăm người từ file Excel, tạo tài khoản đăng nhập hàng loạt và quản lý hợp đồng lao động.',
    whereToFindOnScreen: [
      'Vào menu bên trái "Nhân sự" → gồm 3 mục con:',
      '1. "Nhân sự hiện có": Danh sách tất cả cán bộ đang công tác tại đơn vị.',
      '2. "Nhân sự đã nghỉ": Lưu trữ hồ sơ những người đã nghỉ hưu, chuyển công tác hoặc thôi việc.',
      '3. "Hợp đồng lao động": Quản lý hợp đồng thử việc, hợp đồng có thời hạn, không thời hạn và các phụ lục hợp đồng.',
    ],
    stepByStepGuides: [
      {
        stepTitle: 'Thao tác 1: Nhập danh sách nhân sự hàng loạt từ File Excel (Có bảng Xem trước)',
        whereToClick:
          'Tại màn hình "Nhân sự → Nhân sự hiện có", bấm nút "Nhập" ở góc trên bên phải màn hình.',
        whatToType:
          'Kéo thả hoặc bấm chọn file Excel danh sách nhân sự từ máy tính của bạn. Ngay lập tức, hộp thoại sẽ mở rộng ra và hiện "Bảng Xem Trước" toàn bộ danh sách nhân sự trong file (Họ tên, Mã NV, Phòng ban, Chức vụ, Số CCCD, Điện thoại, Email) để bạn kiểm tra. Kiểm tra xong, bạn bấm nút màu tím "Xác nhận Import" ở góc dưới bên phải.',
        whatHappensNext:
          'Toàn bộ nhân sự trong file Excel sẽ được nạp vào phần mềm, đồng thời tự động tạo sẵn Hồ sơ Lý lịch Bộ Nội vụ kèm số CCCD, SĐT và Email công vụ cho từng người.',
      },
      {
        stepTitle: 'Thao tác 2: Thêm mới hoặc Chỉnh sửa thông tin một nhân sự (Hiển thị Hộp thoại rõ ràng)',
        whereToClick:
          'Để thêm người mới, bấm nút màu tím "+ Thêm" ở góc phải trên cùng. Để sửa thông tin một người, bấm vào biểu tượng cây bút (✎) ở cột "Hành động" cuối dòng của người đó.',
        whatToType:
          'Một hộp thoại "Chỉnh sửa nhân sự" sẽ hiện ra giữa màn hình. Bạn chọn hoặc sửa lại Mã nhân viên, Họ và tên, Phòng ban, Chức vụ, Vị trí việc làm, Nơi làm việc, Ngày vào làm, Số điện thoại, Email công vụ rồi bấm nút "Lưu thay đổi".',
        whatHappensNext: 'Thông tin của nhân sự được cập nhật ngay lập tức trên bảng danh sách.',
      },
      {
        stepTitle: 'Thao tác 3: Tạo tài khoản đăng nhập hàng loạt & Xuất file Excel mật khẩu',
        whereToClick:
          'Tại bảng "Nhân sự hiện có", tích vào các ô vuông ở đầu dòng của những nhân sự chưa có tài khoản (hoặc tích ô trên cùng để chọn tất cả). Một thanh công cụ nổi sẽ hiện lên ở dưới đáy màn hình → bấm nút màu tím "Tạo tài khoản".',
        whatToType: 'Không cần gõ gì cả, phần mềm tự động đặt tên đăng nhập và sinh mật khẩu ngẫu nhiên an toàn cho từng người.',
        whatHappensNext:
          'Phần mềm tự động tải về máy tính của bạn một file Excel có tên "taikhoan_nhanvien_....xlsx" chứa danh sách Họ tên, Tên đăng nhập và Mật khẩu để bạn gửi cho từng cán bộ.',
      },
      {
        stepTitle: 'Thao tác 4: Lập Hợp đồng Lao động & Phụ lục Hợp đồng',
        whereToClick: 'Vào menu bên trái "Nhân sự" → chọn "Hợp đồng lao động" → bấm nút "+ Thêm hợp đồng".',
        whatToType:
          'Chọn tên nhân sự, Loại hợp đồng (Thử việc / Xác định thời hạn / Không xác định thời hạn), Số hợp đồng, Ngày ký, Ngày bắt đầu, Ngày kết thúc và Mức lương. Khi có quyết định thay đổi lương hoặc gia hạn, bạn bấm vào hợp đồng đó và chọn "Thêm phụ lục".',
        whatHappensNext:
          'Hợp đồng được lưu giữ đầy đủ và tự động báo nhắc trên bảng tổng hợp khi sắp đến ngày hết hạn hợp đồng.',
      },
    ],
    inputGuides: [
      {
        fieldName: 'Mã nhân viên',
        requiredText: 'Nên có (Hoặc để trống tự tạo)',
        exampleText: 'Ví dụ: MBS-001, MBS-002',
        explainText: 'Mã số riêng của từng cán bộ trong đơn vị.',
      },
      {
        fieldName: 'Phòng ban & Chức vụ',
        requiredText: 'Bắt buộc chọn Phòng ban',
        exampleText: 'Ví dụ: Văn phòng — Chuyên viên',
        explainText: 'Khi nhập từ file Excel, nếu gặp chức vụ mới chưa có trong danh mục, phần mềm sẽ tự động thêm chức vụ đó giúp bạn.',
      },
    ],
    importantNotes: [
      'Khi một cán bộ nghỉ hưu hoặc thôi việc, bạn bấm biểu tượng thùng rác đỏ ở cuối dòng để chọn lý do nghỉ (Nghỉ hưu / Tự nguyện nghỉ việc / Hết hợp đồng). Hồ sơ của họ không bị mất đi mà được chuyển sang mục "Nhân sự đã nghỉ", đồng thời lịch trực tương lai của họ bên phần mềm Lịch cũng được tự động hủy.',
    ],
    commonQuestions: [
      {
        question: 'Nếu tôi lỡ bấm Import cùng một file Excel 2 lần thì danh sách nhân sự có bị nhân đôi (trùng lặp) không?',
        answer:
          'Không bị trùng! Phần mềm đã được trang bị tính năng thông minh: Nếu thấy Mã nhân viên hoặc Email công vụ đã có trong hệ thống rồi thì phần mềm chỉ cập nhật bổ sung thông tin mới nhất cho người đó chứ không tạo ra 2 dòng trùng nhau.',
      },
    ],
  },
  {
    id: 'bnv-official-profile',
    numberLabel: 'PHẦN 4',
    title: 'Hồ sơ Lý lịch Viên chức Chuẩn Bộ Nội vụ (2 Mẫu Song song) — Nhập từ File Word & Tải/In File Word Giống Mẫu Gốc',
    subtitle: 'Hướng dẫn kê khai, nạp tự động từ file Word có sẵn và in/tải về đúng 2 biểu mẫu quy định của Bộ Nội vụ',
    category: 'PROFILE_BNV',
    badgeColor: '#0284c7',
    route: ROUTES.PERSONNEL_PROFILES,
    whoShouldRead: ['Tất cả Cán bộ, Viên chức (tự cập nhật hồ sơ của mình)', 'Cán bộ Tổ chức - Hành chính'],
    summaryForBeginner:
      'Thay vì phải gõ đi gõ lại trên nhiều file Word rời rạc, mục này lưu trữ hồ sơ lý lịch của từng viên chức theo đúng 2 biểu mẫu chuẩn của Bộ Nội vụ trên 2 Tab cạnh nhau: (1) Sơ yếu lý lịch 38 mục (theo Thông tư 06/2023/TT-BNV) và (2) Lý lịch viên chức Mẫu HS01-VC/BNV (theo Thông tư 07/2019/TT-BNV). Đặc biệt, bạn có thể lấy file Word Sơ yếu lý lịch đang có sẵn trên máy tính nạp thẳng vào phần mềm, và khi cần nộp hồ sơ giấy thì bấm tải file Word hoặc In ra giấy giống hệt 100% mẫu gốc của Bộ Nội vụ.',
    whereToFindOnScreen: [
      'Vào menu bên trái "Hồ sơ lý lịch (BNV)" → chọn "Danh sách hồ sơ".',
      'Bấm nút "Hồ sơ lý lịch của tôi" (ở góc trên bên phải) để mở hồ sơ của chính bạn, hoặc bấm nút "Hồ sơ 2 Mẫu (TT06 & HS01)" ở cuối dòng của bất kỳ viên chức nào.',
      'Bên trong trang chi tiết hồ sơ có 2 nút Tab lớn nằm ngang để bạn chuyển đổi qua lại:',
      '• Tab 1: "Hồ sơ 1: SƠ YẾU LÝ LỊCH (Mẫu TT 06/2023/TT-BNV — 38 Mục)"',
      '• Tab 2: "Hồ sơ 2: LÝ LỊCH VIÊN CHỨC (Mẫu HS01-VC/BNV — TT 07/2019/TT-BNV)"',
    ],
    stepByStepGuides: [
      {
        stepTitle: 'Cách 1: Nạp tự động toàn bộ thông tin từ File Word Sơ yếu lý lịch có sẵn trên máy tính',
        whereToClick:
          'Mở trang chi tiết Hồ sơ lý lịch của viên chức → Nhìn lên hàng nút ở góc trên cùng bên phải → Bấm nút "Import từ File Word (.doc / .docx)".',
        whatToType:
          'Chọn file Word Sơ yếu lý lịch (Mẫu TT06) hoặc Lý lịch viên chức (Mẫu HS01) từ máy tính của bạn. Phần mềm sẽ tự động đọc file Word và mở ra một bảng "Xem trước thông tin đọc được từ file Word" (bao gồm cả Họ tên, Ngày sinh, Quê quán, CCCD, BHXH, Đảng/Đoàn, Ngạch lương và cả 5 bảng Đào tạo, Công tác, Diễn biến lương, Gia đình). Bạn kiểm tra lại rồi bấm nút "Áp dụng vào Hồ sơ".',
        whatHappensNext:
          'Toàn bộ 38 mục thông tin và các bảng quá trình từ file Word được điền tự động vào phần mềm chỉ trong vài giây mà bạn không phải gõ tay từng chữ.',
      },
      {
        stepTitle: 'Cách 2: Tự nhập hoặc sửa thông tin trên màn hình (Nhập 1 nơi, tự động có ở cả 2 Mẫu)',
        whereToClick:
          'Bạn có thể đứng ở Tab Hồ sơ 1 (Mẫu TT06) hoặc Tab Hồ sơ 2 (Mẫu HS01), bấm vào các mục (Mục 1→18, Mục 19→31, Mục 32→38) để điền thông tin hoặc bấm nút "+ Thêm dòng" ở các bảng Đào tạo, Công tác, Quan hệ gia đình. Làm xong bấm nút màu tím "Lưu Hồ sơ (Đồng bộ 2 Tab)" ở góc trên bên phải.',
        whatToType:
          'Điền thông tin thực tế của cán bộ. Những thông tin chung như Họ tên, Ngày sinh, Số CCCD, Số sổ BHXH, Số thẻ BHYT, Quê quán, Nơi ở, Ngày vào Đảng, Ngạch/Hạng viên chức, Bậc lương, Hệ số lương... bạn chỉ cần nhập ở Tab 1 là Tab 2 cũng tự động có sẵn.',
        whatHappensNext:
          'Phần mềm lưu lại cả 2 mẫu hồ sơ và tự động tính phần trăm (%) mức độ hoàn thiện hồ sơ của cán bộ đó.',
      },
      {
        stepTitle: 'Cách 3: Tải về File Word (.doc) hoặc In ra giấy A4 giống hệt mẫu Bộ Nội vụ',
        whereToClick:
          'Nhìn lên góc trên cùng bên phải trang Hồ sơ lý lịch: Bấm nút "Tải File Word (.doc) ▾" để chọn tải Mẫu TT06/2023 hoặc Mẫu HS01-VC/BNV về máy tính; hoặc bấm nút "In biểu mẫu đang chọn" để in ngay ra máy in.',
        whatToType: 'Không cần căn chỉnh gì thêm.',
        whatHappensNext:
          'Khi bấm "Tải File Word", máy tính sẽ tải về 1 file Word (.doc) có sẵn khung ảnh 4x6cm, quốc hiệu tiêu ngữ, phông chữ Times New Roman, các dòng chấm điền thông tin và các bảng kẻ khung giống hệt như 2 file Word mẫu của Bộ Nội vụ. Khi bấm "In biểu mẫu", cửa sổ máy in sẽ hiện ra đúng trang văn bản chuẩn A4 (không bị dính thanh menu của trang web).',
      },
    ],
    inputGuides: [
      {
        fieldName: 'Ảnh chân dung 4x6',
        requiredText: 'Khuyến nghị nên tải lên',
        exampleText: 'File ảnh .jpg hoặc .png chụp chính diện cỡ 4x6cm',
        explainText: 'Bấm nút "Tải ảnh 4x6" dưới khung ảnh bên trái để ảnh hiển thị đẹp trên hồ sơ và khi xuất/in ra giấy.',
      },
      {
        fieldName: 'Ngạch / Hạng chức danh nghề nghiệp & Bậc/Hệ số lương',
        requiredText: 'Rất quan trọng',
        exampleText: 'Ví dụ: Chuyên viên (01.003) — Bậc 4 — Hệ số 3.33 — Ngày hưởng: 28/11/2023',
        explainText: 'Điền đúng mục này để phần mềm tự động tính ngày đến hạn nâng bậc lương lần tiếp theo cho bạn.',
      },
    ],
    importantNotes: [
      'Khi bạn cần thay đổi, chỉnh sửa nhỏ trước khi trình ký đóng dấu, bạn chỉ cần bấm "Tải File Word (.doc)" về mở trên phần mềm Microsoft Word quen thuộc là có thể gõ thêm hoặc căn chỉnh tùy ý.',
    ],
    commonQuestions: [
      {
        question: 'Tại sao tôi sửa Số CCCD hay Bậc lương ở Hồ sơ 1 (Mẫu TT06) mà sang Hồ sơ 2 (Mẫu HS01) đã thấy đổi theo rồi?',
        answer:
          'Đó là tính năng Đồng bộ Tự động 2 Chiều của phần mềm! Giúp cán bộ không bao giờ phải nhập 2 lần cho cùng một thông tin cá nhân và đảm bảo số liệu giữa 2 mẫu lý lịch luôn khớp nhau 100%.',
      },
    ],
  },
  {
    id: 'salary-alert-and-360-map',
    numberLabel: 'PHẦN 5',
    title: 'Cảnh báo Tự động Nâng bậc lương, Bổ nhiệm lại & Xem Sơ đồ Cá nhân 360°',
    subtitle: 'Cách theo dõi ai sắp đến hạn nâng lương, xử lý duyệt quyết định mới và nhìn nhanh bức tranh toàn cảnh của từng cán bộ',
    category: 'ALERT_SALARY',
    badgeColor: '#d97706',
    route: ROUTES.PERSONNEL_ALERTS,
    whoShouldRead: ['Ban Giám đốc', 'Trưởng/Phó phòng Tổ chức - Hành chính', 'Chuyên viên phụ trách chế độ tiền lương'],
    summaryForBeginner:
      'Trước đây cán bộ Tổ chức phải mở từng sổ lương để dò xem tháng này ai đủ 3 năm (36 tháng) hoặc 2 năm (24 tháng) để nâng bậc lương, ai sắp hết nhiệm kỳ bổ nhiệm 5 năm. Bây giờ phần mềm sẽ tự động tính toán và báo nhắc trước cho bạn theo từng bước xử lý, đồng thời vẽ Sơ đồ Cá nhân 360° giúp nhìn ngay từng người đã là Viên chức chưa, đã vào Đảng chưa và có hồ sơ nào sắp tới hạn không.',
    whereToFindOnScreen: [
      'Vào menu bên trái "Cảnh báo nghiệp vụ" → có 3 mục xem trực quan:',
      '1. "Danh sách cảnh báo": Bàn làm việc theo dõi từng người sắp đến hạn nâng lương thường xuyên, vượt khung, nâng lương trước hạn hoặc bổ nhiệm lại.',
      '2. "Thống kê & Sơ đồ": Biểu đồ thống kê số lượng hồ sơ đến hạn theo từng phòng ban và từng tháng.',
      '3. "Sơ đồ Cá nhân (360°)": Màn hình hiển thị thẻ sơ đồ nhánh của từng cán bộ trong cơ quan.',
    ],
    stepByStepGuides: [
      {
        stepTitle: 'Bước 1: Xem danh sách ai sắp đến hạn nâng lương hoặc bổ nhiệm lại',
        whereToClick:
          'Vào "Cảnh báo nghiệp vụ → Danh sách cảnh báo". Nếu vừa mới cập nhật thêm nhiều hồ sơ nhân sự mới, bạn bấm nút "Rà soát ngay" ở thanh góc trên bên phải.',
        whatToType:
          'Bạn có thể bấm vào các thẻ lọc nhanh như "Đang quá hạn", "Đến hạn <= 30 ngày", "Nâng lương thường xuyên", "Phụ cấp vượt khung", "Bổ nhiệm lại" để lọc đúng nhóm hồ sơ cần giải quyết.',
        whatHappensNext:
          'Bảng danh sách hiện rõ tên từng viên chức, bậc/hệ số lương hiện tại, bậc/hệ số lương đề xuất mới, ngày đến hạn hưởng chế độ và còn bao nhiêu ngày nữa là tới hạn.',
      },
      {
        stepTitle: 'Bước 2: Xử lý hồ sơ theo 4 bước (Từ lúc lập danh sách đến khi có Quyết định mới)',
        whereToClick:
          'Tại cột "Thao tác Duyệt / Gia hạn / Từ chối" ở bên phải mỗi dòng cảnh báo:',
        whatToType:
          '• Khi bắt đầu đưa vào danh sách trình Hội đồng lương: Tích chọn hồ sơ và bấm nút "Chuyển Bước 2: Đang lập HS".\n• Khi Hội đồng đã họp xong chờ ký QĐ: Bấm "Chuyển Bước 3: Chờ ban hành QĐ".\n• Khi Lãnh đạo đã ký Quyết định nâng lương chính thức: Bấm nút màu xanh lá "Duyệt & Ban hành QĐ (B4)", nhập Số Quyết định, Ngày ký, Ngày hưởng mới rồi bấm Xác nhận.',
        whatHappensNext:
          'Ngay khi bạn bấm Duyệt Bước 4, phần mềm sẽ TỰ ĐỘNG nâng Bậc lương mới, Hệ số lương mới vào thẳng Hồ sơ lý lịch của viên chức đó và tự ghi thêm 1 dòng vào bảng Quá trình diễn biến lương mà bạn không phải mở hồ sơ ra gõ lại!',
      },
      {
        stepTitle: 'Bước 3: Xử lý khi cần Gia hạn chờ họp Hội đồng hoặc Từ chối / Lùi hạn do kỷ luật',
        whereToClick:
          'Nếu chưa kịp họp Hội đồng đúng ngày, bấm nút "Gia hạn". Nếu viên chức bị kỷ luật hoặc không hoàn thành nhiệm vụ phải kéo dài thời gian nâng lương, bấm nút màu đỏ "Từ chối".',
        whatToType:
          '• Khi bấm "Gia hạn": Chọn ngày hẹn xử lý mới và nhập lý do (ví dụ: Chờ họp Hội đồng lương quý IV). Lưu ý: Gia hạn này chỉ dời ngày nhắc việc cho phòng Tổ chức, còn ngày hưởng lương trên quyết định của viên chức vẫn được bảo lưu nguyên vẹn!\n• Khi bấm "Từ chối": Chọn số tháng bị kéo dài (+3 tháng Khiển trách, +6 tháng Cảnh cáo, +12 tháng Cách chức/Không hoàn thành nhiệm vụ) và nhập lý do.',
        whatHappensNext:
          'Phần mềm tự động tính lại ngày đến hạn mới và lưu toàn bộ lịch sử thao tác vào nút "Lịch sử" để tra cứu lại bất cứ lúc nào.',
      },
      {
        stepTitle: 'Bước 4: Xem "Sơ đồ Cá nhân (360°)" của từng người',
        whereToClick:
          'Vào menu bên trái "Cảnh báo nghiệp vụ → Sơ đồ Cá nhân (360°)" (hoặc bấm nút Tab "Sơ đồ Cá nhân (360°)" ở góc trên bên phải màn hình Cảnh báo).',
        whatToType:
          'Bạn có thể gõ tên cán bộ vào ô tìm kiếm, lọc theo Phòng ban hoặc bấm vào các nút lọc nhanh: "Đã là Viên chức", "Chưa là Viên chức", "Đảng viên ĐCSVN", "Có hồ sơ sắp đến hạn".',
        whatHappensNext:
          'Mỗi cán bộ được hiển thị trên một thẻ Sơ đồ nhánh trực quan giúp bạn nhìn thấy ngay lập tức 3 thông tin quan trọng nhất: (1) Đã vào biên chế Viên chức hay chưa, (2) Đã vào Đảng Cộng sản Việt Nam hay chưa, và (3) Có hồ sơ nâng lương/bổ nhiệm lại nào sắp tới hạn hay không.',
      },
    ],
    inputGuides: [
      {
        fieldName: 'Số Quyết định & Ngày hiệu lực (Khi bấm Duyệt Bước 4)',
        requiredText: 'Bắt buộc khi duyệt QĐ',
        exampleText: 'Ví dụ: Số 456/QĐ-MBS — Ngày hưởng: 01/12/2026',
        explainText: 'Thông tin này sẽ được lưu trực tiếp vào bảng Quá trình lương trong Hồ sơ Lý lịch Bộ Nội vụ của viên chức.',
      },
    ],
    importantNotes: [
      'Mọi thông tin trên Sơ đồ Cá nhân 360° và Danh sách cảnh báo đều lấy 100% từ dữ liệu thực tế hiện có của cơ quan, không có dữ liệu ảo.',
      'Bạn có thể bấm nút màu xanh lá "Xuất biểu mẫu (Tờ trình)" ở góc trên bên phải để tải file danh sách tổng hợp những người đến kỳ nâng lương trình Lãnh đạo và Hội đồng xét duyệt.',
    ],
    commonQuestions: [
      {
        question: 'Tại sao một nhân sự mới nhập vào chưa thấy hiện trong Danh sách cảnh báo nâng lương?',
        answer:
          'Vì phần mềm cần biết người đó đang hưởng Bậc lương mấy và Ngày bắt đầu hưởng bậc lương đó là ngày nào để cộng thêm 3 năm (36 tháng). Bạn chỉ cần mở Hồ sơ lý lịch của người đó, điền "Bậc lương", "Hệ số lương" và "Ngày hưởng" rồi quay lại bấm "Rà soát ngay" là sẽ hiện lên đầy đủ.',
      },
    ],
  },
  {
    id: 'mobile-specialist-guide',
    numberLabel: 'PHẦN 6',
    title: 'Hướng dẫn Sử dụng Giao diện Điện thoại dành cho Chuyên viên & Nhân viên',
    subtitle: 'Cách xem lịch cá nhân, làm đơn xin nghỉ phép, đăng ký làm thêm giờ (OT) và tải Sơ yếu lý lịch Word ngay trên điện thoại',
    category: 'MOBILE_APP',
    badgeColor: '#9333ea',
    route: ROUTES.MOBILE_ESS,
    whoShouldRead: ['Toàn thể Chuyên viên, Nhân viên, Kế toán viên, Cán sự, Người lao động'],
    summaryForBeginner:
      'Khi bạn là Chuyên viên hoặc Nhân viên và đăng nhập vào phần mềm bằng Điện thoại di động, hệ thống sẽ tự động mở ra Cổng Điện thoại Cá nhân. Tại đây bạn chỉ nhìn thấy những thông tin của riêng mình, thao tác cực kỳ đơn giản bằng ngón cái với 5 nút ở thanh dưới cùng màn hình điện thoại.',
    whereToFindOnScreen: [
      'Thanh điều hướng 5 nút ở dưới đáy màn hình điện thoại:',
      '1. Nút "🏠 Trang chủ": Xem Thẻ Định danh Viên chức của bạn, số ngày phép năm còn lại, số giờ đã làm thêm trong tháng và 4 nút bấm nhanh.',
      '2. Nút "📅 Lịch của tôi": Xem lịch làm việc, lịch đi công tác, ngày nghỉ phép và ca làm thêm giờ của riêng bạn trong tuần/tháng.',
      '3. Nút tròn "➕ Đơn từ / OT" (Nằm nổi bật ở chính giữa): Bấm vào đây mỗi khi bạn muốn Làm đơn xin nghỉ phép, Đăng ký làm thêm giờ hoặc Thêm lịch công tác.',
      '4. Nút "🪪 Hồ sơ BNV": Xem thông tin lý lịch cá nhân và bấm tải File Word Sơ yếu lý lịch về điện thoại.',
      '5. Nút "👤 Cá nhân": Bật/tắt chế độ nền tối bảo vệ mắt và nút Đăng xuất.',
    ],
    stepByStepGuides: [
      {
        stepTitle: 'Việc 1: Làm Đơn Xin Nghỉ Phép trên Điện thoại (Chỉ mất 30 giây)',
        whereToClick:
          'Trên màn hình điện thoại, bấm vào nút "Xin nghỉ phép" ở Trang chủ (hoặc bấm nút tròn màu tím ➕ ở dưới đáy màn hình → chọn "1. Tạo Đơn Xin Nghỉ Phép").',
        whatToType:
          'Một bảng trượt từ dưới lên sẽ hiện ra:\n• Chọn "Loại hình nghỉ phép" (Nghỉ phép năm / Nghỉ việc riêng hưởng lương / Nghỉ ốm / Nghỉ bù / Nghỉ không lương).\n• Chọn ngày bắt đầu "Từ ngày" và "Đến hết ngày".\n• Chọn nghỉ "Cả ngày (1.0)", hoặc chỉ nghỉ "Buổi sáng (0.5)" / "Buổi chiều (0.5)". Phần mềm sẽ tự tính tổng số ngày nghỉ và báo cho bạn biết quỹ phép năm của bạn còn lại bao nhiêu ngày.\n• Gõ ngắn gọn "Lý do xin nghỉ phép", tên đồng nghiệp nhận bàn giao việc (nếu có) rồi bấm nút "Xác nhận Gửi Đơn Xin Nghỉ Phép".',
        whatHappensNext:
          'Đơn của bạn được gửi đi ngay và hiển thị trạng thái "Chờ phê duyệt". Nếu bạn đổi ý chưa muốn nghỉ nữa, chỉ cần bấm nút "Thu hồi đơn" ngay dưới thẻ đơn đó là số ngày phép được hoàn lại ngay.',
      },
      {
        stepTitle: 'Việc 2: Đăng Ký Làm Thêm Giờ (OT) trên Điện thoại',
        whereToClick:
          'Bấm vào nút "Đăng ký OT" ở Trang chủ (hoặc bấm nút tròn ➕ ở dưới đáy màn hình → chọn "2. Đăng Ký Làm Thêm Giờ").',
        whatToType:
          '• Chọn "Ngày làm thêm giờ" và "Loại ngày" (Ngày thường 150% / Thứ Bảy, Chủ Nhật 200% / Ngày Lễ, Tết 300%).\n• Chọn "Giờ bắt đầu" (ví dụ: 17:30) và "Giờ kết thúc" (ví dụ: 20:30) — phần mềm sẽ tự tính ra số giờ làm thêm (3.0 giờ).\n• Ghi rõ "Nội dung công việc giải quyết ngoài giờ" rồi bấm nút màu tím "Xác nhận Đăng Ký Làm Thêm Giờ".',
        whatHappensNext:
          'Phiếu đăng ký làm thêm giờ được lưu vào danh sách của bạn và tự động cộng vào thống kê số giờ làm thêm trong tháng trên Trang chủ.',
      },
      {
        stepTitle: 'Việc 3: Xem & Tải File Word Sơ yếu lý lịch Chuẩn Bộ Nội vụ về Điện thoại',
        whereToClick:
          'Bấm vào tab thứ 4 "🪪 Hồ sơ BNV" ở thanh dưới đáy màn hình điện thoại.',
        whatToType:
          'Bấm vào nút màu xanh dương "Tải Word TT06/2023" (để tải Sơ yếu lý lịch 38 mục) hoặc bấm nút màu xanh lá "Tải Word HS01-VC" (để tải Lý lịch viên chức). Bạn cũng có thể bấm mở từng mục bên dưới để kiểm tra thông tin CCCD, BHXH, Bậc lương, Hợp đồng của mình.',
        whatHappensNext:
          'Điện thoại sẽ tải về ngay file Word (.doc) lý lịch của riêng bạn để bạn gửi qua Zalo/Email hoặc kết nối máy in để in ngay khi cơ quan yêu cầu.',
      },
    ],
    inputGuides: [
      {
        fieldName: 'Khung thời gian nghỉ (Khi làm đơn nghỉ phép)',
        requiredText: 'Chọn 1 trong 3',
        exampleText: 'Cả ngày (1.0 ngày) | Buổi sáng (0.5 ngày) | Buổi chiều (0.5 ngày)',
        explainText: 'Nếu bạn chỉ xin nghỉ nửa ngày, hãy chọn Buổi sáng hoặc Buổi chiều để phần mềm chỉ trừ 0,5 ngày phép của bạn.',
      },
    ],
    importantNotes: [
      'Trên giao diện điện thoại này, mọi thông tin hoàn toàn bảo mật: Bạn chỉ nhìn thấy lịch, đơn nghỉ phép, phiếu làm thêm giờ và hồ sơ của chính bản thân bạn.',
    ],
    commonQuestions: [
      {
        question: 'Tôi tạo lịch công tác hoặc đơn trên điện thoại thì có làm ảnh hưởng hay xáo trộn dữ liệu quản trị trên Website của phòng Tổ chức không?',
        answer:
          'Hoàn toàn không ảnh hưởng! Phần mềm đã tách riêng khu vực lưu trữ của Cổng Điện thoại Cá nhân độc lập với hệ thống quản trị hồ sơ trên máy tính.',
      },
    ],
  },
  {
    id: 'calendar-work-guide',
    numberLabel: 'PHẦN 7',
    title: 'Phần mềm Quản lý Lịch trực Ca, Lịch họp, Duyệt Nghỉ phép & Làm thêm giờ',
    subtitle: 'Hướng dẫn xếp lịch trực tuần/tháng, sao chép lịch tuần trước, duyệt đơn nghỉ phép, duyệt OT và xuất báo cáo chấm công',
    category: 'CALENDAR_APP',
    badgeColor: '#4f46e5',
    whoShouldRead: ['Ban Giám đốc', 'Trưởng/Phó các phòng', 'Người đăng ký lịch tuần của phòng', 'Toàn thể Nhân sự'],
    summaryForBeginner:
      'Khi bạn bấm chuyển từ nút "🏛️ HR Core ▾" sang "📅 Quản lý Lịch (Calendar)", bạn sẽ vào khu vực chuyên dùng để xếp lịch trực ca cho các Khu liên hợp/Văn phòng, lên lịch họp cơ quan, quản lý quỹ phép năm, duyệt đơn xin nghỉ phép, duyệt đăng ký làm thêm giờ và xuất bảng tổng hợp giờ công cuối tháng.',
    whereToFindOnScreen: [
      'Thanh Menu bên trái của phần mềm Quản lý Lịch gồm các mục rất dễ nhìn:',
      '1. "Tổng quan": Xem nhanh hôm nay có những ai trực, có cuộc họp nào và có bao nhiêu đơn đang chờ duyệt.',
      '2. "Lịch công tác → Trực ca": Gồm Lịch trực tháng/tuần, Xem theo từng người, Phê duyệt lịch trực và Thống kê.',
      '3. "Lịch công tác → Lịch họp": Đăng ký và theo dõi các cuộc họp định kỳ hoặc họp đột xuất.',
      '4. "Lịch công tác → Thêm giờ": Đăng ký làm thêm giờ, xem lịch sử và thống kê số giờ làm thêm.',
      '5. "Lịch công tác → Nghỉ phép": Đăng ký nghỉ phép, xem lịch sử và bảng thống kê quỹ phép năm của từng người.',
      '6. "Báo cáo → Tổng hợp giờ": Bảng tổng hợp toàn bộ ngày công, giờ trực, giờ làm thêm cuối tháng để xuất ra Excel.',
    ],
    stepByStepGuides: [
      {
        stepTitle: 'Công việc 1: Xếp lịch trực ca & Mẹo "Sao chép tuần trước" cực nhanh',
        whereToClick:
          'Vào menu "Lịch công tác → Trực ca → Lịch trực". Chọn Phòng ban ở góc trên.',
        whatToType:
          '• Để xếp ca trực cho từng ngày: Bấm vào ngày đó trên lịch, chọn tên nhân viên và chọn Ca trực (Hành chính sáng, Hành chính chiều, Ca sáng, Ca chiều, Ca đêm...).\n• Mẹo làm nhanh trong 3 giây: Nếu lịch trực tuần này tương tự như tuần trước, bạn nhìn sang cột bên phải màn hình, chọn tuần mới rồi bấm nút "Sao chép tuần trước". Toàn bộ ca trực của tuần trước sẽ được chép sang tuần này, bạn chỉ việc sửa lại một vài chỗ thay đổi rồi bấm "Gửi duyệt".',
        whatHappensNext:
          'Lãnh đạo phòng vào mục "Trực ca → Phê duyệt", tích chọn tất cả và bấm "Duyệt hàng loạt" là lịch trực chính thức có hiệu lực.',
      },
      {
        stepTitle: 'Công việc 2: Quản lý Quỹ phép năm & Kết chuyển phép tồn năm cũ sang năm mới',
        whereToClick:
          'Vào menu "Lịch công tác → Nghỉ phép → Thống kê".',
        whatToType:
          '• Khi mới vừa nhập thêm nhân sự mới bên phần mềm Nhân sự, bạn bấm nút "Đồng bộ quỹ phép" để phần mềm cấp đủ 12 ngày phép năm tiêu chuẩn cho các nhân sự mới.\n• Vào dịp đầu năm mới, bạn bấm nút "Kết chuyển phép tồn" để phần mềm tự động chuyển số ngày phép năm cũ chưa nghỉ hết của cán bộ sang năm mới (tối đa chuyển sang không quá 5 ngày/người).',
        whatHappensNext:
          'Bảng thống kê sẽ hiện rõ từng người: Tổng phép được cấp, Số ngày đã nghỉ, Số ngày phép còn lại và có nút "Xuất Excel" để in báo cáo.',
      },
      {
        stepTitle: 'Công việc 3: Đăng ký & Duyệt Làm thêm giờ (Tự động báo nếu bị trùng giờ trực hoặc ngày nghỉ)',
        whereToClick:
          'Vào menu "Lịch công tác → Thêm giờ → Đăng ký thêm giờ" → bấm nút "+ Đăng ký thêm giờ".',
        whatToType:
          'Chọn Tên nhân viên, Ngày làm thêm, Giờ bắt đầu, Giờ kết thúc và Lý do làm thêm. Ngay khi bạn vừa chọn giờ xong, phần mềm sẽ tự động kiểm tra giúp bạn: Nếu giờ đó nhân viên đang có ca trực chính khóa hoặc đang trong ngày nghỉ phép, phần mềm sẽ hiện dòng chữ cảnh báo màu vàng ngay trên màn hình để tránh chấm công trùng!',
        whatHappensNext:
          'Đồng thời màn hình cũng hiện rõ nhân viên này đã làm thêm bao nhiêu giờ trong tháng và trong năm để đảm bảo không vượt quá quy định của Luật Lao động.',
      },
      {
        stepTitle: 'Công việc 4: Xuất Báo cáo Tổng hợp Giờ công cuối tháng ra Excel',
        whereToClick:
          'Cuối mỗi tháng, vào menu bên trái "Báo cáo → Tổng hợp giờ".',
        whatToType:
          'Chọn Tháng, Năm và Phòng ban cần xem rồi bấm nút "Xuất Excel" ở góc phải.',
        whatHappensNext:
          'Phần mềm tự động cộng tổng số ca trực ngày thường, ca đêm, ca cuối tuần, ca lễ tết, số giờ làm thêm đã duyệt và số ngày nghỉ phép của từng người thành bảng Excel hoàn chỉnh phục vụ chấm công và tính lương.',
      },
    ],
    inputGuides: [
      {
        fieldName: 'Lọc theo Phòng ban',
        requiredText: 'Tùy chọn',
        exampleText: 'Chọn 1 hoặc nhiều phòng ban trên thanh công cụ',
        explainText: 'Giúp Trưởng phòng hoặc cán bộ chấm công chỉ xem gọn danh sách của phòng ban mình phụ trách.',
      },
    ],
    importantNotes: [
      'Chỉ những ca trực, đơn nghỉ phép và phiếu làm thêm giờ đã được Lãnh đạo bấm "Phê duyệt" (màu xanh lá) mới được cộng vào Bảng Báo cáo Tổng hợp Giờ công cuối tháng.',
    ],
    commonQuestions: [
      {
        question: 'Tại sao một cán bộ mới đăng nhập vào phần mềm Quản lý Lịch mà chưa thấy hiện mục "Trực ca" hay "Nghỉ phép" ở menu bên trái?',
        answer:
          'Vì Chức vụ của cán bộ đó mới vừa được tạo nên chưa được tích bật quyền xem Lịch. Người Quản trị (Admin) chỉ cần vào menu "Hệ thống → Phân quyền" ở góc dưới bên trái màn hình Quản lý Lịch, tìm đến dòng Chức vụ đó và tích bật các ô "Xem lịch", "Nghỉ phép", "Thêm giờ" là thấy ngay lập tức!',
      },
    ],
  },
];

const BNV_SALARY_SIMPLE_TABLE = [
  {
    key: '1',
    rank: 'Viên chức Hạng I (Chuyên viên cao cấp & tương đương)',
    code: 'Mã 01.001',
    cycle: 'Đủ 3 năm (36 tháng) nâng 1 bậc',
    maxSteps: 'Gồm 6 bậc lương (Hệ số từ 6,20 đến 8,00)',
    exceedRule: 'Khi đã ở Bậc 6 đủ 3 năm thì được hưởng 5% Phụ cấp vượt khung; sau đó cứ mỗi năm cộng thêm 1%.',
  },
  {
    key: '2',
    rank: 'Viên chức Hạng II (Chuyên viên chính & tương đương)',
    code: 'Mã 01.002',
    cycle: 'Đủ 3 năm (36 tháng) nâng 1 bậc',
    maxSteps: 'Gồm 8 bậc lương (Hệ số từ 4,40 đến 6,78)',
    exceedRule: 'Khi đã ở Bậc 8 đủ 3 năm thì được hưởng 5% Phụ cấp vượt khung; sau đó cứ mỗi năm cộng thêm 1%.',
  },
  {
    key: '3',
    rank: 'Viên chức Hạng III (Chuyên viên & tương đương - Trình độ Đại học)',
    code: 'Mã 01.003',
    cycle: 'Đủ 3 năm (36 tháng) nâng 1 bậc',
    maxSteps: 'Gồm 9 bậc lương (Hệ số từ 2,34 đến 4,98)',
    exceedRule: 'Khi đã ở Bậc 9 đủ 3 năm thì được hưởng 5% Phụ cấp vượt khung; sau đó cứ mỗi năm cộng thêm 1%.',
  },
  {
    key: '4',
    rank: 'Viên chức Hạng IV (Cán sự, Kỹ thuật viên - Cao đẳng / Trung cấp)',
    code: 'Mã 01.004',
    cycle: 'Đủ 2 năm (24 tháng) nâng 1 bậc',
    maxSteps: 'Gồm 12 bậc lương (Hệ số từ 1,86 đến 4,06)',
    exceedRule: 'Khi đã ở Bậc 12 đủ 2 năm thì được hưởng 5% Phụ cấp vượt khung; sau đó cứ mỗi năm cộng thêm 1%.',
  },
];

export const SystemUserGuidePage: React.FC = () => {
  useSetPageTitle('Cẩm nang Hướng dẫn Sử dụng Phần mềm (Dễ hiểu cho mọi Cán bộ)');
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FRIENDLY_GUIDE_MODULES.filter((m) => {
      if (selectedCategory !== 'ALL' && m.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        m.numberLabel,
        m.title,
        m.subtitle,
        m.summaryForBeginner,
        ...m.whoShouldRead,
        ...m.whereToFindOnScreen,
        ...m.importantNotes,
        ...m.stepByStepGuides.map((s) => `${s.stepTitle} ${s.whereToClick} ${s.whatToType} ${s.whatHappensNext}`),
        ...m.inputGuides.map((f) => `${f.fieldName} ${f.exampleText} ${f.explainText}`),
        ...m.commonQuestions.map((c) => `${c.question} ${c.answer}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery, selectedCategory]);

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const subtleBg = isDark ? 'rgba(15, 23, 42, 0.55)' : '#f8fafc';
  const borderCol = isDark ? '#334155' : '#e2e8f0';

  const roleSimpleTableData = [
    {
      key: '1',
      role: 'Ban Giám đốc & Quản trị viên',
      whatCanDo: 'Xem và quản lý toàn bộ các phòng ban trong cơ quan; phê duyệt lịch trực, nghỉ phép, làm thêm giờ và quyết định nâng lương.',
      onComputer: 'Sử dụng đầy đủ tất cả các mục trên màn hình máy tính.',
      onPhone: 'Mở trên điện thoại vẫn xem được đầy đủ giao diện quản lý của Lãnh đạo.',
    },
    {
      key: '2',
      role: 'Trưởng phòng / Phó Trưởng phòng / Chánh, Phó Văn phòng',
      whatCanDo: 'Quản lý danh sách nhân sự, lập lịch trực và duyệt đơn xin nghỉ phép, đăng ký làm thêm giờ của các nhân viên thuộc phòng ban mình.',
      onComputer: 'Sử dụng giao diện quản lý dành cho cấp Phòng ban trên máy tính.',
      onPhone: 'Mở trên điện thoại vẫn sử dụng giao diện quản lý phòng ban để duyệt đơn cho nhân viên.',
    },
    {
      key: '3',
      role: 'Cán bộ Phòng Tổ chức - Hành chính',
      whatCanDo: 'Nhập danh sách nhân sự từ Excel, cấp tài khoản, quản lý Hợp đồng, Hồ sơ lý lịch Bộ Nội vụ (2 Mẫu) và xử lý Cảnh báo nâng bậc lương.',
      onComputer: 'Sử dụng đầy đủ các công cụ nghiệp vụ Tổ chức Cán bộ trên máy tính.',
      onPhone: 'Nếu giữ chức danh Chuyên viên thì khi mở trên điện thoại sẽ vào Cổng Điện thoại Cá nhân.',
    },
    {
      key: '4',
      role: 'Chuyên viên / Kế toán viên / Cán sự / Nhân viên',
      whatCanDo: 'Xem lịch làm việc của bản thân, gửi đơn xin nghỉ phép, đăng ký làm thêm giờ, tự kê khai và tải/in file Word Sơ yếu lý lịch của riêng mình.',
      onComputer: 'Xem thông tin tổng quan, tra cứu danh bạ đồng nghiệp và tự cập nhật/in Hồ sơ lý lịch cá nhân.',
      onPhone: 'Khi đăng nhập trên Điện thoại, phần mềm TỰ ĐỘNG mở ra Giao diện Điện thoại 5 nút dành riêng cho cá nhân bạn.',
    },
  ];

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', paddingBottom: 48 }}>
      {/* Hero Banner Thân thiện */}
      <div
        style={{
          borderRadius: 20,
          padding: '28px 32px',
          marginBottom: 24,
          background: isDark
            ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%, #1e3a8a 100%)'
            : 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 55%, #6d28d9 100%)',
          color: '#ffffff',
          boxShadow: '0 12px 32px rgba(37, 99, 235, 0.22)',
        }}
      >
        <Row gutter={[24, 16]} align="middle" justify="space-between">
          <Col xs={24} lg={18}>
            <Space size={8} wrap style={{ marginBottom: 8 }}>
              <Tag
                color="rgba(255,255,255,0.2)"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 999, fontWeight: 600 }}
              >
                📘 SỔ TAY HƯỚNG DẪN CẦM TAY CHỈ VIỆC (DÀNH CHO MỌI CÁN BỘ, VIÊN CHỨC)
              </Tag>
              <Tag
                color="rgba(16,185,129,0.28)"
                style={{ color: '#a7f3d0', border: '1px solid rgba(167,243,208,0.4)', borderRadius: 999, fontWeight: 600 }}
              >
                Ngôn ngữ đời thường • Dễ đọc • Làm theo được ngay
              </Tag>
            </Space>
            <Title level={2} style={{ color: '#ffffff', margin: '4px 0 8px', fontWeight: 800 }}>
              Hướng dẫn Sử dụng Phần mềm Quản lý Nhân sự, Hồ sơ Lý lịch & Lịch Công tác
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.92)', margin: 0, fontSize: 15, lineHeight: 1.65 }}>
              Tài liệu này được biên soạn bằng ngôn ngữ công sở bình thường, <b>không dùng thuật ngữ máy tính phức tạp</b>. Dù
              bạn là Lãnh đạo, Cán bộ Tổ chức hay Chuyên viên mới sử dụng phần mềm lần đầu, bạn chỉ cần đọc theo đúng 3 bước:{' '}
              <b>(1) Nhìn vào đâu & Bấm nút nào → (2) Điền thông tin gì → (3) Kết quả nhận được là gì</b>.
            </Paragraph>
          </Col>
          <Col xs={24} lg={6} style={{ textAlign: 'right' }}>
            <Button
              size="large"
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              style={{
                borderRadius: 12,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.35)',
              }}
            >
              In Sổ tay Hướng dẫn (A4)
            </Button>
          </Col>
        </Row>
      </div>

      {/* Thanh Tìm kiếm & Chọn Nhóm Công việc (Không bị tràn chữ) */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 16,
          background: cardBg,
          border: `1px solid ${borderCol}`,
        }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined style={{ color: '#6366f1' }} />}
            placeholder="Gõ việc bạn muốn tìm (Ví dụ: đổi mật khẩu, nhập excel, tải file word, sơ yếu lý lịch, nâng lương, xin nghỉ phép, làm thêm giờ...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: 10 }}
          />
          <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
            <Segmented
              size="middle"
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val as string)}
              options={[
                { label: '📖 Xem tất cả (7 Phần)', value: 'ALL' },
                { label: '1. Đăng nhập & Làm quen', value: 'START' },
                { label: '2. Phòng ban, Nhân sự & Hợp đồng', value: 'ORG_HR' },
                { label: '3. Hồ sơ Lý lịch Word (2 Mẫu BNV)', value: 'PROFILE_BNV' },
                { label: '4. Cảnh báo Nâng lương & Sơ đồ 360°', value: 'ALERT_SALARY' },
                { label: '5. Dùng trên Điện thoại (Chuyên viên)', value: 'MOBILE_APP' },
                { label: '6. Lịch trực, Nghỉ phép & Làm thêm giờ', value: 'CALENDAR_APP' },
              ]}
            />
          </div>
        </Space>
      </Card>

      {/* Bảng Tóm tắt Dễ hiểu: Ai được làm gì & Quy định mấy năm nâng lương 1 lần */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} xl={13}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#7c3aed', fontSize: 18 }} />
                <span style={{ fontWeight: 700, fontSize: 15.5 }}>
                  Bảng 1: Mỗi Chức vụ sẽ nhìn thấy gì khi đăng nhập trên Máy tính và Điện thoại?
                </span>
              </Space>
            }
            style={{
              height: '100%',
              borderRadius: 16,
              background: cardBg,
              border: `1px solid ${borderCol}`,
            }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14, borderRadius: 10 }}
              message={<b>Tại sao trên màn hình không có nút chuyển sang giao diện Điện thoại?</b>}
              description="Vì phần mềm đã tự động nhận biết giúp bạn: Khi Chuyên viên hoặc Nhân viên cầm Điện thoại đăng nhập vào, phần mềm sẽ tự động mở ngay Giao diện Điện thoại cá nhân (không cần bấm nút chuyển nào cả). Còn Lãnh đạo, Trưởng/Phó phòng hoặc người đang ngồi trên máy tính thì sẽ vào giao diện Quản lý đầy đủ."
            />
            <Table
              pagination={false}
              size="small"
              dataSource={roleSimpleTableData}
              columns={[
                {
                  title: 'Bạn đang giữ Chức vụ gì?',
                  dataIndex: 'role',
                  key: 'role',
                  width: 180,
                  render: (text: string) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
                },
                {
                  title: 'Công việc chính trên phần mềm',
                  dataIndex: 'whatCanDo',
                  key: 'whatCanDo',
                  render: (text: string) => <span style={{ fontSize: 12.8 }}>{text}</span>,
                },
                {
                  title: 'Khi mở bằng Điện thoại di động',
                  dataIndex: 'onPhone',
                  key: 'onPhone',
                  width: 230,
                  render: (text: string) => (
                    <Text
                      style={{
                        color: text.includes('TỰ ĐỘNG') ? '#2563eb' : undefined,
                        fontWeight: text.includes('TỰ ĐỘNG') ? 600 : 400,
                        fontSize: 12.8,
                      }}
                    >
                      {text}
                    </Text>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={11}>
          <Card
            title={
              <Space>
                <BellOutlined style={{ color: '#d97706', fontSize: 18 }} />
                <span style={{ fontWeight: 700, fontSize: 15.5 }}>
                  Bảng 2: Quy định mấy năm được nâng bậc lương 1 lần? (Chuẩn Bộ Nội vụ)
                </span>
              </Space>
            }
            style={{
              height: '100%',
              borderRadius: 16,
              background: cardBg,
              border: `1px solid ${borderCol}`,
            }}
          >
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 14, borderRadius: 10 }}
              message={<b>Cách phần mềm tự động tính ngày nâng lương tiếp theo cho bạn:</b>}
              description="Phần mềm lấy Ngày bạn bắt đầu hưởng bậc lương hiện tại + Thời hạn chuẩn (3 năm hoặc 2 năm). Nếu có Bằng khen/Chiến sĩ thi đua thì được rút ngắn sớm hơn từ 6 đến 12 tháng; nếu bị kỷ luật thì cộng lùi thêm từ 3 đến 12 tháng."
            />
            <Table
              pagination={false}
              size="small"
              dataSource={BNV_SALARY_SIMPLE_TABLE}
              columns={[
                {
                  title: 'Hạng Viên chức / Ngạch lương',
                  dataIndex: 'rank',
                  key: 'rank',
                  render: (text: string, r: any) => (
                    <div style={{ fontSize: 12.8 }}>
                      <Text strong>{text}</Text> <Tag color="blue">{r.code}</Tag>
                    </div>
                  ),
                },
                {
                  title: 'Thời hạn xét nâng bậc',
                  dataIndex: 'cycle',
                  key: 'cycle',
                  width: 145,
                  render: (text: string) => <Tag color="gold">{text}</Tag>,
                },
                {
                  title: 'Số bậc tối đa & Chế độ vượt khung',
                  dataIndex: 'exceedRule',
                  key: 'exceedRule',
                  render: (text: string, r: any) => (
                    <div style={{ fontSize: 12.3 }}>
                      <div><b>{r.maxSteps}</b></div>
                      <div style={{ color: '#64748b', marginTop: 2 }}>{text}</div>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Danh sách 7 Phần Hướng dẫn Cầm tay Chỉ việc */}
      <div style={{ marginBottom: 14 }}>
        <Space>
          <BookOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <Title level={4} style={{ margin: 0 }}>
            Hướng dẫn Thao tác Chi tiết Từng Màn hình ({filteredModules.length} phần)
          </Title>
        </Space>
      </div>

      {filteredModules.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: 32 }}>
          <Empty description="Không tìm thấy mục hướng dẫn nào khớp với từ bạn vừa gõ. Bạn hãy thử gõ từ ngắn gọn hơn nhé!" />
        </Card>
      ) : (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          {filteredModules.map((mod) => (
            <Card
              key={mod.id}
              style={{
                borderRadius: 16,
                background: cardBg,
                border: `1px solid ${borderCol}`,
                borderLeft: `6px solid ${mod.badgeColor}`,
              }}
            >
              {/* Tiêu đề Phần */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <Space size={8} wrap>
                    <Tag
                      color={mod.badgeColor}
                      style={{ borderRadius: 6, fontWeight: 700, fontSize: 12.5, margin: 0, padding: '2px 10px' }}
                    >
                      {mod.numberLabel}
                    </Tag>
                    {mod.whoShouldRead.map((r, i) => (
                      <Tag key={i} style={{ borderRadius: 999, fontSize: 12, margin: 0 }}>
                        👥 Dành cho: {r}
                      </Tag>
                    ))}
                  </Space>
                  <Title level={4} style={{ margin: '8px 0 4px' }}>
                    {mod.title}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13.8 }}>
                    {mod.subtitle}
                  </Text>
                </div>

                {mod.route && (
                  <Button
                    type="primary"
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(mod.route!)}
                    style={{ borderRadius: 10, fontWeight: 600, background: mod.badgeColor }}
                  >
                    Mở ngay màn hình này
                  </Button>
                )}
              </div>

              {/* Giới thiệu dễ hiểu & Vị trí trên màn hình */}
              <Row gutter={[16, 16]} style={{ marginBottom: 18 }}>
                <Col xs={24} lg={11}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: subtleBg,
                      border: `1px solid ${borderCol}`,
                      height: '100%',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: mod.badgeColor, marginBottom: 6 }}>
                      💡 Chức năng này giúp ích gì cho công việc của bạn?
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{mod.summaryForBeginner}</div>
                  </div>
                </Col>
                <Col xs={24} lg={13}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: subtleBg,
                      border: `1px solid ${borderCol}`,
                      height: '100%',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: mod.badgeColor, marginBottom: 6 }}>
                      👀 Muốn tìm chức năng này thì nhìn vào đâu trên màn hình?
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.2, lineHeight: 1.7 }}>
                      {mod.whereToFindOnScreen.map((el, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          {el}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Col>
              </Row>

              {/* Hướng dẫn từng bước kiểu Cầm tay chỉ việc */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 12,
                  background: subtleBg,
                  border: `1px solid ${borderCol}`,
                  marginBottom: 18,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 14, color: mod.badgeColor }}>
                  📋 Hướng dẫn Thao tác Từng Bước (Cầm tay chỉ việc)
                </div>
                <Steps
                  direction="vertical"
                  size="small"
                  current={mod.stepByStepGuides.length}
                  items={mod.stepByStepGuides.map((s) => ({
                    title: <Text strong style={{ fontSize: 14.5 }}>{s.stepTitle}</Text>,
                    description: (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                          gap: 12,
                          marginTop: 8,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: isDark ? 'rgba(37, 99, 235, 0.14)' : '#eff6ff',
                            border: `1px solid ${isDark ? '#1e3a8a' : '#bfdbfe'}`,
                            fontSize: 13.2,
                            lineHeight: 1.65,
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>
                            👆 1. Bấm vào đâu trên màn hình?
                          </div>
                          {s.whereToClick}
                        </div>
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: isDark ? 'rgba(124, 58, 237, 0.14)' : '#f5f3ff',
                            border: `1px solid ${isDark ? '#4c1d95' : '#ddd6fe'}`,
                            fontSize: 13.2,
                            lineHeight: 1.65,
                            whiteSpace: 'pre-line',
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
                            ✍️ 2. Điền hoặc chọn thông tin gì?
                          </div>
                          {s.whatToType}
                        </div>
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: isDark ? 'rgba(5, 150, 105, 0.14)' : '#ecfdf5',
                            border: `1px solid ${isDark ? '#065f46' : '#a7f3d0'}`,
                            fontSize: 13.2,
                            lineHeight: 1.65,
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#059669', marginBottom: 4 }}>
                            ✅ 3. Kết quả nhận được là gì?
                          </div>
                          {s.whatHappensNext}
                        </div>
                      </div>
                    ),
                  }))}
                />
              </div>

              {/* Giải thích các ô cần điền */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: mod.badgeColor }}>
                  📝 Giải thích các ô thông tin quan trọng cần điền (Kèm ví dụ mẫu)
                </div>
                <Table
                  pagination={false}
                  size="small"
                  rowKey="fieldName"
                  dataSource={mod.inputGuides}
                  columns={[
                    {
                      title: 'Tên ô thông tin trên màn hình',
                      dataIndex: 'fieldName',
                      key: 'fieldName',
                      width: 240,
                      render: (t: string) => <Text strong style={{ fontSize: 13 }}>{t}</Text>,
                    },
                    {
                      title: 'Có bắt buộc điền không?',
                      dataIndex: 'requiredText',
                      key: 'requiredText',
                      width: 170,
                      render: (t: string) => (
                        <Tag color={t.includes('Bắt buộc') || t.includes('quan trọng') ? 'red' : 'blue'} style={{ fontSize: 12 }}>
                          {t}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Ví dụ cách ghi đúng',
                      dataIndex: 'exampleText',
                      key: 'exampleText',
                      width: 310,
                      render: (t: string) => <Text style={{ fontSize: 12.8, color: '#2563eb' }}>{t}</Text>,
                    },
                    {
                      title: 'Giải thích dễ hiểu',
                      dataIndex: 'explainText',
                      key: 'explainText',
                      render: (t: string) => <span style={{ fontSize: 13 }}>{t}</span>,
                    },
                  ]}
                />
              </div>

              {/* Lưu ý quan trọng & Câu hỏi thường gặp */}
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={10}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: isDark ? 'rgba(30, 58, 138, 0.2)' : '#eff6ff',
                      border: `1px solid ${isDark ? '#1e3a8a' : '#bfdbfe'}`,
                      height: '100%',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#2563eb', marginBottom: 8 }}>
                      <BulbOutlined /> Lưu ý quan trọng cần nhớ
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.2, lineHeight: 1.75 }}>
                      {mod.importantNotes.map((note, idx) => (
                        <li key={idx} style={{ marginBottom: 6 }}>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Col>

                <Col xs={24} lg={14}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: isDark ? 'rgba(120, 53, 15, 0.18)' : '#fffbeb',
                      border: `1px solid ${isDark ? '#78350f' : '#fde68a'}`,
                      height: '100%',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#d97706', marginBottom: 8 }}>
                      <QuestionCircleOutlined /> Câu hỏi thường gặp khi thao tác (Hỏi & Đáp nhanh)
                    </div>
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      {mod.commonQuestions.map((qa, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
                            border: `1px solid ${borderCol}`,
                            fontSize: 13,
                            lineHeight: 1.65,
                          }}
                        >
                          <div>
                            <Text strong style={{ color: '#d97706' }}>❓ Hỏi: </Text>
                            <Text strong>{qa.question}</Text>
                          </div>
                          <div style={{ marginTop: 4, color: isDark ? '#a7f3d0' : '#065f46' }}>
                            <b>👉 Trả lời: </b>
                            {qa.answer}
                          </div>
                        </div>
                      ))}
                    </Space>
                  </div>
                </Col>
              </Row>
            </Card>
          ))}
        </Space>
      )}
    </div>
  );
};
