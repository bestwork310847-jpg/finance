// ชุดรหัส error มาตรฐานของระบบ — ใช้แทนข้อความ error ที่กระจัดกระจาย/ดิบจาก Supabase
export type ErrorCode =
  | 'DB_NOT_CONFIGURED'
  | 'AUTH_NOT_CONFIGURED'
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_EXISTS'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'

export interface AppError {
  code: ErrorCode
  message: string
}

const MESSAGES: Record<ErrorCode, string> = {
  DB_NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าฐานข้อมูล (Supabase)',
  AUTH_NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าระบบล็อกอิน (Supabase)',
  AUTH_REQUIRED: 'กรุณาล็อกอินก่อนใช้งาน',
  INVALID_CREDENTIALS: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  EMAIL_ALREADY_EXISTS: 'อีเมลนี้ถูกใช้งานแล้ว',
  NOT_FOUND: 'ไม่พบข้อมูล',
  NETWORK_ERROR: 'เชื่อมต่อเครือข่ายไม่ได้ กรุณาลองใหม่อีกครั้ง',
  UNKNOWN: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
}

export function appError(code: ErrorCode, message?: string): AppError {
  return { code, message: message ?? MESSAGES[code] }
}

// แปลง error message ดิบจาก Supabase ให้เป็นรหัสมาตรฐาน + ข้อความภาษาไทย
const RAW_MESSAGE_MAP: [RegExp, ErrorCode][] = [
  [/invalid login credentials/i, 'INVALID_CREDENTIALS'],
  [/already registered|user already exists/i, 'EMAIL_ALREADY_EXISTS'],
  [/failed to fetch|network/i, 'NETWORK_ERROR'],
]

export function fromSupabaseError(error: { message: string } | null | undefined): AppError | null {
  if (!error) return null
  const match = RAW_MESSAGE_MAP.find(([re]) => re.test(error.message))
  return match ? appError(match[1]) : appError('UNKNOWN', error.message)
}

export function errorMessage(code: ErrorCode): string {
  return MESSAGES[code]
}
