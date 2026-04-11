const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Generic fetch wrapper with Bearer-token auth                       */
/* ------------------------------------------------------------------ */

export async function adminFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (e: unknown) {
    throw e;
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/admin/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || `API error ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  File upload helper (multipart/form-data — no JSON content type)    */
/* ------------------------------------------------------------------ */

export async function adminUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/admin/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || `Upload error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AdminUser }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Invalid email or password");
  }

  const data = await res.json();

  // Backend returns { access_token, refresh_token, user: { id, email, full_name, preferred_language, role } }
  if (!["clinic_admin", "platform_admin"].includes(data.user?.role)) {
    throw new Error("This account does not have admin access");
  }

  return {
    token: data.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.full_name || data.user.email,
      role: data.user.role,
    },
  };
}

export function getMe() {
  return adminFetch<AdminUser>("/api/auth/me");
}

/* ------------------------------------------------------------------ */
/*  Clinic                                                             */
/* ------------------------------------------------------------------ */

export function getClinic() {
  return adminFetch<Clinic>("/api/admin/clinic");
}

export function updateClinic(data: Partial<Clinic>) {
  return adminFetch<Clinic>("/api/admin/clinic", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getClinicReviews() {
  return adminFetch<ClinicReviews>("/api/admin/clinic/reviews");
}

export function deactivateClinic() {
  return adminFetch<void>("/api/admin/clinic/deactivate", { method: "POST" });
}

/* ------------------------------------------------------------------ */
/*  Images                                                             */
/* ------------------------------------------------------------------ */

export function getImages() {
  return adminFetch<ClinicImage[]>("/api/admin/clinic/images");
}

export function uploadImage(formData: FormData) {
  return adminUpload<ClinicImage>("/api/admin/clinic/images", formData);
}

export function updateImage(id: string, data: Partial<ClinicImage>) {
  return adminFetch<ClinicImage>(`/api/admin/clinic/images/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteImage(id: string) {
  return adminFetch<void>(`/api/admin/clinic/images/${id}`, { method: "DELETE" });
}

export function reorderImages(ids: string[]) {
  return adminFetch<void>("/api/admin/clinic/images/reorder", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/* ------------------------------------------------------------------ */
/*  Team (informational doctor / staff members)                        */
/* ------------------------------------------------------------------ */

export function getTeam() {
  return adminFetch<TeamMember[]>("/api/admin/team");
}

export function createTeamMember(data: Partial<TeamMember>) {
  return adminFetch<TeamMember>("/api/admin/team", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTeamMember(id: string, data: Partial<TeamMember>) {
  return adminFetch<TeamMember>(`/api/admin/team/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTeamMember(id: string) {
  return adminFetch<void>(`/api/admin/team/${id}`, { method: "DELETE" });
}

export function uploadTeamPhoto(id: string, formData: FormData) {
  return adminUpload<TeamMember>(`/api/admin/team/${id}/photo`, formData);
}

/* ------------------------------------------------------------------ */
/*  Retreats                                                           */
/* ------------------------------------------------------------------ */

export function getRetreats() {
  return adminFetch<Retreat[]>("/api/admin/retreats");
}

export function createRetreat(data: Partial<Retreat>) {
  return adminFetch<Retreat>("/api/admin/retreats", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRetreat(id: string, data: Partial<Retreat>) {
  return adminFetch<Retreat>(`/api/admin/retreats/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteRetreat(id: string) {
  return adminFetch<void>(`/api/admin/retreats/${id}`, { method: "DELETE" });
}

export function setRetreatAvailability(id: string, data: { dates: RetreatAvailabilityDay[] }) {
  return adminFetch<RetreatAvailabilityDay[]>(`/api/admin/retreats/${id}/set-availability`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function blockRetreatDates(id: string, data: { date_from: string; date_to: string; reason?: string }) {
  return adminFetch<void>(`/api/admin/retreats/${id}/block-dates`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getRetreatCalendar(id: string, month: string) {
  const qs = new URLSearchParams({ month });
  return adminFetch<RetreatAvailabilityDay[]>(`/api/admin/retreats/${id}/calendar?${qs}`);
}

/* ------------------------------------------------------------------ */
/*  Bookings                                                           */
/* ------------------------------------------------------------------ */

export function getBookings(params?: { status?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return adminFetch<{ items: Booking[]; total: number }>(`/api/admin/bookings?${qs}`);
}

export function getBookingStats() {
  return adminFetch<BookingStats>("/api/admin/bookings/stats");
}

export function acceptBooking(id: string) {
  return adminFetch<Booking>(`/api/admin/bookings/${id}/confirm`, { method: "PATCH" });
}

export function declineBooking(id: string, reason: string) {
  return adminFetch<Booking>(`/api/admin/bookings/${id}/decline`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function completeBooking(id: string) {
  return adminFetch<Booking>(`/api/admin/bookings/${id}/complete`, { method: "PATCH" });
}

export function createAdminBooking(data: AdminBookingCreate) {
  return adminFetch<{
    id: string;
    status: string;
    retreat_name: string;
    guest_name: string;
    guest_count: number;
    start_date: string;
    end_date: string;
    nights: number;
    total_amount: number;
    commission_amount: number;
    currency: string;
    availability_warnings: Array<{ type: string; date: string; reason: string }>;
  }>("/api/admin/bookings", { method: "POST", body: JSON.stringify(data) });
}

/* ------------------------------------------------------------------ */
/*  Users (platform admin)                                             */
/* ------------------------------------------------------------------ */

export function getUsers(params?: { role?: string; search?: string; is_active?: boolean; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.role) qs.set("role", params.role);
  if (params?.search) qs.set("search", params.search);
  if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return adminFetch<{ items: ManagedUser[]; total: number }>(`/api/admin/users?${qs}`);
}

export function getUser(id: string) {
  return adminFetch<ManagedUser>(`/api/admin/users/${id}`);
}

export function createUser(data: { email: string; password: string; full_name?: string; phone?: string; role?: string; clinic_id?: string }) {
  return adminFetch<ManagedUser>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(id: string, data: { full_name?: string; phone?: string; email?: string; clinic_id?: string }) {
  return adminFetch<ManagedUser>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function changeUserRole(id: string, role: string, clinic_id?: string) {
  return adminFetch<ManagedUser>(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role, clinic_id }),
  });
}

export function toggleUserActive(id: string) {
  return adminFetch<ManagedUser>(`/api/admin/users/${id}/toggle`, {
    method: "PATCH",
  });
}

export function deleteUser(id: string) {
  return adminFetch<{ id: string; is_active: boolean; detail: string }>(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ */
/*  Platform admin                                                     */
/* ------------------------------------------------------------------ */

export function getPlatformClinics() {
  return adminFetch<PlatformClinic[]>("/api/admin/platform/clinics");
}

export function getPlatformStats() {
  return adminFetch<PlatformStats>("/api/admin/platform/stats");
}

export function getPlatformClinic(id: string) {
  return adminFetch<PlatformClinicDetail>(`/api/admin/platform/clinics/${id}`);
}

export function createPlatformClinic(data: ClinicCreateInput) {
  return adminFetch<PlatformClinicDetail>("/api/admin/platform/clinics", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePlatformClinic(id: string, data: Partial<ClinicCreateInput>) {
  return adminFetch<PlatformClinicDetail>(`/api/admin/platform/clinics/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function upgradeClinicTier(clinicId: string, tier: number) {
  return adminFetch<void>(`/api/admin/platform/clinics/${clinicId}/tier`, {
    method: "PATCH",
    body: JSON.stringify({ tier }),
  });
}

export function activatePlatformClinic(clinicId: string) {
  return adminFetch<void>(`/api/admin/platform/clinics/${clinicId}/activate`, {
    method: "PATCH",
  });
}

export function deactivatePlatformClinic(clinicId: string) {
  return adminFetch<void>(`/api/admin/platform/clinics/${clinicId}/deactivate`, {
    method: "PATCH",
  });
}

export function inviteClinicAdmin(clinicId: string, data: InviteAdminInput) {
  return adminFetch<{ id: string; email: string; full_name: string | null; role: string }>(`/api/admin/platform/clinics/${clinicId}/invite`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/* ------------------------------------------------------------------ */
/*  Platform tag management (super admin)                              */
/* ------------------------------------------------------------------ */

export function getPlatformTags(type?: string) {
  const qs = type ? `?type=${type}` : "";
  return adminFetch<PlatformTagItem[]>(`/api/admin/platform/tags${qs}`);
}

export function createPlatformTag(data: { type: string; value: string }) {
  return adminFetch<PlatformTagItem>("/api/admin/platform/tags", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePlatformTag(id: string, data: { value?: string; is_active?: boolean }) {
  return adminFetch<PlatformTagItem>(`/api/admin/platform/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePlatformTag(id: string) {
  return adminFetch<void>(`/api/admin/platform/tags/${id}`, { method: "DELETE" });
}

export function reorderPlatformTags(ids: string[]) {
  return adminFetch<void>("/api/admin/platform/tags/reorder", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/* Public-facing tag lists (used by clinic admin pickers) */
export function getSpecialisations() {
  return adminFetch<{ slug: string; name_en: string }[]>("/api/admin/tags/specialisations");
}

export function getCertifications() {
  return adminFetch<{ value: string }[]>("/api/admin/tags/certifications");
}

/* ------------------------------------------------------------------ */
/*  Type definitions                                                   */
/* ------------------------------------------------------------------ */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "clinic_admin" | "platform_admin";
  clinic_id?: string;
}

export interface Clinic {
  id: string;
  slug: string;
  name: string;
  tier: number;
  // Descriptions (multilingual)
  description_en: string | null;
  description_ml: string | null;
  description_ar: string | null;
  // Location
  district: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  state: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  // Contact
  phone: string | null;
  email: string | null;
  website_url: string | null;
  // Tags
  languages: string[];
  specialisations: string[];
  wellness_categories: string[];
  certifications: string[];
  atmosphere: string[];
  // Pricing
  pricing_min: number | null;
  pricing_max: number | null;
  // Facilities
  accommodation_available: boolean;
  pickup_available: boolean;
  pickup_locations: string[];
  outcome_enrolled: boolean;
  // Schedules & social
  operating_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  social_links: { facebook?: string; instagram?: string; youtube?: string; whatsapp?: string } | null;
  // Getting Here
  transport_info: string | null;
  // Read-only
  rating: number | null;
  review_count: number;
  is_active: boolean;
}

export interface ClinicReview {
  id: string;
  rating: number;
  review_text: string | null;
  reviewer_location: string | null;
  treatment_slug: string | null;
  verified: boolean;
  created_at: string;
}

export interface ClinicReviews {
  total: number;
  avg_rating: number | null;
  reviews: ClinicReview[];
}

export interface ClinicImage {
  id: string;
  url: string;
  type: "hero" | "logo" | "gallery" | "rooms";
  alt_text: string;
  display_order: number;
}

export interface TeamMember {
  id: string;
  name: string;
  name_ml: string | null;
  name_ar: string | null;
  qualification: string;
  years_experience: number;
  bio_en: string | null;
  bio_ml: string | null;
  photo_url: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Retreat {
  id: string;
  name: string;
  name_display_en: string | null;
  name_display_ar: string | null;
  name_display_ml: string | null;
  description_en: string | null;
  description_ar: string | null;
  description_ml: string | null;
  package_type: string;
  wellness_categories: string[];
  duration_min_days: number | null;
  duration_max_days: number | null;
  price_usd: number | null;
  price_inr: number | null;
  includes_accommodation: boolean;
  includes_meals: boolean;
  includes_transfers: boolean;
  max_guests_per_slot: number;
  what_to_expect: string | null;
  contraindications: string | null;
  highlights: string[];
  treatments_included: string[];
  ideal_for: string[];
  prakriti_tags: string[];
  photos: string[];
  daily_schedule: string | null;
  cancellation_policy: string | null;
  language_of_instruction: string[];
  min_age: number | null;
  is_active: boolean;
  display_order: number;
}

// Legacy alias — packages/page.tsx uses these names
export type Package = Retreat;
export const getPackages = getRetreats;
export const createPackage = createRetreat;
export const updatePackage = updateRetreat;
export const deletePackage = deleteRetreat;

export interface RetreatAvailabilityDay {
  date: string;
  available_spots: number;
  is_blocked: boolean;
  block_reason: string | null;
}

export interface Booking {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_count: number;
  clinic_id: string;
  retreat_id: string | null;
  retreat_name: string;
  start_date: string;
  end_date: string;
  nights: number;
  status: string;
  total_amount: number;
  commission_amount: number;
  currency: string;
  payment_ref: string | null;
  created_at: string;
}

export interface AdminBookingCreate {
  retreat_id: string;
  guest_count: number;
  start_date: string;
  end_date: string;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  lang?: string;
  notes?: string | null;
  skip_availability_check?: boolean;
}

export interface BookingStats {
  bookings_this_month: number;
  revenue_this_month: number;
  pending_requests: number;
  active_retreats: number;
}

export interface PlatformClinic {
  id: string;
  name: string;
  slug: string;
  district: string | null;
  tier: number;
  is_active: boolean;
  team_count: number;
  retreats_count: number;
  images_count: number;
  bookings_count: number;
  revenue: number;
  has_admin: boolean;
  onboarding_pct: number;
  created_at: string;
}

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
}

export interface AdminUserInfo {
  id: string;
  email: string;
  full_name: string | null;
  last_login_at: string | null;
}

export interface PlatformClinicDetail {
  id: string;
  name: string;
  slug: string;
  district: string | null;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tier: number;
  is_active: boolean;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  specialisations: string[];
  atmosphere: string[];
  certifications: string[];
  languages: string[];
  established_year: number | null;
  pricing_min: number | null;
  pricing_max: number | null;
  team_count: number;
  retreats_count: number;
  images_count: number;
  bookings_count: number;
  revenue: number;
  admin_user: AdminUserInfo | null;
  onboarding: OnboardingStep[];
  created_at: string;
}

export interface ClinicCreateInput {
  name: string;
  slug?: string;
  district: string;
  description?: string;
  tier: number;
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  email?: string;
  website_url?: string;
  specialisations: string[];
  atmosphere: string[];
  certifications: string[];
  languages: string[];
  pricing_min?: number;
  pricing_max?: number;
}

export interface InviteAdminInput {
  email: string;
  full_name: string;
  password: string;
}

export interface PlatformTagItem {
  id: string;
  type: string;
  value: string;
  is_active: boolean;
  sort_order: number;
}

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  preferred_language: string;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  clinic_id: string | null;
  clinic_name: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface PlatformStats {
  total_clinics: number;
  tier1_clinics: number;
  tier2_clinics: number;
  active_clinics: number;
  total_bookings: number;
  total_gmv: number;
  total_revenue: number;
  active_retreats: number;
  total_team_members: number;
}
