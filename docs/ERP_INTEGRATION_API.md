# WAGateway — ERP Integration API

This document describes the HTTP APIs intended for **external ERP applications**.  
Admin portal routes (create partner, recharge wallet, submit template to Meta, etc.) require a **JWT** from `POST /auth/login` and are not listed here.

---

## Base URL

**Production (live):**

```
https://wgatewayapi.edusync.in
```

**Local development:**

```
http://localhost:5000
```

All responses are JSON. Unless noted, bodies use `Content-Type: application/json`.

---

## Authentication (ERP)

ERP systems do **not** use admin JWT. They authenticate with a **shared private API key** configured on the gateway server as `ERP_API_KEY`.

Send the key on every ERP integration request using **one** of:

| Method | Example |
|--------|---------|
| **Recommended** | Header `X-Api-Key: <your-erp-api-key>` |
| Alternative | Header `Authorization: Bearer <your-erp-api-key>` |

If the key is missing or wrong, the API returns `401 Unauthorized`.

**Portal note:** The web admin UI continues to use `Authorization: Bearer <jwt>`. The same ERP routes also accept a valid admin JWT.

---

## Partner identification

| Concept | Description |
|---------|-------------|
| **ERP Partner ID** | Your ERP’s partner/school identifier. Used in **send message** APIs. Resolved via `PartnerExternalMapping` to a gateway partner. |
| **Gateway Partner ID** | Internal ID in the `Partners` table. Used in **query** APIs (`gatewayPartnerId`). |

Ensure each ERP partner is mapped in the gateway (Partners → ERP Mapping) before sending messages.

---

## ERP integration endpoints (5 core)

### 1. List templates

Approved templates available for a gateway partner (via `PartnerTemplateMapping`).

```
GET /templates?gatewayPartnerId={id}
```

| Query | Required | Description |
|-------|----------|-------------|
| `gatewayPartnerId` | Yes* | Gateway `PartnerId`. Omit or use `all` to list every active template in the gateway. |

**Example**

```http
GET /templates?gatewayPartnerId=1
X-Api-Key: your-erp-api-key
```

**Success `200`**

```json
{
  "success": true,
  "data": [
    {
      "templateId": 12,
      "templateCode": "fee_reminder",
      "templateName": "fee_reminder_v1",
      "category": "UTILITY",
      "languageCode": "en",
      "headerText": null,
      "bodyText": "Hello {{1}}, fee due {{2}}.",
      "footerText": null,
      "metaStatus": "APPROVED",
      "variables": [
        { "VariableName": "name", "VariableOrder": 1, "SampleValue": "Ravi" }
      ]
    }
  ]
}
```

Use `templateName` (Meta name) when calling send message APIs. Template must be **APPROVED** and **mapped** to the partner.

---

### 2. Send WhatsApp message (single)

Queues one template message for delivery.

```
POST /messages/send
```

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `externalReferenceId` | string | Yes | Your unique idempotency/reference (track status later) |
| `erpPartnerId` | number/string | Yes | ERP partner id (must exist in `PartnerExternalMapping`) |
| `templateName` | string | Yes | Meta template name (from list templates) |
| `to` | string | Yes | Recipient mobile with country code, e.g. `919876543210` |
| `parameters` | object | Yes | Map of **variable name → value** (see template variables) |

**Example**

```http
POST /messages/send
X-Api-Key: your-erp-api-key
Content-Type: application/json

{
  "externalReferenceId": "INV-2026-001",
  "erpPartnerId": 101,
  "templateName": "fee_reminder_v1",
  "to": "919876543210",
  "parameters": {
    "name": "Ravi Kumar",
    "amount": "5000"
  }
}
```

**Success**

```json
{
  "success": true,
  "message": "Message queued successfully",
  "queueId": 456
}
```

**Common errors**

| Message | Cause |
|---------|--------|
| Partner mapping not found | `erpPartnerId` not mapped to gateway |
| Template not found | Wrong `templateName` |
| Template is not mapped to this partner | Map template in admin portal |
| Template is not approved | Meta status not APPROVED |

---

### 3. Send bulk messages

```
POST /messages/send-bulk
```

**Body**

| Field | Type | Required |
|-------|------|----------|
| `erpPartnerId` | number | Yes |
| `templateName` | string | Yes |
| `recipients` | array | Yes |

Each recipient:

| Field | Type | Required |
|-------|------|----------|
| `to` | string | Yes |
| `externalReferenceId` | string | Yes (unique per recipient) |
| `parameters` | object | Yes |

**Example**

```json
{
  "erpPartnerId": 101,
  "templateName": "fee_reminder_v1",
  "recipients": [
    {
      "to": "919876543210",
      "externalReferenceId": "INV-001",
      "parameters": { "name": "Ravi", "amount": "5000" }
    },
    {
      "to": "919888877766",
      "externalReferenceId": "INV-002",
      "parameters": { "name": "Priya", "amount": "3000" }
    }
  ]
}
```

**Success**

```json
{
  "success": true,
  "message": "Bulk messages queued successfully",
  "successCount": 2,
  "failedCount": 0,
  "queueIds": [457, 458]
}
```

---

### 4. Message delivery status

```
GET /messages/status/{externalReferenceId}
```

**Example**

```http
GET /messages/status/INV-2026-001
X-Api-Key: your-erp-api-key
```

**Success**

```json
{
  "success": true,
  "data": {
    "ExternalReferenceId": "INV-2026-001",
    "TemplateName": "fee_reminder_v1",
    "RecipientMobile": "919876543210",
    "QueueStatus": "COMPLETED",
    "DeliveryStatus": "delivered",
    "ReadTimestamp": null,
    "FailedReason": null,
    "SentAt": "2026-05-19T10:30:00.000Z"
  }
}
```

---

### 5. Message history

```
GET /messages/history?gatewayPartnerId={id}
```

| Query | Description |
|-------|-------------|
| `gatewayPartnerId` | Filter by gateway partner. Omit for all partners. |

**Example**

```http
GET /messages/history?gatewayPartnerId=1
X-Api-Key: your-erp-api-key
```

**Success**

```json
{
  "success": true,
  "data": [
    {
      "ExternalReferenceId": "INV-2026-001",
      "PartnerId": 1,
      "PartnerName": "Demo School",
      "PartnerCode": "DEMO01",
      "TemplateName": "fee_reminder_v1",
      "RecipientMobile": "919876543210",
      "QueueStatus": "COMPLETED",
      "DeliveryStatus": "delivered",
      "SentAt": "2026-05-19T10:30:00.000Z"
    }
  ]
}
```

---

### 6. Wallet balances (optional but exposed to ERP)

```
GET /wallet/balances?gatewayPartnerId={id}
```

| Query | Description |
|-------|-------------|
| `gatewayPartnerId` | Filter one partner; omit for all wallets |

**Example**

```http
GET /wallet/balances?gatewayPartnerId=1
X-Api-Key: your-erp-api-key
```

**Success**

```json
{
  "success": true,
  "data": [
    {
      "walletId": 3,
      "partnerId": 1,
      "partnerName": "Demo School",
      "partnerCode": "DEMO01",
      "availableBalance": 15000,
      "consumedBalance": 2500,
      "currencyCode": "INR",
      "lastRechargeAmount": 10000,
      "lastRechargeDate": "2026-05-01T00:00:00.000Z"
    }
  ],
  "totals": {
    "availableBalance": 15000,
    "consumedBalance": 2500,
    "walletCount": 1,
    "currencyCode": "INR"
  }
}
```

---

## Typical ERP flow

1. **Map partner** (admin): Create gateway partner + ERP ↔ gateway mapping.  
2. **List templates**: `GET /templates?gatewayPartnerId=…`  
3. **Check balance** (optional): `GET /wallet/balances?gatewayPartnerId=…`  
4. **Send**: `POST /messages/send` or `POST /messages/send-bulk`  
5. **Poll status**: `GET /messages/status/{externalReferenceId}`  
6. **Reporting**: `GET /messages/history?gatewayPartnerId=…`

---

## Error format

```json
{
  "success": false,
  "message": "Human-readable error",
  "error": "Optional technical detail"
}
```

HTTP status codes: `400` validation, `401` auth, `500` server/database.

---

## Server configuration

Add to `wgateway-api/.env`:

```env
ERP_API_KEY=generate-a-long-random-secret-here
```

Share this value securely with the ERP team only. Rotate if compromised.

---

## cURL quick test

```bash
export BASE=https://wgatewayapi.edusync.in
export KEY=your-erp-api-key

curl -s "$BASE/templates?gatewayPartnerId=1" -H "X-Api-Key: $KEY"

curl -s -X POST "$BASE/messages/send" \
  -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalReferenceId":"test-1","erpPartnerId":101,"templateName":"hello_world","to":"919876543210","parameters":{"name":"Test"}}'
```

---

## Changelog

| Date | Notes |
|------|--------|
| 2026-05-19 | Initial ERP integration doc; `X-Api-Key` auth on integration routes |
