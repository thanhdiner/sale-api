/**
 * Shared constants for AI tool executors.
 */

const { CLIENT_URL } = require('./dependencies')

const MAX_CART_UNIQUE_ITEMS = 50

const DEFAULT_WISHLIST_LIMIT = 12

const MAX_WISHLIST_LIMIT = 50

const DEFAULT_SEARCH_PRODUCTS_LIMIT = 5

const MAX_SEARCH_PRODUCTS_LIMIT = 10

const MIN_COMPARE_PRODUCTS = 2

const MAX_COMPARE_PRODUCTS = 4

const MAX_AVAILABILITY_PRODUCTS = 10

const POLICY_SOURCES = ['faq', 'returnPolicy', 'privacyPolicy', 'terms']

const DEFAULT_POLICY_SEARCH_LIMIT = 6

const MAX_POLICY_SEARCH_LIMIT = 12

const BLOG_TRANSLATION_FIELDS = ['title', 'excerpt', 'content', 'category', 'tags']

const DEFAULT_BLOG_POST_LIMIT = 5

const MAX_BLOG_POST_LIMIT = 10

const DEFAULT_BUYING_GUIDE_LIMIT = 8

const MAX_BUYING_GUIDE_LIMIT = 16

const DEFAULT_COUPON_WALLET_EXPIRING_SOON_DAYS = 7

const MAX_COUPON_WALLET_EXPIRING_SOON_DAYS = 30

const DEFAULT_COUPON_WALLET_LIMIT = 8

const MAX_COUPON_WALLET_LIMIT = 12

const COUPON_WALLET_PROMO_LOOKUP_LIMIT = 150

const PLACE_ORDER_PAYMENT_METHODS = ['vnpay', 'momo', 'zalopay', 'sepay']

const PLACE_ORDER_DELIVERY_METHODS = ['pickup', 'contact']

const CHECKOUT_PROFILE_DELIVERY_METHODS = ['pickup', 'contact']

const CHECKOUT_PROFILE_PAYMENT_METHODS = ['transfer', 'contact', 'vnpay', 'momo', 'zalopay', 'sepay']

const FREE_SHIPPING_THRESHOLD = 100000

const DEFAULT_SHIPPING_FEE = 50000

const CHECKOUT_PROFILE_STRING_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'notes']

const CHECKOUT_PROFILE_ADDRESS_FIELDS = [
  'addressLine1',
  'provinceCode',
  'provinceName',
  'districtCode',
  'districtName',
  'wardCode',
  'wardName',
  'address'
]

const CHECKOUT_PROFILE_MUTATION_FIELDS = [
  ...CHECKOUT_PROFILE_STRING_FIELDS,
  ...CHECKOUT_PROFILE_ADDRESS_FIELDS,
  'deliveryMethod',
  'paymentMethod'
]

const LOYALTY_VND_PER_POINT = 1000

const LOYALTY_TIERS = [
  { key: 'member', labelVi: 'Thanh vien', labelEn: 'Member', minPoints: 0 },
  { key: 'silver', labelVi: 'Silver', labelEn: 'Silver', minPoints: 1000 },
  { key: 'gold', labelVi: 'Gold', labelEn: 'Gold', minPoints: 3000 },
  { key: 'diamond', labelVi: 'Diamond', labelEn: 'Diamond', minPoints: 8000 }
]

const USER_PROFILE_MUTATION_FIELDS = ['fullName', 'phone', 'avatarUrl']

const NOTIFICATION_CHANNEL_FIELDS = ['inApp', 'email', 'browser', 'sms']

const NOTIFICATION_TOPIC_FIELDS = [
  'orderUpdates',
  'paymentUpdates',
  'promotions',
  'backInStock',
  'wishlistUpdates',
  'supportMessages'
]

const ORDER_ADDRESS_FIELDS = [...CHECKOUT_PROFILE_ADDRESS_FIELDS, 'notes']

const ORDER_ADDRESS_LOCATION_FIELDS = [
  'provinceCode',
  'provinceName',
  'districtCode',
  'districtName',
  'wardCode',
  'wardName'
]

const POLICY_SOURCE_META = {
  faq: {
    label: 'FAQ',
    url: `${CLIENT_URL}/faq`
  },
  returnPolicy: {
    label: 'Chinh sach doi tra',
    url: `${CLIENT_URL}/return-policy`
  },
  privacyPolicy: {
    label: 'Chinh sach bao mat',
    url: `${CLIENT_URL}/privacy-policy`
  },
  terms: {
    label: 'Dieu khoan su dung',
    url: `${CLIENT_URL}/terms-of-service`
  }
}

// ─── Tool Registry (hard-code trong backend, admin chỉ bật/tắt quyền dùng) ───

const ORDER_STATUS_LABELS = {
  pending: 'Cho xac nhan',
  confirmed: 'Da xac nhan',
  shipping: 'Dang giao hang',
  completed: 'Hoan thanh',
  cancelled: 'Da huy'
}

const PAYMENT_STATUS_LABELS = {
  pending: 'Chua thanh toan',
  paid: 'Da thanh toan',
  failed: 'Thanh toan that bai'
}

const PAYMENT_METHOD_LABELS = {
  transfer: 'Chuyen khoan',
  contact: 'Lien he thoa thuan',
  vnpay: 'VNPay',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  sepay: 'Sepay'
}

const STORE_SOCIAL_MEDIA_FIELDS = ['facebook', 'twitter', 'instagram', 'linkedin']

const PERSONAL_DATA_EXPORT_SCOPES = ['all', 'account', 'orders', 'addresses', 'wishlist', 'reviews', 'chat', 'notifications']

const PERSONAL_DATA_EXPORT_FORMATS = ['json', 'csv', 'pdf']

const SUPPORT_TICKET_SOURCE_TOOLS = ['createSupportTicket', 'reportBugOrIssue', 'requestWarrantySupport', 'requestReturnOrRefund', 'requestPersonalDataExport', 'requestAccountDeletion', 'submitPaymentProof']

const SUPPORT_TICKET_UPDATE_TOOLS = ['addSupportTicketMessage', 'updateSupportTicket']

const SUPPORT_TICKET_SOURCE_META = {
  createSupportTicket: {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  },
  addSupportTicketMessage: {
    type: 'ticket_update',
    label: 'Cap nhat ticket'
  },
  updateSupportTicket: {
    type: 'ticket_update',
    label: 'Cap nhat ticket'
  },
  reportBugOrIssue: {
    type: 'bug_report',
    label: 'Bao cao loi/su co'
  },
  requestWarrantySupport: {
    type: 'warranty_request',
    label: 'Yeu cau bao hanh'
  },
  requestReturnOrRefund: {
    type: 'return_refund_request',
    label: 'Yeu cau doi tra/hoan tien'
  },
  requestPersonalDataExport: {
    type: 'personal_data_export',
    label: 'Yeu cau xuat du lieu ca nhan'
  },
  requestAccountDeletion: {
    type: 'account_deletion_request',
    label: 'Yeu cau xoa tai khoan'
  },
  submitPaymentProof: {
    type: 'payment_proof',
    label: 'Chung tu thanh toan'
  }
}

const SUPPORT_TICKET_STATUS_LABELS = {
  submitted: 'Da tiep nhan',
  pending_support_review: 'Dang cho nhan vien ho tro kiem tra',
  cancelled: 'Da huy theo yeu cau khach',
  canceled: 'Da huy theo yeu cau khach',
  error: 'Khong tao thanh cong'
}

const SUPPORT_REQUEST_SOURCE_TOOLS = [
  'submitContactRequest',
  'createSupportTicket',
  'addSupportTicketMessage',
  'updateSupportTicket',
  'scheduleCallback',
  'reportBugOrIssue',
  'requestWarrantySupport',
  'requestReturnOrRefund',
  'requestPersonalDataExport',
  'requestAccountDeletion',
  'submitPaymentProof'
]

const SUPPORT_TICKET_LOOKUP_SOURCE_TOOLS = SUPPORT_REQUEST_SOURCE_TOOLS
  .filter(toolName => !SUPPORT_TICKET_UPDATE_TOOLS.includes(toolName))

const SUPPORT_REQUEST_SOURCE_META = {
  submitContactRequest: {
    type: 'contact_request',
    label: 'Yeu cau lien he'
  },
  createSupportTicket: {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  },
  scheduleCallback: {
    type: 'callback',
    label: 'Lich goi lai'
  },
  addSupportTicketMessage: {
    type: 'ticket_update',
    label: 'Cap nhat ticket'
  },
  updateSupportTicket: {
    type: 'ticket_update',
    label: 'Cap nhat ticket'
  },
  reportBugOrIssue: {
    type: 'bug_report',
    label: 'Bao cao loi/su co'
  },
  requestWarrantySupport: {
    type: 'warranty',
    label: 'Yeu cau bao hanh'
  },
  requestReturnOrRefund: {
    type: 'return_refund',
    label: 'Yeu cau doi tra/hoan tien'
  },
  requestPersonalDataExport: {
    type: 'personal_data_export',
    label: 'Yeu cau xuat du lieu ca nhan'
  },
  requestAccountDeletion: {
    type: 'account_deletion',
    label: 'Yeu cau xoa tai khoan'
  },
  submitPaymentProof: {
    type: 'payment_proof',
    label: 'Chung tu thanh toan'
  }
}

const SUPPORT_REQUEST_TYPE_TOOLS = {
  all: SUPPORT_REQUEST_SOURCE_TOOLS,
  contact_request: ['submitContactRequest'],
  support_ticket: ['createSupportTicket'],
  ticket_update: SUPPORT_TICKET_UPDATE_TOOLS,
  callback: ['scheduleCallback'],
  bug_report: ['reportBugOrIssue'],
  warranty: ['requestWarrantySupport'],
  return_refund: ['requestReturnOrRefund'],
  personal_data_export: ['requestPersonalDataExport'],
  account_deletion: ['requestAccountDeletion'],
  payment_proof: ['submitPaymentProof']
}

const SUPPORT_TICKET_ALREADY_CANCELLED_STATUSES = ['cancelled', 'canceled']

const SUPPORT_TICKET_NON_CANCELLABLE_STATUSES = ['error', 'completed', 'closed', 'resolved', 'rejected']

const WARRANTY_RESOLUTIONS = ['repair', 'replacement', 'technical_support', 'manufacturer_support', 'other']

const WARRANTY_RESOLUTION_LABELS = {
  repair: 'Sua/chuyen kiem tra loi',
  replacement: 'Doi san pham theo chinh sach',
  technical_support: 'Ho tro ky thuat',
  manufacturer_support: 'Chuyen nha cung cap/nha san xuat',
  other: 'Ho tro khac'
}

const WARRANTY_STATUS_LABELS = {
  active: 'Con trong thoi han ho tro bao hanh du kien',
  expired: 'Co the da het thoi han bao hanh du kien',
  policy_found_needs_review: 'Co thong tin bao hanh, can nhan vien xac minh',
  policy_unknown: 'Chua co du lieu thoi han bao hanh ro rang',
  order_pending: 'Don hang chua hoan tat xu ly',
  payment_not_confirmed: 'Don hang chua ghi nhan thanh toan',
  order_cancelled: 'Don hang da huy',
  ticket_submitted: 'Ticket bao hanh da duoc ghi nhan'
}

const BUG_ISSUE_TYPES = ['website', 'payment', 'product', 'order', 'account', 'technical', 'other']

const BUG_ISSUE_SEVERITIES = ['low', 'normal', 'high', 'urgent']

const BUG_ISSUE_TYPE_LABELS = {
  website: 'Loi website',
  payment: 'Loi thanh toan',
  product: 'Loi san pham',
  order: 'Loi don hang',
  account: 'Loi tai khoan',
  technical: 'Su co ky thuat',
  other: 'Su co khac'
}

const BUG_ISSUE_CATEGORY_MAP = {
  website: 'technical',
  payment: 'payment',
  product: 'product',
  order: 'order',
  account: 'account',
  technical: 'technical',
  other: 'other'
}

const CALLBACK_CONTACT_METHODS = ['phone', 'zalo']

const DEFAULT_CALLBACK_TIMEZONE = 'Asia/Ho_Chi_Minh'

const RETURN_REQUEST_TYPES = ['return', 'refund', 'exchange', 'return_refund']

const RETURN_RESOLUTIONS = ['refund', 'exchange', 'store_credit', 'repair', 'support']

const RETURN_REQUEST_TYPE_LABELS = {
  return: 'Doi tra/tra hang',
  refund: 'Hoan tien',
  exchange: 'Doi san pham',
  return_refund: 'Doi tra/hoan tien'
}

const RETURN_RESOLUTION_LABELS = {
  refund: 'Hoan tien',
  exchange: 'Doi san pham',
  store_credit: 'Doi thanh diem/tin dung mua hang',
  repair: 'Ho tro sua loi/khac phuc',
  support: 'Can nhan vien tu van'
}

const RETURN_REFUND_STATUSES = ['requested', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled']

const RETURN_REFUND_SUB_STATUSES = ['not_applicable', ...RETURN_REFUND_STATUSES]

const RETURN_REFUND_STATUS_LABELS = {
  requested: 'Da ghi nhan',
  under_review: 'Dang kiem tra',
  approved: 'Da duyet',
  rejected: 'Tu choi',
  processing: 'Dang xu ly',
  completed: 'Da hoan tat',
  cancelled: 'Da huy'
}

const RETURN_REFUND_SUB_STATUS_LABELS = {
  not_applicable: 'Khong ap dung',
  ...RETURN_REFUND_STATUS_LABELS
}

const HANDOFF_PRIORITIES = ['low', 'normal', 'high', 'urgent']

const DEFAULT_HANDOFF_REASON = 'AI requested human support'

const HANDOFF_CUSTOMER_MESSAGE = 'Minh da chuyen cuoc tro chuyen sang nhan vien ho tro. Ban vui long doi trong giay lat nhe.'



module.exports = {
  MAX_CART_UNIQUE_ITEMS,
  DEFAULT_WISHLIST_LIMIT,
  MAX_WISHLIST_LIMIT,
  DEFAULT_SEARCH_PRODUCTS_LIMIT,
  MAX_SEARCH_PRODUCTS_LIMIT,
  MIN_COMPARE_PRODUCTS,
  MAX_COMPARE_PRODUCTS,
  MAX_AVAILABILITY_PRODUCTS,
  POLICY_SOURCES,
  DEFAULT_POLICY_SEARCH_LIMIT,
  MAX_POLICY_SEARCH_LIMIT,
  BLOG_TRANSLATION_FIELDS,
  DEFAULT_BLOG_POST_LIMIT,
  MAX_BLOG_POST_LIMIT,
  DEFAULT_BUYING_GUIDE_LIMIT,
  MAX_BUYING_GUIDE_LIMIT,
  DEFAULT_COUPON_WALLET_EXPIRING_SOON_DAYS,
  MAX_COUPON_WALLET_EXPIRING_SOON_DAYS,
  DEFAULT_COUPON_WALLET_LIMIT,
  MAX_COUPON_WALLET_LIMIT,
  COUPON_WALLET_PROMO_LOOKUP_LIMIT,
  PLACE_ORDER_PAYMENT_METHODS,
  PLACE_ORDER_DELIVERY_METHODS,
  CHECKOUT_PROFILE_DELIVERY_METHODS,
  CHECKOUT_PROFILE_PAYMENT_METHODS,
  FREE_SHIPPING_THRESHOLD,
  DEFAULT_SHIPPING_FEE,
  CHECKOUT_PROFILE_STRING_FIELDS,
  CHECKOUT_PROFILE_ADDRESS_FIELDS,
  CHECKOUT_PROFILE_MUTATION_FIELDS,
  LOYALTY_VND_PER_POINT,
  LOYALTY_TIERS,
  USER_PROFILE_MUTATION_FIELDS,
  NOTIFICATION_CHANNEL_FIELDS,
  NOTIFICATION_TOPIC_FIELDS,
  ORDER_ADDRESS_FIELDS,
  ORDER_ADDRESS_LOCATION_FIELDS,
  POLICY_SOURCE_META,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  STORE_SOCIAL_MEDIA_FIELDS,
  PERSONAL_DATA_EXPORT_SCOPES,
  PERSONAL_DATA_EXPORT_FORMATS,
  SUPPORT_TICKET_SOURCE_TOOLS,
  SUPPORT_TICKET_UPDATE_TOOLS,
  SUPPORT_TICKET_SOURCE_META,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_REQUEST_SOURCE_TOOLS,
  SUPPORT_TICKET_LOOKUP_SOURCE_TOOLS,
  SUPPORT_REQUEST_SOURCE_META,
  SUPPORT_REQUEST_TYPE_TOOLS,
  SUPPORT_TICKET_ALREADY_CANCELLED_STATUSES,
  SUPPORT_TICKET_NON_CANCELLABLE_STATUSES,
  WARRANTY_RESOLUTIONS,
  WARRANTY_RESOLUTION_LABELS,
  WARRANTY_STATUS_LABELS,
  BUG_ISSUE_TYPES,
  BUG_ISSUE_SEVERITIES,
  BUG_ISSUE_TYPE_LABELS,
  BUG_ISSUE_CATEGORY_MAP,
  CALLBACK_CONTACT_METHODS,
  DEFAULT_CALLBACK_TIMEZONE,
  RETURN_REQUEST_TYPES,
  RETURN_RESOLUTIONS,
  RETURN_REQUEST_TYPE_LABELS,
  RETURN_RESOLUTION_LABELS,
  RETURN_REFUND_STATUSES,
  RETURN_REFUND_SUB_STATUSES,
  RETURN_REFUND_STATUS_LABELS,
  RETURN_REFUND_SUB_STATUS_LABELS,
  HANDOFF_PRIORITIES,
  DEFAULT_HANDOFF_REASON,
  HANDOFF_CUSTOMER_MESSAGE
}










