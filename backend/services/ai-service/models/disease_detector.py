"""
MediLedger Nigeria — Disease Detection Model
TabNet-based multi-label classifier for 15 Nigerian disease risk flags.
Trained via federated learning across 47 partner hospitals.
"""
from __future__ import annotations

import numpy as np
from pytorch_tabnet.tab_model import TabNetClassifier

# ── Feature specification (42 structured features from FHIR R4) ──────────────
FEATURE_ORDER = [
    # Lab values (LOINC codes)
    "lab_2339-0_latest",   # Glucose [Mass/volume] in Blood
    "lab_2339-0_trend",
    "lab_718-7_latest",    # Hemoglobin [Mass/volume] in Blood
    "lab_718-7_trend",
    "lab_2276-4_latest",   # Ferritin [Mass/volume] in Serum or Plasma
    "lab_1751-7_latest",   # 25-OH Vitamin D
    "lab_4548-4_latest",   # HbA1c
    "lab_4548-4_trend",
    "lab_785-6_latest",    # MCV (mean corpuscular volume)
    "lab_777-3_latest",    # Platelets
    "lab_6690-2_latest",   # WBC count
    "lab_789-8_latest",    # RBC count
    # Vitals
    "bp_systolic",
    "bp_diastolic",
    "bmi",
    "weight_kg",
    "height_cm",
    # Demographics
    "age_years",
    "gender_encoded",      # 0=female, 1=male, 2=other
    "state_encoded",       # Nigerian geopolitical zone (0-5)
    # Conditions (presence flags)
    "has_condition_E11",   # Diabetes
    "has_condition_I10",   # Hypertension
    "has_condition_D50",   # IDA
    "has_condition_B50",   # Malaria
    "has_condition_D57",   # Sickle cell
    "has_condition_A15",   # TB
    # Encounter history
    "total_encounters_12m",
    "er_visits_12m",
    "hospitalizations_12m",
    # Medication flags
    "on_medication_metformin",
    "on_medication_antihypertensive",
    "on_medication_antimalarial",
    "on_medication_iron",
    "on_medication_arvs",
    # Immunization
    "vaccinated_covid19",
    "vaccinated_yellow_fever",
    "days_since_last_vaccination",
    # Pregnancy (ANC)
    "is_pregnant",
    "gestational_age_weeks",
    # Symptom proxies
    "cough_duration_days",
    "weight_loss_kg_3m",
]

N_FEATURES = len(FEATURE_ORDER)  # 42

# ── Target disease conditions (15 classes) ───────────────────────────────────
DISEASE_LABELS = [
    "type2_diabetes_early",
    "hypertension",
    "iron_deficiency_anemia",
    "vitamin_d_deficiency",
    "malaria_recurring",
    "sickle_cell_monitoring",
    "hiv_risk",
    "maternal_complications",
    "tuberculosis_risk",
    "parkinsons_early",
    "chronic_kidney_disease",
    "hepatitis_b",
    "dengue_risk",
    "vitamin_b12_deficiency",
    "hypothyroidism",
]

N_CLASSES = len(DISEASE_LABELS)  # 15

DISPLAY_NAMES = {
    "type2_diabetes_early": "Type 2 Diabetes (Early Risk)",
    "hypertension": "Hypertension",
    "iron_deficiency_anemia": "Iron Deficiency Anemia",
    "vitamin_d_deficiency": "Vitamin D Deficiency",
    "malaria_recurring": "Recurring Malaria Pattern",
    "sickle_cell_monitoring": "Sickle Cell Disease Monitor",
    "hiv_risk": "HIV Risk Stratification",
    "maternal_complications": "Maternal Complication Risk",
    "tuberculosis_risk": "Tuberculosis Risk",
    "parkinsons_early": "Parkinson's Early Markers",
    "chronic_kidney_disease": "Chronic Kidney Disease",
    "hepatitis_b": "Hepatitis B Risk",
    "dengue_risk": "Dengue Fever Risk",
    "vitamin_b12_deficiency": "Vitamin B12 Deficiency",
    "hypothyroidism": "Hypothyroidism Risk",
}


class MediLedgerDiagnosticModel:
    """
    Wrapper around TabNetClassifier with MediLedger-specific configuration.
    Handles multi-label output (independent binary classifiers via TabNet multi-output).
    """

    def __init__(self) -> None:
        self.model = TabNetClassifier(
            input_dim=N_FEATURES,
            output_dim=N_CLASSES,
            n_d=64,
            n_a=64,
            n_steps=5,
            gamma=1.5,
            n_independent=2,
            n_shared=2,
            epsilon=1e-15,
            momentum=0.02,
            lambda_sparse=1e-3,
            seed=42,
            verbose=0,
        )
        self._is_fitted = False

    def get_weights(self) -> list[np.ndarray]:
        """Return model weights for federated aggregation."""
        if not self._is_fitted:
            return [np.zeros(1)]
        params = self.model.network.state_dict()
        return [v.cpu().numpy() for v in params.values()]

    def set_weights(self, weights: list[np.ndarray]) -> None:
        """Load aggregated weights from federated server."""
        import torch
        params = self.model.network.state_dict()
        state_dict = {k: torch.tensor(w) for k, w in zip(params.keys(), weights)}
        self.model.network.load_state_dict(state_dict)
        self._is_fitted = True

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Run inference. Returns array of shape (n_samples, N_CLASSES) with probabilities."""
        if not self._is_fitted:
            raise RuntimeError("Model not fitted. Load global weights first.")
        return self.model.predict_proba(X)

    def fit(self, X_train: np.ndarray, y_train: np.ndarray) -> dict:
        """Local training (hospital-side). Returns training metrics."""
        self.model.fit(
            X_train=X_train,
            y_train=y_train,
            eval_set=[(X_train, y_train)],
            eval_name=["train"],
            eval_metric=["auc"],
            max_epochs=5,
            patience=50,
            batch_size=256,
            virtual_batch_size=128,
        )
        self._is_fitted = True
        return {"loss": float(self.model.history["loss"][-1])}
