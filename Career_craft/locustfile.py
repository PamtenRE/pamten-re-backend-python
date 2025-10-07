# locustfile.py
import io, os
from locust import HttpUser, task, between, tag

def doc_payload():
    return {
        "personal": {
            "name": "Load Test",
            "email": "load@test.com",
            "phone": "555-5555",
            "location": "US",
            "legalStatus": "US Citizen",
        },
        "summary": "<strong>Automation</strong> focused engineer. <em>Testing</em> load.",
        "styleOptions": {"fontFamily": "Calibri", "fontSize": 11, "accentColor": "#34495e"},
        "experience": [
            {
                "jobTitle": "Software Engineer",
                "company": "ACME",
                "dates": "2023–2025",
                "description": "Built APIs and <strong>automated</strong> workflows.",
            }
        ],
        "skills": [
            {"category": "Languages", "skills_list": "Python, JS, SQL"},
            {"category": "Tools", "skills_list": "Flask, React, Vercel, Render"},
        ],
    }

class RecruitEdgeUser(HttpUser):
    wait_time = between(1, 3)

    # Global Locust HTTP timeouts (apply to every request unless overridden)
    connection_timeout = 300   # seconds (TCP connect / TLS handshake)
    network_timeout = 300      # seconds (read/response timeout)

    def on_start(self):
        # Prefer DOCX if present; else PDF; else tiny fake PDF
        if os.path.exists("sample_resume.docx"):
            self.upload_name = "sample_resume.docx"
            self.upload_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            with open(self.upload_name, "rb") as f:
                self.resume_bytes = f.read()
        elif os.path.exists("resume.pdf"):
            self.upload_name = "resume.pdf"
            self.upload_mime = "application/pdf"
            with open(self.upload_name, "rb") as f:
                self.resume_bytes = f.read()
        else:
            self.upload_name = "resume.pdf"
            self.upload_mime = "application/pdf"
            self.resume_bytes = b"%PDF-1.4\n%minimal"

    @tag("docx")
    @task(3)
    def generate_docx(self):
        with self.client.post(
            "/api/generate-docx",
            json=doc_payload(),
            name="/generate-docx",
            timeout=300,            # per-call override (kept high)
            catch_response=True,
        ) as resp:
            if resp.status_code != 200 or int(resp.headers.get("Content-Length", "0")) == 0:
                resp.failure(f"Bad status/empty body: {resp.status_code}")

    @tag("pdf")
    @task(1)
    def generate_pdf(self):
        with self.client.post(
            "/api/generate-pdf",
            json=doc_payload(),
            name="/generate-pdf",
            timeout=300,
            catch_response=True,
        ) as resp:
            if resp.status_code != 200 or int(resp.headers.get("Content-Length", "0")) == 0:
                resp.failure(f"Bad status/empty body: {resp.status_code}")

    @tag("parse")
    @task(1)
    def parse_resume(self):
        files = {"file": (self.upload_name, io.BytesIO(self.resume_bytes), self.upload_mime)}
        with self.client.post(
            "/api/parse-resume",
            files=files,
            name="/parse-resume",
            timeout=300,
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Bad status: {resp.status_code}")
