<p align="center">
  <img src="https://raw.githubusercontent.com/skalfa-framework/skalfa/main/logo/logo-skalfa-full.png" alt="Skalfa Logo" width="300" />
</p>

# @skalfa/skalfa-cli

> Command Line Interface tool for scaffolding Skalfa projects, managing extensions, and ejecting core utilities.

---

## About this Package

This package is part of the **Skalfa Framework**, a premium development ecosystem designed to build high-performance, modular web applications and APIs.

---

## Documentation

See the usage documentation at [Documentation](https://skalfa.sejedigital.com).

---

## Installation

You can install this command line tool globally using your preferred package manager:

```bash
# Using npm (Global)
npm install -g @skalfa/skalfa-cli

# Using bun (Global)
bun install -g @skalfa/skalfa-cli
```

---

## Command Line Interface (CLI) Guide

This package provides the core `skalfa` developer CLI. The following commands are available:

### 🚀 Scaffolding Commands
* **`skalfa create-api <name>`**: Scaffolds a new high-performance backend API project powered by Elysia, Bun, and modular utility extensions. It prompts sequentially for optional databases, queues, caches, and real-time sockets.
* **`skalfa create-app <name>`**: Scaffolds a new modern Next.js frontend application with pre-configured templates, styles, PWA integrations, and Tauri mobile/desktop wrappers.

### 🔌 Extension Commands
* **`skalfa add <extension-name>`**: Automatically installs and configures an optional extension in the current project root. It is project-aware:
  * In a backend project, it adds utilities like `redis`, `queue`, `cache`, `cron`, `da`, `socket`, or `orm`.
  * In a frontend project, it adds extensions like `idb`, `socket`, `document`, `pwa`, `tauri-desktop`, or `tauri-mobile`.

### 🎛️ Ejection Commands
* **`skalfa pick <utility-name>`**: Ejects a core utility from the compiled core engine directly into your local `utils/` folder, allowing full local customization while maintaining compatibility.

---

## Pre-installed Dependencies

The following key dependencies are packaged and managed within this project:

| Dependency | Scope | Version |
| :--- | :--- | :--- |
| `commander` | runtime | `^12.1.0` |
| `@types/node` | development | `^26.0.0` |
| `typescript` | development | `^6.0.3` |

---

## License

This package is licensed under the **MIT License**. For full license text, see the [LICENSE](LICENSE) file.
