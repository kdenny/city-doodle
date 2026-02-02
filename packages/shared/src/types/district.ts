/**
 * District models - represents zoning districts on tiles
 */

export type DistrictType =
  | 'residential_low'
  | 'residential_med'
  | 'residential_high'
  | 'commercial'
  | 'industrial'
  | 'mixed_use'
  | 'park'
  | 'civic'
  | 'transit'

export interface DistrictProperties {
  /** Development density multiplier (0-10) */
  density: number
  /** Maximum building height in stories (1-100) */
  max_height: number
  /** Whether district has transit access */
  transit_access: boolean
}

export interface DistrictCreate {
  tile_id: string
  type: DistrictType
  /** GeoJSON geometry for the district boundary */
  geometry: Record<string, unknown>
  properties?: DistrictProperties
  /** Historic preservation - prevents redevelopment during growth */
  historic?: boolean
}

export interface District {
  id: string
  tile_id: string
  type: DistrictType
  /** GeoJSON geometry for the district boundary */
  geometry: Record<string, unknown>
  properties: DistrictProperties
  /** Historic preservation - prevents redevelopment during growth */
  historic: boolean
  created_at: string
  updated_at: string
}
