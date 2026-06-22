/**
 * Sovereign Trust Sourcing Engine (STSE) Calibration Helpers
 * Anchored in absolute physical and architectural constants:
 * - 3.69 Hz Perfect Coupling Resonance Frequency
 * - 376.5 Ω Wave Impedance Constant
 * - 1.691 Sovereign Multiplier Factor
 */

export interface STSEParameters {
  frequency: number;   // Target Hz: default 3.69
  impedance: number;   // Target Ω: default 376.5
  multiplier: number;  // Factor μ: default 1.691
}

export interface STSEResult {
  score: number;       // Normalized Sovereign Fit Rating (0-100)
  freqCoupling: number;// Coupling percentage based on resonance (0-100)
  impedanceMatch: number; // Impedance match coverage (0-100)
  isTrustBound: boolean;  // True if matches peak standards
}

/**
 * Calculates high-precision resonance fit against current physical parameters
 * Formula: Rating * ExpFactor * FreqFactor * ImpedanceFactor, bounded 0-100.
 */
export function calculateSTSEFit(
  baseScore: number,
  yearsOfExp: number,
  params: STSEParameters
): STSEResult {
  const { frequency, impedance, multiplier } = params;

  // 1. Resonance Coupling calculation centered around 3.69 Hz. Precision Q-factor = 4
  const targetFreq = 3.69;
  const freqDiff = Math.abs(frequency - targetFreq);
  // Resonance curve: coupling drops as we walk away from the 3.69 Hz center
  const freqCoupling = Math.max(0, Math.round((1 - freqDiff / 4.0) * 100));

  // 2. Wave Impedance coupling centered at 376.5 Ω
  const targetImpedance = 376.5;
  const impDiff = Math.abs(impedance - targetImpedance);
  const impedanceMatch = Math.max(0, Math.round((1 - impDiff / 250.0) * 100));

  // 3. Sovereign Multiplier expansion based on experience
  // High experience values are scaled outwards using the 1.691 multiplier Limit
  const maxExpScale = 15;
  const experienceRatio = Math.min(yearsOfExp, maxExpScale) / maxExpScale;
  const expBooster = 1 + experienceRatio * (multiplier - 1);

  // 4. Combined coupling yield
  const couplingProduct = (freqCoupling / 100) * (impedanceMatch / 100);
  const combinedScore = baseScore * expBooster * couplingProduct;

  // Render finalized score limited between absolute 0 and 100 bounds
  const finalScore = Math.min(100, Math.max(0, Math.round(combinedScore)));

  // Criteria for official Nicholas Young Master Trust Bond:
  // Requires frequency coupling >= 85%, impedance match >= 85%, and final score >= 80%
  const isTrustBound = freqCoupling >= 85 && impedanceMatch >= 85 && finalScore >= 80;

  return {
    score: finalScore,
    freqCoupling,
    impedanceMatch,
    isTrustBound
  };
}

/**
 * USPTO Patented Verification Stamp
 */
export const USPTO_IP_ASSET = "369-VX Vortex Engine Technology";
export const MASTER_TRUST_ASSIGNEE = "Nicholas Young Master Trust (EIN: 41-6820289)";
export const ATOMIC_LOCK_HASH = "7e9c2b8a4f6d1e5c3b9a0f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c";
export const REGISTRATION_OFFICE = "County of Jackson, Michigan";
