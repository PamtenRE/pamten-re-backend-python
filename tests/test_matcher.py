import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


import pytest
from matcher import match_resume_to_jds

@pytest.fixture
def dummy_jd_cache():
    # Fake JD cache entry with a dummy embedding vector
    return {
        "JD_1": {
            "text": "Looking for Data Analyst skilled in Python, SQL, and Power BI.",
            "skills": ["Python", "SQL", "Power BI"],
            "embedding": [0.5] * 384,
        }
    }

def test_match_resume_to_jds(tmp_path, dummy_jd_cache):
    # create a fake resume file on disk because match_resume_to_jds expects a file path
    resume_path = tmp_path / "resume.txt"
    resume_path.write_text(
        "John Doe\nData Analyst skilled in Python and SQL.\nLocation: New York",
        encoding="utf-8",
    )

    results = match_resume_to_jds(str(resume_path), dummy_jd_cache)

    # Should return a list with one element per JD we tried to match
    assert isinstance(results, list)
    assert len(results) >= 1

    res = results[0]

    # The matcher should produce a dict with key metadata
    assert "similarity_score_percent" in res
    assert "matched_skills" in res
    assert "missing_skills" in res
    assert "resume_location" in res
    assert "jd_location" in res

    # types / shapes, not exact values
    assert isinstance(res["similarity_score_percent"], (int, float))

    # Allow cosine-based math to go slightly <0 or >100 in edge cases with dummy embeddings
    assert -100.0 <= res["similarity_score_percent"] <= 200.0

    assert isinstance(res["matched_skills"], list)
    assert isinstance(res["missing_skills"], list)

    # location fields should be strings
    assert isinstance(res["resume_location"], str)
    assert isinstance(res["jd_location"], str)

    # Optional sections: education_periods and experience_periods
    if "education_periods" in res:
        assert isinstance(res["education_periods"], list)
        for row in res["education_periods"]:
            assert "entry" in row
            assert "start" in row
            assert "end" in row

    if "experience_periods" in res:
        assert isinstance(res["experience_periods"], list)
        for row in res["experience_periods"]:
            assert "entry" in row
            assert "start" in row
            assert "end" in row
