import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, Tag, DollarSign, User, Video, Image as ImageIcon, Share2, CreditCard, CheckCircle2, Sparkles, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CreatorProfileSetup() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bio: '',
    tags: [],
    social_links: { instagram: '', youtube: '', tiktok: '' },
    rate_card: {
      video_30s: '',
      video_30s_included: '',
      video_60s: '',
      video_60s_included: '',
      photo_post: '',
      photo_post_included: ''
    },
    payment_methods: { upi: '', bank_account: '' },
    receive_briefs: true,
    terms_agreed: false,
    intro_video: '',
    portfolio: [],
    availability_calendar: {}
  });
  const [tagInput, setTagInput] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video file too large. Maximum 50MB allowed.');
      return;
    }

    setUploadingVideo(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await axios.post(`${API}/upload/file`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, intro_video: response.data.file_url }));
      toast.success('Intro video uploaded!');
    } catch (error) {
      console.error('Video upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handlePortfolioUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingPortfolio(true);

    try {
      const uploadPromises = files.map(async (file) => {
        // Validate file size (max 10MB per file for portfolio)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is too large. Maximum 10MB per file.`);
        }
        
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        const response = await axios.post(`${API}/upload/file`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.file_url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setFormData(prev => ({ 
        ...prev, 
        portfolio: [...prev.portfolio, ...uploadedUrls]
      }));
      toast.success(`${uploadedUrls.length} file(s) uploaded to portfolio!`);
    } catch (error) {
      console.error('Portfolio upload error:', error);
      toast.error(error.response?.data?.detail || error.message || 'Failed to upload portfolio items');
    } finally {
      setUploadingPortfolio(false);
    }
  };

  const removePortfolioItem = (url) => {
    setFormData(prev => ({
      ...prev,
      portfolio: prev.portfolio.filter(item => item !== url)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.terms_agreed) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    if (formData.tags.length === 0) {
      toast.error('Please add at least one tag/niche');
      return;
    }

    setLoading(true);

    try {
      await axios.put(`${API}/profile/creator`, formData);
      toast.success('Profile submitted for review!');
      
      // Update user context
      const updatedUser = { ...user, profile_completed: true, approval_status: 'pending' };
      setUser(updatedUser);
      
      navigate('/dashboard/creator');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const sectionCompletion = {
    about: formData.bio.trim().length > 0,
    intro: !!formData.intro_video,
    portfolio: formData.portfolio.length > 0,
    tags: formData.tags.length > 0,
    social: !!(formData.social_links.instagram || formData.social_links.youtube),
    rates: !!(formData.rate_card.video_30s && formData.rate_card.video_60s && formData.rate_card.photo_post),
    payment: !!formData.payment_methods.upi,
    terms: formData.terms_agreed
  };
  const completedCount = Object.values(sectionCompletion).filter(Boolean).length;
  const totalSections = Object.keys(sectionCompletion).length;
  const progressPct = Math.round((completedCount / totalSections) * 100);

  return (
    <div className="profile-setup-page">
      <div className="profile-container fade-in">
        <div className="profile-hero">
          <div className="hero-badge">
            <Sparkles size={14} /> Creator Onboarding
          </div>
          <h1>Complete Your Creator Profile</h1>
          <p>Tell us about yourself and showcase your work — brands discover you through this page.</p>

          <div className="progress-wrap">
            <div className="progress-meta">
              <span>Profile completeness</span>
              <strong>{progressPct}%</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="progress-sub">{completedCount} of {totalSections} sections filled</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <section className={`form-section ${sectionCompletion.about ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">1</span>
              <div className="section-title">
                <h3><User size={18} /> About You</h3>
                <p className="hint">Introduce yourself in your own words.</p>
              </div>
              {sectionCompletion.about && <CheckCircle2 size={20} className="section-check" />}
            </div>
            <div className="form-group">
              <label htmlFor="bio">Bio <span className="label-meta">(100 words max)</span></label>
              <textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                className="textarea-field"
                placeholder="Tell brands about yourself, your style, and expertise..."
                maxLength={500}
                required
                data-testid="bio-input"
              />
              <span className="char-count">{formData.bio.length}/500 characters</span>
            </div>
          </section>

          <section className={`form-section ${sectionCompletion.intro ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">2</span>
              <div className="section-title">
                <h3><Video size={18} /> Intro Video <span className="optional-pill">Optional</span></h3>
                <p className="hint">A 30–60s clip introducing yourself helps brands trust you faster.</p>
              </div>
              {sectionCompletion.intro && <CheckCircle2 size={20} className="section-check" />}
            </div>
            <div className="form-group">
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleVideoUpload}
                style={{ display: 'none' }}
                id="intro-video-upload"
              />
              <label htmlFor="intro-video-upload" className={`dropzone ${formData.intro_video ? 'is-filled' : ''} ${uploadingVideo ? 'is-loading' : ''}`}>
                {uploadingVideo ? (
                  <>
                    <div className="spinner" />
                    <span>Uploading...</span>
                  </>
                ) : formData.intro_video ? (
                  <>
                    <CheckCircle2 size={28} />
                    <span><strong>Video uploaded</strong></span>
                    <span className="dropzone-sub">Click to replace</span>
                  </>
                ) : (
                  <>
                    <Video size={28} />
                    <span><strong>Choose video</strong> or drag and drop</span>
                    <span className="dropzone-sub">MP4, MOV, WEBM · Max 50MB</span>
                  </>
                )}
              </label>
              {formData.intro_video && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, intro_video: '' }))}
                  className="btn-ghost"
                >
                  <X size={14} /> Remove video
                </button>
              )}
            </div>
          </section>

          <section className={`form-section ${sectionCompletion.portfolio ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">3</span>
              <div className="section-title">
                <h3><ImageIcon size={18} /> Portfolio <span className="optional-pill">Optional</span></h3>
                <p className="hint">Past work that shows your style. Max 10MB per file.</p>
              </div>
              {sectionCompletion.portfolio && <CheckCircle2 size={20} className="section-check" />}
            </div>
            <div className="form-group">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handlePortfolioUpload}
                style={{ display: 'none' }}
                id="portfolio-upload"
              />
              <label htmlFor="portfolio-upload" className={`dropzone ${uploadingPortfolio ? 'is-loading' : ''}`}>
                {uploadingPortfolio ? (
                  <>
                    <div className="spinner" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={28} />
                    <span><strong>Add portfolio items</strong></span>
                    <span className="dropzone-sub">Images or videos · Select multiple</span>
                  </>
                )}
              </label>
              {formData.portfolio.length > 0 && (
                <div className="portfolio-preview">
                  {formData.portfolio.map((url, idx) => {
                    const isVideo = url.match(/\.(mp4|mov|webm|avi)$/i);
                    return (
                      <div key={idx} className="portfolio-item">
                        {isVideo ? (
                          <video src={`${BACKEND_URL}${url}`} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <img src={`${BACKEND_URL}${url}`} alt={`Portfolio ${idx + 1}`} />
                        )}
                        <button
                          type="button"
                          onClick={() => removePortfolioItem(url)}
                          className="remove-btn"
                          aria-label="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className={`form-section ${sectionCompletion.tags ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">4</span>
              <div className="section-title">
                <h3><Tag size={18} /> Tags & Niche</h3>
                <p className="hint">Help brands discover you by your strengths.</p>
              </div>
              {sectionCompletion.tags && <CheckCircle2 size={20} className="section-check" />}
            </div>
            <div className="form-group">
              <label htmlFor="tags">Add Tags <span className="label-meta">(Fashion, Beauty, Tech, etc.)</span></label>
              <div className="tag-input-wrapper">
                <input
                  id="tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="input-field"
                  placeholder="Type and press Enter"
                  data-testid="tag-input"
                />
                <button type="button" onClick={addTag} className="btn-secondary" data-testid="add-tag-btn">
                  Add
                </button>
              </div>
              <div className="tags-list">
                {formData.tags.map((tag, idx) => (
                  <span key={idx} className="tag-badge" data-testid={`tag-${idx}`}>
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} data-testid={`remove-tag-${idx}`}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className={`form-section ${sectionCompletion.social ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">5</span>
              <div className="section-title">
                <h3><Share2 size={18} /> Social Links <span className="optional-pill">Private</span></h3>
                <p className="hint">Used internally for verification — hidden from public view.</p>
              </div>
              {sectionCompletion.social && <CheckCircle2 size={20} className="section-check" />}
            </div>
            <div className="form-group">
              <label htmlFor="instagram">Instagram</label>
              <input
                id="instagram"
                type="text"
                value={formData.social_links.instagram}
                onChange={(e) => handleNestedChange('social_links', 'instagram', e.target.value)}
                className="input-field"
                placeholder="@username"
                data-testid="instagram-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="youtube">YouTube</label>
              <input
                id="youtube"
                type="text"
                value={formData.social_links.youtube}
                onChange={(e) => handleNestedChange('social_links', 'youtube', e.target.value)}
                className="input-field"
                placeholder="Channel URL"
                data-testid="youtube-input"
              />
            </div>
          </section>

          <section className={`form-section ${sectionCompletion.rates ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">6</span>
              <div className="section-title">
                <h3><DollarSign size={18} /> Rate Card</h3>
                <p className="hint">Set your price for each package and describe what's included.</p>
              </div>
              {sectionCompletion.rates && <CheckCircle2 size={20} className="section-check" />}
            </div>

            <div className="rate-package">
              <div className="rate-package-header">
                <h4>Basic — 30s Video</h4>
                <div className="form-group rate-price-input">
                  <label htmlFor="video_30s">Price ($)</label>
                  <input
                    id="video_30s"
                    type="number"
                    value={formData.rate_card.video_30s}
                    onChange={(e) => handleNestedChange('rate_card', 'video_30s', e.target.value)}
                    className="input-field"
                    placeholder="100"
                    required
                    data-testid="rate-video-30s"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="video_30s_included">What's Included</label>
                <textarea
                  id="video_30s_included"
                  value={formData.rate_card.video_30s_included}
                  onChange={(e) => handleNestedChange('rate_card', 'video_30s_included', e.target.value)}
                  className="textarea-field"
                  placeholder="e.g., 1 x 30-second video, B-Roll included, Subtitles, 1 revision, 3 months usage rights"
                  rows="3"
                  maxLength="500"
                />
                <span className="char-count">{(formData.rate_card.video_30s_included || '').length}/500 characters</span>
              </div>
            </div>

            <div className="rate-package">
              <div className="rate-package-header">
                <h4>Standard — 60s Video</h4>
                <div className="form-group rate-price-input">
                  <label htmlFor="video_60s">Price ($)</label>
                  <input
                    id="video_60s"
                    type="number"
                    value={formData.rate_card.video_60s}
                    onChange={(e) => handleNestedChange('rate_card', 'video_60s', e.target.value)}
                    className="input-field"
                    placeholder="150"
                    required
                    data-testid="rate-video-60s"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="video_60s_included">What's Included</label>
                <textarea
                  id="video_60s_included"
                  value={formData.rate_card.video_60s_included}
                  onChange={(e) => handleNestedChange('rate_card', 'video_60s_included', e.target.value)}
                  className="textarea-field"
                  placeholder="e.g., 1 x 60-second video, B-Roll, Graphics, Subtitles, 2 revisions, 6 months usage rights, Priority support"
                  rows="3"
                  maxLength="500"
                />
                <span className="char-count">{(formData.rate_card.video_60s_included || '').length}/500 characters</span>
              </div>
            </div>

            <div className="rate-package">
              <div className="rate-package-header">
                <h4>Premium — Photo Post / Bundle</h4>
                <div className="form-group rate-price-input">
                  <label htmlFor="photo_post">Price ($)</label>
                  <input
                    id="photo_post"
                    type="number"
                    value={formData.rate_card.photo_post}
                    onChange={(e) => handleNestedChange('rate_card', 'photo_post', e.target.value)}
                    className="input-field"
                    placeholder="80"
                    required
                    data-testid="rate-photo-post"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="photo_post_included">What's Included</label>
                <textarea
                  id="photo_post_included"
                  value={formData.rate_card.photo_post_included}
                  onChange={(e) => handleNestedChange('rate_card', 'photo_post_included', e.target.value)}
                  className="textarea-field"
                  placeholder="e.g., Photo post + 60s video, Full source files, Unlimited revisions, 12 months usage rights"
                  rows="3"
                  maxLength="500"
                />
                <span className="char-count">{(formData.rate_card.photo_post_included || '').length}/500 characters</span>
              </div>
            </div>
          </section>

          <section className={`form-section ${sectionCompletion.payment ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">7</span>
              <div className="section-title">
                <h3><CreditCard size={18} /> Payment Methods</h3>
                <p className="hint">Where you'd like to receive payouts.</p>
              </div>
              {sectionCompletion.payment && <CheckCircle2 size={20} className="section-check" />}
            </div>
            <div className="form-group">
              <label htmlFor="upi">UPI ID</label>
              <input
                id="upi"
                type="text"
                value={formData.payment_methods.upi}
                onChange={(e) => handleNestedChange('payment_methods', 'upi', e.target.value)}
                className="input-field"
                placeholder="yourname@upi"
                required
                data-testid="upi-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="bank_account">Bank Account (Last 4 digits)</label>
              <input
                id="bank_account"
                type="text"
                value={formData.payment_methods.bank_account}
                onChange={(e) => handleNestedChange('payment_methods', 'bank_account', e.target.value)}
                className="input-field"
                placeholder="XXXX1234"
                data-testid="bank-input"
              />
            </div>
          </section>

          <section className={`form-section ${sectionCompletion.terms ? 'is-complete' : ''}`}>
            <div className="section-head">
              <span className="section-number">8</span>
              <div className="section-title">
                <h3><CheckCircle2 size={18} /> Preferences & Terms</h3>
                <p className="hint">Final step before review.</p>
              </div>
              {sectionCompletion.terms && <CheckCircle2 size={20} className="section-check" />}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.receive_briefs}
                onChange={(e) => handleInputChange('receive_briefs', e.target.checked)}
                data-testid="receive-briefs-checkbox"
              />
              <span>I want to receive campaign briefs</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.terms_agreed}
                onChange={(e) => handleInputChange('terms_agreed', e.target.checked)}
                required
                data-testid="terms-checkbox"
              />
              <span>I agree to the Terms & Conditions</span>
            </label>
          </section>

          <div className="submit-bar">
            <div className="submit-meta">
              <strong>{progressPct}% complete</strong>
              <span>Your profile will be reviewed by our team within 24–48 hours.</span>
            </div>
            <button type="submit" className="btn-primary submit-btn" disabled={loading} data-testid="submit-profile-btn">
              {loading ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .profile-setup-page {
          min-height: 100vh;
          padding: 40px 20px 60px;
          background:
            radial-gradient(1200px 600px at 10% -10%, rgba(102, 126, 234, 0.15), transparent 60%),
            radial-gradient(1000px 500px at 110% 10%, rgba(118, 75, 162, 0.18), transparent 60%),
            linear-gradient(135deg, #f8f9ff 0%, #eef1ff 100%);
        }

        .profile-container {
          max-width: 880px;
          margin: 0 auto;
          background: white;
          border-radius: 28px;
          padding: 0;
          box-shadow: 0 20px 60px rgba(45, 55, 90, 0.10), 0 2px 8px rgba(45, 55, 90, 0.04);
          overflow: hidden;
          border: 1px solid rgba(102, 126, 234, 0.08);
        }

        .profile-hero {
          position: relative;
          padding: 44px 48px 36px;
          background:
            radial-gradient(600px 240px at 90% 0%, rgba(255, 255, 255, 0.35), transparent 60%),
            linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 16px;
          backdrop-filter: blur(8px);
        }

        .profile-hero h1 {
          font-size: 2.1rem;
          font-weight: 700;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }

        .profile-hero p {
          font-size: 1rem;
          opacity: 0.92;
          margin: 0 0 24px;
          max-width: 560px;
          line-height: 1.55;
        }

        .progress-wrap {
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 16px;
          padding: 14px 18px;
          backdrop-filter: blur(10px);
        }

        .progress-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .progress-meta strong {
          font-size: 1.1rem;
          font-weight: 700;
        }

        .progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffd86b 0%, #ff9d6c 100%);
          border-radius: 999px;
          transition: width 0.4s ease;
        }

        .progress-sub {
          display: block;
          margin-top: 8px;
          font-size: 0.8rem;
          opacity: 0.85;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 32px 48px 40px;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #fbfcff;
          border: 1.5px solid #e8ecff;
          border-radius: 18px;
          padding: 24px 28px;
          transition: all 0.25s ease;
        }

        .form-section:hover {
          border-color: #c7d2fe;
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.08);
        }

        .form-section.is-complete {
          border-color: #86efac;
          background: linear-gradient(135deg, #f0fdf4 0%, #fbfcff 60%);
        }

        .section-head {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .section-number {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
        }

        .form-section.is-complete .section-number {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          box-shadow: 0 2px 6px rgba(34, 197, 94, 0.3);
        }

        .section-title {
          flex: 1;
        }

        .section-title h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1a202c;
          margin: 0 0 4px;
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: -0.01em;
        }

        .section-title h3 :global(svg) {
          color: #667eea;
        }

        .section-check {
          color: #22c55e;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .optional-pill {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 10px;
          background: #eef2ff;
          color: #6366f1;
          border-radius: 999px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .hint {
          font-size: 0.85rem;
          color: #718096;
          margin: 0;
          line-height: 1.5;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          color: #2d3748;
          font-size: 0.9rem;
        }

        .label-meta {
          font-weight: 400;
          color: #a0aec0;
          font-size: 0.8rem;
        }

        .char-count {
          text-align: right;
          font-size: 0.8rem;
          color: #a0aec0;
        }

        .tag-input-wrapper {
          display: flex;
          gap: 10px;
        }

        .tag-input-wrapper .input-field {
          flex: 1;
        }

        .tag-input-wrapper .btn-secondary {
          padding: 12px 22px;
          white-space: nowrap;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
        }

        .tag-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 500;
          box-shadow: 0 2px 6px rgba(102, 126, 234, 0.25);
        }

        .tag-badge button {
          background: rgba(255, 255, 255, 0.25);
          border: none;
          color: white;
          font-size: 0.9rem;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }

        .tag-badge button:hover {
          background: rgba(255, 255, 255, 0.45);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.95rem;
          color: #2d3748;
          cursor: pointer;
          padding: 10px 14px;
          border-radius: 10px;
          background: white;
          border: 1.5px solid #e2e8f0;
          transition: all 0.2s ease;
        }

        .checkbox-label:hover {
          border-color: #c7d2fe;
          background: #f9faff;
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: #667eea;
          cursor: pointer;
        }

        .dropzone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 32px 24px;
          background: white;
          border: 2px dashed #c7d2fe;
          border-radius: 14px;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: center;
        }

        .dropzone :global(svg) {
          color: #667eea;
        }

        .dropzone:hover {
          border-color: #667eea;
          background: #f5f7ff;
          transform: translateY(-1px);
        }

        .dropzone.is-filled {
          background: linear-gradient(135deg, #f0fdf4 0%, #f9faff 100%);
          border-color: #22c55e;
          color: #166534;
        }

        .dropzone.is-filled :global(svg) {
          color: #22c55e;
        }

        .dropzone.is-loading {
          opacity: 0.75;
          pointer-events: none;
        }

        .dropzone strong {
          font-weight: 600;
          color: #1a202c;
        }

        .dropzone.is-filled strong {
          color: #166534;
        }

        .dropzone-sub {
          font-size: 0.8rem;
          color: #94a3b8;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e2e8f0;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .btn-ghost {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          color: #ef4444;
          border: none;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.2s ease;
        }

        .btn-ghost:hover {
          background: #fef2f2;
        }

        .portfolio-preview {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          margin-top: 8px;
        }

        .portfolio-item {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 1;
          border: 2px solid #e2e8f0;
        }

        .portfolio-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .remove-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 26px;
          height: 26px;
          background: rgba(15, 23, 42, 0.7);
          color: white;
          border: none;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          transition: background 0.2s ease;
          backdrop-filter: blur(4px);
        }

        .remove-btn:hover {
          background: #ef4444;
        }

        .submit-bar {
          position: sticky;
          bottom: 20px;
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 24px;
          background: white;
          border: 1.5px solid #e8ecff;
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(45, 55, 90, 0.12);
          flex-wrap: wrap;
        }

        .submit-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .submit-meta strong {
          font-size: 1rem;
          color: #1a202c;
          font-weight: 700;
        }

        .submit-meta span {
          font-size: 0.8rem;
          color: #718096;
        }

        .submit-btn {
          min-width: 200px;
        }

        @media (max-width: 720px) {
          .profile-setup-page {
            padding: 20px 12px 40px;
          }

          .profile-container {
            border-radius: 20px;
          }

          .profile-hero {
            padding: 32px 24px 28px;
          }

          .profile-hero h1 {
            font-size: 1.6rem;
          }

          .profile-form {
            padding: 24px 20px 28px;
          }

          .form-section {
            padding: 20px 18px;
          }

          .section-head {
            gap: 10px;
          }

          .submit-bar {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .submit-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}