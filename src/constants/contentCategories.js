// UGC content categories (aligned with Billo / Trend / Insense style marketplaces).
// Shared by the creator + business signup forms and the admin work-distribution
// assignment. Keep in sync with backend constants/categories.js.
export const CONTENT_CATEGORIES = [
  { value: 'testimonial', label: 'Testimonial / Review' },
  { value: 'product_demo', label: 'Product Demo' },
  { value: 'try_on', label: 'Try-On / Haul' },
  { value: 'grwm', label: 'GRWM (Get Ready With Me)' },
  { value: 'day_in_life', label: 'Day-in-the-Life / Vlog' },
  { value: 'transformation', label: 'Before & After / Transformation' },
  { value: 'food', label: 'Recipe / Food' },
  { value: 'voiceover', label: 'Voiceover / Faceless' },
  { value: 'asmr', label: 'ASMR' },
  { value: 'ugc_ad', label: 'Problem–Solution Ad / Skit' },
  { value: 'comparison', label: 'Comparison / "This vs That"' },
  { value: 'street_interview', label: 'Street Interview / Vox Pop' },
  { value: 'custom', label: 'Custom' },
];

// Resolve the stored category string from a {category, customCategory} pair.
export const resolveCategory = (category, customCategory) =>
  category === 'custom' ? (String(customCategory || '').trim() || 'Custom') : category;
