export type ExtractErrorCode =
  | "unsupported_format"
  | "empty"
  | "unreadable"
  | "ocr_failed"

/** Error con mensaje listo para mostrar al usuario. */
export class ExtractError extends Error {
  constructor(
    public code: ExtractErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "ExtractError"
  }
}
