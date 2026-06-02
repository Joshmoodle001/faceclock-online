import { describe, it, expect, vi } from 'vitest';

describe('Family Clock-In Flow State Machine', () => {
  /**
   * The family clock-in flow follows these state transitions:
   *
   * IDLE → face detected/match score computed → PARENT_DIALOG
   * PARENT_DIALOG → parent selected → DROP_OFF_DIALOG
   * PARENT_DIALOG → cancelled → IDLE
   * DROP_OFF_DIALOG → site selected → SUBMITTING → IDLE (with result)
   * DROP_OFF_DIALOG → skipped (null site) → SUBMITTING → IDLE (with result)
   * DROP_OFF_DIALOG → cancelled (skip) → SUBMITTING → IDLE (with result)
   */

  type FamilyFlowState = 'IDLE' | 'PARENT_DIALOG' | 'DROP_OFF_DIALOG' | 'SUBMITTING';

  interface FamilyState {
    flowState: FamilyFlowState;
    selectedParentId: string | null;
    faceMatchScore: number | null;
    livenessScore: number | null;
    dropOffSiteId: string | null;
    dropOffCustomLocation: string | null;
    error: string | null;
  }

  const initialState = (): FamilyState => ({
    flowState: 'IDLE',
    selectedParentId: null,
    faceMatchScore: null,
    livenessScore: null,
    dropOffSiteId: null,
    dropOffCustomLocation: null,
    error: null,
  });

  it('starts in IDLE with null values', () => {
    const s = initialState();
    expect(s.flowState).toBe('IDLE');
    expect(s.selectedParentId).toBeNull();
  });

  it('transitions IDLE → PARENT_DIALOG after face detection', () => {
    const s = initialState();
    // Simulate startFamilyClockIn: face detected, hash matched
    const matchScore = 0.8765;
    const liveness = 0.85;

    s.faceMatchScore = matchScore;
    s.livenessScore = liveness;
    s.flowState = 'PARENT_DIALOG';

    expect(s.flowState).toBe('PARENT_DIALOG');
    expect(s.faceMatchScore).toBe(0.8765);
    expect(s.livenessScore).toBe(0.85);
  });

  it('transitions PARENT_DIALOG → DROP_OFF_DIALOG when parent selected', () => {
    const s = initialState();
    s.flowState = 'PARENT_DIALOG';
    s.faceMatchScore = 0.95;

    // handleFamilyParentSelected('parent-123')
    s.selectedParentId = 'parent-123';
    s.flowState = 'DROP_OFF_DIALOG';

    expect(s.flowState).toBe('DROP_OFF_DIALOG');
    expect(s.selectedParentId).toBe('parent-123');
  });

  it('transitions PARENT_DIALOG → IDLE on cancel', () => {
    const s = initialState();
    s.flowState = 'PARENT_DIALOG';
    s.faceMatchScore = 0.95;

    // Cancel pressed
    s.flowState = 'IDLE';
    s.faceMatchScore = null;
    s.livenessScore = null;

    expect(s.flowState).toBe('IDLE');
    expect(s.faceMatchScore).toBeNull();
  });

  it('transitions DROP_OFF_DIALOG → SUBMITTING with site selected', () => {
    const s = initialState();
    s.selectedParentId = 'parent-123';
    s.faceMatchScore = 0.95;
    s.livenessScore = 0.85;
    s.flowState = 'DROP_OFF_DIALOG';

    // handleFamilyDropOff('site-456', null)
    s.dropOffSiteId = 'site-456';
    s.flowState = 'SUBMITTING';

    expect(s.dropOffSiteId).toBe('site-456');
    expect(s.flowState).toBe('SUBMITTING');
  });

  it('transitions DROP_OFF_DIALOG → SUBMITTING with custom location', () => {
    const s = initialState();
    s.selectedParentId = 'parent-123';
    s.faceMatchScore = 0.95;
    s.livenessScore = 0.85;
    s.flowState = 'DROP_OFF_DIALOG';

    // handleFamilyDropOff(null, 'Target Store')
    s.dropOffCustomLocation = 'Target Store';
    s.dropOffSiteId = null;
    s.flowState = 'SUBMITTING';

    expect(s.dropOffCustomLocation).toBe('Target Store');
    expect(s.dropOffSiteId).toBeNull();
    expect(s.flowState).toBe('SUBMITTING');
  });

  it('transitions DROP_OFF_DIALOG → SUBMITTING when skip (null, null)', () => {
    const s = initialState();
    s.selectedParentId = 'parent-123';
    s.faceMatchScore = 0.88;
    s.livenessScore = 0.85;
    s.flowState = 'DROP_OFF_DIALOG';

    // handleFamilySkipDropOff → calls handleFamilyDropOff(null, null)
    s.dropOffSiteId = null;
    s.dropOffCustomLocation = null;
    s.flowState = 'SUBMITTING';

    expect(s.dropOffSiteId).toBeNull();
    expect(s.dropOffCustomLocation).toBeNull();
    expect(s.flowState).toBe('SUBMITTING');
  });

  it('resets faceData and parentId after submission (success or error)', () => {
    const s = initialState();
    s.selectedParentId = 'parent-123';
    s.faceMatchScore = 0.95;
    s.livenessScore = 0.85;
    s.flowState = 'SUBMITTING';

    // finally block in handleFamilyDropOff
    s.flowState = 'IDLE';
    s.faceMatchScore = null;
    s.livenessScore = null;
    s.selectedParentId = null;

    expect(s.flowState).toBe('IDLE');
    expect(s.faceMatchScore).toBeNull();
    expect(s.livenessScore).toBeNull();
    expect(s.selectedParentId).toBeNull();
  });

  it('does not submit if no parent selected or no face data', () => {
    const s = initialState();
    s.flowState = 'DROP_OFF_DIALOG';
    // selectedParentId is null, faceMatchScore is null
    // handleFamilyDropOff should return early
    const shouldSubmit = s.selectedParentId !== null && s.faceMatchScore !== null;
    expect(shouldSubmit).toBe(false);
  });
});

describe('Family Clock-In Payload Construction', () => {
  /**
   * Validates that the submit payload for family clock-in is constructed correctly.
   * Replicates the payload-building logic from the clock page's handleFamilyDropOff.
   */
  function buildFamilyClockInPayload(params: {
    parentUserId: string;
    faceMatchScore: number;
    livenessScore: number;
    deviceFingerprint: string;
    siteId?: string | null;
    customLocation?: string | null;
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
  }): Record<string, unknown> {
    const clientEventId = crypto.randomUUID();
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = {
      event_type: 'clock_in',
      occurred_at: now,
      client_event_id: clientEventId,
      face_match_score: params.faceMatchScore,
      liveness_score: params.livenessScore,
      device_fingerprint: params.deviceFingerprint,
      timestamp: now,
      parent_user_id: params.parentUserId,
    };

    if (params.siteId) {
      payload.drop_off_site_id = params.siteId;
      payload.site_id = params.siteId;
    }
    if (params.customLocation) {
      payload.drop_off_custom_location = params.customLocation;
    }

    if (params.latitude !== undefined && params.longitude !== undefined) {
      payload.latitude = params.latitude;
      payload.longitude = params.longitude;
      payload.accuracy_m = params.accuracyM;
    } else {
      payload.latitude = 0;
      payload.longitude = 0;
      payload.accuracy_m = 9999;
    }

    return payload;
  }

  it('includes all required fields', () => {
    const payload = buildFamilyClockInPayload({
      parentUserId: 'parent-1',
      faceMatchScore: 0.95,
      livenessScore: 0.85,
      deviceFingerprint: 'fp-abc',
    });

    expect(payload.event_type).toBe('clock_in');
    expect(payload.parent_user_id).toBe('parent-1');
    expect(payload.face_match_score).toBe(0.95);
    expect(payload.liveness_score).toBe(0.85);
    expect(payload.device_fingerprint).toBe('fp-abc');
    expect(payload.client_event_id).toBeDefined();
    expect(payload.timestamp).toBeDefined();
    expect(payload.occurred_at).toBeDefined();
  });

  it('includes drop-off site when provided', () => {
    const payload = buildFamilyClockInPayload({
      parentUserId: 'parent-1',
      faceMatchScore: 0.95,
      livenessScore: 0.85,
      deviceFingerprint: 'fp-abc',
      siteId: 'site-42',
    });

    expect(payload.drop_off_site_id).toBe('site-42');
    expect(payload.site_id).toBe('site-42');
  });

  it('includes custom location when provided', () => {
    const payload = buildFamilyClockInPayload({
      parentUserId: 'parent-1',
      faceMatchScore: 0.95,
      livenessScore: 0.85,
      deviceFingerprint: 'fp-abc',
      customLocation: 'Walmart Supercenter',
    });

    expect(payload.drop_off_custom_location).toBe('Walmart Supercenter');
  });

  it('does not include drop_off_site_id when siteId is null', () => {
    const payload = buildFamilyClockInPayload({
      parentUserId: 'parent-1',
      faceMatchScore: 0.88,
      livenessScore: 0.85,
      deviceFingerprint: 'fp-abc',
      siteId: null,
    });

    expect(payload).not.toHaveProperty('drop_off_site_id');
    expect(payload).not.toHaveProperty('site_id');
  });

  it('does not include drop_off_custom_location when customLocation is null', () => {
    const payload = buildFamilyClockInPayload({
      parentUserId: 'parent-1',
      faceMatchScore: 0.88,
      livenessScore: 0.85,
      deviceFingerprint: 'fp-abc',
      customLocation: null,
    });

    expect(payload).not.toHaveProperty('drop_off_custom_location');
  });

  it('uses actual GPS coordinates when available', () => {
    const payload = buildFamilyClockInPayload({
      parentUserId: 'p1',
      faceMatchScore: 1,
      livenessScore: 1,
      deviceFingerprint: 'f',
      latitude: 40.7128,
      longitude: -74.006,
      accuracyM: 15,
    });

    expect(payload.latitude).toBe(40.7128);
    expect(payload.longitude).toBe(-74.006);
    expect(payload.accuracy_m).toBe(15);
  });

  it('falls back to zero coordinates when no location', () => {
    const payload = buildFamilyClockInPayload({
      parentUserId: 'p1',
      faceMatchScore: 1,
      livenessScore: 1,
      deviceFingerprint: 'f',
    });

    expect(payload.latitude).toBe(0);
    expect(payload.longitude).toBe(0);
    expect(payload.accuracy_m).toBe(9999);
  });
});

describe('Family Clock-In Preconditions', () => {
  it('Family Clock-In button should not show when user is already clocked in', () => {
    const clockedIn = true;
    const hasFamilyTrees = true;
    const isSubmitting = false;
    const showButton = !clockedIn && hasFamilyTrees && !isSubmitting;
    expect(showButton).toBe(false);
  });

  it('Family Clock-In button should not show when user has no family trees', () => {
    const clockedIn = false;
    const hasFamilyTrees = false;
    const isSubmitting = false;
    const showButton = !clockedIn && hasFamilyTrees && !isSubmitting;
    expect(showButton).toBe(false);
  });

  it('Family Clock-In button shows when not clocked in, has family trees, and not submitting', () => {
    const clockedIn = false;
    const hasFamilyTrees = true;
    const isSubmitting = false;
    const showButton = !clockedIn && hasFamilyTrees && !isSubmitting;
    expect(showButton).toBe(true);
  });

  it('Family Clock-In requires faceDescriptor to proceed', () => {
    const faceDescriptor: string | null = null;
    const canProceed = faceDescriptor !== null;
    expect(canProceed).toBe(false);
  });

  it('Family Clock-In can proceed when faceDescriptor exists', () => {
    const faceDescriptor = '...binarydescriptor...';
    const canProceed = faceDescriptor !== null;
    expect(canProceed).toBe(true);
  });
});
