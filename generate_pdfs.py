#!/usr/bin/env python3
"""
FEC-to-PDF Generator v2 — Optimized for Apple M4 Max (36GB RAM)

Each supplier/client gets a unique, consistent visual identity (header layout +
color palette). Documents are grouped into subfolders by entity name.

Usage: python3 generate_pdfs.py [--input FILE] [--output DIR] [--workers N]
"""

import csv
import hashlib
import os
import argparse
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    HRFlowable,
)
from reportlab.lib.colors import HexColor

# ─────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────

COMPANY_NAME = "ACME Distribution SAS"
COMPANY_ADDRESS = "Zone Industrielle des Brotteaux\n42100 Saint-Étienne"
COMPANY_SIRET = "412 345 678 00012"
COMPANY_TVA_INTRA = "FR 12 412345678"
COMPANY_CAPITAL = "314 400,00 €"
COMPANY_RCS = "RCS Saint-Étienne B 412 345 678"
COMPANY_TEL = "04 77 12 34 56"

WIDTH, HEIGHT = A4

# Internal doc colors (bank, OD, cash, balance)
INTERNAL_PRIMARY = HexColor("#1a365d")
INTERNAL_SECONDARY = HexColor("#2b6cb0")
ACCENT = HexColor("#e2e8f0")
LIGHT_BG = HexColor("#f7fafc")
BORDER = HexColor("#cbd5e0")
TEXT_DARK = HexColor("#1a202c")
TEXT_MUTED = HexColor("#718096")

# ─── 16 Color Themes for entities ───
COLOR_THEMES = [
    {"primary": "#1a365d", "secondary": "#2b6cb0", "accent": "#bee3f8", "table_header": "#2c5282"},  # Navy
    {"primary": "#22543d", "secondary": "#38a169", "accent": "#c6f6d5", "table_header": "#276749"},  # Forest
    {"primary": "#742a2a", "secondary": "#c53030", "accent": "#fed7d7", "table_header": "#9b2c2c"},  # Burgundy
    {"primary": "#7b341e", "secondary": "#dd6b20", "accent": "#feebc8", "table_header": "#c05621"},  # Amber
    {"primary": "#234e52", "secondary": "#319795", "accent": "#b2f5ea", "table_header": "#285e61"},  # Teal
    {"primary": "#44337a", "secondary": "#805ad5", "accent": "#e9d8fd", "table_header": "#553c9a"},  # Purple
    {"primary": "#1a202c", "secondary": "#4a5568", "accent": "#e2e8f0", "table_header": "#2d3748"},  # Charcoal
    {"primary": "#652b19", "secondary": "#c05621", "accent": "#fbd38d", "table_header": "#9c4221"},  # Rust
    {"primary": "#1a365d", "secondary": "#3182ce", "accent": "#bee3f8", "table_header": "#2a69ac"},  # Cobalt
    {"primary": "#3c4a2e", "secondary": "#6b8e23", "accent": "#d4e6a5", "table_header": "#556b2f"},  # Olive
    {"primary": "#63171b", "secondary": "#e53e3e", "accent": "#feb2b2", "table_header": "#9b2c2c"},  # Crimson
    {"primary": "#0d4747", "secondary": "#0987a0", "accent": "#9decf9", "table_header": "#0e7490"},  # Cyan
    {"primary": "#4a3728", "secondary": "#8b6f47", "accent": "#e8d5b7", "table_header": "#6b5338"},  # Brown
    {"primary": "#312e81", "secondary": "#5a67d8", "accent": "#c3dafe", "table_header": "#434190"},  # Indigo
    {"primary": "#2d3748", "secondary": "#718096", "accent": "#edf2f7", "table_header": "#4a5568"},  # Slate
    {"primary": "#285e61", "secondary": "#2c7a7b", "accent": "#b2f5ea", "table_header": "#2c7a7b"},  # Dark Teal
]

# ─── Address / identity generation data ───
STREETS = [
    "Rue de la République", "Avenue Jean Jaurès", "Boulevard Gambetta",
    "Rue Victor Hugo", "Place de la Liberté", "Rue Pasteur",
    "Avenue du Général de Gaulle", "Rue de la Paix", "Impasse des Tilleuls",
    "Allée des Roses", "Chemin du Moulin", "Rue Émile Zola",
    "Boulevard Voltaire", "Rue du Commerce", "Place du Marché",
    "Rue de l'Industrie", "Avenue des Martyrs", "Rue Pierre Curie",
    "Boulevard de la Gare", "Rue Anatole France",
]
CITIES = [
    "69001 Lyon", "42000 Saint-Étienne", "38000 Grenoble",
    "63000 Clermont-Ferrand", "73000 Chambéry", "26000 Valence",
    "01000 Bourg-en-Bresse", "43000 Le Puy-en-Velay",
    "07000 Privas", "74000 Annecy", "69100 Villeurbanne",
    "42100 Saint-Étienne", "38100 Grenoble", "69003 Lyon",
    "42300 Roanne", "69007 Lyon", "38400 Saint-Martin-d'Hères",
    "42400 Saint-Chamond", "69200 Vénissieux", "38500 Voiron",
]
PAYMENT_TERMS = [
    "30 jours fin de mois", "45 jours date de facture",
    "60 jours fin de mois", "À réception de facture",
    "30 jours net", "Virement à 30 jours", "Traite à 60 jours",
]
PHONE_PREFIXES = ["04 77", "04 78", "04 72", "04 76", "04 73", "04 75", "04 74", "04 79"]

BANK_NAMES = {
    "BAN1": "Banque Populaire Loire et Lyonnais",
    "BAN2": "Crédit Agricole Loire",
    "BAN3": "CIC Lyonnaise de Banque",
}
BANK_ACCOUNTS = {
    "BAN1": "FR76 1234 5678 9012 3456 7890 123",
    "BAN2": "FR76 9876 5432 1098 7654 3210 987",
    "BAN3": "FR76 5555 6666 7777 8888 9999 000",
}

# Legal form suffixes for deterministic company type
LEGAL_FORMS = ["SAS", "SA", "SARL", "SAS", "EURL", "SNC", "SA", "SAS"]


# ─────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────

def parse_french_amount(s: str) -> float:
    if not s or s.strip() == "":
        return 0.0
    return float(s.replace(",", ".").replace(" ", ""))


def format_amount(val: float) -> str:
    if val == 0:
        return "0,00"
    s = f"{val:,.2f}"
    s = s.replace(",", " ").replace(".", ",")
    return s


def format_amount_eur(val: float) -> str:
    return f"{format_amount(val)} €"


def parse_fec_date(s: str) -> datetime:
    s = s.strip().replace("-", "")
    if len(s) == 8:
        return datetime.strptime(s, "%Y%m%d")
    return datetime(2024, 1, 1)


def format_date_fr(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y")


def _hash(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest(), 16)


def generate_address(name: str) -> str:
    h = _hash(name)
    return f"{(h % 150) + 1} {STREETS[h % len(STREETS)]}\n{CITIES[(h >> 8) % len(CITIES)]}"


def generate_siret(name: str) -> str:
    h = _hash(name)
    siren = f"{(h % 900000000) + 100000000}"
    nic = f"{(h >> 32) % 90000 + 10000}"
    return f"{siren[:3]} {siren[3:6]} {siren[6:9]} {nic}"


def generate_tva_intra(name: str) -> str:
    h = _hash(name)
    return f"FR {(h % 90) + 10} {(h % 900000000) + 100000000}"


def generate_phone(name: str) -> str:
    h = _hash(name)
    prefix = PHONE_PREFIXES[h % len(PHONE_PREFIXES)]
    n1 = (h >> 4) % 100
    n2 = (h >> 12) % 100
    n3 = (h >> 20) % 100
    return f"{prefix} {n1:02d} {n2:02d} {n3:02d}"


def generate_rcs(name: str) -> str:
    h = _hash(name)
    city = CITIES[(h >> 8) % len(CITIES)].split(" ", 1)[-1]
    siren = f"{(h % 900000000) + 100000000}"
    return f"RCS {city} B {siren[:3]} {siren[3:6]} {siren[6:9]}"


def get_payment_term(name: str) -> str:
    return PAYMENT_TERMS[_hash(name) % len(PAYMENT_TERMS)]


def safe_filename(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in s).strip()[:60]


def safe_dirname(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in s).strip()[:50] or "Divers"


def get_entity_initials(name: str) -> str:
    parts = name.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return name[:2].upper()


# ─────────────────────────────────────────────────────────
# Entity Identity System
# ─────────────────────────────────────────────────────────

def get_entity_identity(name: str) -> dict:
    """
    Generate a complete, deterministic visual identity for an entity.
    Same entity name → always the same colors, layout, address, etc.
    """
    h = _hash(name)
    theme = COLOR_THEMES[h % len(COLOR_THEMES)]
    template_id = (h >> 4) % 10  # 10 header templates

    return {
        "name": name,
        "initials": get_entity_initials(name),
        "address": generate_address(name),
        "siret": generate_siret(name),
        "tva": generate_tva_intra(name),
        "phone": generate_phone(name),
        "rcs": generate_rcs(name),
        "payment_term": get_payment_term(name),
        "template_id": template_id,
        "primary": HexColor(theme["primary"]),
        "secondary": HexColor(theme["secondary"]),
        "accent": HexColor(theme["accent"]),
        "table_header": HexColor(theme["table_header"]),
    }


# ─────────────────────────────────────────────────────────
# FEC Parser
# ─────────────────────────────────────────────────────────

def parse_fec(filepath: str) -> dict:
    journals = defaultdict(lambda: defaultdict(list))
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter="|")
        for row in reader:
            jcode = row.get("JournalCode", "").strip()
            enum = row.get("EcritureNum", "").strip()
            if jcode and enum:
                journals[jcode][enum].append(row)
    return dict(journals)


def classify_entry_lines(lines: list) -> dict:
    result = {
        "line_items": [], "tva_lines": [], "counterparty": None,
        "entity_name": "", "entity_code": "", "piece_ref": "",
        "piece_date": None, "ecriture_date": None, "ecriture_lib": "",
        "total_debit": 0.0, "total_credit": 0.0,
    }
    for line in lines:
        compte = line.get("CompteNum", "").strip()
        compte_lib = line.get("CompteLib", "").strip()
        debit = parse_french_amount(line.get("Debit", "0"))
        credit = parse_french_amount(line.get("Credit", "0"))
        aux_num = line.get("CompAuxNum", "").strip()
        aux_lib = line.get("CompAuxLib", "").strip()
        piece_ref = line.get("PieceRef", "").strip()
        ecriture_lib = line.get("EcritureLib", "").strip()

        result["total_debit"] += debit
        result["total_credit"] += credit
        if piece_ref and not result["piece_ref"]:
            result["piece_ref"] = piece_ref
        if ecriture_lib and not result["ecriture_lib"]:
            result["ecriture_lib"] = ecriture_lib
        try:
            if not result["piece_date"]:
                result["piece_date"] = parse_fec_date(line.get("PieceDate", "20240101"))
            if not result["ecriture_date"]:
                result["ecriture_date"] = parse_fec_date(line.get("EcritureDate", "20240101"))
        except Exception:
            pass

        if compte.startswith("401") or compte.startswith("411"):
            result["counterparty"] = {
                "compte": compte, "compte_lib": compte_lib,
                "debit": debit, "credit": credit,
                "aux_num": aux_num, "aux_lib": aux_lib,
            }
            if aux_lib:
                result["entity_name"] = aux_lib
            elif ecriture_lib:
                result["entity_name"] = ecriture_lib
            if aux_num:
                result["entity_code"] = aux_num
        elif compte.startswith("445"):
            result["tva_lines"].append({
                "compte": compte, "compte_lib": compte_lib,
                "debit": debit, "credit": credit,
            })
        elif compte.startswith("51") or compte.startswith("53"):
            if not result["counterparty"]:
                result["counterparty"] = {
                    "compte": compte, "compte_lib": compte_lib,
                    "debit": debit, "credit": credit,
                }
        else:
            result["line_items"].append({
                "compte": compte, "compte_lib": compte_lib,
                "debit": debit, "credit": credit,
                "description": ecriture_lib or compte_lib,
            })
    if not result["entity_name"] and lines:
        result["entity_name"] = lines[0].get("EcritureLib", "").strip()
    return result


# ─────────────────────────────────────────────────────────
# 10 Header Templates
# ─────────────────────────────────────────────────────────

def _p(text, **kw):
    """Quick paragraph helper."""
    defaults = {"fontName": "Helvetica", "fontSize": 9, "textColor": TEXT_DARK, "leading": 12}
    defaults.update(kw)
    return Paragraph(text, ParagraphStyle("_dyn", **defaults))


def _header_template_0(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Corporate Banner — full-width dark banner + lighter info bar."""
    elements = []
    # Big banner with entity name
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    banner = [[_p(f"<b>{issuer}</b>", fontSize=18, textColor=colors.white,
                   fontName="Helvetica-Bold")]]
    t = Table(banner, colWidths=[500])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["primary"]),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 15),
    ]))
    elements.append(t)

    # Info bar below
    if doc_type == "purchase":
        left = f"{eid['address'].replace(chr(10), ' — ')}<br/>Tél. {eid['phone']} — SIRET {eid['siret']}"
        right = f"<b>Destinataire :</b> {COMPANY_NAME}<br/>{COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        left = f"{COMPANY_ADDRESS.replace(chr(10), ' — ')}<br/>Tél. {COMPANY_TEL} — SIRET {COMPANY_SIRET}"
        right = f"<b>Client :</b> {eid['name']}<br/>{eid['address'].replace(chr(10), ', ')}"

    info_bar = [[
        _p(left, fontSize=7, textColor=TEXT_MUTED),
        _p(right, fontSize=8, alignment=TA_RIGHT),
    ]]
    t2 = Table(info_bar, colWidths=[280, 220])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["accent"]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (0, 0), 15),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 10),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))

    # FACTURE title + ref
    title_row = [[
        _p("FACTURE", fontSize=22, fontName="Helvetica-Bold",
            textColor=eid["primary"]),
        _p(f"N° <b>{piece_ref}</b><br/>Date : {format_date_fr(piece_date)}",
            fontSize=9, alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t3 = Table(title_row, colWidths=[300, 200])
    t3.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(t3)
    elements.append(Spacer(1, 6 * mm))
    return elements


def _header_template_1(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Left Accent Bar — thick vertical color bar on left, info beside."""
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    issuer_detail = (f"{eid['address'].replace(chr(10), '<br/>')}<br/>"
                     f"<font size='7'>SIRET {eid['siret']} — TVA {eid['tva']}</font>"
                     if doc_type == "purchase" else
                     f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                     f"<font size='7'>SIRET {COMPANY_SIRET} — TVA {COMPANY_TVA_INTRA}</font>")

    recipient = COMPANY_NAME if doc_type == "purchase" else eid["name"]
    recip_detail = (f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}"
                    if doc_type == "purchase" else
                    f"{eid['address'].replace(chr(10), '<br/>')}")

    row = [[
        "",  # accent bar cell
        _p(f"<b>{issuer}</b><br/>{issuer_detail}", fontSize=9),
        _p(f"<b>{recipient}</b><br/>{recip_detail}", fontSize=9),
    ]]
    t = Table(row, colWidths=[6, 250, 244])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))

    # Title line
    title_row = [[
        _p(f"<b>FACTURE N° {piece_ref}</b>", fontSize=14,
            fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"Date : {format_date_fr(piece_date)}", fontSize=10,
            alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t2 = Table(title_row, colWidths=[340, 160])
    elements.append(t2)
    elements.append(HRFlowable(width="100%", thickness=2, color=eid["primary"]))
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_2(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Two-Tone Split — left colored panel, right white panel."""
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    if doc_type == "purchase":
        left_info = (f"<b>{issuer}</b><br/>{eid['address'].replace(chr(10), '<br/>')}<br/>"
                     f"<font size='7'>Tél. {eid['phone']}</font>")
        right_info = (f"<b>Adressé à :</b><br/>{COMPANY_NAME}<br/>"
                      f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                      f"<font size='7'>SIRET {COMPANY_SIRET}</font>")
    else:
        left_info = (f"<b>{COMPANY_NAME}</b><br/>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                     f"<font size='7'>Tél. {COMPANY_TEL}</font>")
        right_info = (f"<b>Client :</b><br/>{eid['name']}<br/>"
                      f"{eid['address'].replace(chr(10), '<br/>')}<br/>"
                      f"<font size='7'>Réf. {info.get('entity_code') or 'N/A'}</font>")

    row = [[
        _p(left_info, fontSize=9, textColor=colors.white),
        _p(right_info, fontSize=9),
    ]]
    t = Table(row, colWidths=[220, 280])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("BACKGROUND", (1, 0), (1, 0), eid["accent"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 3 * mm))

    # Title
    row2 = [[
        _p("FACTURE", fontSize=20, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"<b>N° {piece_ref}</b>  —  {format_date_fr(piece_date)}",
            fontSize=10, alignment=TA_RIGHT, textColor=eid["secondary"]),
    ]]
    t2 = Table(row2, colWidths=[250, 250])
    t2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_3(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Minimalist — large name, thin line, compact info."""
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    elements.append(_p(f"<b>{issuer}</b>", fontSize=24,
                       fontName="Helvetica-Bold", textColor=eid["primary"]))
    elements.append(Spacer(1, 1 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.8, color=eid["secondary"]))
    elements.append(Spacer(1, 3 * mm))

    if doc_type == "purchase":
        meta_left = f"{eid['address'].replace(chr(10), ' — ')} — Tél. {eid['phone']}"
        meta_right = f"{COMPANY_NAME} — {COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        meta_left = f"{COMPANY_ADDRESS.replace(chr(10), ' — ')} — Tél. {COMPANY_TEL}"
        meta_right = f"{eid['name']} — {eid['address'].replace(chr(10), ', ')}"

    row = [[
        _p(meta_left, fontSize=7, textColor=TEXT_MUTED),
        _p(meta_right, fontSize=7, textColor=TEXT_MUTED, alignment=TA_RIGHT),
    ]]
    t = Table(row, colWidths=[280, 220])
    elements.append(t)
    elements.append(Spacer(1, 6 * mm))

    # Facture box
    box = [[
        _p(f"FACTURE", fontSize=11, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"N° {piece_ref}", fontSize=10, fontName="Helvetica-Bold"),
        _p(f"Date : {format_date_fr(piece_date)}", fontSize=9, textColor=TEXT_MUTED),
        _p(f"Échéance : {eid['payment_term']}", fontSize=9, textColor=TEXT_MUTED,
            alignment=TA_RIGHT),
    ]]
    t2 = Table(box, colWidths=[100, 150, 130, 120])
    t2.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_4(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Initial Badge — colored square with initials + info beside."""
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    initials = get_entity_initials(issuer)

    if doc_type == "purchase":
        detail = (f"<b>{eid['name']}</b><br/>"
                  f"{eid['address'].replace(chr(10), '<br/>')}<br/>"
                  f"<font size='7'>SIRET {eid['siret']} — TVA {eid['tva']}<br/>"
                  f"Tél. {eid['phone']}</font>")
        recip = (f"<b>Facturé à :</b> {COMPANY_NAME}<br/>"
                 f"<font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font>")
    else:
        detail = (f"<b>{COMPANY_NAME}</b><br/>"
                  f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                  f"<font size='7'>SIRET {COMPANY_SIRET} — TVA {COMPANY_TVA_INTRA}<br/>"
                  f"Tél. {COMPANY_TEL}</font>")
        recip = (f"<b>Client :</b> {eid['name']}<br/>"
                 f"<font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font>")

    row = [[
        _p(f"<b>{initials}</b>", fontSize=28, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_CENTER),
        _p(detail, fontSize=9),
        _p(recip, fontSize=9),
    ]]
    t = Table(row, colWidths=[55, 230, 215])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("VALIGN", (0, 0), (0, 0), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (1, 0), (1, 0), 10),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 2 * mm))

    # Title + meta
    row2 = [[
        _p(f"<b>FACTURE</b>  N° {piece_ref}", fontSize=13,
            fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"Du {format_date_fr(piece_date)}", fontSize=10,
            alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t2 = Table(row2, colWidths=[350, 150])
    t2.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, eid["secondary"]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_5(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Top Bar + Card — thin color bar top, then bordered info card."""
    elements = []
    # Thin top bar
    bar = [[_p("", fontSize=2)]]
    t = Table(bar, colWidths=[500])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["primary"]),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))

    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    if doc_type == "purchase":
        left = (f"<b>{eid['name']}</b><br/>"
                f"<font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font><br/>"
                f"<font size='7' color='#718096'>Tél. {eid['phone']} — SIRET {eid['siret']}</font>")
        right = (f"<b>Destinataire</b><br/>"
                 f"{COMPANY_NAME}<br/>"
                 f"<font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font>")
    else:
        left = (f"<b>{COMPANY_NAME}</b><br/>"
                f"<font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font><br/>"
                f"<font size='7' color='#718096'>Tél. {COMPANY_TEL} — SIRET {COMPANY_SIRET}</font>")
        right = (f"<b>Client</b><br/>"
                 f"{eid['name']}<br/>"
                 f"<font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font>")

    card = [[_p(left, fontSize=9), _p(right, fontSize=9)]]
    t2 = Table(card, colWidths=[260, 240])
    t2.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, eid["secondary"]),
        ("LINEAFTER", (0, 0), (0, 0), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))

    row3 = [[
        _p(f"<b>FACTURE N° {piece_ref}</b>", fontSize=14,
            fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"{format_date_fr(piece_date)} — {eid['payment_term']}",
            fontSize=9, alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t3 = Table(row3, colWidths=[300, 200])
    elements.append(t3)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_6(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Bold Header Block — tall colored block with name + FACTURE inside."""
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME

    block = [
        [_p(f"<b>{issuer}</b>", fontSize=16, fontName="Helvetica-Bold",
             textColor=colors.white),
         _p(f"<b>FACTURE</b>", fontSize=20, fontName="Helvetica-Bold",
             textColor=colors.white, alignment=TA_RIGHT)],
        [_p(f"N° {piece_ref}  —  {format_date_fr(piece_date)}",
             fontSize=9, textColor=HexColor("#ffffff99")),
         ""],
    ]
    t = Table(block, colWidths=[300, 200])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["primary"]),
        ("TOPPADDING", (0, 0), (-1, 0), 15),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (0, -1), 15),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 15),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))

    # Address row
    if doc_type == "purchase":
        left = f"<b>De :</b> {eid['address'].replace(chr(10), ', ')} — Tél. {eid['phone']}"
        right = f"<b>À :</b> {COMPANY_NAME}, {COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        left = f"<b>De :</b> {COMPANY_ADDRESS.replace(chr(10), ', ')} — Tél. {COMPANY_TEL}"
        right = f"<b>À :</b> {eid['name']}, {eid['address'].replace(chr(10), ', ')}"

    addr = [[_p(left, fontSize=8, textColor=TEXT_MUTED),
             _p(right, fontSize=8, textColor=TEXT_MUTED, alignment=TA_RIGHT)]]
    t2 = Table(addr, colWidths=[270, 230])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["accent"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 10),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 6 * mm))
    return elements


def _header_template_7(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Double Line — two horizontal colored lines framing the header info."""
    elements = []
    elements.append(HRFlowable(width="100%", thickness=3, color=eid["primary"]))
    elements.append(Spacer(1, 3 * mm))

    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    if doc_type == "purchase":
        left = (f"<b>{eid['name']}</b><br/>"
                f"{eid['address'].replace(chr(10), '<br/>')}<br/>"
                f"<font size='7'>SIRET {eid['siret']}</font>")
        right = (f"<b>Client :</b><br/>{COMPANY_NAME}<br/>"
                 f"<font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font>")
    else:
        left = (f"<b>{COMPANY_NAME}</b><br/>"
                f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                f"<font size='7'>SIRET {COMPANY_SIRET}</font>")
        right = (f"<b>Client :</b><br/>{eid['name']}<br/>"
                 f"<font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font>")

    row = [[_p(left, fontSize=9), _p(right, fontSize=9, alignment=TA_RIGHT)]]
    t = Table(row, colWidths=[280, 220])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(t)
    elements.append(Spacer(1, 3 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=eid["secondary"]))
    elements.append(Spacer(1, 4 * mm))

    row2 = [[
        _p(f"<b>FACTURE</b>", fontSize=16, fontName="Helvetica-Bold",
            textColor=eid["primary"]),
        _p(f"N° {piece_ref}", fontSize=12, fontName="Helvetica-Bold",
            textColor=eid["secondary"]),
        _p(f"{format_date_fr(piece_date)}", fontSize=10,
            alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t2 = Table(row2, colWidths=[140, 200, 160])
    t2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_8(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Underline Emphasis — very large name with thick colored underline."""
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    elements.append(_p(f"<b>{issuer}</b>", fontSize=26,
                       fontName="Helvetica-Bold", textColor=eid["primary"]))
    elements.append(Spacer(1, 1 * mm))

    # Thick underline (partial width via table trick)
    bar = [[""]]
    t = Table(bar, colWidths=[180])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["secondary"]),
        ("TOPPADDING", (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("LINEBELOW", (0, 0), (0, 0), 4, eid["secondary"]),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))

    if doc_type == "purchase":
        meta = (f"{eid['address'].replace(chr(10), ' — ')} — "
                f"SIRET {eid['siret']} — Tél. {eid['phone']}")
    else:
        meta = (f"{COMPANY_ADDRESS.replace(chr(10), ' — ')} — "
                f"SIRET {COMPANY_SIRET} — Tél. {COMPANY_TEL}")
    elements.append(_p(meta, fontSize=7, textColor=TEXT_MUTED))
    elements.append(Spacer(1, 5 * mm))

    # Recipient + facture info
    if doc_type == "purchase":
        recip = f"<b>Destinataire :</b> {COMPANY_NAME}, {COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        recip = f"<b>Client :</b> {eid['name']}, {eid['address'].replace(chr(10), ', ')}"

    row = [[
        _p(recip, fontSize=9),
        _p(f"<b>FACTURE N° {piece_ref}</b><br/>{format_date_fr(piece_date)}",
            fontSize=10, alignment=TA_RIGHT, textColor=eid["primary"],
            fontName="Helvetica-Bold"),
    ]]
    t2 = Table(row, colWidths=[320, 180])
    t2.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_9(eid: dict, doc_type: str, piece_ref: str,
                        piece_date: datetime, info: dict) -> list:
    """Gradient Bar — two-color horizontal bar + clean layout below."""
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME

    bar = [[
        _p(f"<b>{issuer}</b>", fontSize=14, fontName="Helvetica-Bold",
            textColor=colors.white),
        _p(f"FACTURE  N° {piece_ref}", fontSize=12, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_RIGHT),
    ]]
    t = Table(bar, colWidths=[300, 200])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("BACKGROUND", (1, 0), (1, 0), eid["secondary"]),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (0, 0), 12),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 12),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))

    if doc_type == "purchase":
        left = (f"{eid['address'].replace(chr(10), '<br/>')}<br/>"
                f"<font size='7'>SIRET {eid['siret']} — Tél. {eid['phone']}</font>")
        right = (f"<b>Facturé à :</b><br/>{COMPANY_NAME}<br/>"
                 f"<font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font>")
    else:
        left = (f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                f"<font size='7'>SIRET {COMPANY_SIRET} — Tél. {COMPANY_TEL}</font>")
        right = (f"<b>Client :</b><br/>{eid['name']}<br/>"
                 f"<font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font>")

    row = [[_p(left, fontSize=9), _p(right, fontSize=9, alignment=TA_RIGHT)]]
    t2 = Table(row, colWidths=[260, 240])
    t2.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 3 * mm))

    meta_row = [[
        _p(f"Date : <b>{format_date_fr(piece_date)}</b>", fontSize=9),
        _p(f"Échéance : <b>{eid['payment_term']}</b>", fontSize=9, alignment=TA_RIGHT),
    ]]
    t3 = Table(meta_row, colWidths=[250, 250])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["accent"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 10),
    ]))
    elements.append(t3)
    elements.append(Spacer(1, 5 * mm))
    return elements


HEADER_TEMPLATES = [
    _header_template_0, _header_template_1, _header_template_2,
    _header_template_3, _header_template_4, _header_template_5,
    _header_template_6, _header_template_7, _header_template_8,
    _header_template_9,
]


# ─────────────────────────────────────────────────────────
# Invoice PDF Generator (Purchase & Sale)
# ─────────────────────────────────────────────────────────

def generate_invoice_pdf(entry_data: dict, doc_type: str, output_path: str):
    info = classify_entry_lines(entry_data["lines"])

    entity_name = info["entity_name"] or "Fournisseur Inconnu"
    eid = get_entity_identity(entity_name)
    piece_ref = info["piece_ref"] or entry_data["ecriture_num"]
    piece_date = info["piece_date"] or datetime(2024, 1, 1)

    # Select header template
    template_fn = HEADER_TEMPLATES[eid["template_id"]]
    elements = template_fn(eid, doc_type, piece_ref, piece_date, info)

    # ── Line items table ──
    table_header = [
        _p("Compte", fontSize=8, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_CENTER),
        _p("Désignation", fontSize=8, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_CENTER),
        _p("Montant HT", fontSize=8, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_CENTER),
    ]
    table_data = [table_header]

    ht_total = 0.0
    for item in info["line_items"]:
        amount = item["debit"] if item["debit"] > 0 else item["credit"]
        ht_total += amount
        table_data.append([
            _p(item["compte"], fontSize=8),
            _p(item["description"] or item["compte_lib"], fontSize=8),
            _p(format_amount_eur(amount), fontSize=8, alignment=TA_RIGHT),
        ])

    if not info["line_items"]:
        amount = max(info["total_debit"], info["total_credit"])
        tva_amount = sum(l["debit"] + l["credit"] for l in info["tva_lines"])
        ht_total = amount - tva_amount
        if ht_total <= 0:
            ht_total = amount
        table_data.append([
            _p("—", fontSize=8),
            _p(info["ecriture_lib"] or "Prestation", fontSize=8),
            _p(format_amount_eur(ht_total), fontSize=8, alignment=TA_RIGHT),
        ])

    item_table = Table(table_data, colWidths=[80, 300, 120])
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), eid["table_header"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 4 * mm))

    # ── Totals ──
    tva_total = sum(l["debit"] + l["credit"] for l in info["tva_lines"])
    ttc_total = ht_total + tva_total
    tva_rate = ""
    if ht_total > 0 and tva_total > 0:
        tva_rate = f" ({(tva_total / ht_total) * 100:.1f}%)"

    totals_data = [
        ["",
         _p("Total HT", fontSize=9, fontName="Helvetica-Bold",
             textColor=eid["primary"], alignment=TA_RIGHT),
         _p(format_amount_eur(ht_total), fontSize=9, fontName="Helvetica-Bold",
             textColor=eid["primary"], alignment=TA_RIGHT)],
        ["",
         _p(f"TVA{tva_rate}", fontSize=9, fontName="Helvetica-Bold",
             textColor=eid["primary"], alignment=TA_RIGHT),
         _p(format_amount_eur(tva_total), fontSize=9, fontName="Helvetica-Bold",
             textColor=eid["primary"], alignment=TA_RIGHT)],
        ["",
         _p("TOTAL TTC", fontSize=11, fontName="Helvetica-Bold",
             textColor=colors.white, alignment=TA_RIGHT),
         _p(format_amount_eur(ttc_total), fontSize=11, fontName="Helvetica-Bold",
             textColor=colors.white, alignment=TA_RIGHT)],
    ]
    totals_table = Table(totals_data, colWidths=[260, 140, 100])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (1, 0), (-1, 0), 1, BORDER),
        ("BACKGROUND", (1, -1), (-1, -1), eid["primary"]),
        ("TEXTCOLOR", (1, -1), (-1, -1), colors.white),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 8),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 10 * mm))

    # ── Footer ──
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    elements.append(Spacer(1, 2 * mm))

    if doc_type == "purchase":
        footer = (
            f"<b>Conditions de règlement :</b> {eid['payment_term']}<br/>"
            f"<b>Mode de règlement :</b> Virement bancaire<br/>"
            f"<font size='7' color='#718096'>"
            f"En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, "
            f"ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (Art. L.441-10 C. com.)."
            f"</font>"
        )
    else:
        footer = (
            f"<b>Conditions de règlement :</b> {eid['payment_term']}<br/>"
            f"<b>Coordonnées bancaires :</b> {BANK_ACCOUNTS['BAN2']}<br/>"
            f"<font size='7' color='#718096'>"
            f"{COMPANY_NAME} — Capital social : {COMPANY_CAPITAL} — "
            f"SIRET : {COMPANY_SIRET} — TVA : {COMPANY_TVA_INTRA} — {COMPANY_RCS}"
            f"</font>"
        )
    elements.append(_p(footer, fontSize=9))

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )
    doc.build(elements)


# ─────────────────────────────────────────────────────────
# Bank Statement PDF (unchanged logic, internal doc)
# ─────────────────────────────────────────────────────────

def generate_bank_statement_pdf(bank_code, month, year, entries, output_path):
    bank_name = BANK_NAMES.get(bank_code, f"Banque {bank_code}")
    iban = BANK_ACCOUNTS.get(bank_code, "FR76 XXXX XXXX XXXX XXXX XXXX XXX")
    months_fr = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                 "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    month_name = months_fr[month] if 1 <= month <= 12 else str(month)

    elements = []
    bank_header = [[
        _p(f"<b>{bank_name}</b>", fontSize=14, fontName="Helvetica-Bold",
            textColor=colors.white),
        _p("RELEVÉ DE COMPTE", fontSize=14, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_RIGHT),
    ]]
    bh = Table(bank_header, colWidths=[300, 200])
    bh.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INTERNAL_PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (0, 0), 12), ("RIGHTPADDING", (-1, -1), (-1, -1), 12),
    ]))
    elements.append(bh)
    elements.append(Spacer(1, 4 * mm))

    ai = [
        [_p(f"<b>Titulaire :</b> {COMPANY_NAME}", fontSize=9),
         _p(f"<b>Période :</b> {month_name} {year}", fontSize=9, alignment=TA_RIGHT)],
        [_p(f"<b>IBAN :</b> {iban}", fontSize=9),
         _p(f"<b>SIRET :</b> {COMPANY_SIRET}", fontSize=9, alignment=TA_RIGHT)],
    ]
    ait = Table(ai, colWidths=[300, 200])
    ait.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (0, -1), 10),
    ]))
    elements.append(ait)
    elements.append(Spacer(1, 6 * mm))

    hdr = [_p(h, fontSize=8, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)
           for h in ["Date", "Libellé", "Référence", "Débit", "Crédit"]]
    tdata = [hdr]
    total_d = total_c = 0.0

    sorted_entries = sorted(entries, key=lambda e: e.get("piece_date", ""))
    for el in sorted_entries:
        info = classify_entry_lines(el["lines"])
        bd = bc = 0.0
        desc = info["ecriture_lib"] or ""
        pref = info["piece_ref"] or ""
        dstr = format_date_fr(info["piece_date"]) if info["piece_date"] else ""
        for line in el["lines"]:
            if line.get("CompteNum", "").strip().startswith("51"):
                bd += parse_french_amount(line.get("Debit", "0"))
                bc += parse_french_amount(line.get("Credit", "0"))
                if not desc:
                    desc = line.get("EcritureLib", "").strip()
        total_d += bc
        total_c += bd
        tdata.append([
            _p(dstr, fontSize=8), _p(desc[:50], fontSize=8), _p(pref[:20], fontSize=8),
            _p(format_amount_eur(bc) if bc > 0 else "", fontSize=8, alignment=TA_RIGHT),
            _p(format_amount_eur(bd) if bd > 0 else "", fontSize=8, alignment=TA_RIGHT),
        ])

    tdata.append(["", "",
        _p("<b>TOTAUX</b>", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        _p(f"<b>{format_amount_eur(total_d)}</b>", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        _p(f"<b>{format_amount_eur(total_c)}</b>", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT),
    ])

    tt = Table(tdata, colWidths=[60, 200, 80, 80, 80], repeatRows=1)
    tt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INTERNAL_SECONDARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, INTERNAL_PRIMARY),
    ]))
    elements.append(tt)
    elements.append(Spacer(1, 6 * mm))

    net = total_c - total_d
    bl = "Solde créditeur" if net >= 0 else "Solde débiteur"
    bc = [[_p(f"<b>{bl} : {format_amount_eur(abs(net))}</b>", fontSize=11,
              fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)]]
    bct = Table(bc, colWidths=[500])
    bct.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INTERNAL_PRIMARY if net >= 0 else HexColor("#c53030")),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(bct)
    elements.append(Spacer(1, 8 * mm))
    elements.append(_p(
        f"<font size='7' color='#718096'>{bank_name} — "
        f"Ce document est un relevé de compte mensuel. "
        f"Toute réclamation doit être formulée dans un délai de 30 jours.</font>", fontSize=7))

    SimpleDocTemplate(output_path, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm
    ).build(elements)


# ─────────────────────────────────────────────────────────
# Journal Voucher PDF (OD)
# ─────────────────────────────────────────────────────────

def generate_journal_voucher_pdf(entry_data, output_path):
    lines = entry_data["lines"]
    info = classify_entry_lines(lines)
    pref = info["piece_ref"] or entry_data["ecriture_num"]
    pdate = info["piece_date"] or datetime(2024, 1, 1)

    elements = []
    hdr = [[
        _p(f"<b>{COMPANY_NAME}</b>", fontSize=9),
        _p("PIÈCE COMPTABLE — OD", fontSize=14, fontName="Helvetica-Bold",
            textColor=INTERNAL_PRIMARY, alignment=TA_RIGHT),
    ]]
    ht = Table(hdr, colWidths=[250, 250])
    ht.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                             ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    elements.append(ht)
    elements.append(HRFlowable(width="100%", thickness=1.5, color=INTERNAL_PRIMARY))
    elements.append(Spacer(1, 4 * mm))

    meta = [[
        _p(f"<b>N° Pièce :</b> {pref}", fontSize=9),
        _p(f"<b>Date :</b> {format_date_fr(pdate)}", fontSize=9),
        _p(f"<b>Libellé :</b> {info['ecriture_lib']}", fontSize=9),
    ]]
    mt = Table(meta, colWidths=[160, 160, 180])
    mt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 8),
    ]))
    elements.append(mt)
    elements.append(Spacer(1, 6 * mm))

    th = [_p(h, fontSize=8, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)
          for h in ["Compte", "Libellé", "Débit", "Crédit"]]
    td = [th]
    ttd = ttc = 0.0
    for line in lines:
        d = parse_french_amount(line.get("Debit", "0"))
        c = parse_french_amount(line.get("Credit", "0"))
        ttd += d; ttc += c
        td.append([
            _p(line.get("CompteNum", ""), fontSize=8),
            _p(line.get("CompteLib", ""), fontSize=8),
            _p(format_amount_eur(d) if d > 0 else "", fontSize=8, alignment=TA_RIGHT),
            _p(format_amount_eur(c) if c > 0 else "", fontSize=8, alignment=TA_RIGHT),
        ])
    td.append(["",
        _p("<b>TOTAUX</b>", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        _p(f"<b>{format_amount_eur(ttd)}</b>", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        _p(f"<b>{format_amount_eur(ttc)}</b>", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT),
    ])
    tt = Table(td, colWidths=[80, 230, 95, 95])
    tt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INTERNAL_SECONDARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, INTERNAL_PRIMARY),
    ]))
    elements.append(tt)
    elements.append(Spacer(1, 8 * mm))

    bal = abs(ttd - ttc) < 0.01
    st = "Pièce équilibrée" if bal else f"Écart : {format_amount_eur(abs(ttd - ttc))}"
    elements.append(_p(f"<font color='{'#38a169' if bal else '#c53030'}'><b>{st}</b></font>",
                       fontSize=10, alignment=TA_RIGHT))

    SimpleDocTemplate(output_path, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm, topMargin=15*mm, bottomMargin=15*mm
    ).build(elements)


# ─────────────────────────────────────────────────────────
# Cash Receipt PDF (CA)
# ─────────────────────────────────────────────────────────

def generate_cash_receipt_pdf(entry_data, output_path):
    info = classify_entry_lines(entry_data["lines"])
    pdate = info["piece_date"] or datetime(2024, 1, 1)
    elements = []

    elements.append(_p(COMPANY_NAME, fontSize=20, fontName="Helvetica-Bold",
                       textColor=INTERNAL_PRIMARY))
    elements.append(HRFlowable(width="100%", thickness=1, color=INTERNAL_PRIMARY))
    elements.append(Spacer(1, 6 * mm))
    elements.append(_p("TICKET DE CAISSE", fontSize=16, fontName="Helvetica-Bold",
                       textColor=INTERNAL_PRIMARY, alignment=TA_CENTER))
    elements.append(Spacer(1, 4 * mm))
    elements.append(_p(f"Date : {format_date_fr(pdate)} — Réf : {info['piece_ref']}",
                       fontSize=10, alignment=TA_CENTER, textColor=TEXT_MUTED))
    elements.append(Spacer(1, 6 * mm))

    th = [_p(h, fontSize=8, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)
          for h in ["Description", "Montant"]]
    td = [th]
    total = 0.0
    for item in info["line_items"]:
        a = item["debit"] if item["debit"] > 0 else item["credit"]
        total += a
        td.append([_p(item["description"], fontSize=8),
                   _p(format_amount_eur(a), fontSize=8, alignment=TA_RIGHT)])
    tva = sum(l["debit"] + l["credit"] for l in info["tva_lines"])
    if tva > 0:
        td.append([_p("TVA", fontSize=8),
                   _p(format_amount_eur(tva), fontSize=8, alignment=TA_RIGHT)])
    td.append([
        _p("<b>TOTAL</b>", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        _p(f"<b>{format_amount_eur(total + tva)}</b>", fontSize=9, fontName="Helvetica-Bold",
            alignment=TA_RIGHT),
    ])
    tt = Table(td, colWidths=[320, 120])
    tt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INTERNAL_SECONDARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, INTERNAL_PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(tt)
    elements.append(Spacer(1, 6 * mm))
    elements.append(_p("Paiement : Espèces", fontSize=9))

    SimpleDocTemplate(output_path, pagesize=A4,
        leftMargin=30*mm, rightMargin=30*mm, topMargin=20*mm, bottomMargin=20*mm
    ).build(elements)


# ─────────────────────────────────────────────────────────
# Opening Balance PDF (RAN)
# ─────────────────────────────────────────────────────────

def generate_opening_balance_pdf(lines, output_path):
    elements = []
    elements.append(_p(COMPANY_NAME, fontSize=20, fontName="Helvetica-Bold",
                       textColor=INTERNAL_PRIMARY))
    elements.append(_p("BALANCE D'OUVERTURE — Exercice 2024", fontSize=14,
                       textColor=INTERNAL_SECONDARY, fontName="Helvetica-Bold"))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=INTERNAL_PRIMARY))
    elements.append(Spacer(1, 6 * mm))

    classes = defaultdict(list)
    for line in lines:
        c = line.get("CompteNum", "").strip()
        if c:
            classes[c[0]].append(line)

    cnames = {"1": "Classe 1 — Capitaux", "2": "Classe 2 — Immobilisations",
              "3": "Classe 3 — Stocks", "4": "Classe 4 — Tiers",
              "5": "Classe 5 — Financier", "6": "Classe 6 — Charges",
              "7": "Classe 7 — Produits"}
    gtd = gtc = 0.0

    for ck in sorted(classes.keys()):
        cl = classes[ck]
        elements.append(_p(cnames.get(ck, f"Classe {ck}"), fontSize=11,
                           fontName="Helvetica-Bold", textColor=INTERNAL_SECONDARY))
        elements.append(Spacer(1, 2 * mm))

        th = [_p(h, fontSize=8, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)
              for h in ["Compte", "Libellé", "Débit", "Crédit"]]
        td = [th]
        cd = cc = 0.0
        for line in cl:
            d = parse_french_amount(line.get("Debit", "0"))
            c = parse_french_amount(line.get("Credit", "0"))
            cd += d; cc += c
            td.append([
                _p(line.get("CompteNum", ""), fontSize=7),
                _p(line.get("CompteLib", "")[:40], fontSize=7),
                _p(format_amount(d) if d > 0 else "", fontSize=7, alignment=TA_RIGHT),
                _p(format_amount(c) if c > 0 else "", fontSize=7, alignment=TA_RIGHT),
            ])
        gtd += cd; gtc += cc
        td.append(["",
            _p(f"<b>Sous-total {ck}</b>", fontSize=8, fontName="Helvetica-Bold", alignment=TA_RIGHT),
            _p(f"<b>{format_amount(cd)}</b>", fontSize=8, fontName="Helvetica-Bold", alignment=TA_RIGHT),
            _p(f"<b>{format_amount(cc)}</b>", fontSize=8, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        ])
        tt = Table(td, colWidths=[70, 240, 95, 95])
        tt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INTERNAL_SECONDARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, LIGHT_BG]),
            ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("LINEABOVE", (0, -1), (-1, -1), 1, INTERNAL_PRIMARY),
        ]))
        elements.append(tt)
        elements.append(Spacer(1, 4 * mm))

    elements.append(Spacer(1, 4 * mm))
    gt = [[
        _p("<b>TOTAL GÉNÉRAL</b>", fontSize=12, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_CENTER),
        _p(f"<b>{format_amount_eur(gtd)}</b>", fontSize=12, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_RIGHT),
        _p(f"<b>{format_amount_eur(gtc)}</b>", fontSize=12, fontName="Helvetica-Bold",
            textColor=colors.white, alignment=TA_RIGHT),
    ]]
    gtt = Table(gt, colWidths=[310, 95, 95])
    gtt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INTERNAL_PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(gtt)

    SimpleDocTemplate(output_path, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm
    ).build(elements)


# ─────────────────────────────────────────────────────────
# Workers
# ─────────────────────────────────────────────────────────

def worker_invoice(args):
    entry_data, doc_type, output_path = args
    try:
        generate_invoice_pdf(entry_data, doc_type, output_path)
        return ("ok", output_path)
    except Exception as e:
        return ("error", f"{output_path}: {e}")

def worker_voucher(args):
    entry_data, output_path = args
    try:
        generate_journal_voucher_pdf(entry_data, output_path)
        return ("ok", output_path)
    except Exception as e:
        return ("error", f"{output_path}: {e}")

def worker_receipt(args):
    entry_data, output_path = args
    try:
        generate_cash_receipt_pdf(entry_data, output_path)
        return ("ok", output_path)
    except Exception as e:
        return ("error", f"{output_path}: {e}")

def worker_bank(args):
    bank_code, month, year, entries, output_path = args
    try:
        generate_bank_statement_pdf(bank_code, month, year, entries, output_path)
        return ("ok", output_path)
    except Exception as e:
        return ("error", f"{output_path}: {e}")


# ─────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="FEC → PDF Generator v2")
    parser.add_argument("--input", "-i",
        default="/Users/yoannabriel/Documents/GitHub.nosync/Sof-IA/DGI_LET_2024.txt")
    parser.add_argument("--output", "-o",
        default="/Users/yoannabriel/Documents/GitHub.nosync/Sof-IA/generated_pdfs")
    parser.add_argument("--workers", "-w", type=int, default=8)
    args = parser.parse_args()

    input_file = args.input
    output_dir = args.output
    max_workers = args.workers

    print(f"╔══════════════════════════════════════════════════════╗")
    print(f"║  FEC → PDF Generator v2                              ║")
    print(f"║  10 header templates · 16 color themes               ║")
    print(f"║  Grouped by entity · Consistent identity per client  ║")
    print(f"╠══════════════════════════════════════════════════════════╣")
    print(f"║  Input:   {os.path.basename(input_file):<45}║")
    print(f"║  Output:  {output_dir:<45}║")
    print(f"║  Workers: {max_workers:<45}║")
    print(f"╚══════════════════════════════════════════════════════════╝")
    print()

    t0 = time.time()

    # Parse
    print("  Parsing FEC file...")
    journals = parse_fec(input_file)
    total_lines = sum(len(e) for j in journals.values() for e in j.values())
    total_entries = sum(len(j) for j in journals.values())
    print(f"  → {total_lines} lines, {total_entries} entries across {len(journals)} journals")
    print()

    # Output dirs
    base_dirs = {
        "achat": os.path.join(output_dir, "01_Factures_Achat"),
        "vente": os.path.join(output_dir, "02_Factures_Vente"),
        "fg": os.path.join(output_dir, "03_Frais_Generaux"),
        "bank": os.path.join(output_dir, "04_Releves_Bancaires"),
        "od": os.path.join(output_dir, "05_Operations_Diverses"),
        "caisse": os.path.join(output_dir, "06_Caisse"),
        "balance": os.path.join(output_dir, "07_Balance_Ouverture"),
    }
    for d in base_dirs.values():
        os.makedirs(d, exist_ok=True)

    tasks = []
    entity_counts = defaultdict(int)  # track how many docs per entity

    def add_invoice_task(journal_key, base_dir, doc_type, enum, lines):
        info = classify_entry_lines(lines)
        entity = info["entity_name"] or "Divers"
        entity_dir_name = safe_dirname(entity)
        entity_dir = os.path.join(base_dir, entity_dir_name)
        os.makedirs(entity_dir, exist_ok=True)

        piece = safe_filename(info["piece_ref"]) or enum
        fname = f"{journal_key}_{enum}_{piece}.pdf"
        path = os.path.join(entity_dir, fname)
        entry_data = {"lines": lines, "ecriture_num": enum, "journal": journal_key}
        tasks.append((worker_invoice, (entry_data, doc_type, path)))
        entity_counts[entity] += 1

    # 1. Purchase invoices (ACH)
    if "ACH" in journals:
        for enum, lines in journals["ACH"].items():
            add_invoice_task("ACH", base_dirs["achat"], "purchase", enum, lines)
        print(f"  [ACH] {len(journals['ACH'])} factures d'achat")

    # 2. Sales invoices (VT)
    if "VT" in journals:
        for enum, lines in journals["VT"].items():
            add_invoice_task("VT", base_dirs["vente"], "sale", enum, lines)
        print(f"  [VT]  {len(journals['VT'])} factures de vente")

    # 3. General expenses (FG)
    if "FG" in journals:
        for enum, lines in journals["FG"].items():
            add_invoice_task("FG", base_dirs["fg"], "purchase", enum, lines)
        print(f"  [FG]  {len(journals['FG'])} factures de frais généraux")

    # 4. Bank statements
    for bc in ["BAN1", "BAN2", "BAN3"]:
        if bc not in journals:
            continue
        monthly = defaultdict(list)
        for enum, lines in journals[bc].items():
            for line in lines:
                pd = line.get("PieceDate", "").strip().replace("-", "")
                if len(pd) >= 6:
                    monthly[int(pd[4:6])].append({"lines": lines, "piece_date": pd})
                    break
        for month, entries in sorted(monthly.items()):
            fname = f"{bc}_Releve_{2024}_{month:02d}.pdf"
            path = os.path.join(base_dirs["bank"], fname)
            tasks.append((worker_bank, (bc, month, 2024, entries, path)))
        print(f"  [{bc}] {len(monthly)} relevés bancaires ({len(journals[bc])} opérations)")

    # 5. OD
    if "OD" in journals:
        for enum, lines in journals["OD"].items():
            info = classify_entry_lines(lines)
            lib = safe_filename(info["ecriture_lib"]) or "od"
            fname = f"OD_{enum}_{lib}.pdf"
            path = os.path.join(base_dirs["od"], fname)
            tasks.append((worker_voucher, ({"lines": lines, "ecriture_num": enum}, path)))
        print(f"  [OD]  {len(journals['OD'])} pièces comptables")

    # 6. Cash
    if "CA" in journals:
        for enum, lines in journals["CA"].items():
            info = classify_entry_lines(lines)
            lib = safe_filename(info["ecriture_lib"]) or "caisse"
            fname = f"CA_{enum}_{lib}.pdf"
            path = os.path.join(base_dirs["caisse"], fname)
            tasks.append((worker_receipt, ({"lines": lines, "ecriture_num": enum}, path)))
        print(f"  [CA]  {len(journals['CA'])} tickets de caisse")

    # 7. Opening balance
    all_ran = []
    if "RAN" in journals:
        for enum, lines in journals["RAN"].items():
            all_ran.extend(lines)
        ran_path = os.path.join(base_dirs["balance"], "Balance_Ouverture_2024.pdf")
        print(f"  [RAN] 1 balance d'ouverture ({len(all_ran)} lignes)")

    # Stats
    unique_entities = len(entity_counts)
    top_entities = sorted(entity_counts.items(), key=lambda x: -x[1])[:5]

    print()
    print(f"  {len(tasks)} PDFs to generate" +
          (" + 1 balance" if all_ran else ""))
    print(f"  {unique_entities} unique entities (grouped in subfolders)")
    print(f"  Top entities: {', '.join(f'{n} ({c})' for n, c in top_entities)}")
    print()

    # Generate balance
    if all_ran:
        print("  Generating balance d'ouverture...")
        generate_opening_balance_pdf(all_ran, ran_path)
        print("  → done")

    # Parallel generation
    print(f"  Generating {len(tasks)} PDFs with {max_workers} workers...")

    success = errors = 0
    error_msgs = []

    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fn, a): a for fn, a in tasks}
        done = 0
        for fut in as_completed(futures):
            done += 1
            status, msg = fut.result()
            if status == "ok":
                success += 1
            else:
                errors += 1
                error_msgs.append(msg)
            if done % 200 == 0 or done == len(tasks):
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                print(f"    [{done}/{len(tasks)}] {done/len(tasks)*100:.0f}% — "
                      f"{rate:.0f} PDFs/sec — {elapsed:.1f}s")

    elapsed = time.time() - t0
    print()
    print(f"  ═══════════════════════════════════════════════")
    print(f"  DONE — {success + (1 if all_ran else 0)} PDFs in {elapsed:.1f}s "
          f"({success/elapsed:.0f}/sec) — {errors} errors")
    print(f"  {unique_entities} entities, 10 header styles, 16 color themes")
    print(f"  ═══════════════════════════════════════════════")

    if error_msgs:
        print(f"\n  Errors ({len(error_msgs)}):")
        for msg in error_msgs[:10]:
            print(f"    - {msg}")

    print(f"\n  Output:")
    for label, d in base_dirs.items():
        if os.path.exists(d):
            # Count PDFs recursively
            total = sum(1 for root, dirs, files in os.walk(d) for f in files if f.endswith(".pdf"))
            subdirs = len([x for x in os.listdir(d) if os.path.isdir(os.path.join(d, x))])
            extra = f" ({subdirs} entities)" if subdirs > 0 else ""
            if total > 0:
                print(f"    {os.path.basename(d)}/  {total} PDFs{extra}")


if __name__ == "__main__":
    main()
