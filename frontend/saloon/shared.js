const API_BASE_URL = 'http://localhost:8080';
const API = `${API_BASE_URL}/api/saloons`;

const FEATURES = ['STATIC_WEBSITE','BOOKING','MEMBERSHIP','WEBSHOP','ANALYTICS','LOYALTY_PROGRAM'];
const FEATURE_LABEL = { STATIC_WEBSITE:'Website', BOOKING:'Booking', MEMBERSHIP:'Membership', WEBSHOP:'Web Shop', ANALYTICS:'Analytics', LOYALTY_PROGRAM:'Loyalty' };

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
const DAY_SHORT = { MONDAY:'Mon', TUESDAY:'Tue', WEDNESDAY:'Wed', THURSDAY:'Thu', FRIDAY:'Fri', SATURDAY:'Sat', SUNDAY:'Sun' };
const defaultHours = () => DAYS.map(day => ({ day, openTime:'09:00', closeTime:'18:00', closed: day === 'SUNDAY' }));

const STAFF_ROLES = ['MANAGER','STYLIST','COLORIST','MAKEUP_ARTIST','NAIL_TECHNICIAN','RECEPTIONIST','ASSISTANT'];
const STAFF_ROLE_LABEL = { MANAGER:'Manager', STYLIST:'Stylist', COLORIST:'Colorist', MAKEUP_ARTIST:'Makeup Artist', NAIL_TECHNICIAN:'Nail Tech', RECEPTIONIST:'Receptionist', ASSISTANT:'Assistant' };
const STAFF_STATUSES = ['ACTIVE','INACTIVE','ON_LEAVE'];
const STAFF_STATUS_LABEL = { ACTIVE:'Active', INACTIVE:'Inactive', ON_LEAVE:'On Leave' };

const SERVICE_CATEGORIES = ['HAIR','MAKEUP','NAILS','SKIN_CARE','BEARD','MASSAGE','WAXING','OTHER'];
const CATEGORY_LABEL = { HAIR:'Hair', MAKEUP:'Makeup', NAILS:'Nails', SKIN_CARE:'Skin Care', BEARD:'Beard', MASSAGE:'Massage', WAXING:'Waxing', OTHER:'Other' };
const SPECIALIZATION_OPTIONS = SERVICE_CATEGORIES;

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) { const t = await res.text().catch(() => res.statusText); throw new Error(t || `HTTP ${res.status}`); }
  if (res.status === 204) return null;
  return res.json();
}

const formatDate = ts => ts ? new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
const formatPrice = (price, currency = 'USD') => new Intl.NumberFormat('en-US', { style:'currency', currency }).format(price);
function toggle(list, val) { const i = list.indexOf(val); i === -1 ? list.push(val) : list.splice(i, 1); }
function cloneHours(src) { return src ? src.map(h => ({ ...h })) : defaultHours(); }
function openDays(saloon) {
  if (!saloon?.operatingHours?.length) return null;
  return saloon.operatingHours.filter(h => !h.closed).map(h => DAY_SHORT[h.day] || h.day).join(', ');
}
