# QueryX

Professional SQL Database Manager built with Tauri + React + Rust.

## Features

- 🔌 Multi-engine support: PostgreSQL, MySQL, SQLite
- 🎨 Modern dark UI with TailwindCSS
- ⚡ High performance Rust backend
- 🔐 Secure credential storage (OS Keychain)
- 📝 Monaco Editor with SQL syntax highlighting & autocompletion
- 📊 Paginated results with type-aware formatting
- 🔍 Schema explorer with table details
- 📜 Query history with search
- 🧩 Plugin-ready architecture
- 🎯 **Visual Query Builder** - Construct SELECT queries without writing SQL
- ⚡ **Command Palette (Ctrl+P)** - Fast fuzzy search for tables and views

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  (Components → Zustand Store → Tauri API)               │
├─────────────────────────────────────────────────────────┤
│                    Tauri IPC Bridge                      │
├─────────────────────────────────────────────────────────┤
│                    Rust Backend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Application │  │   Domain    │  │Infrastructure│     │
│  │  Use Cases  │  │  Entities   │  │   Drivers   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18+
- Rust 1.70+
- Platform-specific dependencies for Tauri

### Windows
```powershell
# Install Rust
winget install Rustlang.Rust.MSVC

# Install WebView2 (usually pre-installed on Windows 10/11)
```

### macOS
```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Keyboard Shortcuts

- `Ctrl+Enter` - Execute query
- `Ctrl+P` - Open Command Palette (search tables/views)
- `Ctrl+Shift+B` - Open Visual Query Builder
- `Esc` - Close modals

## Project Structure

```
queryx/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   └── query-builder/ # Query Builder components
│   ├── domain/            # TypeScript types
│   ├── infrastructure/    # Tauri API calls
│   ├── query-builder/     # Query Builder logic
│   ├── sql-completion/    # SQL autocompletion
│   ├── hooks/             # React hooks
│   └── store/             # Zustand stores
├── src-tauri/             # Rust backend
│   └── src/
│       ├── application/   # Use cases
│       ├── commands/      # Tauri commands
│       ├── domain/        # Entities & ports
│       └── infrastructure/# Drivers & repos
└── docs/                  # Documentation
    ├── QUERY_BUILDER.md   # Query Builder & Command Palette docs
    ├── ARCHITECTURE.md    # Architecture details
    └── PLUGIN_SYSTEM.md   # Plugin system docs
```

## Design Patterns

- **Clean Architecture**: Separation of concerns across layers
- **Hexagonal Architecture**: Ports and adapters for flexibility
- **Repository Pattern**: Abstract data access
- **Factory Pattern**: Driver creation
- **Adapter Pattern**: Unified SQL dialect interface
- **Command Pattern**: Query execution
- **Observer Pattern**: Event bus for state changes

## Security

- Passwords stored in OS Keychain (never in files)
- Connection strings built at runtime
- IPC validation on all Tauri commands
- Parameterized queries for internal operations

## License

MIT
