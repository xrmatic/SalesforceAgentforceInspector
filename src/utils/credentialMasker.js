// Credential masking utility - masks PII and credentials before export

export function maskCredentials(jsonString) {
  return jsonString
    .replace(/"(sessionId|SessionId|session_id)":\s*"[^"]+"/gi, '"sessionId": "[REDACTED]"')
    .replace(/"(authorization|Authorization)":\s*"Bearer [^"]+"/gi, '"Authorization": "Bearer [REDACTED]"')
    .replace(/"(authorization|Authorization)":\s*"[^"]+"/gi, '"Authorization": "[REDACTED]"')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')
    .replace(/"(password|passwd|secret|token|apiKey|api_key)":\s*"[^"]+"/gi, (match, key) => `"${key}": "[REDACTED]"`);
}

export function maskObject(obj) {
  return JSON.parse(maskCredentials(JSON.stringify(obj)));
}
