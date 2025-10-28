import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import os
import pytest
from extractors import extract_text, extract_resume_data, normalize_skills

@pytest.fixture
def sample_resume_text():
    return """
    John Doe
    Data Analyst
    Skills: Python, SQL, Tableau, Power BI
    Education:
    Bachelor of Technology in Computer Science - ABC University (2016 - 2020)
    Work Experience:
    Data Analyst at XYZ Solutions (Jul 2020 - Present)
    """

def test_extract_resume_data(sample_resume_text):
    skills, edu, exp, edu_gaps, exp_gaps, edu_to_exp = extract_resume_data(sample_resume_text)

    # basic shape checks
    assert isinstance(skills, list)
    assert isinstance(edu, list)
    assert isinstance(exp, list)
    assert isinstance(edu_gaps, list)
    assert isinstance(exp_gaps, list)
    assert (edu_to_exp is None) or isinstance(edu_to_exp, int)

    # we expect at least something was extracted as skills
    # (may be noisy, but should not be empty)
    assert len(skills) > 0

def test_normalize_skills(sample_resume_text):
    skills, *_ = extract_resume_data(sample_resume_text)
    norm = normalize_skills(skills)

    assert isinstance(norm, set)
    assert len(norm) > 0

    # all entries in normalized set should be lowercase strings with no leading/trailing spaces
    for s in norm:
        assert isinstance(s, str)
        assert s.strip() == s
        assert s == s.lower()

def test_extract_text(tmp_path):
    """Ensure text extraction from a simple text file works."""
    file_path = tmp_path / "resume.txt"
    file_path.write_text("Sample Resume Content", encoding="utf-8")
    content = extract_text(str(file_path))
    assert "Sample" in content
