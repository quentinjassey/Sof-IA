#!/usr/bin/env python3
"""
Faulty PDF Generator — Generates invoices with subtle errors for testing Sof'IA.

Reads the FEC file, selects ~15% of entries, injects one or more faults per PDF,
and logs every fault in fault_manifest.json for verification.

Output: generated_pdfs_faulty/

Fault types:
  F01  TVA calculation error        — TVA ≠ HT × rate (off by small amount)
  F02  Total TTC mismatch           — TTC ≠ HT + TVA
  F03  Date shift                   — Invoice date shifted by 1-15 days
  F04  Entity name typo             — Subtle misspelling of entity name
  F05  Missing SIRET                — SIRET field blank or partial
  F06  Duplicate invoice number     — Same piece_ref reused on different entry
  F07  Amount rounding error        — Line item off by 0.01-0.99 €
  F08  Wrong TVA rate displayed     — Shows 20% but calculates at 19.6% or vice versa
  F09  Temporal cutoff issue        — December date shifted to January or vice versa
  F10  Swapped debit/credit         — Amount in wrong column (debit vs credit)
  F11  Missing payment terms        — No payment conditions shown
  F12  Wrong entity on invoice      — Invoice header shows different entity than line items

Usage: python3 generate_faulty_pdfs.py [--input FILE] [--output DIR] [--fault-rate 0.15]
"""

import csv
import hashlib
import json
import os
import argparse
import random
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from copy import deepcopy
from datetime import datetime, timedelta

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    HRFlowable,
)
from reportlab.lib.colors import HexColor

# ─────────────────────────────────────────────────────────
# Constants (same as v2)
# ─────────────────────────────────────────────────────────

COMPANY_NAME = "ACME Distribution SAS"
COMPANY_ADDRESS = "Zone Industrielle des Brotteaux\n42100 Saint-Étienne"
COMPANY_SIRET = "412 345 678 00012"
COMPANY_TVA_INTRA = "FR 12 412345678"
COMPANY_CAPITAL = "314 400,00 €"
COMPANY_RCS = "RCS Saint-Étienne B 412 345 678"
COMPANY_TEL = "04 77 12 34 56"

WIDTH, HEIGHT = A4

INTERNAL_PRIMARY = HexColor("#1a365d")
INTERNAL_SECONDARY = HexColor("#2b6cb0")
ACCENT = HexColor("#e2e8f0")
LIGHT_BG = HexColor("#f7fafc")
BORDER = HexColor("#cbd5e0")
TEXT_DARK = HexColor("#1a202c")
TEXT_MUTED = HexColor("#718096")

COLOR_THEMES = [
    {"primary": "#1a365d", "secondary": "#2b6cb0", "accent": "#bee3f8", "table_header": "#2c5282"},
    {"primary": "#22543d", "secondary": "#38a169", "accent": "#c6f6d5", "table_header": "#276749"},
    {"primary": "#742a2a", "secondary": "#c53030", "accent": "#fed7d7", "table_header": "#9b2c2c"},
    {"primary": "#7b341e", "secondary": "#dd6b20", "accent": "#feebc8", "table_header": "#c05621"},
    {"primary": "#234e52", "secondary": "#319795", "accent": "#b2f5ea", "table_header": "#285e61"},
    {"primary": "#44337a", "secondary": "#805ad5", "accent": "#e9d8fd", "table_header": "#553c9a"},
    {"primary": "#1a202c", "secondary": "#4a5568", "accent": "#e2e8f0", "table_header": "#2d3748"},
    {"primary": "#652b19", "secondary": "#c05621", "accent": "#fbd38d", "table_header": "#9c4221"},
    {"primary": "#1a365d", "secondary": "#3182ce", "accent": "#bee3f8", "table_header": "#2a69ac"},
    {"primary": "#3c4a2e", "secondary": "#6b8e23", "accent": "#d4e6a5", "table_header": "#556b2f"},
    {"primary": "#63171b", "secondary": "#e53e3e", "accent": "#feb2b2", "table_header": "#9b2c2c"},
    {"primary": "#0d4747", "secondary": "#0987a0", "accent": "#9decf9", "table_header": "#0e7490"},
    {"primary": "#4a3728", "secondary": "#8b6f47", "accent": "#e8d5b7", "table_header": "#6b5338"},
    {"primary": "#312e81", "secondary": "#5a67d8", "accent": "#c3dafe", "table_header": "#434190"},
    {"primary": "#2d3748", "secondary": "#718096", "accent": "#edf2f7", "table_header": "#4a5568"},
    {"primary": "#285e61", "secondary": "#2c7a7b", "accent": "#b2f5ea", "table_header": "#2c7a7b"},
]

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

BANK_ACCOUNTS = {
    "BAN1": "FR76 1234 5678 9012 3456 7890 123",
    "BAN2": "FR76 9876 5432 1098 7654 3210 987",
    "BAN3": "FR76 5555 6666 7777 8888 9999 000",
}

# ─────────────────────────────────────────────────────────
# Utilities (same as v2)
# ─────────────────────────────────────────────────────────

def parse_french_amount(s: str) -> float:
    if not s or s.strip() == "":
        return 0.0
    return float(s.replace(",", ".").replace(" ", ""))

def format_amount(val: float) -> str:
    if val == 0:
        return "0,00"
    s = f"{val:,.2f}"
    return s.replace(",", " ").replace(".", ",")

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
# Entity Identity System (same as v2)
# ─────────────────────────────────────────────────────────

def get_entity_identity(name: str) -> dict:
    h = _hash(name)
    theme = COLOR_THEMES[h % len(COLOR_THEMES)]
    template_id = (h >> 4) % 10
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
# FEC Parser (same as v2)
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
# Header Templates (same 10 as v2)
# ─────────────────────────────────────────────────────────

def _p(text, **kw):
    defaults = {"fontName": "Helvetica", "fontSize": 9, "textColor": TEXT_DARK, "leading": 12}
    defaults.update(kw)
    return Paragraph(text, ParagraphStyle("_dyn", **defaults))


def _header_template_0(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    banner = [[_p(f"<b>{issuer}</b>", fontSize=18, textColor=colors.white, fontName="Helvetica-Bold")]]
    t = Table(banner, colWidths=[500])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["primary"]),
        ("TOPPADDING", (0, 0), (-1, -1), 14), ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 15),
    ]))
    elements.append(t)
    if doc_type == "purchase":
        left = f"{eid['address'].replace(chr(10), ' — ')}<br/>Tél. {eid['phone']} — SIRET {eid['siret']}"
        right = f"<b>Destinataire :</b> {COMPANY_NAME}<br/>{COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        left = f"{COMPANY_ADDRESS.replace(chr(10), ' — ')}<br/>Tél. {COMPANY_TEL} — SIRET {COMPANY_SIRET}"
        right = f"<b>Client :</b> {eid['name']}<br/>{eid['address'].replace(chr(10), ', ')}"
    info_bar = [[_p(left, fontSize=7, textColor=TEXT_MUTED), _p(right, fontSize=8, alignment=TA_RIGHT)]]
    t2 = Table(info_bar, colWidths=[280, 220])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["accent"]),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (0, 0), 15), ("RIGHTPADDING", (-1, -1), (-1, -1), 10),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    title_row = [[
        _p("FACTURE", fontSize=22, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"N° <b>{piece_ref}</b><br/>Date : {format_date_fr(piece_date)}", fontSize=9, alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t3 = Table(title_row, colWidths=[300, 200])
    t3.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(t3)
    elements.append(Spacer(1, 6 * mm))
    return elements


def _header_template_1(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    if doc_type == "purchase":
        issuer_detail = (f"{eid['address'].replace(chr(10), '<br/>')}<br/>"
                         f"<font size='7'>SIRET {eid['siret']} — TVA {eid['tva']}</font>")
        recip_detail = f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}"
        issuer = eid["name"]; recipient = COMPANY_NAME
    else:
        issuer_detail = (f"{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                         f"<font size='7'>SIRET {COMPANY_SIRET} — TVA {COMPANY_TVA_INTRA}</font>")
        recip_detail = f"{eid['address'].replace(chr(10), '<br/>')}"
        issuer = COMPANY_NAME; recipient = eid["name"]
    row = [["", _p(f"<b>{issuer}</b><br/>{issuer_detail}", fontSize=9),
            _p(f"<b>{recipient}</b><br/>{recip_detail}", fontSize=9)]]
    t = Table(row, colWidths=[6, 250, 244])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))
    title_row = [[
        _p(f"<b>FACTURE N° {piece_ref}</b>", fontSize=14, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"Date : {format_date_fr(piece_date)}", fontSize=10, alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t2 = Table(title_row, colWidths=[340, 160])
    elements.append(t2)
    elements.append(HRFlowable(width="100%", thickness=2, color=eid["primary"]))
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_2(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    if doc_type == "purchase":
        left_info = (f"<b>{eid['name']}</b><br/>{eid['address'].replace(chr(10), '<br/>')}<br/>"
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
    row = [[_p(left_info, fontSize=9, textColor=colors.white), _p(right_info, fontSize=9)]]
    t = Table(row, colWidths=[220, 280])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("BACKGROUND", (1, 0), (1, 0), eid["accent"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 3 * mm))
    row2 = [[
        _p("FACTURE", fontSize=20, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"<b>N° {piece_ref}</b>  —  {format_date_fr(piece_date)}", fontSize=10, alignment=TA_RIGHT, textColor=eid["secondary"]),
    ]]
    t2 = Table(row2, colWidths=[250, 250])
    t2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_3(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    elements.append(_p(f"<b>{issuer}</b>", fontSize=24, fontName="Helvetica-Bold", textColor=eid["primary"]))
    elements.append(Spacer(1, 1 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.8, color=eid["secondary"]))
    elements.append(Spacer(1, 3 * mm))
    if doc_type == "purchase":
        meta_left = f"{eid['address'].replace(chr(10), ' — ')} — Tél. {eid['phone']}"
        meta_right = f"{COMPANY_NAME} — {COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        meta_left = f"{COMPANY_ADDRESS.replace(chr(10), ' — ')} — Tél. {COMPANY_TEL}"
        meta_right = f"{eid['name']} — {eid['address'].replace(chr(10), ', ')}"
    row = [[_p(meta_left, fontSize=7, textColor=TEXT_MUTED), _p(meta_right, fontSize=7, textColor=TEXT_MUTED, alignment=TA_RIGHT)]]
    t = Table(row, colWidths=[280, 220])
    elements.append(t)
    elements.append(Spacer(1, 6 * mm))
    box = [[
        _p("FACTURE", fontSize=11, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"N° {piece_ref}", fontSize=10, fontName="Helvetica-Bold"),
        _p(f"Date : {format_date_fr(piece_date)}", fontSize=9, textColor=TEXT_MUTED),
        _p(f"Échéance : {eid['payment_term']}", fontSize=9, textColor=TEXT_MUTED, alignment=TA_RIGHT),
    ]]
    t2 = Table(box, colWidths=[100, 150, 130, 120])
    t2.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_4(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    initials = get_entity_initials(issuer)
    if doc_type == "purchase":
        detail = (f"<b>{eid['name']}</b><br/>{eid['address'].replace(chr(10), '<br/>')}<br/>"
                  f"<font size='7'>SIRET {eid['siret']} — TVA {eid['tva']}<br/>Tél. {eid['phone']}</font>")
        recip = f"<b>Facturé à :</b> {COMPANY_NAME}<br/><font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font>"
    else:
        detail = (f"<b>{COMPANY_NAME}</b><br/>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                  f"<font size='7'>SIRET {COMPANY_SIRET} — TVA {COMPANY_TVA_INTRA}<br/>Tél. {COMPANY_TEL}</font>")
        recip = f"<b>Client :</b> {eid['name']}<br/><font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font>"
    row = [[
        _p(f"<b>{initials}</b>", fontSize=28, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER),
        _p(detail, fontSize=9), _p(recip, fontSize=9),
    ]]
    t = Table(row, colWidths=[55, 230, 215])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("VALIGN", (0, 0), (0, 0), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (1, 0), (1, 0), 10),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 2 * mm))
    row2 = [[
        _p(f"<b>FACTURE</b>  N° {piece_ref}", fontSize=13, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"Du {format_date_fr(piece_date)}", fontSize=10, alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t2 = Table(row2, colWidths=[350, 150])
    t2.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 1.5, eid["secondary"]), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_5(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    bar = [[_p("", fontSize=2)]]
    t = Table(bar, colWidths=[500])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), eid["primary"]),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))
    if doc_type == "purchase":
        left = (f"<b>{eid['name']}</b><br/><font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font><br/>"
                f"<font size='7' color='#718096'>Tél. {eid['phone']} — SIRET {eid['siret']}</font>")
        right = f"<b>Destinataire</b><br/>{COMPANY_NAME}<br/><font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font>"
    else:
        left = (f"<b>{COMPANY_NAME}</b><br/><font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font><br/>"
                f"<font size='7' color='#718096'>Tél. {COMPANY_TEL} — SIRET {COMPANY_SIRET}</font>")
        right = f"<b>Client</b><br/>{eid['name']}<br/><font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font>"
    card = [[_p(left, fontSize=9), _p(right, fontSize=9)]]
    t2 = Table(card, colWidths=[260, 240])
    t2.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, eid["secondary"]),
        ("LINEAFTER", (0, 0), (0, 0), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    row3 = [[
        _p(f"<b>FACTURE N° {piece_ref}</b>", fontSize=14, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"{format_date_fr(piece_date)} — {eid['payment_term']}", fontSize=9, alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t3 = Table(row3, colWidths=[300, 200])
    elements.append(t3)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_6(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    block = [
        [_p(f"<b>{issuer}</b>", fontSize=16, fontName="Helvetica-Bold", textColor=colors.white),
         _p("<b>FACTURE</b>", fontSize=20, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_RIGHT)],
        [_p(f"N° {piece_ref}  —  {format_date_fr(piece_date)}", fontSize=9, textColor=HexColor("#ffffff99")), ""],
    ]
    t = Table(block, colWidths=[300, 200])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["primary"]),
        ("TOPPADDING", (0, 0), (-1, 0), 15), ("BOTTOMPADDING", (0, -1), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (0, -1), 15), ("RIGHTPADDING", (-1, 0), (-1, 0), 15),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))
    if doc_type == "purchase":
        left = f"<b>De :</b> {eid['address'].replace(chr(10), ', ')} — Tél. {eid['phone']}"
        right = f"<b>À :</b> {COMPANY_NAME}, {COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        left = f"<b>De :</b> {COMPANY_ADDRESS.replace(chr(10), ', ')} — Tél. {COMPANY_TEL}"
        right = f"<b>À :</b> {eid['name']}, {eid['address'].replace(chr(10), ', ')}"
    addr = [[_p(left, fontSize=8, textColor=TEXT_MUTED), _p(right, fontSize=8, textColor=TEXT_MUTED, alignment=TA_RIGHT)]]
    t2 = Table(addr, colWidths=[270, 230])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["accent"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 10), ("RIGHTPADDING", (-1, -1), (-1, -1), 10),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 6 * mm))
    return elements


def _header_template_7(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    elements.append(HRFlowable(width="100%", thickness=3, color=eid["primary"]))
    elements.append(Spacer(1, 3 * mm))
    if doc_type == "purchase":
        left = (f"<b>{eid['name']}</b><br/>{eid['address'].replace(chr(10), '<br/>')}<br/>"
                f"<font size='7'>SIRET {eid['siret']}</font>")
        right = f"<b>Client :</b><br/>{COMPANY_NAME}<br/><font size='8'>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}</font>"
    else:
        left = (f"<b>{COMPANY_NAME}</b><br/>{COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>"
                f"<font size='7'>SIRET {COMPANY_SIRET}</font>")
        right = f"<b>Client :</b><br/>{eid['name']}<br/><font size='8'>{eid['address'].replace(chr(10), '<br/>')}</font>"
    row = [[_p(left, fontSize=9), _p(right, fontSize=9, alignment=TA_RIGHT)]]
    t = Table(row, colWidths=[280, 220])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(t)
    elements.append(Spacer(1, 3 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=eid["secondary"]))
    elements.append(Spacer(1, 4 * mm))
    row2 = [[
        _p("<b>FACTURE</b>", fontSize=16, fontName="Helvetica-Bold", textColor=eid["primary"]),
        _p(f"N° {piece_ref}", fontSize=12, fontName="Helvetica-Bold", textColor=eid["secondary"]),
        _p(format_date_fr(piece_date), fontSize=10, alignment=TA_RIGHT, textColor=TEXT_MUTED),
    ]]
    t2 = Table(row2, colWidths=[140, 200, 160])
    t2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_8(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    elements.append(_p(f"<b>{issuer}</b>", fontSize=26, fontName="Helvetica-Bold", textColor=eid["primary"]))
    elements.append(Spacer(1, 1 * mm))
    bar = [[""]]
    t = Table(bar, colWidths=[180])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), eid["secondary"]),
        ("TOPPADDING", (0, 0), (0, 0), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("LINEBELOW", (0, 0), (0, 0), 4, eid["secondary"])]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))
    if doc_type == "purchase":
        meta = f"{eid['address'].replace(chr(10), ' — ')} — SIRET {eid['siret']} — Tél. {eid['phone']}"
    else:
        meta = f"{COMPANY_ADDRESS.replace(chr(10), ' — ')} — SIRET {COMPANY_SIRET} — Tél. {COMPANY_TEL}"
    elements.append(_p(meta, fontSize=7, textColor=TEXT_MUTED))
    elements.append(Spacer(1, 5 * mm))
    if doc_type == "purchase":
        recip = f"<b>Destinataire :</b> {COMPANY_NAME}, {COMPANY_ADDRESS.replace(chr(10), ', ')}"
    else:
        recip = f"<b>Client :</b> {eid['name']}, {eid['address'].replace(chr(10), ', ')}"
    row = [[_p(recip, fontSize=9),
            _p(f"<b>FACTURE N° {piece_ref}</b><br/>{format_date_fr(piece_date)}", fontSize=10, alignment=TA_RIGHT,
               textColor=eid["primary"], fontName="Helvetica-Bold")]]
    t2 = Table(row, colWidths=[320, 180])
    t2.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))
    return elements


def _header_template_9(eid, doc_type, piece_ref, piece_date, info):
    elements = []
    issuer = eid["name"] if doc_type == "purchase" else COMPANY_NAME
    bar = [[
        _p(f"<b>{issuer}</b>", fontSize=14, fontName="Helvetica-Bold", textColor=colors.white),
        _p(f"FACTURE  N° {piece_ref}", fontSize=12, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_RIGHT),
    ]]
    t = Table(bar, colWidths=[300, 200])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), eid["primary"]),
        ("BACKGROUND", (1, 0), (1, 0), eid["secondary"]),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (0, 0), 12), ("RIGHTPADDING", (-1, -1), (-1, -1), 12),
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
    t2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2)]))
    elements.append(t2)
    elements.append(Spacer(1, 3 * mm))
    meta_row = [[
        _p(f"Date : <b>{format_date_fr(piece_date)}</b>", fontSize=9),
        _p(f"Échéance : <b>{eid['payment_term']}</b>", fontSize=9, alignment=TA_RIGHT),
    ]]
    t3 = Table(meta_row, colWidths=[250, 250])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), eid["accent"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 10), ("RIGHTPADDING", (-1, -1), (-1, -1), 10),
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
# FAULT INJECTION ENGINE
# ─────────────────────────────────────────────────────────

# All entity names from the FEC for cross-entity faults
ALL_ENTITY_NAMES = []

# Typo mutations for entity names
TYPO_OPS = [
    lambda s: s[:len(s)//2] + s[len(s)//2].swapcase() + s[len(s)//2+1:] if len(s) > 2 else s,  # swap case mid
    lambda s: s.replace(" SA", " S.A.") if " SA" in s else s.replace(" SAS", " S.A.S."),  # legal form variation
    lambda s: s[0] + s[2] + s[1] + s[3:] if len(s) > 3 else s,  # transpose chars 1-2
    lambda s: s.replace("é", "e").replace("è", "e").replace("ê", "e") if any(c in s for c in "éèê") else s + "s",  # accent strip or add s
    lambda s: s.rstrip("s") if s.endswith("s") else s + "s",  # add/remove trailing s
    lambda s: s.replace(" ", "  ", 1),  # double space
]


def inject_faults(info: dict, piece_ref: str, piece_date: datetime,
                  entity_name: str, rng: random.Random) -> tuple:
    """
    Returns (faulted_info, faulted_ref, faulted_date, faulted_entity, fault_list).
    fault_list = [{"code": "F01", "description": "...", "detail": {...}}, ...]
    """
    info = deepcopy(info)
    faults = []

    # Choose 1-2 faults per PDF (weighted)
    fault_pool = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10", "F11", "F12"]
    weights =    [  15,    12,    12,    8,     8,     6,     15,    8,      8,     5,      5,     8  ]
    num_faults = rng.choices([1, 2, 3], weights=[60, 30, 10])[0]
    chosen = []
    pool = list(zip(fault_pool, weights))
    for _ in range(num_faults):
        if not pool:
            break
        codes, wts = zip(*pool)
        pick = rng.choices(codes, weights=wts)[0]
        chosen.append(pick)
        pool = [(c, w) for c, w in pool if c != pick]

    for fault_code in chosen:

        if fault_code == "F01":
            # TVA calculation error — shift TVA by a small amount
            if info["tva_lines"]:
                idx = 0
                original_tva = info["tva_lines"][idx]["debit"] + info["tva_lines"][idx]["credit"]
                shift = rng.choice([0.01, 0.10, 0.50, 1.00, 2.37, -0.15, -1.00, 3.42, -0.89, 5.60])
                if info["tva_lines"][idx]["debit"] > 0:
                    info["tva_lines"][idx]["debit"] += shift
                else:
                    info["tva_lines"][idx]["credit"] += shift
                faults.append({
                    "code": "F01", "description": "TVA calculation error",
                    "detail": {"original_tva": round(original_tva, 2),
                               "shown_tva": round(original_tva + shift, 2),
                               "shift": round(shift, 2)}
                })

        elif fault_code == "F02":
            # Total TTC mismatch — we'll handle this in PDF generation via a flag
            shift = rng.choice([0.01, -0.01, 0.50, -0.50, 1.00, -1.00, 2.00, 10.00])
            faults.append({
                "code": "F02", "description": "Total TTC doesn't match HT + TVA",
                "detail": {"ttc_shift": round(shift, 2)}
            })

        elif fault_code == "F03":
            # Date shift — move invoice date by a few days
            days = rng.choice([-15, -7, -3, -1, 1, 3, 5, 10, 14, 30])
            original = piece_date
            piece_date = piece_date + timedelta(days=days)
            faults.append({
                "code": "F03", "description": "Invoice date shifted from FEC date",
                "detail": {"original_date": format_date_fr(original),
                           "shown_date": format_date_fr(piece_date),
                           "shift_days": days}
            })

        elif fault_code == "F04":
            # Entity name typo
            original_name = entity_name
            op = rng.choice(TYPO_OPS)
            entity_name = op(entity_name)
            if entity_name == original_name:
                entity_name = original_name[:-1] + rng.choice("aeio")
            faults.append({
                "code": "F04", "description": "Entity name contains typo",
                "detail": {"original": original_name, "shown": entity_name}
            })

        elif fault_code == "F05":
            # Missing SIRET — handled in PDF generation via flag
            faults.append({
                "code": "F05", "description": "Missing SIRET number on invoice",
                "detail": {"field": "siret", "value": "removed"}
            })

        elif fault_code == "F06":
            # Duplicate invoice number — reuse another entry's ref
            alt_refs = [str(rng.randint(1, 9999)) for _ in range(3)]
            old_ref = piece_ref
            piece_ref = rng.choice(alt_refs)
            faults.append({
                "code": "F06", "description": "Invoice number potentially duplicated",
                "detail": {"original_ref": old_ref, "shown_ref": piece_ref}
            })

        elif fault_code == "F07":
            # Amount rounding error on a line item
            if info["line_items"]:
                idx = rng.randint(0, len(info["line_items"]) - 1)
                field = "debit" if info["line_items"][idx]["debit"] > 0 else "credit"
                original = info["line_items"][idx][field]
                shift = rng.choice([0.01, -0.01, 0.10, -0.10, 0.50, -0.50, 0.99, -0.99])
                info["line_items"][idx][field] = round(original + shift, 2)
                faults.append({
                    "code": "F07", "description": "Line item amount rounding error",
                    "detail": {"line_index": idx,
                               "original_amount": round(original, 2),
                               "shown_amount": round(original + shift, 2),
                               "shift": round(shift, 2)}
                })

        elif fault_code == "F08":
            # Wrong TVA rate label — show 20% but actual calc is different
            faults.append({
                "code": "F08", "description": "Displayed TVA rate doesn't match actual calculation",
                "detail": {"shown_rate": "20.0%", "note": "Rate label forced to 20% regardless of actual"}
            })

        elif fault_code == "F09":
            # Temporal cutoff — shift Dec → Jan or Jan → Dec
            if piece_date.month == 12:
                original = piece_date
                piece_date = piece_date.replace(year=piece_date.year + 1, month=1, day=min(piece_date.day, 28))
                faults.append({
                    "code": "F09", "description": "Temporal cutoff issue — December shifted to January",
                    "detail": {"original": format_date_fr(original), "shown": format_date_fr(piece_date)}
                })
            elif piece_date.month == 1:
                original = piece_date
                piece_date = piece_date.replace(year=piece_date.year - 1, month=12, day=min(piece_date.day, 28))
                faults.append({
                    "code": "F09", "description": "Temporal cutoff issue — January shifted to December",
                    "detail": {"original": format_date_fr(original), "shown": format_date_fr(piece_date)}
                })
            else:
                # Shift to adjacent month
                original = piece_date
                direction = rng.choice([-1, 1])
                new_month = piece_date.month + direction
                new_year = piece_date.year
                if new_month < 1:
                    new_month = 12; new_year -= 1
                elif new_month > 12:
                    new_month = 1; new_year += 1
                piece_date = piece_date.replace(year=new_year, month=new_month, day=min(piece_date.day, 28))
                faults.append({
                    "code": "F09", "description": "Temporal cutoff issue — date shifted to adjacent month",
                    "detail": {"original": format_date_fr(original), "shown": format_date_fr(piece_date)}
                })

        elif fault_code == "F10":
            # Swapped debit/credit on a line
            if info["line_items"]:
                idx = rng.randint(0, len(info["line_items"]) - 1)
                item = info["line_items"][idx]
                old_d, old_c = item["debit"], item["credit"]
                item["debit"], item["credit"] = old_c, old_d
                faults.append({
                    "code": "F10", "description": "Debit/Credit columns swapped on line item",
                    "detail": {"line_index": idx,
                               "original_debit": old_d, "original_credit": old_c,
                               "shown_debit": item["debit"], "shown_credit": item["credit"]}
                })

        elif fault_code == "F11":
            # Missing payment terms
            faults.append({
                "code": "F11", "description": "Missing payment terms on invoice",
                "detail": {"field": "payment_terms", "value": "removed"}
            })

        elif fault_code == "F12":
            # Wrong entity — show a completely different entity name in header
            if ALL_ENTITY_NAMES:
                original_name = entity_name
                candidates = [n for n in ALL_ENTITY_NAMES if n != original_name]
                if candidates:
                    entity_name = rng.choice(candidates)
                    faults.append({
                        "code": "F12", "description": "Wrong entity shown on invoice header",
                        "detail": {"expected": original_name, "shown": entity_name}
                    })

    return info, piece_ref, piece_date, entity_name, faults


# ─────────────────────────────────────────────────────────
# Faulty Invoice PDF Generator
# ─────────────────────────────────────────────────────────

def generate_faulty_invoice_pdf(entry_data: dict, doc_type: str, output_path: str,
                                 fault_seed: int) -> list:
    """Generate one invoice PDF with injected faults. Returns fault list."""
    rng = random.Random(fault_seed)

    info = classify_entry_lines(entry_data["lines"])
    entity_name = info["entity_name"] or "Fournisseur Inconnu"
    piece_ref = info["piece_ref"] or entry_data["ecriture_num"]
    piece_date = info["piece_date"] or datetime(2024, 1, 1)

    # Inject faults
    info, piece_ref, piece_date, entity_name, faults = inject_faults(
        info, piece_ref, piece_date, entity_name, rng
    )

    # Check fault flags
    has_f02 = any(f["code"] == "F02" for f in faults)
    ttc_shift = 0
    if has_f02:
        ttc_shift = [f["detail"]["ttc_shift"] for f in faults if f["code"] == "F02"][0]

    has_f05 = any(f["code"] == "F05" for f in faults)
    has_f08 = any(f["code"] == "F08" for f in faults)
    has_f11 = any(f["code"] == "F11" for f in faults)

    # Entity identity (use possibly-faulted name for header display)
    eid = get_entity_identity(entity_name)

    # If F05: blank out SIRET
    if has_f05:
        eid["siret"] = ""
        eid["tva"] = ""

    # Select header template
    template_fn = HEADER_TEMPLATES[eid["template_id"]]
    elements = template_fn(eid, doc_type, piece_ref, piece_date, info)

    # ── Line items table ──
    table_header = [
        _p("Compte", fontSize=8, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER),
        _p("Désignation", fontSize=8, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER),
        _p("Montant HT", fontSize=8, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER),
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
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 4 * mm))

    # ── Totals ──
    tva_total = sum(l["debit"] + l["credit"] for l in info["tva_lines"])
    ttc_total = ht_total + tva_total + ttc_shift  # F02 shifts TTC

    # F08: force displayed rate to 20% regardless of actual
    if has_f08:
        tva_rate = " (20.0%)"
    else:
        tva_rate = ""
        if ht_total > 0 and tva_total > 0:
            tva_rate = f" ({(tva_total / ht_total) * 100:.1f}%)"

    totals_data = [
        ["",
         _p("Total HT", fontSize=9, fontName="Helvetica-Bold", textColor=eid["primary"], alignment=TA_RIGHT),
         _p(format_amount_eur(ht_total), fontSize=9, fontName="Helvetica-Bold", textColor=eid["primary"], alignment=TA_RIGHT)],
        ["",
         _p(f"TVA{tva_rate}", fontSize=9, fontName="Helvetica-Bold", textColor=eid["primary"], alignment=TA_RIGHT),
         _p(format_amount_eur(tva_total), fontSize=9, fontName="Helvetica-Bold", textColor=eid["primary"], alignment=TA_RIGHT)],
        ["",
         _p("TOTAL TTC", fontSize=11, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_RIGHT),
         _p(format_amount_eur(ttc_total), fontSize=11, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_RIGHT)],
    ]
    totals_table = Table(totals_data, colWidths=[260, 140, 100])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
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

    if has_f11:
        # F11: missing payment terms
        if doc_type == "purchase":
            footer = (
                f"<b>Mode de règlement :</b> Virement bancaire<br/>"
                f"<font size='7' color='#718096'>"
                f"En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, "
                f"ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (Art. L.441-10 C. com.)."
                f"</font>"
            )
        else:
            footer = (
                f"<b>Coordonnées bancaires :</b> {BANK_ACCOUNTS['BAN2']}<br/>"
                f"<font size='7' color='#718096'>"
                f"{COMPANY_NAME} — Capital social : {COMPANY_CAPITAL} — "
                f"SIRET : {COMPANY_SIRET} — TVA : {COMPANY_TVA_INTRA} — {COMPANY_RCS}"
                f"</font>"
            )
    else:
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
    return faults


# ─────────────────────────────────────────────────────────
# Worker
# ─────────────────────────────────────────────────────────

def worker_faulty(args):
    entry_data, doc_type, output_path, fault_seed = args
    try:
        faults = generate_faulty_invoice_pdf(entry_data, doc_type, output_path, fault_seed)
        return ("ok", output_path, faults)
    except Exception as e:
        return ("error", f"{output_path}: {e}", [])


# ─────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Faulty PDF Generator for Sof'IA testing")
    parser.add_argument("--input", "-i",
        default="/Users/yoannabriel/Downloads/DGI_LET_2024.txt")
    parser.add_argument("--output", "-o",
        default="/Users/yoannabriel/Documents/GitHub.nosync/Sof-IA/generated_pdfs_faulty")
    parser.add_argument("--workers", "-w", type=int, default=8)
    parser.add_argument("--fault-rate", "-f", type=float, default=0.15,
        help="Fraction of entries to inject faults into (default: 0.15 = 15%%)")
    parser.add_argument("--seed", "-s", type=int, default=42,
        help="Random seed for reproducible fault selection")
    args = parser.parse_args()

    output_dir = args.output
    fault_rate = args.fault_rate
    master_seed = args.seed
    rng = random.Random(master_seed)

    print(f"╔══════════════════════════════════════════════════════════╗")
    print(f"║  Faulty PDF Generator — Sof'IA Test Data                 ║")
    print(f"║  12 fault types · ~{fault_rate*100:.0f}% injection rate              ║")
    print(f"║  Seed: {master_seed} (reproducible)                              ║")
    print(f"╠══════════════════════════════════════════════════════════╣")
    print(f"║  Input:   {os.path.basename(args.input):<45}║")
    print(f"║  Output:  {output_dir:<45}║")
    print(f"╚══════════════════════════════════════════════════════════╝")
    print()

    t0 = time.time()

    # Parse FEC
    print("  Parsing FEC file...")
    journals = parse_fec(args.input)
    total_entries = sum(len(j) for j in journals.values())
    print(f"  → {total_entries} entries across {len(journals)} journals")

    # Collect all entity names for F12 (cross-entity) faults
    global ALL_ENTITY_NAMES
    entity_set = set()
    for jcode in ["ACH", "VT", "FG"]:
        if jcode in journals:
            for enum, lines in journals[jcode].items():
                info = classify_entry_lines(lines)
                if info["entity_name"]:
                    entity_set.add(info["entity_name"])
    ALL_ENTITY_NAMES = list(entity_set)
    print(f"  → {len(ALL_ENTITY_NAMES)} unique entities found")

    # Select entries to fault
    invoice_journals = {"ACH": "purchase", "VT": "sale", "FG": "purchase"}
    all_entries = []
    for jcode, doc_type in invoice_journals.items():
        if jcode in journals:
            for enum, lines in journals[jcode].items():
                all_entries.append((jcode, enum, lines, doc_type))

    total_invoices = len(all_entries)
    num_faulty = max(1, int(total_invoices * fault_rate))

    # Deterministic selection of which entries get faults
    faulty_indices = set(rng.sample(range(total_invoices), min(num_faulty, total_invoices)))
    print(f"  → {len(faulty_indices)} / {total_invoices} invoices selected for fault injection")
    print()

    # Prepare output dirs
    base_dirs = {
        "achat": os.path.join(output_dir, "01_Factures_Achat"),
        "vente": os.path.join(output_dir, "02_Factures_Vente"),
        "fg": os.path.join(output_dir, "03_Frais_Generaux"),
    }
    for d in base_dirs.values():
        os.makedirs(d, exist_ok=True)

    # Build tasks
    tasks = []
    manifest_entries = []

    jcode_to_dir = {"ACH": "achat", "VT": "vente", "FG": "fg"}

    for idx, (jcode, enum, lines, doc_type) in enumerate(all_entries):
        if idx not in faulty_indices:
            continue

        info = classify_entry_lines(lines)
        entity = info["entity_name"] or "Divers"
        entity_dir = os.path.join(base_dirs[jcode_to_dir[jcode]], safe_dirname(entity))
        os.makedirs(entity_dir, exist_ok=True)

        piece = safe_filename(info["piece_ref"]) or enum
        fname = f"FAULTY_{jcode}_{enum}_{piece}.pdf"
        path = os.path.join(entity_dir, fname)
        entry_data = {"lines": lines, "ecriture_num": enum, "journal": jcode}
        fault_seed = rng.randint(0, 2**31)
        tasks.append((entry_data, doc_type, path, fault_seed))

        manifest_entries.append({
            "index": idx,
            "journal": jcode,
            "ecriture_num": enum,
            "entity": entity,
            "piece_ref": info["piece_ref"],
            "filename": fname,
            "path": path,
            "fault_seed": fault_seed,
            "faults": [],  # filled after generation
        })

    print(f"  {len(tasks)} faulty PDFs to generate")
    print(f"  Generating with {args.workers} workers...")

    # Generate
    success = errors = 0
    fault_counts = defaultdict(int)

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        futures = {}
        for i, task in enumerate(tasks):
            fut = executor.submit(worker_faulty, task)
            futures[fut] = i
        done_count = 0
        for fut in as_completed(futures):
            done_count += 1
            idx_map = futures[fut]
            status, path_or_msg, faults = fut.result()
            if status == "ok":
                success += 1
                manifest_entries[idx_map]["faults"] = faults
                for f in faults:
                    fault_counts[f["code"]] += 1
            else:
                errors += 1
                manifest_entries[idx_map]["faults"] = [{"code": "ERR", "description": str(path_or_msg)}]
            if done_count % 50 == 0 or done_count == len(tasks):
                elapsed = time.time() - t0
                print(f"    [{done_count}/{len(tasks)}] {done_count/len(tasks)*100:.0f}%")

    elapsed = time.time() - t0

    # Write manifest
    manifest_path = os.path.join(output_dir, "fault_manifest.json")
    manifest = {
        "generated_at": datetime.now().isoformat(),
        "seed": master_seed,
        "fault_rate": fault_rate,
        "total_invoices_in_fec": total_invoices,
        "total_faulty_pdfs": len(tasks),
        "success": success,
        "errors": errors,
        "fault_type_counts": dict(fault_counts),
        "fault_types": {
            "F01": "TVA calculation error — TVA amount doesn't match HT × rate",
            "F02": "Total TTC mismatch — TTC ≠ HT + TVA",
            "F03": "Date shift — invoice date different from FEC entry date",
            "F04": "Entity name typo — subtle misspelling",
            "F05": "Missing SIRET — SIRET/TVA fields blank",
            "F06": "Duplicate/wrong invoice number — piece_ref swapped",
            "F07": "Amount rounding error — line item off by centimes",
            "F08": "Wrong TVA rate label — displayed rate doesn't match calculation",
            "F09": "Temporal cutoff issue — date shifted to wrong period",
            "F10": "Swapped debit/credit — amount in wrong column",
            "F11": "Missing payment terms — no conditions shown",
            "F12": "Wrong entity on invoice — header shows different entity",
        },
        "entries": manifest_entries,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, default=str)

    # Summary
    print()
    print(f"  ═══════════════════════════════════════════════════════")
    print(f"  DONE — {success} faulty PDFs in {elapsed:.1f}s — {errors} errors")
    print(f"  ═══════════════════════════════════════════════════════")
    print()
    print(f"  Fault distribution:")
    for code in sorted(fault_counts.keys()):
        desc = manifest["fault_types"].get(code, "?")
        print(f"    {code}: {fault_counts[code]:>4}x  — {desc}")
    print()
    print(f"  Total faults injected: {sum(fault_counts.values())}")
    print(f"  Avg faults per PDF:    {sum(fault_counts.values())/max(success,1):.1f}")
    print()
    print(f"  Manifest: {manifest_path}")
    print(f"  Output:   {output_dir}/")
    for label, d in base_dirs.items():
        if os.path.exists(d):
            total = sum(1 for root, dirs, files in os.walk(d) for f in files if f.endswith(".pdf"))
            if total > 0:
                print(f"    {os.path.basename(d)}/  {total} PDFs")


if __name__ == "__main__":
    main()
