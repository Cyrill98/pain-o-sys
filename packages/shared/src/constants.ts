export const TIMEZONE = 'Asia/Kuala_Lumpur';

export const LANGUAGES = ['en', 'ms'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const PROPERTY_TYPES = [
  'house',
  'apartment',
  'office',
  'shop',
  'industrial',
  'other',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** `exterior: true` means the area is outside by default (the client can still change it). */
export const AREA_TYPES = [
  'living_room',
  'bedroom',
  'kitchen',
  'bathroom',
  'hallway',
  'ceiling',
  'exterior_wall',
  'fence',
  'doors_trim',
  'other',
] as const;
export type AreaType = (typeof AREA_TYPES)[number];

/** Which areas are offered for each property type (order = display order). */
export const AREAS_BY_PROPERTY: Record<PropertyType, readonly AreaType[]> = {
  house: [
    'living_room',
    'bedroom',
    'kitchen',
    'bathroom',
    'hallway',
    'ceiling',
    'exterior_wall',
    'fence',
    'doors_trim',
    'other',
  ],
  apartment: [
    'living_room',
    'bedroom',
    'kitchen',
    'bathroom',
    'hallway',
    'ceiling',
    'doors_trim',
    'other',
  ],
  office: ['living_room', 'hallway', 'kitchen', 'bathroom', 'ceiling', 'doors_trim', 'other'],
  shop: ['living_room', 'ceiling', 'exterior_wall', 'doors_trim', 'other'],
  industrial: ['living_room', 'ceiling', 'exterior_wall', 'fence', 'other'],
  other: ['living_room', 'ceiling', 'exterior_wall', 'fence', 'doors_trim', 'other'],
};

export const AREA_CONDITIONS = ['good', 'patching', 'peeling'] as const;
export type AreaCondition = (typeof AREA_CONDITIONS)[number];

export const SURFACES = ['walls', 'ceiling', 'trim'] as const;
export type Surface = (typeof SURFACES)[number];

export const REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const COLOR_FINISHES = ['matt', 'satin', 'gloss'] as const;
export type ColorFinish = (typeof COLOR_FINISHES)[number];

export const COLOR_FAMILIES = [
  'white',
  'grey',
  'beige',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'blue',
  'green',
  'brown',
  'black',
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

/** Allowed photo types for uploads, with their file extension. */
export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Every error code the API can return. The frontend translates each one
 * (locales/{en,ms}/errors.json); a test checks none are missing.
 */
export const API_ERROR_CODES = [
  'BAD_ORIGIN',
  'CAPTCHA_FAILED',
  'INTERNAL_ERROR',
  'INVALID_CREDENTIALS',
  'INVALID_INPUT',
  'INVALID_JSON',
  'INVALID_PHONE',
  'INVALID_IMAGE',
  'NOT_FOUND',
  'TOO_LARGE',
  'TOO_MANY_ATTEMPTS',
  'TOO_MANY_REQUESTS',
  'UNAUTHENTICATED',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Client-side-only codes (no API response). */
export const CLIENT_ERROR_CODES = ['NETWORK', 'UNKNOWN'] as const;
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];
export type ErrorCode = ApiErrorCode | ClientErrorCode;
