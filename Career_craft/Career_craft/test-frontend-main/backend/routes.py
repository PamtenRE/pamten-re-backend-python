# backend/routes.py
from flask import Blueprint, request, jsonify, send_file, current_app
import io
import time
import traceback
import os
import re
import google.generativeai as genai


# Absolute imports so `python app.py` on Render works from the backend folder root
from document_generator import generate_docx_from_data, generate_pdf_from_data
from file_parser import parse_resume_file
from gemini_utils import generate_elevator_pitch  # your Gemini helper

# Create a Blueprint for API routes
api_bp = Blueprint("api", __name__)

def _strip_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def _build_summary_context(parsed: dict) -> str:
    """Flatten parsed resume dict into concise text for Gemini."""
    parts = []

    # Experience
    exp_lines = []
    for e in (parsed.get("experience") or []):
        title = (e.get("jobTitle") or "").strip()
        company = (e.get("company") or "").strip()
        dates = (e.get("dates") or "").strip()
        desc = _strip_html(e.get("description") or "")
        head = " - ".join([p for p in [f"{title} at {company}".strip(" at "), dates] if p])
        line = (head + (": " if head and desc else "") + desc).strip()
        if line:
            exp_lines.append(line)
    if exp_lines:
        parts.append("Experience:\n" + "\n".join(exp_lines[:8]))

    # Skills
    skills = ", ".join(
        (c.get("skills_list") or "").strip()
        for c in (parsed.get("skills") or [])
        if (c.get("skills_list") or "").strip()
    )
    if skills:
        parts.append("Skills:\n" + skills)

    # Education
    edu_lines = []
    for ed in (parsed.get("education") or []):
        degree = (ed.get("degree") or "").strip()
        inst = (ed.get("institution") or "").strip()
        year = (ed.get("graduationYear") or "").strip()
        edu_lines.append(" ".join(v for v in [degree, "—", inst, year] if v))
    if edu_lines:
        parts.append("Education:\n" + "; ".join(edu_lines))

    return "\n\n".join(parts).strip()

def _generate_summary_with_gemini(context: str) -> str:
    """Return a single-paragraph HTML summary (<p>…</p>) or '' on failure.
       Logs detailed info so we can see why it failed."""
    if not context:
        current_app.logger.warning("[summary] Empty context passed to Gemini")
        return ""

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        current_app.logger.warning("[summary] GEMINI_API_KEY missing")
        return ""

    try:
        import google.generativeai as genai
        # Optional: unblock over-strict safety filters that can silently drop output
        try:
            from google.generativeai.types import HarmCategory, HarmBlockThreshold
            safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }
        except Exception:
            safety_settings = None

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""
You are an expert resume writer.
Using ONLY the data below, write a concise, high-impact professional summary for a resume.

Requirements:
- 3–4 sentences, single paragraph, 70–100 words.
- Third-person tone (no "I", "my").
- Focus on role/impact, core skills, tools, domains, and strengths.
- No headings, bullets, or markdown.

Candidate data:
{context}
""".strip()

        kwargs = {"safety_settings": safety_settings} if safety_settings else {}
        resp = model.generate_content(prompt, **kwargs)

        txt = getattr(resp, "text", "") or ""
        if txt.strip():
            return f"<p>{txt.strip()}</p>"

        # Log why it was empty
        pf = getattr(resp, "prompt_feedback", None)
        cands = getattr(resp, "candidates", None)
        current_app.logger.warning(
            f"[summary] Empty Gemini response. prompt_feedback={pf}, candidates_len={len(cands or [])}"
        )
        return ""
    except Exception as e:
        current_app.logger.exception(f"[summary] Gemini call failed: {e}")
        return ""



# -----------------------------
# Resume Parsing Endpoint
# -----------------------------
@api_bp.route("/parse-resume", methods=["POST"])
@api_bp.route("/parse-resume", methods=["POST"])
def parse_resume_route():
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        result = parse_resume_file(file)
        if isinstance(result, dict) and "error" in result:
            return jsonify(result), 500

        # ---------------------------
        # Generate summary if missing
        # ---------------------------
        try:
            if not isinstance(result, dict):
                current_app.logger.info("[parse-resume] result is not a dict — skipping summary generation")
                return jsonify(result), 200

            parsed = result.get("parsedData") or {}
            if not isinstance(parsed, dict):
                current_app.logger.info("[parse-resume] result['parsedData'] not a dict — skipping summary generation")
                return jsonify(result), 200

            raw_summary = (parsed.get("summary") or "").strip()
            # Also treat common “empty HTML” as empty
            empty_htmls = {"<p></p>", "<p> </p>", "<p><br></p>", "<p>&nbsp;</p>"}
            is_empty = (raw_summary == "") or (raw_summary.lower() in empty_htmls)

            current_app.logger.info(f"[parse-resume] summary present? {not is_empty}; length={len(raw_summary)}")

            if is_empty:
                # Build context from parsed resume and call Gemini
                ctx = _build_summary_context(parsed)
                current_app.logger.info(
                    f"[parse-resume] built context chars={len(ctx)}; "
                    f"GEMINI_API_KEY set? {bool(os.environ.get('GEMINI_API_KEY'))}"
                )

                gen_summary = _generate_summary_with_gemini(ctx)
                if gen_summary:
                    parsed["summary"] = gen_summary
                    current_app.logger.info("[parse-resume] summary generated via Gemini ✅")
                else:
                    current_app.logger.warning("[parse-resume] Gemini returned empty summary or failed ⚠️")

                    # ---------------------------
                    # Fallback summary (never blank)
                    # ---------------------------
                    title = company = ""
                    if (parsed.get("experience") or []):
                        first = parsed["experience"][0] or {}
                        title = (first.get("jobTitle") or "").strip()
                        company = (first.get("company") or "").strip()

                    # Flatten skills
                    skills_flat = ", ".join(
                        (c.get("skills_list") or "").strip()
                        for c in (parsed.get("skills") or [])
                        if (c.get("skills_list") or "").strip()
                    )
                    # Keep it readable (trim extremely long skills lists)
                    if len(skills_flat) > 180:
                        skills_flat = skills_flat[:177].rstrip(",; ") + "…"

                    bits = []
                    if title or company:
                        role = " ".join([v for v in [title, "at", company] if v])
                        bits.append(role)
                    if skills_flat:
                        bits.append(f"skills in {skills_flat}")

                    if bits:
                        fallback = "Experienced professional " + " with ".join(bits) + "."
                        parsed["summary"] = f"<p>{fallback}</p>"
                        current_app.logger.info("[parse-resume] summary populated via fallback ✅")
                    else:
                        current_app.logger.info("[parse-resume] no data to build fallback summary")
                # write back parsed in either case
                result["parsedData"] = parsed

        except Exception as inner_e:
            current_app.logger.exception(f"[parse-resume] summary-generation block crashed: {inner_e}")

        return jsonify(result), 200

    except Exception:
        current_app.logger.error(
            "Unexpected error in /api/parse-resume:\n%s", traceback.format_exc()
        )
        return jsonify({"error": "INTERNAL_PARSE_ERROR"}), 500




# -----------------------------
# DOCX Generation Endpoint
# -----------------------------
@api_bp.route("/generate-docx", methods=["POST"])
def generate_docx_route():
    try:
        # Force JSON so we fail fast with clear error when body isn't JSON
        payload = request.get_json(force=True, silent=False) or {}
        # Our generator already returns a BytesIO ready for send_file
        buf = generate_docx_from_data(payload)

        # File name: prefer name from payload, fallback with timestamp
        personal = payload.get("personal", {}) if isinstance(payload, dict) else {}
        base = (personal.get("name") or "resume").strip() or "resume"
        safe_base = "_".join(base.split())
        filename = f"{safe_base}.docx"

        return send_file(
            buf,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception:
        current_app.logger.error(
            "DOCX generation failed:\n%s", traceback.format_exc()
        )
        return jsonify({"error": "DOCX_GENERATION_FAILED"}), 500


# -----------------------------
# PDF Generation Endpoint
# -----------------------------
@api_bp.route("/generate-pdf", methods=["POST"])
def generate_pdf_route():
    try:
        payload = request.get_json(force=True, silent=False) or {}
        pdf_bytes = generate_pdf_from_data(payload)

        personal = payload.get("personal", {}) if isinstance(payload, dict) else {}
        base = (personal.get("name") or "resume").strip() or "resume"
        safe_base = "_".join(base.split())
        filename = f"{safe_base}.pdf"

        return send_file(
            io.BytesIO(pdf_bytes),
            as_attachment=True,
            download_name=filename,
            mimetype="application/pdf",
        )
    except Exception:
        current_app.logger.error(
            "PDF generation failed:\n%s", traceback.format_exc()
        )
        return jsonify({"error": "PDF_GENERATION_FAILED"}), 500


# -----------------------------
# Elevator Pitch Endpoint
# -----------------------------
@api_bp.route("/generate-elevator-pitch", methods=["POST"])
def generate_elevator_pitch_route():
    try:
        payload = request.get_json(force=True, silent=False) or {}

        # Accept { "resumeData": ... }, { "parsedData": ... } or the raw object
        resume_data = payload.get("resumeData") or payload.get("parsedData") or payload

        if not isinstance(resume_data, dict) or not resume_data:
            return jsonify({"error": "Missing or invalid resume data"}), 400

        pitch = generate_elevator_pitch(resume_data)
        pitch_text = pitch if isinstance(pitch, str) else ""

        return jsonify({"elevatorPitch": pitch_text}), 200
    except Exception:
        current_app.logger.error(
            "Elevator pitch generation failed:\n%s", traceback.format_exc()
        )
        return jsonify({"error": "ELEVATOR_PITCH_FAILED"}), 500

# -----------------------------
# Enhance Section Endpoint
# -----------------------------
@api_bp.route("/enhance-section", methods=["POST"])
def enhance_section_route():
    from gemini_utils import enhance_section_with_ai  # local import to avoid cycles

    try:
        payload = request.get_json(force=True, silent=False) or {}
        section_name = payload.get("sectionName", "").strip()
        text_to_enhance = payload.get("textToEnhance", "")

        if not section_name or not isinstance(text_to_enhance, str) or not text_to_enhance.strip():
            return jsonify({"error": "INVALID_INPUT"}), 400

        versions = enhance_section_with_ai(section_name, text_to_enhance)

        # Ensure the exact shape the frontend expects
        if not isinstance(versions, list) or not versions:
            return jsonify({"error": "ENHANCER_RETURNED_EMPTY"}), 502

        return jsonify({"enhancedVersions": versions}), 200

    except Exception:
        current_app.logger.exception("Error in /api/enhance-section")
        return jsonify({"error": "ENHANCE_FAILED"}), 500
    
    

