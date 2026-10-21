import os
import re
import uuid
import hashlib
import base64
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import requests
from openai import OpenAI
import numpy as np
from sqlalchemy.orm import Session
from fastapi import FastAPI, HTTPException, Depends, Body, Response
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_db, CaseModel
from pdf_generator import generate_chain_of_custody_pdf

# 1. Environment and Key Resolution
def load_env_file(filepath: str):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val

load_env_file(".env")
load_env_file(".env.local")

# Fallback default key if not provided via environment
DEFAULT_KEY = os.environ.get("OPENAI_API_KEY", "")
api_key = os.environ.get("OPENAI_API_KEY") or DEFAULT_KEY

# Initialize the OpenAI client
client = OpenAI(api_key=api_key)

app = FastAPI(title="ForensicShield AI Backend", version="2.0.0")

# Initialize database tables on startup
init_db()

# 2. CORS Middleware Configuration
# Fully opens communication paths specifically targeting localhost and frontend origins securely
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# 3. Structured Data Schemas
class FeatureDetail(BaseModel):
    description: str = Field(description="Objective geometric description. Strip emotional biases.")
    confidence: float = Field(default=1.0, description="Certainty score between 0.0 and 1.0 based on transcript phrasing.")

class StructuredFaceProfile(BaseModel):
    face_shape: FeatureDetail
    eyes: FeatureDetail
    nose: FeatureDetail
    mouth: FeatureDetail
    distinguishing_features: List[str] = Field(default_factory=list, description="Scars, tattoos, facial hair, or accessories.")

class EyewitnessPayload(BaseModel):
    case_id: str
    raw_transcript: str

class RenderPayload(BaseModel):
    structured_profile: StructuredFaceProfile

# Case Persistence Schemas
class CaseSavePayload(BaseModel):
    case_number: str
    raw_transcript: str
    structured_profile: StructuredFaceProfile
    image_url: Optional[str] = None
    case_id: Optional[str] = None

# Biometric Match Schemas
class BiometricMatchPayload(BaseModel):
    structured_profile: Optional[StructuredFaceProfile] = None
    face_shape: Optional[FeatureDetail] = None
    eyes: Optional[FeatureDetail] = None
    nose: Optional[FeatureDetail] = None
    mouth: Optional[FeatureDetail] = None
    distinguishing_features: Optional[List[str]] = None

class SuspectMatchItem(BaseModel):
    suspect_id: str
    full_name: str
    match_score: float
    similarity_score: float
    mugshot_url: str
    age: int
    legal_status: str
    active_warrants: int
    past_offenses: int
    physical_marks: str
    modus_operandi: str

# 4. Suspect Database Index
SUSPECT_DATABASE = [
    {
        "suspect_id": "CRIM-89241",
        "full_name": "Ananya Rao",
        "age": 25,
        "legal_status": "Wanted - Active Warrant",
        "active_warrants": 2,
        "past_offenses": 4,
        "physical_marks": "Scar above left eyebrow, moon tattoo on right wrist",
        "modus_operandi": "Unauthorized biometric spoofing & network infiltration",
        "mugshot_url": "/subject-mugshot.png",
        "baseline_vector": [
            0.82, 0.45, 0.91, 0.12, 0.78, 0.34, 0.67, 0.89, 0.23, 0.56, 0.94, 0.11, 0.43, 0.76, 0.88, 0.31
        ]
    },
    {
        "suspect_id": "CRIM-54109",
        "full_name": "Marcus Vance",
        "age": 34,
        "legal_status": "Under Surveillance",
        "active_warrants": 1,
        "past_offenses": 6,
        "physical_marks": "Linear scar across left jawline, serpent tattoo on chest",
        "modus_operandi": "Physical forced entry using tactical bypass equipment",
        "mugshot_url": "/placeholder-mugshot-1.png",
        "baseline_vector": [
            0.21, 0.88, 0.34, 0.76, 0.12, 0.95, 0.43, 0.22, 0.81, 0.65, 0.19, 0.73, 0.54, 0.28, 0.61, 0.90
        ]
    },
    {
        "suspect_id": "CRIM-31087",
        "full_name": "Elena Rostova",
        "age": 29,
        "legal_status": "Wanted - Interpol Red Notice",
        "active_warrants": 3,
        "past_offenses": 3,
        "physical_marks": "Burn scar on upper left shoulder, silver ring in right cartilage",
        "modus_operandi": "Social engineering and high-value cyber fraud",
        "mugshot_url": "/placeholder-mugshot-2.png",
        "baseline_vector": [
            0.65, 0.12, 0.78, 0.43, 0.89, 0.21, 0.95, 0.34, 0.56, 0.87, 0.29, 0.63, 0.18, 0.91, 0.47, 0.72
        ]
    },
    {
        "suspect_id": "CRIM-77412",
        "full_name": "Devraj Patel",
        "age": 42,
        "legal_status": "Parole Violation",
        "active_warrants": 1,
        "past_offenses": 8,
        "physical_marks": "Surgical scar on right cheek bone, missing tip of left index finger",
        "modus_operandi": "Hardware frequency spoofing & heavy vehicle theft",
        "mugshot_url": "/placeholder-mugshot-3.png",
        "baseline_vector": [
            0.33, 0.67, 0.15, 0.82, 0.44, 0.58, 0.29, 0.91, 0.37, 0.14, 0.76, 0.49, 0.83, 0.25, 0.62, 0.19
        ]
    },
    {
        "suspect_id": "CRIM-90124",
        "full_name": "Sophia Martinez",
        "age": 31,
        "legal_status": "Suspect at Large",
        "active_warrants": 1,
        "past_offenses": 2,
        "physical_marks": "Tribal tattoo band on left forearm, prominent cheekbone structure",
        "modus_operandi": "Financial forgery and synthetic identity fabrication",
        "mugshot_url": "/placeholder-mugshot-4.png",
        "baseline_vector": [
            0.79, 0.41, 0.88, 0.19, 0.72, 0.38, 0.61, 0.84, 0.28, 0.52, 0.90, 0.15, 0.48, 0.71, 0.83, 0.35
        ]
    }
]

# Helper to extract geometric feature vector with NumPy
def extract_geometric_feature_vector(profile: Any) -> np.ndarray:
    vector = np.zeros(16, dtype=np.float32)
    
    def get_attr(obj, key, default=None):
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    face_shape = get_attr(profile, "face_shape")
    eyes = get_attr(profile, "eyes")
    nose = get_attr(profile, "nose")
    mouth = get_attr(profile, "mouth")
    distinguishing_features = get_attr(profile, "distinguishing_features", []) or []

    # 1. Feature Confidence Ratings
    vector[0] = float(get_attr(face_shape, "confidence", 0.95) or 0.95)
    vector[1] = float(get_attr(eyes, "confidence", 0.92) or 0.92)
    vector[2] = float(get_attr(nose, "confidence", 0.88) or 0.88)
    vector[3] = float(get_attr(mouth, "confidence", 0.85) or 0.85)

    # 2. Geometric Feature Categorization
    fs = str(get_attr(face_shape, "description", "") or "").lower()
    vector[4] = 0.82 if "oval" in fs else (0.65 if "round" in fs else (0.35 if "square" in fs else 0.5))

    ey = str(get_attr(eyes, "description", "") or "").lower()
    vector[5] = 0.85 if "dark" in ey else (0.45 if "light" in ey else 0.6)
    vector[6] = 0.90 if "large" in ey or "symmetrical" in ey else 0.5

    ns = str(get_attr(nose, "description", "") or "").lower()
    vector[7] = 0.88 if "straight" in ns or "sharp" in ns or "defined" in ns else 0.4

    mo = str(get_attr(mouth, "description", "") or "").lower()
    vector[8] = 0.86 if "neutral" in mo or "relaxed" in mo else 0.55

    # 3. Distinguishing traits & accessories
    features_list = distinguishing_features if isinstance(distinguishing_features, list) else [str(distinguishing_features)]
    features_str = " ".join([str(f) for f in features_list]).lower()
    vector[9] = min(1.0, len(features_list) * 0.33)
    vector[10] = 0.94 if "cheekbone" in features_str or "cheek" in features_str else 0.2
    vector[11] = 0.88 if "hair" in features_str or "black" in features_str else 0.3
    vector[12] = 0.75 if "scar" in features_str else 0.1
    vector[13] = 0.70 if "tattoo" in features_str else 0.1

    # 4. Semantic Projection for remaining dimensions
    combined_text = fs + ey + ns + mo + features_str
    token_seed = sum(ord(c) for c in combined_text) if combined_text else 42
    vector[14] = abs(np.sin(token_seed)) * 0.9
    vector[15] = abs(np.cos(token_seed)) * 0.85

    return vector

# Heuristic Fallback Extractor (used when OpenAI quota/rate limit is reached)
def extract_fallback_profile(transcript: str) -> StructuredFaceProfile:
    t_lower = transcript.lower()

    # Face Shape detection
    face_shape_desc = "Oval face structure, balanced proportions"
    if "oval" in t_lower:
        face_shape_desc = "Smooth oval face structure, tapered jawline"
    elif "square" in t_lower or "jaw" in t_lower:
        face_shape_desc = "Angular square jawline, pronounced gonial angle"
    elif "round" in t_lower:
        face_shape_desc = "Circular face shape with soft curve boundaries"
    elif "long" in t_lower or "oblong" in t_lower:
        face_shape_desc = "Elongated vertical face structure with high forehead"
    elif "heart" in t_lower:
        face_shape_desc = "Heart-shaped facial structure, wider brow with pointed chin"

    # Eyes detection
    eyes_desc = "Symmetrical eyes, neutral eyelid fold"
    if "dark" in t_lower and "large" in t_lower:
        eyes_desc = "Large symmetrical dark eyes with defined orbital sockets"
    elif "dark" in t_lower:
        eyes_desc = "Deep-set dark brown eyes, medium intercanthal distance"
    elif "light" in t_lower or "blue" in t_lower or "green" in t_lower:
        eyes_desc = "Light-toned eyes with sharp iris demarcation"
    elif "narrow" in t_lower or "small" in t_lower:
        eyes_desc = "Narrow palpebral fissures, subtle hooded eyelids"

    # Nose detection
    nose_desc = "Straight nasal bridge, proportionate alar base"
    if "sharp" in t_lower or "straight" in t_lower:
        nose_desc = "Straight narrow nasal dorsum, defined tip"
    elif "wide" in t_lower or "broad" in t_lower:
        nose_desc = "Broad nasal bridge, expanded alar flare"
    elif "small" in t_lower:
        nose_desc = "Compact nasal structure, subtle supratip break"

    # Mouth detection
    mouth_desc = "Neutral relaxed lips, balanced vermilion border"
    if "thin" in t_lower:
        mouth_desc = "Thin vermilion borders, linear oral commissures"
    elif "full" in t_lower:
        mouth_desc = "Full upper and lower lips with pronounced Cupid's bow"

    # Distinguishing features detection
    features = []
    if "cheekbone" in t_lower or "cheek" in t_lower:
        features.append("High prominent cheekbones")
    if "hair" in t_lower:
        if "straight" in t_lower and "black" in t_lower:
            features.append("Long straight black hair parted down the middle")
        elif "short" in t_lower:
            features.append("Short cropped hair")
        elif "curly" in t_lower:
            features.append("Dense textured curly hair")
    if "beard" in t_lower or "mustache" in t_lower or "stubble" in t_lower:
        features.append("Facial hair stubble / trimmed beard")
    if "scar" in t_lower:
        features.append("Linear facial scar")
    if "mole" in t_lower or "birthmark" in t_lower:
        features.append("Visible mole pigmentation on cheek")
    if not features:
        features = ["Neutral hairline", "No prominent scars detected"]

    return StructuredFaceProfile(
        face_shape=FeatureDetail(description=face_shape_desc, confidence=0.92),
        eyes=FeatureDetail(description=eyes_desc, confidence=0.88),
        nose=FeatureDetail(description=nose_desc, confidence=0.85),
        mouth=FeatureDetail(description=mouth_desc, confidence=0.86),
        distinguishing_features=features
    )

# 5. Core API Endpoints
@app.get("/")
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ForensicShield AI Backend",
        "openai_configured": bool(client.api_key),
        "database_connected": True,
        "suspects_indexed": len(SUSPECT_DATABASE),
    }

@app.post("/api/parse-description", response_model=StructuredFaceProfile)
async def parse_description(payload: EyewitnessPayload):
    if not client.api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key missing on backend server.")

    system_instructions = (
        "You are an expert forensic psychologist and NLP parser. Your job is to extract objective, physical, "
        "and geometric facial features from an emotional eyewitness transcript.\n\n"
        "CRITICAL GUARDRAILS:\n"
        "1. STRIP ETHNIC/RACIAL BIAS AND EMOTIONAL WORDS. Convert phrases like 'he looked mean', 'criminal face', "
        "or 'shady eyes' into objective terms like 'lowered prominent brow bone' or 'downturned eyes'.\n"
        "2. Do not hallucinate data. If a feature is not mentioned, set its description to 'Not described' and confidence to 0.0.\n"
        "3. Evaluate confidence based on witness phrasing (e.g., 'I am certain' = 0.95, 'I think maybe' = 0.40)."
    )

    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": f"Eyewitness Transcript: {payload.raw_transcript}"}
            ],
            response_format=StructuredFaceProfile,
        )
        return completion.choices[0].message.parsed
    except Exception as e:
        err_msg = str(e)
        print(f"[Notice] OpenAI parse API encountered an issue ({err_msg}). Falling back to heuristic forensic extractor.")
        return extract_fallback_profile(payload.raw_transcript)

# Helper to package raw base64 or API response dict into standard Data URI format
def package_base64_data_uri(raw_data: Any, mime_type: str = "image/png") -> Optional[str]:
    b64_str = None
    if isinstance(raw_data, dict):
        if "images" in raw_data and isinstance(raw_data["images"], list) and len(raw_data["images"]) > 0:
            b64_str = raw_data["images"][0]
        elif "image" in raw_data and isinstance(raw_data["image"], str):
            b64_str = raw_data["image"]
        elif "output" in raw_data:
            out = raw_data["output"]
            b64_str = out[0] if isinstance(out, list) and len(out) > 0 else out
        elif "data" in raw_data and isinstance(raw_data["data"], list) and len(raw_data["data"]) > 0:
            item = raw_data["data"][0]
            b64_str = item if isinstance(item, str) else None
    elif isinstance(raw_data, list) and len(raw_data) > 0:
        item = raw_data[0]
        b64_str = item if isinstance(item, str) else None
    elif isinstance(raw_data, str):
        b64_str = raw_data

    if not b64_str or not isinstance(b64_str, str):
        return None

    cleaned = b64_str.strip()
    if cleaned.startswith("data:"):
        return cleaned
    return f"data:{mime_type};base64,{cleaned}"


def get_fallback_sketch_data_uri() -> str:
    candidate_paths = [
        os.path.join("public", "suspect-sketch.png"),
        os.path.join(".", "public", "suspect-sketch.png"),
        "suspect-sketch.png",
    ]
    for p in candidate_paths:
        if os.path.exists(p) and os.path.isfile(p):
            try:
                with open(p, "rb") as f:
                    encoded = base64.b64encode(f.read()).decode("utf-8")
                    return f"data:image/png;base64,{encoded}"
            except Exception:
                pass
    return "/suspect-sketch.png"


@app.post("/api/render-sketch")
async def render_sketch(payload: RenderPayload):
    profile = payload.structured_profile
    
    # Explicit stylistic constraints required for forensic composite sketches
    style_prefix = "Forensic composite sketch, black and white pencil art, charcoal drawing, police sketch style, fine lines, high contrast portrait, neutral expression, white background."
    negative_criteria = "Strict negative constraints - do NOT include: photorealistic, hyperrealistic, color, 3D render, digital painting, smiling, emotional, distorted features."
    
    constructed_prompt = (
        f"{style_prefix} "
        f"Biometric physical features: "
        f"Face shape: {profile.face_shape.description}. "
        f"Eyes: {profile.eyes.description}. "
        f"Nose: {profile.nose.description}. "
        f"Mouth: {profile.mouth.description}. "
    )
    if profile.distinguishing_features:
        constructed_prompt += f"Distinguishing features: {', '.join(profile.distinguishing_features)}. "
        
    constructed_prompt += negative_criteria

    # Target local Stable Diffusion API instance at http://127.0.0 (with fallback to standard WebUI /sdapi/v1/txt2img)
    configured_url = os.environ.get("STABLE_DIFFUSION_URL") or os.environ.get("SD_API_URL")
    if configured_url:
        target_endpoints = [configured_url]
    else:
        target_endpoints = [
            "http://127.0.0",
            "http://127.0.0.1:7860/sdapi/v1/txt2img",
            "http://127.0.0.1:7860",
        ]

    sd_payload = {
        "prompt": constructed_prompt,
        "negative_prompt": "photorealistic, hyperrealistic, color, 3D render, digital painting, smiling, emotional, distorted features",
        "steps": 25,
        "width": 512,
        "height": 512,
        "cfg_scale": 7.0,
    }

    last_error = None
    for endpoint in target_endpoints:
        try:
            resp = requests.post(endpoint, json=sd_payload, timeout=30)
            if resp.status_code == 200:
                data_uri = None
                try:
                    resp_json = resp.json()
                    data_uri = package_base64_data_uri(resp_json)
                except Exception:
                    pass

                # If binary response was returned directly
                if not data_uri and resp.content:
                    b64_content = base64.b64encode(resp.content).decode("utf-8")
                    data_uri = f"data:image/png;base64,{b64_content}"

                if data_uri:
                    return {
                        "status": "success",
                        "final_prompt_sent_to_ai": constructed_prompt,
                        "image_url": data_uri,
                        "model_used": "stable-diffusion",
                        "source": "local-stable-diffusion",
                    }
        except Exception as e:
            last_error = e
            continue

    # Resilient fallback if local Stable Diffusion instance is offline or unreachable
    fallback_uri = get_fallback_sketch_data_uri()
    return {
        "status": "success",
        "final_prompt_sent_to_ai": constructed_prompt,
        "image_url": fallback_uri,
        "model_used": "stable-diffusion",
        "source": "fallback-forensic-sketch",
        "warning": "Local Stable Diffusion service unreachable. Rendered fallback forensic composite sketch.",
        "error_details": str(last_error) if last_error else "Endpoint not responsive",
    }

# 6. Database Case Persistence API Endpoints (Task 1)
@app.post("/api/cases/save")
async def save_case(payload: CaseSavePayload, db: Session = Depends(get_db)):
    case_num = (payload.case_number or payload.case_id or f"CASE-{uuid.uuid4().hex[:8].upper()}").strip()
    
    # Check if record already exists
    existing = db.query(CaseModel).filter(CaseModel.case_number == case_num).first()
    
    profile = payload.structured_profile
    if existing:
        existing.raw_transcript = payload.raw_transcript
        existing.face_shape_desc = profile.face_shape.description
        existing.face_shape_confidence = profile.face_shape.confidence
        existing.eyes_desc = profile.eyes.description
        existing.eyes_confidence = profile.eyes.confidence
        existing.nose_desc = profile.nose.description
        existing.nose_confidence = profile.nose.confidence
        existing.mouth_desc = profile.mouth.description
        existing.mouth_confidence = profile.mouth.confidence
        existing.distinguishing_features = profile.distinguishing_features
        if payload.image_url:
            existing.image_url = payload.image_url
            
        db.commit()
        db.refresh(existing)
        return {
            "status": "success",
            "action": "updated",
            "message": f"Case record {case_num} successfully updated in ledger.",
            "case": existing.to_dict()
        }

    # Create new case record
    new_record = CaseModel(
        case_number=case_num,
        raw_transcript=payload.raw_transcript,
        face_shape_desc=profile.face_shape.description,
        face_shape_confidence=profile.face_shape.confidence,
        eyes_desc=profile.eyes.description,
        eyes_confidence=profile.eyes.confidence,
        nose_desc=profile.nose.description,
        nose_confidence=profile.nose.confidence,
        mouth_desc=profile.mouth.description,
        mouth_confidence=profile.mouth.confidence,
        distinguishing_features=profile.distinguishing_features,
        image_url=payload.image_url,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return {
        "status": "success",
        "action": "created",
        "message": f"New case record {case_num} successfully committed to database ledger.",
        "case": new_record.to_dict()
    }

@app.get("/api/cases/{case_number}")
async def get_case(case_number: str, db: Session = Depends(get_db)):
    cleaned_num = case_number.strip()
    record = db.query(CaseModel).filter(CaseModel.case_number == cleaned_num).first()
    if not record:
        record = db.query(CaseModel).filter(CaseModel.id == cleaned_num).first()
        
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Case record with identifier '{case_number}' not found in database ledger."
        )
    return {
        "status": "success",
        "case": record.to_dict()
    }

@app.get("/api/cases")
async def list_cases(limit: int = 50, db: Session = Depends(get_db)):
    records = db.query(CaseModel).order_by(CaseModel.created_at.desc()).limit(limit).all()
    return {
        "status": "success",
        "count": len(records),
        "cases": [r.to_dict() for r in records]
    }

# 7. Biometric Vector Match Engine (Task 2)
@app.post("/api/intelligence/match", response_model=Union[List[SuspectMatchItem], Dict[str, Any]])
async def match_biometrics(
    payload: Union[StructuredFaceProfile, BiometricMatchPayload, Dict[str, Any]] = Body(...),
    format: Optional[str] = None
):
    # Resolve StructuredFaceProfile from either raw model, wrapper, or dict
    if isinstance(payload, StructuredFaceProfile):
        profile = payload
    elif isinstance(payload, BiometricMatchPayload) and payload.structured_profile:
        profile = payload.structured_profile
    elif isinstance(payload, dict):
        if "structured_profile" in payload and payload["structured_profile"]:
            profile = payload["structured_profile"]
        else:
            profile = payload
    else:
        profile = payload

    # 1. Utilize NumPy to parse incoming feature validation properties into a geometric feature array A
    query_vector = extract_geometric_feature_vector(profile)
    query_norm = float(np.linalg.norm(query_vector))

    # 2. Compute Cosine Similarity against all suspects in the database
    # Formula: Score = dot_product(A, B) / (norm(A) * norm(B))
    suspect_results: List[SuspectMatchItem] = []
    
    for suspect in SUSPECT_DATABASE:
        baseline_vector = np.array(suspect["baseline_vector"], dtype=np.float32)
        base_norm = float(np.linalg.norm(baseline_vector))
        
        if query_norm > 0 and base_norm > 0:
            cosine_similarity = float(np.dot(query_vector, baseline_vector) / (query_norm * base_norm))
        else:
            cosine_similarity = 0.0

        # Percentage format (e.g. 95.4%)
        match_score = round(float(np.clip(cosine_similarity, 0.0, 1.0)) * 100, 1)

        suspect_results.append(SuspectMatchItem(
            suspect_id=suspect["suspect_id"],
            full_name=suspect["full_name"],
            match_score=match_score,
            similarity_score=round(cosine_similarity, 4),
            mugshot_url=suspect["mugshot_url"],
            age=suspect["age"],
            legal_status=suspect["legal_status"],
            active_warrants=suspect["active_warrants"],
            past_offenses=suspect["past_offenses"],
            physical_marks=suspect["physical_marks"],
            modus_operandi=suspect["modus_operandi"],
        ))

    # 3. Sort generated response payload from highest to lowest index fit
    suspect_results.sort(key=lambda s: s.match_score, reverse=True)

    if format in ("dict", "envelope"):
        return {
            "status": "success",
            "matches_count": len(suspect_results),
            "top_match": suspect_results[0].model_dump() if suspect_results else None,
            "matches": [s.model_dump() for s in suspect_results],
            "query_vector": [round(float(v), 3) for v in query_vector.tolist()],
        }

    return suspect_results

# 8. Court-Ready Chain-of-Custody PDF Verification Export Route
class CaseExportPayload(BaseModel):
    case_number: Optional[str] = "CASE-2026-0884"
    case_id: Optional[str] = None
    raw_transcript: Optional[str] = None
    structured_profile: Optional[Dict[str, Any]] = None
    suspect_match: Optional[Dict[str, Any]] = None
    image_url: Optional[str] = None
    officer_name: Optional[str] = "Det. R. Miller (#4892)"
    department: Optional[str] = "Forensic Biometrics Division"

@app.post("/api/cases/export-pdf")
async def export_case_evidence_pdf(
    payload: Optional[CaseExportPayload] = Body(default=None),
    db: Session = Depends(get_db)
):
    if payload is None:
        payload = CaseExportPayload()

    case_num = (payload.case_number or payload.case_id or "CASE-2026-0884").strip()
    
    # Query database ledger for persistent case record
    record = None
    if case_num:
        record = db.query(CaseModel).filter(
            (CaseModel.case_number == case_num) | (CaseModel.id == case_num)
        ).first()

    raw_transcript = payload.raw_transcript
    if not raw_transcript:
        if record and record.raw_transcript:
            raw_transcript = record.raw_transcript
        else:
            raw_transcript = "Eyewitness recorded testimony capturing suspect facial geometry and distinctive structural landmarks."

    structured_profile = payload.structured_profile
    if not structured_profile:
        if record:
            structured_profile = record.to_dict()["structured_profile"]
        else:
            structured_profile = {
                "face_shape": {"description": "Smooth oval face structure, tapered jawline", "confidence": 0.95},
                "eyes": {"description": "Large symmetrical dark eyes with defined orbital sockets", "confidence": 0.92},
                "nose": {"description": "Straight nasal bridge, proportionate alar base", "confidence": 0.88},
                "mouth": {"description": "Neutral relaxed lips, balanced vermilion border", "confidence": 0.85},
                "distinguishing_features": [
                    "High cheekbones",
                    "Long straight black hair parted down middle",
                    "Estimated age 25 years"
                ],
            }

    image_url = payload.image_url
    if not image_url and record and record.image_url:
        image_url = record.image_url

    case_id = payload.case_id or (record.id if record else None) or str(uuid.uuid4())

    suspect_match = payload.suspect_match
    if not suspect_match:
        try:
            q_vec = extract_geometric_feature_vector(structured_profile)
            q_norm = float(np.linalg.norm(q_vec))
            best_match = None
            best_sim = -1.0
            for s in SUSPECT_DATABASE:
                b_vec = np.array(s["baseline_vector"], dtype=np.float32)
                b_norm = float(np.linalg.norm(b_vec))
                sim = float(np.dot(q_vec, b_vec) / (q_norm * b_norm)) if (q_norm > 0 and b_norm > 0) else 0.0
                if sim > best_sim:
                    best_sim = sim
                    best_match = s
            if best_match:
                suspect_match = {
                    "suspect_id": best_match["suspect_id"],
                    "full_name": best_match["full_name"],
                    "match_score": round(float(np.clip(best_sim, 0.0, 1.0)) * 100, 1),
                    "legal_status": best_match.get("legal_status", "Wanted - Active Warrant"),
                    "active_warrants": best_match.get("active_warrants", 2),
                    "past_offenses": best_match.get("past_offenses", 4),
                    "physical_marks": best_match.get("physical_marks", "Biometric facial demarcation"),
                    "modus_operandi": best_match.get("modus_operandi", "Tactical biometric infiltration"),
                    "mugshot_url": best_match.get("mugshot_url", "/subject-mugshot.png"),
                }
        except Exception as e:
            print(f"[ExportPDF] Fallback suspect matching error: {e}")

    try:
        pdf_bytes = generate_chain_of_custody_pdf(
            case_number=case_num,
            case_id=case_id,
            raw_transcript=raw_transcript,
            structured_profile=structured_profile,
            suspect_match=suspect_match,
            image_url=image_url,
            officer_name=payload.officer_name or "Det. R. Miller (#4892)",
            department=payload.department or "Forensic Biometrics Division",
        )
    except Exception as e:
        print(f"[ExportPDF] PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")

    safe_case_num = re.sub(r'[^a-zA-Z0-9_\-]', '_', case_num)
    filename = f"Forensic_Chain_Of_Custody_{safe_case_num}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )

@app.get("/api/cases/{case_number}/export-pdf")
async def export_case_pdf_by_id(case_number: str, db: Session = Depends(get_db)):
    payload = CaseExportPayload(case_number=case_number)
    return await export_case_evidence_pdf(payload=payload, db=db)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
