import type { UserInfo } from '@/types/auth';

/**
 * Kiểm tra xem người dùng đang truy cập trên thiết bị điện thoại / di động hay không:
 * - Dựa vào User-Agent của trình duyệt điện thoại (iOS, Android, Mobile, SamsungBrowser, CriOS...)
 * - Hoặc Client Hints API (`navigator.userAgentData.mobile`)
 * - Hoặc màn hình cảm ứng (`pointer: coarse`) / kích thước màn hình điện thoại (`innerWidth <= 900` hoặc `screen.width <= 900`)
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|CriOS|FxiOS|SamsungBrowser/i.test(
      ua,
    );
  const isUADataMobile = Boolean((navigator as any).userAgentData?.mobile);
  const isSmallViewport = window.innerWidth <= 900;
  const isSmallPhysicalScreen = Boolean(window.screen && window.screen.width <= 900);
  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  return isMobileUA || isUADataMobile || isSmallViewport || isSmallPhysicalScreen || isCoarsePointer;
}

/**
 * Kiểm tra xem tài khoản / chức vụ hiện tại có quyền quản lý hay không:
 * - Nếu chức vụ là Nhân viên / Chuyên viên / Người lao động -> luôn trả về `false` (để vào Cổng Mobile Chuyên viên)
 * - Nếu là Super Admin, Giám đốc, Phó Giám đốc, Trưởng phòng, Phó Trưởng phòng, Quản lý -> trả về `true`
 */
export function hasManagementRole(user: UserInfo | null | undefined): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  const uname = (user.username || '').trim().toLowerCase();
  if (uname === 'admin' || uname === 'manager') return true;

  const posName = (user.position_name || '').trim().toLowerCase();
  const posCode = (user.position_code || '').trim().toUpperCase();

  const nonManagerKeywords = [
    'nhân viên',
    'chuyên viên',
    'người lao động',
    'cộng tác viên',
    'thực tập',
    'tập sự',
    'văn thư',
    'thủ quỹ',
    'kế toán viên',
    'người đăng ký',
    'cán bộ',
    'viên chức',
  ];
  if (
    nonManagerKeywords.some((kw) => posName.includes(kw)) ||
    ['NV', 'CV', 'CVC', 'NLD', 'CTV'].includes(posCode)
  ) {
    return false;
  }

  if (typeof user.is_management_position === 'boolean') {
    return user.is_management_position;
  }

  const managerKeywords = [
    'giám đốc',
    'trưởng phòng',
    'phó phòng',
    'phó trưởng phòng',
    'chánh văn phòng',
    'phó chánh',
    'trưởng ban',
    'phó ban',
    'quản lý',
    'quản trị',
  ];
  if (
    managerKeywords.some((kw) => posName.includes(kw)) ||
    ['GD', 'PGD', 'TP', 'PTP', 'CVP', 'PCVP'].includes(posCode)
  ) {
    return true;
  }

  const p = user.permissions;
  if (!p) return false;
  return Boolean(p.can_manage_users || p.can_manage_settings);
}

/**
 * Xác định có tự động điều hướng vào Cổng Mobile Chuyên viên (`/mobile-ess`) hay không:
 * - Đang đăng nhập trên thiết bị điện thoại (`isMobileDevice() === true`)
 * - VÀ chức vụ thuộc cấp Chuyên viên / Nhân viên không có quyền quản lý (`!hasManagementRole(user)`)
 */
export function shouldRedirectToMobileSpecialistPortal(user: UserInfo | null | undefined): boolean {
  if (!user) return false;
  return isMobileDevice() && !hasManagementRole(user);
}
