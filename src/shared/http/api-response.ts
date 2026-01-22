export function successResponse(data: any, message = 'Success') {
    return { success: true, message, data };
}

export function errorResponse(message: string, code = 500) {
    return { success: false, message, code };
}
