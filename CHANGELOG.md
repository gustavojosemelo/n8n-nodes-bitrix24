# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.3] - 2025-02-27

### Added

#### 📄 Document Generator (`crm.documentgenerator.*`)
- List Templates — with filters by entity type
- Get Template
- Generate Document — from template + CRM entity, with placeholder value override
- Get Document / List Documents — with filters by entity, template
- Get Download URL — returns direct PDF URL
- Delete Document

#### 📰 News Feed
- **Blog Post (Live Feed)** — `log.blogpost.*`
  - Create, Get, Update, Delete, List posts
  - Audience (DEST), tags, pin, allow comments support
  - Add Comment / List Comments
- **CRM Activity** — `crm.activity.*`
  - Create, Get, Update, Delete, List, Complete
  - Types: Call, Email, Meeting, Task
  - Entity binding (Deal, Lead, Contact, Company)
  - Filters by user, type, completion status

#### ⚡ Raw API (like Make's "Make an API Call")
- **Execute Method** — any Bitrix24 REST method by name + JSON params
  - HTTP Method selector (POST / GET)
  - Auto-pagination (`Fetch All Pages`)
  - Raw response option (returns full API envelope)
- **Execute Batch** — multiple methods in one request
  - Cross-result references (`$result[alias]`)
  - Halt on error toggle

---

## [0.0.2] - 2025-02-27

### Added

#### 📋 CRM
- Deal — Create, Get, Update, Delete, List, Search
- Lead — Create, Get, Update, Delete, List, Search
- Contact — Create, Get, Update, Delete, List, Search (phone/email as multi-field)
- Company — Create, Get, Update, Delete, List, Search
- Dynamic `loadOptions` for Pipelines, Stages, Users, Custom Fields (UF_)
- Quick Filters + Advanced Raw JSON filter on all list methods

#### ✅ Tasks
- Task — Create, Get, Update, Delete, List, Complete
- Task Comment — Create, Get, List, Update, Delete

#### 👤 Users
- Get, Get Current, List, Search

#### 💬 Open Channels
- Message — Send (with Keyboard + Attach JSON), Get History, Delete
- Conversation — Get, List, Complete, Assign

#### 🤖 Chatbot
- Bot — Register, Unregister, List, Update
- Bot Message — Send (with Keyboard + Attach), Update, Delete

#### 📁 Drive
- File — Upload (Base64), Get, Delete, List, Get Download URL
- Folder — Create, Get, List, Delete, Rename

---

## [0.0.1] - 2025-02-27

### Added
- Initial project structure
- Credential support: Webhook mode and OAuth2 mode
- Trigger Node with `event.bind` / `event.unbind` lifecycle
- Events: CRM (Deal, Lead, Contact, Company), Tasks, Messages
- Trigger option: Include Full Object (fetches complete entity after event)
