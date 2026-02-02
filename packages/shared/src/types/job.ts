/**
 * Job models - represents background processing jobs
 */

export type JobType =
  | 'terrain_generation'
  | 'seed_placement'
  | 'growth_simulation'
  | 'vmt_calculation'
  | 'export_png'
  | 'export_gif'

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface JobCreate {
  type: JobType
  /** Target tile (if applicable) */
  tile_id?: string | null
  /** Job-specific parameters */
  params?: Record<string, unknown>
}

export interface Job {
  id: string
  type: JobType
  status: JobStatus
  tile_id: string | null
  params: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}
