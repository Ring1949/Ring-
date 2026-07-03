export type SettingsMap = Record<string, string>;

export type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  cover_image?: string;
  sort_order?: number;
  is_primary?: number | boolean;
  created_at?: string;
  updated_at?: string;
  project_count?: number;
};

export type Project = {
  id: number;
  title: string;
  subtitle?: string;
  slug: string;
  category_id?: number | null;
  description?: string;
  cover_image?: string;
  year?: string;
  location?: string;
  is_featured?: number | boolean;
  is_recommended?: number | boolean;
  is_series?: number | boolean;
  series_style?: string;
  status?: "draft" | "published";
  tags?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  category_name?: string;
  category_slug?: string;
  category?: Category | null;
  media?: Media[];
  related?: Project[];
};

export type Media = {
  id: number;
  project_id?: number | null;
  category_id?: number | null;
  title?: string;
  description?: string;
  file_path: string;
  original_name?: string;
  file_type?: string;
  mime_type?: string;
  size?: number;
  media_type?: string;
  tags?: string;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter_speed?: string;
  iso?: string;
  captured_at?: string;
  is_hero?: number | boolean;
  is_selected?: number | boolean;
  is_cover?: number | boolean;
  show_in_database?: number | boolean;
  show_in_inspiration?: number | boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  project_title?: string;
  project_slug?: string;
  project_year?: string;
  project_location?: string;
  category_name?: string;
  category_slug?: string;
  tag_ids?: string;
};

export type Tag = {
  id: number;
  name: string;
  slug: string;
  created_at?: string;
};
