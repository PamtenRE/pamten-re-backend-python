# extractors.py

import re
import unicodedata
from datetime import datetime
from functools import lru_cache
from typing import List, Tuple, Dict, Any, Optional

import fitz  # PyMuPDF
import docx
from dateutil import parser as dparser

# ======================================================================
# Text readers
# ======================================================================

def extract_text(path: str) -> str:
    p = path.lower()
    if p.endswith(".pdf"):
        doc = fitz.open(path)
        try:
            return "\n".join(page.get_text("text") for page in doc)
        finally:
            doc.close()
    if p.endswith(".docx"):
        d = docx.Document(path)
        return "\n".join(par.text for par in d.paragraphs)
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


# ======================================================================
# Skill extraction (SkillNer first, then morphology-only fallback)
# ======================================================================

@lru_cache(maxsize=1)
def _lazy_skill_extractor():
    """
    Build the SkillExtractor once and cache it.
    Uses spaCy + SkillNer built-in skill database (no manual keyword list).
    """
    import spacy
    from spacy.matcher import PhraseMatcher
    from skillNer.skill_extractor_class import SkillExtractor
    from skillNer.general_params import SKILL_DB

    try:
        nlp = spacy.load("en_core_web_sm")
    except Exception:
        # fall back to a blank pipeline (SkillNer still works for surface matching)
        nlp = spacy.blank("en")

    return SkillExtractor(nlp, SKILL_DB, PhraseMatcher)


# ---------- PDF-friendly normalization ----------

_BULLETS = r"[•●◦▪︎▫︎·∙■□◆◇▶▸►–—-]"

def _normalize_for_skills(text: str) -> str:
    """
    Light normalization aimed at resumes/JDs (esp. PDF text).
    """
    t = unicodedata.normalize("NFKC", text or "")
    t = t.replace("\u00A0", " ")
    t = re.sub(_BULLETS, " ", t)
    t = re.sub(r"[|/\\;,(){}\[\]:+~^#@*&]", " ", t)
    t = re.sub(r"\.\s*\.\s*\.", " ", t)            # ellipses
    t = re.sub(r"([a-z])([a-z]*)([A-Z])", r"\1\2 \3", t)  # split camelCase before caps
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _chunk(text: str, size: int = 5000) -> List[str]:
    """Split very long texts so SkillNer doesn’t choke."""
    text = text or ""
    return [text[i:i + size] for i in range(0, len(text), size)]


# ---------- Morphology-only tech detector (no predefined ignore lists) ----------

def _is_skill_like(s: str) -> bool:
    if not s:
        return False
    s = s.strip()
    s = re.sub(r"^[^\w+.#-]+|[^\w+.#-]+$", "", s)
    if not s:
        return False

    # strong signals
    if re.search(r"[0-9+#.]", s): return True         # C#, C++, .NET, Node.js
    if re.fullmatch(r"[A-Z]{2,6}", s): return True    # SQL, AWS, API, SDK, NLP
    if re.search(r"[A-Z].*[A-Z]", s): return True     # ReactJS, PowerBI
    if re.fullmatch(r"[A-Z][a-z]+[A-Z][A-Za-z0-9]*", s): return True  # CamelCase tech

    # plain alphabetic
    if re.fullmatch(r"[A-Za-z]+", s):
        # ❗ reject ANY all-lowercase token (removes: development, in, of, on, processes)
        if s.islower():
            return False
        # allow very short uppercase/TitleCase tokens (R, C, Go)
        if len(s) <= 2:
            return True
        # allow common short tech words when capitalized (Git, Java, Bash, Go)
        if 3 <= len(s) <= 4 and s[0].isupper():
            return True
        # longer capitalized words: require techy suffix
        if len(s) >= 5 and re.search(r"(sql|js|ml|db|ops|api|sdk)$", s, re.I):
            return True
        return False

    return False


# ---------- Heuristic fallback (no predefined word list) ----------

_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9\+\#\.\-]{1,30}")

def _norm_token_key(s: str) -> str:
    s = (s or "").lower().strip()
    s = s.replace("c++", "cpp").replace("c#", "csharp")
    s = s.replace("node.js", "nodejs").replace("react.js", "reactjs")
    s = s.replace(".js", "js")
    s = s.replace(" ", "")
    s = re.sub(r"[^a-z0-9]", "", s)
    return s

def _fallback_extract_skills(raw: str) -> List[str]:
    """
    Morphology-only fallback: scan text, collect tokens that *look* like skills
    based solely on shape (no stopword lists), dedupe by normalized key.
    """
    if not raw:
        return []
    found: Dict[str, str] = {}
    for tok in _TOKEN_RE.findall(raw):
        if not _is_skill_like(tok):
            continue
        key = _norm_token_key(tok)
        if len(key) < 2:
            continue
        # keep first pretty casing
        found.setdefault(key, tok)
    return sorted(found.values(), key=str.casefold)


# ---------- Public skill API ----------

def extract_skills(text: str) -> List[str]:
    """
    Return a sorted list of unique skill names found in `text`.
    Tries SkillNer first (no manual list). Results then pass through a
    morphology-only filter. If SkillNer fails or yields very little, use a
    purely pattern-based fallback that also uses the same morphology-only filter.
    """
    cleaned = _normalize_for_skills(text)
    if not cleaned:
        return []

    found: set[str] = set()

    # 1) Try SkillNer
    try:
        se = _lazy_skill_extractor()
        for part in _chunk(cleaned, 5000):
            try:
                ann = se.annotate(part) or {}
            except Exception:
                continue
            results = ann.get("results", {})
            full_matches = results.get("full_matches") or []
            ngram_scored = results.get("ngram_scored") or []
            if isinstance(results, list):  # very old SkillNer API
                full_matches = results

            def _label(d: dict) -> str:
                return (
                    d.get("doc_node_value")
                    or d.get("skill_name")
                    or d.get("skill")
                    or d.get("label")
                    or ""
                )

            for it in full_matches:
                s = _label(it).strip()
                if s and _is_skill_like(s):
                    found.add(s)
            for it in ngram_scored:
                try:
                    score = float(it.get("score", 0.0))
                except Exception:
                    score = 0.0
                if score >= 0.85:
                    s = _label(it).strip()
                    if s and _is_skill_like(s):
                        found.add(s)
    except Exception:
        # ignore and try fallback below
        pass

    # 2) If SkillNer came up empty or too small, use morphology fallback too
    if len(found) == 0:
        for t in _fallback_extract_skills(cleaned):
            found.add(t)

    # 3) Deduplicate by normalized key and return pretty-cased values
    uniq: Dict[str, str] = {}
    for s in found:
        key = _norm_token_key(s)
        if len(key) < 2:
            continue
        uniq.setdefault(key, s)

    kept = [v for v in uniq.values() if _is_skill_like(v)]
    return sorted(kept, key=str.casefold)


def normalize_skills(skills: List[str]) -> set:
    """
    Normalize a list of skill strings into canonical, comparable tokens.
    Useful before set operations (e.g., resume vs JD skills).
    """
    out = set()
    for s in skills or []:
        k = _norm_token_key(s)
        if k:
            out.add(k)
    return out


# ======================================================================
# Education / Experience periods + gaps
# ======================================================================

def clean_entry_name(s: str) -> str:
    s = re.sub(r"[•\u2022\u2023\u25E6\u2043\u2219]", "", s or "")
    s = re.sub(r"\s+", " ", s).strip(" -–—|\t")
    return s.strip()


# ---------- Date parsing ----------

MONTHS_RE = r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
SEASONS_RE = r"(Spring|Summer|Fall|Autumn|Winter)"
MONTH_OR_SEASON_RE = rf"(?:{MONTHS_RE}|{SEASONS_RE})"
DATE_TOKEN = rf"(?:{MONTH_OR_SEASON_RE}\s+\d{{4}}|\d{{1,2}}[/-]\d{{4}}|\d{{4}})"
RANGE_CONN = r"(?:-|–|—|to|until|through|thru)"

RANGE_RE = re.compile(
    rf"(?P<start>{DATE_TOKEN})\s*(?:{RANGE_CONN})\s*(?P<end>{DATE_TOKEN}|Present|Current|Now)",
    re.IGNORECASE,
)
SINGLE_RE = re.compile(rf"(?P<single>{MONTH_OR_SEASON_RE}\s+\d{{4}})", re.IGNORECASE)

SEASON_TO_MONTH = {"spring": 3, "summer": 6, "fall": 9, "autumn": 9, "winter": 12}

def _parse_date(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s:
        return None
    if re.fullmatch(r"(?i)present|current|now", s):
        return datetime(9999, 1, 1)
    m = re.match(r"(?i)(spring|summer|fall|autumn|winter)\s+(\d{4})", s)
    if m:
        return datetime(int(m.group(2)), SEASON_TO_MONTH[m.group(1).lower()], 1)
    try:
        dt = dparser.parse(s, default=datetime(1900, 1, 1), fuzzy=True, dayfirst=False)
        return dt.replace(day=1)
    except Exception:
        return None


# ---------- Label heuristics ----------

_EDU_DEGREE_RE = re.compile(r"(?i)\b(master|bachelor|b\.?e|b\.?tech|m\.?s|m\.?tech|bsc|msc|engineering|technology|science)\b")
_EDU_INSTITUTION_RE = re.compile(r"(?i)\b(university|college|institute|school|mahavidyalaya|viswa|visva)\b")
_GPA_RE = re.compile(r"(?i)\b(CGPA|GPA|score)\b")

_EXP_TITLE_RE = re.compile(r"(?i)\b(engineer|developer|intern|analyst|manager|consultant|architect|administrator|tester|lead)\b")
_EXP_COMPANY_RE = re.compile(r"(?i)\b(inc\.?|llc|ltd\.?|pvt\.?|limited|solutions|technologies|systems|labs|software|corp\.?)\b")

def _split_degree_and_institution(line: str) -> Tuple[str, str]:
    m = _EDU_INSTITUTION_RE.search(line or "")
    if not m:
        return clean_entry_name(line or ""), ""
    deg = clean_entry_name((line or "")[:m.start()])
    inst = clean_entry_name((line or "")[m.start():])
    return deg, inst


# ---------- Helpers ----------

def _find_nearest_index_above_first(
    lines: List[str],
    idx: int,
    predicate,
    window: int = 6,
    exclude_predicates: List = None,
    used: Optional[set] = None,
) -> Optional[int]:
    """Find nearest matching line preferring ABOVE the anchor."""
    if exclude_predicates is None:
        exclude_predicates = []
    if used is None:
        used = set()
    n = len(lines)
    for d in range(1, window + 1):
        j = idx - d
        if j < 0 or j in used:
            continue
        ln = lines[j].strip()
        if not ln:
            continue
        if any(ex(ln) for ex in exclude_predicates):
            continue
        if predicate(ln):
            return j
    for d in range(1, window + 1):
        j = idx + d
        if j >= n or j in used:
            continue
        ln = lines[j].strip()
        if not ln:
            continue
        if any(ex(ln) for ex in exclude_predicates):
            continue
        if predicate(ln):
            return j
    return None

def _find_institution_below_then_above(
    lines: List[str],
    deg_idx: int,
    window: int = 6,
) -> Optional[int]:
    """For institutions, prefer the line(s) BELOW the degree, then above."""
    n = len(lines)
    # below first
    for d in range(1, window + 1):
        j = deg_idx + d
        if j >= n:
            break
        ln = lines[j].strip()
        if not ln:
            continue
        if _GPA_RE.search(ln):
            continue
        if _EDU_DEGREE_RE.search(ln):
            continue
        if _EDU_INSTITUTION_RE.search(ln):
            return j
    # then above
    for d in range(1, window + 1):
        j = deg_idx - d
        if j < 0:
            break
        ln = lines[j].strip()
        if not ln:
            continue
        if _GPA_RE.search(ln):
            continue
        if _EDU_DEGREE_RE.search(ln):
            continue
        if _EDU_INSTITUTION_RE.search(ln):
            return j
    return None


# ---------- Compose labels ----------

def _compose_label_edu(lines: List[str], idx: int, before: str, after: str, used_deg: set) -> str:
    cur = (before or after or "").strip()
    if _GPA_RE.search(cur):  # ignore GPA-only fragments
        cur = ""

    degree_text = ""
    institution_text = ""
    deg_idx: Optional[int] = None

    if _EDU_DEGREE_RE.search(cur):
        d, i = _split_degree_and_institution(cur)
        degree_text, institution_text = d, i
        deg_idx = idx
    else:
        deg_idx = _find_nearest_index_above_first(
            lines, idx,
            lambda s: _EDU_DEGREE_RE.search(s) is not None,
            window=6,
            exclude_predicates=[lambda s: _GPA_RE.search(s) is not None],
            used=used_deg,
        )
        if deg_idx is not None:
            used_deg.add(deg_idx)
            d, i = _split_degree_and_institution(lines[deg_idx])
            degree_text = d
            institution_text = i or ""

    # Institution: prefer below the degree line, then above
    if degree_text and not institution_text and deg_idx is not None:
        inst_idx = _find_institution_below_then_above(lines, deg_idx, window=6)
        if inst_idx is not None:
            institution_text = clean_entry_name(lines[inst_idx])

    label = (
        f"{degree_text} | {institution_text}"
        if (degree_text and institution_text)
        else (degree_text or institution_text or (cur or "Education"))
    )
    return clean_entry_name(label) or "Education"


def _compose_label_exp(lines: List[str], idx: int, before: str, after: str) -> str:
    cand = (before or after or "").strip()
    picks: List[str] = []

    def add(s: str):
        s2 = clean_entry_name(s)
        if s2 and s2 not in picks:
            picks.append(s2)

    if _EXP_TITLE_RE.search(cand) or _EXP_COMPANY_RE.search(cand):
        add(cand)

    for j in range(idx - 1, max(-1, idx - 3), -1):
        ln = (lines[j] if j >= 0 else "").strip()
        if _EXP_TITLE_RE.search(ln) or _EXP_COMPANY_RE.search(ln):
            add(ln)

    if idx + 1 < len(lines):
        ln = lines[idx + 1].strip()
        if _EXP_TITLE_RE.search(ln) or _EXP_COMPANY_RE.search(ln):
            add(ln)

    if picks:
        if len(picks) >= 2:
            picks.sort(key=lambda s: (0 if _EXP_TITLE_RE.search(s) else 1, s))
        return f"{picks[0]} | {picks[1]}" if len(picks) >= 2 else picks[0]

    return clean_entry_name(cand or "Experience")


# ---------- Period extraction ----------

def extract_periods(lines: List[str], mode: str = "generic") -> List[Tuple[str, datetime, datetime]]:
    periods: List[Tuple[str, datetime, datetime]] = []
    if not lines:
        return periods

    used_degree_idxs: set = set()

    for idx, line in enumerate(lines):
        if not (line and line.strip()):
            continue

        ranges = list(RANGE_RE.finditer(line))
        if ranges:
            for m in ranges:
                start = _parse_date(m.group("start"))
                end = _parse_date(m.group("end"))
                if not (start and end):
                    continue
                before = line[:m.span()[0]].strip()
                after = line[m.span()[1]:].strip()
                entry = (
                    _compose_label_edu(lines, idx, before, after, used_degree_idxs)
                    if mode == "edu" else
                    _compose_label_exp(lines, idx, before, after)
                )
                periods.append((clean_entry_name(entry) or "Experience", start, end))
            continue

        s = SINGLE_RE.search(line)
        if s:
            start = _parse_date(s.group("single"))
            if start:
                before = line[:s.span()[0]].strip()
                after = line[s.span()[1]:].strip()
                entry = (
                    _compose_label_edu(lines, idx, before, after, used_degree_idxs)
                    if mode == "edu" else
                    _compose_label_exp(lines, idx, before, after)
                )
                periods.append((clean_entry_name(entry) or "Experience", start, datetime(9999, 1, 1)))

    seen, uniq = set(), []
    for entry, start, end in periods:
        key = (entry.lower(), start.year, start.month, end.year, end.month)
        if key not in seen:
            seen.add(key)
            uniq.append((entry, start, end))

    # chronological
    uniq.sort(key=lambda x: (x[1], x[2]))
    return uniq


# ---------- Gaps ----------

def _months_between(a: datetime, b: datetime) -> int:
    return max(0, (b.year - a.year) * 12 + (b.month - a.month))

def calculate_gaps(periods: List[Tuple[str, datetime, datetime]]) -> List[Dict[str, Any]]:
    gaps: List[Dict[str, Any]] = []
    if not periods:
        return gaps
    ps = sorted(periods, key=lambda x: x[1])
    for i in range(len(ps) - 1):
        gap = _months_between(ps[i][2], ps[i + 1][1])
        if gap > 0:
            gaps.append({"between": f"{ps[i][0]} → {ps[i + 1][0]}", "gap_months": gap})
    return gaps

def education_to_first_job_gap(
    edu: List[Tuple[str, datetime, datetime]],
    exp: List[Tuple[str, datetime, datetime]]
) -> Optional[int]:
    if not edu or not exp:
        return None
    first_job_start = min(e[1] for e in exp)
    ends_before = [e[2] for e in edu if e[2] <= first_job_start]
    if not ends_before:
        return 0
    last_edu_end = max(ends_before)
    return _months_between(last_edu_end, first_job_start)


# ======================================================================
# Sectioning & Public API
# ======================================================================

HEADERS = [
    "education", "experience", "work experience", "professional experience",
    "projects", "skills", "certifications", "achievements",
]

def _split_sections(text: str) -> Dict[str, List[str]]:
    lines = [ln.strip() for ln in (text or "").splitlines()]
    sections: Dict[str, List[str]] = {}
    current = "misc"
    sections[current] = []
    for ln in lines:
        low = ln.strip().lower()
        if low in HEADERS:
            current = low
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(ln)
    return sections

def is_education_institution(s: str) -> bool:
    return bool(re.search(
        r"(?i)\b(university|college|institute|school|bachelor|master|b\.?e|b\.?tech|m\.?s|m\.?tech|bsc|msc|engineering|technology|science)\b",
        s,
    ))

def extract_resume_data(text: str):
    """
    High-level parser: splits sections, extracts skills, education & experience
    periods, computes gaps, and the education-to-first-job gap.
    """
    sections = _split_sections(text)
    skills = extract_skills(text)

    edu_lines = list(sections.get("education", []))
    edu_lines += [ln for ln in sections.get("misc", []) if is_education_institution(ln)]
    edu = extract_periods(edu_lines, mode="edu")

    exp_lines = (
        sections.get("experience", [])
        + sections.get("work experience", [])
        + sections.get("professional experience", [])
    )
    if not exp_lines:
        all_lines = [ln for ln in text.splitlines() if ln.strip()]
        exp_lines = [ln for ln in all_lines if ln not in edu_lines]
    exp = extract_periods(exp_lines, mode="exp")

    gaps_edu = calculate_gaps(edu)
    gaps_exp = calculate_gaps(exp)
    edu_to_exp = education_to_first_job_gap(edu, exp)

    return skills, edu, exp, gaps_edu, gaps_exp, edu_to_exp
_DEGREE_WORD_RE = re.compile(
    r"(?i)\b(master|bachelor|b\.?e|b\.?tech|m\.?s|m\.?sc|m\.?tech|bsc|msc|mca|bca|mba|phd|doctor|ms|bs|be|me|mtech|btech)\b"
)   

from fastapi import FastAPI, File, UploadFile, Form

app = FastAPI() 
from extractors import extract_text, extract_resume_data, normalize_skills
