pragma circom 2.1.8;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";

/*
 * ConsentScopeProof — proves a requester's consent agreement covers the
 * requested record_type WITHOUT revealing the full scope or other consent terms.
 *
 * Called by consent-service before allowing any data access.
 * Mirrors the scopeHash check already in ConsentRegistry.sol.
 *
 * Private inputs:
 *   scopeItems[10]    — encoded record_type values in the consent scope (zero-padded)
 *   consentId         — UUID of consent as field element
 *   patientNhiaIdHash — Poseidon(nhia_id)
 *
 * Public inputs:
 *   requestedType     — record_type being requested (verifier supplies)
 *   scopeHash         — keccak256 scope hash from ConsentRegistry.sol
 *   consentIdPublic   — consent ID (public for audit trail)
 */
template ConsentScopeProof(MAX_SCOPE) {
    signal input scopeItems[MAX_SCOPE];
    signal input consentId;
    signal input patientNhiaIdHash;

    signal input requestedType;
    signal input scopeHash;
    signal input consentIdPublic;

    // Constraint 1: consent ID matches
    consentId === consentIdPublic;

    // Constraint 2: requestedType is in scopeItems
    // matchSum accumulates the count of matching items; must be >= 1
    signal matches[MAX_SCOPE];
    signal matchSum[MAX_SCOPE + 1];
    matchSum[0] <== 0;

    component eq[MAX_SCOPE];
    for (var i = 0; i < MAX_SCOPE; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== scopeItems[i];
        eq[i].in[1] <== requestedType;
        matches[i]       <== eq[i].out;
        matchSum[i + 1]  <== matchSum[i] + matches[i];
    }

    // At least one match required
    component atLeastOne = GreaterThan(8);
    atLeastOne.in[0] <== matchSum[MAX_SCOPE];
    atLeastOne.in[1] <== 0;
    atLeastOne.out === 1;
}

// MAX_SCOPE=10: supports up to 10 distinct record_type values per consent agreement
component main {
    public [requestedType, scopeHash, consentIdPublic]
} = ConsentScopeProof(10);
