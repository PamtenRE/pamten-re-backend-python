from pathlib import Path
from typing import Dict, List, Tuple
import os, tempfile

import fitz  # PyMuPDF
import docx2txt

from extractors import extract_text, extract_skills
from functools import lru_cache

@lru_cache(maxsize=1)
def _sbert():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")

def build_jd_cache(jd_dir: str, cache_path: str) -> Dict[str, dict]:
    jd_dir = Path(jd_dir)
    cache: Dict[str, dict] = {}
    for p in jd_dir.glob("**/*"):
        if not p.is_file(): continue
        if p.suffix.lower() not in {".txt", ".pdf", ".docx"}: continue
        try:
            text = extract_text(str(p))
            skills = extract_skills(text) or []
            emb = _sbert().encode(text, convert_to_tensor=True).tolist()
            cache[p.name] = {"text": text, "skills": skills, "embedding": emb}
        except Exception:
            continue
    Path(cache_path).parent.mkdir(parents=True, exist_ok=True)
    Path(cache_path).write_text("{}")
    return cache

def load_or_build_jd_cache(jd_dir: str, cache_path: str) -> Dict[str, dict]:
    return build_jd_cache(jd_dir, cache_path)

def _text_from_bytes(name: str, raw: bytes) -> str:
    ext = name.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        with fitz.open(stream=raw, filetype="pdf") as doc:
            return "\n".join(page.get_text("text") for page in doc)
    if ext == "docx":
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            tmp.write(raw); tmp.flush(); path = tmp.name
        try:
            return docx2txt.process(path) or ""
        finally:
            try: os.remove(path)
            except Exception: pass
    return raw.decode("utf-8", errors="ignore")

def build_jd_cache_from_uploads(named_bytes: List[Tuple[str, bytes]]) -> Dict[str, dict]:
    cache: Dict[str, dict] = {}
    for name, raw in named_bytes:
        text = _text_from_bytes(name, raw)
        skills = extract_skills(text) or []
        emb = _sbert().encode(text, convert_to_tensor=True).tolist()
        cache[name] = {"text": text, "skills": skills, "embedding": emb}
    return cache
