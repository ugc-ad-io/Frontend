import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { ownsCampaign } from '../utils/brandWorkspace';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { uploadMedia } from '../utils/upload';
import { ArrowLeft, Package, Truck, AlertTriangle, ClipboardList, X } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { isSelectedCreator } from '../utils/campaignCreators';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import '../styles/brand-ui.css';
import '../styles/brand-ui-states.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const PAGE_CSS = `
        .shipment-page {
          --shp-ink: #07074e;
          --shp-muted: #6e6e96;
          --shp-line: #e2e2f0;
          --shp-soft: #edeef6;
          --shp-card-shadow: 0 1px 2px rgba(7, 7, 78, .05), 0 10px 26px -18px rgba(7, 7, 78, .28);
          color: var(--shp-ink);
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
          min-height: 100dvh;
          background: #f3f3ff;
          padding: 32px clamp(16px, 3vw, 32px) max(48px, env(safe-area-inset-bottom));
          box-sizing: border-box;
          overflow-x: hidden;
        }
        /* inside the brand / creator shell the shell already supplies the page background */
        .shipment-page.in-shell .page-header,
        .shipment-page.in-shell .shipment-container { max-width: 1360px; }
        .shipment-page.in-shell {
          min-height: 0;
          background: transparent;
          padding: 4px 0 24px;
        }

        .loading-page,
        .error-page {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          color: #6e6e96;
        }
        .shp-nf { flex-direction: column; gap: 14px; padding: 16px; text-align: center; font-size: 17px; font-family: 'Inter', system-ui, sans-serif; color: #07074e; }
        .shp-nf-btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .shp-btn { height: 48px; padding: 0 24px; border-radius: 999px; border: 1px solid transparent; background: #07074e; color: #fff; font: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; }
        .shp-btn:hover { background: #12124f; }
        .shp-btn--ghost { background: #fff; color: #07074e; border-color: #c9cbea; }
        .shp-btn--ghost:hover { background: #f3f3ff; }

        .page-header {
          max-width: 1000px;
          margin: 0 auto 14px;
        }

        .shipment-page .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px 0 6px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #4e60e6;
          font: inherit;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: none;
        }
        .shipment-page .back-btn:hover { background: #eef0ff; color: #4e60e6; transform: none; }

        .shipment-container {
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .shipment-container .cui-head { margin: 0; }

        .st-header {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .st-icon {
          flex-shrink: 0;
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #eef0ff;
          color: #4e60e6;
        }
        .shipment-page:not(.is-embed) .st-icon { display: none; }

        .st-head-text h1 {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(28px, 3vw, 36px);
          font-weight: 500;
          letter-spacing: -.03em;
          color: var(--shp-ink);
          margin: 0;
          line-height: 1.15;
        }

        .st-head-text p {
          color: #5a5a8c;
          font-size: 16px;
          margin: 6px 0 0;
        }

        .shp-skel { margin-top: 20px; padding: 24px; border-radius: 20px; background: #fff; box-shadow: var(--shp-card-shadow); }

        .shipment-page .no-shipment { margin: 24px auto; }
        .shipment-page .no-shipment .cmk-emptystate-ic { color: #4e60e6; }

        .shipment-details {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .status-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 22px;
          background: #fff;
          border-radius: 20px;
          box-shadow: var(--shp-card-shadow);
          color: var(--shp-ink);
        }

        .status-icon {
          flex: none;
          width: 46px;
          height: 46px;
          background: #eef0ff;
          color: #4e60e6;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-icon svg { width: 22px; height: 22px; }

        .status-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: var(--shp-muted);
          margin: 0 0 2px;
        }

        .status-value {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -.01em;
          line-height: 1.15;
          margin: 0;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          align-items: start;
        }

        .detail-card {
          padding: 20px 22px;
          background: #fff;
          border-radius: 20px;
          box-shadow: var(--shp-card-shadow);
        }

        .detail-card h3 {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: 17px;
          font-weight: 500;
          color: var(--shp-ink);
          margin: 0 0 12px;
        }

        .detail-card--row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .detail-card--row h3 {
          margin: 0;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          font-size: 14px;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--shp-soft);
        }

        .detail-item:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .detail-item .label {
          color: var(--shp-muted);
        }

        .detail-item .value {
          color: var(--shp-ink);
          font-weight: 600;
        }

        .shipment-page .link {
          color: #4e60e6;
          font-weight: 600;
          text-decoration: none;
        }

        .shipment-page .link:hover {
          text-decoration: underline;
        }

        .checklist {
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 14.5px;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--shp-ink);
          cursor: pointer;
        }

        .checklist-item input[type="checkbox"],
        .checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #07074e;
        }

        .video-link {
          display: inline-flex;
          align-items: center;
          height: 44px;
          padding: 0 22px;
          background: #07074e;
          color: #fff;
          border-radius: 999px;
          border: none;
          font: inherit;
          font-size: 14.5px;
          cursor: pointer;
          font-weight: 700;
        }

        .video-link:hover {
          background: #12124f;
        }

        .dispute-alert {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 18px 22px;
          background: #fde8e8;
          border-radius: 20px;
          color: #b42318;
        }
        .dispute-alert svg { flex: none; margin-top: 1px; }

        .dispute-alert strong {
          display: block;
          margin-bottom: 4px;
          font-size: 15px;
        }
        .dispute-alert p { margin: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }

        .next-steps {
          padding: 20px 22px;
          background: #fff;
          border-radius: 20px;
          box-shadow: var(--shp-card-shadow);
          color: var(--shp-ink);
        }

        .next-steps-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          color: #4e60e6;
        }

        .next-steps-header h3 {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: 17px;
          font-weight: 500;
          color: var(--shp-ink);
          margin: 0;
        }

        .next-steps-list {
          margin: 0;
          padding-left: 22px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .next-steps-list li::marker { color: #6e6e96; font-weight: 600; }

        .next-steps-list li {
          font-size: 14.5px;
          line-height: 1.55;
          color: #5a5a8c;
        }

        .file-name {
          display: block;
          margin-top: 8px;
          font-size: 13px;
          color: var(--shp-muted);
          word-break: break-all;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }
        .action-buttons:empty { display: none; }

        .action-buttons button {
          flex: 1;
        }

        /* Buttons: the global .btn-primary / .btn-secondary are old-style; same pill look as the redesigned dialogs. */
        .shipment-page .btn-primary,
        .shp-ov .btn-primary,
        .shp-ov .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 24px;
          border-radius: 999px;
          font: inherit;
          font-size: 14.5px;
          font-weight: 700;
          cursor: pointer;
          transform: none;
          transition: background .15s;
          box-sizing: border-box;
        }
        .shipment-page .btn-primary,
        .shp-ov .btn-primary { background: #07074e; color: #fff; border: 1px solid transparent; box-shadow: none; }
        .shipment-page .btn-primary:hover:not(:disabled),
        .shp-ov .btn-primary:hover:not(:disabled) { background: #12124f; transform: none; box-shadow: none; }
        .shipment-page .btn-primary:disabled,
        .shp-ov .btn-primary:disabled,
        .shp-ov .btn-secondary:disabled { opacity: .55; cursor: not-allowed; }
        .shp-ov .btn-secondary { background: #fff; color: #07074e; border: 1px solid #c9cbea; }
        .shp-ov .btn-secondary:hover:not(:disabled) { background: #f3f3ff; color: #07074e; transform: none; }

        /* Dialogs: same shell as the review / revision dialogs. */
        .shp-ov.modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(7, 7, 78, .45);
          -webkit-backdrop-filter: blur(3px);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        /* Portaled to <body>: above everything. */
        .shp-ov.ship-portal-overlay {
          z-index: 2147483000;
          animation: shipFade .18s ease;
        }
        .shp-ov.ship-portal-overlay .modal-content {
          animation: shipPop .22s cubic-bezier(.2, .7, .2, 1);
        }
        @keyframes shipFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shipPop { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }

        .shp-ov .modal-content {
          position: relative;
          background: #fff;
          padding: 26px 24px 22px;
          border-radius: 20px;
          box-shadow: 0 40px 80px -30px rgba(7, 7, 78, .6);
          max-width: 560px;
          width: 100%;
          max-height: calc(100dvh - 48px);
          overflow-y: auto;
          overscroll-behavior: contain;
          box-sizing: border-box;
          overflow-wrap: anywhere;
          color: #07074e;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .shp-ov .modal-content h2 {
          font-family: 'Readex Pro', 'Plus Jakarta Sans', sans-serif;
          font-size: 20px;
          font-weight: 500;
          color: #07074e;
          margin: 0 0 6px;
        }

        .shp-ov .video-modal-content {
          max-width: 720px;
          padding: 20px;
        }
        .shp-ov .video-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .shp-ov .video-modal-head h2 { margin: 0; }
        .shp-ov .video-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          border: none;
          background: #f6f6fd;
          color: #07074e;
          cursor: pointer;
          flex-shrink: 0;
          display: grid;
          place-items: center;
        }
        .shp-ov .video-modal-close:hover { background: #eef0ff; }
        .shp-ov .video-modal-el {
          width: 100%;
          max-height: 70vh;
          max-height: 70dvh;
          border-radius: 16px;
          background: #07074e;
          display: block;
        }

        .shipment-form,
        .receive-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .shp-ov .form-group { display: flex; flex-direction: column; gap: 6px; margin: 0; }
        .shp-ov .form-group label { margin: 0; font-size: 13px; font-weight: 700; color: #07074e; }
        .shp-ov .input-field,
        .shp-ov .textarea-field {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 14px;
          font: inherit;
          font-size: 14px;
          color: #07074e;
          background: #f6f6fd;
          border: 1.5px solid transparent;
          border-radius: 16px;
          outline: none;
          transition: none;
        }
        .shp-ov .textarea-field { min-height: 96px; }
        .shp-ov .input-field:focus,
        .shp-ov .textarea-field:focus { background: #fff; border-color: #7387ff; box-shadow: 0 0 0 3px rgba(115, 135, 255, .2); }
        .shp-ov .input-field::placeholder,
        .shp-ov .textarea-field::placeholder { color: #9f9fd1; }

        .await-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 20px;
          background: #fff2dc;
          border-radius: 20px;
          color: #8a4b00;
        }
        .await-banner svg { flex: none; margin-top: 1px; }
        .await-banner strong { display: block; margin-bottom: 2px; font-size: 15px; }
        .await-banner p { margin: 0; font-size: 14px; line-height: 1.5; color: #8a4b00; }

        .ship-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        .ship-help {
          font-size: 13.5px;
          color: #6e6e96;
          line-height: 1.5;
          margin: 0 0 4px;
        }
        .shp-ov .modal-content > .ship-help + .shipment-form { margin-top: 12px; }
        .ship-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .ship-row--3 {
          grid-template-columns: 1fr 1fr 1fr;
        }
        .ship-dims {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .ship-divider {
          font-size: 13px;
          font-weight: 700;
          color: #07074e;
          padding-top: 12px;
          margin-top: 2px;
          border-top: 1px solid #edeef6;
        }
        @media (max-width: 600px) {
          .ship-row, .ship-row--3 { grid-template-columns: 1fr; }
        }
        .ship-row > *, .ship-dims > * { min-width: 0; }

        .shp-ov .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #07074e;
          cursor: pointer;
        }

        .shp-ov .modal-actions {
          display: flex;
          gap: 10px;
          margin-top: 8px;
        }

        .shp-ov .modal-actions button {
          flex: 1;
        }

        /* Embedded inside the dashboard drawer - no page background, no outer padding. */
        .shipment-page.is-embed {
          min-height: 0;
          background: transparent;
          padding: 0;
        }

        .shipment-page.is-embed .page-header {
          max-width: none;
          margin: 0 0 14px;
        }

        .shipment-page.is-embed .shipment-container {
          max-width: none;
        }
        .shipment-page.is-embed .st-head-text h1 { font-size: 24px; }
        .shipment-page.is-embed .st-head-text p { font-size: 14.5px; margin-top: 2px; }
        .shipment-page.is-embed .status-card,
        .shipment-page.is-embed .detail-card,
        .shipment-page.is-embed .next-steps {
          box-shadow: inset 0 0 0 1px var(--shp-line);
        }

        @media (max-width: 768px) {
          .shp-ov .input-field, .shp-ov .textarea-field { font-size: 16px; min-height: 44px; }
          .shp-ov .textarea-field { min-height: 96px; }
          .shipment-page .back-btn { min-height: 44px; }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .action-buttons {
            flex-direction: column;
          }
        }
        @media (max-width: 480px) {
          .shipment-page:not(.is-embed):not(.in-shell) { padding: 16px 16px max(24px, env(safe-area-inset-bottom)); }
          .st-head-text h1 { font-size: 26px; }
          .st-head-text { min-width: 0; overflow-wrap: anywhere; }
          .detail-card, .status-card, .next-steps { padding: 16px; }
          .detail-item { flex-wrap: wrap; gap: 4px 12px; }
          .detail-item .value { min-width: 0; overflow-wrap: anywhere; text-align: right; }
          .status-value { overflow-wrap: anywhere; font-size: 20px; }
          .detail-card--row { flex-wrap: wrap; }
          .shp-ov.modal-overlay { padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); }
          .shp-ov .modal-content { padding: 22px 16px 18px; max-height: calc(100dvh - 24px); }
          .shp-ov .modal-actions { flex-direction: column-reverse; }
        }
`;

// Resolve a 6-digit Indian PIN → { city, state } via India Post so the pickup
// City/State always match the Pincode (they're auto-filled, not free text).
const lookupPincode = async (pin) => {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const json = await res.json();
    const office = json?.[0]?.PostOffice?.[0];
    if (!office) return null;
    return { city: office.District || '', state: office.State || '' };
  } catch {
    return null;
  }
};

export default function ShipmentTracking({ embedCampaignId, creatorId, autoShip, onClose }) {
  const [searchParams] = useSearchParams();
  const campaignId = embedCampaignId || searchParams.get('campaign');
  const navigate = useNavigate();
  const { user } = useAuth();
  // A deep link opened in a fresh tab has no history: navigate(-1) would do nothing.
  const goBack = () => (onClose ? onClose() : window.history.length > 1 ? navigate(-1) : navigate(user?.role === 'business' ? '/dashboard/business' : '/my-active-work'));
  // Opened as its own page (not inside a drawer): sit inside the brand / creator shell so the
  // header + nav match the rest of the site. Embedded use (drawer) and admin staff stay bare.
  const shell = onClose ? null : user?.role === 'business' ? 'brand' : user?.role === 'creator' ? 'creator' : null;
  const wrap = (node) => (shell === 'brand' ? <BrandTopNavLayout>{node}</BrandTopNavLayout>
    : shell === 'creator' ? <CreatorTopNavLayout>{node}</CreatorTopNavLayout> : node);
  const [campaign, setCampaign] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shipmentLoaded, setShipmentLoaded] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [shipmentData, setShipmentData] = useState({
    tracking_number: '',
    expected_delivery: '',
    shipment_checklist: {
      sealed: false,
      correct_item: false,
      working: false
    }
  });
  const [receiveData, setReceiveData] = useState({
    unboxing_video: '',
    items_damaged: false,
    dispute_reason: ''
  });
  // Unboxing videos are frequently .mov — browsers can't render that inline and
  // just download the file on click (even with target="_blank"), so it's shown
  // in an in-app <video> modal instead of linking straight to the raw file.
  const [unboxingModalUrl, setUnboxingModalUrl] = useState(null);
  const [unboxingFile, setUnboxingFile] = useState(null);
  const [courierFile, setCourierFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  // "Ship Product" (Delhivery) flow — brand enters product details + their pickup
  // address; the platform generates a pre-paid label. The creator's delivery address
  // is pulled server-side and never shown to the brand.
  const [showShipModal, setShowShipModal] = useState(false);
  const [shipForm, setShipForm] = useState({
    description: '', weight: '', length: '', width: '', height: '',
    full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
  });

  // Uploaded files come back as a relative "/uploads/..." path; absolute URLs
  // (legacy/cloud) are used as-is.
  const resolveMediaUrl = (u) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${BACKEND_URL}${u.startsWith('/') ? '' : '/'}${u}`;
  };

  // Upload a real file to the backend and return its stored URL.
  // uploadMedia sends a big phone video straight to S3 (the server front refuses >= 50 MB,
  // which showed up here as a bare "Network Error") and enforces the 400 MB cap itself.
  const uploadFile = async (file) => (await uploadMedia(file, API)).file_url;

  useLiveEffect(() => {
    if (campaignId) {
      fetchCampaign();
      fetchShipment();
    } else {
      // Opened without ?campaign=: show "not found" instead of a skeleton forever.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, creatorId]);

  // When opened via the "Ship" action, jump straight to the Ship Product form
  // (skip the tracking page) — but only if nothing has actually shipped yet.
  const autoShipDone = useRef(false);
  useEffect(() => {
    // Wait until BOTH campaign and the shipment lookup have resolved — otherwise
    // the form would flash open for an already-shipped deal (shipment still null).
    if (!autoShip || autoShipDone.current || loading || !shipmentLoaded || !campaign || !user) return;
    const isBrand = user.role === 'business' && ownsCampaign(user, campaign);
    const status = String(shipment?.status || '').toLowerCase();
    const alreadyShipped = !!shipment && (
      !!shipment.requested || !!shipment.tracking_number || !!shipment.label_url ||
      ['requested', 'awaiting_pickup', 'label_generated', 'shipped', 'in_transit', 'delivered', 'received'].includes(status)
    );
    if (isBrand && !alreadyShipped) {
      autoShipDone.current = true;
      setShowShipModal(true);
    }
  }, [autoShip, loading, shipmentLoaded, campaign, shipment, user]);

  const fetchCampaign = async () => {
    try {
      const response = await axios.get(`${API}/campaigns/${campaignId}`);
      setCampaign(response.data);
    } catch (error) {
      toast.error(error?.response ? apiErrorMessage(error, 'Failed to load campaign') : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchShipment = async () => {
    try {
      const qs = creatorId ? `?creator_id=${encodeURIComponent(creatorId)}` : '';
      const response = await axios.get(`${API}/shipment/${campaignId}${qs}`);
      setShipment(response.data);
    } catch (error) {
      // Shipment might not exist yet: the page then shows its "no shipment" state.
    } finally {
      setShipmentLoaded(true);
    }
  };

  const handleUpdateShipment = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      // Upload the courier slip if the business attached one (it's optional).
      let courierSlip = '';
      if (courierFile) {
        courierSlip = await uploadFile(courierFile);
      }
      await axios.post(`${API}/shipment/update`, {
        campaign_id: campaignId,
        creator_id: creatorId || undefined,
        tracking_number: shipmentData.tracking_number,
        courier_slip: courierSlip,
        expected_delivery: shipmentData.expected_delivery,
        shipment_checklist: shipmentData.shipment_checklist
      });
      toast.success('Shipment details updated!');
      setShowUpdateModal(false);
      setCourierFile(null);
      fetchShipment();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to update shipment'));
    } finally {
      setUploading(false);
    }
  };

  const handleReceiveShipment = async (e) => {
    e.preventDefault();
    if (!unboxingFile) {
      toast.error('Please attach your unboxing video.');
      return;
    }
    setUploading(true);
    try {
      // Upload the real unboxing video and store its URL.
      const unboxingVideo = await uploadFile(unboxingFile);
      await axios.post(`${API}/shipment/receive`, {
        campaign_id: campaignId,
        unboxing_video: unboxingVideo,
        items_damaged: receiveData.items_damaged,
        dispute_reason: receiveData.items_damaged ? receiveData.dispute_reason : undefined
      });
      toast.success('Shipment marked as received!');
      setShowReceiveModal(false);
      setUnboxingFile(null);
      fetchShipment();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to mark as received'));
    } finally {
      setUploading(false);
    }
  };

  const setShip = (field, value) => setShipForm((f) => ({ ...f, [field]: value }));

  // Auto-fill City + State from the Pincode so they can never mismatch.
  useEffect(() => {
    const pin = String(shipForm.pincode || '').replace(/\D/g, '');
    if (pin.length !== 6) return;
    let cancelled = false;
    lookupPincode(pin).then((info) => {
      if (cancelled || !info) return;
      setShipForm((f) => ({ ...f, city: info.city || f.city, state: info.state || f.state }));
    });
    return () => { cancelled = true; };
  }, [shipForm.pincode]);

  // Pre-fill the pickup address from the brand's account (Settings → Company) so it is
  // never retyped. Editable — the pickup can be elsewhere than the billing address.
  const [pickupFromAccount, setPickupFromAccount] = useState(false);
  useLiveEffect(() => {
    if (!showShipModal) return undefined;
    let alive = true;
    axios.get(`${API}/shipping/account-address`).then(({ data }) => {
      const a = data?.address;
      if (!alive || !a) return;
      setShipForm((f) => (f.line1 || f.pincode ? f : {
        ...f, full_name: a.full_name || '', phone: a.phone || '', line1: a.line1 || '', line2: a.line2 || '',
        city: a.city || '', state: a.state || '', pincode: a.pincode || '',
      }));
      setPickupFromAccount(true);
    }).catch(() => { /* no saved address — the brand types it */ });
    return () => { alive = false; };
  }, [showShipModal]);

  const handleShipProduct = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      // A creator-suffixed deal id ("<campaign>~<creatorId>") tells the backend
      // WHICH hired creator this request is for on a multi-creator brief — the
      // bare campaign id would silently default to whichever creator was hired first.
      const dealId = creatorId ? `${campaignId}~${creatorId}` : campaignId;
      await axios.post(`${API}/deals/${dealId}/request-shipment`, {
        description: shipForm.description,
        weight: Number(shipForm.weight),
        dimensions: {
          length: shipForm.length ? Number(shipForm.length) : null,
          width: shipForm.width ? Number(shipForm.width) : null,
          height: shipForm.height ? Number(shipForm.height) : null,
        },
        pickup_address: {
          full_name: shipForm.full_name,
          phone: shipForm.phone,
          line1: shipForm.line1,
          line2: shipForm.line2,
          city: shipForm.city,
          state: shipForm.state,
          pincode: shipForm.pincode,
          country: 'India',
        },
      });
      toast.success('Shipment requested - our team will prepare your label shortly.');
      setShowShipModal(false);
      fetchShipment();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to generate shipping label'));
    } finally {
      setUploading(false);
    }
  };

  const handleChecklistChange = (field) => {
    setShipmentData({
      ...shipmentData,
      shipment_checklist: {
        ...shipmentData.shipment_checklist,
        [field]: !shipmentData.shipment_checklist[field]
      }
    });
  };

  if (loading) return wrap(
    <div className={`shipment-page ${onClose ? 'is-embed' : ''} ${shell ? 'in-shell' : ''}`} aria-hidden="true">
      <style>{PAGE_CSS}</style>
      <div className="page-header">
        <Skeleton width={90} height={36} radius={10} />
      </div>
      <div className="shipment-container">
        {/* st-header: icon + title + campaign line */}
        <div className="st-header">
          <Skeleton width={44} height={44} radius={12} />
          <div className="st-head-text" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width={200} height={22} />
            <Skeleton width={150} height={13} />
          </div>
        </div>
        {/* a status/details card block */}
        <div className="shp-skel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <Skeleton width={48} height={48} radius="50%" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <Skeleton width="40%" height={16} />
              <Skeleton width="60%" height={12} />
            </div>
          </div>
          <Skeleton width="100%" height={12} style={{ marginBottom: 10 }} />
          <Skeleton width="85%" height={12} style={{ marginBottom: 10 }} />
          <Skeleton width="70%" height={12} />
        </div>
      </div>
    </div>
  );
  if (!campaign) return wrap(
    <div className="error-page shp-nf">
      <style>{PAGE_CSS}</style>
      <span>Campaign not found</span>
      <div className="shp-nf-btns">
        <button type="button" className="shp-btn shp-btn--ghost" onClick={goBack}>Back</button>
        {campaignId && (
          <button type="button" className="shp-btn" onClick={() => { setLoading(true); fetchCampaign(); fetchShipment(); }}>Retry</button>
        )}
      </div>
    </div>
  );

  const isBusiness = user?.role === 'business' && ownsCampaign(user, campaign);
  const isCreator = user?.role === 'creator' && isSelectedCreator(campaign, user.id);

  // What-to-do-next guidance based on who is viewing and the shipment status.
  const getNextSteps = () => {
    const status = shipment?.status;
    if (isCreator) {
      if (status === 'received') {
        return {
          title: 'What to do next',
          steps: [
            'Create the content exactly as described in the brief.',
            'Submit your work for review from "My Active Work".',
            'Wait for the brand to approve it - your payment is released on approval.',
          ],
        };
      }
      return {
        title: 'What to do next',
        steps: [
          'Watch for the package to arrive at your address.',
          'Record an unboxing video as you open it (you may need it if anything is wrong).',
          'Click "Mark as Received" once it arrives - report any damage or wrong item there.',
          'Then create your content and submit it from "My Active Work".',
        ],
      };
    }
    if (isBusiness) {
      if (status === 'received') {
        return {
          title: 'What to do next',
          steps: [
            'The creator has received the product.',
            'Wait for them to submit the content, then review it.',
            'Approve the work to release payment, or request changes.',
          ],
        };
      }
      if (status === 'requested') {
        return {
          title: 'What to do next',
          steps: [
            'Your shipment request has been submitted.',
            'Our team is preparing your pre-paid shipping label.',
            'Tracking will appear here once the package is dispatched.',
          ],
        };
      }
      return {
        title: 'What to do next',
        steps: [
          'The product is on its way to the creator.',
          'Wait for the creator to confirm receipt.',
          'Tracking updates will appear here as the courier scans the package.',
        ],
      };
    }
    return null;
  };

  const nextSteps = getNextSteps();

  // A shipment only counts as "real" once a label/tracking exists or it's actually
  // moving. A stale/empty record (e.g. an old "completed" doc with no tracking) still
  // needs shipping, so the brand should see the "Ship Product" action, not the details.
  const shipStatus = String(shipment?.status || '').toLowerCase();
  const hasRealShipment = !!shipment && (
    !!shipment.requested ||
    !!shipment.tracking_number ||
    !!shipment.label_url ||
    ['requested', 'awaiting_pickup', 'label_generated', 'shipped', 'in_transit', 'delivered', 'received'].includes(shipStatus)
  );
  // The brand is still waiting on the platform to generate the label.
  const awaitingLabel = shipStatus === 'requested' && !shipment?.label_url && !shipment?.tracking_number;

  const embedded = !!onClose;

  return wrap(
    <div className={`shipment-page ${embedded ? 'is-embed' : ''} ${shell ? 'in-shell' : ''}`}>
      <div className="page-header">
        <button className="back-btn" onClick={goBack} data-testid="back-btn">
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <div className="shipment-container fade-in">
        {shell === 'creator' ? (
          <CreatorPageHead title="Shipment Tracking" subtitle={`Campaign: ${campaign.title}`} hideSearch />
        ) : (
        <div className="st-header">
          <span className="st-icon"><Package size={22} /></span>
          <div className="st-head-text">
            <h1>Shipment Tracking</h1>
            <p>Campaign: {campaign.title}</p>
          </div>
        </div>
        )}

        {/* The BRAND enters their pickup address inside the "Ship Product" form below
            (request-shipment). The CREATOR confirms their delivery address in their own
            deal room — never here. So no address card on this page. */}

        {!hasRealShipment ? (
          <div className="no-shipment cmk-emptystate bui-es">
            <span className="cmk-emptystate-ic"><Package size={30} /></span>
            <p>{isBusiness ? 'Ready to ship - submit your product & pickup details and our team will prepare the shipping label.' : 'No shipment details available yet'}</p>
            {isBusiness && (
              <button
                className="btn-primary ship-cta cmk-emptystate-btn"
                onClick={() => setShowShipModal(true)}
                data-testid="ship-product-btn"
              >
                <Package size={18} /> Ship Product
              </button>
            )}
          </div>
        ) : (
          <div className="shipment-details">
            <div className="status-card">
              <div className="status-icon">
                <Truck size={32} />
              </div>
              <div>
                <p className="status-label">Status</p>
                <p className="status-value">{awaitingLabel ? 'AWAITING LABEL' : String(shipment.status || '').replace(/_/g, ' ').toUpperCase()}</p>
              </div>
            </div>

            {awaitingLabel && (
              <div className="await-banner">
                <ClipboardList size={20} />
                <div>
                  <strong>Shipment requested</strong>
                  <p>Our team is preparing your pre-paid label. Tracking will appear here once the package is dispatched.</p>
                </div>
              </div>
            )}

            <div className="details-grid">
              <div className="detail-card">
                <h3>Tracking Information</h3>
                <div className="detail-item">
                  <span className="label">Tracking Number:</span>
                  <span className="value">{shipment.tracking_number || '-'}</span>
                </div>
                {shipment.courier_name && (
                  <div className="detail-item">
                    <span className="label">Courier:</span>
                    <span className="value">{shipment.courier_name}</span>
                  </div>
                )}
                {shipment.expected_delivery && (
                  <div className="detail-item">
                    <span className="label">Expected Delivery:</span>
                    <span className="value">{new Date(shipment.expected_delivery).toLocaleDateString()}</span>
                  </div>
                )}
                {shipment.label_url && isBusiness && (
                  <div className="detail-item">
                    <span className="label">Shipping Label:</span>
                    <a href={resolveMediaUrl(shipment.label_url)} target="_blank" rel="noopener noreferrer" className="link">
                      Download &amp; print
                    </a>
                  </div>
                )}
                {shipment.courier_slip && (
                  <div className="detail-item">
                    <span className="label">Courier Slip:</span>
                    <a href={resolveMediaUrl(shipment.courier_slip)} target="_blank" rel="noopener noreferrer" className="link">
                      View Document
                    </a>
                  </div>
                )}
              </div>

              <div className="detail-card">
                <h3>Shipment Checklist</h3>
                <div className="checklist">
                  <div className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipment.shipment_checklist?.sealed}
                      disabled
                      readOnly
                    />
                    <span>Package Sealed</span>
                  </div>
                  <div className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipment.shipment_checklist?.correct_item}
                      disabled
                      readOnly
                    />
                    <span>Correct Item</span>
                  </div>
                  <div className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipment.shipment_checklist?.working}
                      disabled
                      readOnly
                    />
                    <span>Working Condition</span>
                  </div>
                </div>
              </div>
            </div>

            {shipment.unboxing_video && (
              <div className="detail-card detail-card--row">
                <h3>Unboxing Video</h3>
                <button
                  type="button"
                  className="video-link"
                  onClick={() => setUnboxingModalUrl(resolveMediaUrl(shipment.unboxing_video))}
                >
                  View Unboxing Video
                </button>
              </div>
            )}

            {shipment.dispute && (
              <div className="dispute-alert">
                <AlertTriangle size={24} />
                <div>
                  <strong>Dispute Reported</strong>
                  <p>{shipment.dispute.reason}</p>
                </div>
              </div>
            )}

            {nextSteps && (
              <div className="next-steps" data-testid="next-steps">
                <div className="next-steps-header">
                  <ClipboardList size={22} />
                  <h3>{nextSteps.title}</h3>
                </div>
                <ol className="next-steps-list">
                  {nextSteps.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="action-buttons">
              {isCreator && ['shipped', 'in_transit', 'delivered'].includes(String(shipment.status || '').toLowerCase()) && (
                <button
                  className="btn-primary"
                  onClick={() => setShowReceiveModal(true)}
                  data-testid="mark-received-btn"
                >
                  Mark as Received
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ship Product Modal — product details + pickup address → pre-paid label.
          Portaled to <body> so it's a true full-screen modal (not trapped inside
          the animating PageModal) — fixes off-center jump + background card peek. */}
      {showShipModal && createPortal(
        <div className="modal-overlay shp-ov ship-portal-overlay" onClick={() => !uploading && setShowShipModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Ship Product</h2>
            <p className="ship-help">Enter the product details and your pickup address. Our team will prepare a pre-paid label and dispatch it to the creator. The creator's delivery address is handled securely - you don't need it.</p>
            <form onSubmit={handleShipProduct} className="shipment-form">
              <div className="form-group">
                <label htmlFor="s-desc">Product description</label>
                <input id="s-desc" type="text" className="input-field" required
                  placeholder="e.g. Skincare gift box"
                  value={shipForm.description} onChange={(e) => setShip('description', e.target.value)} />
              </div>

              <div className="ship-row">
                <div className="form-group">
                  <label htmlFor="s-weight">Weight (kg)</label>
                  <input id="s-weight" type="number" step="0.01" min="0" className="input-field" required
                    placeholder="0.5" value={shipForm.weight} onChange={(e) => setShip('weight', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Dimensions L×W×H (cm)</label>
                  <div className="ship-dims">
                    <input type="number" min="0" className="input-field" placeholder="L" value={shipForm.length} onChange={(e) => setShip('length', e.target.value)} />
                    <input type="number" min="0" className="input-field" placeholder="W" value={shipForm.width} onChange={(e) => setShip('width', e.target.value)} />
                    <input type="number" min="0" className="input-field" placeholder="H" value={shipForm.height} onChange={(e) => setShip('height', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="ship-divider">Pickup address</div>
              {pickupFromAccount && (
                <p className="ship-help">Filled in from your account (Settings → Company). Change anything if the pickup is from a different place.</p>
              )}

              <div className="ship-row">
                <div className="form-group">
                  <label htmlFor="s-name">Full name</label>
                  <input id="s-name" type="text" className="input-field" required
                    value={shipForm.full_name} onChange={(e) => setShip('full_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="s-phone">Phone</label>
                  <input id="s-phone" type="tel" inputMode="numeric" maxLength={15} className="input-field" required
                    value={shipForm.phone} onChange={(e) => setShip('phone', e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="s-line1">Address line 1</label>
                <input id="s-line1" type="text" className="input-field" required
                  value={shipForm.line1} onChange={(e) => setShip('line1', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="s-line2">Address line 2 (optional)</label>
                <input id="s-line2" type="text" className="input-field"
                  value={shipForm.line2} onChange={(e) => setShip('line2', e.target.value)} />
              </div>

              <div className="ship-row ship-row--3">
                <div className="form-group">
                  <label htmlFor="s-pin">Pincode</label>
                  <input id="s-pin" type="text" inputMode="numeric" maxLength={6} className="input-field" required
                    value={shipForm.pincode} onChange={(e) => setShip('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
                </div>
                <div className="form-group">
                  <label htmlFor="s-state">State</label>
                  <input id="s-state" type="text" className="input-field" required
                    value={shipForm.state} onChange={(e) => setShip('state', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="s-city">City</label>
                  <input id="s-city" type="text" className="input-field" required
                    value={shipForm.city} onChange={(e) => setShip('city', e.target.value)} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowShipModal(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-ship-btn" disabled={uploading}>
                  {uploading ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Update Shipment Modal */}
      {showUpdateModal && (
        <div className="modal-overlay shp-ov" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Update Shipment Details</h2>
            <form onSubmit={handleUpdateShipment} className="shipment-form">
              <div className="form-group">
                <label htmlFor="tracking">Tracking Number</label>
                <input
                  id="tracking"
                  type="text"
                  value={shipmentData.tracking_number}
                  onChange={(e) => setShipmentData({ ...shipmentData, tracking_number: e.target.value })}
                  className="input-field"
                  placeholder="ABC123456789"
                  required
                  data-testid="tracking-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="delivery">Expected Delivery Date</label>
                <input
                  id="delivery"
                  type="date"
                  value={shipmentData.expected_delivery}
                  onChange={(e) => setShipmentData({ ...shipmentData, expected_delivery: e.target.value })}
                  className="input-field"
                  required
                  data-testid="delivery-input"
                />
              </div>

              <div className="form-group">
                <label>Shipment Checklist</label>
                <div className="checklist">
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipmentData.shipment_checklist.sealed}
                      onChange={() => handleChecklistChange('sealed')}
                      data-testid="sealed-checkbox"
                    />
                    <span>Package is sealed properly</span>
                  </label>
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipmentData.shipment_checklist.correct_item}
                      onChange={() => handleChecklistChange('correct_item')}
                      data-testid="correct-item-checkbox"
                    />
                    <span>Correct item included</span>
                  </label>
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={shipmentData.shipment_checklist.working}
                      onChange={() => handleChecklistChange('working')}
                      data-testid="working-checkbox"
                    />
                    <span>Item is in working condition</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="courier-file">Courier Slip (PDF or image - optional)</label>
                <input
                  id="courier-file"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setCourierFile(e.target.files?.[0] || null)}
                  className="input-field"
                  data-testid="courier-file-input"
                />
                {courierFile && <span className="file-name">{courierFile.name}</span>}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUpdateModal(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-shipment-btn" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Update Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Shipment Modal */}
      {showReceiveModal && (
        <div className="modal-overlay shp-ov" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Mark Shipment as Received</h2>
            <form onSubmit={handleReceiveShipment} className="receive-form">
              <div className="form-group">
                <label htmlFor="unboxing-file">Unboxing Video (up to 400 MB)</label>
                <input
                  id="unboxing-file"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setUnboxingFile(e.target.files?.[0] || null)}
                  className="input-field"
                  required
                  data-testid="unboxing-file-input"
                />
                {unboxingFile && <span className="file-name">{unboxingFile.name}</span>}
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={receiveData.items_damaged}
                    onChange={(e) => setReceiveData({ ...receiveData, items_damaged: e.target.checked })}
                    data-testid="damaged-checkbox"
                  />
                  Report damaged or wrong items
                </label>
              </div>

              {receiveData.items_damaged && (
                <div className="form-group">
                  <label htmlFor="dispute">Describe the issue</label>
                  <textarea
                    id="dispute"
                    value={receiveData.dispute_reason}
                    onChange={(e) => setReceiveData({ ...receiveData, dispute_reason: e.target.value })}
                    className="textarea-field"
                    placeholder="Describe what's wrong with the shipment..."
                    required
                    data-testid="dispute-input"
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowReceiveModal(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-receive-btn" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unboxing Video Modal — portaled so it sits above everything, same as the
          Ship Product modal. Playing it in-app avoids the browser downloading .mov
          files it can't render inline. */}
      {unboxingModalUrl && createPortal(
        <div className="modal-overlay shp-ov ship-portal-overlay" onClick={() => setUnboxingModalUrl(null)}>
          <div className="modal-content video-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-head">
              <h2>Unboxing Video</h2>
              <button type="button" className="video-modal-close" aria-label="Close" onClick={() => setUnboxingModalUrl(null)}><X size={18} /></button>
            </div>
            <video src={unboxingModalUrl} controls autoPlay playsInline className="video-modal-el" />
          </div>
        </div>,
        document.body
      )}

      <style>{PAGE_CSS}</style>
    </div>
  );
}