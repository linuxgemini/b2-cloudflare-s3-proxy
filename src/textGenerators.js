export const generateServerErrorMessage = (msg = "Server error.") =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Error>
    <Code>ServerError</Code>
    <Message>${msg}</Message>
</Error>`;

export const generateAccessDeniedMessage = (msg = "Unauthenticated requests are not allowed for this api") =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Error>
    <Code>AccessDenied</Code>
    <Message>${msg}</Message>
</Error>`;

export const generateValidationFailureMessage = (msg = "Signature validation failed.", reqID = "0300D815-9252-41E5-B587-F189759A21BF") =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ErrorResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">
  <Error>
    <Type>Sender</Type>
    <Code>SignatureDoesNotMatch</Code>
    <Message>${msg}</Message>
  </Error>
  <RequestId>${reqID}</RequestId>
</ErrorResponse>`;
