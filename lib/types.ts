export type ClassRow = {
  id: string;
  name: string;
  instructor: string; // 메인 담당자
  instructor_sub: string | null; // 보조 담당자
  description: string | null;
  location: string | null;
  materials: string | null;
  max_capacity: number;
  current_count: number;
  image_urls: string[];
  sort_order: number;
};

export type RegistrationRow = {
  seq: number;
  class_id: string;
  ranch_name: string;
  user_name: string;
  created_at: string;
};

// 부스 생성/수정 폼 페이로드 (admin_upsert_class 에 그대로 전달)
export type ClassPayload = {
  id?: string;
  name: string;
  instructor: string;
  instructor_sub: string;
  description: string;
  location: string;
  materials: string;
  max_capacity: number;
  image_urls: string[];
  sort_order?: number;
};
