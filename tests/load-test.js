import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Aquecimento: 20 usuários
    { duration: '30s', target: 50 },  // Carga constante: 50 usuários
    { duration: '10s', target: 0 },   // Resfriamento
  ],
  thresholds: {
    // Alerta preditivo do Degrau 4 do teste_k6: p(95) < 1000ms
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],   // Menos de 1% de falhas
  },
};

const BASE_URL = 'https://calculadora-perfecta-print.onrender.com';

export default function () {
  // 1. Carregamento da página inicial da Calculadora (SPA)
  const resHome = http.get(`${BASE_URL}/`);
  check(resHome, {
    'status home é 200': (r) => r.status === 200,
    'tempo home < 500ms': (r) => r.timings.duration < 500,
  });

  // 2. Consulta de health / monitoramento ativo
  const resHealth = http.get(`${BASE_URL}/api/healthz`);
  check(resHealth, {
    'status healthz é 200': (r) => r.status === 200,
    'status ok no json': (r) => r.body.includes('ok'),
  });

  sleep(1);
}
