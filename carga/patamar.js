import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:3000';

export const options = {
  vus: Number(__ENV.VUS || 60),
  duration: __ENV.DURACAO || '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const r = http.get(`${BASE}/api/products`);
  check(r, { 'HTTP 200': (x) => x.status === 200 });
  sleep(0.2);
}

export function handleSummary(data) {
  const m = data.metrics;
  const linha = [
    `patamar ${__ENV.VUS || 60} VUs`,
    `p95=${m.http_req_duration.values['p(95)'].toFixed(1)}ms`,
    `media=${m.http_req_duration.values.avg.toFixed(1)}ms`,
    `max=${m.http_req_duration.values.max.toFixed(1)}ms`,
    `vazao=${m.http_reqs.values.rate.toFixed(2)}req/s`,
    `falhas=${(m.http_req_failed.values.rate * 100).toFixed(2)}%`,
    `checks=${m.checks.values.passes}/${m.checks.values.passes + m.checks.values.fails}`,
  ].join('  ');
  return {
    [__ENV.SAIDA || `resultado-patamar-${__ENV.VUS || 60}.json`]: JSON.stringify(data, null, 1),
    stdout: '\n' + linha + '\n',
  };
}
