import { ApiEndpoint } from '../../components/ApiEndpoint';
import { Callout } from '../../components/Callout';

const BASE = `${window.location.origin}/api`;

export function AuthApiPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Authentication</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-6">
        MyTradeLedger uses JWT (JSON Web Token) authentication. Tokens are valid for 30 days and
        must be included in the <code className="text-xs bg-base-200 px-1.5 py-0.5 rounded">Authorization</code> header
        of every protected request.
      </p>

      <div className="border border-base-300 rounded-lg p-4 bg-base-100 mb-8">
        <p className="text-sm font-semibold text-base-content mb-1">
          Base URL: <code className="font-mono">{BASE}</code>
        </p>
        <p className="text-sm text-base-content/70">
          All endpoints except <code className="text-xs bg-base-200 px-1 rounded">/auth/register</code> and{' '}
          <code className="text-xs bg-base-200 px-1 rounded">/auth/login</code> require:
        </p>
        <pre className="bg-base-200 rounded mt-2 p-2 text-xs font-mono">Authorization: Bearer &lt;your-jwt-token&gt;</pre>
      </div>

      <Callout type="info">
        Tokens are issued at registration and login. Store your token securely — the app stores
        it in <code>localStorage</code>. Tokens cannot be revoked server-side; they expire after 30 days.
      </Callout>

      <div className="mt-8 space-y-1">
        <ApiEndpoint
          method="POST"
          path={`${BASE}/auth/register`}
          auth={false}
          description="Create a new user account. Returns a JWT token valid for 30 days along with the created user profile."
          requestBody={`{
  "email":    "you@example.com",   // required
  "password": "minlength8"         // required, minimum 8 characters
}`}
          response={`{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id":        "clxyz123...",
      "email":     "you@example.com",
      "createdAt": "2026-06-03T12:00:00.000Z"
    }
  }
}`}
          curl={`curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"securepass1"}' \\
  ${BASE}/auth/register`}
        />

        <ApiEndpoint
          method="POST"
          path={`${BASE}/auth/login`}
          auth={false}
          description="Authenticate with email and password. Returns a fresh JWT token. Use this to re-authenticate after your token expires."
          requestBody={`{
  "email":    "you@example.com",
  "password": "yourpassword"
}`}
          response={`{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id":        "clxyz123...",
      "email":     "you@example.com",
      "createdAt": "2026-06-03T12:00:00.000Z"
    }
  }
}`}
          curl={`curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"yourpassword"}' \\
  ${BASE}/auth/login`}
        />

        <ApiEndpoint
          method="GET"
          path={`${BASE}/auth/me`}
          description="Return the full profile of the currently authenticated user. Useful for verifying token validity and fetching the user ID."
          response={`{
  "data": {
    "id":        "clxyz123...",
    "email":     "you@example.com",
    "createdAt": "2026-06-03T12:00:00.000Z"
  }
}`}
          curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/auth/me`}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Error Responses
        </h2>
        <p className="text-sm text-base-content/70 mb-3">
          Authentication errors return standard HTTP status codes with a JSON error body:
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Status</th>
                <th>Cause</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="text-xs font-mono">400 Bad Request</code></td>
                <td className="text-sm text-base-content/70">Missing required fields or password shorter than 8 characters</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">401 Unauthorized</code></td>
                <td className="text-sm text-base-content/70">Invalid credentials on login, or missing/expired token on protected endpoints</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">409 Conflict</code></td>
                <td className="text-sm text-base-content/70">Email address already registered</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
