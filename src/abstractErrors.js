export class SignatureMissingException extends Error {
    constructor(errStatusCode = 403, errTextContent = "__THIS_IS_FROM_SIGNATUREMISSINGEXCEPTION_CLASS__", ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SignatureMissingException);
        }

        // Custom debugging information
        this.name = "SignatureMissingException";
        this.code = errStatusCode;
        this.message = errTextContent;
        this.date = new Date();
    }
}


export class SignatureInvalidException extends Error {
    constructor(errStatusCode = 403, errTextContent = "__THIS_IS_FROM_SIGNATUREINVALIDEXCEPTION_CLASS__", ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SignatureInvalidException);
        }

        // Custom debugging information
        this.name = "SignatureInvalidException";
        this.code = errStatusCode;
        this.message = errTextContent;
        this.date = new Date();
    }
}

export class AbstractError extends Error {
    constructor(errStatusCode = 500, errTextContent = "__THIS_IS_FROM_ABSTRACTERROR_CLASS__", ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AbstractError);
        }

        // Custom debugging information
        this.name = "AbstractError";
        this.code = errStatusCode;
        this.message = errTextContent;
        this.date = new Date();
    }
}
