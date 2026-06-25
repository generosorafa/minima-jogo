# Mínima

Jogo de cartas e memória em que vence quem acumular menos pontos.

## Beta

Versão atual: `0.9.0-beta.1`

Site: <https://minima-jogo.web.app>

## Balanceamento

Os perfis dos bots são validados por simulações reproduzíveis de partidas completas.
O relatório da versão está em
[`reports/balance-0.7.1-beta.1.md`](reports/balance-0.7.1-beta.1.md).

```bash
node tests/simulation.test.mjs
node tools/simulate-balance.mjs --matches=5000 --seed=20260625
```

## Feedback

Sons curtos e vibração opcional acompanham compras, trocas, descartes e resultados.
A preferência pode ser alterada no menu e fica salva no navegador.

```bash
node tests/feedback.test.mjs
```

## Cartas

As cartas usam um atlas WebP otimizado a partir do pacote de moxica. Os
arquivos originais não são redistribuídos. Consulte
[`ASSET_LICENSES.md`](ASSET_LICENSES.md).

```bash
python tools/build-card-atlas.py caminho/para/Cards public/assets/cards
node tests/cardArt.test.mjs
```

## Publicação

O projeto é estático e usa Firebase Hosting.

```bash
firebase deploy --only hosting
```
