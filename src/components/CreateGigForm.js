import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, X, Plus } from 'lucide-react';
import '../pages/CreateGig.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Reusable gig-creation form. Rendered standalone on /create-gig and inside the
// blurred modal on the My Gigs page. `onSuccess` fires after a gig is created;
// `onCancel` fires when the user backs out. `showTips` toggles the tips block.
export default function CreateGigForm({ onSuccess, onCancel, showTips = true }) {
  const [loading, setLoading] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    budget: '',
    deadline: '',
    niche: [],
    videoStyles: [],
    filmingStyle: [],
    platforms: []
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelect = (name, value) => {
    setFormData(prev => {
      const current = prev[name] || [];
      if (current.includes(value)) {
        return { ...prev, [name]: current.filter(item => item !== value) };
      }
      return { ...prev, [name]: [...current, value] };
    });
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (mediaItems.length + files.length > 5) {
      toast.error('Maximum 5 images/videos allowed');
      return;
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum 10MB per file.`);
        continue;
      }

      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      try {
        const response = await axios.post(`${API}/upload/file`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        let fileUrl = response.data?.file_url || response.data?.url || response.data?.data?.url || response.data;

        if (!fileUrl || typeof fileUrl !== 'string') {
          toast.error(`${file.name} uploaded but URL is invalid`);
          continue;
        }

        if (fileUrl.startsWith('/')) {
          fileUrl = `${BACKEND_URL}${fileUrl}`;
        }

        setMediaItems(prev => [...prev, { id: Date.now() + Math.random(), url: fileUrl }]);
        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        const errorMsg = error.response?.data?.error || error.response?.data?.detail || error.message || 'Upload failed';
        toast.error(`Failed to upload ${file.name}: ${errorMsg}`);
      }
    }
    e.target.value = '';
  };

  const removeMedia = (id) => {
    setMediaItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title?.trim()) { toast.error('Please enter a gig title'); return; }
    if (!formData.category) { toast.error('Please select a category'); return; }
    if (!formData.description?.trim()) { toast.error('Please enter a description'); return; }
    if (!formData.budget || parseFloat(formData.budget) <= 0) { toast.error('Please enter a valid budget (greater than 0)'); return; }
    if (!formData.deadline) { toast.error('Please set a deadline'); return; }

    const deadlineDate = new Date(formData.deadline);
    if (deadlineDate <= new Date()) { toast.error('Deadline must be in the future'); return; }

    setLoading(true);
    try {
      const gigData = {
        title: formData.title,
        category: formData.category,
        description: formData.description,
        budget: parseFloat(formData.budget),
        deadline: deadlineDate.toISOString(),
        attachments: mediaItems.map(item => item.url),
        niche: formData.niche || [],
        videoStyles: formData.videoStyles || [],
        filmingStyle: formData.filmingStyle || [],
        platforms: formData.platforms || []
      };

      await axios.post(`${API}/gigs`, gigData);
      toast.success('Gig created successfully! Sent for admin approval.');
      onSuccess?.();
    } catch (error) {
      const errorMsg = error.response?.data?.detail ||
                       error.response?.data?.error ||
                       error.response?.data?.message ||
                       error.message ||
                       'Failed to create gig. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form className="create-gig-form" onSubmit={handleSubmit}>
        <div className="create-gig-section">
          <h3>Basic Information</h3>

          <fieldset>
            <legend>Gig Title *</legend>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Create engaging social media content"
              maxLength="100"
              required
            />
            <small>Clear, specific title (5-100 characters)</small>
          </fieldset>

          <fieldset>
            <legend>Category *</legend>
            <select name="category" value={formData.category} onChange={handleInputChange} required>
              <option value="">Select a category</option>
              <option value="social_media">Social Media Content</option>
              <option value="product_review">Product Reviews</option>
              <option value="unboxing">Unboxing Videos</option>
              <option value="tutorial">Tutorials/How-to</option>
              <option value="sponsorship">Sponsored Content</option>
              <option value="brand_ambassador">Brand Ambassador Work</option>
              <option value="content_creation">General Content Creation</option>
              <option value="photography">Photography Work</option>
              <option value="videography">Video Production</option>
              <option value="other">Other</option>
            </select>
          </fieldset>

          <fieldset>
            <legend>Description *</legend>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe what the gig is about, what's included, and your process..."
              rows="6"
              maxLength="5000"
              required
            />
            <small>Detailed description (20-5000 characters)</small>
          </fieldset>

          <fieldset>
            <legend>Budget *</legend>
            <div className="price-input">
              <span>₹</span>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                placeholder="e.g., 500"
                step="0.01"
                min="0"
                required
              />
            </div>
            <small>Budget amount in INR (must be greater than 0)</small>
          </fieldset>

          <fieldset>
            <legend>Deadline *</legend>
            <input
              type="datetime-local"
              name="deadline"
              value={formData.deadline}
              onChange={handleInputChange}
              required
            />
            <small>When work needs to be completed (must be in the future)</small>
          </fieldset>
        </div>

        <div className="create-gig-section">
          <h3>Creator Details</h3>

          <fieldset>
            <legend>Niche</legend>
            <div className="skills-input">
              {[
                'Beauty & personal care', 'Fashion & accessories', 'Home & garden', 'Health & wellness',
                'Food & beverage', 'Tech & gadgets', 'Fitness & sports', 'Travel & lifestyle', 'Gaming',
                'Education & learning', 'Finance & business', 'Parenting & family', 'Pets & animals',
                'Automotive', 'Entertainment', 'Other'
              ].map(niche => (
                <label key={niche} className="checkbox-label">
                  <input type="checkbox" checked={formData.niche.includes(niche)} onChange={() => handleMultiSelect('niche', niche)} />
                  <span>{niche}</span>
                </label>
              ))}
            </div>
            <small>Optional - Select all niches you create content for</small>
          </fieldset>

          <fieldset>
            <legend>Video Styles</legend>
            <div className="skills-input">
              {['Product demo', 'Tutorials', 'Testimonials', 'Before/After', 'Unboxing', 'Talking head', 'Lifestyle', 'Reviews', 'Story-style', 'Comparison'].map(style => (
                <label key={style} className="checkbox-label">
                  <input type="checkbox" checked={formData.videoStyles.includes(style)} onChange={() => handleMultiSelect('videoStyles', style)} />
                  <span>{style}</span>
                </label>
              ))}
            </div>
            <small>Optional - Select all video styles you offer</small>
          </fieldset>

          <fieldset>
            <legend>Filming Style</legend>
            <div className="skills-input">
              {['Handheld', 'Selfie', 'POV', 'Tripod', 'Mirror-style', 'Studio', 'Outdoor', 'In-home'].map(style => (
                <label key={style} className="checkbox-label">
                  <input type="checkbox" checked={formData.filmingStyle.includes(style)} onChange={() => handleMultiSelect('filmingStyle', style)} />
                  <span>{style}</span>
                </label>
              ))}
            </div>
            <small>Optional - Select all filming styles you offer</small>
          </fieldset>

          <fieldset>
            <legend>Platforms</legend>
            <div className="skills-input">
              {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Snapchat', 'Twitter/X', 'LinkedIn', 'Pinterest'].map(platform => (
                <label key={platform} className="checkbox-label">
                  <input type="checkbox" checked={formData.platforms.includes(platform)} onChange={() => handleMultiSelect('platforms', platform)} />
                  <span>{platform}</span>
                </label>
              ))}
            </div>
            <small>Optional - Platforms where you create content</small>
          </fieldset>
        </div>

        <div className="create-gig-section">
          <h3>Attachments (Add up to 5 files)</h3>

          <fieldset>
            <legend>Upload Attachments</legend>
            <div className="media-upload-area">
              <label className="media-upload-label">
                <Plus size={24} />
                <span>Click to upload or drag and drop</span>
                <small>Any file type • Max 10MB per file</small>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleMediaUpload}
                  disabled={mediaItems.length >= 5}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {mediaItems.length > 0 && (
              <div className="media-preview-grid">
                {mediaItems.map(item => (
                  <div key={item.id} className="media-preview-item">
                    <div className="media-preview-content">
                      {item.url.includes('.mp4') || item.url.includes('.webm') ? (
                        <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : item.url.includes('.pdf') ? (
                        <div className="pdf-placeholder">📄 PDF File</div>
                      ) : (
                        <img src={item.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <button type="button" className="media-remove-btn" onClick={() => removeMedia(item.id)}>
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <small>{mediaItems.length}/5 files uploaded</small>
          </fieldset>
        </div>

        <div className="create-gig-actions">
          <button type="button" className="create-gig-cancel" onClick={() => onCancel?.()}>
            Cancel
          </button>
          <button type="submit" className="create-gig-submit" disabled={loading}>
            <Upload size={16} />
            {loading ? 'Creating...' : 'Create Gig'}
          </button>
        </div>
      </form>

      {showTips && (
        <div className="create-gig-tips">
          <h3>Tips for Creating Your Gig</h3>
          <ul>
            <li>Use a clear, descriptive title so creators can find your work easily</li>
            <li>Provide detailed requirements and expectations in the description</li>
            <li>Set a realistic budget based on the complexity and timeline</li>
            <li>Attach reference materials, examples, or mockups to guide the work</li>
            <li>Define the target audience clearly to get better quality submissions</li>
            <li>Be specific about required skills to attract the right creators</li>
          </ul>
        </div>
      )}
    </>
  );
}
