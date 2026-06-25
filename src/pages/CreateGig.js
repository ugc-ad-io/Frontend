import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import CreateGigForm from '../components/CreateGigForm';
import {
  LayoutDashboard,
  ClipboardList,
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
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Gigs', icon: ClipboardList, action: () => navigate('/my-gigs') },
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
            onClick={() => navigate('/my-gigs')}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <div className="create-gig-header">
            <h1>Create a New Gig</h1>
            <p>Set up a service offering to attract clients and grow your creator business</p>
          </div>

          <CreateGigForm
            onSuccess={() => setTimeout(() => navigate('/my-gigs'), 1200)}
            onCancel={() => navigate('/my-gigs')}
          />
        </div>
      </section>
    </DashboardLayout>
  );
}
