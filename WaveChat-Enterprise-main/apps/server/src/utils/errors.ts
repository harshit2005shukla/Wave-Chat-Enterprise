export class AppError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncHandler = <T extends (...args: any[]) => Promise<any>>(fn: T) =>
  (...args: Parameters<T>) => fn(...args).catch(args[2]);
