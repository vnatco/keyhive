# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in KeyHive, **please do not open a public issue**.

Instead, report it privately by emailing **security@keyhive.app** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

## Response Timeline

- **Acknowledgment** within 48 hours
- **Triage and severity assessment** within 5 days
- **Fix timeline communicated** within 14 days
- **Critical issues** resolved within 7 days

## Scope

The following are in scope:

- Client-side encryption/decryption logic (`js/crypto/`)
- API client authentication and token handling (`js/api/`)
- Electron main process, preload, and sandbox boundaries
- Capacitor/mobile native bridge and plugin integration
- Content Security Policy bypasses
- Cross-site scripting (XSS) in the web frontend
- Data leakage (master password, keys, or plaintext vault data leaving the device)
- Issues with vendored third-party libraries as integrated in this project (e.g. Argon2 WASM)

If you find a vulnerability in the backend API, please still report it to **security@keyhive.app**.

## Out of Scope

- Social engineering or phishing attacks
- Denial of service
- Upstream bugs in third-party libraries unrelated to our integration

## Safe Harbor

KeyHive will not pursue legal action against researchers who discover and report vulnerabilities in good faith following this policy. We consider security research conducted under this policy to be authorized and will work with you to understand and resolve the issue.

## Recognition

We credit researchers who report valid vulnerabilities in our release notes and security advisories (unless you prefer to remain anonymous). For significant vulnerabilities, we will request a CVE and credit the reporter.

## Responsible Disclosure

Please give us reasonable time to investigate and deploy a fix before any public disclosure. This helps us protect our users and ensures the issue is resolved properly.
