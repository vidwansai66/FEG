export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
}
