Pamten RE Backend (Python – Flask)

![Tests](https://github.com/PamtenRE/pamten-re-backend-python/actions/workflows/tests.yml/badge.svg)

**Author**

Rachana Vallapalli
vallepallirachana@gmail.com

Pamten Resume–Job Matching Backend is an intelligent backend service for a job portal system that automates the process of parsing resumes, analyzing job descriptions, and generating detailed match reports between candidates and job postings.  
Built with **Python (Flask)**, it leverages **NLP**, **skill extraction**, and **semantic similarity** models to power smart candidate–job matching.

---

Overview

This backend provides REST APIs and modular services to:
- Upload and parse **resumes** (PDF, DOCX, TXT)
- Parse and cache **job descriptions**
- Perform **resume–JD matching** using NLP and semantic similarity
- Extract and compare **skills**, **experience**, and **education**
- Store results with **match scores**, **matched/missing skills**, and **metadata**
- Provide structured data for analytics dashboards and reports

---

Project Structure

pamten-re-backend-python/
│
├── app_main.py # Entry point for running the Flask app
├── extractors.py # Handles parsing & NLP-based extraction from resumes and JDs
├── matcher.py # Core resume–JD matching logic (keyword + semantic)
├── jd_cache.py # Job description caching layer for performance
├── skill_db_relax_20.json # Skill taxonomy & synonym database
├── token_dist.json # Token distribution / analytics reference
│
├── uploads/ # Uploaded resumes and job descriptions
├── _uploads/ # Temporary upload storage (staging)
│
├── requirements.txt # Python dependencies
└── README.md # Project documentation

---

**Core Features**

**Resume Parsing**
- Extracts text from **PDF/DOCX** using OCR and NLP.
- Identifies **name, email, phone, education, experience**, and **skills**.

**Job Description Analysis**
- Tokenizes and stores JDs with structured skill and responsibility data.
- Supports caching via `jd_cache.py` for reuse across matches.

**Skill Extraction & Matching**
- Uses a predefined database (`skill_db_relax_20.json`) with fuzzy and semantic matching.
- Combines keyword, contextual, and embedding-based similarity.

**Matching Engine**
- Computes:
  - Overall Match Score
  - Matched Skills
  - Missing / Partially Matched Skills
  - Location & Experience Compatibility
- Supports multiple similarity models (Cosine, BERT, or TF-IDF).

**Output**
Structured JSON results with:
```json
{
  "resume_id": "R101",
  "job_id": "J202",
  "match_score": 82.5,
  "matched_skills": ["Python", "SQL", "Power BI"],
  "missing_skills": ["Tableau", "Azure"],
  "comments": "Good Python/SQL background; missing BI visualization tools."
}

**Installation & Setup**
1️⃣ Clone the repository
git clone https://github.com/PamtenRE/pamten-re-backend-python.git
cd pamten-re-backend-python

2️⃣ Create a virtual environment
python -m venv venv
source venv/bin/activate  # For Mac/Linux
venv\Scripts\activate     # For Windows

3️⃣ Install dependencies
pip install -r requirements.txt

4️⃣ Run the backend (Flask)
python app_main.py


Then open your browser at:

http://localhost:5000/

API Endpoints (Example)
Endpoint	Method	Description
/uploadResume	POST	Upload a candidate resume
/uploadJD	POST	Upload a job description
/match	POST	Match uploaded resume(s) with job description(s)
/results/<match_id>	GET	Retrieve match results
/skills	GET	Get available skill taxonomy

Test APIs using Postman, cURL, or integrate with your React frontend.

Technology Stack
Layer	Technology
Backend Framework	Flask
Language	Python 3.9+
NLP Libraries	spaCy, scikit-learn, sentence-transformers
Data Storage	MySQL / PostgreSQL
Caching	Redis / Local JSON cache
Cloud & Deployment	Azure / AWS (planned)

Example Matching Flow
flowchart TD
    A[Resume Upload] --> B[Resume Parser]
    B --> C[Skill Extractor]
    D[Job Description Upload] --> E[JD Parser]
    E --> F[JD Cache]
    C --> G[Matcher Engine]
    F --> G
    G --> H[Match Results JSON / DB Storage]

**Future Enhancements**

 Database integration for match history & analytics

 Embedding-based similarity with BERT / Sentence Transformers

 Frontend integration with React job portal

 REST → GraphQL upgrade for flexible querying

 Role-based user management (Admin / Recruiter / Candidate)

 Azure with CI/CD




