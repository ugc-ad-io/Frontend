import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
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
  ArrowLeft
} from 'lucide-react';
import './CreateGig.css';

export default function CreateGig() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

          <form className="create-gig-form">
            <fieldset>
              <legend>Gig Title</legend>
              <input
                type="text"
                placeholder="e.g., I will create professional UGC videos for your brand"
                maxLength="80"
              />
              <small>Be specific about what you offer (max 80 characters)</small>
            </fieldset>

            <fieldset>
              <legend>Category</legend>
              <select>
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
              <legend>Description</legend>
              <textarea
                placeholder="Describe your gig in detail. Include what's included, your process, and delivery timeline."
                rows="6"
                maxLength="2000"
              />
              <small>Provide detailed information to help clients understand your offer (max 2000 characters)</small>
            </fieldset>

            <fieldset>
              <legend>Starting Price</legend>
              <div className="price-input">
                <span>₹</span>
                <input
                  type="number"
                  placeholder="e.g., 5000"
                  min="0"
                />
              </div>
              <small>Set your minimum price for this gig</small>
            </fieldset>

            <fieldset>
              <legend>Delivery Time</legend>
              <select>
                <option value="">Select delivery time</option>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </fieldset>

            <div className="create-gig-actions">
              <button type="button" className="create-gig-cancel" onClick={() => navigate('/dashboard/creator')}>
                Cancel
              </button>
              <button type="submit" className="create-gig-submit">
                <Upload size={16} />
                Create Gig
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
