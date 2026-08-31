export type ClassRow = {
  id: string;
  name: string;
  instructor: string;
  description: string | null;
  location: string | null;
  materials: string | null;
  max_capacity: number;
  current_count: number;
  sort_order: number;
};

export type RegistrationRow = {
  seq: number;
  class_id: string;
  ranch_name: string;
  user_name: string;
  created_at: string;
};
