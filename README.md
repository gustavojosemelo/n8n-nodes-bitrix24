<p align="center">
  <img src="https://raw.githubusercontent.com/gustavojosemelo/n8n-nodes-bitrix24/main/nodes/Bitrix24/bitrix24.svg" width="80" alt="Bitrix24" />
</p>

<h1 align="center">@gustavojosemelo/n8n-nodes-bitrix24</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@gustavojosemelo/n8n-nodes-bitrix24">
    <img src="https://img.shields.io/npm/v/@gustavojosemelo/n8n-nodes-bitrix24?color=blue&label=npm" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@gustavojosemelo/n8n-nodes-bitrix24">
    <img src="https://img.shields.io/npm/dm/@gustavojosemelo/n8n-nodes-bitrix24?color=green" alt="npm downloads" />
  </a>
  <a href="https://github.com/gustavojosemelo/n8n-nodes-bitrix24/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/gustavojosemelo/n8n-nodes-bitrix24" alt="license" />
  </a>
  <img src="https://img.shields.io/badge/n8n-community%20node-orange" alt="n8n community node" />
</p>

<p align="center">
  A full-featured n8n community node for <strong>Bitrix24</strong> — covering CRM, Tasks, Open Channels, Chatbots, Drive, Document Generator, News Feed, and a Raw API executor.
</p>

---

## ✨ Features

| Category | Resources | Operations |
|---|---|---|
| 📋 **CRM** | Deal, Lead, Contact, Company | Create · Get · Update · Delete · List · Search |
| ✅ **Tasks** | Task, Task Comment | Create · Get · Update · Delete · List · Complete |
| 👤 **Users** | User | Get · Get Current · List · Search |
| 💬 **Open Channels** | Message, Conversation | Send · History · Complete · Assign |
| 🤖 **Chatbot** | Bot, Bot Message | Register · Send · Update · Delete |
| 📁 **Drive** | File, Folder | Upload · Get · List · Delete · Rename |
| 📄 **Document Generator** | Document, Template | Generate PDF · List Templates · Download URL |
| 📰 **News Feed** | Blog Post, CRM Activity | Create · Get · Update · Delete · List · Complete |
| ⚡ **Raw API** | Any method | Execute · Batch · Auto-paginate |

### Highlights

- 🔄 **Dynamic dropdowns** — Pipelines, Stages, Users, and custom `UF_` fields loaded live from your Bitrix24
- 🔍 **Smart filters** — Quick filters (dropdowns) + Advanced raw JSON filter on all list operations
- 📦 **Auto-pagination** — Fetch all pages automatically (Bitrix24 returns max 50/page)
- ⚡ **Raw API** — Execute any Bitrix24 method directly, just like Make's "Make an API Call"
- 🔗 **Batch API** — Run multiple methods in one request with cross-result references
- 🔔 **Trigger Node** — Auto-registers webhooks on activation, cleans up on deactivation
- 🔐 **Dual auth** — Webhook URL mode (simple) and OAuth2 mode (for marketplace apps)

---

## 📦 Installation

### Via n8n Interface (recommended)

1. Go to **Settings → Community Nodes**
2. Click **Install**
3. Enter: `@gustavojosemelo/n8n-nodes-bitrix24`
4. Confirm and restart n8n

### Via npm

```bash
npm install @gustavojosemelo/n8n-nodes-bitrix24
```

### Via Docker

```bash
docker exec -it n8n npm install @gustavojosemelo/n8n-nodes-bitrix24 --prefix /home/node/.n8n/custom
docker restart n8n
```

---

## 🔐 Authentication

This node supports two authentication modes, selectable in the credential:

### Webhook Mode (recommended for personal use)

The simplest option. Uses a Bitrix24 inbound webhook URL with the token already embedded.

1. In Bitrix24, go to **Developer Resources → Other → Inbound Webhook**
2. Create a new webhook and copy the full URL
   > Example: `https://yourdomain.bitrix24.com/rest/1/abc123token/`
3. In n8n, create a **Bitrix24 API** credential
4. Select **Authentication Mode: Webhook**
5. Paste the full URL

### OAuth2 Mode (for Marketplace apps)

For registered apps in the Bitrix24 developer zone.

1. Register an app at **Bitrix24 Developer Zone → My Apps**
2. Copy the **Client ID**, **Client Secret**, and your portal **Domain**
3. In n8n, select **Authentication Mode: OAuth2** and fill in the fields

---

## 🚀 Usage

### CRM — Dynamic Fields

When creating or updating a **Deal**, **Lead**, **Contact**, or **Company**, the node automatically loads:

- **Pipeline** — dropdown with your real funnels (`crm.category.list`)
- **Stage** — dropdown filtered by the selected pipeline (`crm.dealcategory.stages`)
- **Responsible User** — dropdown with active users (`user.get`)
- **Custom Fields (UF_)** — separate section listing all `UF_*` fields with their readable labels

### List / Search — Filtering

Every list operation has two filter modes:

- **Quick Filters** — pre-built dropdowns for the most common fields
- **Advanced Filter (Raw JSON)** — pass any `FILTER` object directly to the Bitrix24 API

```json
// Advanced filter example for crm.deal.list
{
  "STAGE_ID": "WON",
  ">OPPORTUNITY": 10000,
  "ASSIGNED_BY_ID": "5"
}
```

Set **Max Results** to `0` to fetch all pages automatically.

### ⚡ Raw API — Execute any method

Select **Category: Raw API** to call any Bitrix24 REST method:

| Field | Example |
|---|---|
| Method | `crm.deal.list` |
| Parameters (JSON) | `{"filter": {"STAGE_ID": "NEW"}, "select": ["ID","TITLE"]}` |
| Fetch All Pages | Enable for list methods |

```json
// Batch example
{
  "cmd": {
    "get_deal": "crm.deal.get?id=42",
    "deal_contacts": "crm.deal.contact.items.get?id=42"
  }
}
```

Results can reference each other: `$result[get_deal][ASSIGNED_BY_ID]`

### 🔔 Trigger Node — Available Events

| Group | Event | Description |
|---|---|---|
| CRM Deal | `ONCRMDEALADD` | Deal created |
| CRM Deal | `ONCRMDEALUPDATE` | Deal updated |
| CRM Deal | `ONCRMDEALMOVE` | Deal stage changed |
| CRM Deal | `ONCRMDEALDELETION` | Deal deleted |
| CRM Lead | `ONCRMLEADADD` | Lead created |
| CRM Lead | `ONCRMLEADUPDATE` | Lead updated |
| CRM Contact | `ONCRMCONTACTADD` | Contact created |
| CRM Company | `ONCRMCOMPANYADD` | Company created |
| Tasks | `ONTASKADD` | Task created |
| Tasks | `ONTASKUPDATE` | Task updated |
| Tasks | `ONTASKCOMMENTADD` | Comment added to task |
| Messages | `ONIMBOTMESSAGEADD` | New open channel message |
| Messages | `ONOPENLINESSESSIONSTART` | New support session opened |
| Messages | `ONOPENLINESSESSIONFINISH` | Support session closed |

**Tip:** Enable **Include Full Object** to automatically fetch the complete entity (all fields including `UF_*`) after receiving the event — at the cost of one extra API call.

---

## 🏗️ Project Structure

```
nodes/Bitrix24/
├── Bitrix24.node.ts              # Main regular node
├── Bitrix24Trigger.node.ts       # Trigger node
├── GenericFunctions.ts           # HTTP helper, auth, loadOptions
├── bitrix24.svg                  # Node icon
├── credentials/
│   └── Bitrix24Api.credentials.ts
└── resources/
    ├── crm/
    │   ├── deal.ts
    │   ├── lead.ts
    │   ├── contact.ts
    │   └── company.ts
    ├── tasks/
    │   └── task.ts               # Task + Task Comment
    ├── users/
    │   └── user.ts
    ├── openChannels/
    │   └── message.ts            # Message + Conversation
    ├── chatbot/
    │   └── bot.ts                # Bot + Bot Message
    ├── drive/
    │   └── file.ts               # File + Folder
    ├── documentGenerator/
    │   └── document.ts
    ├── newsFeed/
    │   └── newsFeed.ts           # Blog Post + CRM Activity
    └── rawApi/
        └── rawApi.ts
```

---

## 🛠️ Local Development

```bash
# Clone the repo
git clone https://github.com/gustavojosemelo/n8n-nodes-bitrix24.git
cd n8n-nodes-bitrix24

# Install dependencies
npm install

# Build
npm run build

# Link for local n8n testing
cd ~/.n8n/custom
npm link n8n-nodes-bitrix24
```

---

## 📋 API Rate Limits

Bitrix24 limits **2 requests/second** by default on commercial plans. For large list operations, use **Max Results: 0** to enable automatic pagination with built-in rate control.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

[MIT](./LICENSE) © [Gustavo José Melo](https://universonext.com.br)

---

<p align="center">
  Made with ❤️ by <a href="https://universonext.com.br">Next Comunicação</a>
</p>
