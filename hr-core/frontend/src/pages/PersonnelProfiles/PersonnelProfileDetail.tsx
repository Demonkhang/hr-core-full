import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
  Space,
  Tag,
  Table,
  Modal,
  Upload,
  Progress,
  Typography,
  Divider,
  Popconfirm,
  Spin,
  Radio,
  Alert,
  Badge,
  Dropdown,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PrinterOutlined,
  UploadOutlined,
  DownloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  FileWordOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  BookOutlined,
  ProfileOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { personnelProfileService } from '@/services/personnelProfileService';
import type {
  VcProfileDetail,
  SubRecordType,
  WordParsePreview,
  VcTrainingRecord,
  VcFamilyRelation,
} from '@/types/personnelProfile';
import { useSetPageTitle } from '@/components/Layout/AppLayout';
import { ROUTES } from '@/utils/constants';
import {
  printOfficialProfileTemplate,
  downloadOfficialWordFile,
} from '@/utils/personnelWordTemplateGenerator';

const DATE_FIELDS = [
  'cccd_issue_date',
  'date_of_birth',
  'cpv_probationary_date',
  'cpv_official_date',
  'youth_union_date',
  'trade_union_date',
  'enlistment_date',
  'discharge_date',
  'first_recruitment_date',
  'current_agency_join_date',
  'probation_end_date',
  'appointment_date',
  'reappointment_date',
  'title_appointment_date',
  'title_effective_date',
  'salary_effective_date',
  'next_promotion_date',
  'seniority_exceed_effective_date',
  'job_position_effective_date',
  'job_position_pctnvk_date',
];

const SUB_TYPE_TITLES: Record<SubRecordType, string> = {
  'trainings': 'Quá trình đào tạo, bồi dưỡng',
  'work-experiences': 'Quá trình công tác / Đặc điểm lịch sử',
  'salary-logs': 'Quá trình diễn biến lương',
  'family-relations': 'Quan hệ gia đình (Bản thân & Vợ/Chồng)',
  'rewards': 'Thành tích thi đua, khen thưởng',
  'disciplines': 'Quá trình kỷ luật',
  'evaluations': 'Đánh giá, xếp loại hàng năm',
  'asset-declarations': 'Kê khai tài sản, thu nhập',
};

const TRAINING_CATEGORY_LABELS: Record<string, string> = {
  CHUYEN_MON: '32.1- Chuyên môn (Từ trung cấp trở lên)',
  LY_LUAN_CHINH_TRI: '32.2- Lý luận chính trị',
  BOI_DUONG_QLNN: '32.3- Bồi dưỡng QLNN / CDNN / Nghiệp vụ',
  AN_NINH_QUOC_PHONG: '32.4- Bồi dưỡng kiến thức An ninh, Quốc phòng',
  TIN_HOC: '32.5- Tin học',
  NGOAI_NGU: '32.6- Ngoại ngữ / Tiếng dân tộc',
};

const FIELD_VI_LABELS: Record<string, string> = {
  managing_agency_name: 'Cơ quan quản lý CBCCVC',
  using_agency_name: 'Cơ quan, đơn vị sử dụng CBCCVC',
  official_file_code: 'Số hiệu / Mã hồ sơ viên chức',
  birth_full_name: '1) Họ và tên khai sinh (IN HOA)',
  gender: 'Giới tính',
  alias_name: '2) Tên gọi khác',
  date_of_birth: '3) Ngày, tháng, năm sinh',
  birthplace_ward: '4) Nơi sinh (Xã/Phường)',
  birthplace_district: '4) Nơi sinh (Quận/Huyện)',
  birthplace_province: '4) Nơi sinh (Tỉnh/TP)',
  hometown_ward: '5) Quê quán (Xã/Phường)',
  hometown_district: '5) Quê quán (Quận/Huyện)',
  hometown_province: '5) Quê quán (Tỉnh/TP)',
  ethnicity: '6) Dân tộc',
  religion: '7) Tôn giáo',
  cccd_number: '8) Số CCCD / CMND',
  cccd_issue_date: 'Ngày cấp CCCD',
  personal_phone: 'SĐT liên hệ',
  social_insurance_code: '9) Sổ BHXH',
  health_insurance_card_no: '9) Số thẻ BHYT',
  permanent_address: 'Nơi đăng ký hộ khẩu thường trú',
  current_address: '10) Nơi ở hiện nay',
  family_background: '11) Thành phần gia đình xuất thân',
  occupation_before_recruitment: '12) Nghề nghiệp trước khi tuyển dụng',
  first_recruitment_date: '13) Ngày được tuyển dụng lần đầu',
  recruitment_agency: 'Cơ quan, đơn vị tuyển dụng',
  current_agency_join_date: '14) Ngày vào cơ quan hiện công tác',
  cpv_probationary_date: '15) Ngày vào Đảng CSVN',
  cpv_official_date: 'Ngày chính thức',
  first_socio_political_org_date: '16) Ngày tham gia tổ chức CT-XH đầu tiên',
  enlistment_date: '17) Ngày nhập ngũ',
  discharge_date: 'Ngày xuất ngũ',
  highest_military_rank: 'Quân hàm cao nhất',
  policy_family_type: '18) Đối tượng chính sách',
  wounded_soldier_class: 'Thương binh hạng',
  general_education_level: '19) Trình độ giáo dục phổ thông',
  highest_professional_degree: '20) Trình độ chuyên môn cao nhất',
  academic_title: '21) Học hàm',
  state_honorary_title: '22) Danh hiệu nhà nước phong tặng',
  leadership_position: '23) Chức vụ hiện tại',
  planned_position_title: '24) Được quy hoạch chức danh',
  concurrent_position: '25) Chức vụ kiêm nhiệm',
  cpv_current_position: '26) Chức vụ Đảng hiện tại',
  cpv_concurrent_position: '27) Chức vụ Đảng kiêm nhiệm',
  main_assigned_duty: '28) Công việc chính được giao',
  work_forte: '29) Sở trường công tác',
  longest_held_job: 'Công việc làm lâu nhất',
  professional_title_name: '30.1) Ngạch / Chức danh nghề nghiệp',
  professional_title_code: 'Mã số ngạch / CDNN',
  salary_step: 'Bậc lương',
  salary_coefficient: 'Hệ số lương',
  salary_effective_date: 'Ngày hưởng lương',
  salary_enjoy_percent: 'Phần trăm hưởng (%)',
  approved_job_position_name: '30.3) Vị trí việc làm',
  health_classification: '31) Tình trạng sức khoẻ',
  height_cm: 'Chiều cao (cm)',
  weight_kg: 'Cân nặng (kg)',
  blood_type: 'Nhóm máu',
  political_history_self: '34.1) Đặc điểm lịch sử bản thân',
  family_income_salary: '37.3) Thu nhập tiền lương hàng tháng',
  family_income_other: '37.3) Các nguồn thu nhập khác',
  housing_allocated_info: 'Nhà ở được cấp, được thuê',
  housing_owned_info: 'Nhà ở tự mua, tự xây',
  land_allocated_info: 'Đất ở được cấp',
  land_purchased_info: 'Đất ở tự mua',
  production_land_info: 'Đất sản xuất kinh doanh',
  professional_skill_by_major: '15.5) Trình độ nghiệp vụ theo chuyên ngành',
};

function formatFamilySummaryCell(r: VcFamilyRelation): string {
  const parts: string[] = [];
  if (r.hometown) parts.push(`Quê quán: ${r.hometown}`);
  if (r.occupation || r.workplace_or_address) {
    parts.push(`Nghề nghiệp: ${r.occupation || r.workplace_or_address}`);
  }
  if (r.residence) parts.push(`Nơi ở: ${r.residence}`);
  return parts.join('\n') || '-';
}

function formatHs01FamilyCell(r: VcFamilyRelation): string {
  const lines: string[] = [];
  lines.push(`Họ tên: ${r.full_name}`);
  if (r.birth_year) lines.push(`Sinh năm: ${r.birth_year}`);
  if (r.hometown) lines.push(`Quê quán: ${r.hometown}`);
  if (r.occupation || r.workplace_or_address) {
    lines.push(`Nghề nghiệp: ${r.occupation || r.workplace_or_address}`);
  }
  if (r.residence) lines.push(`Nơi ở: ${r.residence}`);
  return lines.join('\n');
}

export function PersonnelProfileDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [subForm] = Form.useForm();

  const [profile, setProfile] = useState<VcProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);

  // Main 2-Profile Tabs: 'tt06' (Sơ yếu lý lịch TT 06/2023/TT-BNV) | 'hs01' (Lý lịch viên chức Mẫu HS01-VC/BNV)
  const [activeDocTab, setActiveDocTab] = useState<'tt06' | 'hs01'>('tt06');

  // Sub-record modal state
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [activeSubType, setActiveSubType] = useState<SubRecordType>('trainings');
  const [editingSubRecord, setEditingSubRecord] = useState<any | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [uploadingAssetPdf, setUploadingAssetPdf] = useState(false);

  // Word Import Modal State
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [parsingWord, setParsingWord] = useState(false);
  const [applyingWord, setApplyingWord] = useState(false);
  const [wordPreview, setWordPreview] = useState<WordParsePreview | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite_subtables'>('merge');

  useSetPageTitle(
    profile
      ? `Hồ sơ cá nhân (2 Biểu mẫu): ${profile.birth_full_name || profile.account_full_name || ''}`
      : 'Chi tiết Hồ sơ Lý lịch Viên chức'
  );

  const populateForm = (data: VcProfileDetail) => {
    const formValues: Record<string, any> = { ...data };
    for (const df of DATE_FIELDS) {
      formValues[df] = data[df as keyof VcProfileDetail]
        ? dayjs(data[df as keyof VcProfileDetail] as string)
        : null;
    }
    form.setFieldsValue(formValues);
  };

  const fetchProfile = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await personnelProfileService.getByUser(userId);
      setProfile(data);
      populateForm(data);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể tải hồ sơ lý lịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handleSaveMainProfile = async () => {
    if (!userId) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: Record<string, any> = { ...values };
      for (const df of DATE_FIELDS) {
        payload[df] = values[df] ? dayjs(values[df]).format('YYYY-MM-DD') : null;
      }
      if (payload.birth_full_name) {
        payload.birth_full_name = String(payload.birth_full_name).trim().toUpperCase();
      }
      const updated = await personnelProfileService.updateByUser(userId, payload);
      setProfile(updated);
      populateForm(updated);
      message.success('Đã lưu đồng bộ dữ liệu trên cả 2 Tab Hồ sơ (TT06 & HS01) thành công');
    } catch (err: any) {
      if (err?.errorFields) {
        message.warning('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ');
        return;
      }
      message.error(err?.response?.data?.detail || 'Lỗi khi lưu hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadPortrait = async (file: File) => {
    if (!userId) return false;
    setUploadingPortrait(true);
    try {
      const res = await personnelProfileService.uploadPortrait(userId, file);
      setProfile((prev) => (prev ? { ...prev, portrait_url: res.portrait_url } : prev));
      message.success('Đã cập nhật ảnh chân dung 4x6');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi tải ảnh lên');
    } finally {
      setUploadingPortrait(false);
    }
    return false;
  };

  // Word File Parse & Apply Handlers
  const handleSelectWordFile = async (file: File) => {
    if (!userId) return false;
    setParsingWord(true);
    try {
      const preview = await personnelProfileService.parseWordFile(userId, file);
      setWordPreview(preview);
      message.success(`Đã bóc tách thành công tệp "${file.name}" (${preview.template_label})`);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể bóc tách tệp Word. Vui lòng kiểm tra định dạng tệp.');
    } finally {
      setParsingWord(false);
    }
    return false;
  };

  const handleConfirmApplyWord = async () => {
    if (!userId || !wordPreview) return;
    setApplyingWord(true);
    try {
      const updated = await personnelProfileService.applyWordImport(userId, {
        mode: importMode,
        fields: wordPreview.extracted_fields || {},
        trainings: wordPreview.extracted_trainings || [],
        work_experiences: wordPreview.extracted_work_experiences || [],
        family_relations: wordPreview.extracted_family_relations || [],
        salary_logs: wordPreview.extracted_salary_logs || [],
        rewards: wordPreview.extracted_rewards || [],
        disciplines: wordPreview.extracted_disciplines || [],
        portrait_data_url: wordPreview.extracted_portrait_data_url,
      });
      setProfile(updated);
      populateForm(updated);
      if (wordPreview.template_type === 'HS01_2019') {
        setActiveDocTab('hs01');
      } else if (wordPreview.template_type === 'TT06_2023') {
        setActiveDocTab('tt06');
      }
      setWordModalOpen(false);
      setWordPreview(null);
      message.success('Đã import dữ liệu từ file Word và đồng bộ vào cả 2 Tab Hồ sơ thành công!');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi áp dụng dữ liệu từ file Word');
    } finally {
      setApplyingWord(false);
    }
  };

  // Sub-record Modal handlers
  const openSubModal = (subType: SubRecordType, record?: any, defaultValues?: Record<string, any>) => {
    setActiveSubType(subType);
    setEditingSubRecord(record || null);
    subForm.resetFields();
    if (record) {
      const initVals = { ...record };
      if (initVals.decision_date) initVals.decision_date = dayjs(initVals.decision_date);
      if (initVals.effective_date) initVals.effective_date = dayjs(initVals.effective_date);
      if (initVals.discipline_date) initVals.discipline_date = dayjs(initVals.discipline_date);
      subForm.setFieldsValue(initVals);
    } else if (defaultValues) {
      subForm.setFieldsValue(defaultValues);
    }
    setSubModalOpen(true);
  };

  const handleSubSubmit = async () => {
    if (!userId) return;
    try {
      const vals = await subForm.validateFields();
      setSubSaving(true);
      const payload = { ...vals };
      if (payload.decision_date) payload.decision_date = dayjs(payload.decision_date).format('YYYY-MM-DD');
      if (payload.effective_date) payload.effective_date = dayjs(payload.effective_date).format('YYYY-MM-DD');
      if (payload.discipline_date) payload.discipline_date = dayjs(payload.discipline_date).format('YYYY-MM-DD');

      let updated: VcProfileDetail;
      if (editingSubRecord?.id) {
        updated = await personnelProfileService.updateSubRecord(userId, activeSubType, editingSubRecord.id, payload);
        message.success('Đã cập nhật bản ghi');
      } else {
        updated = await personnelProfileService.createSubRecord(userId, activeSubType, payload);
        message.success('Đã thêm mới vào hồ sơ');
      }
      setProfile(updated);
      setSubModalOpen(false);
      setEditingSubRecord(null);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Không thể lưu bản ghi');
    } finally {
      setSubSaving(false);
    }
  };

  const handleDeleteSubRecord = async (subType: SubRecordType, recordId: string) => {
    if (!userId) return;
    try {
      const updated = await personnelProfileService.deleteSubRecord(userId, subType, recordId);
      setProfile(updated);
      message.success('Đã xoá dòng dữ liệu');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể xoá bản ghi');
    }
  };

  const handleUploadAssetFile = async (file: File) => {
    if (!userId) return false;
    setUploadingAssetPdf(true);
    try {
      const res = await personnelProfileService.uploadAssetFile(userId, file);
      subForm.setFieldsValue({
        file_url: res.file_url,
        file_name: res.file_name,
      });
      message.success(`Đã đính kèm tệp: ${res.file_name}`);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể tải tệp PDF');
    } finally {
      setUploadingAssetPdf(false);
    }
    return false;
  };

  // Group trainings by category for Tab 1 (32.1 -> 32.6)
  const trainingsByCategory = useMemo(() => {
    const list = profile?.training_records || [];
    const grouped: Record<string, VcTrainingRecord[]> = {
      CHUYEN_MON: [],
      LY_LUAN_CHINH_TRI: [],
      BOI_DUONG_QLNN: [],
      AN_NINH_QUOC_PHONG: [],
      TIN_HOC: [],
      NGOAI_NGU: [],
    };
    for (const r of list) {
      const cat = r.training_category && grouped[r.training_category] ? r.training_category : 'CHUYEN_MON';
      grouped[cat].push(r);
    }
    return grouped;
  }, [profile?.training_records]);

  // Combined historical timeline for HS01 Part III (Đặc điểm lịch sử bản thân)
  const hs01HistoryRows = useMemo(() => {
    if (!profile) return [];
    const rows: Array<{ key: string; period: string; description: string; source: string; raw?: any }> = [];
    for (const t of profile.training_records || []) {
      const p = [t.from_period, t.to_period].filter(Boolean).join(' - ') || (t.graduation_year ? String(t.graduation_year) : '-');
      const desc = [t.school_name, t.major, t.degree_certificate].filter(Boolean).join(', ');
      rows.push({ key: `tr_${t.id}`, period: p, description: desc, source: 'Đào tạo', raw: t });
    }
    for (const w of profile.work_experiences || []) {
      const p = `${w.from_month_year || ''} - ${w.to_month_year || 'nay'}`;
      const desc = [w.position_name, w.department_name, w.organization_name, w.main_duties].filter(Boolean).join(', ');
      rows.push({ key: `wk_${w.id}`, period: p, description: desc, source: 'Công tác', raw: w });
    }
    return rows;
  }, [profile]);

  // Word Preview Diff Rows
  const wordDiffRows = useMemo(() => {
    if (!wordPreview || !profile) return [];
    const entries = Object.entries(wordPreview.extracted_fields || {});
    return entries.map(([fieldKey, newVal]) => {
      const oldVal = (profile as Record<string, any>)[fieldKey];
      const oldStr = oldVal !== null && oldVal !== undefined && String(oldVal).trim() !== '' ? String(oldVal) : '(Chưa có)';
      const newStr = newVal !== null && newVal !== undefined ? String(newVal) : '';
      return {
        key: fieldKey,
        fieldKey,
        label: FIELD_VI_LABELS[fieldKey] || fieldKey,
        oldValue: oldStr,
        newValue: newStr,
        isChanged: oldStr !== newStr,
      };
    });
  }, [wordPreview, profile]);

  if (loading || !profile) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" tip="Đang tải hồ sơ lý lịch viên chức..." />
      </div>
    );
  }

  const isCpvMember = Boolean(profile.cpv_probationary_date || profile.cpv_official_date || profile.cpv_card_number);

  const getMergedLiveProfile = (): VcProfileDetail => {
    const rawValues = form.getFieldsValue(true);
    const merged: Record<string, any> = { ...profile, ...rawValues };
    for (const df of DATE_FIELDS) {
      if (rawValues[df] !== undefined) {
        merged[df] = rawValues[df] ? dayjs(rawValues[df]).format('YYYY-MM-DD') : null;
      }
    }
    return merged as VcProfileDetail;
  };

  const handlePrintTemplate = (targetTab: 'tt06' | 'hs01' = activeDocTab) => {
    printOfficialProfileTemplate(getMergedLiveProfile(), targetTab);
  };

  const handleDownloadWord = (targetTab: 'tt06' | 'hs01' = activeDocTab) => {
    downloadOfficialWordFile(getMergedLiveProfile(), targetTab);
    message.success(
      targetTab === 'tt06'
        ? 'Đã tải về file Word Sơ yếu lý lịch (Mẫu TT 06/2023/TT-BNV)'
        : 'Đã tải về file Word Lý lịch viên chức (Mẫu HS01-VC/BNV - TT 07/2019)'
    );
  };

  const renderTrainingTableForCategory = (catKey: string, title: string, showMajor = false, showLanguage = false) => {
    const data = trainingsByCategory[catKey] || [];
    const cols: any[] = [
      {
        title: 'Từ tháng/năm',
        dataIndex: 'from_period',
        width: 110,
        render: (v: string) => v || '-',
      },
      {
        title: 'Đến tháng/năm',
        dataIndex: 'to_period',
        width: 110,
        render: (v: string) => v || '-',
      },
      {
        title: 'Tên cơ sở đào tạo',
        dataIndex: 'school_name',
        render: (v: string) => <strong>{v}</strong>,
      },
    ];
    if (showMajor) {
      cols.push({
        title: 'Chuyên ngành đào tạo',
        dataIndex: 'major',
        render: (v: string) => v || '-',
      });
    }
    if (showLanguage) {
      cols.push({
        title: 'Tên ngoại ngữ / Tiếng dân tộc',
        dataIndex: 'major',
        render: (v: string) => v || '-',
      });
    }
    if (catKey === 'CHUYEN_MON' || catKey === 'LY_LUAN_CHINH_TRI') {
      cols.push({
        title: 'Hình thức đào tạo',
        dataIndex: 'training_mode',
        width: 140,
        render: (v: string) => v || '-',
      });
    }
    cols.push({
      title: catKey === 'CHUYEN_MON' ? 'Văn bằng, trình độ' : catKey === 'LY_LUAN_CHINH_TRI' ? 'Văn bằng được cấp' : 'Chứng chỉ được cấp',
      dataIndex: 'degree_certificate',
      render: (v: string) => (v ? <Tag color="blue">{v}</Tag> : '-'),
    });
    if (showLanguage) {
      cols.push({
        title: 'Điểm số',
        dataIndex: 'score_result',
        width: 100,
        render: (v: string) => v || '-',
      });
    }
    cols.push({
      title: 'Thao tác',
      key: 'actions',
      width: 90,
      render: (_: any, r: VcTrainingRecord) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('trainings', r)} />
          <Popconfirm title="Xoá dòng đào tạo này?" onConfirm={() => handleDeleteSubRecord('trainings', r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    });

    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Typography.Text strong style={{ color: '#1e40af', fontSize: 13 }}>
            {title}
          </Typography.Text>
          <Button
            size="small"
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => openSubModal('trainings', undefined, { training_category: catKey, training_mode: 'Chính quy' })}
          >
            Thêm dòng
          </Button>
        </div>
        <Table
          size="small"
          bordered
          rowKey="id"
          pagination={false}
          dataSource={data}
          locale={{ emptyText: 'Chưa có dữ liệu kê khai' }}
          columns={cols}
        />
      </div>
    );
  };

  return (
    <div>
      {/* Top Action Bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTES.PERSONNEL_PROFILES)}>
            Danh sách hồ sơ
          </Button>
          <Tag color="geekblue" style={{ fontSize: 13, padding: '4px 10px' }}>
            <SyncOutlined style={{ marginRight: 6 }} />
            Đồng bộ tự động 2 Biểu mẫu: TT 06/2023/TT-BNV (38 Mục) & Mẫu HS01-VC/BNV (TT 07/2019/TT-BNV)
          </Tag>
        </Space>

        <Space wrap>
          <Button
            icon={<FileWordOutlined />}
            onClick={() => {
              setWordPreview(null);
              setWordModalOpen(true);
            }}
            style={{
              background: '#0284c7',
              borderColor: '#0284c7',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Import từ File Word (.doc / .docx)
          </Button>
          <Dropdown.Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadWord(activeDocTab)}
            menu={{
              items: [
                {
                  key: 'dl_tt06',
                  icon: <FileWordOutlined style={{ color: '#2563eb' }} />,
                  label: 'Tải File Word 1: Sơ yếu lý lịch (Mẫu TT 06/2023/TT-BNV)',
                  onClick: () => handleDownloadWord('tt06'),
                },
                {
                  key: 'dl_hs01',
                  icon: <FileWordOutlined style={{ color: '#0f766e' }} />,
                  label: 'Tải File Word 2: Lý lịch viên chức (Mẫu HS01-VC/BNV - TT 07/2019)',
                  onClick: () => handleDownloadWord('hs01'),
                },
              ],
            }}
          >
            Tải File Word (.doc) ({activeDocTab === 'tt06' ? 'TT06/2023' : 'HS01-VC/BNV'})
          </Dropdown.Button>
          <Dropdown.Button
            icon={<PrinterOutlined />}
            onClick={() => handlePrintTemplate(activeDocTab)}
            menu={{
              items: [
                {
                  key: 'pr_tt06',
                  icon: <PrinterOutlined style={{ color: '#2563eb' }} />,
                  label: 'In Biểu mẫu 1: Sơ yếu lý lịch (Mẫu TT 06/2023/TT-BNV — 38 Mục)',
                  onClick: () => handlePrintTemplate('tt06'),
                },
                {
                  key: 'pr_hs01',
                  icon: <PrinterOutlined style={{ color: '#0f766e' }} />,
                  label: 'In Biểu mẫu 2: Lý lịch viên chức (Mẫu HS01-VC/BNV — 7 Phần La Mã)',
                  onClick: () => handlePrintTemplate('hs01'),
                },
              ],
            }}
          >
            In biểu mẫu chuẩn ({activeDocTab === 'tt06' ? 'TT06/2023' : 'HS01-VC/BNV'})
          </Dropdown.Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSaveMainProfile}
            style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600 }}
          >
            Lưu Hồ sơ (Đồng bộ 2 Tab)
          </Button>
        </Space>
      </div>

      {/* Header Profile Summary Card */}
      <Card bordered={false} style={{ marginBottom: 16, borderRadius: 12 }}>
        <Row gutter={[20, 16]} align="middle">
          <Col xs={24} sm={5} md={3} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 100,
                height: 135,
                margin: '0 auto 8px',
                border: '2px dashed #94a3b8',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
              }}
            >
              {profile.portrait_url ? (
                <img
                  src={profile.portrait_url}
                  alt="Ảnh 4x6"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: 8 }}>
                  <UserOutlined style={{ fontSize: 28, display: 'block', marginBottom: 4 }} />
                  Ảnh 4x6
                </div>
              )}
            </div>
            <Upload showUploadList={false} beforeUpload={handleUploadPortrait} accept=".jpg,.jpeg,.png,.webp">
              <Button size="small" icon={<UploadOutlined />} loading={uploadingPortrait} className="no-print">
                Tải ảnh 4x6
              </Button>
            </Upload>
          </Col>

          <Col xs={24} sm={19} md={15}>
            <Typography.Title level={4} style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {profile.birth_full_name || profile.account_full_name}
            </Typography.Title>
            <Space wrap style={{ marginTop: 6, marginBottom: 8 }}>
              <Tag color="blue">Tài khoản: {profile.username}</Tag>
              <Tag color="purple">Số hiệu / Mã HS: {profile.official_file_code || profile.cccd_number || 'Chưa cấp'}</Tag>
              <Tag color="cyan">CCCD: {profile.cccd_number || 'Chưa cập nhật'}</Tag>
              <Tag color="green">Sổ BHXH: {profile.social_insurance_code || 'Chưa cập nhật'}</Tag>
              {profile.health_insurance_card_no && <Tag color="geekblue">Thẻ BHYT: {profile.health_insurance_card_no}</Tag>}
              {isCpvMember && <Tag color="red">Đảng viên ĐCSVN</Tag>}
            </Space>
            <Row gutter={[16, 4]} style={{ fontSize: 13, color: '#475569' }}>
              <Col xs={24} sm={12}>
                • Cơ quan quản lý: <strong>{profile.managing_agency_name || 'Chưa kê khai'}</strong>
              </Col>
              <Col xs={24} sm={12}>
                • Đơn vị sử dụng: <strong>{profile.using_agency_name || profile.work_unit_name || profile.department_name || 'Chưa kê khai'}</strong>
              </Col>
              <Col xs={24} sm={12}>
                • Ngạch/CDNN: <strong>{profile.professional_title_name || 'Chưa xếp ngạch'}</strong>{' '}
                {profile.professional_title_code ? `(${profile.professional_title_code})` : ''}
              </Col>
              <Col xs={24} sm={12}>
                • Bậc / Hệ số lương:{' '}
                <strong>
                  {profile.salary_coefficient
                    ? `Bậc ${profile.salary_step || '-'} (HS: ${Number(profile.salary_coefficient).toFixed(2)})`
                    : 'Chưa xếp lương'}
                </strong>
              </Col>
            </Row>
          </Col>

          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#64748b' }}>Mức độ hoàn thiện hồ sơ</div>
            <Progress
              percent={profile.completion_percent}
              status={profile.completion_percent >= 80 ? 'success' : 'active'}
              strokeColor={{ '0%': '#4f46e5', '100%': '#10b981' }}
            />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Đào tạo: <strong>{profile.training_records.length}</strong> • Công tác:{' '}
              <strong>{profile.work_experiences.length}</strong> • Gia đình:{' '}
              <strong>{profile.family_relations.length}</strong>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Main 2-Profile Switcher Card */}
      <Card bordered={false} style={{ borderRadius: 12 }}>
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
            padding: '10px 14px',
            background: 'rgba(79, 70, 229, 0.06)',
            borderRadius: 10,
            border: '1px solid rgba(79, 70, 229, 0.2)',
          }}
        >
          <Space wrap size={12}>
            <Button
              type={activeDocTab === 'tt06' ? 'primary' : 'default'}
              size="large"
              icon={<ProfileOutlined />}
              onClick={() => setActiveDocTab('tt06')}
              style={
                activeDocTab === 'tt06'
                  ? { background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 700 }
                  : { fontWeight: 600 }
              }
            >
              Hồ sơ 1: SƠ YẾU LÝ LỊCH (Mẫu TT 06/2023/TT-BNV — 38 Mục)
            </Button>
            <Button
              type={activeDocTab === 'hs01' ? 'primary' : 'default'}
              size="large"
              icon={<BookOutlined />}
              onClick={() => setActiveDocTab('hs01')}
              style={
                activeDocTab === 'hs01'
                  ? { background: '#0f766e', borderColor: '#0f766e', fontWeight: 700 }
                  : { fontWeight: 600 }
              }
            >
              Hồ sơ 2: LÝ LỊCH VIÊN CHỨC (Mẫu HS01-VC/BNV — TT 07/2019/TT-BNV)
            </Button>
          </Space>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            * Dữ liệu dùng chung được đồng bộ tự động giữa 2 Tab Hồ sơ. Nhập 1 lần, hiển thị chuẩn cả 2 mẫu.
          </Typography.Text>
        </div>

        <Form form={form} layout="vertical">
          {/* ========================================================================================= */}
          {/* TAB HỒ SƠ 1: SƠ YẾU LÝ LỊCH (THEO THÔNG TƯ 06/2023/TT-BNV — ĐẦY ĐỦ 38 MỤC)               */}
          {/* ========================================================================================= */}
          <div style={{ display: activeDocTab === 'tt06' ? 'block' : 'none' }}>
            <div
              style={{
                textAlign: 'center',
                padding: '12px 16px',
                marginBottom: 16,
                borderBottom: '2px solid #e2e8f0',
              }}
            >
              <Typography.Title level={4} style={{ margin: 0, color: '#1e3a8a' }}>
                SƠ YẾU LÝ LỊCH CÁN BỘ, CÔNG CHỨC, VIÊN CHỨC
              </Typography.Title>
              <Typography.Text type="secondary">
                (Biểu mẫu chuẩn theo Thông tư số 06/2023/TT-BNV của Bộ trưởng Bộ Nội vụ — Gồm 38 mục thông tin)
              </Typography.Text>
            </div>

            <Tabs
              defaultActiveKey="tt06_sec1"
              type="card"
              items={[
                {
                  key: 'tt06_sec1',
                  label: 'Mục 1) → 18): Nhân thân, CCCD, BHXH, Tuyển dụng & Chính trị',
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Divider orientation="left" style={{ marginTop: 0 }}>
                        Thông tin Cơ quan Quản lý & Số hiệu Hồ sơ (Đầu trang biểu mẫu TT06)
                      </Divider>
                      <Row gutter={16}>
                        <Col xs={24} md={9}>
                          <Form.Item name="managing_agency_name" label="Cơ quan quản lý cán bộ, công chức, viên chức">
                            <Input placeholder="VD: Sở Nông nghiệp và Môi trường TP. Hồ Chí Minh" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={9}>
                          <Form.Item name="using_agency_name" label="Cơ quan, đơn vị sử dụng cán bộ, công chức, viên chức">
                            <Input placeholder="VD: Ban Quản lý các Khu liên hợp xử lý chất thải Thành phố" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={3}>
                          <Form.Item name="official_file_code" label="Số hiệu">
                            <Input placeholder="079203017722" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={3}>
                          <Form.Item name="cccd_number" label="Mã số định danh">
                            <Input placeholder="12 chữ số CCCD" maxLength={15} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left">Mục 1) → 11): Thông tin Nhân thân, CCCD, BHXH/BHYT & Nơi ở</Divider>
                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name="birth_full_name"
                            label="1) Họ và tên khai sinh (viết chữ IN HOA)"
                            rules={[{ required: true, message: 'Vui lòng nhập họ và tên khai sinh' }]}
                          >
                            <Input style={{ textTransform: 'uppercase', fontWeight: 600 }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="gender" label="Giới tính">
                            <Select
                              allowClear
                              options={[
                                { label: 'Nam', value: 'Nam' },
                                { label: 'Nữ', value: 'Nữ' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="alias_name" label="2) Các tên gọi khác">
                            <Input placeholder="Để trống nếu không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="date_of_birth" label="3) Sinh ngày, tháng, năm">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item name="birthplace_ward" label="4) Nơi sinh — Xã / Phường / Thị trấn">
                            <Input placeholder="VD: Xã Bình Khánh" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="birthplace_district" label="4) Nơi sinh — Quận / Huyện (nếu có)">
                            <Input placeholder="Quận / Huyện" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="birthplace_province" label="4) Nơi sinh — Tỉnh / Thành phố">
                            <Input placeholder="VD: TP. Hồ Chí Minh" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item name="hometown_ward" label="5) Quê quán — Xã / Phường / Thị trấn">
                            <Input placeholder="VD: Xã Bình Khánh" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="hometown_district" label="5) Quê quán — Quận / Huyện (nếu có)">
                            <Input placeholder="Quận / Huyện" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="hometown_province" label="5) Quê quán — Tỉnh / Thành phố">
                            <Input placeholder="VD: TP. Hồ Chí Minh" />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={4}>
                          <Form.Item name="ethnicity" label="6) Dân tộc">
                            <Input placeholder="Kinh" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="religion" label="7) Tôn giáo">
                            <Input placeholder="Không theo tôn giáo nào" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="cccd_number" label="8) Số CCCD">
                            <Input placeholder="079203017722" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="cccd_issue_date" label="Ngày cấp CCCD">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={5}>
                          <Form.Item name="personal_phone" label="SĐT liên hệ">
                            <Input placeholder="0374277590" />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="social_insurance_code" label="9) Sổ BHXH">
                            <Input placeholder="7936385027" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="health_insurance_card_no" label="Số thẻ BHYT">
                            <Input placeholder="HC4797936385027" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="family_background" label="11) Thành phần gia đình xuất thân">
                            <Input placeholder="VD: Viên chức / Công nhân / Nông dân" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="occupation_before_recruitment" label="12) Nghề nghiệp trước khi được tuyển dụng">
                            <Input placeholder="VD: Sinh viên" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item name="current_address" label="10) Nơi ở hiện nay">
                            <Input.TextArea rows={2} placeholder="VD: 255 Ấp Bình Trường, Xã Bình Khánh, TP. Hồ Chí Minh" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="permanent_address" label="Nơi đăng ký hộ khẩu thường trú (Đồng bộ Mục 8 Mẫu HS01)">
                            <Input.TextArea rows={2} placeholder="VD: 255 Ấp Bình Trường, Xã Bình Khánh, TP. Hồ Chí Minh" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left">Mục 13) → 18): Tuyển dụng, Đảng CSVN, Đoàn thể, Quân đội & Chính sách</Divider>
                      <Row gutter={16}>
                        <Col xs={12} md={6}>
                          <Form.Item name="first_recruitment_date" label="13) Ngày được tuyển dụng lần đầu">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="recruitment_agency" label="Cơ quan, tổ chức, đơn vị tuyển dụng">
                            <Input placeholder="VD: Ban Quản lý các Khu liên hợp xử lý chất thải Thành phố" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="current_agency_join_date" label="14) Ngày vào cơ quan hiện công tác">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="cpv_probationary_date" label="15) Ngày vào Đảng CSVN (Để trống nếu Không có)">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="cpv_official_date" label="Ngày chính thức">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="first_socio_political_org_date"
                            label="16) Ngày tham gia tổ chức CT-XH đầu tiên (Đoàn TNCSHCM, Công đoàn, Hội)"
                          >
                            <Input placeholder="Nhập ngày tháng và tên tổ chức" />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={5}>
                          <Form.Item name="enlistment_date" label="17) Ngày nhập ngũ">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="discharge_date" label="Ngày xuất ngũ">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="highest_military_rank" label="Quân hàm cao nhất">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="policy_family_type" label="18) Đối tượng chính sách">
                            <Input placeholder="Không có (Hoặc Con thương binh, con liệt sĩ...)" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: 'tt06_sec2',
                  label: 'Mục 19) → 31): Trình độ, Chức vụ, Tiền lương (30.1-30.3) & Sức khỏe',
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Divider orientation="left" style={{ marginTop: 0 }}>
                        Mục 19) → 29): Giáo dục, Chuyên môn, Chức vụ, Quy hoạch & Công việc chính
                      </Divider>
                      <Row gutter={16}>
                        <Col xs={12} md={6}>
                          <Form.Item name="general_education_level" label="19) Trình độ giáo dục phổ thông">
                            <Input placeholder="12/12" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="highest_professional_degree" label="20) Trình độ chuyên môn cao nhất">
                            <Input placeholder="VD: Đại học / Thạc sĩ..." />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="academic_title" label="21) Học hàm">
                            <Input placeholder="Không có / Giáo sư / Phó Giáo sư" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="state_honorary_title" label="22) Danh hiệu nhà nước phong tặng">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item name="leadership_position" label="23) Chức vụ hiện tại">
                            <Input placeholder="Không / Trưởng phòng..." />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="appointment_date" label="Ngày bổ nhiệm / phê chuẩn">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="reappointment_date" label="Ngày bổ nhiệm lại / phê chuẩn nhiệm kỳ tiếp theo">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="planned_position_title" label="24) Được quy hoạch chức danh">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="concurrent_position" label="25) Chức vụ kiêm nhiệm">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="cpv_current_position" label="26) Chức vụ Đảng hiện tại">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="cpv_concurrent_position" label="27) Chức vụ Đảng kiêm nhiệm">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item name="main_assigned_duty" label="28) Công việc chính được giao">
                            <Input placeholder="VD: Chuyên viên về công nghệ thông tin Bậc III" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="work_forte" label="29) Sở trường công tác">
                            <Input placeholder="VD: Kỹ thuật phần mềm" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={8}>
                          <Form.Item name="longest_held_job" label="Công việc làm lâu nhất">
                            <Input placeholder="VD: Kỹ thuật phần mềm" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left">Mục 30): Tiền lương (30.1 Ngạch/CDNN • 30.2 Phụ cấp • 30.3 Vị trí việc làm)</Divider>
                      <Row gutter={16}>
                        <Col xs={12} md={6}>
                          <Form.Item name="professional_title_name" label="30.1) Ngạch / Chức danh nghề nghiệp">
                            <Input placeholder="VD: Chuyên viên" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="professional_title_code" label="Mã số">
                            <Input placeholder="01.003" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="title_appointment_date" label="Ngày bổ nhiệm ngạch/CDNN">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={6} md={3}>
                          <Form.Item name="salary_step" label="Bậc lương">
                            <InputNumber min={1} max={12} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={6} md={3}>
                          <Form.Item name="salary_coefficient" label="Hệ số">
                            <InputNumber min={1} max={15} step={0.01} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={3}>
                          <Form.Item name="salary_effective_date" label="Ngày hưởng">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={8} md={4}>
                          <Form.Item name="salary_enjoy_percent" label="Phần trăm hưởng (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="100" />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="seniority_exceed_percent" label="Phụ cấp TNVK (%)">
                            <InputNumber min={0} max={50} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="seniority_exceed_effective_date" label="Ngày hưởng PCTNVK">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="leadership_allowance" label="30.2) Phụ cấp chức vụ">
                            <InputNumber min={0} step={0.05} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="concurrent_allowance" label="Phụ cấp kiêm nhiệm">
                            <InputNumber min={0} step={0.05} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="other_allowance" label="Phụ cấp khác">
                            <InputNumber min={0} step={0.05} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item name="approved_job_position_name" label="30.3) Vị trí việc làm">
                            <Input placeholder="VD: Chuyên viên công nghệ thông tin Bậc III" />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="job_position_code" label="Mã số VTVL">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="job_position_salary_step" label="Bậc lương VTVL">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={4}>
                          <Form.Item name="job_position_salary_amount" label="Lương theo mức tiền">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="job_position_effective_date" label="Ngày hưởng VTVL">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left">Mục 31): Tình trạng Sức khoẻ</Divider>
                      <Row gutter={16}>
                        <Col xs={12} md={6}>
                          <Form.Item name="health_classification" label="31) Tình trạng sức khoẻ">
                            <Input placeholder="Tốt" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="height_cm" label="Chiều cao (cm)">
                            <InputNumber min={100} max={250} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="weight_kg" label="Cân nặng (kg)">
                            <InputNumber min={30} max={200} step={0.5} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="blood_type" label="Nhóm máu">
                            <Input placeholder="A / B / AB / O / Chưa có thông tin" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: 'tt06_sec3',
                  label: `Mục 32): Quá trình Đào tạo, Bồi dưỡng (${profile.training_records.length})`,
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="Mục 32) QUÁ TRÌNH ĐÀO TẠO, BỒI DƯỠNG (Chia làm 6 bảng con từ 32.1 đến 32.6 theo đúng mẫu TT 06/2023/TT-BNV — Tự động gộp sang Bảng Phần II của Mẫu HS01-VC/BNV)"
                      />
                      {renderTrainingTableForCategory(
                        'CHUYEN_MON',
                        '32.1- Chuyên môn (từ trung cấp trở lên cả trong nước và nước ngoài)',
                        true,
                        false
                      )}
                      {renderTrainingTableForCategory('LY_LUAN_CHINH_TRI', '32.2- Lý luận chính trị', false, false)}
                      {renderTrainingTableForCategory(
                        'BOI_DUONG_QLNN',
                        '32.3- Bồi dưỡng quản lý nhà nước / chức danh nghề nghiệp / nghiệp vụ chuyên ngành',
                        false,
                        false
                      )}
                      {renderTrainingTableForCategory(
                        'AN_NINH_QUOC_PHONG',
                        '32.4- Bồi dưỡng kiến thức an ninh, quốc phòng',
                        false,
                        false
                      )}
                      {renderTrainingTableForCategory('TIN_HOC', '32.5- Tin học', false, false)}
                      {renderTrainingTableForCategory('NGOAI_NGU', '32.6- Ngoại ngữ / tiếng dân tộc', false, true)}
                    </div>
                  ),
                },
                {
                  key: 'tt06_sec4',
                  label: 'Mục 33) → 35): Quá trình Công tác, Lịch sử bản thân, Khen thưởng & Kỷ luật',
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      {/* 33) Tóm tắt quá trình công tác */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                          33) TÓM TẮT QUÁ TRÌNH CÔNG TÁC
                        </Typography.Title>
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openSubModal('work-experiences')}
                        >
                          Thêm quá trình công tác
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="id"
                        pagination={false}
                        dataSource={profile.work_experiences}
                        style={{ marginBottom: 20 }}
                        columns={[
                          { title: 'Từ tháng/năm', dataIndex: 'from_month_year', width: 120 },
                          { title: 'Đến tháng/năm', dataIndex: 'to_month_year', width: 120, render: (v) => v || 'nay' },
                          {
                            title: 'Đơn vị công tác (đảng, chính quyền, đoàn thể, tổ chức xã hội)',
                            dataIndex: 'organization_name',
                            render: (v, r) => (
                              <div>
                                <strong>{v}</strong>
                                {r.department_name ? ` — ${r.department_name}` : ''}
                              </div>
                            ),
                          },
                          { title: 'Chức danh / chức vụ', dataIndex: 'position_name', width: 220, render: (v) => v || '-' },
                          {
                            title: 'Thao tác',
                            key: 'actions',
                            width: 90,
                            render: (_, r) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('work-experiences', r)} />
                                <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('work-experiences', r.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />

                      <Divider orientation="left">34) ĐẶC ĐIỂM LỊCH SỬ BẢN THÂN</Divider>
                      <Row gutter={16}>
                        <Col xs={24}>
                          <Form.Item
                            name="political_history_self"
                            label="34.1- Khai rõ: bị bắt, bị tù (từ ngày tháng năm nào đến ngày tháng năm nào, ở đâu?), đã khai báo cho ai, những vấn đề gì?"
                          >
                            <Input.TextArea rows={2} placeholder="Không" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="old_regime_work_json"
                            label="34.2- Bản thân có làm việc cho chế độ cũ (Từ tháng/năm - Đến tháng/năm; Chức danh, chức vụ, đơn vị, địa điểm)"
                          >
                            <Input.TextArea rows={2} placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="foreign_relations_history"
                            label="34.3- Tham gia hoặc có quan hệ với các tổ chức chính trị, kinh tế, xã hội... ở nước ngoài"
                          >
                            <Input.TextArea rows={2} placeholder="Không có" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left">35) KHEN THƯỞNG, KỶ LUẬT</Divider>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} lg={12}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Typography.Text strong>35.1- Thành tích thi đua, khen thưởng</Typography.Text>
                            <Button size="small" icon={<PlusOutlined />} onClick={() => openSubModal('rewards')}>
                              Thêm khen thưởng
                            </Button>
                          </div>
                          <Table
                            size="small"
                            bordered
                            rowKey="id"
                            pagination={false}
                            dataSource={profile.rewards}
                            columns={[
                              { title: 'Năm', dataIndex: 'reward_year', width: 70 },
                              { title: 'Xếp loại chuyên môn', dataIndex: 'professional_rating', render: (v) => v || '-' },
                              { title: 'Xếp loại thi đua', dataIndex: 'emulation_rating', render: (v) => v || '-' },
                              { title: 'Hình thức khen thưởng', dataIndex: 'reward_form' },
                              {
                                title: '',
                                key: 'act',
                                width: 75,
                                render: (_, r) => (
                                  <Space size={4}>
                                    <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('rewards', r)} />
                                    <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('rewards', r.id)}>
                                      <Button size="small" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        </Col>

                        <Col xs={24} lg={12}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Typography.Text strong>35.2- Kỷ luật Đảng / hành chính</Typography.Text>
                            <Button size="small" danger icon={<PlusOutlined />} onClick={() => openSubModal('disciplines')}>
                              Thêm kỷ luật
                            </Button>
                          </div>
                          <Table
                            size="small"
                            bordered
                            rowKey="id"
                            pagination={false}
                            dataSource={profile.disciplines}
                            columns={[
                              {
                                title: 'Tháng/năm (Từ - Đến)',
                                key: 'period',
                                width: 130,
                                render: (_, r) =>
                                  r.from_month_year
                                    ? `${r.from_month_year}${r.to_month_year ? ` - ${r.to_month_year}` : ''}`
                                    : r.discipline_date
                                    ? dayjs(r.discipline_date).format('DD/MM/YYYY')
                                    : '-',
                              },
                              { title: 'Hình thức', dataIndex: 'discipline_form', render: (v) => <Tag color="red">{v}</Tag> },
                              { title: 'Hành vi vi phạm chính', dataIndex: 'reason', render: (v) => v || '-' },
                              { title: 'Cơ quan quyết định', dataIndex: 'issuing_authority', render: (v) => v || '-' },
                              {
                                title: '',
                                key: 'act',
                                width: 75,
                                render: (_, r) => (
                                  <Space size={4}>
                                    <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('disciplines', r)} />
                                    <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('disciplines', r.id)}>
                                      <Button size="small" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        </Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: 'tt06_sec5',
                  label: `Mục 36) → 38): Quan hệ Gia đình (${profile.family_relations.length}), Kinh tế & Nhận xét`,
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Divider orientation="left" style={{ marginTop: 0 }}>
                        36) QUAN HỆ GIA ĐÌNH (Bảng 4 cột chuẩn TT 06/2023/TT-BNV)
                      </Divider>

                      {/* 36.1 Về bản thân */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Typography.Text strong style={{ color: '#1e40af' }}>
                          36.1- Về bản thân: Cha, Mẹ, Vợ (hoặc chồng), các con, anh chị em ruột
                        </Typography.Text>
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openSubModal('family-relations', undefined, { side_type: 'self' })}
                        >
                          Thêm thân nhân (Bản thân)
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="id"
                        pagination={false}
                        dataSource={profile.family_relations.filter((f) => f.side_type !== 'spouse')}
                        style={{ marginBottom: 18 }}
                        columns={[
                          { title: 'Mối quan hệ', dataIndex: 'relationship_type', width: 130, render: (v) => <strong>{v}</strong> },
                          { title: 'Họ và tên', dataIndex: 'full_name', width: 180, render: (v) => <strong>{v}</strong> },
                          { title: 'Năm sinh', dataIndex: 'birth_year', width: 95, render: (v) => v || '-' },
                          {
                            title:
                              'Quê quán, nghề nghiệp, chức danh, chức vụ, đơn vị công tác, học tập, nơi ở (trong, ngoài nước); thành viên các tổ chức CT-XH...',
                            key: 'details',
                            render: (_, r) => <div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{formatFamilySummaryCell(r)}</div>,
                          },
                          {
                            title: 'Thao tác',
                            key: 'act',
                            width: 85,
                            render: (_, r) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('family-relations', r)} />
                                <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('family-relations', r.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />

                      {/* 36.2 Bên vợ hoặc chồng */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Typography.Text strong style={{ color: '#1e40af' }}>
                          36.2- Cha, Mẹ, anh chị em ruột (bên vợ hoặc chồng)
                        </Typography.Text>
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => openSubModal('family-relations', undefined, { side_type: 'spouse' })}
                        >
                          Thêm thân nhân (Bên Vợ/Chồng)
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="id"
                        pagination={false}
                        dataSource={profile.family_relations.filter((f) => f.side_type === 'spouse')}
                        style={{ marginBottom: 20 }}
                        columns={[
                          { title: 'Mối quan hệ', dataIndex: 'relationship_type', width: 130, render: (v) => <strong>{v}</strong> },
                          { title: 'Họ và tên', dataIndex: 'full_name', width: 180, render: (v) => <strong>{v}</strong> },
                          { title: 'Năm sinh', dataIndex: 'birth_year', width: 95, render: (v) => v || '-' },
                          {
                            title:
                              'Quê quán, nghề nghiệp, chức danh, chức vụ, đơn vị công tác, học tập, nơi ở (trong, ngoài nước)...',
                            key: 'details',
                            render: (_, r) => <div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{formatFamilySummaryCell(r)}</div>,
                          },
                          {
                            title: 'Thao tác',
                            key: 'act',
                            width: 85,
                            render: (_, r) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('family-relations', r)} />
                                <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('family-relations', r.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />

                      <Divider orientation="left">37) HOÀN CẢNH KINH TẾ GIA ĐÌNH</Divider>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Typography.Text strong>37.1- Quá trình lương của bản thân</Typography.Text>
                        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openSubModal('salary-logs')}>
                          Thêm diễn biến lương
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="id"
                        pagination={false}
                        dataSource={profile.salary_logs}
                        style={{ marginBottom: 16 }}
                        columns={[
                          {
                            title: 'Từ tháng/năm',
                            key: 'from_my',
                            width: 120,
                            render: (_, r) =>
                              r.from_month_year || (r.effective_date ? dayjs(r.effective_date).format('MM/YYYY') : '-'),
                          },
                          {
                            title: 'Đến tháng/năm',
                            dataIndex: 'to_month_year',
                            width: 120,
                            render: (v) => v || 'nay',
                          },
                          { title: 'Mã số', dataIndex: 'rank_code', width: 120, render: (v) => v || '-' },
                          { title: 'Bậc lương', dataIndex: 'salary_step', width: 100, render: (v) => v ?? '-' },
                          {
                            title: 'Hệ số lương',
                            dataIndex: 'coefficient',
                            width: 120,
                            render: (v) => <Tag color="green">{Number(v).toFixed(2)}</Tag>,
                          },
                          {
                            title: 'Tiền lương theo vị trí việc làm',
                            dataIndex: 'position_salary_amount',
                            render: (v) => v || '-',
                          },
                          {
                            title: 'Thao tác',
                            key: 'act',
                            width: 85,
                            render: (_, r) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('salary-logs', r)} />
                                <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('salary-logs', r.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />

                      <Row gutter={16}>
                        <Col xs={24}>
                          <Form.Item
                            name="other_allowances_log_json"
                            label="37.2- Các loại phụ cấp khác (Từ tháng/năm - Đến tháng/năm; Loại phụ cấp; Phần trăm hưởng; Hệ số; Giá trị)"
                          >
                            <Input.TextArea rows={2} placeholder="Ghi nhận các phụ cấp khác qua các thời kỳ (nếu có)" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        37.3- Nguồn thu nhập chính của gia đình hàng năm
                      </Typography.Text>
                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item name="family_income_salary" label="- Tiền lương">
                            <Input placeholder="VD: 5.920.200 đồng/tháng" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={16}>
                          <Form.Item name="family_income_other" label="- Các nguồn khác">
                            <Input placeholder="VD: Tiền thu nhập tăng thêm theo Nghị quyết 27/2025/NQ-HĐND" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="housing_allocated_info" label="+ Nhà ở được cấp, được thuê (loại nhà)">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="housing_owned_info" label="+ Nhà tự mua, tự xây (loại nhà)">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={4}>
                          <Form.Item name="land_allocated_info" label="+ Đất ở được cấp">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={4}>
                          <Form.Item name="land_purchased_info" label="+ Đất ở tự mua">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={4}>
                          <Form.Item name="production_land_info" label="- Đất SX kinh doanh">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left">38) NHẬN XÉT, ĐÁNH GIÁ CỦA CƠ QUAN, TỔ CHỨC, ĐƠN VỊ SỬ DỤNG</Divider>
                      <Form.Item
                        name="agency_evaluation_comment"
                        label="38) Nội dung nhận xét, đánh giá và xác nhận của cơ quan, đơn vị quản lý / sử dụng CBCCVC"
                      >
                        <Input.TextArea rows={3} placeholder="Nhập nhận xét, đánh giá của cơ quan, tổ chức, đơn vị sử dụng..." />
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* ========================================================================================= */}
          {/* TAB HỒ SƠ 2: LÝ LỊCH VIÊN CHỨC (MẪU HS01-VC/BNV — THÔNG TƯ 07/2019/TT-BNV — 7 PHẦN LA MÃ) */}
          {/* ========================================================================================= */}
          <div style={{ display: activeDocTab === 'hs01' ? 'block' : 'none' }}>
            <div
              style={{
                textAlign: 'center',
                padding: '12px 16px',
                marginBottom: 16,
                borderBottom: '2px solid #0f766e',
                background: 'rgba(15, 118, 110, 0.04)',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, color: '#475569' }}>
                Mẫu HS01-VC/BNV ban hành kèm theo Thông tư số 07/2019/TT-BNV ngày 01/6/2019 của Bộ trưởng Bộ Nội vụ
              </div>
              <Typography.Title level={4} style={{ margin: '4px 0', color: '#0f766e' }}>
                LÝ LỊCH VIÊN CHỨC (MẪU HS01-VC/BNV)
              </Typography.Title>
              <Typography.Text type="secondary">
                Cấu trúc chuẩn gồm Trang bìa & 7 Phần La Mã (I → VII) • Tự động đồng bộ dữ liệu với Sơ yếu lý lịch TT06
              </Typography.Text>
            </div>

            <Tabs
              defaultActiveKey="hs01_part1"
              type="card"
              items={[
                {
                  key: 'hs01_part1',
                  label: 'Trang bìa & Phần I: Sơ lược Lý lịch (Mục 1 → 24)',
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Divider orientation="left" style={{ marginTop: 0 }}>
                        TRANG BÌA QUYỂN LÝ LỊCH VIÊN CHỨC (Mẫu HS01-VC/BNV)
                      </Divider>
                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item name="managing_agency_name" label="Cơ quan, đơn vị quản lý viên chức">
                            <Input placeholder="VD: Sở Nông nghiệp và Môi trường TP. Hồ Chí Minh" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={10}>
                          <Form.Item name="using_agency_name" label="Đơn vị sử dụng viên chức">
                            <Input placeholder="VD: Ban Quản lý các Khu liên hợp xử lý chất thải Thành phố" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="official_file_code" label="Số hiệu viên chức">
                            <Input placeholder="079203017722" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left">I. SƠ LƯỢC LÝ LỊCH (Mục 1 → 24 theo đúng thứ tự Mẫu HS01-VC/BNV)</Divider>
                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item name="birth_full_name" label="1) Họ và tên khai sinh (viết chữ in hoa)" rules={[{ required: true }]}>
                            <Input style={{ textTransform: 'uppercase', fontWeight: 600 }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="alias_name" label="2) Tên gọi khác">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="date_of_birth" label="3) Sinh ngày, tháng, năm">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="gender" label="Giới tính (nam, nữ)">
                            <Select options={[{ label: 'Nam', value: 'Nam' }, { label: 'Nữ', value: 'Nữ' }]} />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="birthplace_ward" label="4) Nơi sinh (Xã/Phường)">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="birthplace_province" label="4) Nơi sinh (Tỉnh/TP)">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="hometown_ward" label="5) Quê quán (Xã/Phường)">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="hometown_province" label="5) Quê quán (Tỉnh/TP)">
                            <Input />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="ethnicity" label="6) Dân tộc">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="religion" label="7) Tôn giáo">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="occupation_before_recruitment" label="10) Nghề nghiệp khi được tuyển dụng">
                            <Input placeholder="VD: Sinh viên" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="permanent_address"
                            label="8) Nơi đăng ký hộ khẩu thường trú (Số nhà, đường phố, thành phố: xóm, thôn, xã, huyện, tỉnh)"
                          >
                            <Input.TextArea rows={2} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="current_address"
                            label="9) Nơi ở hiện nay (Số nhà, đường phố, thành phố: xóm, thôn, xã, huyện, tỉnh)"
                          >
                            <Input.TextArea rows={2} />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="first_recruitment_date" label="11) Ngày tuyển dụng">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={10}>
                          <Form.Item name="recruitment_agency" label="Cơ quan, đơn vị tuyển dụng">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="leadership_position" label="12.1) Chức danh (chức vụ) hiện tại">
                            <Input placeholder="Không" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="concurrent_position" label="12.2) Chức danh kiêm nhiệm">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item name="main_assigned_duty" label="13) Công việc chính được giao">
                            <Input placeholder="Chuyên viên công nghệ thông tin bậc III" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="professional_title_name" label="14) Chức danh nghề nghiệp VC">
                            <Input placeholder="Chuyên viên" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={3}>
                          <Form.Item name="professional_title_code" label="Mã số">
                            <Input placeholder="01.003" />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={2}>
                          <Form.Item name="salary_step" label="Bậc lương">
                            <InputNumber min={1} max={12} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={3}>
                          <Form.Item name="salary_coefficient" label="Hệ số">
                            <InputNumber min={1} max={15} step={0.01} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={3}>
                          <Form.Item name="salary_effective_date" label="Ngày hưởng">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={4}>
                          <Form.Item name="general_education_level" label="15.1- Trình độ GD phổ thông">
                            <Input placeholder="12/12" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="highest_professional_degree" label="15.2- Trình độ chuyên môn cao nhất">
                            <Input placeholder="Đại học Công nghệ thông tin" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="political_theory_level" label="15.3- Lý luận chính trị">
                            <Input placeholder="Sơ cấp / Trung cấp / Cao cấp" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="state_management_level" label="15.4- Quản lý nhà nước">
                            <Input placeholder="Chuyên viên / CVC..." />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={5}>
                          <Form.Item name="professional_skill_by_major" label="15.5- Nghiệp vụ theo chuyên ngành">
                            <Input placeholder="Đại học Công nghệ thông tin" />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="foreign_language_level" label="15.6- Ngoại ngữ">
                            <Input placeholder="Tên ngoại ngữ + trình độ (Bậc 1-6)" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="it_skill_level" label="15.7- Tin học">
                            <Input placeholder="Trình độ CNTT / Kỹ năng" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="cpv_probationary_date" label="16) Ngày vào Đảng CSVN">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="cpv_official_date" label="Ngày chính thức">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                          <Form.Item name="first_socio_political_org_date" label="17) Ngày tham gia tổ chức chính trị - xã hội">
                            <Input placeholder="Đoàn, Hội... và làm việc gì trong tổ chức đó" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="enlistment_date" label="18) Ngày nhập ngũ">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={5}>
                          <Form.Item name="discharge_date" label="Ngày xuất ngũ">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="highest_military_rank" label="Quân hàm cao nhất">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="state_honorary_title" label="19.1) Danh hiệu được phong tặng cao nhất">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="academic_title" label="19.2) Hàm học được phong (GS, PGS)">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="work_forte" label="20) Sở trường công tác">
                            <Input placeholder="Kỹ thuật phần mềm" />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="health_classification" label="21) Tình trạng sức khoẻ">
                            <Input placeholder="Tốt" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="height_cm" label="Chiều cao (cm)">
                            <InputNumber style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="weight_kg" label="Cân nặng (kg)">
                            <InputNumber style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="blood_type" label="Nhóm máu">
                            <Input />
                          </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                          <Form.Item name="wounded_soldier_class" label="22) Là thương binh hạng">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={6}>
                          <Form.Item name="policy_family_type" label="Là con gia đình chính sách">
                            <Input placeholder="Không có" />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="cccd_number" label="23) Số CMND / CCCD">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item name="cccd_issue_date" label="Ngày cấp">
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={4}>
                          <Form.Item name="social_insurance_code" label="24) Sổ BHXH">
                            <Input />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: 'hs01_part2_3',
                  label: 'Phần II & III: Quá trình Đào tạo (Bảng gộp) & Đặc điểm Lịch sử Bản thân',
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Typography.Title level={5} style={{ margin: 0, color: '#0f766e' }}>
                          II. QUÁ TRÌNH ĐÀO TẠO, BỒI DƯỠNG VỀ CHUYÊN MÔN, NGHIỆP VỤ, LÝ LUẬN CHÍNH TRỊ, NGOẠI NGỮ, TIN HỌC
                        </Typography.Title>
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openSubModal('trainings', undefined, { training_category: 'CHUYEN_MON', training_mode: 'Chính quy' })}
                        >
                          Thêm quá trình đào tạo
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="id"
                        pagination={false}
                        dataSource={profile.training_records}
                        style={{ marginBottom: 24 }}
                        columns={[
                          { title: 'Tên trường', dataIndex: 'school_name', render: (v) => <strong>{v}</strong> },
                          { title: 'Chuyên ngành đào tạo, bồi dưỡng', dataIndex: 'major', render: (v) => v || '-' },
                          { title: 'Từ tháng, năm', dataIndex: 'from_period', width: 120, render: (v) => v || '-' },
                          { title: 'Đến tháng, năm', dataIndex: 'to_period', width: 120, render: (v) => v || '-' },
                          { title: 'Hình thức đào tạo', dataIndex: 'training_mode', width: 140, render: (v) => v || '-' },
                          {
                            title: 'Văn bằng, chứng chỉ',
                            dataIndex: 'degree_certificate',
                            width: 160,
                            render: (v) => (v ? <Tag color="cyan">{v}</Tag> : '-'),
                          },
                          {
                            title: 'Thao tác',
                            key: 'act',
                            width: 90,
                            render: (_, r) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('trainings', r)} />
                                <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('trainings', r.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Typography.Title level={5} style={{ margin: 0, color: '#0f766e' }}>
                          III. ĐẶC ĐIỂM LỊCH SỬ BẢN THÂN (Trước và sau khi được tuyển dụng)
                        </Typography.Title>
                        <Button size="small" icon={<PlusOutlined />} onClick={() => openSubModal('work-experiences')}>
                          Thêm mốc lịch sử / công tác
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="key"
                        pagination={false}
                        dataSource={hs01HistoryRows}
                        columns={[
                          {
                            title: 'Từ tháng, năm đến tháng, năm',
                            dataIndex: 'period',
                            width: 220,
                            render: (v) => <strong>{v}</strong>,
                          },
                          {
                            title: 'Đặc điểm lịch sử',
                            dataIndex: 'description',
                          },
                          {
                            title: 'Nguồn đồng bộ',
                            dataIndex: 'source',
                            width: 120,
                            render: (v) => <Tag color={v === 'Đào tạo' ? 'blue' : 'purple'}>{v}</Tag>,
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: 'hs01_part4_5_6_7',
                  label: 'Phần IV, V, VI & VII: Khen thưởng, Kỷ luật, Quan hệ Gia đình & Tự nhận xét',
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Typography.Title level={5} style={{ margin: 0, color: '#0f766e' }}>
                              IV. KHEN THƯỞNG
                            </Typography.Title>
                            <Button size="small" icon={<PlusOutlined />} onClick={() => openSubModal('rewards')}>
                              Thêm khen thưởng
                            </Button>
                          </div>
                          <Table
                            size="small"
                            bordered
                            rowKey="id"
                            pagination={false}
                            dataSource={profile.rewards}
                            columns={[
                              { title: 'Ngày, tháng, năm', dataIndex: 'reward_year', width: 130 },
                              { title: 'Nội dung và hình thức khen thưởng', dataIndex: 'reward_form' },
                              { title: 'Cấp quyết định', dataIndex: 'issuing_authority', render: (v) => v || '-' },
                            ]}
                          />
                        </Col>

                        <Col xs={24} md={12}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Typography.Title level={5} style={{ margin: 0, color: '#0f766e' }}>
                              V. KỶ LUẬT
                            </Typography.Title>
                            <Button size="small" danger icon={<PlusOutlined />} onClick={() => openSubModal('disciplines')}>
                              Thêm kỷ luật
                            </Button>
                          </div>
                          <Table
                            size="small"
                            bordered
                            rowKey="id"
                            pagination={false}
                            dataSource={profile.disciplines}
                            columns={[
                              {
                                title: 'Ngày, tháng, năm',
                                key: 'dt',
                                width: 130,
                                render: (_, r) =>
                                  r.from_month_year || (r.discipline_date ? dayjs(r.discipline_date).format('DD/MM/YYYY') : '-'),
                              },
                              {
                                title: 'Lý do và hình thức kỷ luật',
                                key: 'form_reason',
                                render: (_, r) => `${r.discipline_form}${r.reason ? ` (${r.reason})` : ''}`,
                              },
                              { title: 'Cấp quyết định', dataIndex: 'issuing_authority', render: (v) => v || '-' },
                            ]}
                          />
                        </Col>
                      </Row>

                      <Divider orientation="left">VI. QUAN HỆ GIA ĐÌNH (Bảng 2 cột chuẩn Mẫu HS01-VC/BNV)</Divider>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Typography.Text strong>
                          1) Về bản thân: Cha, Mẹ, Vợ (hoặc chồng), các con và anh chị em ruột
                        </Typography.Text>
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openSubModal('family-relations', undefined, { side_type: 'self' })}
                        >
                          Thêm thân nhân (Bản thân)
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="id"
                        pagination={false}
                        dataSource={profile.family_relations.filter((f) => f.side_type !== 'spouse')}
                        style={{ marginBottom: 18 }}
                        columns={[
                          { title: 'Mối quan hệ', dataIndex: 'relationship_type', width: 160, render: (v) => <strong>{v}</strong> },
                          {
                            title:
                              'Họ tên, năm sinh, quê quán, nghề nghiệp, đặc điểm lịch sử; hiện đang làm gì, nơi cư trú',
                            key: 'blob',
                            render: (_, r) => <div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{formatHs01FamilyCell(r)}</div>,
                          },
                          {
                            title: 'Thao tác',
                            key: 'act',
                            width: 85,
                            render: (_, r) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('family-relations', r)} />
                                <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('family-relations', r.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Typography.Text strong>2) Về bên Vợ hoặc Chồng: Cha, Mẹ và anh chị em ruột</Typography.Text>
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => openSubModal('family-relations', undefined, { side_type: 'spouse' })}
                        >
                          Thêm thân nhân (Bên Vợ/Chồng)
                        </Button>
                      </div>
                      <Table
                        size="small"
                        bordered
                        rowKey="id"
                        pagination={false}
                        dataSource={profile.family_relations.filter((f) => f.side_type === 'spouse')}
                        style={{ marginBottom: 20 }}
                        columns={[
                          { title: 'Mối quan hệ', dataIndex: 'relationship_type', width: 160, render: (v) => <strong>{v}</strong> },
                          {
                            title:
                              'Họ tên, năm sinh, quê quán, nghề nghiệp, đặc điểm lịch sử; hiện đang làm gì, nơi cư trú',
                            key: 'blob',
                            render: (_, r) => <div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{formatHs01FamilyCell(r)}</div>,
                          },
                          {
                            title: 'Thao tác',
                            key: 'act',
                            width: 85,
                            render: (_, r) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openSubModal('family-relations', r)} />
                                <Popconfirm title="Xoá?" onConfirm={() => handleDeleteSubRecord('family-relations', r.id)}>
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />

                      <Divider orientation="left">VII. TỰ NHẬN XÉT, ĐÁNH GIÁ</Divider>
                      <Form.Item
                        name="self_assessment_comment"
                        label="VII. Tự nhận xét, đánh giá (Về phẩm chất chính trị, đạo đức, lối sống, ý thức kỷ luật, năng lực và sở trường công tác...)"
                      >
                        <Input.TextArea
                          rows={4}
                          placeholder="Viên chức tự nhận xét về phẩm chất chính trị, đạo đức, lối sống, ý thức kỷ luật, năng lực và sở trường công tác..."
                        />
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Form>
      </Card>

      {/* ========================================================================================= */}
      {/* MODAL IMPORT DỮ LIỆU TỪ FILE WORD (.doc / .docx) CÓ BƯỚC XEM TRƯỚC & ĐỐI SOÁT              */}
      {/* ========================================================================================= */}
      <Modal
        title={
          <Space>
            <FileWordOutlined style={{ color: '#0284c7', fontSize: 20 }} />
            <span>Import Hồ sơ Lý lịch từ File Word (.doc / .docx)</span>
          </Space>
        }
        open={wordModalOpen}
        onCancel={() => {
          setWordModalOpen(false);
          setWordPreview(null);
        }}
        width={920}
        footer={
          wordPreview
            ? [
                <Button key="cancel" onClick={() => setWordModalOpen(false)}>
                  Đóng
                </Button>,
                <Upload
                  key="reupload"
                  showUploadList={false}
                  beforeUpload={handleSelectWordFile}
                  accept=".doc,.docx,.mht,.mhtml,.htm,.html"
                >
                  <Button icon={<UploadOutlined />} loading={parsingWord}>
                    Chọn tệp Word khác
                  </Button>
                </Upload>,
                <Button
                  key="apply"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={applyingWord}
                  onClick={handleConfirmApplyWord}
                  style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 700 }}
                >
                  Xác nhận Áp dụng vào Hồ sơ (Đồng bộ 2 Tab)
                </Button>,
              ]
            : [
                <Button key="close" onClick={() => setWordModalOpen(false)}>
                  Đóng
                </Button>,
              ]
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Hỗ trợ đầy đủ cả 2 mẫu File Word chuẩn của Bộ Nội vụ"
          description={
            <div style={{ fontSize: 13 }}>
              <div>• <strong>Mẫu 1:</strong> Sơ yếu lý lịch (Theo Thông tư 06/2023/TT-BNV — 38 mục)</div>
              <div>• <strong>Mẫu 2:</strong> Lý lịch viên chức (Mẫu HS01-VC/BNV theo Thông tư 07/2019/TT-BNV — 7 phần La Mã)</div>
              <div>• Hệ thống tự động giải mã cả định dạng <code>.doc</code> (Word MHTML Single File Web Page / HTML) và <code>.docx</code> (OpenXML), bóc tách thông tin nhân thân, lương, đào tạo, công tác và quan hệ gia đình.</div>
            </div>
          }
        />

        {!wordPreview ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Upload.Dragger
              name="file"
              multiple={false}
              showUploadList={false}
              beforeUpload={handleSelectWordFile}
              accept=".doc,.docx,.mht,.mhtml,.htm,.html"
              disabled={parsingWord}
              style={{ padding: 24 }}
            >
              <p className="ant-upload-drag-icon">
                <FileWordOutlined style={{ color: '#0284c7', fontSize: 48 }} />
              </p>
              <p className="ant-upload-text" style={{ fontWeight: 600 }}>
                {parsingWord
                  ? 'Đang giải mã & bóc tách cấu trúc biểu mẫu Word...'
                  : 'Nhấp hoặc kéo thả File Word (.doc / .docx) vào đây để phân tích dữ liệu'}
              </p>
              <p className="ant-upload-hint">
                Bạn có thể tải lên file Sơ yếu lý lịch (TT06/2023) hoặc file Lý lịch viên chức (Mẫu HS01-VC/BNV). Hệ thống sẽ hiển thị bản Xem trước & Đối soát trước khi lưu.
              </p>
            </Upload.Dragger>
          </div>
        ) : (
          <div>
            <Card
              size="small"
              style={{ marginBottom: 14, background: 'rgba(16, 185, 129, 0.06)', borderColor: '#10b981' }}
            >
              <Row gutter={16} align="middle">
                <Col flex="auto">
                  <Space wrap>
                    <Badge status="processing" />
                    <Typography.Text strong>Tệp đã phân tích:</Typography.Text>
                    <Tag color="blue">{wordPreview.file_name}</Tag>
                    <Tag color="green" style={{ fontWeight: 600 }}>
                      {wordPreview.template_label}
                    </Tag>
                  </Space>
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text strong style={{ marginRight: 12 }}>
                      Chế độ ghi dữ liệu bảng con (Đào tạo, Công tác, Gia đình, Lương):
                    </Typography.Text>
                    <Radio.Group value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                      <Radio value="merge">
                        <strong>Cập nhật bổ sung & Chống trùng lặp</strong> (Khuyên dùng khi import kết hợp cả 2 file Word)
                      </Radio>
                      <Radio value="overwrite_subtables">Ghi đè toàn bộ các bảng quá trình theo file này</Radio>
                    </Radio.Group>
                  </div>
                </Col>
                {wordPreview.extracted_portrait_data_url && (
                  <Col>
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={wordPreview.extracted_portrait_data_url}
                        alt="Ảnh từ Word"
                        style={{ width: 52, height: 68, objectFit: 'cover', borderRadius: 4, border: '1px solid #10b981' }}
                      />
                      <div style={{ fontSize: 11, color: '#059669' }}>Ảnh 4x6 trong Word</div>
                    </div>
                  </Col>
                )}
              </Row>
            </Card>

            {wordPreview.warnings?.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={wordPreview.warnings.join(' | ')}
              />
            )}

            <Tabs
              size="small"
              items={[
                {
                  key: 'preview_fields',
                  label: `1. Thông tin chung bóc tách được (${wordDiffRows.length} trường)`,
                  children: (
                    <Table
                      size="small"
                      bordered
                      rowKey="key"
                      pagination={{ pageSize: 8 }}
                      dataSource={wordDiffRows}
                      columns={[
                        { title: 'Mục / Trường thông tin', dataIndex: 'label', width: 260, render: (v) => <strong>{v}</strong> },
                        {
                          title: 'Giá trị hiện tại trong Hồ sơ',
                          dataIndex: 'oldValue',
                          render: (v) => <span style={{ color: '#64748b' }}>{v}</span>,
                        },
                        {
                          title: 'Giá trị mới từ File Word',
                          dataIndex: 'newValue',
                          render: (v, r) => (
                            <Tag color={r.isChanged ? 'green' : 'default'} style={{ fontSize: 13, whiteSpace: 'normal' }}>
                              {v}
                            </Tag>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'preview_trainings',
                  label: `2. Quá trình đào tạo (${wordPreview.extracted_trainings.length})`,
                  children: (
                    <Table
                      size="small"
                      bordered
                      rowKey={(_, idx) => String(idx)}
                      pagination={false}
                      dataSource={wordPreview.extracted_trainings}
                      columns={[
                        {
                          title: 'Nhóm mục (TT06)',
                          dataIndex: 'training_category',
                          render: (v) => TRAINING_CATEGORY_LABELS[v] || v || 'Chuyên môn',
                        },
                        { title: 'Tên trường / Cơ sở đào tạo', dataIndex: 'school_name' },
                        { title: 'Chuyên ngành', dataIndex: 'major' },
                        {
                          title: 'Thời gian',
                          key: 'p',
                          render: (_, r) => `${r.from_period || ''} - ${r.to_period || ''}`,
                        },
                        { title: 'Hình thức', dataIndex: 'training_mode' },
                        { title: 'Văn bằng / Chứng chỉ', dataIndex: 'degree_certificate' },
                      ]}
                    />
                  ),
                },
                {
                  key: 'preview_work',
                  label: `3. Quá trình công tác (${wordPreview.extracted_work_experiences.length})`,
                  children: (
                    <Table
                      size="small"
                      bordered
                      rowKey={(_, idx) => String(idx)}
                      pagination={false}
                      dataSource={wordPreview.extracted_work_experiences}
                      columns={[
                        { title: 'Từ tháng/năm', dataIndex: 'from_month_year', width: 120 },
                        { title: 'Đến tháng/năm', dataIndex: 'to_month_year', width: 120 },
                        { title: 'Đơn vị công tác / Đặc điểm lịch sử', dataIndex: 'organization_name' },
                        { title: 'Chức danh / Chức vụ', dataIndex: 'position_name' },
                      ]}
                    />
                  ),
                },
                {
                  key: 'preview_family',
                  label: `4. Quan hệ gia đình (${wordPreview.extracted_family_relations.length})`,
                  children: (
                    <Table
                      size="small"
                      bordered
                      rowKey={(_, idx) => String(idx)}
                      pagination={false}
                      dataSource={wordPreview.extracted_family_relations}
                      columns={[
                        {
                          title: 'Nhóm',
                          dataIndex: 'side_type',
                          width: 110,
                          render: (v) => (v === 'spouse' ? 'Bên Vợ/Chồng' : 'Bản thân'),
                        },
                        { title: 'Mối quan hệ', dataIndex: 'relationship_type', width: 110 },
                        { title: 'Họ và tên', dataIndex: 'full_name', width: 160, render: (v) => <strong>{v}</strong> },
                        { title: 'Năm sinh', dataIndex: 'birth_year', width: 85 },
                        { title: 'Quê quán', dataIndex: 'hometown' },
                        { title: 'Nghề nghiệp / Đơn vị', dataIndex: 'occupation' },
                        { title: 'Nơi ở', dataIndex: 'residence' },
                      ]}
                    />
                  ),
                },
                {
                  key: 'preview_salary',
                  label: `5. Quá trình lương (${wordPreview.extracted_salary_logs.length})`,
                  children: (
                    <Table
                      size="small"
                      bordered
                      rowKey={(_, idx) => String(idx)}
                      pagination={false}
                      dataSource={wordPreview.extracted_salary_logs}
                      columns={[
                        { title: 'Từ tháng/năm', dataIndex: 'from_month_year' },
                        { title: 'Đến tháng/năm', dataIndex: 'to_month_year' },
                        { title: 'Mã số ngạch', dataIndex: 'rank_code' },
                        { title: 'Bậc lương', dataIndex: 'salary_step' },
                        { title: 'Hệ số lương', dataIndex: 'coefficient' },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ========================================================================================= */}
      {/* MODAL THÊM / SỬA CÁC BẢNG QUÁ TRÌNH 1-N                                                   */}
      {/* ========================================================================================= */}
      <Modal
        title={`${editingSubRecord ? 'Cập nhật' : 'Thêm mới'}: ${SUB_TYPE_TITLES[activeSubType]}`}
        open={subModalOpen}
        onCancel={() => {
          setSubModalOpen(false);
          setEditingSubRecord(null);
        }}
        onOk={handleSubSubmit}
        confirmLoading={subSaving}
        okText="Lưu lại"
        cancelText="Huỷ"
        width={620}
        destroyOnClose
      >
        <Form form={subForm} layout="vertical" style={{ marginTop: 12 }}>
          {activeSubType === 'trainings' && (
            <>
              <Form.Item name="training_category" label="Phân nhóm mục Đào tạo, Bồi dưỡng (Theo Mục 32 TT 06/2023/TT-BNV)">
                <Select
                  options={Object.entries(TRAINING_CATEGORY_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="school_name"
                label="Tên trường / Cơ sở đào tạo"
                rules={[{ required: true, message: 'Nhập tên trường hoặc cơ sở đào tạo' }]}
              >
                <Input placeholder="VD: Trường Đại học FPT" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="major" label="Chuyên ngành đào tạo / Tên ngoại ngữ">
                    <Input placeholder="VD: Công nghệ thông tin / Tiếng Anh" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="training_mode" label="Hình thức đào tạo">
                    <Select
                      allowClear
                      options={[
                        { label: 'Chính quy', value: 'Chính quy' },
                        { label: 'Vừa làm vừa học / Tại chức', value: 'Vừa làm vừa học' },
                        { label: 'Đào tạo từ xa', value: 'Từ xa' },
                        { label: 'Bồi dưỡng', value: 'Bồi dưỡng' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="from_period" label="Từ tháng/năm">
                    <Input placeholder="09/2022" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="to_period" label="Đến tháng/năm">
                    <Input placeholder="10/2025" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="graduation_year" label="Năm tốt nghiệp">
                    <InputNumber min={1970} max={2050} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item name="degree_certificate" label="Văn bằng / Chứng chỉ được cấp">
                    <Input placeholder="VD: Bằng Cử nhân / Cử nhân / Chứng chỉ..." />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="score_result" label="Điểm số (Mục 32.6 Ngoại ngữ)">
                    <Input placeholder="VD: IELTS 6.5 / Bậc 3" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {activeSubType === 'work-experiences' && (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="from_month_year"
                    label="Từ tháng/năm"
                    rules={[{ required: true, message: 'Nhập thời gian bắt đầu' }]}
                  >
                    <Input placeholder="VD: 06/2026" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="to_month_year" label="Đến tháng/năm">
                    <Input placeholder="VD: nay" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="organization_name"
                label="Đơn vị công tác (Đảng, chính quyền, đoàn thể...)"
                rules={[{ required: true, message: 'Nhập tên đơn vị' }]}
              >
                <Input placeholder="VD: Sở Nông nghiệp và Môi trường / Ban Quản lý các Khu liên hợp xử lý chất thải" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="department_name" label="Phòng ban / Bộ phận">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="position_name" label="Chức danh / Chức vụ">
                    <Input placeholder="VD: Chuyên viên / Không" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {activeSubType === 'salary-logs' && (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="from_month_year" label="Từ tháng/năm (Mục 37.1 TT06)">
                    <Input placeholder="VD: 07/2026" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="to_month_year" label="Đến tháng/năm">
                    <Input placeholder="VD: 06/2029" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="rank_code" label="Mã số ngạch / CDNN">
                    <Input placeholder="01.003" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="salary_step" label="Bậc lương">
                    <InputNumber min={1} max={15} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="coefficient"
                    label="Hệ số lương"
                    rules={[{ required: true, message: 'Nhập hệ số lương' }]}
                  >
                    <InputNumber min={1} max={15} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="position_salary_amount" label="Tiền lương theo vị trí việc làm">
                    <Input placeholder="Nếu có" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="effective_date" label="Ngày hưởng">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {activeSubType === 'family-relations' && (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="side_type" label="Nhóm quan hệ" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { label: '36.1 / Mục 1: Về bản thân (Cha, Mẹ, Vợ/Chồng, Con, Anh/Chị/Em)', value: 'self' },
                        { label: '36.2 / Mục 2: Về bên Vợ hoặc Chồng', value: 'spouse' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="relationship_type" label="Mối quan hệ" rules={[{ required: true }]}>
                    <Select
                      showSearch
                      options={[
                        { label: 'Cha đẻ', value: 'Cha đẻ' },
                        { label: 'Mẹ đẻ', value: 'Mẹ đẻ' },
                        { label: 'Vợ / Chồng', value: 'Vợ / Chồng' },
                        { label: 'Con', value: 'Con' },
                        { label: 'Anh trai', value: 'Anh trai' },
                        { label: 'Chị gái', value: 'Chị gái' },
                        { label: 'Em trai', value: 'Em trai' },
                        { label: 'Em gái', value: 'Em gái' },
                        { label: 'Bố vợ / Bố chồng', value: 'Bố vợ / Bố chồng' },
                        { label: 'Mẹ vợ / Mẹ chồng', value: 'Mẹ vợ / Mẹ chồng' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ và tên' }]}>
                    <Input placeholder="VD: Đoàn Thanh Điệp" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="birth_year" label="Năm sinh">
                    <InputNumber min={1900} max={2030} style={{ width: '100%' }} placeholder="1973" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="hometown" label="Quê quán">
                <Input placeholder="VD: Xã Bình Khánh, Thành phố Hồ Chí Minh" />
              </Form.Item>
              <Form.Item name="occupation" label="Nghề nghiệp, chức danh, chức vụ, đơn vị công tác / học tập">
                <Input placeholder="VD: Phó Giám đốc, Trung tâm Cung ứng dịch vụ công xã Bình Khánh" />
              </Form.Item>
              <Form.Item name="residence" label="Nơi ở hiện nay">
                <Input placeholder="VD: 255 Ấp Bình Trường, xã Bình Khánh, TP.HCM" />
              </Form.Item>
            </>
          )}

          {activeSubType === 'rewards' && (
            <>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="reward_year" label="Năm" rules={[{ required: true }]}>
                    <InputNumber min={1980} max={2050} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="professional_rating" label="Xếp loại chuyên môn (35.1)">
                    <Input placeholder="HTXSNV / HTTNV..." />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="emulation_rating" label="Xếp loại thi đua (35.1)">
                    <Input placeholder="Chiến sĩ thi đua..." />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="reward_form" label="Hình thức khen thưởng" rules={[{ required: true }]}>
                <Input placeholder="VD: Bằng khen / Giấy khen..." />
              </Form.Item>
              <Form.Item name="issuing_authority" label="Cấp quyết định">
                <Input />
              </Form.Item>
            </>
          )}

          {activeSubType === 'disciplines' && (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="from_month_year" label="Từ tháng/năm">
                    <Input placeholder="VD: 03/2025" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="to_month_year" label="Đến tháng/năm">
                    <Input placeholder="VD: 03/2026" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="discipline_form" label="Hình thức kỷ luật" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Khiển trách', value: 'Khiển trách' },
                    { label: 'Cảnh cáo', value: 'Cảnh cáo' },
                    { label: 'Cách chức', value: 'Cách chức' },
                    { label: 'Buộc thôi việc', value: 'Buộc thôi việc' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="reason" label="Hành vi vi phạm chính / Lý do kỷ luật">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="issuing_authority" label="Cơ quan quyết định">
                <Input />
              </Form.Item>
            </>
          )}

          {activeSubType === 'asset-declarations' && (
            <>
              <Form.Item name="declaration_year" label="Năm kê khai" rules={[{ required: true }]}>
                <InputNumber min={2010} max={2050} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Tải lên Bản kê khai đính kèm">
                <Upload showUploadList={false} beforeUpload={handleUploadAssetFile} accept=".pdf,.doc,.docx,.jpg,.png">
                  <Button icon={<FilePdfOutlined />} loading={uploadingAssetPdf}>
                    Chọn tệp đính kèm
                  </Button>
                </Upload>
              </Form.Item>
              <Form.Item name="file_name" label="Tên tệp">
                <Input readOnly />
              </Form.Item>
              <Form.Item name="file_url" hidden>
                <Input />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
