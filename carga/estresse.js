import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:3000';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '20s', target: 15 },
    { duration: '20s', target: 30 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const r = http.get(`${BASE}/api/products`);
  check(r, { 'HTTP 200': (x) => x.status === 200 });
  sleep(0.5);
}

export function handleSummary(data) {
  const m = data.metrics;
  const linha = [
    'estresse 5->15->30->5->0',
    `p95=${m.http_req_duration.values['p(95)'].toFixed(1)}ms`,
    `media=${m.http_req_duration.values.avg.toFixed(1)}ms`,
    `max=${m.http_req_duration.values.max.toFixed(1)}ms`,
    `vazao=${m.http_reqs.values.rate.toFixed(2)}req/s`,
    `falhas=${(m.http_req_failed.values.rate * 100).toFixed(2)}%`,
    `checks=${m.checks.values.passes}/${m.checks.values.passes + m.checks.values.fails}`,
  ].join('  ');
  return {
    [__ENV.SAIDA || 'resultado-estresse.json']: JSON.stringify(data, null, 1),
    stdout: '\n' + linha + '\n',
  };
}
