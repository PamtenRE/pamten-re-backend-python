import io
import re
import docx
import pypdf
# from bs4 import BeautifulSoup  # keep if you need it elsewhere
from gemini_utils import structure_text_with_ai


# ------------------------------
# LinkedIn helpers
# ------------------------------
LINKEDIN_RE = re.compile(
    r'(?:https?://)?(?:www\.)?linkedin\.com/(?:in|pub|company)/[A-Za-z0-9\-_/]+',
    re.IGNORECASE,
)

def _normalize_linkedin(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url
    # strip common trailing punctuation/brackets
    return url.rstrip(").,; ")


# ------------------------------
# Visa Status / Work Authorization
# ------------------------------

# Remove any leading label like "Visa Status:" or "Work Authorization:"
LABEL_RE = re.compile(r'^\s*(?:visa\s*status|work\s*authorization)\s*:\s*', re.IGNORECASE)

def _clean_legal_status(val: str) -> str:
    if not val:
        return ""
    return LABEL_RE.sub("", val).strip()

# Try to read explicit label first, then keyword buckets -> candidate value
VISA_LABEL_RE = re.compile(
    r'visa\s*status\s*[:\-]\s*([A-Za-z0-9\.\-/\s]+)',
    re.IGNORECASE
)

VISA_KEYWORDS = [
    (re.compile(r'\b(us|u\.s\.)\s*citizen\b', re.IGNORECASE),       "U.S. Citizen"),
    (re.compile(r'\b(permanent\s*resident|green\s*card)\b', re.IGNORECASE), "Green Card"),
    (re.compile(r'\bh[-\s]?1b\b', re.IGNORECASE),                  "H-1B"),
    (re.compile(r'\bl[-\s]?1\b', re.IGNORECASE),                   "L-1"),
    (re.compile(r'\btn\b', re.IGNORECASE),                         "TN"),
    (re.compile(r'\bh[-\s]?4\s*ead\b', re.IGNORECASE),             "H-4 EAD"),
    (re.compile(r'\bstem\s*opt\b', re.IGNORECASE),                 "STEM OPT"),
    (re.compile(r'\binitial\s*opt\b', re.IGNORECASE),              "Initial OPT"),
    (re.compile(r'\bf[-\s]?1\s*opt\b', re.IGNORECASE),             "F-1 OPT"),
    (re.compile(r'\bf[-\s]?1\b', re.IGNORECASE),                   "F-1"),
    (re.compile(r'\bcpt\b', re.IGNORECASE),                        "CPT"),
    (re.compile(r'\bead\b', re.IGNORECASE),                        "EAD"),
]

def _clean_fragment(s: str) -> str:
    return (s or "").strip().rstrip(").,;: ").replace("\n", " ")

def detect_visa_status(raw_text: str) -> str:
    """
    Pull a visa/work auth status from the raw resume text.
    1) Prefer explicit "Visa Status: ____".
    2) Fall back to keyword matches.
    """
    if not raw_text:
        return ""
    flat = raw_text.replace("\r", " ")

    # 1) Explicit "Visa Status: ____"
    m = VISA_LABEL_RE.search(flat)
    if m:
        candidate = _clean_fragment(m.group(1))
        for rx, canon in VISA_KEYWORDS:
            if rx.search(candidate):
                return canon
        return candidate[:60]  # fallback to literal if we can't map

    # 2) Keyword-only
    for rx, canon in VISA_KEYWORDS:
        if rx.search(flat):
            return canon

    return ""

# Canonicalize to the *exact* values your frontend Select expects
def _canonicalize_legal_status(val: str) -> str:
    s = (val or "").strip().lower().replace(".", "")
    if not s:
        return ""
    if re.search(r'^(us|u?s|united states)\s*citizen|^citizen$', s):
        return "US Citizen"
    if re.search(r'green\s*card|permanent\s*resident|lawful\s*permanent', s):
        return "Green Card"
    if re.search(r'^h\s*[- ]?1\s*b$', s):
        return "H-1B"
    if re.search(r'^l\s*[- ]?1$', s):
        return "L-1"
    if re.search(r'^tn$', s):
        return "TN"
    # F-1 flavors
    if re.search(r'^f\s*[- ]?1\s*stem\s*opt$', s) or re.search(r'^stem\s*opt$', s):
        return "F-1 STEM OPT"
    if re.search(r'^f\s*[- ]?1\s*initial\s*opt$', s) or re.search(r'^initial\s*opt$', s):
        return "F-1 Initial OPT"
    if re.search(r'^f\s*[- ]?1(\s*opt)?$', s):
        return "F-1"
    # Other common ones
    if re.search(r'^cpt$', s):
        return "CPT"
    if re.search(r'^h\s*[- ]?4\s*ead$', s):
        return "H-4 EAD"
    if re.search(r'\bead\b', s):
        return "EAD"
    return (val or "").strip()


# ------------------------------
# Main parser
# ------------------------------
def parse_resume_file(file_storage):
    """
    Parses an uploaded file, extracts raw text, and sends it to an AI for structuring.

    Args:
        file_storage: The FileStorage object from Flask request.files.

    Returns:
        dict: { "parsedData": <structured_data> } or { "error": <message> }
    """
    filename = (file_storage.filename or "").lower()
    raw_text = ""

    try:
        print(f"Starting to parse file: {filename}")

        # Read upload once; reuse bytes for any branch
        blob = file_storage.read() or b""

        if filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(blob))
            raw_text = "\n".join(p.text for p in doc.paragraphs)

        elif filename.endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(io.BytesIO(blob))
            parts = []
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    parts.append(extracted)
            raw_text = "\n".join(parts)

        elif filename.endswith(".txt"):  # allow plain text resumes
            raw_text = blob.decode("utf-8", errors="ignore")

        else:
            return {
                "error": "Unsupported file type. Please upload a .docx, .pdf, or .txt file."
            }

        if not raw_text.strip():
            return {"error": "Could not extract any text from the document."}

        print("--- Successfully extracted raw text from resume. ---")

        # Detect LinkedIn URL from raw text
        ln_match = LINKEDIN_RE.search(raw_text.replace("\n", " "))
        linkedin_url = _normalize_linkedin(ln_match.group(0)) if ln_match else ""

        # Detect visa status from raw text (for when AI omits it)
        detected_visa = detect_visa_status(raw_text)

        print("--- Sending extracted text to AI for structuring... ---")
        structured_data = structure_text_with_ai(raw_text)  # expect dict-like

        # Enrich + normalize the personal block
        if isinstance(structured_data, dict):
            personal = structured_data.get("personal") or {}
            if not isinstance(personal, dict):
                personal = {}

            # Inject LinkedIn if we found one and the model didn't give us one
            existing_ln = (
                personal.get("linkedin")
                or personal.get("linkedIn")
                or personal.get("linkedinUrl")
            )
            if linkedin_url and not existing_ln:
                personal["linkedin"] = linkedin_url

            # Normalize visa/work auth and fill from detection when missing
            raw_status = (
                personal.get("legalStatus")
                or personal.get("visaStatus")
                or personal.get("workAuthorization")
                or ""
            )
            cleaned = _clean_legal_status(raw_status) or detected_visa
            personal["legalStatus"] = _canonicalize_legal_status(cleaned)

            structured_data["personal"] = personal

        print("--- AI processing complete. Returning structured data. ---")
        return {"parsedData": structured_data}

    except Exception as e:
        print(f"Error in parse_resume_file: {e}")
        return {"error": f"An error occurred while parsing the file: {e}"}
