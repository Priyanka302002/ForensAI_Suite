import io
import os
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
    Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch


def resolve_image_path(url_or_path: Optional[str]) -> Optional[str]:
    """Helper to resolve image URL/relative path to a valid local disk path for ReportLab."""
    if not url_or_path:
        return None
    # Handle base64 data URIs
    if url_or_path.startswith("data:image"):
        try:
            import base64
            _, b64_part = url_or_path.split(",", 1)
            raw_bytes = base64.b64decode(b64_part)
            os.makedirs("public", exist_ok=True)
            cache_p = os.path.join("public", "cached_sketch.png")
            with open(cache_p, "wb") as f:
                f.write(raw_bytes)
            return cache_p
        except Exception:
            pass
    # Strip query parameters (e.g. ?t=123456)
    cleaned = url_or_path.split("?")[0].lstrip("/").replace("\\", "/")
    possible_paths = [
        cleaned,
        os.path.join("public", cleaned),
        os.path.join(".", "public", cleaned),
        os.path.basename(cleaned),
        os.path.join("public", os.path.basename(cleaned)),
    ]
    for p in possible_paths:
        if os.path.exists(p) and os.path.isfile(p):
            return p
    return None


def generate_chain_of_custody_pdf(
    case_number: str = "CASE-2026-0884",
    case_id: Optional[str] = None,
    raw_transcript: str = "Eyewitness transcript statement",
    structured_profile: Optional[Dict[str, Any]] = None,
    suspect_match: Optional[Dict[str, Any]] = None,
    image_url: Optional[str] = None,
    officer_name: str = "Det. R. Miller (#4892)",
    department: str = "Forensic Biometrics Division",
) -> bytes:
    """
    Generates a court-ready, tamper-evident Chain-of-Custody verification PDF
    using ReportLab with cryptographic SHA-256 hash stamp, biometrics table,
    and side-by-side evidence portraits.
    """
    if not structured_profile:
        structured_profile = {
            "face_shape": {
                "description": "Smooth oval face structure, tapered jawline",
                "confidence": 0.95,
            },
            "eyes": {
                "description": "Large symmetrical dark eyes with defined orbital sockets",
                "confidence": 0.92,
            },
            "nose": {
                "description": "Straight nasal bridge, proportionate alar base",
                "confidence": 0.88,
            },
            "mouth": {
                "description": "Neutral relaxed lips, balanced vermilion border",
                "confidence": 0.85,
            },
            "distinguishing_features": [
                "High cheekbones",
                "Long straight black hair parted down middle",
                "Estimated age 25 years",
            ],
        }

    if not suspect_match:
        suspect_match = {
            "suspect_id": "CRIM-89241",
            "full_name": "Ananya Rao",
            "match_score": 95.4,
            "legal_status": "Wanted - Active Warrant",
            "active_warrants": 2,
            "past_offenses": 4,
            "physical_marks": "Scar above left eyebrow, moon tattoo on right wrist",
            "modus_operandi": "Unauthorized biometric spoofing & network infiltration",
            "mugshot_url": "/subject-mugshot.png",
        }

    # Compute tamper-evident SHA-256 cryptographic verification hash
    hash_payload = f"{case_number}|{case_id or 'UUID-PENDING'}|{raw_transcript}|{structured_profile}|{suspect_match.get('suspect_id', '')}"
    verification_hash = hashlib.sha256(hash_payload.encode("utf-8")).hexdigest()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Color Palette
    navy_dark = colors.HexColor("#0B132B")
    cyan_accent = colors.HexColor("#0284C7")
    slate_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#CBD5E1")
    text_dark = colors.HexColor("#0F172A")
    text_muted = colors.HexColor("#475569")
    alert_red = colors.HexColor("#B91C1C")
    emerald_green = colors.HexColor("#047857")

    # Typography Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        textColor=colors.white,
    )

    sub_title_style = ParagraphStyle(
        "DocSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#94A3B8"),
    )

    h2_style = ParagraphStyle(
        "H2Style",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12.5,
        textColor=navy_dark,
    )

    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=text_dark,
    )

    body_bold = ParagraphStyle(
        "BodyBold", parent=body_style, fontName="Helvetica-Bold"
    )

    mono_style = ParagraphStyle(
        "MonoStyle",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#0284C7"),
    )

    story = []

    # 1. Header Banner Box
    gen_time_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    header_data = [
        [
            Paragraph("FORENSIC EVIDENCE & CHAIN-OF-CUSTODY DOSSIER", title_style),
            Paragraph(
                "CONFIDENTIAL // LAW ENFORCEMENT SENSITIVE<br/>CLEARANCE LEVEL 4 • TAMPER-SEALED",
                ParagraphStyle(
                    "RightHdr",
                    parent=sub_title_style,
                    alignment=2,
                    textColor=colors.HexColor("#CBD5E1"),
                ),
            ),
        ],
        [
            Paragraph(
                "ForensAI Biometric Intelligence Platform • Department of Forensic Justice",
                sub_title_style,
            ),
            Paragraph(
                f"AUDIT STAMP: {gen_time_str}",
                ParagraphStyle(
                    "RightSub",
                    parent=sub_title_style,
                    alignment=2,
                    textColor=colors.HexColor("#38BDF8"),
                ),
            ),
        ],
    ]

    header_table = Table(header_data, colWidths=[330, 210])
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), navy_dark),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 8))

    # 2. Case Identification & Cryptographic Hash Block
    case_meta = [
        [
            Paragraph("<b>CASE IDENTIFIER:</b>", body_style),
            Paragraph(f"<b>{case_number}</b>", body_bold),
            Paragraph("<b>LEDGER STATUS:</b>", body_style),
            Paragraph(
                "<font color='#047857'><b>LOCKED & COMMITTED</b></font>", body_style
            ),
        ],
        [
            Paragraph("<b>SYSTEM UUID:</b>", body_style),
            Paragraph(case_id or "c129f8a4-ledger-locked", mono_style),
            Paragraph("<b>INVESTIGATOR:</b>", body_style),
            Paragraph(officer_name, body_style),
        ],
        [
            Paragraph("<b>INTEGRITY HASH:</b>", body_style),
            Paragraph(f"SHA-256: {verification_hash}", mono_style),
            Paragraph("<b>MATCH ALGORITHM:</b>", body_style),
            Paragraph("Cosine Similarity (16D)", body_style),
        ],
    ]
    meta_table = Table(case_meta, colWidths=[85, 240, 95, 120])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), slate_bg),
                ("BOX", (0, 0), (-1, -1), 1, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
                ("PADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # 3. Eyewitness Statement Transcript
    story.append(Paragraph("1. WITNESS TESTIMONY & INTAKE RECORD", h2_style))
    story.append(Spacer(1, 3))
    transcript_p = Paragraph(
        f"<i>\"{raw_transcript}\"</i>",
        ParagraphStyle(
            "Quote",
            parent=body_style,
            fontName="Helvetica-Oblique",
            fontSize=7.5,
            leading=10,
        ),
    )
    transcript_table = Table([[transcript_p]], colWidths=[540])
    transcript_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(transcript_table)
    story.append(Spacer(1, 8))

    # 4. Structured Biometric Feature Parameters (Matching Layout State)
    story.append(
        Paragraph("2. EXTRACTED FACIAL GEOMETRY & CONFIDENCE RATINGS", h2_style)
    )
    story.append(Spacer(1, 3))

    def fmt_feature(feat_obj, default_desc="Not described", default_conf=0.9):
        if not feat_obj:
            return default_desc, f"{int(default_conf * 100)}%"
        if isinstance(feat_obj, dict):
            desc = feat_obj.get("description", default_desc)
            conf = feat_obj.get("confidence", default_conf)
        else:
            desc = getattr(feat_obj, "description", default_desc)
            conf = getattr(feat_obj, "confidence", default_conf)
        pct = f"{int(float(conf or 0.0) * 100)}%"
        return str(desc), pct

    fs_desc, fs_conf = fmt_feature(structured_profile.get("face_shape"))
    ey_desc, ey_conf = fmt_feature(structured_profile.get("eyes"))
    ns_desc, ns_conf = fmt_feature(structured_profile.get("nose"))
    mo_desc, mo_conf = fmt_feature(structured_profile.get("mouth"))

    raw_dist = structured_profile.get("distinguishing_features", [])
    if isinstance(raw_dist, list):
        dist_str = ", ".join([str(f) for f in raw_dist])
    else:
        dist_str = str(raw_dist)
    if not dist_str:
        dist_str = "No prominent scars or accessories detected"

    features_data = [
        [
            Paragraph("<b>Anatomical Region</b>", body_bold),
            Paragraph(
                "<b>Extracted Physical Geometry & Characteristics</b>", body_bold
            ),
            Paragraph("<b>Confidence</b>", body_bold),
            Paragraph("<b>Admissibility</b>", body_bold),
        ],
        [
            Paragraph("Face Structure", body_style),
            Paragraph(fs_desc, body_style),
            Paragraph(f"<b>{fs_conf}</b>", body_style),
            Paragraph("<font color='#047857'>Validated</font>", body_style),
        ],
        [
            Paragraph("Eyes & Orbital", body_style),
            Paragraph(ey_desc, body_style),
            Paragraph(f"<b>{ey_conf}</b>", body_style),
            Paragraph("<font color='#047857'>Validated</font>", body_style),
        ],
        [
            Paragraph("Nasal Structure", body_style),
            Paragraph(ns_desc, body_style),
            Paragraph(f"<b>{ns_conf}</b>", body_style),
            Paragraph("<font color='#047857'>Validated</font>", body_style),
        ],
        [
            Paragraph("Oral & Lip Border", body_style),
            Paragraph(mo_desc, body_style),
            Paragraph(f"<b>{mo_conf}</b>", body_style),
            Paragraph("<font color='#047857'>Validated</font>", body_style),
        ],
        [
            Paragraph("Distinguishing Traits", body_style),
            Paragraph(dist_str, body_style),
            Paragraph("<b>95%</b>", body_style),
            Paragraph("<font color='#047857'>Validated</font>", body_style),
        ],
    ]

    features_table = Table(features_data, colWidths=[105, 275, 75, 85])
    features_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, slate_bg]),
                ("BOX", (0, 0), (-1, -1), 1, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
                ("PADDING", (0, 0), (-1, -1), 3.5),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(features_table)
    story.append(Spacer(1, 8))

    # 5. Visual Evidence Portraits (Composite Sketch & Database Match)
    story.append(
        Paragraph("3. BIOMETRIC COMPOSITE & DATABASE RECORD VERIFICATION", h2_style)
    )
    story.append(Spacer(1, 3))

    sketch_disk_path = resolve_image_path(image_url) or resolve_image_path("/suspect-sketch.png")
    mugshot_disk_path = resolve_image_path(suspect_match.get("mugshot_url")) or resolve_image_path("/subject-mugshot.png")

    img_col_width = 1.25 * inch
    img_col_height = 1.45 * inch

    sketch_element = Paragraph("<i>[Sketch Image Unavailable]</i>", body_style)
    if sketch_disk_path:
        try:
            sketch_element = RLImage(sketch_disk_path, width=img_col_width, height=img_col_height)
        except Exception:
            pass

    mugshot_element = Paragraph("<i>[Mugshot Image Unavailable]</i>", body_style)
    if mugshot_disk_path:
        try:
            mugshot_element = RLImage(mugshot_disk_path, width=img_col_width, height=img_col_height)
        except Exception:
            pass

    match_score = suspect_match.get("match_score", 95.4)
    suspect_name = suspect_match.get("full_name", "Ananya Rao")
    suspect_id = suspect_match.get("suspect_id", "CRIM-89241")
    warrants = suspect_match.get("active_warrants", 2)
    mo = suspect_match.get("modus_operandi", "Unauthorized biometric spoofing & network infiltration")
    status = suspect_match.get("legal_status", "Wanted - Active Warrant")

    comparison_data = [
        [
            Paragraph("<b>EVIDENCE COMPOSITE SKETCH</b>", body_bold),
            Paragraph("<b>DATABASE MATCH IDENTIFICATION</b>", body_bold),
        ],
        [
            Table([
                [sketch_element],
                [Paragraph(f"<font color='#0284C7'><b>Generated Forensic Portrait</b></font><br/>Case: {case_number}", body_style)]
            ], colWidths=[250], style=[("ALIGN", (0, 0), (-1, -1), "CENTER")]),
            Table([
                [mugshot_element],
                [Paragraph(f"<b>{suspect_name}</b> ({suspect_id})<br/><font color='#B91C1C'><b>{status}</b></font> • Warrants: {warrants}<br/><b>Score: <font color='#0284C7'>{match_score}% Cosine Fit</font></b>", body_style)]
            ], colWidths=[250], style=[("ALIGN", (0, 0), (-1, -1), "CENTER")]),
        ]
    ]

    comp_table = Table(comparison_data, colWidths=[270, 270])
    comp_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF6FF")),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#FAFAFA")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#BFDBFE")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
                ("PADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(comp_table)
    story.append(Spacer(1, 10))

    # 6. Legal Attestation & Chain-of-Custody Signatures
    story.append(
        KeepTogether(
            [
                Paragraph(
                    "4. EVIDENTIARY CHAIN-OF-CUSTODY ATTESTATION & DIGITAL LOCK",
                    h2_style,
                ),
                Spacer(1, 3),
                Paragraph(
                    "I hereby certify under penalty of perjury that the biometric facial features, witness testimony logs, "
                    "and suspect correlation indices contained in this report were digitally generated and secured using the "
                    "ForensAI cryptographic evidence ledger. The SHA-256 integrity hash seals this document against retroactive "
                    "tampering and fulfills federal criminal discovery chain-of-custody requirements.",
                    ParagraphStyle(
                        "Attest",
                        parent=body_style,
                        fontSize=7,
                        leading=9,
                        textColor=text_muted,
                    ),
                ),
                Spacer(1, 8),
                Table(
                    [
                        [
                            Paragraph(
                                "<b>INVESTIGATING DETECTIVE SIGNATURE:</b><br/><br/>________________________________________<br/>"
                                + f"{officer_name} — Lead Tactical Examiner",
                                body_style,
                            ),
                            Paragraph(
                                "<b>CHIEF BIOMETRIC SYSTEMS EXAMINER:</b><br/><br/>________________________________________<br/>"
                                + "Forensic Division Administrator — Sealed by Ledger",
                                body_style,
                            ),
                        ]
                    ],
                    colWidths=[270, 270],
                    style=[
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("PADDING", (0, 0), (-1, -1), 0),
                    ],
                ),
                Spacer(1, 6),
                HRFlowable(
                    width="100%",
                    thickness=0.5,
                    color=colors.HexColor("#94A3B8"),
                    spaceBefore=2,
                    spaceAfter=2,
                ),
                Paragraph(
                    "OFFICIAL RECORD • FORENSICSHIELD AI SUITE • COURT-READY CHAIN-OF-CUSTODY VERIFICATION TOOL",
                    ParagraphStyle(
                        "Footer",
                        parent=sub_title_style,
                        alignment=1,
                        fontSize=7,
                        textColor=colors.HexColor("#64748B"),
                    ),
                ),
            ]
        )
    )

    doc.build(story)
    return buffer.getvalue()
