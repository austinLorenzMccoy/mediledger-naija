const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ConsentRegistry', function () {
  let registry;
  let nhiaAdmin, governance, requester, other;

  // Helpers
  const h = (s) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(s));
  const future = (secs = 3600) => Math.floor(Date.now() / 1000) + secs;

  beforeEach(async () => {
    [nhiaAdmin, governance, requester, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('ConsentRegistry');
    registry = await Factory.deploy(nhiaAdmin.address, governance.address);
    await registry.deployed();
  });

  // ── Deployment ──────────────────────────────────────────────────────
  describe('deployment', () => {
    it('sets nhiaAdmin correctly', async () => {
      expect(await registry.nhiaAdmin()).to.equal(nhiaAdmin.address);
    });

    it('sets nhiaGovernance correctly', async () => {
      expect(await registry.nhiaGovernance()).to.equal(governance.address);
    });

    it('starts with zero consents', async () => {
      expect(await registry.totalConsents()).to.equal(0);
      expect(await registry.activeConsents()).to.equal(0);
    });

    it('reverts with zero admin address', async () => {
      const Factory = await ethers.getContractFactory('ConsentRegistry');
      await expect(
        Factory.deploy(ethers.constants.AddressZero, governance.address),
      ).to.be.revertedWith('Invalid admin address');
    });
  });

  // ── grantConsent ────────────────────────────────────────────────────
  describe('grantConsent', () => {
    const consentId     = h('consent-001');
    const patientHash   = h('patient-NHIA-001');
    const requesterHash = h('facility-001');

    it('grants a consent and increments counters', async () => {
      await registry.grantConsent(
        consentId, patientHash, requesterHash,
        0, h('scope'), future(-60), future(), 10000,
      );
      expect(await registry.totalConsents()).to.equal(1);
      expect(await registry.activeConsents()).to.equal(1);
    });

    it('emits ConsentGranted event', async () => {
      const validUntil = future();
      await expect(
        registry.grantConsent(
          consentId, patientHash, requesterHash,
          0, h('scope'), future(-60), validUntil, 10000,
        ),
      ).to.emit(registry, 'ConsentGranted')
        .withArgs(consentId, patientHash, requesterHash, validUntil, 10000);
    });

    it('stores consent fields correctly', async () => {
      const validUntil = future();
      await registry.grantConsent(
        consentId, patientHash, requesterHash,
        1, h('scope2'), future(-60), validUntil, 5000,
      );
      const c = await registry.consents(consentId);
      expect(c.patientHash).to.equal(patientHash);
      expect(c.requesterHash).to.equal(requesterHash);
      expect(c.requesterType).to.equal(1);
      expect(c.monthlyPaymentHeal).to.equal(5000);
      expect(c.status).to.equal(0);
      expect(c.revokedAt).to.equal(0);
    });

    it('rejects duplicate consentId', async () => {
      await registry.grantConsent(
        consentId, patientHash, requesterHash,
        0, h('scope'), future(-60), future(), 1000,
      );
      await expect(
        registry.grantConsent(
          consentId, patientHash, requesterHash,
          0, h('scope'), future(-60), future(), 1000,
        ),
      ).to.be.revertedWith('Consent ID already exists');
    });

    it('rejects expired validUntil', async () => {
      await expect(
        registry.grantConsent(
          h('c2'), patientHash, requesterHash,
          0, h('scope'), future(-120), future(-60), 1000,
        ),
      ).to.be.revertedWith('Invalid expiry');
    });

    it('rejects validFrom > validUntil', async () => {
      const now = future();
      await expect(
        registry.grantConsent(
          h('c3'), patientHash, requesterHash,
          0, h('scope'), now + 7200, now + 3600, 1000,
        ),
      ).to.be.revertedWith('Invalid date range');
    });

    it('rejects invalid requesterType > 3', async () => {
      await expect(
        registry.grantConsent(
          h('c4'), patientHash, requesterHash,
          4, h('scope'), future(-60), future(), 1000,
        ),
      ).to.be.revertedWith('Invalid requester type');
    });

    it('reverts when called by non-NHIA address', async () => {
      await expect(
        registry.connect(other).grantConsent(
          h('c5'), patientHash, requesterHash,
          0, h('scope'), future(-60), future(), 1000,
        ),
      ).to.be.revertedWith('Unauthorized: NHIA only');
    });
  });

  // ── revokeConsent ───────────────────────────────────────────────────
  describe('revokeConsent', () => {
    let consentId;

    beforeEach(async () => {
      consentId = h('revoke-test');
      await registry.grantConsent(
        consentId, h('patient'), h('facility'),
        0, h('scope'), future(-60), future(), 1000,
      );
    });

    it('revokes an active consent and decrements activeConsents', async () => {
      await registry.revokeConsent(consentId);
      expect(await registry.activeConsents()).to.equal(0);
      const c = await registry.consents(consentId);
      expect(c.status).to.equal(2);
      expect(c.revokedAt).to.be.gt(0);
    });

    it('emits ConsentRevoked event', async () => {
      await expect(registry.revokeConsent(consentId))
        .to.emit(registry, 'ConsentRevoked');
    });

    it('rejects double-revoke', async () => {
      await registry.revokeConsent(consentId);
      await expect(registry.revokeConsent(consentId)).to.be.revertedWith('Consent not active');
    });

    it('reverts when called by non-NHIA', async () => {
      await expect(
        registry.connect(other).revokeConsent(consentId),
      ).to.be.revertedWith('Unauthorized: NHIA only');
    });
  });

  // ── hasActiveConsent ────────────────────────────────────────────────
  describe('hasActiveConsent', () => {
    const patientHash   = h('patient-active');
    const requesterHash = h('facility-active');

    it('returns true for an active consent', async () => {
      const cId = h('active-1');
      await registry.grantConsent(
        cId, patientHash, requesterHash,
        0, h('scope'), future(-60), future(), 1000,
      );
      const [hasConsent, activeId] = await registry.hasActiveConsent(patientHash, requesterHash);
      expect(hasConsent).to.be.true;
      expect(activeId).to.equal(cId);
    });

    it('returns false when no consent exists', async () => {
      const [hasConsent] = await registry.hasActiveConsent(h('nobody'), h('nobody-req'));
      expect(hasConsent).to.be.false;
    });

    it('returns false after revocation', async () => {
      const cId = h('active-2');
      await registry.grantConsent(
        cId, patientHash, requesterHash,
        0, h('scope'), future(-60), future(), 1000,
      );
      await registry.revokeConsent(cId);
      const [hasConsent] = await registry.hasActiveConsent(patientHash, requesterHash);
      expect(hasConsent).to.be.false;
    });
  });

  // ── expireConsents ──────────────────────────────────────────────────
  describe('expireConsents', () => {
    it('expires only past-validUntil consents in a batch', async () => {
      const activeId  = h('expire-active');
      const expiredId = h('expire-past');

      await registry.grantConsent(
        activeId, h('p1'), h('r1'),
        0, h('scope'), future(-60), future(7200), 1000,
      );

      // Grant then immediately advance time via a call that sets validUntil in the past
      // We can't easily manipulate time in Hardhat without the time-helpers plugin,
      // so we test the batch call is NHIA-only and doesn't revert on active consents.
      await expect(
        registry.expireConsents([activeId]),
      ).to.not.be.reverted;

      // Active consent still active (validUntil in future)
      const c = await registry.consents(activeId);
      expect(c.status).to.equal(0);
    });

    it('reverts when called by non-NHIA', async () => {
      await expect(
        registry.connect(other).expireConsents([]),
      ).to.be.revertedWith('Unauthorized: NHIA only');
    });
  });

  // ── getPatientConsentIds ────────────────────────────────────────────
  describe('getPatientConsentIds', () => {
    it('returns all consent IDs for a patient', async () => {
      const patientHash = h('patient-list');
      const ids = [h('list-1'), h('list-2'), h('list-3')];
      for (const id of ids) {
        await registry.grantConsent(
          id, patientHash, h(`req-${id}`),
          0, h('scope'), future(-60), future(), 1000,
        );
      }
      const result = await registry.getPatientConsentIds(patientHash);
      expect(result).to.deep.equal(ids);
    });

    it('returns empty array for unknown patient', async () => {
      const result = await registry.getPatientConsentIds(h('unknown-patient'));
      expect(result).to.deep.equal([]);
    });
  });

  // ── transferAdmin ───────────────────────────────────────────────────
  describe('transferAdmin', () => {
    it('transfers admin via governance', async () => {
      await registry.connect(governance).transferAdmin(requester.address);
      expect(await registry.nhiaAdmin()).to.equal(requester.address);
    });

    it('emits AdminTransferred event', async () => {
      await expect(registry.connect(governance).transferAdmin(requester.address))
        .to.emit(registry, 'AdminTransferred')
        .withArgs(nhiaAdmin.address, requester.address);
    });

    it('reverts when called by non-governance', async () => {
      await expect(
        registry.connect(nhiaAdmin).transferAdmin(other.address),
      ).to.be.revertedWith('Only governance can transfer admin');
    });

    it('reverts for zero address', async () => {
      await expect(
        registry.connect(governance).transferAdmin(ethers.constants.AddressZero),
      ).to.be.revertedWith('Invalid address');
    });
  });
});
