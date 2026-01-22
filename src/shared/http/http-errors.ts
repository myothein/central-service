export class HttpError extends Error {
    status: number;
    constructor(message: string, status = 500) {
        super(message);
        this.status = status;
        Object.setPrototypeOf(this, HttpError.prototype);
    }
}

export class NotFoundError extends HttpError {
    constructor(message = 'Not Found') {
        super(message, 404);
    }
}

export class BadRequestError extends HttpError {
    constructor(message = 'Bad Request') {
        super(message, 400);
    }
}
