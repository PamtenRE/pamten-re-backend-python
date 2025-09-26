from __future__ import annotations
import io, csv, tempfile, uuid, re
from pathlib import Path
from typing import List
from datetime import date
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from matcher import match_resume_to_jds
from jd_cache import load_or_build_jd_cache, build_jd_cache_from_uploads

APP_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = APP_DIR / "_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Resume–JD Matching Plugin")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _serve_app() -> HTMLResponse:
    return HTMLResponse(
        (APP_DIR / "app.html").read_text(encoding="utf-8"),
        headers={"Cache-Control": "no-store"},
    )

@app.get("/", response_class=HTMLResponse)
def index():
    return _serve_app()

@app.get("/upload", response_class=HTMLResponse)
def upload_page():
    return _serve_app()

jd_cache_fallback = load_or_build_jd_cache(
    jd_dir=str(APP_DIR / "Dummy_data" / "JDS"),
    cache_path=str(APP_DIR / "Dummy_data" / "jd_cache.json"),
)

_DEGREE_WORD_RE = re.compile(
    r"(?i)\b(master|bachelor|b\.?e|b\.?tech|m\.?s|m\.?sc|m\.?tech|bsc|msc|mca|bca|mba|phd|doctor|ms|bs|be|me|mtech|btech)\b"
)

def months_between(a: date, b: date) -> int:
    return max(0, (b.year - a.year) * 12 + (b.month - a.month))

def _periods_html(periods: List[dict]) -> str:
    if not periods:
        return "—"
    seen, items = set(), []
    for p in periods:
        key = (p.get("entry", ""), p.get("start", ""), p.get("end", ""))
        if key in seen:
            continue
        seen.add(key)
        items.append(f"<li>{p.get('entry','')} ({p.get('start','')} — {p.get('end','')})</li>")
    return "<ul>" + "".join(items) + "</ul>"

def _gaps_html(gaps: List[dict]) -> str:
    if not gaps:
        return ""
    seen, items = set(), []
    for g in gaps:
        key = (g.get("between", ""), g.get("gap_months", ""))
        if key in seen:
            continue
        seen.add(key)
        items.append(
            f"<li>{g.get('between','')} – {g.get('gap_months','')} months</li>"
        )
    return "<ul>" + "".join(items) + "</ul>"

def _table_html(rows_html: str) -> str:
    return f"""
    <table>
      <tr>
        <th>JD File</th><th>Match %</th><th>Resume Location</th><th>JD Location</th>
        <th>Matched Skills</th><th>Missing Skills</th><th>Edu → First Job Gap</th>
        <th>Education Periods</th><th>Experience Periods</th>
        <th>Education Gaps</th><th>Experience Gaps</th>
      </tr>
      {rows_html}
    </table>"""

def _build_rows(results: list) -> str:
    rows = []
    for r in results:
        rows.append(f"""
        <tr>
          <td>{r.get('jd_file','')}</td>
          <td>{r.get('similarity_score_percent','')}%</td>
          <td>{r.get('resume_location','Not Mentioned')}</td>
          <td>{r.get('jd_location','Not Mentioned')}</td>
          <td>{', '.join((r.get('matched_skills', []) or []))}</td>
          <td>{', '.join((r.get('missing_skills', []) or []))}</td>
          <td>{r.get('education_to_first_job_gap_months','N/A')} months</td>
          <td>{_periods_html(r.get('education_periods') or [])}</td>
          <td>{_periods_html(r.get('experience_periods') or [])}</td>
          <td>{_gaps_html(r.get('education_gaps') or [])}</td>
          <td>{_gaps_html(r.get('experience_gaps') or [])}</td>
        </tr>""")
    return "".join(rows)

def _safe_save_upload(prefix: str, original_name: str, data: bytes) -> Path:
    target = UPLOAD_DIR / f"{prefix}-{uuid.uuid4().hex}{Path(original_name).suffix or '.bin'}"
    try:
        target.write_bytes(data)
        return target
    except PermissionError:
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(original_name).suffix or ".bin") as tf:
            tf.write(data)
            tf.flush()
            return Path(tf.name)

# 🔑 FIX: explicitly expect multiple jd_files
@app.post("/upload", response_class=HTMLResponse)
async def handle_upload(
    request: Request,
    resume: UploadFile = File(...),
    jd_files: List[UploadFile] = File([]),
):
    try:
        jd_cache = (
            build_jd_cache_from_uploads([(f.filename, await f.read()) for f in jd_files])
            if jd_files else jd_cache_fallback
        )
        resume_path = _safe_save_upload("resume", resume.filename, await resume.read())
        results = match_resume_to_jds(str(resume_path), jd_cache)
        rows_html = _build_rows(results) or "<tr><td colspan='11' style='text-align:center;'>No matches found</td></tr>"
        return HTMLResponse(_table_html(rows_html), headers={"Cache-Control": "no-store"})
    except Exception as e:
        return HTMLResponse(
            f"<pre>Upload failed: {e!s}</pre>",
            status_code=400,
            headers={"Cache-Control": "no-store"},
        )

@app.post("/download_csv")
async def download_csv(
    request: Request,
    resume: UploadFile = File(...),
    jd_files: List[UploadFile] = File([]),
):
    jd_cache = (
        build_jd_cache_from_uploads([(f.filename, await f.read()) for f in jd_files])
        if jd_files else jd_cache_fallback
    )
    resume_path = _safe_save_upload("resume", resume.filename, await resume.read())
    results = match_resume_to_jds(str(resume_path), jd_cache)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "JD File","Match %","Resume Location","JD Location","Matched Skills",
        "Missing Skills","Edu → First Job Gap","Education Periods",
        "Experience Periods","Education Gaps","Experience Gaps"
    ])
    def _periods_csv(periods):
        return "; ".join(f"{p.get('entry','')} ({p.get('start','')} — {p.get('end','')})" for p in (periods or []))
    def _gaps_csv(gaps):
        return "; ".join(f"{g.get('between','')} – {g.get('gap_months','')} months" for g in (gaps or []))
    for r in results:
        w.writerow([
            r.get("jd_file",""),
            r.get("similarity_score_percent",""),
            r.get("resume_location",""),
            r.get("jd_location",""),
            ", ".join((r.get("matched_skills", []) or [])),
            ", ".join((r.get("missing_skills", []) or [])),
            r.get("education_to_first_job_gap_months",""),
            _periods_csv(r.get("education_periods")),
            _periods_csv(r.get("experience_periods")),
            _gaps_csv(r.get("education_gaps")),
            _gaps_csv(r.get("experience_gaps")),
        ])
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={
            "Content-Disposition":"attachment; filename=resume_match_results.csv",
            "Cache-Control":"no-store",
        },
    )

if __name__ == "__main__":
    uvicorn.run("app_main:app", host="127.0.0.1", port=8000, reload=True)
