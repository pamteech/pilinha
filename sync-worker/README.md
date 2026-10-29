# pilinha-sync (Cloudflare Worker + KV)

Guarda só um blob cifrado (AES-256-GCM, ponta a ponta) por id: `GET/PUT /v1/sync/<id>`.
O id, a chave e o token de escrita saem do código de pareamento do Mac (HKDF-SHA256) — ver
`Sources/NotchInvestCore/Sync.swift` e `mobile/src/core/sync.ts`. Limite 64 KB, 60 req/min por IP,
blob expira em 180 dias sem atualização. O primeiro PUT fixa o hash do token de escrita.

Deploy: Worker `pilinha-sync` com binding KV `SYNC` → https://pilinha-sync.pamellaks22.workers.dev
