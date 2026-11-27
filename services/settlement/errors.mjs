export class SettlementError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.name = 'SettlementError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
