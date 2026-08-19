export const successResponse = (
  data = null,
  message = "Success",
  status = 200,
) => ({ success: true, status, message, data });

export const errorResponse = (
  data = null,
  message = "Request failed",
  status = 500,
) => ({ success: false, status, message, data });

export const erroResponse = errorResponse;
