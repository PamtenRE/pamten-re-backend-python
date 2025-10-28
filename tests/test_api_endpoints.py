import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import io
import pytest
from fastapi.testclient import TestClient
from app_main import app

client = TestClient(app)

def test_index_page():
    response = client.get("/")
    assert response.status_code == 200
    assert "html" in response.headers.get("content-type", "")

def test_upload_endpoint_with_minimal_data(tmp_path):
    """Simulate a resume upload with no JD files."""
    resume_file = tmp_path / "resume.txt"
    resume_file.write_text("Python developer with 3 years experience", encoding="utf-8")

    with open(resume_file, "rb") as f:
        response = client.post(
            "/upload",
            files={"resume": ("resume.txt", f, "text/plain")},
        )
    assert response.status_code in (200, 400)
    assert "html" in response.headers.get("content-type", "")

def test_download_csv_endpoint(tmp_path):
    resume_file = tmp_path / "resume.txt"
    resume_file.write_text("Python developer experienced in SQL and Power BI", encoding="utf-8")

    with open(resume_file, "rb") as f:
        response = client.post(
            "/download_csv",
            files={"resume": ("resume.txt", f, "text/plain")},
        )
    assert response.status_code in (200, 400)
    if response.status_code == 200:
        assert response.headers["content-type"].startswith("text/csv")
