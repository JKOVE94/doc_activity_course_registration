// 목장 목록
export const RANCHES = [
  "김대현 목장",
  "전경근 목장",
  "윤주혜 목장",
  "정은희 목장",
  "이서연 목장",
  "박민협 목장",
  "이유리 목장",
  "안병선 목장",
  "채혜숙 목장",
  "성현 목장",
  "윤다솔 목장",
  "이상원 목장",
  "새가족 / 미편성 청년",
] as const;

// 이름: 한글(완성형) 2~10자
export const NAME_PATTERN = /^[가-힣]{2,10}$/;

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test((name ?? "").trim());
}

export function isValidRanch(ranch: string): boolean {
  return (RANCHES as readonly string[]).includes((ranch ?? "").trim());
}

export type SystemStatus = "CLOSED" | "OPEN" | "FINISHED";

export const STATUS_LABEL: Record<SystemStatus, string> = {
  CLOSED: "대기중",
  OPEN: "신청 진행중",
  FINISHED: "종료",
};

export const REGISTER_ERROR_MESSAGE: Record<string, string> = {
  INVALID_INPUT: "목장과 이름을 다시 확인해 주세요.",
  INVALID_NAME: "이름은 한글 2글자 이상으로 입력해 주세요.",
  NOT_OPEN: "지금은 신청 기간이 아닙니다.",
  CLASS_NOT_FOUND: "존재하지 않는 분반입니다.",
  ALREADY_REGISTERED: "이미 다른 분반에 신청되어 있습니다. 취소 후 다시 신청해 주세요.",
  FULL: "정원이 마감되었습니다.",
  BUSY: "신청이 몰리고 있어요. 잠시 후 다시 눌러 주세요.",
  NO_REGISTRATION: "신청 내역이 없습니다.",
  BAD_PASSWORD: "관리자 비밀번호가 올바르지 않습니다.",
  NO_CLASSES: "등록된 부스가 없습니다. 부스를 먼저 추가하세요.",
  NO_ATTENDEES: "로그인한 인원이 없습니다. 청년들이 로그인한 뒤 오픈하세요.",
  SERVER: "잠시 후 다시 시도해 주세요.",
};
