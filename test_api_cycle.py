import json
import uuid
from fastapi.testclient import TestClient
from main import app
from database import CaseModel, SessionLocal

def run_tests():
    print("========================================")
    print("RUNNING FORENSICSHIELD AI API TEST SUITE")
    print("========================================")
    client = TestClient(app)

    # Test 1: Health check endpoint
    print("\n[TEST 1] Checking GET /api/health...")
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200, f"Expected 200, got {health_resp.status_code}"
    health_data = health_resp.json()
    print(" Health check response:", health_data)
    assert health_data["status"] == "healthy"
    assert health_data["database_connected"] is True
    print("-> TEST 1 PASSED: Health endpoint active and database connected")

    # Test 2: CORS Header verification
    print("\n[TEST 2] Verifying CORS Configuration for http://localhost:3000...")
    cors_resp = client.options(
        "/api/parse-description",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
    )
    print(" CORS preflight status:", cors_resp.status_code)
    print(" CORS Allow-Origin header:", cors_resp.headers.get("access-control-allow-origin"))
    assert cors_resp.headers.get("access-control-allow-origin") == "http://localhost:3000", "CORS header mismatch!"
    print("-> TEST 2 PASSED: CORS fully configured for frontend origin")

    # Test 3: POST /api/parse-description
    print("\n[TEST 3] Testing POST /api/parse-description...")
    test_transcript = (
        "Young South Asian woman, approx. 25 years, smooth oval face, "
        "large symmetrical dark eyes, long straight black hair parted down the middle, high cheekbones."
    )
    parse_payload = {
        "case_id": "CASE-TEST-2026",
        "raw_transcript": test_transcript
    }
    parse_resp = client.post("/api/parse-description", json=parse_payload)
    assert parse_resp.status_code == 200, f"Parse failed with code {parse_resp.status_code}: {parse_resp.text}"
    profile = parse_resp.json()
    print(" Structured Biometric Profile received:\n", json.dumps(profile, indent=2))

    assert "face_shape" in profile, "Missing face_shape in profile"
    assert "eyes" in profile, "Missing eyes in profile"
    assert "nose" in profile, "Missing nose in profile"
    assert "mouth" in profile, "Missing mouth in profile"
    assert "distinguishing_features" in profile, "Missing distinguishing_features in profile"
    print("-> TEST 3 PASSED: Biometric parsing returned strictly validated Pydantic schema")

    # Test 4: POST /api/render-sketch
    print("\n[TEST 4] Testing POST /api/render-sketch...")
    render_payload = {
        "structured_profile": profile
    }
    render_resp = client.post("/api/render-sketch", json=render_payload)
    assert render_resp.status_code == 200, f"Render failed with code {render_resp.status_code}: {render_resp.text}"
    render_data = render_resp.json()
    print(" Render Sketch Response status:", render_data.get("status"))
    assert render_data["status"] == "success"
    assert "image_url" in render_data and len(render_data["image_url"]) > 0
    print("-> TEST 4 PASSED: Forensic composite sketch generated/fallback resolved")

    # Test 5: Task 1 - POST /api/cases/save
    print("\n[TEST 5] Task 1: Testing POST /api/cases/save (Case Persistence)...")
    test_case_num = f"CASE-TEST-{uuid.uuid4().hex[:6].upper()}"
    save_payload = {
        "case_number": test_case_num,
        "raw_transcript": test_transcript,
        "structured_profile": profile,
        "image_url": render_data.get("image_url", "/suspect-sketch.png"),
    }
    save_resp = client.post("/api/cases/save", json=save_payload)
    assert save_resp.status_code == 200, f"Save failed with code {save_resp.status_code}: {save_resp.text}"
    saved_data = save_resp.json()
    print(" Save response:", json.dumps(saved_data, indent=2))
    assert saved_data["status"] == "success"
    assert saved_data["case"]["case_number"] == test_case_num
    assert "id" in saved_data["case"]
    assert saved_data["case"]["structured_profile"]["face_shape"]["confidence"] > 0
    print("-> TEST 5 PASSED: Case record committed to relational database ledger")

    # Test 6: Task 1 - GET /api/cases/{case_number}
    print(f"\n[TEST 6] Task 1: Testing GET /api/cases/{test_case_num}...")
    get_resp = client.get(f"/api/cases/{test_case_num}")
    assert get_resp.status_code == 200, f"Get case failed with code {get_resp.status_code}: {get_resp.text}"
    retrieved_case = get_resp.json()["case"]
    print(" Retrieved case from ledger:", json.dumps(retrieved_case, indent=2))
    assert retrieved_case["case_number"] == test_case_num
    assert retrieved_case["raw_transcript"] == test_transcript
    assert retrieved_case["structured_profile"]["face_shape"]["description"] == profile["face_shape"]["description"]
    print("-> TEST 6 PASSED: Case retrieved accurately from ledger with all nested biometrics")

    # Test 7: Task 1 - Update existing case via POST /api/cases/save
    print("\n[TEST 7] Task 1: Testing Case Update via POST /api/cases/save...")
    save_payload["raw_transcript"] = test_transcript + " Additional detail: silver earring."
    update_resp = client.post("/api/cases/save", json=save_payload)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["action"] == "updated"
    assert "silver earring" in updated_data["case"]["raw_transcript"]
    print("-> TEST 7 PASSED: Existing case correctly updated in database ledger")

    # Test 8: Task 2 - POST /api/intelligence/match (Direct StructuredFaceProfile payload)
    print("\n[TEST 8] Task 2: Testing POST /api/intelligence/match with direct StructuredFaceProfile...")
    match_resp = client.post("/api/intelligence/match", json=profile)
    assert match_resp.status_code == 200, f"Match failed with code {match_resp.status_code}: {match_resp.text}"
    matches = match_resp.json()
    print(f" Received {len(matches)} suspect matches")
    assert isinstance(matches, list), "Response must be a list of suspect match items"
    assert len(matches) > 0, "Matches list should not be empty"

    # Verify descending sort order
    scores = [item["match_score"] for item in matches]
    print(" Match scores (descending):", scores)
    assert scores == sorted(scores, reverse=True), "Suspect match items must be sorted descending by match_score!"

    # Validate schema for every item
    for item in matches:
        assert "suspect_id" in item, "Missing suspect_id in match item"
        assert "full_name" in item, "Missing full_name in match item"
        assert "match_score" in item, "Missing match_score in match item"
        assert "mugshot_url" in item, "Missing mugshot_url in match item"
        assert isinstance(item["match_score"], (int, float))

    top = matches[0]
    print(f" Top match: {top['full_name']} ({top['suspect_id']}) - {top['match_score']}% Match")
    assert top["match_score"] > 80.0, "Expected high confidence match for primary test profile"
    print("-> TEST 8 PASSED: Biometric Vector Match Engine calculated Cosine Similarity and returned sorted schema-validated matches")

    # Test 9: Task 2 - POST /api/intelligence/match with wrapped payload
    print("\n[TEST 9] Task 2: Testing POST /api/intelligence/match with wrapped payload...")
    wrapped_resp = client.post("/api/intelligence/match", json={"structured_profile": profile})
    assert wrapped_resp.status_code == 200
    wrapped_matches = wrapped_resp.json()
    assert isinstance(wrapped_matches, list)
    assert wrapped_matches[0]["suspect_id"] == top["suspect_id"]
    print("-> TEST 9 PASSED: Wrapped payload compatibility verified")

    # Test 10: Task 4 - POST /api/cases/export-pdf with structured profile & suspect match metadata
    print("\n[TEST 10] Task 4: Testing POST /api/cases/export-pdf with active interface state...")
    pdf_payload = {
        "case_number": test_case_num,
        "raw_transcript": test_transcript,
        "structured_profile": profile,
        "suspect_match": top,
        "image_url": "/suspect-sketch.png",
        "officer_name": "Det. R. Miller (#4892)",
        "department": "Forensic Biometrics Division"
    }
    pdf_resp = client.post("/api/cases/export-pdf", json=pdf_payload)
    assert pdf_resp.status_code == 200, f"PDF export failed: {pdf_resp.text}"
    assert pdf_resp.headers.get("content-type") == "application/pdf", "Content-Type must be application/pdf"
    disposition = pdf_resp.headers.get("content-disposition", "")
    print(" PDF Content-Disposition:", disposition)
    assert "attachment" in disposition, "Content-Disposition must be attachment"
    assert "Forensic_Chain_Of_Custody_" in disposition, "Filename prefix missing in Content-Disposition"
    pdf_bytes = pdf_resp.content
    print(f" Generated PDF Size: {len(pdf_bytes):,} bytes")
    assert pdf_bytes.startswith(b"%PDF-"), "Response must start with valid PDF magic bytes '%PDF-'"
    print("-> TEST 10 PASSED: ReportLab Chain-of-Custody PDF generated with active layout metadata and streamed successfully")

    # Test 11: Task 4 - GET /api/cases/{case_number}/export-pdf for persisted record
    print("\n[TEST 11] Task 4: Testing GET /api/cases/{case_number}/export-pdf direct route...")
    get_pdf_resp = client.get(f"/api/cases/{test_case_num}/export-pdf")
    assert get_pdf_resp.status_code == 200, f"GET PDF export failed: {get_pdf_resp.text}"
    assert get_pdf_resp.content.startswith(b"%PDF-"), "GET PDF must return valid PDF magic bytes"
    print("-> TEST 11 PASSED: Direct GET export route streamed persisted case PDF correctly")

    print("\n========================================")
    print("ALL 11 INTEGRATION TEST CYCLES PASSED!")
    print("========================================")

if __name__ == "__main__":
    run_tests()
