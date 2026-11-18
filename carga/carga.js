import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:3000';

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURACAO || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const r = http.get(`${BASE}/api/products`);
  check(r, {
    'HTTP 200': (x) => x.status === 200,
    'lista nao vazia': (x) => {
      try {
        const d = x.json();
        return Array.isArray(d) && d.length > 0;
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const linha = [
    `VUs=${__ENV.VUS || 5}`,
    `duracao=${__ENV.DURACAO || '30s'}`,
    `p95=${m.http_req_duration.values['p(95)'].toFixed(1)}ms`,
    `media=${m.http_req_duration.values.avg.toFixed(1)}ms`,
    `max=${m.http_req_duration.values.max.toFixed(1)}ms`,
    `vazao=${m.http_reqs.values.rate.toFixed(2)}req/s`,
    `falhas=${(m.http_req_failed.values.rate * 100).toFixed(2)}%`,
    `checks=${m.checks.values.passes}/${m.checks.values.passes + m.checks.values.fails}`,
  ].join('  ');
  return {
    [__ENV.SAIDA || 'resultado-carga.json']: JSON.stringify(data, null, 1),
    stdout: '\n' + linha + '\n',
  };
}
