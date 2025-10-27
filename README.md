# Pamten RE Backend (Python - Flask)

![Tests](https://github.com/PamtenRE/pamten-re-backend-python/actions/workflows/tests.yml/badge.svg)

## Overview

This is the backend service for **Pamten Resume Matcher**, a Flask-based API designed to:
- Parse resumes using NLP and extract key skills, education, and experience.
- Match resumes with job descriptions (JDs) using semantic similarity and skill overlap.
- Provide endpoints for uploading resumes, retrieving matches, and downloading CSV reports.

---

##  Author
**Rachana Vallapalli**  
[vallepallirachana@gmail.com](mailto:vallepallirachana@gmail.com)

---

## Tech Stack

- **Framework**: Flask  
- **Language**: Python 3.11+  
- **NLP Libraries**: spaCy, Sentence-Transformers  
- **Testing**: Pytest  
- **CI/CD**: GitHub Actions  
- **Data Handling**: Pandas, JSON  

---

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/PamtenRE/pamten-re-backend-python.git
cd pamten-re-backend-python
python -m venv venv
venv\Scripts\activate  # on Windows
pip install -r requirements.txt

Running the Application
bash
Copy code
python app_main.py
Your Flask API will start on http://127.0.0.1:5000/

Running Tests
To run all tests locally:

bash
Copy code
pytest -v
GitHub Actions automatically runs these tests on every push or pull request.

Project Structure
bash
Copy code
pamten-re-backend-python/
│
├── app_main.py              # Main Flask app entry point
├── extractors.py            # Resume parsing and skill extraction
├── matcher.py               # Resume-to-JD matching logic
├── jd_cache.py              # Job description caching helper
│
├── tests/                   # Automated pytest suite
│   ├── test_extractor.py
│   ├── test_matcher.py
│   └── test_api_endpoints.py
│
├── requirements.txt         # Python dependencies
├── pytest.ini               # Pytest configuration
└── .github/workflows/tests.yml  # CI workflow

API Endpoints
Method	Endpoint	Description
GET	/	Health check
POST	/upload	Upload resume & job description for matching
GET	/download_csv	Download all results as CSV

CI/CD Integration
This project uses GitHub Actions for Continuous Integration.
Each push or pull request runs:

bash
Copy code
pytest -v
A live badge (top of this README) shows test status automatically.

License
This project is proprietary and maintained by Pamten RE.
All rights reserved © 2025.