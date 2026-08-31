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
  sort_order: number;
};

export type RegistrationRow = {
  seq: number;
  class_id: string;
  ranch_name: string;
  user_name: string;
  created_at: string;
};

// class_image_meta 뷰 (바이너리 data 제외)
export type ClassImageMeta = {
  id: string;
  class_id: string;
  sort: number;
  content_type: string;
  byte_size: number;
};

// 부스 생성/수정 폼 페이로드 (admin_upsert_class 에 전달). 사진/정원은 별도.
export type ClassPayload = {
  id?: string;
  name: string;
  instructor: string;
  instructor_sub: string;
  description: string;
  location: string;
  materials: string;
  sort_order?: number;
};

export type AppSettings = {
  status: "CLOSED" | "OPEN" | "FINISHED";
  capacity_per_class: number | null; // OPEN 시 고정된 분반당 정원
  attendee_count_at_open: number | null;
};
