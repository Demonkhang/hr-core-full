import dayjs from 'dayjs';
import type { VcProfileDetail, VcTrainingRecord, VcFamilyRelation } from '@/types/personnelProfile';

function esc(val: any, fallback = ''): string {
  if (val === null || val === undefined || String(val).trim() === '') {
    return fallback;
  }
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDateSlash(d?: string | null, fallback = ''): string {
  if (!d) return fallback;
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : esc(d, fallback);
}

function fmtDateParts(d?: string | null): { day: string; month: string; year: string } {
  if (!d) return { day: '....', month: '....', year: '........' };
  const parsed = dayjs(d);
  if (!parsed.isValid()) return { day: '....', month: '....', year: '........' };
  return {
    day: parsed.format('DD'),
    month: parsed.format('MM'),
    year: parsed.format('YYYY'),
  };
}

function joinPlace(ward?: string | null, district?: string | null, province?: string | null): string {
  const parts = [ward, district, province].map((x) => (x || '').trim()).filter(Boolean);
  return parts.length ? esc(parts.join(', ')) : '';
}

function buildFamilyCellTT06(r: VcFamilyRelation): string {
  const lines: string[] = [];
  if (r.hometown) lines.push(`Quê quán: ${esc(r.hometown)}`);
  if (r.occupation || r.workplace_or_address) {
    lines.push(`Nghề nghiệp: ${esc(r.occupation || r.workplace_or_address)}`);
  }
  if (r.residence) lines.push(`Nơi ở: ${esc(r.residence)}`);
  return lines.join('<br/>');
}

function buildFamilyCellHS01(r: VcFamilyRelation): string {
  const lines: string[] = [];
  lines.push(`Họ tên: ${esc(r.full_name)}`);
  if (r.birth_year) lines.push(`Sinh năm: ${esc(r.birth_year)}`);
  if (r.hometown) lines.push(`Quê quán: ${esc(r.hometown)}`);
  if (r.occupation || r.workplace_or_address) {
    lines.push(`Nghề nghiệp: ${esc(r.occupation || r.workplace_or_address)}`);
  }
  if (r.residence) lines.push(`Nơi ở: ${esc(r.residence)}`);
  return lines.join('<br/>');
}

function getCommonStyles(): string {
  return `
    @page Section1 {
      size: 21cm 29.7cm;
      margin: 1.8cm 1.8cm 1.8cm 2.2cm;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      line-height: 1.35;
      color: #000000;
      margin: 0;
      padding: 0;
    }
    p {
      margin: 3pt 0;
      text-align: justify;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 4pt 0 8pt 0;
    }
    table.bordered th, table.bordered td {
      border: 1px solid #000000;
      padding: 4pt 6pt;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      vertical-align: top;
    }
    table.bordered th {
      font-weight: bold;
      text-align: center;
      vertical-align: middle;
    }
    table.no-border td, table.no-border th {
      border: none;
      padding: 2pt 4pt;
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      vertical-align: top;
    }
    .title-main {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      margin: 6pt 0;
    }
    .section-heading {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 8pt;
      margin-bottom: 4pt;
    }
    .sub-heading {
      font-size: 13pt;
      font-style: italic;
      margin-top: 4pt;
      margin-bottom: 3pt;
    }
    .photo-box {
      width: 4cm;
      height: 6cm;
      border: 1px solid #000000;
      text-align: center;
      vertical-align: middle;
      font-size: 11pt;
    }
    .cover-box {
      border: 2px double #000000;
      padding: 14pt 18pt;
      margin-bottom: 16pt;
    }
    .dotted-line {
      border-bottom: 1px dotted #000;
      min-height: 18pt;
      margin: 4pt 0;
    }
  `;
}

function renderPortraitCell(portraitUrl?: string | null): string {
  if (portraitUrl) {
    const fullUrl = portraitUrl.startsWith('http') || portraitUrl.startsWith('data:')
      ? portraitUrl
      : `${window.location.origin}${portraitUrl}`;
    return `
      <td class="photo-box" style="width: 4cm; height: 6cm; border: 1px solid #000; text-align: center; vertical-align: middle;">
        <img src="${fullUrl}" alt="Ảnh 4x6" style="width: 3.8cm; height: 5.6cm; object-fit: cover;" />
      </td>
    `;
  }
  return `
    <td class="photo-box" style="width: 4cm; height: 6cm; border: 1px solid #000; text-align: center; vertical-align: middle;">
      Ảnh màu<br/>(4 x 6 cm)
    </td>
  `;
}

/**
 * Tạo HTML chuẩn 1:1 theo File Word 1: SƠ YẾU LÝ LỊCH (Theo TT 06/2023/TT-BNV — 38 Mục)
 */
export function buildTT06WordHtml(p: VcProfileDetail): string {
  const dob = fmtDateParts(p.date_of_birth);
  const birthplace = joinPlace(p.birthplace_ward, p.birthplace_district, p.birthplace_province);
  const hometown = joinPlace(p.hometown_ward, p.hometown_district, p.hometown_province);

  const byCat = (cat: string): VcTrainingRecord[] =>
    (p.training_records || []).filter((r) => (r.training_category || 'CHUYEN_MON') === cat);

  const renderCat32_1 = () => {
    const rows = byCat('CHUYEN_MON');
    const list = rows.length ? rows : [{} as any];
    return list
      .map(
        (r) => `
      <tr>
        <td style="text-align:center;">${esc(r.from_period)}</td>
        <td style="text-align:center;">${esc(r.to_period)}</td>
        <td>${esc(r.school_name)}</td>
        <td>${esc(r.major)}</td>
        <td style="text-align:center;">${esc(r.training_mode)}</td>
        <td style="text-align:center;">${esc(r.degree_certificate)}</td>
      </tr>`
      )
      .join('');
  };

  const renderCat32_2 = () => {
    const rows = byCat('LY_LUAN_CHINH_TRI');
    const list = rows.length ? rows : [{} as any];
    return list
      .map(
        (r) => `
      <tr>
        <td style="text-align:center;">${esc(r.from_period)}</td>
        <td style="text-align:center;">${esc(r.to_period)}</td>
        <td>${esc(r.school_name)}</td>
        <td style="text-align:center;">${esc(r.training_mode)}</td>
        <td style="text-align:center;">${esc(r.degree_certificate)}</td>
      </tr>`
      )
      .join('');
  };

  const renderCatCert = (cat: string) => {
    const rows = byCat(cat);
    const list = rows.length ? rows : [{} as any];
    return list
      .map(
        (r) => `
      <tr>
        <td style="text-align:center;">${esc(r.from_period)}</td>
        <td style="text-align:center;">${esc(r.to_period)}</td>
        <td>${esc(r.school_name)}</td>
        <td style="text-align:center;">${esc(r.degree_certificate)}</td>
      </tr>`
      )
      .join('');
  };

  const renderCat32_6 = () => {
    const rows = byCat('NGOAI_NGU');
    const list = rows.length ? rows : [{} as any];
    return list
      .map(
        (r) => `
      <tr>
        <td style="text-align:center;">${esc(r.from_period)}</td>
        <td style="text-align:center;">${esc(r.to_period)}</td>
        <td>${esc(r.school_name)}</td>
        <td style="text-align:center;">${esc(r.major)}</td>
        <td style="text-align:center;">${esc(r.degree_certificate)}</td>
        <td style="text-align:center;">${esc(r.score_result)}</td>
      </tr>`
      )
      .join('');
  };

  const workRows = (p.work_experiences?.length ? p.work_experiences : [{} as any])
    .map(
      (w) => `
    <tr>
      <td style="text-align:center;">${esc(w.from_month_year)}</td>
      <td style="text-align:center;">${esc(w.to_month_year)}</td>
      <td>${esc([w.organization_name, w.department_name].filter(Boolean).join(' / '))}</td>
      <td>${esc(w.position_name)}</td>
    </tr>`
    )
    .join('');

  const rewardRows = (p.rewards?.length ? p.rewards : [{} as any])
    .map(
      (rw) => `
    <tr>
      <td style="text-align:center;">${esc(rw.reward_year)}</td>
      <td style="text-align:center;">${esc(rw.professional_rating)}</td>
      <td style="text-align:center;">${esc(rw.emulation_rating)}</td>
      <td>${esc(rw.reward_form)}</td>
    </tr>`
    )
    .join('');

  const disciplineRows = (p.disciplines?.length ? p.disciplines : [{} as any])
    .map(
      (d) => `
    <tr>
      <td style="text-align:center;">${esc(d.from_month_year || fmtDateSlash(d.discipline_date))}</td>
      <td style="text-align:center;">${esc(d.to_month_year)}</td>
      <td>${esc(d.discipline_form)}</td>
      <td>${esc(d.reason)}</td>
      <td>${esc(d.issuing_authority)}</td>
    </tr>`
    )
    .join('');

  const famSelf = (p.family_relations || []).filter((f) => f.side_type !== 'spouse');
  const famSpouse = (p.family_relations || []).filter((f) => f.side_type === 'spouse');

  const renderFamilyRowsTT06 = (list: VcFamilyRelation[]) => {
    const arr = list.length ? list : [{} as any];
    return arr
      .map(
        (f) => `
      <tr>
        <td style="text-align:center; width:15%;">${esc(f.relationship_type)}</td>
        <td style="width:22%;">${esc(f.full_name)}</td>
        <td style="text-align:center; width:12%;">${esc(f.birth_year)}</td>
        <td>${f.full_name ? buildFamilyCellTT06(f) : ''}</td>
      </tr>`
      )
      .join('');
  };

  const salaryRows = (p.salary_logs?.length ? p.salary_logs : [{} as any])
    .map(
      (s) => `
    <tr>
      <td style="text-align:center;">${esc(s.from_month_year || (s.effective_date ? dayjs(s.effective_date).format('MM/YYYY') : ''))}</td>
      <td style="text-align:center;">${esc(s.to_month_year)}</td>
      <td style="text-align:center;">${esc(s.rank_code)}</td>
      <td style="text-align:center;">${esc(s.salary_step)}</td>
      <td style="text-align:center;">${s.coefficient != null ? Number(s.coefficient).toFixed(2) : ''}</td>
      <td style="text-align:center;">${esc(s.position_salary_amount)}</td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Sơ yếu lý lịch (Theo TT 06/2023/TT-BNV) - ${esc(p.birth_full_name || p.account_full_name)}</title>
  <style>${getCommonStyles()}</style>
</head>
<body>
  <div class="Section1">
    <table class="no-border" style="margin-bottom: 6pt;">
      <tr>
        <td style="width: 68%;">
          Cơ quan quản lý cán bộ, công chức, viên chức: ${esc(p.managing_agency_name)}
        </td>
        <td style="width: 32%;">
          Số hiệu: ${esc(p.official_file_code || p.cccd_number)}
        </td>
      </tr>
      <tr>
        <td>
          Cơ quan, đơn vị sử dụng cán bộ, công chức, viên chức: ${esc(p.using_agency_name || p.work_unit_name || p.department_name)}
        </td>
        <td>
          Mã số định danh: ${esc(p.cccd_number || p.official_file_code)}
        </td>
      </tr>
    </table>

    <table class="no-border" style="margin-bottom: 6pt;">
      <tr>
        ${renderPortraitCell(p.portrait_url)}
        <td style="padding-left: 14pt; vertical-align: top;">
          <div class="title-main" style="margin-top: 0;">SƠ YẾU LÝ LỊCH</div>
          <p>1) Họ và tên khai sinh (viết chữ in hoa): <strong>${esc((p.birth_full_name || p.account_full_name || '').toUpperCase())}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Giới tính: ${esc(p.gender)}</p>
          <p>2) Các tên gọi khác: ${esc(p.alias_name)}</p>
          <p>3) Sinh ngày: ${dob.day} tháng ${dob.month} năm ${dob.year}</p>
          <p>4) Nơi sinh: ${birthplace}</p>
          <p>5) Quê quán: ${hometown}</p>
        </td>
      </tr>
    </table>

    <p>6) Dân tộc: ${esc(p.ethnicity, 'Kinh')} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 7) Tôn giáo: ${esc(p.religion, 'Không theo tôn giáo nào')}</p>
    <p>8) Số CCCD: ${esc(p.cccd_number)} &nbsp;&nbsp;&nbsp;&nbsp; Ngày cấp: ${fmtDateSlash(p.cccd_issue_date)} &nbsp;&nbsp;&nbsp;&nbsp; SĐT liên hệ: ${esc(p.personal_phone)}</p>
    <p>9) Sổ BHXH: ${esc(p.social_insurance_code)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Số thẻ BHYT: ${esc(p.health_insurance_card_no)}</p>
    <p>10) Nơi ở hiện nay: ${esc(p.current_address || p.permanent_address)}</p>
    <p>11) Thành phần gia đình xuất thân: ${esc(p.family_background)}</p>
    <p>12) Nghề nghiệp trước khi được tuyển dụng: ${esc(p.occupation_before_recruitment)}</p>
    <p>13) Ngày được tuyển dụng lần đầu: ${fmtDateSlash(p.first_recruitment_date)}; Cơ quan, tổ chức, đơn vị tuyển dụng: ${esc(p.recruitment_agency)}</p>
    <p>14) Ngày vào cơ quan hiện công tác: ${fmtDateSlash(p.current_agency_join_date)}</p>
    <p>15) Ngày vào Đảng Cộng sản Việt Nam: ${fmtDateSlash(p.cpv_probationary_date, 'Không có')} &nbsp;&nbsp;&nbsp;&nbsp; Ngày chính thức: ${fmtDateSlash(p.cpv_official_date)}</p>
    <p>16) Ngày tham gia tổ chức chính trị-xã hội đầu tiên (ngày vào Đoàn TNCSHCM, Công đoàn, Hội): ${esc(p.first_socio_political_org_date)}</p>
    <p>17) Ngày nhập ngũ: ${fmtDateSlash(p.enlistment_date, 'Không có')} &nbsp;&nbsp;&nbsp;&nbsp; Ngày xuất ngũ: ${fmtDateSlash(p.discharge_date)} &nbsp;&nbsp;&nbsp;&nbsp; Quân hàm cao nhất: ${esc(p.highest_military_rank)}</p>
    <p>18) Đối tượng chính sách: ${esc(p.policy_family_type, 'Không có')}</p>
    <p>19) Trình độ giáo dục phổ thông (đã tốt nghiệp lớp mấy/thuộc hệ nào): ${esc(p.general_education_level, '12/12')}</p>
    <p>20) Trình độ chuyên môn cao nhất: ${esc(p.highest_professional_degree)}</p>
    <p>21) Học hàm: ${esc(p.academic_title, 'Không có')}</p>
    <p>22) Danh hiệu nhà nước phong tặng: ${esc(p.state_honorary_title, 'Không có')}</p>
    <p>23) Chức vụ hiện tại: ${esc(p.leadership_position, 'Không')}</p>
    <p style="padding-left: 18pt;">Ngày bổ nhiệm/phê chuẩn: ${fmtDateSlash(p.appointment_date)} &nbsp;&nbsp;&nbsp;&nbsp; Ngày bổ nhiệm lại/phê chuẩn nhiệm kỳ tiếp theo: ${fmtDateSlash(p.reappointment_date)}</p>
    <p>24) Được quy hoạch chức danh: ${esc(p.planned_position_title, 'Không có')}</p>
    <p>25) Chức vụ kiêm nhiệm: ${esc(p.concurrent_position, 'Không có')}</p>
    <p>26) Chức vụ Đảng hiện tại: ${esc(p.cpv_current_position, 'Không có')}</p>
    <p>27) Chức vụ Đảng kiêm nhiệm: ${esc(p.cpv_concurrent_position, 'Không có')}</p>
    <p>28) Công việc chính được giao: ${esc(p.main_assigned_duty || p.approved_job_position_name)}</p>
    <p>29) Sở trường công tác: ${esc(p.work_forte)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Công việc làm lâu nhất: ${esc(p.longest_held_job)}</p>

    <p class="section-heading">30) Tiền lương</p>
    <p>30.1) Ngạch/chức danh nghề nghiệp: ${esc(p.professional_title_name)} ; Mã số: ${esc(p.professional_title_code)}</p>
    <p>Ngày bổ nhiệm ngạch/ chức danh nghề nghiệp: ${fmtDateSlash(p.title_appointment_date)}</p>
    <p>Bậc lương: ${esc(p.salary_step)} &nbsp;&nbsp;&nbsp; Hệ số: ${p.salary_coefficient != null ? Number(p.salary_coefficient).toFixed(2) : ''} &nbsp;&nbsp;&nbsp; Ngày hưởng: ${fmtDateSlash(p.salary_effective_date)}</p>
    <p>Phần trăm hưởng: ${esc(p.salary_enjoy_percent, '100')} %; Phụ cấp thâm niên vượt khung: ${esc(p.seniority_exceed_percent)} %; Ngày hưởng PCTNVK: ${fmtDateSlash(p.seniority_exceed_effective_date)}</p>
    <p>30.2) Phụ cấp chức vụ: ${esc(p.leadership_allowance, 'không có')} ; Phụ cấp kiêm nhiệm: ${esc(p.concurrent_allowance, '0')} ; Phụ cấp khác: ${esc(p.other_allowance)}</p>
    <p>30.3) Vị trí việc làm: ${esc(p.approved_job_position_name)} &nbsp;&nbsp;&nbsp; Mã số: ${esc(p.job_position_code)}</p>
    <p>Bậc lương: ${esc(p.job_position_salary_step)} &nbsp;&nbsp;&nbsp; Lương theo mức tiền: ${esc(p.job_position_salary_amount)} &nbsp;&nbsp;&nbsp; Ngày hưởng: ${fmtDateSlash(p.job_position_effective_date)}</p>
    <p>Phần trăm hưởng: ${esc(p.job_position_enjoy_percent)} ; Phụ cấp thâm niên vượt khung: ${esc(p.job_position_pctnvk, 'không có')} ; Ngày hưởng PCTNVK: ${fmtDateSlash(p.job_position_pctnvk_date)}</p>

    <p>31) Tình trạng sức khoẻ: ${esc(p.health_classification, 'Tốt')}</p>
    <p>Chiều cao: ${p.height_cm != null ? Number(p.height_cm).toFixed(1) : ''} cm, Cân nặng: ${p.weight_kg != null ? Number(p.weight_kg).toFixed(1) : ''} kg, Nhóm máu: ${esc(p.blood_type, 'Chưa có thông tin')}</p>

    <p class="section-heading">32) QUÁ TRÌNH ĐÀO TẠO, BỒI DƯỠNG</p>
    <p class="sub-heading">32.1- Chuyên môn (từ trung cấp trở lên cả trong nước và nước ngoài)</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Tên cơ sở đào tạo</th>
        <th rowspan="2">Chuyên ngành đào tạo</th>
        <th rowspan="2">Hình thức đào tạo</th>
        <th rowspan="2">Văn bằng, trình độ</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${renderCat32_1()}
    </table>

    <p class="sub-heading">32.2- Lý luận chính trị</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Tên cơ sở đào tạo</th>
        <th rowspan="2">Hình thức đào tạo</th>
        <th rowspan="2">Văn bằng được cấp</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${renderCat32_2()}
    </table>

    <p class="sub-heading">32.3- Bồi dưỡng quản lý nhà nước/ chức danh nghề nghiệp/ nghiệp vụ chuyên ngành</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Tên cơ sở đào tạo</th>
        <th rowspan="2">Chứng chỉ được cấp</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${renderCatCert('BOI_DUONG_QLNN')}
    </table>

    <p class="sub-heading">32.4- Bồi dưỡng kiến thức an ninh, quốc phòng</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Tên cơ sở đào tạo</th>
        <th rowspan="2">Chứng chỉ được cấp</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${renderCatCert('AN_NINH_QUOC_PHONG')}
    </table>

    <p class="sub-heading">32.5- Tin học</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Tên cơ sở đào tạo</th>
        <th rowspan="2">Chứng chỉ được cấp</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${renderCatCert('TIN_HOC')}
    </table>

    <p class="sub-heading">32.6- Ngoại ngữ/ tiếng dân tộc</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Tên cơ sở đào tạo</th>
        <th rowspan="2">Tên ngoại ngữ/ tiếng dân tộc</th>
        <th rowspan="2">Chứng chỉ được cấp</th>
        <th rowspan="2">Điểm số</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${renderCat32_6()}
    </table>

    <p class="section-heading">33) TÓM TẮT QUÁ TRÌNH CÔNG TÁC</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Đơn vị công tác (đảng, chính quyền, đoàn thể, tổ chức xã hội)</th>
        <th rowspan="2">Chức danh/ chức vụ</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${workRows}
    </table>

    <p class="section-heading">34) ĐẶC ĐIỂM LỊCH SỬ BẢN THÂN</p>
    <p>34.1- Khai rõ: bị bắt, bị tù (từ ngày tháng năm nào đến ngày tháng năm nào, ở đâu?), đã khai báo cho ai, những vấn đề gì?: ${esc(p.political_history_self, 'Không')}</p>
    <p class="sub-heading">34.2- Bản thân có làm việc cho chế độ cũ</p>
    <table class="bordered">
      <tr>
        <th colspan="2" style="width:24%;">Tháng/năm</th>
        <th rowspan="2">Chức danh, chức vụ, đơn vị, địa điểm đã làm việc</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      <tr>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>${esc(p.old_regime_work_json)}</td>
      </tr>
    </table>

    <p class="sub-heading">34.3- Tham gia hoặc có quan hệ với các tổ chức chính trị, kinh tế, xã hội … ở nước ngoài</p>
    <table class="bordered">
      <tr>
        <th colspan="2" style="width:24%;">Tháng/năm</th>
        <th rowspan="2">Tên tổ chức, địa chỉ trụ sở, công việc đã làm</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      <tr>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>${esc(p.foreign_relations_history)}</td>
      </tr>
    </table>

    <p class="section-heading">35) KHEN THƯỞNG, KỶ LUẬT</p>
    <p class="sub-heading">35.1- Thành tích thi đua, khen thưởng</p>
    <table class="bordered">
      <tr>
        <th>Năm</th>
        <th>Xếp loại chuyên môn</th>
        <th>Xếp loại thi đua</th>
        <th>Hình thức khen thưởng</th>
      </tr>
      ${rewardRows}
    </table>

    <p class="sub-heading">35.2- Kỷ luật Đảng/ hành chính</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Hình thức</th>
        <th rowspan="2">Hành vi vi phạm chính</th>
        <th rowspan="2">Cơ quan quyết định</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${disciplineRows}
    </table>

    <p class="section-heading">36) QUAN HỆ GIA ĐÌNH</p>
    <p class="sub-heading">36.1- Về bản thân: Cha, Mẹ, Vợ (hoặc chồng), các con, anh chị em ruột</p>
    <table class="bordered">
      <tr>
        <th>Mối quan hệ</th>
        <th>Họ và tên</th>
        <th>Năm sinh</th>
        <th>Quê quán, nghề nghiệp, chức danh, chức vụ, đơn vị công tác, học tập, nơi ở (trong, ngoài nước); thành viên các tổ chức chính trị - xã hội (trong, ngoài nước); làm việc cho chế độ cũ, tiền án, tiền sự (nếu có)</th>
      </tr>
      ${renderFamilyRowsTT06(famSelf)}
    </table>

    <p class="sub-heading">36.2- Cha, Mẹ, anh chị em ruột (bên vợ hoặc chồng)</p>
    <table class="bordered">
      <tr>
        <th>Mối quan hệ</th>
        <th>Họ và tên</th>
        <th>Năm sinh</th>
        <th>Quê quán, nghề nghiệp, chức danh, chức vụ, đơn vị công tác, học tập, nơi ở (trong, ngoài nước); thành viên các tổ chức chính trị - xã hội (trong, ngoài nước); làm việc cho chế độ cũ, tiền án, tiền sự (nếu có)</th>
      </tr>
      ${renderFamilyRowsTT06(famSpouse)}
    </table>

    <p class="section-heading">37) HOÀN CẢNH KINH TẾ GIA ĐÌNH</p>
    <p class="sub-heading">37.1- Quá trình lương của bản thân</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Mã số</th>
        <th rowspan="2">Bậc lương</th>
        <th rowspan="2">Hệ số lương</th>
        <th rowspan="2">Tiền lương theo vị trí việc làm</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      ${salaryRows}
    </table>

    <p class="sub-heading">37.2- Các loại phụ cấp khác</p>
    <table class="bordered">
      <tr>
        <th colspan="2">Tháng/năm</th>
        <th rowspan="2">Loại phụ cấp</th>
        <th rowspan="2">Phần trăm hưởng</th>
        <th rowspan="2">Hệ số</th>
        <th rowspan="2">Hình thức hưởng</th>
        <th rowspan="2">Giá trị (đồng)</th>
      </tr>
      <tr>
        <th>Từ</th>
        <th>Đến</th>
      </tr>
      <tr>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td colspan="5">${esc(p.other_allowances_log_json)}</td>
      </tr>
    </table>

    <p class="sub-heading">37.3- Nguồn thu nhập chính của gia đình hàng năm</p>
    <p>- Tiền lương: ${esc(p.family_income_salary)}</p>
    <p>- Các nguồn khác: ${esc(p.family_income_other)}</p>
    <p>- Nhà ở: ${esc(p.housing_allocated_info || p.housing_owned_info, 'Không có')}</p>
    <p style="padding-left: 16pt;">+ Được cấp, được thuê (loại nhà): ${esc(p.housing_allocated_info, 'Không có')}</p>
    <p style="padding-left: 16pt;">+ Nhà tự mua, tự xây (loại nhà): ${esc(p.housing_owned_info, 'Không có')}</p>
    <p>- Đất ở: ${esc(p.land_allocated_info || p.land_purchased_info, 'Không có')}</p>
    <p style="padding-left: 16pt;">+ Đất được cấp: ${esc(p.land_allocated_info)}</p>
    <p style="padding-left: 16pt;">+ Đất tự mua: ${esc(p.land_purchased_info)}</p>
    <p>- Đất sản xuất kinh doanh: ${esc(p.production_land_info, 'Không có')}</p>

    <p class="section-heading">38) NHẬN XÉT, ĐÁNH GIÁ CỦA CƠ QUAN, TỔ CHỨC, ĐƠN VỊ SỬ DỤNG</p>
    <p>${esc(p.agency_evaluation_comment, '...........................................................................................................................................................................')}</p>
    <p>...........................................................................................................................................................................</p>

    <table class="no-border" style="margin-top: 16pt; text-align: center;">
      <tr>
        <td style="width: 48%; text-align: center;">
          <strong>Người khai</strong><br/>
          Tôi xin cam đoan những lời khai trên đây là đúng sự thật<br/>
          <em>(Ký tên, ghi rõ họ tên)</em>
          <br/><br/><br/><br/>
          <strong>${esc((p.birth_full_name || p.account_full_name || '').toUpperCase())}</strong>
        </td>
        <td style="width: 52%; text-align: center;">
          ……, Ngày……tháng……năm 20……<br/>
          <strong>Xác nhận của cơ quan, đơn vị quản lý<br/>cán bộ, công chức, viên chức</strong><br/>
          <em>(Ký tên, đóng dấu)</em>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

/**
 * Tạo HTML chuẩn 1:1 theo File Word 2: LÝ LỊCH VIÊN CHỨC (Mẫu HS01-VC/BNV — TT 07/2019/TT-BNV)
 */
export function buildHS01WordHtml(p: VcProfileDetail): string {
  const dob = fmtDateParts(p.date_of_birth);
  const birthplace = joinPlace(p.birthplace_ward, p.birthplace_district, p.birthplace_province);
  const hometown = joinPlace(p.hometown_ward, p.hometown_district, p.hometown_province);

  const trainingRows = (p.training_records?.length ? p.training_records : [{} as any])
    .map(
      (r) => `
    <tr>
      <td>${esc(r.school_name)}</td>
      <td>${esc(r.major)}</td>
      <td style="text-align:center;">${esc([r.from_period, r.to_period].filter(Boolean).join(' - '))}</td>
      <td style="text-align:center;">${esc(r.training_mode)}</td>
      <td style="text-align:center;">${esc(r.degree_certificate)}</td>
    </tr>`
    )
    .join('');

  // Phần III: Đặc điểm lịch sử bản thân (kết hợp đào tạo + công tác)
  const historyItems: Array<{ period: string; desc: string }> = [];
  for (const t of p.training_records || []) {
    historyItems.push({
      period: [t.from_period, t.to_period].filter(Boolean).join(' - '),
      desc: [t.school_name, t.major].filter(Boolean).join(', '),
    });
  }
  for (const w of p.work_experiences || []) {
    historyItems.push({
      period: `${w.from_month_year || ''} - ${w.to_month_year || 'nay'}`,
      desc: [w.position_name, w.department_name, w.organization_name].filter(Boolean).join(', '),
    });
  }
  const historyRows = (historyItems.length ? historyItems : [{ period: '', desc: '' }])
    .map(
      (h) => `
    <tr>
      <td style="text-align:center; width: 28%;">${esc(h.period)}</td>
      <td>${esc(h.desc)}</td>
    </tr>`
    )
    .join('');

  const rewardRows = (p.rewards?.length ? p.rewards : [{} as any])
    .map(
      (rw) => `
    <tr>
      <td style="text-align:center; width: 25%;">${esc(rw.reward_year)}</td>
      <td>${esc(rw.reward_form)}</td>
      <td style="width: 28%;">${esc(rw.issuing_authority)}</td>
    </tr>`
    )
    .join('');

  const disciplineRows = (p.disciplines?.length ? p.disciplines : [{} as any])
    .map(
      (d) => `
    <tr>
      <td style="text-align:center; width: 25%;">${esc(d.from_month_year || fmtDateSlash(d.discipline_date))}</td>
      <td>${esc([d.discipline_form, d.reason].filter(Boolean).join(' - '))}</td>
      <td style="width: 28%;">${esc(d.issuing_authority)}</td>
    </tr>`
    )
    .join('');

  const famSelf = (p.family_relations || []).filter((f) => f.side_type !== 'spouse');
  const famSpouse = (p.family_relations || []).filter((f) => f.side_type === 'spouse');

  const renderFamilyRowsHS01 = (list: VcFamilyRelation[]) => {
    const arr = list.length ? list : [{} as any];
    return arr
      .map(
        (f) => `
      <tr>
        <td style="text-align:center; width: 22%;">${esc(f.relationship_type)}</td>
        <td>${f.full_name ? buildFamilyCellHS01(f) : ''}</td>
      </tr>`
      )
      .join('');
  };

  return `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Lý lịch viên chức (Mẫu HS01-VC/BNV) - ${esc(p.birth_full_name || p.account_full_name)}</title>
  <style>${getCommonStyles()}</style>
</head>
<body>
  <div class="Section1">
    <p style="font-size: 11pt; font-style: italic; text-align: right; margin-bottom: 6pt;">
      Mẫu HS01-VC/BNV ban hành kèm theo Thông tư số 07/2019/TT-BNV ngày 01/6/2019 của Bộ trưởng Bộ Nội vụ
    </p>

    <div class="cover-box">
      <div style="text-align: center; font-weight: bold; font-size: 13pt;">
        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>
        <span style="text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</span>
      </div>

      <div class="title-main" style="margin: 18pt 0 14pt 0; font-size: 18pt;">LÝ LỊCH VIÊN CHỨC</div>

      <p>Họ và tên khai sinh: <strong>${esc((p.birth_full_name || p.account_full_name || '').toUpperCase())}</strong></p>
      <p>Tên gọi khác: ${esc(p.alias_name)}</p>
      <p>Ngày, tháng, năm sinh: ${dob.day} / ${dob.month} / ${dob.year} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Giới tính (nam, nữ): ${esc(p.gender)}</p>
      <p>Quê quán: ${hometown}</p>
      <p>Chức danh công tác hiện tại: ${esc(p.leadership_position, 'Không')}</p>
      <p>Cơ quan, đơn vị quản lý viên chức: ${esc(p.managing_agency_name)}</p>
      <p>Đơn vị sử dụng viên chức: ${esc(p.using_agency_name || p.work_unit_name || p.department_name)}</p>
      <p>Số hiệu viên chức: ${esc(p.official_file_code || p.cccd_number)}</p>
    </div>

    <p class="section-heading">I. SƠ LƯỢC LÝ LỊCH</p>
    <table class="no-border" style="margin-bottom: 6pt;">
      <tr>
        ${renderPortraitCell(p.portrait_url)}
        <td style="padding-left: 14pt; vertical-align: top;">
          <p>1) Họ và tên khai sinh (viết chữ in hoa): <strong>${esc((p.birth_full_name || p.account_full_name || '').toUpperCase())}</strong></p>
          <p>2) Tên gọi khác: ${esc(p.alias_name)}</p>
          <p>3) Sinh ngày: ${dob.day} tháng ${dob.month} năm ${dob.year} &nbsp;&nbsp;&nbsp;&nbsp; Giới tính (nam, nữ): ${esc(p.gender)}</p>
          <p>4) Nơi sinh: ${birthplace}</p>
          <p>5) Quê quán: ${hometown}</p>
          <p>6) Dân tộc: ${esc(p.ethnicity, 'Kinh')} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 7) Tôn giáo: ${esc(p.religion, 'Không theo tôn giáo nào')}</p>
        </td>
      </tr>
    </table>

    <p>8) Nơi đăng ký hộ khẩu thường trú: ${esc(p.permanent_address || p.current_address)}</p>
    <p>9) Nơi ở hiện nay: ${esc(p.current_address || p.permanent_address)}</p>
    <p>10) Nghề nghiệp khi được tuyển dụng: ${esc(p.occupation_before_recruitment)}</p>
    <p>11) Ngày tuyển dụng: ${fmtDateSlash(p.first_recruitment_date)} &nbsp;&nbsp;&nbsp;&nbsp; Cơ quan, đơn vị tuyển dụng: ${esc(p.recruitment_agency)}</p>
    <p>12.1) Chức danh (chức vụ) công tác hiện tại: ${esc(p.leadership_position, 'Không')}</p>
    <p>12.2) Chức danh (chức vụ) kiêm nhiệm: ${esc(p.concurrent_position, 'Không có')}</p>
    <p>13) Công việc chính được giao: ${esc(p.main_assigned_duty || p.approved_job_position_name)}</p>
    <p>14) Chức danh nghề nghiệp viên chức: ${esc(p.professional_title_name)} &nbsp;&nbsp;&nbsp;&nbsp; Mã số: ${esc(p.professional_title_code)}</p>
    <p>Bậc lương: ${esc(p.salary_step)} &nbsp;&nbsp;&nbsp; Hệ số: ${p.salary_coefficient != null ? Number(p.salary_coefficient).toFixed(2) : ''} &nbsp;&nbsp;&nbsp; Ngày hưởng: ${fmtDateSlash(p.salary_effective_date)} &nbsp;&nbsp;&nbsp; Phụ cấp chức vụ: ${esc(p.leadership_allowance, '0')} &nbsp;&nbsp;&nbsp; Phụ cấp khác: ${esc(p.other_allowance, '0')}</p>
    <p>15.1- Trình độ giáo dục phổ thông (đã tốt nghiệp lớp mấy/thuộc hệ nào): ${esc(p.general_education_level, '12/12')}</p>
    <p>15.2- Trình độ chuyên môn cao nhất: ${esc(p.highest_professional_degree)}</p>
    <p>15.3- Lý luận chính trị: ${esc(p.political_theory_level)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 15.4- Quản lý nhà nước: ${esc(p.state_management_level)}</p>
    <p>15.5- Trình độ nghiệp vụ theo chuyên ngành: ${esc(p.professional_skill_by_major || p.highest_professional_degree)}</p>
    <p>15.6- Ngoại ngữ: ${esc(p.foreign_language_level)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 15.7- Tin học: ${esc(p.it_skill_level)}</p>
    <p>16) Ngày vào Đảng Cộng sản Việt Nam: ${fmtDateSlash(p.cpv_probationary_date, 'Không có')} &nbsp;&nbsp;&nbsp;&nbsp; Ngày chính thức: ${fmtDateSlash(p.cpv_official_date)}</p>
    <p>17) Ngày tham gia tổ chức chính trị - xã hội: ${esc(p.first_socio_political_org_date)}</p>
    <p>18) Ngày nhập ngũ: ${fmtDateSlash(p.enlistment_date, 'Không có')} &nbsp;&nbsp;&nbsp;&nbsp; Ngày xuất ngũ: ${fmtDateSlash(p.discharge_date)} &nbsp;&nbsp;&nbsp;&nbsp; Quân hàm cao nhất: ${esc(p.highest_military_rank)}</p>
    <p>19.1) Danh hiệu được phong tặng cao nhất: ${esc(p.state_honorary_title, 'Không có')}</p>
    <p>19.2) Hàm học được phong (Giáo sư, Phó giáo sư): ${esc(p.academic_title, 'Không có')}</p>
    <p>20) Sở trường công tác: ${esc(p.work_forte)}</p>
    <p>21) Tình trạng sức khoẻ: ${esc(p.health_classification, 'Tốt')} &nbsp;&nbsp;&nbsp; Chiều cao: ${p.height_cm != null ? Number(p.height_cm).toFixed(1) : ''} cm &nbsp;&nbsp;&nbsp; Cân nặng: ${p.weight_kg != null ? Number(p.weight_kg).toFixed(1) : ''} kg &nbsp;&nbsp;&nbsp; Nhóm máu: ${esc(p.blood_type, 'Chưa có thông tin')}</p>
    <p>22) Là thương binh hạng: ${esc(p.wounded_soldier_class, 'Không có')} &nbsp;&nbsp;&nbsp;&nbsp; Là con gia đình chính sách: ${esc(p.policy_family_type, 'Không có')}</p>
    <p>23) Số chứng minh nhân dân / CCCD: ${esc(p.cccd_number)} &nbsp;&nbsp;&nbsp;&nbsp; Ngày cấp: ${fmtDateSlash(p.cccd_issue_date)} &nbsp;&nbsp;&nbsp;&nbsp; 24) Sổ BHXH: ${esc(p.social_insurance_code)}</p>

    <p class="section-heading">II. QUÁ TRÌNH ĐÀO TẠO, BỒI DƯỠNG VỀ CHUYÊN MÔN, NGHIỆP VỤ, LÝ LUẬN CHÍNH TRỊ, NGOẠI NGỮ, TIN HỌC</p>
    <table class="bordered">
      <tr>
        <th>Tên trường</th>
        <th>Chuyên ngành đào tạo, bồi dưỡng</th>
        <th>Từ tháng, năm - Đến tháng, năm</th>
        <th>Hình thức đào tạo</th>
        <th>Văn bằng, chứng chỉ</th>
      </tr>
      ${trainingRows}
    </table>
    <p style="font-size: 11pt; font-style: italic;">
      Ghi chú: 1. Hình thức đào tạo, bồi dưỡng: Chính quy, tại chức, chuyên tu, từ xa, liên thông... 2. Văn bằng, chứng chỉ: TSKH, TS, Thạc sĩ, Cử nhân, Kỹ sư, Cao đẳng, Trung cấp, Sơ cấp...
    </p>

    <p class="section-heading">III. ĐẶC ĐIỂM LỊCH SỬ BẢN THÂN</p>
    <table class="bordered">
      <tr>
        <th>Từ tháng, năm đến tháng, năm</th>
        <th>Đặc điểm lịch sử</th>
      </tr>
      ${historyRows}
    </table>

    <p class="section-heading">IV. KHEN THƯỞNG</p>
    <table class="bordered">
      <tr>
        <th>Ngày, tháng, năm</th>
        <th>Nội dung và hình thức khen thưởng</th>
        <th>Cấp quyết định</th>
      </tr>
      ${rewardRows}
    </table>

    <p class="section-heading">V. KỶ LUẬT</p>
    <table class="bordered">
      <tr>
        <th>Ngày, tháng, năm</th>
        <th>Lý do và hình thức kỷ luật</th>
        <th>Cấp quyết định</th>
      </tr>
      ${disciplineRows}
    </table>

    <p class="section-heading">VI. QUAN HỆ GIA ĐÌNH</p>
    <p class="sub-heading">1) Về bản thân: Cha, Mẹ, Vợ (hoặc chồng), các con và anh chị em ruột</p>
    <table class="bordered">
      <tr>
        <th>Mối quan hệ</th>
        <th>Họ tên, năm sinh, quê quán, nghề nghiệp, đặc điểm lịch sử (có bị bắt, bị tù, làm việc trong chế độ cũ, nguỵ quân, nguỵ quyền không); hiện đang làm gì (ghi rõ chức vụ hoặc chức danh nếu có, tên và địa chỉ cơ quan, đơn vị công tác ở trong hoặc ngoài nước), nơi cư trú.</th>
      </tr>
      ${renderFamilyRowsHS01(famSelf)}
    </table>

    <p class="sub-heading">2) Về bên Vợ hoặc Chồng: Cha, Mẹ và anh chị em ruột</p>
    <table class="bordered">
      <tr>
        <th>Mối quan hệ</th>
        <th>Họ tên, năm sinh, quê quán, nghề nghiệp, đặc điểm lịch sử (có bị bắt, bị tù, làm việc trong chế độ cũ, nguỵ quân, nguỵ quyền không); hiện đang làm gì (ghi rõ chức vụ hoặc chức danh nếu có, tên và địa chỉ cơ quan, đơn vị công tác ở trong hoặc ngoài nước), nơi cư trú.</th>
      </tr>
      ${renderFamilyRowsHS01(famSpouse)}
    </table>

    <p class="section-heading">VII. TỰ NHẬN XÉT, ĐÁNH GIÁ</p>
    <p style="font-style: italic; font-size: 12pt;">(Về phẩm chất chính trị, đạo đức, lối sống, ý thức kỷ luật, năng lực và sở trường công tác,...)</p>
    <p>${esc(p.self_assessment_comment, '...........................................................................................................................................................................')}</p>

    <table class="bordered" style="margin-top: 14pt;">
      <tr>
        <td style="width: 48%; text-align: center;">
          <strong>Người khai</strong><br/>
          Tôi xin cam đoan về những lời khai trong quyển lý lịch này là đúng sự thật và chịu trách nhiệm trước pháp luật về những lời khai đó.<br/>
          ……, Ngày……tháng……năm 20……<br/>
          <em>(Ký tên, ghi rõ họ tên)</em>
          <br/><br/><br/><br/>
          <strong>${esc((p.birth_full_name || p.account_full_name || '').toUpperCase())}</strong>
        </td>
        <td style="width: 52%; text-align: center;">
          <strong>Xác nhận của đơn vị</strong><br/>
          Bản lý lịch này do viên chức: <strong>${esc((p.birth_full_name || p.account_full_name || '').toUpperCase())}</strong><br/>
          tự khai tại ....................................................<br/>
          Đơn vị xác nhận là đúng sự thật.<br/>
          ……, Ngày……tháng……năm 20……<br/>
          <strong>Thủ trưởng đơn vị sử dụng viên chức</strong><br/>
          <em>(Ký tên, đóng dấu)</em>
          <br/><br/><br/>
        </td>
      </tr>
    </table>
    <p style="font-size: 11pt; font-style: italic;">
      Ghi chú: Quyển lý lịch này sau khi viên chức kê khai phải được thẩm tra, xác minh và xác nhận của đơn vị sử dụng viên chức; đồng thời phải đóng dấu giáp lai ở tất cả các trang.
    </p>
  </div>
</body>
</html>
  `;
}

/**
 * Mở cửa sổ In chuẩn đúng định dạng Biểu mẫu Word (Không in giao diện nút bấm của trang web)
 */
export function printOfficialProfileTemplate(profile: VcProfileDetail, templateType: 'tt06' | 'hs01'): void {
  const htmlContent = templateType === 'tt06' ? buildTT06WordHtml(profile) : buildHS01WordHtml(profile);
  const printWin = window.open('', '_blank', 'width=960,height=850');
  if (!printWin) {
    window.print();
    return;
  }
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
  }, 350);
}

/**
 * Tải về File Word (.doc) chuẩn theo đúng Biểu mẫu TT 06/2023/TT-BNV hoặc Mẫu HS01-VC/BNV (TT 07/2019/TT-BNV)
 */
export function downloadOfficialWordFile(profile: VcProfileDetail, templateType: 'tt06' | 'hs01'): void {
  const htmlContent = templateType === 'tt06' ? buildTT06WordHtml(profile) : buildHS01WordHtml(profile);
  const rawName = (profile.birth_full_name || profile.account_full_name || 'Vien_chuc')
    .trim()
    .replace(/\s+/g, '_');

  const fileName =
    templateType === 'tt06'
      ? `So_yeu_ly_lich_(theo_TT06_2023_TT-BNV)_${rawName}.doc`
      : `Ly_lich_vien_chuc_(Mau_HS01_theo_TT_07_2019_TT-BNV)_${rawName}.doc`;

  // Prepend UTF-8 BOM so Microsoft Word opens Vietnamese characters cleanly
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

