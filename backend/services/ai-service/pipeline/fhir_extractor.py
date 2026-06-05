"""
MediLedger Nigeria — FHIR R4 Feature Extractor
Parses FHIR R4 bundles from patient vaults and extracts the 42 structured features
required by the TabNet disease detection model.
Raw patient data is NEVER written to disk — processed in memory only.
"""
from __future__ import annotations

import math
from datetime import date, datetime
from typing import Any

import numpy as np

from models.disease_detector import FEATURE_ORDER, N_FEATURES

# ── LOINC codes of interest ───────────────────────────────────────────────────
LOINC_GLUCOSE       = "2339-0"
LOINC_HEMOGLOBIN    = "718-7"
LOINC_FERRITIN      = "2276-4"
LOINC_VITAMIN_D     = "1751-7"
LOINC_HBA1C         = "4548-4"
LOINC_MCV           = "785-6"
LOINC_PLATELETS     = "777-3"
LOINC_WBC           = "6690-2"
LOINC_RBC           = "789-8"
LOINC_BP_SYSTOLIC   = "8480-6"
LOINC_BP_DIASTOLIC  = "8462-4"
LOINC_BMI           = "39156-5"
LOINC_WEIGHT        = "29463-7"
LOINC_HEIGHT        = "8302-2"

# Nigerian geopolitical zones
GEO_ZONES = {
    "Lagos": 0, "Ogun": 0, "Oyo": 0, "Osun": 0, "Ondo": 0, "Ekiti": 0,   # Southwest
    "Kano": 1, "Kaduna": 1, "Katsina": 1, "Jigawa": 1, "Sokoto": 1,       # Northwest
    "Borno": 2, "Yobe": 2, "Adamawa": 2, "Taraba": 2, "Gombe": 2,         # Northeast
    "FCT": 3, "Niger": 3, "Kogi": 3, "Kwara": 3, "Nasarawa": 3, "Benue": 3, "Plateau": 3,  # Northcentral
    "Enugu": 4, "Ebonyi": 4, "Anambra": 4, "Imo": 4, "Abia": 4,           # Southeast
    "Cross River": 5, "Akwa Ibom": 5, "Rivers": 5, "Bayelsa": 5, "Delta": 5, "Edo": 5,     # Southsouth
}

MALARIA_ICD = {"B50", "B51", "B52", "B53", "B54"}


def extract_features(fhir_bundle: dict) -> np.ndarray:
    """
    Parse a FHIR R4 Bundle and return a (N_FEATURES,) float32 feature vector.
    Missing values → NaN (imputed downstream before inference).
    """
    feat: dict[str, float] = {k: float("nan") for k in FEATURE_ORDER}
    entries = fhir_bundle.get("entry", [])

    obs_by_loinc: dict[str, list[float]] = {}

    for entry in entries:
        res = entry.get("resource", {})
        rtype = res.get("resourceType")

        if rtype == "Observation":
            _parse_observation(res, obs_by_loinc, feat)
        elif rtype == "Condition":
            _parse_condition(res, feat)
        elif rtype == "MedicationStatement":
            _parse_medication(res, feat)
        elif rtype == "Immunization":
            _parse_immunization(res, feat)
        elif rtype == "Patient":
            _parse_patient(res, feat)
        elif rtype == "Encounter":
            _parse_encounter(res, feat)

    # Derive trend features (latest vs 2nd-to-latest)
    for loinc, field_prefix in [
        (LOINC_GLUCOSE, "lab_2339-0"),
        (LOINC_HEMOGLOBIN, "lab_718-7"),
        (LOINC_HBA1C, "lab_4548-4"),
    ]:
        vals = obs_by_loinc.get(loinc, [])
        if len(vals) >= 2:
            feat[f"{field_prefix}_trend"] = vals[-1] - vals[-2]
        elif len(vals) == 1:
            feat[f"{field_prefix}_trend"] = 0.0

    return np.array([feat.get(k, float("nan")) for k in FEATURE_ORDER], dtype=np.float32)


def _parse_observation(res: dict, obs_by_loinc: dict, feat: dict) -> None:
    coding = res.get("code", {}).get("coding", [{}])
    loinc = next((c.get("code") for c in coding if c.get("system", "").endswith("loinc.org")), None)
    if not loinc:
        return

    val_qty = res.get("valueQuantity", {})
    value = val_qty.get("value")
    if value is None:
        return

    obs_by_loinc.setdefault(loinc, []).append(float(value))

    loinc_map = {
        LOINC_GLUCOSE:     "lab_2339-0_latest",
        LOINC_HEMOGLOBIN:  "lab_718-7_latest",
        LOINC_FERRITIN:    "lab_2276-4_latest",
        LOINC_VITAMIN_D:   "lab_1751-7_latest",
        LOINC_HBA1C:       "lab_4548-4_latest",
        LOINC_MCV:         "lab_785-6_latest",
        LOINC_PLATELETS:   "lab_777-3_latest",
        LOINC_WBC:         "lab_6690-2_latest",
        LOINC_RBC:         "lab_789-8_latest",
        LOINC_BMI:         "bmi",
        LOINC_WEIGHT:      "weight_kg",
        LOINC_HEIGHT:      "height_cm",
        LOINC_BP_SYSTOLIC: "bp_systolic",
        LOINC_BP_DIASTOLIC: "bp_diastolic",
    }
    if loinc in loinc_map:
        feat[loinc_map[loinc]] = float(value)


def _parse_condition(res: dict, feat: dict) -> None:
    coding = res.get("code", {}).get("coding", [{}])
    icd10 = next((c.get("code", "")[:3] for c in coding if "icd-10" in c.get("system", "").lower()), None)
    if not icd10:
        return

    icd_flag_map = {
        "E11": "has_condition_E11",
        "I10": "has_condition_I10",
        "D50": "has_condition_D50",
        "D57": "has_condition_D57",
        "A15": "has_condition_A15",
    }
    for code_prefix, flag in icd_flag_map.items():
        if icd10.startswith(code_prefix):
            feat[flag] = 1.0

    if icd10 in MALARIA_ICD:
        feat["has_condition_B50"] = 1.0


def _parse_medication(res: dict, feat: dict) -> None:
    med_code = res.get("medicationCodeableConcept", {}).get("coding", [{}])
    rxnorm = next((c.get("code") for c in med_code if "rxnorm" in c.get("system", "").lower()), "")

    # Simplified mappings — expand with full RxNorm lookup in production
    if rxnorm in {"860975", "860977"}:          feat["on_medication_metformin"] = 1.0
    elif rxnorm in {"197375", "153165"}:        feat["on_medication_antihypertensive"] = 1.0
    elif rxnorm in {"1151", "203164"}:          feat["on_medication_antimalarial"] = 1.0
    elif rxnorm in {"1736", "2102"}:            feat["on_medication_iron"] = 1.0
    elif rxnorm in {"744842", "349257"}:        feat["on_medication_arvs"] = 1.0


def _parse_immunization(res: dict, feat: dict) -> None:
    vaccine = res.get("vaccineCode", {}).get("coding", [{}])
    cvx = next((c.get("code") for c in vaccine if "cvx" in c.get("system", "").lower()), "")

    if cvx in {"208", "212"}:   feat["vaccinated_covid19"] = 1.0
    elif cvx == "37":           feat["vaccinated_yellow_fever"] = 1.0

    occurrence = res.get("occurrenceDateTime", "")
    if occurrence:
        try:
            occ_date = datetime.fromisoformat(occurrence[:10]).date()
            feat["days_since_last_vaccination"] = float((date.today() - occ_date).days)
        except ValueError:
            pass


def _parse_patient(res: dict, feat: dict) -> None:
    dob = res.get("birthDate", "")
    if dob:
        try:
            birth = datetime.fromisoformat(dob).date()
            feat["age_years"] = float((date.today() - birth).days / 365.25)
        except ValueError:
            pass

    gender_map = {"male": 1.0, "female": 0.0, "other": 2.0, "unknown": float("nan")}
    feat["gender_encoded"] = gender_map.get(res.get("gender", "unknown"), float("nan"))

    # Derive geopolitical zone from address state
    state = next(
        (a.get("state", "") for a in res.get("address", [])),
        "",
    )
    feat["state_encoded"] = float(GEO_ZONES.get(state, 3))  # Default: northcentral


def _parse_encounter(res: dict, feat: dict) -> None:
    period_start = res.get("period", {}).get("start", "")
    if not period_start:
        return

    try:
        enc_date = datetime.fromisoformat(period_start[:10]).date()
        if (date.today() - enc_date).days <= 365:
            feat["total_encounters_12m"] = feat.get("total_encounters_12m", 0.0) + 1.0
    except ValueError:
        pass

    enc_class = res.get("class", {}).get("code", "").lower()
    if enc_class in {"emergency", "emer"}:
        feat["er_visits_12m"] = feat.get("er_visits_12m", 0.0) + 1.0
    elif enc_class in {"inpatient", "imp"}:
        feat["hospitalizations_12m"] = feat.get("hospitalizations_12m", 0.0) + 1.0


def impute_features(features: np.ndarray, global_medians: np.ndarray) -> np.ndarray:
    """Replace NaN values with global medians from training statistics."""
    result = features.copy()
    nan_mask = np.isnan(result)
    result[nan_mask] = global_medians[nan_mask]
    return result
