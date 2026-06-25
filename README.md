# Mínima

Jogo de cartas e memória em que vence quem acumular menos pontos.

## Beta

Versão atual: `0.7.1-beta.1`

Site: <https://minima-jogo.web.app>

## Balanceamento

Os perfis dos bots são validados por simulações reproduzíveis de partidas completas.
O relatório da versão está em
[`reports/balance-0.7.1-beta.1.md`](reports/balance-0.7.1-beta.1.md).

```bash
node tests/simulation.test.mjs
node tools/simulate-balance.mjs --matches=5000 --seed=20260625
```

## Publicação

O projeto é estático e usa Firebase Hosting.

```bash
firebase deploy --only hosting
```
