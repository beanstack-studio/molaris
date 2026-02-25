/**
 * Visit Reasons / Concerns Helper
 * Unified data structure for appointment concerns and ortho visit types
 * Standardized globalized naming and grouping
 */

export type VisitReasonType =
  | 'consultation'
  | 'routine_checkup'
  | 'cleaning'
  | 'filling'
  | 'extraction'
  | 'root_canal'
  | 'crown_bridge'
  | 'denture'
  | 'emergency'
  | 'ortho_consultation'
  | 'braces_installation'
  | 'adjustment'
  | 'ortho_emergency'
  | 'debonding'
  | 'retainer_delivery';

export interface VisitReasonGroup {
  group: 'General' | 'Ortho';
  reasons: VisitReason[];
}

export interface VisitReason {
  value: VisitReasonType;
  label: string;
  isOrtho: boolean;
}

/**
 * All available visit reasons grouped by category
 * Use this for dropdowns and filtering
 */
export const VISIT_REASONS: VisitReasonGroup[] = [
  {
    group: 'General',
    reasons: [
      { value: 'consultation', label: 'Consultation', isOrtho: false },
      { value: 'routine_checkup', label: 'Routine Check-up', isOrtho: false },
      { value: 'cleaning', label: 'Cleaning', isOrtho: false },
      { value: 'filling', label: 'Filling / Restoration', isOrtho: false },
      { value: 'extraction', label: 'Extraction', isOrtho: false },
      { value: 'root_canal', label: 'Root Canal', isOrtho: false },
      { value: 'crown_bridge', label: 'Crown / Bridge', isOrtho: false },
      { value: 'denture', label: 'Denture (Pustiso)', isOrtho: false },
      { value: 'emergency', label: 'Emergency / Urgent', isOrtho: false },
    ],
  },
  {
    group: 'Ortho',
    reasons: [
      { value: 'ortho_consultation', label: 'Ortho Consultation', isOrtho: true },
      { value: 'braces_installation', label: 'Braces Installation', isOrtho: true },
      { value: 'adjustment', label: 'Adjustment', isOrtho: true },
      { value: 'ortho_emergency', label: 'Ortho Emergency', isOrtho: true },
      { value: 'debonding', label: 'Debonding', isOrtho: true },
      { value: 'retainer_delivery', label: 'Retainer Delivery', isOrtho: true },
    ],
  },
];

/**
 * Get flat list of all visit reasons
 */
export const getAllVisitReasons = (): VisitReason[] => {
  return VISIT_REASONS.flatMap((group) => group.reasons);
};

/**
 * Get visit reason by value
 */
export const getVisitReasonLabel = (value: VisitReasonType | null): string => {
  if (!value) return 'Not specified';
  const reason = getAllVisitReasons().find((r) => r.value === value);
  return reason?.label || value;
};

/**
 * Filter visit reasons to only include ortho-related items
 */
export const getOrthoOnlyReasons = (): VisitReason[] => {
  return getAllVisitReasons().filter((r) => r.isOrtho);
};

/**
 * Filter visit reasons to only include general (non-ortho) items
 */
export const getGeneralOnlyReasons = (): VisitReason[] => {
  return getAllVisitReasons().filter((r) => !r.isOrtho);
};

/**
 * Check if a visit reason is ortho-related
 */
export const isOrthoReason = (value: VisitReasonType | null): boolean => {
  if (!value) return false;
  const reason = getAllVisitReasons().find((r) => r.value === value);
  return reason?.isOrtho ?? false;
};
