import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  User,
  Lock,
  Shield,
  Camera,
  Save,
  LayoutDashboard,
  Zap,
  Bookmark,
  Star,
  Briefcase,
  FileCheck,
  MessageSquare,
  IndianRupee,
  Settings
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import './CreatorDashboard.css';
import './ProfileSettings.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

export default function ProfileSettings() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile states
  const [bio, setBio] = useState('');
  const [description, setDescription] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Password states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 2FA states
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    fetchUserData();
    check2FAStatus();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setBio(response.data.bio || '');
      setDescription(response.data.description || '');
      setProfilePhoto(response.data.profile_photo || null);
    } catch (error) {
      toast.error('Failed to load profile data');
    }
  };

  const check2FAStatus = async () => {
    try {
      const response = await axios.get(`${API}/profile/2fa/status`);
      setTwoFAEnabled(response.data.enabled);
    } catch (error) {
      console.error('Failed to check 2FA status');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large. Maximum 2MB allowed.');
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/profile/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProfilePhoto(response.data.photo_url);
      setUser({ ...user, profile_photo: response.data.photo_url });
      toast.success('Profile photo updated!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/profile/update-info?bio=${encodeURIComponent(bio)}&description=${encodeURIComponent(description)}`);
      setUser({ ...user, bio, description });
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/profile/change-password?old_password=${encodeURIComponent(oldPassword)}&new_password=${encodeURIComponent(newPassword)}`);
      toast.success('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/profile/2fa/setup`);
      setQrCode(response.data.qr_code);
      setSecret(response.data.secret);
      setShowQR(true);
      toast.success('Scan the QR code with Google Authenticator');
    } catch (error) {
      toast.error('Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/profile/2fa/verify?token=${verificationCode}`);
      toast.success('2FA enabled successfully!');
      setTwoFAEnabled(true);
      setShowQR(false);
      setVerificationCode('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/profile/2fa/disable?password=${encodeURIComponent(disablePassword)}`);
      toast.success('2FA disabled successfully');
      setTwoFAEnabled(false);
      setDisablePassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.nickname || user?.full_name || user?.email || 'Settings';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
    { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
    { name: 'Browse Briefs', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages') },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: Settings, action: () => navigate('/settings'), active: true }
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      title="Profile Settings"
      description="Manage your account information and security"
      topbarExtra={null}
      sidebarExtra={null}
    >
      <div className="ps-content">
          <div className="ps-container">
            <div className="ps-tab-sidebar">
              <button
                className={`ps-tab-btn ${activeTab === 'profile' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <User size={20} /> Profile
              </button>
              <button
                className={`ps-tab-btn ${activeTab === 'password' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('password')}
              >
                <Lock size={20} /> Password
              </button>
              <button
                className={`ps-tab-btn ${activeTab === '2fa' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('2fa')}
              >
                <Shield size={20} /> Two-Factor Auth
              </button>
            </div>

            <div className="ps-panel">
              {activeTab === 'profile' && (
                <>
                  <h2>Profile Information</h2>

                  <div className="ps-form-group">
                    <label>Profile Photo</label>
                    <div className="ps-photo-upload">
                      <div className="ps-photo-preview">
                        {profilePhoto ? (
                          <img src={`${BACKEND_URL}${profilePhoto}`} alt="Profile" />
                        ) : (
                          <div className="ps-photo-placeholder">
                            <Camera size={48} />
                          </div>
                        )}
                      </div>
                      <div className="ps-photo-actions">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          id="photo-upload"
                        />
                        <label htmlFor="photo-upload">
                          {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                        </label>
                        <p className="ps-hint">JPG, PNG or WebP. Max 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="ps-form-group">
                    <label>Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      maxLength={500}
                    />
                    <span className="ps-char-count">{bio.length}/500</span>
                  </div>

                  <div className="ps-form-group">
                    <label>Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a detailed description..."
                      rows={6}
                      maxLength={1000}
                    />
                    <span className="ps-char-count">{description.length}/1000</span>
                  </div>

                  <button
                    className="ps-btn-primary"
                    onClick={handleUpdateProfile}
                    disabled={loading}
                  >
                    <Save size={20} /> {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}

              {activeTab === 'password' && (
                <>
                  <h2>Change Password</h2>
                  <form onSubmit={handleChangePassword}>
                    <div className="ps-form-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                      />
                    </div>

                    <div className="ps-form-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 8 characters)"
                        required
                      />
                    </div>

                    <div className="ps-form-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                      />
                    </div>

                    <button type="submit" className="ps-btn-primary" disabled={loading}>
                      <Lock size={20} /> {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </form>
                </>
              )}

              {activeTab === '2fa' && (
                <>
                  <h2>Two-Factor Authentication</h2>
                  <p className="ps-panel-desc">
                    Add an extra layer of security to your account with 2FA using Google Authenticator.
                  </p>

                  {!twoFAEnabled ? (
                    <>
                      {!showQR ? (
                        <div className="ps-2fa-setup">
                          <div className="ps-info-box">
                            <Shield size={48} />
                            <h3>Enable Two-Factor Authentication</h3>
                            <p>Protect your account with an additional security layer</p>
                          </div>
                          <button
                            className="ps-btn-primary"
                            onClick={handleSetup2FA}
                            disabled={loading}
                          >
                            <Shield size={20} /> {loading ? 'Setting up...' : 'Setup 2FA'}
                          </button>
                        </div>
                      ) : (
                        <div className="ps-2fa-verification">
                          <h3>Scan QR Code</h3>
                          <p>Open Google Authenticator and scan this QR code:</p>
                          <div className="ps-qr-code">
                            <img src={qrCode} alt="QR Code" />
                          </div>
                          <div className="ps-secret-key">
                            <p><strong>Manual Entry Key:</strong></p>
                            <code>{secret}</code>
                          </div>
                          <div className="ps-form-group">
                            <label>Enter 6-digit code from Google Authenticator</label>
                            <input
                              type="text"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              maxLength={6}
                            />
                          </div>
                          <button
                            className="ps-btn-primary"
                            onClick={handleVerify2FA}
                            disabled={loading}
                          >
                            {loading ? 'Verifying...' : 'Verify & Enable'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ps-2fa-enabled">
                      <div className="ps-success-box">
                        <Shield size={48} />
                        <h3>2FA is Enabled</h3>
                        <p>Your account is protected with two-factor authentication</p>
                      </div>
                      <div className="ps-form-group">
                        <label>Enter your password to disable 2FA</label>
                        <input
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          placeholder="Enter your password"
                        />
                      </div>
                      <button
                        className="ps-btn-danger"
                        onClick={handleDisable2FA}
                        disabled={loading}
                      >
                        {loading ? 'Disabling...' : 'Disable 2FA'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
      </div>
    </DashboardLayout>
  );
}
