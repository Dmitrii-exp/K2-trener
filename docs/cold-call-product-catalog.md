# Product reference for cold calls

The server bundles 1,545 public catalogue offers from the reviewed `SaleTrener_catalog.json` snapshot of 26 October 2026. No user data or credentials are included. The compact generated source is `_shared/product-catalog-data.ts`.

Only `gpt-live-session` uses this reference. `buildProductContext` filters by an explicit tyre size in the existing client facts/scenario/objective and ranks brand/model terms. It supplies at most 32 offers and 11,000 characters of JSON, prioritising both K2 and competitors. Without a size it supplies a diverse reference, normally truck tyres. The same persona and facts produce the same selection on reconnect.

This is a selected reference at call setup, not a live catalogue search during the conversation. To focus a call, put the size, brand or model in the existing facts field, for example `Нужно 40 шин 315/70 R22.5 RoadX`. A later spoken size/model may be outside the selection; the client must ask for clarification rather than invent a price. Unsupported sizes produce no offers. External sites are not fetched during a call.

The instructions distinguish K2 from competitors and describe prices as historical public prices per tyre. Availability, VAT, delivery, negotiated prices, mileage, guarantees and interchangeability are not inferred. Restored tyres are explicitly marked where the original offer says so. Catalogue facts do not force a buyer's need, supplier, budget or objection. The existing cc2 behaviour remains unchanged.

No database, scoring, achievements, authorisation, voice, model, transport or frontend changes. Existing calls continue with their original context; the new reference applies to new sessions and reconnects.

Verification: product-context tests cover all five sizes, own/competitor references, source price integrity, missing sizes, bounded prompt, stable reconnect and attempted price injection. The existing handler test captures the provider payload with a mocked provider; voice runtime and access guard tests cover their unchanged boundaries. No paid audio call is performed by these tests.

Rollback: restore the previous `gpt-live-session/index.ts` (parent commit), redeploy with its original shared behavior/access modules. The bundled catalogue modules can remain unused. No data rollback is needed.
