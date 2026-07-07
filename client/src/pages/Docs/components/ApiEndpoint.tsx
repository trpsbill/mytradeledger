import { useState } from 'react';

interface ParamRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ApiEndpointProps {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  auth?: boolean;
  description?: string;
  pathParams?: ParamRow[];
  queryParams?: ParamRow[];
  requestBody?: string;
  response?: string;
  curl?: string;
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  POST: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PATCH: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function ParamTable({ params }: { params: ParamRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-base-content/50">
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-base-200">
              <td><code className="text-xs font-mono">{p.name}</code></td>
              <td><span className="text-xs text-base-content/60 font-mono">{p.type}</span></td>
              <td>
                {p.required ? (
                  <span className="badge badge-xs badge-error">required</span>
                ) : (
                  <span className="badge badge-xs badge-ghost">optional</span>
                )}
              </td>
              <td className="text-base-content/70">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApiEndpoint({
  method,
  path,
  auth = true,
  description,
  pathParams,
  queryParams,
  requestBody,
  response,
  curl,
}: ApiEndpointProps) {
  const [open, setOpen] = useState(false);
  const methodStyle = METHOD_STYLES[method] ?? 'bg-base-200 text-base-content';

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden mb-3">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-base-100 hover:bg-base-200 text-left transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 ${methodStyle}`}>
          {method}
        </span>
        <code className="text-sm font-mono flex-1 text-base-content">{path}</code>
        {!auth && (
          <span className="badge badge-ghost badge-sm shrink-0">No auth</span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 shrink-0 transition-transform text-base-content/40 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-5 bg-base-50 border-t border-base-300 space-y-4 pt-4">
          {description && (
            <p className="text-sm text-base-content/80">{description}</p>
          )}

          {pathParams && pathParams.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
                Path Parameters
              </p>
              <ParamTable params={pathParams} />
            </div>
          )}

          {queryParams && queryParams.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
                Query Parameters
              </p>
              <ParamTable params={queryParams} />
            </div>
          )}

          {requestBody && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
                Request Body
              </p>
              <pre className="bg-base-200 rounded-md p-3 text-xs overflow-x-auto font-mono leading-relaxed">{requestBody}</pre>
            </div>
          )}

          {response && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
                Response
              </p>
              <pre className="bg-base-200 rounded-md p-3 text-xs overflow-x-auto font-mono leading-relaxed">{response}</pre>
            </div>
          )}

          {curl && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
                Example
              </p>
              <pre className="bg-neutral text-neutral-content rounded-md p-3 text-xs overflow-x-auto font-mono leading-relaxed">{curl}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
