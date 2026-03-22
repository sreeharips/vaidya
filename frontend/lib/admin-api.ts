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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
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
/*  Doctors                                                            */
/* ------------------------------------------------------------------ */

export function getDoctors() {
  return adminFetch<Doctor[]>("/api/admin/doctors");
}

export function getDoctor(id: string) {
  return adminFetch<Doctor>(`/api/admin/doctors/${id}`);
}

export function createDoctor(data: Partial<Doctor>) {
  return adminFetch<Doctor>("/api/admin/doctors", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDoctor(id: string, data: Partial<Doctor>) {
  return adminFetch<Doctor>(`/api/admin/doctors/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function toggleDoctorActive(id: string, active: boolean) {
  return adminFetch<Doctor>(`/api/admin/doctors/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: active }),
  });
}

/* ------------------------------------------------------------------ */
/*  Treatments                                                         */
/* ------------------------------------------------------------------ */

export function getTreatments() {
  return adminFetch<Treatment[]>("/api/admin/treatments");
}

export function getTreatment(id: string) {
  return adminFetch<Treatment>(`/api/admin/treatments/${id}`);
}

export function createTreatment(data: Partial<Treatment>) {
  return adminFetch<Treatment>("/api/admin/treatments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTreatment(id: string, data: Partial<Treatment>) {
  return adminFetch<Treatment>(`/api/admin/treatments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTreatment(id: string) {
  return adminFetch<void>(`/api/admin/treatments/${id}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/*  Clinic Availability (per-day slot config)                         */
/* ------------------------------------------------------------------ */

export function getAvailability(params: { month?: string; date_from?: string; date_to?: string }) {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  return adminFetch<AvailabilityDay[]>(`/api/admin/availability?${qs}`);
}

export function upsertAvailabilityDay(slotDate: string, data: AvailabilityDayConfig) {
  return adminFetch<AvailabilityDay>(`/api/admin/availability/${slotDate}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function bulkSetAvailability(data: {
  dates: string[];
  total_slots: number;
  is_closed: boolean;
  close_reason?: string | null;
  treatment_ids: string[];
  notes?: string | null;
}) {
  return adminFetch<AvailabilityDay[]>("/api/admin/availability/bulk", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function setRecurringAvailability(data: {
  weekdays: number[];
  date_from: string;
  date_to: string;
  total_slots: number;
  is_closed: boolean;
  close_reason?: string | null;
  treatment_ids: string[];
  notes?: string | null;
}) {
  return adminFetch<{ updated: number; from: string; to: string }>(
    "/api/admin/availability/recurring",
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function deleteAvailabilityDay(slotDate: string) {
  return adminFetch<void>(`/api/admin/availability/${slotDate}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/*  Booking Slots (time-of-day doctor slots — legacy)                 */
/* ------------------------------------------------------------------ */

export function getSlots(params: { doctor_id?: string; month?: string }) {
  const qs = new URLSearchParams();
  if (params.doctor_id) qs.set("doctor_id", params.doctor_id);
  if (params.month) qs.set("month", params.month);
  return adminFetch<Slot[]>(`/api/admin/slots/calendar?${qs}`);
}

export function createSlot(data: Partial<Slot>) {
  return adminFetch<Slot>("/api/admin/slots/single", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteSlot(id: string) {
  return adminFetch<void>(`/api/admin/slots/${id}`, { method: "DELETE" });
}

export function blockDates(data: { doctor_id?: string; date_from: string; date_to: string; reason?: string }) {
  return adminFetch<void>("/api/admin/slots/block", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function setRecurring(data: {
  doctor_id?: string;
  treatment_id?: string;
  pattern?: string;
  days: string[];
  start_time: string;
  end_time: string;
  max_bookings: number;
  valid_from?: string;
  valid_until?: string;
}) {
  return adminFetch<void>("/api/admin/slots/recurring", {
    method: "POST",
    body: JSON.stringify(data),
  });
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
    treatment_name: string;
    doctor_name: string | null;
    guest_name: string;
    start_date: string;
    end_date: string;
    nights: number;
    total_amount: number;
    commission_amount: number;
    currency: string;
    availability_warnings: Array<{ type: string; date: string; reason: string }>;
  }>("/api/admin/bookings", { method: "POST", body: JSON.stringify(data) });
}

export function assignDoctor(bookingId: string, doctorId: string) {
  return adminFetch<{ id: string; doctor_id: string; doctor_name: string }>(
    `/api/admin/bookings/${bookingId}/assign-doctor`,
    { method: "PATCH", body: JSON.stringify({ doctor_id: doctorId }) },
  );
}

/* ------------------------------------------------------------------ */
/*  E-commerce                                                         */
/* ------------------------------------------------------------------ */

export function getEcommerceSettings() {
  return adminFetch<EcommerceSettings>("/api/admin/ecommerce/settings");
}

export function updateEcommerceSettings(data: Partial<EcommerceSettings>) {
  return adminFetch<EcommerceSettings>("/api/admin/ecommerce/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getProducts() {
  return adminFetch<Product[]>("/api/admin/ecommerce/products");
}

export function createProduct(data: ProductInput) {
  return adminFetch<Product>("/api/admin/ecommerce/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(id: string, data: ProductInput) {
  return adminFetch<Product>(`/api/admin/ecommerce/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProduct(id: string) {
  return adminFetch<void>(`/api/admin/ecommerce/products/${id}`, { method: "DELETE" });
}

export function getOrders() {
  return adminFetch<Order[]>("/api/admin/ecommerce/orders");
}

export function updateOrderStatus(id: string, status: string) {
  return adminFetch<Order>(`/api/admin/ecommerce/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
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

export function upgradeClinicTier(clinicId: string, tier: number) {
  return adminFetch<void>(`/api/admin/platform/clinics/${clinicId}/tier`, {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
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
  prakriti_affinities: string[];
  certifications: string[];
  // Pricing
  pricing_min: number | null;
  pricing_max: number | null;
  // Facilities
  accommodation_available: boolean;
  pickup_available: boolean;
  pickup_locations: string[];
  ecommerce_enabled: boolean;
  outcome_enrolled: boolean;
  // Schedules & social
  operating_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  social_links: { facebook?: string; instagram?: string; youtube?: string; whatsapp?: string } | null;
  // Getting Here
  transport_info: string | null;
  // Policies
  shipping_policy: string | null;
  return_policy: string | null;
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

export interface Doctor {
  id: string;
  slug: string;
  name: string;
  name_ml?: string;
  name_ar?: string;
  qualification: string;
  years_exp: number;
  bio: string | null;
  bio_ml?: string | null;
  bio_ar?: string | null;
  specialisations: string[];
  prakriti_affinities: string[];
  languages: string[];
  gender: string | null;
  consultation_fee_usd: number | null;
  photo_url?: string | null;
  tier: number;
  is_active: boolean;
  rating: number | null;
  review_count: number;
  doctor_certifications: Record<string, unknown> | null;
}

export interface Treatment {
  id: string;
  name: string;
  name_ml?: string | null;
  name_ar?: string | null;
  slug: string;
  description: string | null;
  description_ml?: string | null;
  prakriti_tags: string[];
  duration_min_days: number | null;
  duration_max_days: number | null;
  price_per_day: number | null;
  included_therapies: string[];
  doctor_ids: string[];
  is_active: boolean;
}

export interface AvailabilityDay {
  slot_date: string;
  total_slots: number;
  is_closed: boolean;
  close_reason: string | null;
  treatment_ids: string[];
  notes: string | null;
}

export interface AvailabilityDayConfig {
  total_slots: number;
  is_closed: boolean;
  close_reason?: string | null;
  treatment_ids: string[];
  notes?: string | null;
}

export interface Slot {
  id: string;
  slot_type: string;
  date: string | null;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
  is_active: boolean;
  doctor_id: string | null;
  treatment_id: string | null;
  notes: string | null;
  recurrence: Record<string, unknown> | null;
}

export interface Booking {
  id: string;
  patient_name: string;
  patient_email: string;
  clinic_id: string;
  doctor_id: string | null;
  doctor_name: string | null;
  treatment_id: string | null;
  treatment_name: string;
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
  treatment_id: string;
  doctor_id?: string | null;
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
  active_doctors: number;
}

export interface EcommerceSettings {
  ecommerce_enabled: boolean;
  shipping_policy: string | null;
  return_policy: string | null;
}

export interface VariantInput {
  label: string;
  sku?: string | null;
  price: number;
  stock_qty?: number;
  weight_grams?: number | null;
}

export interface ProductInput {
  name?: string;
  description?: string | null;
  category?: string | null;
  prakriti_tags?: string[];
  base_price?: number | null;
  currency?: string;
  is_gmp_certified?: boolean;
  is_active?: boolean;
  variants?: VariantInput[];
}

export interface ProductVariant {
  id: string;
  label: string;
  sku: string | null;
  price: number;
  stock_qty: number;
  weight_grams: number | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  prakriti_tags: string[];
  base_price: number | null;
  currency: string;
  photos: string[];
  is_gmp_certified: boolean;
  is_active: boolean;
  variants: ProductVariant[];
}

export interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  ordered_at: string;
  items: OrderItem[];
}

export interface PlatformClinic {
  id: string;
  name: string;
  district: string;
  tier: number;
  doctors_count: number;
  bookings_count: number;
  revenue: number;
  is_active: boolean;
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
  total_bookings: number;
  total_revenue: number;
  active_doctors: number;
}
