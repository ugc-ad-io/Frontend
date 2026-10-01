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

// The niche a creator makes content ABOUT (what) — separate from the content STYLE
// (how, in CONTENT_CATEGORIES). Same 20 the brand signup uses, so both sides match.
export const NICHE_CATEGORIES = [
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'beauty', label: 'Beauty & Personal Care' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'food', label: 'Food & Beverages' },
  { value: 'home', label: 'Home & Living' },
  { value: 'jewellery', label: 'Jewellery & Accessories' },
  { value: 'electronics', label: 'Electronics & Gadgets' },
  { value: 'sports', label: 'Sports & Fitness' },
  { value: 'baby_kids', label: 'Baby, Kids & Family' },
  { value: 'pets', label: 'Pets & Pet Care' },
  { value: 'travel', label: 'Travel & Hospitality' },
  { value: 'automotive', label: 'Automotive & Accessories' },
  { value: 'education', label: 'Education & Learning' },
  { value: 'tech', label: 'Technology & Software' },
  { value: 'finance', label: 'Finance & Fintech' },
  { value: 'entertainment', label: 'Entertainment & Media' },
  { value: 'gaming', label: 'Gaming & Esports' },
  { value: 'luxury', label: 'Luxury & Lifestyle' },
  { value: 'fmcg', label: 'FMCG & Consumer Goods' },
  { value: 'other', label: 'Others' },
];
