import { HttpError } from './http.js'
import type { SiteStatus } from './types.js'

const SITE_STATUSES = ['candidate', 'validated', 'rejected'] as const
const IGS_TYPES = ['Residual', 'Lot', 'Edgeland', 'Opportunity'] as const
const OWNERSHIP_VALUES = ['PUB', 'PRI', 'UNK'] as const
const ACCESS_CONTROL_VALUES = ['O', 'P', 'C'] as const
const MAINTENANCE_VALUES = ['FM', 'IM', 'NM'] as const
const MAINTENANCE_FREQUENCY_VALUES = ['W', 'M', 'S', 'U', 'VL'] as const
const CONTEXT_LAYER_CATEGORIES = ['reference', 'qa'] as const

function ensureObject(value: unknown, message: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, message)
  }

  return value as Record<string, unknown>
}

function parseNonEmptyString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} must be a string`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new HttpError(400, `${fieldName} cannot be empty`)
  }

  return trimmed
}

function parseNullableString(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} must be a string or null`)
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseBoolean(value: unknown, fieldName: string) {
  if (typeof value !== 'boolean') {
    throw new HttpError(400, `${fieldName} must be a boolean`)
  }

  return value
}

function parseEnum<T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: T
) {
  const parsed = parseNonEmptyString(value, fieldName)
  if (!allowedValues.includes(parsed as T[number])) {
    throw new HttpError(400, `${fieldName} must be one of: ${allowedValues.join(', ')}`)
  }

  return parsed as T[number]
}

function parseNullableEnum<T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: T
) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return parseEnum(value, fieldName, allowedValues)
}

function parseNullableIsoTimestamp(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} must be an ISO timestamp string or null`)
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    throw new HttpError(400, `${fieldName} must be a valid ISO timestamp`)
  }

  return new Date(timestamp).toISOString()
}

export function parseIdParam(value: unknown, fieldName = 'id') {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} must be provided as a path parameter`)
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive integer`)
  }

  return parsed
}

export function parseReviewQueueLimit(value: unknown) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'limit must be a number')
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new HttpError(400, 'limit must be an integer between 1 and 500')
  }

  return parsed
}

export function parseSiteStatusBody(body: unknown): SiteStatus {
  const payload = ensureObject(body, 'Request body must be a JSON object')
  return parseEnum(payload.status, 'status', SITE_STATUSES) as SiteStatus
}

export function parseGeometryPatchBody(body: unknown) {
  const payload = ensureObject(body, 'Request body must be a JSON object')
  const geometry = ensureObject(payload.geometry, 'geometry must be an object')
  const geometryType = parseEnum(geometry.type, 'geometry.type', ['Polygon', 'MultiPolygon'] as const)

  if (!Array.isArray(geometry.coordinates)) {
    throw new HttpError(400, 'geometry.coordinates must be an array')
  }

  return {
    geometry: {
      ...geometry,
      type: geometryType,
      coordinates: geometry.coordinates,
    },
  }
}

export function parseContextLayerUpsertBody(body: unknown) {
  const payload = ensureObject(body, 'Request body must be a JSON object')
  const geojson = ensureObject(payload.geojson, 'geojson must be an object')

  if (geojson.type !== 'FeatureCollection') {
    throw new HttpError(400, 'geojson.type must be FeatureCollection')
  }

  if (!Array.isArray(geojson.features)) {
    throw new HttpError(400, 'geojson.features must be an array')
  }

  return {
    label: parseNonEmptyString(payload.label, 'label'),
    category: parseEnum(payload.category, 'category', CONTEXT_LAYER_CATEGORIES),
    description: parseNullableString(payload.description, 'description'),
    geojson,
  }
}

export function parseSiteCreateBody(body: unknown) {
  const payload = ensureObject(body, 'Request body must be a JSON object')

  const geometry = ensureObject(payload.geometry, 'geometry must be an object')
  const geometryType = parseEnum(geometry.type, 'geometry.type', ['Polygon', 'MultiPolygon'] as const)
  if (!Array.isArray(geometry.coordinates)) {
    throw new HttpError(400, 'geometry.coordinates must be an array')
  }

  const result: Record<string, unknown> = {
    geometry: { ...geometry, type: geometryType, coordinates: geometry.coordinates },
    igs_type: parseEnum(payload.igs_type, 'igs_type', IGS_TYPES),
  }

  if ('subtype' in payload) result.subtype = parseNullableString(payload.subtype, 'subtype')
  if ('name' in payload) result.name = parseNullableString(payload.name, 'name')
  if ('ownership' in payload) result.ownership = parseEnum(payload.ownership, 'ownership', OWNERSHIP_VALUES)
  if ('access_control' in payload) result.access_control = parseEnum(payload.access_control, 'access_control', ACCESS_CONTROL_VALUES)
  if ('notes' in payload) result.notes = parseNullableString(payload.notes, 'notes')

  return result
}

export function parseSiteUpdateBody(body: unknown) {
  const payload = ensureObject(body, 'Request body must be a JSON object')
  const updates: Record<string, unknown> = {}

  if ('name' in payload) {
    updates.name = parseNullableString(payload.name, 'name')
  }
  if ('ownership' in payload) {
    updates.ownership = parseEnum(payload.ownership, 'ownership', OWNERSHIP_VALUES)
  }
  if ('access_control' in payload) {
    updates.access_control = parseEnum(
      payload.access_control,
      'access_control',
      ACCESS_CONTROL_VALUES
    )
  }
  if ('access_description' in payload) {
    updates.access_description = parseNullableString(payload.access_description, 'access_description')
  }
  if ('natural_barrier' in payload) {
    updates.natural_barrier = parseNullableString(payload.natural_barrier, 'natural_barrier')
  }
  if ('maintenance' in payload) {
    updates.maintenance = parseNullableEnum(payload.maintenance, 'maintenance', MAINTENANCE_VALUES)
  }
  if ('maintenance_frequency' in payload) {
    updates.maintenance_frequency = parseNullableEnum(
      payload.maintenance_frequency,
      'maintenance_frequency',
      MAINTENANCE_FREQUENCY_VALUES
    )
  }
  if ('prox_housing' in payload) {
    updates.prox_housing = parseBoolean(payload.prox_housing, 'prox_housing')
  }
  if ('hidden_gem' in payload) {
    updates.hidden_gem = parseBoolean(payload.hidden_gem, 'hidden_gem')
  }
  if ('dangerous' in payload) {
    updates.dangerous = parseBoolean(payload.dangerous, 'dangerous')
  }
  if ('noisy' in payload) {
    updates.noisy = parseBoolean(payload.noisy, 'noisy')
  }
  if ('too_small' in payload) {
    updates.too_small = parseBoolean(payload.too_small, 'too_small')
  }
  if ('notes' in payload) {
    updates.notes = parseNullableString(payload.notes, 'notes')
  }
  if ('igs_type' in payload) {
    updates.igs_type = parseEnum(payload.igs_type, 'igs_type', IGS_TYPES)
  }
  if ('subtype' in payload) {
    updates.subtype = parseNullableString(payload.subtype, 'subtype')
  }
  if ('buried_river' in payload) {
    updates.buried_river = payload.buried_river === null
      ? null
      : parseBoolean(payload.buried_river, 'buried_river')
  }
  if ('community_activity_potential' in payload) {
    updates.community_activity_potential = parseNullableString(
      payload.community_activity_potential,
      'community_activity_potential'
    )
  }
  if ('biodiversity_potential' in payload) {
    updates.biodiversity_potential = parseNullableString(
      payload.biodiversity_potential,
      'biodiversity_potential'
    )
  }
  if ('editor_notes' in payload) {
    updates.editor_notes = parseNullableString(payload.editor_notes, 'editor_notes')
  }
  if ('reviewed_by' in payload) {
    updates.reviewed_by = parseNullableString(payload.reviewed_by, 'reviewed_by')
  }
  if ('reviewed_at' in payload) {
    updates.reviewed_at = parseNullableIsoTimestamp(payload.reviewed_at, 'reviewed_at')
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No valid fields provided')
  }

  return updates
}
