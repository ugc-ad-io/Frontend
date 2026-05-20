import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import {
  LayoutDashboard,
  Upload,
  Zap,
  Bookmark,
  Star,
  User,
  Briefcase,
  FileCheck,
  MessageSquare,
  IndianRupee,
  Settings,
  ArrowLeft,
  X,
  Plus
} from 'lucide-react';
import { useState } from 'react';
import './CreateGig.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CreateGig() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    price: '',
    deliveryTime: '',
    gender: '',
    nativeLanguage: '',
    ageRange: '',
    videoStyles: [],
    city: '',
    filmingStyle: [],
    platforms: [],
    niche: '',
    averageResponseTime: ''
  });

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator'), active: true },
    { name: 'Create a Gig', icon: Upload, action: () => navigate('/create-gig') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
    { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
    { name: 'Browse Briefs', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: Settings, action: () => navigate('/settings') }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelect = (name, value) => {
    setFormData(prev => {
      const current = prev[name] || [];
      if (current.includes(value)) {
        return { ...prev, [name]: current.filter(item => item !== value) };
      } else {
        return { ...prev, [name]: [...current, value] };
      }
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
        setMediaItems(prev => [...prev, { id: Date.now() + Math.random(), url: response.data.file_url }]);
        toast.success(`${file.name} uploaded`);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    e.target.value = '';
  };

  const removeMedia = (id) => {
    setMediaItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.category || !formData.description || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (mediaItems.length === 0) {
      toast.error('Please add at least 1 image/video');
      return;
    }

    setLoading(true);
    try {
      const gigData = {
        ...formData,
        media: mediaItems.map(item => item.url),
        price: parseFloat(formData.price)
      };

      await axios.post(`${API}/gigs`, gigData);
      toast.success('Gig created successfully!');
      navigate('/dashboard/creator');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create gig');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      title="Create a Gig"
      description="Offer your services and attract clients"
      topbarExtra={null}
      sidebarExtra={null}
    >
      <section className="create-gig-container">
        <div className="create-gig-card">
          <button
            type="button"
            className="create-gig-back"
            onClick={() => navigate('/dashboard/creator')}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <div className="create-gig-header">
            <h1>Create a New Gig</h1>
            <p>Set up a service offering to attract clients and grow your creator business</p>
          </div>

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
                  placeholder="e.g., I will create professional UGC videos for your brand"
                  maxLength="80"
                  required
                />
                <small>Be specific about what you offer (max 80 characters)</small>
              </fieldset>

              <fieldset>
                <legend>Category *</legend>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a category</option>
                  <option value="ugc-videos">UGC Videos</option>
                  <option value="product-reviews">Product Reviews</option>
                  <option value="unboxing">Unboxing</option>
                  <option value="testimonials">Testimonials</option>
                  <option value="demo-videos">Demo Videos</option>
                  <option value="social-content">Social Content</option>
                  <option value="lifestyle">Lifestyle Content</option>
                  <option value="comparison">Product Comparison</option>
                  <option value="tutorials">Tutorials</option>
                  <option value="behind-scenes">Behind the Scenes</option>
                </select>
              </fieldset>

              <fieldset>
                <legend>Description *</legend>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your gig in detail. Include what's included, your process, and delivery timeline."
                  rows="6"
                  maxLength="2000"
                  required
                />
                <small>Provide detailed information to help clients understand your offer (max 2000 characters)</small>
              </fieldset>

              <fieldset>
                <legend>Starting Price *</legend>
                <div className="price-input">
                  <span>₹</span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="e.g., 5000"
                    min="0"
                    required
                  />
                </div>
                <small>Set your minimum price for this gig</small>
              </fieldset>

              <fieldset>
                <legend>Delivery Time *</legend>
                <select
                  name="deliveryTime"
                  value={formData.deliveryTime}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select delivery time</option>
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </select>
              </fieldset>
            </div>

            <div className="create-gig-section">
              <h3>Personal Information</h3>

              <fieldset>
                <legend>Gender</legend>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </fieldset>

              <fieldset>
                <legend>Native Language</legend>
                <input
                  type="text"
                  name="nativeLanguage"
                  value={formData.nativeLanguage}
                  onChange={handleInputChange}
                  placeholder="e.g., English, Hindi"
                />
              </fieldset>

              <fieldset>
                <legend>Age Range</legend>
                <select
                  name="ageRange"
                  value={formData.ageRange}
                  onChange={handleInputChange}
                >
                  <option value="">Select age range</option>
                  <option value="18-25">18-25</option>
                  <option value="26-35">26-35</option>
                  <option value="36-45">36-45</option>
                  <option value="46+">46+</option>
                </select>
              </fieldset>

              <fieldset>
                <legend>City</legend>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="e.g., Mumbai, Bangalore"
                />
              </fieldset>

              <fieldset>
                <legend>Niche</legend>
                <input
                  type="text"
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  placeholder="e.g., Beauty, Tech, Fashion"
                />
              </fieldset>

              <fieldset>
                <legend>Average Response Time</legend>
                <select
                  name="averageResponseTime"
                  value={formData.averageResponseTime}
                  onChange={handleInputChange}
                >
                  <option value="">Select response time</option>
                  <option value="1-hour">Within 1 hour</option>
                  <option value="2-hour">Within 2 hours</option>
                  <option value="4-hour">Within 4 hours</option>
                  <option value="24-hour">Within 24 hours</option>
                </select>
              </fieldset>
            </div>

            <div className="create-gig-section">
              <h3>Content Details</h3>

              <fieldset>
                <legend>Video Styles</legend>
                <div className="checkbox-group">
                  {['Professional', 'Casual', 'Energetic', 'Slow Motion', 'Time Lapse', 'Stop Motion'].map(style => (
                    <label key={style} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.videoStyles.includes(style)}
                        onChange={() => handleMultiSelect('videoStyles', style)}
                      />
                      <span>{style}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Filming Style</legend>
                <div className="checkbox-group">
                  {['Smartphone', 'DSLR', 'Professional Camera', 'Animation', 'Screen Recording', 'Live Action'].map(style => (
                    <label key={style} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.filmingStyle.includes(style)}
                        onChange={() => handleMultiSelect('filmingStyle', style)}
                      />
                      <span>{style}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Platforms</legend>
                <div className="checkbox-group">
                  {['YouTube', 'Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'Twitter', 'Snapchat'].map(platform => (
                    <label key={platform} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.platforms.includes(platform)}
                        onChange={() => handleMultiSelect('platforms', platform)}
                      />
                      <span>{platform}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="create-gig-section">
              <h3>Portfolio Media (Add up to 5 images/videos)</h3>

              <fieldset>
                <legend>Upload Images/Videos</legend>
                <div className="media-upload-area">
                  <label className="media-upload-label">
                    <Plus size={24} />
                    <span>Click to upload or drag and drop</span>
                    <small>JPG, PNG, MP4 • Max 10MB per file</small>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
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
                        {item.url.includes('.mp4') || item.url.includes('.webm') ? (
                          <video src={item.url} controls />
                        ) : (
                          <img src={item.url} alt="Preview" />
                        )}
                        <button
                          type="button"
                          className="media-remove-btn"
                          onClick={() => removeMedia(item.id)}
                        >
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
              <button type="button" className="create-gig-cancel" onClick={() => navigate('/dashboard/creator')}>
                Cancel
              </button>
              <button type="submit" className="create-gig-submit" disabled={loading}>
                <Upload size={16} />
                {loading ? 'Creating...' : 'Create Gig'}
              </button>
            </div>
          </form>

          <div className="create-gig-tips">
            <h3>Tips for a Successful Gig</h3>
            <ul>
              <li>Write a clear, specific title that clients can find easily</li>
              <li>Describe your experience and what makes your service unique</li>
              <li>Set competitive pricing based on your skill level and market rates</li>
              <li>Be realistic about delivery times</li>
              <li>Offer extras or premium options for higher-tier clients</li>
            </ul>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
