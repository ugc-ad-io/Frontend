import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Check, ChevronRight, ChevronLeft, Camera, Video, Image as ImageIcon, Lightbulb, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = ['Beauty', 'Tech', 'Fitness', 'Fashion', 'Travel', 'Food', 'Gaming', 'Lifestyle'];
const BRIEF_TYPES = ['Awareness', 'Review', 'Tutorial', 'Unboxing', 'Testimonial'];
const TONE_TAGS = ['Fun', 'Luxury', 'Minimal', 'Bold', 'Emotional', 'Trustworthy', 'Playful', 'Premium'];
const NICHE_TAGS = ['Beauty', 'Tech', 'Fitness', 'Fashion', 'Travel', 'Lifestyle', 'Food', 'Gaming', 'Parenting', 'Finance', 'Education', 'Wellness'];
const CITIES = ['All India', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata'];
const VIDEO_FORMATS = [
  { id: 'reel', label: 'Reel', icon: '▶️', desc: 'Instagram / TikTok vertical' },
  { id: 'story', label: 'Story', icon: '📱', desc: '24-hr story format' },
  { id: 'feed', label: 'Feed Post', icon: '📸', desc: 'Square or portrait' },
  { id: 'shorts', label: 'Shorts', icon: '⚡', desc: 'YouTube vertical short' }
];

export default function PostABrief() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    productName: '', variant: '', retailPrice: '', category: '', briefType: '', productImage: null,
    campaignHook: '', keyMessage: '', whatNotToDo: '', toneReference: '', toneTags: [],
    videoFormat: '', aspectRatio: '', duration: '', additionalDeliverables: [], revisions: 2,
    creatorLevel: '', qualityTier: '', genderPreference: 'No Preference', cityFilter: 'All India', nicheTags: [],
    perVideoBudget: ''
  });

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleTag = (field, tag) => {
    setForm(prev => {
      const arr = prev[field] || [];
      return { ...prev, [field]: arr.includes(tag) ? arr.filter(t => t !== tag) : [...arr, tag] };
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be under 10MB');
        return;
      }
      setForm(prev => ({ ...prev, productImage: file }));
    }
  };

  const goToStep = (newStep) => {
    if (newStep < step || (newStep === step + 1 && isStepValid(step))) {
      setStep(newStep);
    }
  };

  const isStepValid = (s) => {
    switch (s) {
      case 1:
        return form.productName && form.category && form.briefType && form.productImage;
      case 2:
        return form.campaignHook;
      case 3:
        return form.videoFormat && form.aspectRatio && form.duration;
      case 4:
        return form.creatorLevel && form.qualityTier;
      case 5:
        return form.perVideoBudget;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = {
        title: form.productName,
        brief_text: form.campaignHook,
        budget_min: Math.floor(Number(form.perVideoBudget) * 0.8),
        budget_max: Number(form.perVideoBudget),
        objectives: [form.briefType],
        requires_shipment: false
      };
      await axios.post(`${API}/campaigns`, payload);
      toast.success('Brief posted successfully!');
      navigate('/dashboard/business');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post brief');
    } finally {
      setSubmitting(false);
    }
  };

  const step1Valid = form.productName && form.category && form.briefType && form.productImage;
  const step2Valid = form.campaignHook;
  const step3Valid = form.videoFormat && form.aspectRatio && form.duration;
  const step4Valid = form.creatorLevel && form.qualityTier;
  const step5Valid = form.perVideoBudget;

  return (
    <div className="pab-page">
      <div className="pab-stepper">
        {[1, 2, 3, 4, 5].map((s, idx) => {
          const isCompleted = (s === 1 && step1Valid && s < step) || (s === 2 && step2Valid && s < step) || (s === 3 && step3Valid && s < step) || (s === 4 && step4Valid && s < step);
          const isActive = s === step;
          return (
            <div key={s} className="stepper-item">
              <div className={`stepper-circle ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                {isCompleted ? <Check size={18} /> : s}
              </div>
              {idx < 4 && <div className={`stepper-line ${isCompleted ? 'completed' : ''}`} />}
            </div>
          );
        })}
      </div>

      <div className="pab-body">
        <div className="pab-form-panel">
          {step === 1 && (
            <div className="step-content">
              <div className="step-header">
                <h2>Tell us about your product</h2>
                <p>Creators will use this to understand what they're promoting.</p>
              </div>
              <div className="form-group">
                <label>PRODUCT NAME *</label>
                <input
                  type="text"
                  value={form.productName}
                  onChange={(e) => handleFieldChange('productName', e.target.value)}
                  placeholder="e.g. Glow Serum Ultra"
                  className="input-field"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>VARIANT</label>
                  <input
                    type="text"
                    value={form.variant}
                    onChange={(e) => handleFieldChange('variant', e.target.value)}
                    placeholder="e.g. 30ml, Rosehip"
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label>RETAIL PRICE</label>
                  <div className="input-with-prefix">
                    <span>₹</span>
                    <input
                      type="number"
                      value={form.retailPrice}
                      onChange={(e) => handleFieldChange('retailPrice', e.target.value)}
                      placeholder="1,499"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>PRODUCT CATEGORY *</label>
                  <select
                    value={form.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>BRIEF TYPE *</label>
                  <select
                    value={form.briefType}
                    onChange={(e) => handleFieldChange('briefType', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select type</option>
                    {BRIEF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>PRODUCT IMAGE</label>
                <div className="image-upload">
                  {form.productImage ? (
                    <div className="image-preview">
                      <img src={URL.createObjectURL(form.productImage)} alt="Product" />
                      <button
                        type="button"
                        className="remove-image"
                        onClick={() => handleFieldChange('productImage', null)}
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <label className="upload-box">
                      <ImageIcon size={40} />
                      <p>Drop your product image here</p>
                      <small>PNG, JPG up to 10MB - Recommended 1:1 ratio</small>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content">
              <div className="step-header">
                <h2>Content direction & tone</h2>
                <p>Guide the creator on how you want the content to feel.</p>
              </div>
              <div className="form-group">
                <label>CAMPAIGN HOOK / OPENING LINE *</label>
                <textarea
                  value={form.campaignHook}
                  onChange={(e) => handleFieldChange('campaignHook', e.target.value)}
                  placeholder="e.g. 'This serum completely changed my skincare routine — here's why I can't stop talking about it...'"
                  className="textarea-field"
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>KEY MESSAGE (0/{form.keyMessage.length})</label>
                <textarea
                  value={form.keyMessage}
                  onChange={(e) => handleFieldChange('keyMessage', e.target.value.slice(0, 120))}
                  placeholder="One core thing you want the audience to remember"
                  className="textarea-field"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>WHAT NOT TO DO</label>
                <textarea
                  value={form.whatNotToDo}
                  onChange={(e) => handleFieldChange('whatNotToDo', e.target.value)}
                  placeholder="e.g. No filter effects, avoid comparing with competitor products, don't show price in video..."
                  className="textarea-field"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>TONE REFERENCE</label>
                <textarea
                  value={form.toneReference}
                  onChange={(e) => handleFieldChange('toneReference', e.target.value)}
                  placeholder="Paste a video link or describe the vibe: e.g. 'Like a trusted friend recommending something, not an ad...'"
                  className="textarea-field"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>TONE TAGS</label>
                <div className="tag-grid">
                  {TONE_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-btn ${form.toneTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => toggleTag('toneTags', tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-content">
              <div className="step-header">
                <h2>What do you need delivered?</h2>
                <p>Specify the exact format and specs for the content.</p>
              </div>
              <div className="form-group">
                <label>PRIMARY VIDEO FORMAT</label>
                <div className="format-grid">
                  {VIDEO_FORMATS.map(fmt => (
                    <button
                      key={fmt.id}
                      type="button"
                      className={`format-card ${form.videoFormat === fmt.id ? 'active' : ''}`}
                      onClick={() => handleFieldChange('videoFormat', fmt.id)}
                    >
                      <span className="format-icon">{fmt.icon}</span>
                      <strong>{fmt.label}</strong>
                      <small>{fmt.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>ASPECT RATIO</label>
                  <div className="button-group">
                    {['9:16', '1:1', '16:9'].map(ratio => (
                      <button
                        key={ratio}
                        type="button"
                        className={`ratio-btn ${form.aspectRatio === ratio ? 'active' : ''}`}
                        onClick={() => handleFieldChange('aspectRatio', ratio)}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>DURATION</label>
                  <div className="button-group">
                    {['15 sec', '30 sec', '60 sec'].map(dur => (
                      <button
                        key={dur}
                        type="button"
                        className={`ratio-btn ${form.duration === dur ? 'active' : ''}`}
                        onClick={() => handleFieldChange('duration', dur)}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>ADDITIONAL DELIVERABLES</label>
                <div className="checkbox-group">
                  {['B-Roll Footage', 'Product Photos', 'Raw Footage'].map(item => (
                    <label key={item} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={form.additionalDeliverables.includes(item)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(prev => ({ ...prev, additionalDeliverables: [...prev.additionalDeliverables, item] }));
                          } else {
                            setForm(prev => ({ ...prev, additionalDeliverables: prev.additionalDeliverables.filter(d => d !== item) }));
                          }
                        }}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>FREE REVISIONS INCLUDED (default: 2)</label>
                <div className="revisions-stepper">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, revisions: Math.max(0, prev.revisions - 1) }))}
                  >
                    −
                  </button>
                  <span>{form.revisions} revisions included</span>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, revisions: prev.revisions + 1 }))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="step-content">
              <div className="step-header">
                <h2>Creator requirements</h2>
                <p>Specify who you're looking for.</p>
              </div>
              <div className="form-group">
                <label>CREATOR LEVEL</label>
                <div className="level-grid">
                  {[
                    { id: 'rising', label: 'Rising', range: 'Up to ₹5K', desc: 'Emerging creators' },
                    { id: 'standard', label: 'Standard', range: 'Up to ₹10K', desc: 'Established creators' },
                    { id: 'elite', label: 'Elite', range: 'Min ₹15K', desc: 'Top 5% of creators' }
                  ].map(level => (
                    <button
                      key={level.id}
                      type="button"
                      className={`level-card ${form.creatorLevel === level.id ? 'active' : ''}`}
                      onClick={() => handleFieldChange('creatorLevel', level.id)}
                    >
                      <strong>{level.label}</strong>
                      <p>{level.range}</p>
                      <small>{level.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>CONTENT QUALITY TIER</label>
                <div className="tier-grid">
                  {[
                    { id: 'a', label: 'A', mult: '×1.0', desc: 'Standard quality' },
                    { id: 'aplus', label: 'A+', mult: '×1.25', desc: 'Premium quality' },
                    { id: 'aplus2', label: 'A++', mult: '×1.6', desc: 'Top-tier quality' }
                  ].map(tier => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`tier-card ${form.qualityTier === tier.id ? 'active' : ''}`}
                      onClick={() => handleFieldChange('qualityTier', tier.id)}
                    >
                      <strong>{tier.label}</strong>
                      <p>{tier.mult}</p>
                      <small>{tier.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>GENDER PREFERENCE</label>
                  <select
                    value={form.genderPreference}
                    onChange={(e) => handleFieldChange('genderPreference', e.target.value)}
                    className="input-field"
                  >
                    {['No Preference', 'Female', 'Male', 'Non-binary'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>CITY FILTER</label>
                  <select
                    value={form.cityFilter}
                    onChange={(e) => handleFieldChange('cityFilter', e.target.value)}
                    className="input-field"
                  >
                    {CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>CREATOR NICHE TAGS</label>
                <div className="tag-grid">
                  {NICHE_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-btn ${form.nicheTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => toggleTag('nicheTags', tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="step-content">
              <div className="step-header">
                <h2>Set your budget</h2>
                <p>Enter what you want to pay per video. We handle the rest.</p>
              </div>
              <div className="form-group">
                <label>PER VIDEO BUDGET</label>
                <div className="input-with-prefix large">
                  <span>₹</span>
                  <input
                    type="number"
                    value={form.perVideoBudget}
                    onChange={(e) => handleFieldChange('perVideoBudget', e.target.value)}
                    placeholder="18,750"
                    className="input-field"
                  />
                </div>
              </div>
              <div className="info-box">
                <div className="info-icon">ℹ️</div>
                <div>
                  <strong>Escrow-protected</strong>
                  <p>Payment is locked on deal acceptance and only released when you approve the delivered content — or after 5 calendar days automatically.</p>
                </div>
              </div>
            </div>
          )}

          <div className="pab-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (step === 1) navigate('/dashboard/business');
                else setStep(step - 1);
              }}
            >
              {step === 1 ? 'Cancel' : <><ChevronLeft size={18} /> Back</>}
            </button>
            {step < 5 && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => goToStep(step + 1)}
                disabled={!isStepValid(step)}
              >
                Next Step <ChevronRight size={18} />
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!step5Valid || submitting}
              >
                {submitting ? 'Posting...' : 'Post Brief'}
              </button>
            )}
          </div>
        </div>

        <aside className="pab-right-rail">
          {step === 1 && (
            <>
              <div className="rail-card preview-card">
                <h3>LIVE PREVIEW</h3>
                <div className="product-preview">
                  {form.productImage ? (
                    <img src={URL.createObjectURL(form.productImage)} alt="Product" />
                  ) : (
                    <div className="placeholder">Product image</div>
                  )}
                  <p className="preview-name">{form.productName || 'Product name'}</p>
                  <p className="preview-type">{form.briefType || 'Brief type'}</p>
                </div>
              </div>
              <div className="rail-card tip-card">
                <h3>WHY THIS MATTERS</h3>
                <p>Clear product info helps creators understand exactly what they're promoting. Briefs with images get 2.3x more applications on average.</p>
              </div>
              <div className="rail-card">
                <h3>STEP COMPLETENESS</h3>
                <div className="checklist">
                  <label className={form.productName ? 'checked' : ''}>
                    <input type="checkbox" checked={!!form.productName} readOnly />
                    Product Name
                  </label>
                  <label className={form.category ? 'checked' : ''}>
                    <input type="checkbox" checked={!!form.category} readOnly />
                    Category
                  </label>
                  <label className={form.briefType ? 'checked' : ''}>
                    <input type="checkbox" checked={!!form.briefType} readOnly />
                    Brief Type
                  </label>
                  <label className={form.productImage ? 'checked' : ''}>
                    <input type="checkbox" checked={!!form.productImage} readOnly />
                    Product Image
                  </label>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rail-card tip-card">
                <h3>BETTER BRIEFS = BETTER RESULTS</h3>
                <div className="tips">
                  <div className="tip-item">
                    <Lightbulb size={16} />
                    <p><strong>Specific hooks</strong> perform 3x better than generic ones</p>
                  </div>
                  <div className="tip-item">
                    <Lightbulb size={16} />
                    <p><strong>Clear 'what NOT to do'</strong> reduces revisions by 60%</p>
                  </div>
                  <div className="tip-item">
                    <Lightbulb size={16} />
                    <p><strong>Share 1-2 reference videos</strong> for best tone alignment</p>
                  </div>
                  <div className="tip-item">
                    <Lightbulb size={16} />
                    <p><strong>Use tone tags</strong> so creators can self-filter</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rail-card">
                <h3>YOUR DELIVERABLE</h3>
                <div className="summary-items">
                  <div className="summary-item">
                    <span>Format</span>
                    <strong>{form.videoFormat || '—'}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Ratio</span>
                    <strong>{form.aspectRatio || '—'}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Duration</span>
                    <strong>{form.duration || '—'}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Revisions</span>
                    <strong>{form.revisions} free</strong>
                  </div>
                  {form.additionalDeliverables.length > 0 && (
                    <div className="summary-item">
                      <span>Extras</span>
                      <strong>{form.additionalDeliverables.join(', ')}</strong>
                    </div>
                  )}
                </div>
              </div>
              <div className="rail-card tip-card">
                <h3>PRO TIP ON REVISIONS</h3>
                <p>2 free revisions is the platform default. More revisions may increase your creator payout expectations.</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="rail-card">
                <h3>CREATOR MATCH</h3>
                <div className="summary-items">
                  <div className="summary-item">
                    <span>Level</span>
                    <strong>{form.creatorLevel || '—'}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Quality</span>
                    <strong>{form.qualityTier || '—'}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Gender</span>
                    <strong>{form.genderPreference}</strong>
                  </div>
                  <div className="summary-item">
                    <span>City</span>
                    <strong>{form.cityFilter}</strong>
                  </div>
                  {form.nicheTags.length > 0 && (
                    <div className="summary-item">
                      <span>Niches</span>
                      <strong>{form.nicheTags.join(', ')}</strong>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="rail-card">
                <h3>BRIEF SUMMARY</h3>
                <div className="summary-items">
                  <div className="summary-section">
                    <p className="section-title">PRODUCT</p>
                    <div className="summary-item">
                      <span>Name</span>
                      <strong>{form.productName}</strong>
                    </div>
                    {form.variant && (
                      <div className="summary-item">
                        <span>Variant</span>
                        <strong>{form.variant}</strong>
                      </div>
                    )}
                    <div className="summary-item">
                      <span>Category</span>
                      <strong>{form.category}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Brief Type</span>
                      <strong>{form.briefType}</strong>
                    </div>
                  </div>
                  <div className="summary-section">
                    <p className="section-title">DELIVERABLE</p>
                    <div className="summary-item">
                      <span>Format</span>
                      <strong>{form.videoFormat}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Duration</span>
                      <strong>{form.duration}</strong>
                    </div>
                  </div>
                  <div className="summary-section">
                    <p className="section-title">CREATOR</p>
                    <div className="summary-item">
                      <span>Level</span>
                      <strong>{form.creatorLevel}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Quality Tier</span>
                      <strong>{form.qualityTier}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <style jsx>{`
        .pab-page {
          background: #F3F3FF;
          padding: 0;
        }

        .pab-stepper {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 32px 24px;
          background: white;
          box-shadow: 0 2px 8px rgba(7, 7, 78, 0.06);
        }

        .stepper-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stepper-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #EEF0FF;
          color: #9F9FD1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          border: 2px solid transparent;
          transition: all 0.3s ease;
        }

        .stepper-circle.active {
          background: #7387FF;
          color: white;
          border-color: #7387FF;
        }

        .stepper-circle.completed {
          background: #27AE60;
          color: white;
          border-color: #27AE60;
        }

        .stepper-line {
          width: 48px;
          height: 2px;
          background: #E2E8F0;
          transition: all 0.3s ease;
        }

        .stepper-line.completed {
          background: #27AE60;
        }

        .pab-body {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 32px;
          padding: 32px 8%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .pab-form-panel {
          background: white;
          border-radius: 22px;
          padding: 40px;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.06);
        }

        .step-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .step-header {
          margin-bottom: 8px;
        }

        .step-header h2 {
          font-size: 24px;
          font-weight: 700;
          color: #07074E;
          margin-bottom: 8px;
        }

        .step-header p {
          color: #9F9FD1;
          font-size: 14px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 700;
          color: #07074E;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .input-field,
        .textarea-field {
          padding: 12px 16px;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          color: #07074E;
          transition: all 0.2s ease;
        }

        .input-field:focus,
        .textarea-field:focus {
          outline: none;
          border-color: #7387FF;
          box-shadow: 0 0 0 3px rgba(115, 135, 255, 0.1);
        }

        .input-with-prefix {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          background: white;
          overflow: hidden;
        }

        .input-with-prefix.large {
          padding: 8px;
        }

        .input-with-prefix span {
          padding: 0 16px;
          color: #07074E;
          font-weight: 700;
        }

        .input-with-prefix .input-field {
          border: 0;
          padding: 12px 0;
          flex: 1;
        }

        .image-upload {
          margin-top: 8px;
        }

        .upload-box {
          border: 2px dashed #E2E8F0;
          border-radius: 12px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .upload-box:hover {
          border-color: #7387FF;
          background: #F8F9FF;
        }

        .upload-box p {
          color: #07074E;
          font-weight: 600;
          margin: 0;
        }

        .upload-box small {
          color: #9F9FD1;
          display: block;
        }

        .image-preview {
          position: relative;
          width: 100%;
          max-width: 280px;
          margin: 0 auto;
          border-radius: 12px;
          overflow: hidden;
        }

        .image-preview img {
          width: 100%;
          height: auto;
          display: block;
        }

        .remove-image {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .remove-image:hover {
          background: rgba(0, 0, 0, 0.8);
        }

        .tag-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .tag-btn {
          padding: 10px 16px;
          border: 1px solid #E2E8F0;
          border-radius: 999px;
          background: white;
          color: #9F9FD1;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tag-btn:hover {
          border-color: #7387FF;
          color: #7387FF;
        }

        .tag-btn.active {
          background: #7387FF;
          color: white;
          border-color: #7387FF;
        }

        .format-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .format-card {
          padding: 20px;
          border: 2px solid #E2E8F0;
          border-radius: 12px;
          background: white;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .format-card:hover {
          border-color: #7387FF;
        }

        .format-card.active {
          background: #F8F9FF;
          border-color: #7387FF;
        }

        .format-icon {
          font-size: 32px;
        }

        .format-card strong {
          color: #07074E;
          font-size: 14px;
        }

        .format-card small {
          color: #9F9FD1;
          font-size: 12px;
        }

        .button-group {
          display: flex;
          gap: 8px;
        }

        .ratio-btn {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          background: white;
          color: #9F9FD1;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ratio-btn:hover {
          border-color: #7387FF;
        }

        .ratio-btn.active {
          background: #7387FF;
          color: white;
          border-color: #7387FF;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 12px;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .checkbox-item:hover {
          background: #F8F9FF;
        }

        .checkbox-item input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .checkbox-item span {
          color: #07074E;
          font-weight: 500;
        }

        .revisions-stepper {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .revisions-stepper button {
          width: 40px;
          height: 40px;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          background: white;
          color: #07074E;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .revisions-stepper button:hover {
          border-color: #7387FF;
          background: #F8F9FF;
        }

        .revisions-stepper span {
          color: #07074E;
          font-weight: 600;
          min-width: 120px;
        }

        .level-grid,
        .tier-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .level-card,
        .tier-card {
          padding: 20px;
          border: 2px solid #E2E8F0;
          border-radius: 12px;
          background: white;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .level-card:hover,
        .tier-card:hover {
          border-color: #7387FF;
        }

        .level-card.active,
        .tier-card.active {
          background: #F8F9FF;
          border-color: #7387FF;
        }

        .level-card strong,
        .tier-card strong {
          display: block;
          color: #07074E;
          font-size: 16px;
          margin-bottom: 4px;
        }

        .level-card p,
        .tier-card p {
          color: #7387FF;
          font-weight: 700;
          font-size: 14px;
          margin: 0 0 8px;
        }

        .level-card small,
        .tier-card small {
          color: #9F9FD1;
          font-size: 12px;
          display: block;
        }

        .info-box {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #E0E7FF;
          border-radius: 8px;
          border-left: 4px solid #7387FF;
        }

        .info-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .info-box strong {
          color: #07074E;
          display: block;
          margin-bottom: 4px;
        }

        .info-box p {
          color: #3730a3;
          font-size: 13px;
          margin: 0;
          line-height: 1.5;
        }

        .pab-footer {
          display: flex;
          gap: 12px;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #E2E8F0;
          justify-content: flex-end;
        }

        .btn-primary,
        .btn-secondary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 32px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #7387FF;
          color: white;
          box-shadow: 0 4px 15px rgba(115, 135, 255, 0.4);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(115, 135, 255, 0.6);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #9F9FD1;
          border: 1px solid #E2E8F0;
        }

        .btn-secondary:hover {
          border-color: #7387FF;
          color: #7387FF;
        }

        .pab-right-rail {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .rail-card {
          background: white;
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.06);
        }

        .rail-card h3 {
          font-size: 12px;
          font-weight: 700;
          color: #07074E;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .preview-card .product-preview {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .placeholder {
          width: 100%;
          aspect-ratio: 1;
          background: #EEF0FF;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9F9FD1;
          font-weight: 600;
        }

        .product-preview img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 12px;
        }

        .preview-name {
          color: #07074E;
          font-weight: 600;
          font-size: 14px;
          margin: 0;
        }

        .preview-type {
          color: #9F9FD1;
          font-size: 12px;
          margin: 0;
        }

        .tip-card {
          background: linear-gradient(135deg, #F8F9FF 0%, #EEF0FF 100%);
          border: 1px solid #E0E7FF;
        }

        .tip-card p {
          color: #3730a3;
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
        }

        .tips {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tip-item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .tip-item svg {
          color: #F59E0B;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .tip-item p {
          color: #3730a3;
          font-size: 13px;
          margin: 0;
          line-height: 1.5;
        }

        .checklist {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .checklist label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          color: #9F9FD1;
          font-size: 13px;
          font-weight: 500;
        }

        .checklist label.checked {
          color: #27AE60;
        }

        .checklist input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .summary-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-section {
          padding-bottom: 12px;
          border-bottom: 1px solid #E2E8F0;
        }

        .summary-section:last-child {
          border-bottom: none;
        }

        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: #9F9FD1;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
        }

        .summary-item span {
          color: #9F9FD1;
        }

        .summary-item strong {
          color: #07074E;
          text-align: right;
        }

        @media (max-width: 1024px) {
          .pab-body {
            grid-template-columns: 1fr;
          }

          .pab-right-rail {
            display: none;
          }

          .format-grid {
            grid-template-columns: 1fr;
          }

          .level-grid,
          .tier-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
