import type { PersistenceAdapter } from "./PersistenceAdapter";
import type {
  ProjectMetadata,
  ProjectData,
  Project,
  PersistenceResult,
} from "../types";

/**
 * Supabase implementation of PersistenceAdapter
 *
 * This is a stub for future implementation. When ready to integrate with Supabase:
 *
 * 1. Install dependencies:
 *    bun add @supabase/supabase-js
 *
 * 2. Database schema would look like:
 *
 *    CREATE TABLE projects (
 *      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *      user_id UUID REFERENCES auth.users(id),
 *      name TEXT NOT NULL,
 *      thumbnail_url TEXT,
 *      created_at TIMESTAMPTZ DEFAULT NOW(),
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    CREATE TABLE project_data (
 *      project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 *      fps INTEGER NOT NULL DEFAULT 30,
 *      duration REAL NOT NULL DEFAULT 60,
 *      resolution JSONB NOT NULL DEFAULT '{"width": 1920, "height": 1080}',
 *      tracks JSONB NOT NULL DEFAULT '[]',
 *      clips JSONB NOT NULL DEFAULT '[]',
 *      media_library JSONB NOT NULL DEFAULT '[]',
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    -- RLS policies for user isolation
 *    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE project_data ENABLE ROW LEVEL SECURITY;
 *
 *    CREATE POLICY "Users can view own projects"
 *      ON projects FOR SELECT
 *      USING (auth.uid() = user_id);
 *
 *    CREATE POLICY "Users can insert own projects"
 *      ON projects FOR INSERT
 *      WITH CHECK (auth.uid() = user_id);
 *
 *    CREATE POLICY "Users can update own projects"
 *      ON projects FOR UPDATE
 *      USING (auth.uid() = user_id);
 *
 *    CREATE POLICY "Users can delete own projects"
 *      ON projects FOR DELETE
 *      USING (auth.uid() = user_id);
 *
 * 3. Usage:
 *    import { createClient } from '@supabase/supabase-js';
 *    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 *    const adapter = new SupabaseAdapter(supabase);
 *    projectManager.setAdapter(adapter);
 */
export class SupabaseAdapter implements PersistenceAdapter {
  readonly name = "supabase";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any; // SupabaseClient when implemented
  private userId: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await this.client.auth.getSession();
      this.userId = session?.user?.id ?? null;
      return this.userId !== null;
    } catch {
      return false;
    }
  }

  async initialize(): Promise<PersistenceResult<void>> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        success: false,
        error: new Error("Supabase: User not authenticated"),
      };
    }
    return { success: true, data: undefined };
  }

  async dispose(): Promise<void> {
    // Could close realtime subscriptions here
  }

  async listProjects(): Promise<PersistenceResult<ProjectMetadata[]>> {
    // TODO: Implement when Supabase is integrated
    // const { data, error } = await this.client
    //   .from('projects')
    //   .select('id, name, thumbnail_url, created_at, updated_at')
    //   .order('updated_at', { ascending: false });
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async getActiveProjectId(): Promise<PersistenceResult<string | null>> {
    // TODO: Could store in user_metadata or separate user_preferences table
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async setActiveProjectId(
    _id: string | null
  ): Promise<PersistenceResult<void>> {
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async getProject(_id: string): Promise<PersistenceResult<Project>> {
    // TODO: JOIN projects with project_data
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async getProjectMetadata(
    _id: string
  ): Promise<PersistenceResult<ProjectMetadata>> {
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async getProjectData(_id: string): Promise<PersistenceResult<ProjectData>> {
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async createProject(
    _name: string,
    _initialData?: Partial<ProjectData>
  ): Promise<PersistenceResult<Project>> {
    // TODO: INSERT into projects, then INSERT into project_data
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async saveProjectData(
    _id: string,
    _data: ProjectData
  ): Promise<PersistenceResult<void>> {
    // TODO: UPDATE project_data SET ... WHERE project_id = $1
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async updateProjectMetadata(
    _id: string,
    _updates: Partial<Pick<ProjectMetadata, "name" | "thumbnailUrl">>
  ): Promise<PersistenceResult<ProjectMetadata>> {
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async deleteProject(_id: string): Promise<PersistenceResult<void>> {
    // TODO: DELETE FROM projects WHERE id = $1 (CASCADE handles project_data)
    throw new Error("SupabaseAdapter: Not implemented");
  }

  async duplicateProject(
    _id: string,
    _newName?: string
  ): Promise<PersistenceResult<Project>> {
    // TODO: Could use a Postgres function for atomic duplication
    throw new Error("SupabaseAdapter: Not implemented");
  }
}
