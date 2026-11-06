import base64
import email
import html
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple


EMPTY_TOKENS = {
    "",
    "không",
    "không có",
    "khong",
    "khong co",
    "chưa có",
    "chưa có thông tin",
    "không theo tôn giáo nào",
    "-",
    "...",
}


def _clean_space(text: str) -> str:
    if not text:
        return ""
    cleaned = html.unescape(text).replace("\u00a0", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Remove dotted placeholders like ........
    if re.fullmatch(r"[\.\…\s_-]+", cleaned):
        return ""
    return cleaned


def _is_empty_token(val: Optional[str]) -> bool:
    if val is None:
        return True
    s = _clean_space(val).lower().strip(".;:,")
    return s in EMPTY_TOKENS


def _parse_vn_date(raw: Optional[str]) -> Optional[str]:
    """Chuyển chuỗi ngày tiếng Việt ('18 tháng 11 năm 2003', '18 / 11 / 2003', '21/12/2021') sang 'YYYY-MM-DD'"""
    if not raw:
        return None
    s = _clean_space(raw)
    if _is_empty_token(s):
        return None

    # Pattern 1: ngày DD tháng MM năm YYYY
    m1 = re.search(r"(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})", s, flags=re.I)
    if m1:
        d, m, y = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            pass

    # Pattern 2: DD / MM / YYYY or DD-MM-YYYY
    m2 = re.search(r"(\d{1,2})\s*[/\-\.]\s*(\d{1,2})\s*[/\-\.]\s*(\d{4})", s)
    if m2:
        d, m, y = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            pass

    # Pattern 3: YYYY-MM-DD
    m3 = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m3:
        y, m, d = int(m3.group(1)), int(m3.group(2)), int(m3.group(3))
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            pass

    return None


def _parse_int(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    m = re.search(r"(\d+)", str(raw))
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _parse_float(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    s = str(raw).replace(",", ".")
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _split_place_ward_province(place_str: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Tách chuỗi địa danh kiểu 'Xã Bình Khánh, TP. Hồ Chí Minh' hoặc 'Xã Bình Khánh - Huyện Cần Giờ - TP.HCM'"""
    if not place_str or _is_empty_token(place_str):
        return None, None, None
    s = _clean_space(place_str)
    parts = [p.strip() for p in re.split(r"[,;-]+", s) if p.strip()]
    if len(parts) >= 3:
        return parts[0], parts[1], parts[-1]
    if len(parts) == 2:
        return parts[0], None, parts[1]
    if len(parts) == 1:
        return None, None, parts[0]
    return None, None, None


def _extract_html_from_mhtml_or_doc(file_bytes: bytes) -> Tuple[str, Optional[str]]:
    """Giải mã nội dung HTML và ảnh chân dung (nếu có) từ file .doc (MHTML / HTML)"""
    portrait_data_url: Optional[str] = None

    # Check if MIME / MHTML
    head_str = file_bytes[:2048].decode("latin1", errors="ignore")
    if "MIME-Version:" in head_str or "multipart/related" in head_str:
        msg = email.message_from_bytes(file_bytes)
        html_text = ""
        for part in msg.walk():
            ctype = (part.get_content_type() or "").lower()
            if ctype == "text/html" and not html_text:
                payload = part.get_payload(decode=True)
                if payload:
                    if payload.startswith(b"\xff\xfe") or b"\x00<\x00" in payload[:200]:
                        html_text = payload.decode("utf-16le", errors="ignore")
                    elif payload.startswith(b"\xfe\xff"):
                        html_text = payload.decode("utf-16be", errors="ignore")
                    else:
                        html_text = payload.decode("utf-8", errors="ignore")
            elif ctype in ("image/png", "image/jpeg", "image/jpg") and not portrait_data_url:
                img_bytes = part.get_payload(decode=True)
                if img_bytes and len(img_bytes) > 1500:
                    b64_img = base64.b64encode(img_bytes).decode("ascii")
                    portrait_data_url = f"data:{ctype};base64,{b64_img}"
        if html_text:
            return html_text, portrait_data_url

    # Fallback: Regex search for base64 text/html block in raw MHTML text
    raw_latin = file_bytes.decode("latin1", errors="ignore")
    m = re.search(
        r"Content-Transfer-Encoding:\s*base64\r?\nContent-Type:\s*text/html[^\r\n]*\r?\n\r?\n([\s\S]*?)\r?\n------=",
        raw_latin,
        flags=re.I,
    )
    if m:
        b64_clean = re.sub(r"\s+", "", m.group(1))
        decoded = base64.b64decode(b64_clean)
        if decoded.startswith(b"\xff\xfe") or b"\x00" in decoded[:100]:
            return decoded.decode("utf-16le", errors="ignore"), portrait_data_url
        return decoded.decode("utf-8", errors="ignore"), portrait_data_url

    # Fallback: Direct UTF-16 or UTF-8 HTML
    if file_bytes.startswith(b"\xff\xfe"):
        return file_bytes.decode("utf-16le", errors="ignore"), None
    return file_bytes.decode("utf-8", errors="ignore"), None


def _extract_lines_and_tables_from_html(html_text: str) -> Tuple[List[str], List[List[List[str]]]]:
    """Tách danh sách dòng văn bản và danh sách các bảng (table -> row -> cell) từ HTML"""
    no_style = re.sub(r"<style[\s\S]*?</style>", "", html_text, flags=re.I)
    no_style = re.sub(r"<xml[\s\S]*?</xml>", "", no_style, flags=re.I)
    # Collapse soft line wraps (\r\n) inside HTML tags/paragraphs first so a single <p> is not split mid-sentence
    no_soft_wraps = re.sub(r"[\r\n]+", " ", no_style)

    tables: List[List[List[str]]] = []
    for tbl_match in re.finditer(r"<table[\s\S]*?</table>", no_soft_wraps, flags=re.I):
        tbl_html = tbl_match.group(0)
        rows: List[List[str]] = []
        for tr_match in re.finditer(r"<tr[\s\S]*?</tr>", tbl_html, flags=re.I):
            tr_html = tr_match.group(0)
            cells: List[str] = []
            for td_match in re.finditer(r"<t[dh][\s\S]*?</t[dh]>", tr_html, flags=re.I):
                td_html = td_match.group(0)
                # Preserve paragraph breaks inside a table cell (important for Family Relation cell!)
                cell_with_newlines = re.sub(r"</p>|<br\s*/?>", "\n", td_html, flags=re.I)
                cell_plain = re.sub(r"<[^>]+>", " ", cell_with_newlines)
                cell_lines = [_clean_space(line) for line in cell_plain.splitlines()]
                cell_lines = [line for line in cell_lines if line]
                cells.append("\n".join(cell_lines))
            if cells:
                rows.append(cells)
        if rows:
            tables.append(rows)

    # Extract all paragraph / block lines (each <p> or <tr> or <br> becomes one complete line)
    block_text = re.sub(r"</p>|</tr>|</div>|<br\s*/?>", "\n", no_soft_wraps, flags=re.I)
    block_text = re.sub(r"<[^>]+>", " ", block_text)
    lines = [_clean_space(l) for l in block_text.splitlines()]
    lines = [l for l in lines if l]
    return lines, tables


def _extract_lines_and_tables_from_docx(file_bytes: bytes) -> Tuple[List[str], List[List[List[str]]], Optional[str]]:
    """Giải mã file .docx chuẩn Office Open XML"""
    lines: List[str] = []
    tables: List[List[List[str]]] = []
    portrait_data_url: Optional[str] = None

    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        # Check media for portrait image
        for name in zf.namelist():
            low = name.lower()
            if low.startswith("word/media/") and low.endswith((".png", ".jpg", ".jpeg")):
                img_bytes = zf.read(name)
                if len(img_bytes) > 1500:
                    mime = "image/png" if low.endswith(".png") else "image/jpeg"
                    portrait_data_url = f"data:{mime};base64,{base64.b64encode(img_bytes).decode('ascii')}"
                    break

        if "word/document.xml" not in zf.namelist():
            return lines, tables, portrait_data_url

        xml_bytes = zf.read("word/document.xml")
        root = ET.fromstring(xml_bytes)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

        # Extract paragraphs
        for p in root.findall(".//w:p", ns):
            texts = [t.text for t in p.findall(".//w:t", ns) if t.text]
            line = _clean_space("".join(texts))
            if line:
                lines.append(line)

        # Extract tables
        for tbl in root.findall(".//w:tbl", ns):
            rows: List[List[str]] = []
            for tr in tbl.findall("./w:tr", ns):
                cells: List[str] = []
                for tc in tr.findall("./w:tc", ns):
                    p_lines: List[str] = []
                    for p in tc.findall(".//w:p", ns):
                        t_vals = [t.text for t in p.findall(".//w:t", ns) if t.text]
                        p_str = _clean_space("".join(t_vals))
                        if p_str:
                            p_lines.append(p_str)
                    cells.append("\n".join(p_lines))
                if cells:
                    rows.append(cells)
            if rows:
                tables.append(rows)

    return lines, tables, portrait_data_url


def _parse_family_detail_blob(blob: str, fallback_name: Optional[str] = None, fallback_year: Optional[int] = None) -> Dict[str, Any]:
    """Bóc tách khối thông tin người thân (Quê quán, Nghề nghiệp, Nơi ở, hoặc cả Họ tên/Sinh năm trong HS01)"""
    full_name = _clean_space(fallback_name or "")
    birth_year = fallback_year
    hometown = None
    occupation = None
    residence = None

    # Normalize lines in blob
    raw_lines = [l.strip() for l in blob.splitlines() if l.strip()]
    joined = " | ".join(raw_lines)

    # Extract Họ tên if not provided (HS01 format: 'Họ tên: Đoàn Thanh Điệp Sinh năm 1973')
    if not full_name:
        m_name = re.search(r"Họ\s*(?:và\s*)?tên\s*:\s*([^|\n]+?)(?=\s+Sinh\s+năm|\s*$|\|)", joined, flags=re.I)
        if m_name:
            full_name = _clean_space(m_name.group(1))

    if not birth_year:
        m_year = re.search(r"Sinh\s+năm\s*:?\s*(\d{4})", joined, flags=re.I)
        if m_year:
            birth_year = int(m_year.group(1))

    m_home = re.search(r"Quê\s+quán\s*:\s*([^|\n]+?)(?=\s+Nghề\s+nghiệp|\s+Nơi\s+ở|\s*$|\|)", joined, flags=re.I)
    if m_home:
        hometown = _clean_space(m_home.group(1))

    m_occ = re.search(r"Nghề\s+nghiệp\s*:\s*([^|\n]+?)(?=\s+Nơi\s+ở|\s*$|\|)", joined, flags=re.I)
    if m_occ:
        occupation = _clean_space(m_occ.group(1))

    m_res = re.search(r"Nơi\s+ở\s*:\s*([^|\n]+)", joined, flags=re.I)
    if m_res:
        residence = _clean_space(m_res.group(1))

    return {
        "full_name": full_name,
        "birth_year": birth_year,
        "hometown": hometown,
        "occupation": occupation,
        "workplace_or_address": occupation,
        "residence": residence,
    }


def _find_after_label(full_text: str, pattern: str) -> Optional[str]:
    m = re.search(pattern, full_text, flags=re.I)
    if not m:
        return None
    val = _clean_space(m.group(1))
    if not val:
        return None
    return val


def _parse_tt06_template(lines: List[str], tables: List[List[List[str]]]) -> Dict[str, Any]:
    """Bóc tách Biểu mẫu 1: SƠ YẾU LÝ LỊCH (Theo Thông tư 06/2023/TT-BNV - 38 mục)"""
    joined = "\n".join(lines)
    fields: Dict[str, Any] = {}

    # Header
    managing = _find_after_label(joined, r"Cơ quan quản lý cán bộ,\s*công chức,\s*viên chức\s*:\s*([^\n]+)")
    if managing:
        fields["managing_agency_name"] = managing

    using = _find_after_label(joined, r"Cơ quan,\s*đơn vị sử dụng cán bộ,\s*công chức,\s*viên chức\s*:\s*([^\n]+)")
    if using:
        fields["using_agency_name"] = using
        fields["work_unit_name"] = using

    so_hieu = _find_after_label(joined, r"Số hiệu\s*:\s*([^\n]+)")
    if so_hieu:
        fields["official_file_code"] = so_hieu

    # 1) Họ và tên khai sinh & Giới tính
    m1 = re.search(r"1\)\s*Họ và tên khai sinh[^:]*:\s*(.+?)\s+Giới\s*tính\s*:\s*([^\n]+)", joined, flags=re.I)
    if m1:
        fields["birth_full_name"] = _clean_space(m1.group(1)).upper()
        fields["gender"] = _clean_space(m1.group(2))
    else:
        name_only = _find_after_label(joined, r"1\)\s*Họ và tên khai sinh[^:]*:\s*([^\n]+)")
        if name_only:
            fields["birth_full_name"] = name_only.upper()

    # 2) Các tên gọi khác
    alias = _find_after_label(joined, r"2\)\s*Các tên gọi khác\s*:\s*([^\n]*?)(?=\s*3\)\s*Sinh ngày|\n|$)")
    if alias and not _is_empty_token(alias):
        fields["alias_name"] = alias

    # 3) Sinh ngày
    dob_raw = _find_after_label(joined, r"3\)\s*Sinh ngày\s*:\s*([^\n]+)")
    dob = _parse_vn_date(dob_raw)
    if dob:
        fields["date_of_birth"] = dob

    # 4) Nơi sinh
    bp_raw = _find_after_label(joined, r"4\)\s*Nơi sinh\s*:\s*([^\n]+)")
    if bp_raw:
        w, d, p = _split_place_ward_province(bp_raw)
        if w:
            fields["birthplace_ward"] = w
        if d:
            fields["birthplace_district"] = d
        if p:
            fields["birthplace_province"] = p

    # 5) Quê quán
    ht_raw = _find_after_label(joined, r"5\)\s*Quê quán\s*:\s*([^\n]+)")
    if ht_raw:
        w, d, p = _split_place_ward_province(ht_raw)
        if w:
            fields["hometown_ward"] = w
        if d:
            fields["hometown_district"] = d
        if p:
            fields["hometown_province"] = p

    # 6) Dân tộc & 7) Tôn giáo
    eth = _find_after_label(joined, r"6\)\s*Dân tộc\s*:\s*([^\n]+)")
    if eth:
        fields["ethnicity"] = eth
    rel = _find_after_label(joined, r"7\)\s*Tôn giáo\s*:\s*([^\n]+)")
    if rel:
        fields["religion"] = "Không" if _is_empty_token(rel) else rel

    # 8) Số CCCD, Ngày cấp, SĐT liên hệ
    cccd = _find_after_label(joined, r"8\)\s*Số CCCD\s*:\s*([0-9A-Za-z]+)")
    if cccd:
        fields["cccd_number"] = cccd
    cccd_date = _parse_vn_date(_find_after_label(joined, r"8\)\s*Số CCCD[^\n]*?Ngày cấp\s*:\s*([0-9/\-\.]+)"))
    if not cccd_date:
        cccd_date = _parse_vn_date(_find_after_label(joined, r"Ngày cấp\s*:\s*([0-9/\-\.]+)"))
    if cccd_date:
        fields["cccd_issue_date"] = cccd_date
    phone = _find_after_label(joined, r"SĐT liên hệ\s*:\s*([0-9\+\-\s]+)")
    if phone:
        fields["personal_phone"] = phone

    # 9) Sổ BHXH & Số thẻ BHYT
    bhxh = _find_after_label(joined, r"9\)\s*Sổ BHXH\s*:\s*([0-9A-Za-z]+)")
    if bhxh:
        fields["social_insurance_code"] = bhxh
    bhyt = _find_after_label(joined, r"Số thẻ BHYT\s*:\s*([0-9A-Za-z]+)")
    if bhyt:
        fields["health_insurance_card_no"] = bhyt

    # 10) Nơi ở hiện nay
    curr_addr = _find_after_label(joined, r"10\)\s*Nơi ở hiện nay\s*:\s*([^\n]+)")
    if curr_addr:
        fields["current_address"] = curr_addr
        if "permanent_address" not in fields:
            fields["permanent_address"] = curr_addr

    # 11) Thành phần gia đình xuất thân
    fam_bg = _find_after_label(joined, r"11\)\s*Thành phần gia đình xuất thân\s*:\s*([^\n]+)")
    if fam_bg:
        fields["family_background"] = fam_bg

    # 12) Nghề nghiệp trước khi được tuyển dụng
    occ_before = _find_after_label(joined, r"12\)\s*Nghề nghiệp trước khi được tuyển dụng\s*:\s*([^\n]+)")
    if occ_before:
        fields["occupation_before_recruitment"] = occ_before

    # 13) Ngày được tuyển dụng lần đầu & Cơ quan tuyển dụng
    m13 = re.search(
        r"13\)\s*Ngày được tuyển dụng lần đầu\s*:\s*([^;\n]+)(?:;\s*Cơ quan,\s*tổ chức,\s*đơn vị tuyển dụng\s*:\s*([^\n]+))?",
        joined,
        flags=re.I,
    )
    if m13:
        rec_date = _parse_vn_date(m13.group(1))
        if rec_date:
            fields["first_recruitment_date"] = rec_date
        if m13.group(2):
            fields["recruitment_agency"] = _clean_space(m13.group(2))

    # 14) Ngày vào cơ quan hiện công tác
    join_date = _parse_vn_date(_find_after_label(joined, r"14\)\s*Ngày vào cơ quan hiện công tác\s*:\s*([^\n]+)"))
    if join_date:
        fields["current_agency_join_date"] = join_date

    # 15) Ngày vào Đảng CSVN & Ngày chính thức
    cpv_prob = _parse_vn_date(_find_after_label(joined, r"15\)\s*Ngày vào Đảng Cộng sản Việt Nam\s*:\s*([^\n]+)"))
    if cpv_prob:
        fields["cpv_probationary_date"] = cpv_prob
    cpv_off = _parse_vn_date(_find_after_label(joined, r"Ngày chính thức\s*:\s*([^\n]+)"))
    if cpv_off:
        fields["cpv_official_date"] = cpv_off

    # 16) Ngày tham gia tổ chức chính trị-xã hội đầu tiên
    org_first = _find_after_label(joined, r"16\)\s*Ngày tham gia tổ chức chính trị-xã hội đầu tiên[^:]*:\s*([^\n]+)")
    if org_first and not _is_empty_token(org_first):
        fields["first_socio_political_org_date"] = org_first

    # 17) Ngày nhập ngũ, Ngày xuất ngũ, Quân hàm cao nhất
    enlist = _parse_vn_date(_find_after_label(joined, r"17\)\s*Ngày nhập ngũ\s*:\s*([^\n]+)"))
    if enlist:
        fields["enlistment_date"] = enlist
    discharge = _parse_vn_date(_find_after_label(joined, r"Ngày xuất ngũ\s*:\s*([^\n]+)"))
    if discharge:
        fields["discharge_date"] = discharge
    mil_rank = _find_after_label(joined, r"Quân hàm cao nhất\s*:\s*([^\n]+)")
    if mil_rank and not _is_empty_token(mil_rank):
        fields["highest_military_rank"] = mil_rank

    # 18) Đối tượng chính sách
    policy = _find_after_label(joined, r"18\)\s*Đối tượng chính sách\s*:\s*([^\n]+)")
    if policy:
        fields["policy_family_type"] = policy

    # 19) Trình độ giáo dục phổ thông
    gen_edu = _find_after_label(joined, r"19\)\s*Trình độ giáo dục phổ thông[^:]*:\s*([^\n]+)")
    if gen_edu:
        fields["general_education_level"] = gen_edu

    # 20) Trình độ chuyên môn cao nhất
    high_deg = _find_after_label(joined, r"20\)\s*Trình độ chuyên môn cao nhất\s*:\s*([^\n]+)")
    if high_deg:
        fields["highest_professional_degree"] = high_deg

    # 21) Học hàm & 22) Danh hiệu nhà nước phong tặng
    acad = _find_after_label(joined, r"21\)\s*Học hàm\s*:\s*([^\n]+)")
    if acad:
        fields["academic_title"] = acad
    honor = _find_after_label(joined, r"22\)\s*Danh hiệu nhà nước phong tặng\s*:\s*([^\n]+)")
    if honor:
        fields["state_honorary_title"] = honor

    # 23) Chức vụ hiện tại, Ngày bổ nhiệm, Ngày bổ nhiệm lại
    curr_pos = _find_after_label(joined, r"23\)\s*Chức vụ hiện tại\s*:\s*([^\n]+)")
    if curr_pos:
        fields["leadership_position"] = curr_pos
    app_date = _parse_vn_date(_find_after_label(joined, r"Ngày bổ nhiệm/phê chuẩn\s*:\s*([^\n]+)"))
    if app_date:
        fields["appointment_date"] = app_date
    reapp_date = _parse_vn_date(_find_after_label(joined, r"Ngày bổ nhiệm lại/phê chuẩn nhiệm kỳ tiếp theo\s*:\s*([^\n]+)"))
    if reapp_date:
        fields["reappointment_date"] = reapp_date

    # 24) Được quy hoạch chức danh, 25) Chức vụ kiêm nhiệm, 26) Chức vụ Đảng hiện tại, 27) Chức vụ Đảng kiêm nhiệm
    planned = _find_after_label(joined, r"24\)\s*Được quy hoạch chức danh\s*:\s*([^\n]+)")
    if planned:
        fields["planned_position_title"] = planned
    conc_pos = _find_after_label(joined, r"25\)\s*Chức vụ kiêm nhiệm\s*:\s*([^\n]+)")
    if conc_pos:
        fields["concurrent_position"] = conc_pos
    cpv_pos = _find_after_label(joined, r"26\)\s*Chức vụ Đảng hiện tại\s*:\s*([^\n]+)")
    if cpv_pos:
        fields["cpv_current_position"] = cpv_pos
    cpv_conc = _find_after_label(joined, r"27\)\s*Chức vụ Đảng kiêm nhiệm\s*:\s*([^\n]+)")
    if cpv_conc:
        fields["cpv_concurrent_position"] = cpv_conc

    # 28) Công việc chính được giao
    main_job = _find_after_label(joined, r"28\)\s*Công việc chính được giao\s*:\s*([^\n]+)")
    if main_job:
        fields["main_assigned_duty"] = main_job

    # 29) Sở trường công tác & Công việc làm lâu nhất
    forte = _find_after_label(joined, r"29\)\s*Sở trường công tác\s*:\s*([^\n]+)")
    if forte:
        fields["work_forte"] = forte
    longest = _find_after_label(joined, r"Công việc làm lâu nhất\s*:\s*([^\n]+)")
    if longest:
        fields["longest_held_job"] = longest

    # 30.1) Ngạch/chức danh nghề nghiệp
    m30_1 = re.search(r"30\.1\)\s*Ngạch/chức danh nghề nghiệp\s*:\s*([^;\n]+);\s*Mã số\s*:\s*([^\n]+)", joined, flags=re.I)
    if m30_1:
        fields["professional_title_name"] = _clean_space(m30_1.group(1))
        fields["professional_title_code"] = _clean_space(m30_1.group(2))

    m_sal = re.search(r"Bậc lương\s*:\s*(\d+)\s+Hệ số\s*:\s*([0-9\.,]+)\s+Ngày hưởng\s*:\s*([0-9/\-\.]+)", joined, flags=re.I)
    if m_sal:
        fields["salary_step"] = int(m_sal.group(1))
        fields["salary_coefficient"] = _parse_float(m_sal.group(2))
        eff = _parse_vn_date(m_sal.group(3))
        if eff:
            fields["salary_effective_date"] = eff

    m_pct = re.search(r"Phần trăm hưởng\s*:\s*(\d+(?:\.\d+)?)\s*%", joined, flags=re.I)
    if m_pct:
        fields["salary_enjoy_percent"] = float(m_pct.group(1))

    # 30.3) Vị trí việc làm
    vtvl = _find_after_label(joined, r"30\.3\)\s*Vị trí việc làm\s*:\s*([^\n]+)")
    if vtvl:
        fields["approved_job_position_name"] = vtvl

    # 31) Tình trạng sức khoẻ, Chiều cao, Cân nặng, Nhóm máu
    health = _find_after_label(joined, r"31\)\s*Tình trạng sức khoẻ\s*:\s*([^\n]+)")
    if health:
        fields["health_classification"] = health
    m_hw = re.search(r"Chiều cao\s*:\s*([0-9\.,]+)\s*cm,\s*Cân nặng\s*:\s*([0-9\.,]+)\s*kg,\s*Nhóm máu\s*:\s*([^\n]+)", joined, flags=re.I)
    if m_hw:
        h_val = _parse_float(m_hw.group(1))
        w_val = _parse_float(m_hw.group(2))
        if h_val is not None:
            fields["height_cm"] = int(round(h_val))
        if w_val is not None:
            fields["weight_kg"] = w_val
        fields["blood_type"] = _clean_space(m_hw.group(3))

    # 34.1) Đặc điểm lịch sử bản thân
    hist_self = _find_after_label(joined, r"34\.1-[^:]*:\s*([^\n]+)")
    if hist_self:
        fields["political_history_self"] = hist_self

    # 37.3) Nguồn thu nhập chính của gia đình hàng năm
    inc_sal = _find_after_label(joined, r"-\s*Tiền lương\s*:\s*([^\n]+)")
    if inc_sal:
        fields["family_income_salary"] = inc_sal
    inc_other = _find_after_label(joined, r"-\s*Các nguồn khác\s*:\s*([^\n]+)")
    if inc_other:
        fields["family_income_other"] = inc_other
    h_alloc = _find_after_label(joined, r"\+\s*Được cấp,\s*được thuê[^:]*:\s*([^\n]+)")
    if h_alloc:
        fields["housing_allocated_info"] = h_alloc
    h_own = _find_after_label(joined, r"\+\s*Nhà tự mua,\s*tự xây[^:]*:\s*([^\n]+)")
    if h_own:
        fields["housing_owned_info"] = h_own
    l_alloc = _find_after_label(joined, r"\+\s*Đất được cấp\s*:\s*([^\n]+)")
    if l_alloc:
        fields["land_allocated_info"] = l_alloc
    l_buy = _find_after_label(joined, r"\+\s*Đất tự mua\s*:\s*([^\n]+)")
    if l_buy:
        fields["land_purchased_info"] = l_buy
    l_prod = _find_after_label(joined, r"-\s*Đất sản xuất kinh doanh\s*:\s*([^\n]+)")
    if l_prod:
        fields["production_land_info"] = l_prod

    # Sub-tables parsing from `tables`
    trainings: List[Dict[str, Any]] = []
    work_experiences: List[Dict[str, Any]] = []
    family_relations: List[Dict[str, Any]] = []
    salary_logs: List[Dict[str, Any]] = []
    rewards: List[Dict[str, Any]] = []
    disciplines: List[Dict[str, Any]] = []

    family_table_count = 0
    cert_training_table_idx = 0  # Tracks 32.3, 32.4, 32.5 which have identical headers

    for tbl in tables:
        if not tbl:
            continue
        header_row_0 = " | ".join(tbl[0]).lower()

        # 32.1: Chuyên môn
        if "tên cơ sở đào tạo" in header_row_0 and "chuyên ngành đào tạo" in header_row_0:
            for r in tbl[2:]:
                if len(r) >= 6 and any(_clean_space(c) for c in r):
                    from_p, to_p, school, major, mode, degree = [_clean_space(x) for x in r[:6]]
                    if school:
                        grad_year = _parse_int(to_p.split("/")[-1]) if "/" in to_p else _parse_int(to_p)
                        trainings.append({
                            "training_category": "CHUYEN_MON",
                            "from_period": from_p,
                            "to_period": to_p,
                            "school_name": school,
                            "major": major,
                            "training_mode": mode,
                            "degree_certificate": degree,
                            "graduation_year": grad_year,
                        })
                        if major and not fields.get("highest_professional_degree", "").endswith(major):
                            deg_base = fields.get("highest_professional_degree") or degree or "Đại học"
                            if major.lower() not in deg_base.lower():
                                fields["highest_professional_degree"] = f"{deg_base} {major}".strip()

        # 32.2: Lý luận chính trị
        elif "tên cơ sở đào tạo" in header_row_0 and "văn bằng được cấp" in header_row_0:
            for r in tbl[2:]:
                if len(r) >= 5 and any(_clean_space(c) for c in r):
                    from_p, to_p, school, mode, degree = [_clean_space(x) for x in r[:5]]
                    if school or degree:
                        trainings.append({
                            "training_category": "LY_LUAN_CHINH_TRI",
                            "from_period": from_p,
                            "to_period": to_p,
                            "school_name": school or "Cơ sở đào tạo LLCT",
                            "major": "Lý luận chính trị",
                            "training_mode": mode,
                            "degree_certificate": degree,
                        })

        # 32.6: Ngoại ngữ / tiếng dân tộc
        elif "tên ngoại ngữ" in header_row_0:
            for r in tbl[2:]:
                if len(r) >= 6 and any(_clean_space(c) for c in r):
                    from_p, to_p, school, lang_name, cert, score = [_clean_space(x) for x in r[:6]]
                    if school or lang_name or cert:
                        trainings.append({
                            "training_category": "NGOAI_NGU",
                            "from_period": from_p,
                            "to_period": to_p,
                            "school_name": school or "Cơ sở đào tạo Ngoại ngữ",
                            "major": lang_name,
                            "degree_certificate": cert,
                            "score_result": score,
                        })

        # 32.3, 32.4, 32.5: Bồi dưỡng QLNN / ANQP / Tin học
        elif "tên cơ sở đào tạo" in header_row_0 and "chứng chỉ được cấp" in header_row_0:
            cert_training_table_idx += 1
            cat_map = {1: "BOI_DUONG_QLNN", 2: "AN_NINH_QUOC_PHONG", 3: "TIN_HOC"}
            cat = cat_map.get(cert_training_table_idx, "BOI_DUONG_QLNN")
            for r in tbl[2:]:
                if len(r) >= 4 and any(_clean_space(c) for c in r):
                    from_p, to_p, school, cert = [_clean_space(x) for x in r[:4]]
                    if school or cert:
                        trainings.append({
                            "training_category": cat,
                            "from_period": from_p,
                            "to_period": to_p,
                            "school_name": school or "Cơ sở bồi dưỡng",
                            "degree_certificate": cert,
                        })

        # 33) Tóm tắt quá trình công tác
        elif "đơn vị công tác" in header_row_0 and "chức danh/ chức vụ" in header_row_0:
            for r in tbl[2:]:
                if len(r) >= 4 and any(_clean_space(c) for c in r):
                    from_my, to_my, org_name, pos_name = [_clean_space(x) for x in r[:4]]
                    if org_name:
                        work_experiences.append({
                            "from_month_year": from_my or "-",
                            "to_month_year": to_my or "nay",
                            "organization_name": org_name,
                            "position_name": pos_name,
                        })

        # 35.1) Khen thưởng
        elif "xếp loại chuyên môn" in header_row_0 and "hình thức khen thưởng" in header_row_0:
            for r in tbl[1:]:
                if len(r) >= 4 and any(_clean_space(c) for c in r):
                    yr, prof_r, emu_r, form_r = [_clean_space(x) for x in r[:4]]
                    yr_int = _parse_int(yr)
                    if yr_int and (form_r or prof_r or emu_r):
                        rewards.append({
                            "reward_year": yr_int,
                            "professional_rating": prof_r,
                            "emulation_rating": emu_r,
                            "reward_form": form_r or emu_r or prof_r,
                        })

        # 35.2) Kỷ luật
        elif "hành vi vi phạm" in header_row_0 and "cơ quan quyết định" in header_row_0:
            for r in tbl[2:]:
                if len(r) >= 5 and any(_clean_space(c) for c in r):
                    from_my, to_my, form_d, reason_d, auth_d = [_clean_space(x) for x in r[:5]]
                    if form_d or reason_d:
                        disciplines.append({
                            "from_month_year": from_my,
                            "to_month_year": to_my,
                            "discipline_form": form_d or "Kỷ luật",
                            "reason": reason_d,
                            "issuing_authority": auth_d,
                        })

        # 36.1 & 36.2) Quan hệ gia đình (4 cột)
        elif "mối quan hệ" in header_row_0 and "họ và tên" in header_row_0:
            family_table_count += 1
            side = "self" if family_table_count == 1 else "spouse"
            for r in tbl[1:]:
                if len(r) >= 4 and any(_clean_space(c) for c in r):
                    rel_type = _clean_space(r[0])
                    fname = _clean_space(r[1])
                    byear = _parse_int(r[2])
                    detail_blob = r[3]
                    if rel_type and fname:
                        parsed_fam = _parse_family_detail_blob(detail_blob, fallback_name=fname, fallback_year=byear)
                        family_relations.append({
                            "side_type": side,
                            "relationship_type": rel_type,
                            **parsed_fam,
                        })

        # 37.1) Quá trình lương của bản thân
        elif "bậc lương" in header_row_0 and "hệ số lương" in header_row_0:
            for r in tbl[2:]:
                if len(r) >= 5 and any(_clean_space(c) for c in r):
                    from_my = _clean_space(r[0])
                    to_my = _clean_space(r[1])
                    rank_c = _clean_space(r[2])
                    step_i = _parse_int(r[3])
                    coeff_f = _parse_float(r[4])
                    pos_sal = _clean_space(r[5]) if len(r) >= 6 else None
                    if coeff_f is not None:
                        salary_logs.append({
                            "from_month_year": from_my,
                            "to_month_year": to_my,
                            "rank_code": rank_c,
                            "salary_step": step_i,
                            "coefficient": coeff_f,
                            "position_salary_amount": pos_sal,
                        })

    return {
        "template_type": "TT06_2023",
        "template_label": "Sơ yếu lý lịch CBCCVC (Mẫu Thông tư 06/2023/TT-BNV — 38 Mục)",
        "extracted_fields": fields,
        "extracted_trainings": trainings,
        "extracted_work_experiences": work_experiences,
        "extracted_family_relations": family_relations,
        "extracted_salary_logs": salary_logs,
        "extracted_rewards": rewards,
        "extracted_disciplines": disciplines,
    }


def _parse_hs01_template(lines: List[str], tables: List[List[List[str]]]) -> Dict[str, Any]:
    """Bóc tách Biểu mẫu 2: LÝ LỊCH VIÊN CHỨC (Mẫu HS01-VC/BNV ban hành kèm TT 07/2019/TT-BNV)"""
    joined = "\n".join(lines)
    fields: Dict[str, Any] = {}

    # Cover & Header
    managing = _find_after_label(joined, r"Cơ quan,\s*đơn vị quản lý viên chức\s*:\s*([^\n]+)")
    if managing:
        fields["managing_agency_name"] = managing

    using = _find_after_label(joined, r"Đơn vị sử dụng viên chức\s*:\s*([^\n]+)")
    if using:
        fields["using_agency_name"] = using
        fields["work_unit_name"] = using

    so_hieu = _find_after_label(joined, r"Số hiệu viên chức\s*:\s*([^\n]+)")
    if so_hieu:
        fields["official_file_code"] = so_hieu

    # 1) Họ và tên khai sinh
    name1 = _find_after_label(joined, r"1\)\s*Họ và tên khai sinh[^:]*:\s*([^\n]+)")
    if not name1:
        name1 = _find_after_label(joined, r"Họ và tên khai sinh\s*:\s*([^\n]+)")
    if name1:
        fields["birth_full_name"] = name1.upper()

    # 2) Tên gọi khác
    alias = _find_after_label(joined, r"2\)\s*Tên gọi khác\s*:\s*([^\n]*?)(?=\s*3\)\s*Sinh ngày|\n|$)")
    if alias and not _is_empty_token(alias):
        fields["alias_name"] = alias

    # 3) Sinh ngày & Giới tính
    dob_raw = _find_after_label(joined, r"3\)\s*Sinh ngày\s*:\s*([^\n]+)")
    if not dob_raw:
        dob_raw = _find_after_label(joined, r"Ngày,\s*tháng,\s*năm sinh\s*:\s*([^\n]+)")
    dob = _parse_vn_date(dob_raw)
    if dob:
        fields["date_of_birth"] = dob

    gender = _find_after_label(joined, r"Giới tính\s*\(nam,\s*nữ\)\s*:\s*([^\n]+)")
    if gender:
        fields["gender"] = gender

    # 4) Nơi sinh & 5) Quê quán
    bp_raw = _find_after_label(joined, r"4\)\s*Nơi sinh\s*:\s*([^\n]+)")
    if bp_raw:
        w, d, p = _split_place_ward_province(bp_raw)
        if w:
            fields["birthplace_ward"] = w
        if d:
            fields["birthplace_district"] = d
        if p:
            fields["birthplace_province"] = p

    ht_raw = _find_after_label(joined, r"5\)\s*Quê quán\s*:\s*([^\n]+)")
    if ht_raw:
        w, d, p = _split_place_ward_province(ht_raw)
        if w:
            fields["hometown_ward"] = w
        if d:
            fields["hometown_district"] = d
        if p:
            fields["hometown_province"] = p

    # 6) Dân tộc & 7) Tôn giáo
    eth = _find_after_label(joined, r"6\)\s*Dân tộc\s*:\s*([^\n]+)")
    if eth:
        fields["ethnicity"] = eth
    rel = _find_after_label(joined, r"7\)\s*Tôn giáo\s*:\s*([^\n]+)")
    if rel:
        fields["religion"] = "Không" if _is_empty_token(rel) else rel

    # 8) Nơi đăng ký hộ khẩu thường trú & 9) Nơi ở hiện nay
    perm = _find_after_label(joined, r"8\)\s*Nơi đăng ký hộ khẩu thường trú\s*:\s*([^\n]+)")
    if perm:
        fields["permanent_address"] = perm
    curr = _find_after_label(joined, r"9\)\s*Nơi ở hiện nay\s*:\s*([^\n]+)")
    if curr:
        fields["current_address"] = curr

    # 10) Nghề nghiệp khi được tuyển dụng
    occ = _find_after_label(joined, r"10\)\s*Nghề nghiệp khi được tuyển dụng\s*:\s*([^\n]+)")
    if occ:
        fields["occupation_before_recruitment"] = occ

    # 11) Ngày tuyển dụng & Cơ quan, đơn vị tuyển dụng
    rec_date = _parse_vn_date(_find_after_label(joined, r"11\)\s*Ngày tuyển dụng\s*:\s*([^\n]+)"))
    if rec_date:
        fields["first_recruitment_date"] = rec_date
    rec_agency = _find_after_label(joined, r"Cơ quan,\s*đơn vị tuyển dụng\s*:\s*([^\n]+)")
    if rec_agency:
        fields["recruitment_agency"] = rec_agency

    # 12.1) Chức danh (chức vụ) công tác hiện tại & 12.2) Chức danh kiêm nhiệm
    pos_curr = _find_after_label(joined, r"12\.1\)\s*Chức danh\s*\(chức vụ\)\s*công tác hiện tại\s*:\s*([^\n]+)")
    if pos_curr:
        fields["leadership_position"] = pos_curr
    pos_conc = _find_after_label(joined, r"12\.2\)\s*Chức danh\s*\(chức vụ\)\s*kiêm nhiệm\s*:\s*([^\n]+)")
    if pos_conc:
        fields["concurrent_position"] = pos_conc

    # 13) Công việc chính được giao
    main_duty = _find_after_label(joined, r"13\)\s*Công việc chính được giao\s*:\s*([^\n]+)")
    if main_duty:
        fields["main_assigned_duty"] = main_duty

    # 14) Chức danh nghề nghiệp viên chức, Mã số, Bậc lương, Hệ số, Ngày hưởng
    cdnn = _find_after_label(joined, r"14\)\s*Chức danh nghề nghiệp viên chức\s*:\s*([^\n]+)")
    if cdnn:
        fields["professional_title_name"] = cdnn
    code14 = _find_after_label(joined, r"Mã số\s*:\s*([0-9\.]+)")
    if code14:
        fields["professional_title_code"] = code14
    step14 = _parse_int(_find_after_label(joined, r"Bậc lương\s*:\s*(\d+)"))
    if step14 is not None:
        fields["salary_step"] = step14
    coeff14 = _parse_float(_find_after_label(joined, r"Hệ số\s*:\s*([0-9\.,]+)"))
    if coeff14 is not None:
        fields["salary_coefficient"] = coeff14
    eff14 = _parse_vn_date(_find_after_label(joined, r"Ngày hưởng\s*:\s*([0-9/\-\.]+)"))
    if eff14:
        fields["salary_effective_date"] = eff14

    # 15.1 -> 15.7
    edu15_1 = _find_after_label(joined, r"15\.1-Trình độ giáo dục phổ thông[^:]*:\s*([^\n]+)")
    if edu15_1:
        fields["general_education_level"] = edu15_1
    edu15_2 = _find_after_label(joined, r"15\.2-Trình độ chuyên môn cao nhất\s*:\s*([^\n]+)")
    if edu15_2:
        fields["highest_professional_degree"] = edu15_2
    edu15_5 = _find_after_label(joined, r"15\.5-Trình độ nghiệp vụ theo chuyên ngành\s*:\s*([^\n]+)")
    if edu15_5:
        fields["professional_skill_by_major"] = edu15_5

    # 19.1 Danh hiệu & 19.2 Học hàm & 20 Sở trường
    honor19 = _find_after_label(joined, r"19\.1\)\s*Danh hiệu được phong tặng cao nhất\s*:\s*([^\n]+)")
    if honor19:
        fields["state_honorary_title"] = honor19
    acad19 = _find_after_label(joined, r"19\.2\)\s*Hàm học được phong[^:]*:\s*([^\n]+)")
    if acad19:
        fields["academic_title"] = acad19
    forte20 = _find_after_label(joined, r"20\)\s*Sở trường công tác\s*:\s*([^\n]+)")
    if forte20:
        fields["work_forte"] = forte20

    # 21) Sức khỏe
    health21 = _find_after_label(joined, r"21\)\s*Tình trạng sức khoẻ\s*:\s*([^\n]+)")
    if health21:
        fields["health_classification"] = health21
    h21 = _parse_float(_find_after_label(joined, r"Chiều cao\s*:\s*([0-9\.,]+)\s*cm"))
    if h21 is not None:
        fields["height_cm"] = int(round(h21))
    w21 = _parse_float(_find_after_label(joined, r"Cân nặng\s*:\s*([0-9\.,]+)\s*kg"))
    if w21 is not None:
        fields["weight_kg"] = w21
    b21 = _find_after_label(joined, r"Nhóm máu\s*:\s*([^\n]+)")
    if b21:
        fields["blood_type"] = b21

    # 22) Thương binh & Gia đình chính sách
    tb22 = _find_after_label(joined, r"22\)\s*Là thương binh hạng\s*:\s*([^\n]+)")
    if tb22:
        fields["wounded_soldier_class"] = tb22
    cs22 = _find_after_label(joined, r"Là con gia đình chính sách\s*:\s*([^\n\(]+)")
    if cs22:
        fields["policy_family_type"] = cs22

    # 23) Số CMND/CCCD & Ngày cấp, 24) Sổ BHXH
    cccd23 = _find_after_label(joined, r"23\)\s*Số chứng minh nhân dân\s*:\s*([0-9A-Za-z]+)")
    if cccd23:
        fields["cccd_number"] = cccd23
    cccd_dt23 = _parse_vn_date(_find_after_label(joined, r"Ngày cấp\s*:\s*([0-9/\-\.]+)"))
    if cccd_dt23:
        fields["cccd_issue_date"] = cccd_dt23
    bhxh24 = _find_after_label(joined, r"24\)\s*Sổ BHXH\s*:\s*([0-9A-Za-z]+)")
    if bhxh24:
        fields["social_insurance_code"] = bhxh24

    # Sub-tables in HS01
    trainings: List[Dict[str, Any]] = []
    work_experiences: List[Dict[str, Any]] = []
    family_relations: List[Dict[str, Any]] = []
    rewards: List[Dict[str, Any]] = []
    disciplines: List[Dict[str, Any]] = []

    family_table_count = 0

    for tbl in tables:
        if not tbl:
            continue
        header_row_0 = " | ".join(tbl[0]).lower()

        # Phần II: Quá trình đào tạo (5 hoặc 6 cột)
        if "tên trường" in header_row_0 and "chuyên ngành đào tạo" in header_row_0:
            for r in tbl[1:]:
                if len(r) >= 5 and any(_clean_space(c) for c in r):
                    school = _clean_space(r[0])
                    major = _clean_space(r[1])
                    if len(r) == 5:
                        period_str = _clean_space(r[2])
                        p_parts = [p.strip() for p in re.split(r"[-–—]+", period_str) if p.strip()]
                        from_p = p_parts[0] if len(p_parts) >= 1 else period_str
                        to_p = p_parts[1] if len(p_parts) >= 2 else ""
                        mode = _clean_space(r[3])
                        degree = _clean_space(r[4])
                    else:
                        from_p = _clean_space(r[2])
                        to_p = _clean_space(r[3])
                        mode = _clean_space(r[4])
                        degree = _clean_space(r[5])
                    if school:
                        grad_year = _parse_int(to_p.split("/")[-1]) if "/" in to_p else _parse_int(to_p)
                        trainings.append({
                            "training_category": "CHUYEN_MON",
                            "school_name": school,
                            "major": major,
                            "from_period": from_p,
                            "to_period": to_p,
                            "training_mode": mode,
                            "degree_certificate": degree,
                            "graduation_year": grad_year,
                        })

        # Phần III: Đặc điểm lịch sử bản thân (Từ tháng, năm đến tháng, năm | Đặc điểm lịch sử)
        elif "đặc điểm lịch sử" in header_row_0 and "từ tháng" in header_row_0:
            for r in tbl[1:]:
                if len(r) >= 2 and any(_clean_space(c) for c in r):
                    period_str = _clean_space(r[0])
                    desc = _clean_space(r[1])
                    if period_str and desc:
                        p_parts = [p.strip() for p in re.split(r"[-–—]+", period_str) if p.strip()]
                        from_my = p_parts[0] if len(p_parts) >= 1 else period_str
                        to_my = p_parts[1] if len(p_parts) >= 2 else "nay"
                        work_experiences.append({
                            "from_month_year": from_my,
                            "to_month_year": to_my,
                            "organization_name": desc,
                            "position_name": "",
                        })

        # Phần IV: Khen thưởng
        elif "nội dung và hình thức khen thưởng" in header_row_0:
            for r in tbl[1:]:
                if len(r) >= 3 and any(_clean_space(c) for c in r):
                    dt_str, form_str, auth_str = [_clean_space(x) for x in r[:3]]
                    yr_int = _parse_int(dt_str[-4:]) if dt_str else None
                    if form_str:
                        rewards.append({
                            "reward_year": yr_int or date.today().year,
                            "reward_form": form_str,
                            "issuing_authority": auth_str,
                        })

        # Phần V: Kỷ luật
        elif "lý do và hình thức kỷ luật" in header_row_0:
            for r in tbl[1:]:
                if len(r) >= 3 and any(_clean_space(c) for c in r):
                    dt_str, form_str, auth_str = [_clean_space(x) for x in r[:3]]
                    if form_str:
                        disciplines.append({
                            "from_month_year": dt_str,
                            "discipline_form": form_str,
                            "issuing_authority": auth_str,
                        })

        # Phần VI: Quan hệ gia đình (2 cột: Mối quan hệ | Họ tên, năm sinh, quê quán, nghề nghiệp...)
        elif "mối quan hệ" in header_row_0 and "họ tên" in header_row_0:
            family_table_count += 1
            side = "self" if family_table_count == 1 else "spouse"
            for r in tbl[1:]:
                if len(r) >= 2 and any(_clean_space(c) for c in r):
                    rel_type = _clean_space(r[0])
                    blob = r[1]
                    if rel_type and _clean_space(blob):
                        parsed_fam = _parse_family_detail_blob(blob)
                        if parsed_fam.get("full_name"):
                            family_relations.append({
                                "side_type": side,
                                "relationship_type": rel_type,
                                **parsed_fam,
                            })

    return {
        "template_type": "HS01_2019",
        "template_label": "Lý lịch viên chức (Mẫu HS01-VC/BNV — Thông tư 07/2019/TT-BNV)",
        "extracted_fields": fields,
        "extracted_trainings": trainings,
        "extracted_work_experiences": work_experiences,
        "extracted_family_relations": family_relations,
        "extracted_salary_logs": [],
        "extracted_rewards": rewards,
        "extracted_disciplines": disciplines,
    }


def parse_word_profile_bytes(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Hàm chính nhận diện và bóc tách dữ liệu từ file Word (.doc MHTML/HTML hoặc .docx OpenXML)"""
    ext = (filename or "").lower().split(".")[-1]
    portrait_data_url: Optional[str] = None
    warnings: List[str] = []

    if ext == "docx" or file_bytes.startswith(b"PK\x03\x04"):
        lines, tables, portrait_data_url = _extract_lines_and_tables_from_docx(file_bytes)
    else:
        html_text, portrait_data_url = _extract_html_from_mhtml_or_doc(file_bytes)
        lines, tables = _extract_lines_and_tables_from_html(html_text)

    full_text_upper = "\n".join(lines).upper()

    if "HS01-VC/BNV" in full_text_upper or "LÝ LỊCH VIÊN CHỨC" in full_text_upper or "I. SƠ LƯỢC LÝ LỊCH" in full_text_upper:
        parsed = _parse_hs01_template(lines, tables)
    elif "30.1)" in full_text_upper or "32.1-" in full_text_upper or "SƠ YẾU LÝ LỊCH" in full_text_upper:
        parsed = _parse_tt06_template(lines, tables)
    else:
        # Try both and merge non-empty
        tt06 = _parse_tt06_template(lines, tables)
        hs01 = _parse_hs01_template(lines, tables)
        merged_fields = {**hs01["extracted_fields"], **tt06["extracted_fields"]}
        parsed = {
            "template_type": "GENERAL_WORD",
            "template_label": "Biểu mẫu Lý lịch Word tổng hợp",
            "extracted_fields": merged_fields,
            "extracted_trainings": tt06["extracted_trainings"] or hs01["extracted_trainings"],
            "extracted_work_experiences": tt06["extracted_work_experiences"] or hs01["extracted_work_experiences"],
            "extracted_family_relations": tt06["extracted_family_relations"] or hs01["extracted_family_relations"],
            "extracted_salary_logs": tt06["extracted_salary_logs"] or hs01["extracted_salary_logs"],
            "extracted_rewards": tt06["extracted_rewards"] or hs01["extracted_rewards"],
            "extracted_disciplines": tt06["extracted_disciplines"] or hs01["extracted_disciplines"],
        }
        warnings.append("File không chứa tiêu đề chuẩn TT06 hoặc HS01-VC/BNV, hệ thống đã áp dụng bộ bóc tách kết hợp.")

    if not parsed["extracted_fields"]:
        warnings.append("Không tìm thấy các trường thông tin định danh chuẩn trong file Word.")

    return {
        **parsed,
        "file_name": filename,
        "extracted_portrait_data_url": portrait_data_url,
        "warnings": warnings,
    }

