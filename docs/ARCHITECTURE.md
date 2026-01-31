# SQLForge - Arquitectura del Sistema

## Visión General

SQLForge es un gestor de bases de datos SQL multiplataforma construido con Tauri + React, 
siguiendo Clean Architecture y Hexagonal Architecture para máxima mantenibilidad y extensibilidad.

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         React + TypeScript + TailwindCSS                    ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    ││
│  │  │  Connection  │  │   Schema     │  │    Query     │  │   Results    │    ││
│  │  │   Manager    │  │   Explorer   │  │    Editor    │  │    Table     │    ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    ││
│  │                              │                                               ││
│  │                    ┌─────────▼─────────┐                                    ││
│  │                    │   Zustand Store   │                                    ││
│  │                    │  (Global State)   │                                    ││
│  │                    └─────────┬─────────┘                                    ││
│  └──────────────────────────────┼──────────────────────────────────────────────┘│
│                                 │                                                │
│                    ┌────────────▼────────────┐                                  │
│                    │     Tauri Commands      │                                  │
│                    │    (IPC Bridge)         │                                  │
│                    └────────────┬────────────┘                                  │
└─────────────────────────────────┼───────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────────────┐
│                    RUST BACKEND │(Tauri)                                        │
│                    ┌────────────▼────────────┐                                  │
│                    │    Command Handlers     │                                  │
│                    └────────────┬────────────┘                                  │
│                                 │                                                │
│  ┌──────────────────────────────┼──────────────────────────────────────────────┐│
│  │                   APPLICATION LAYER                                         ││
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          ││
│  │  │  ConnectionUseCase│  │  QueryUseCase   │  │  SchemaUseCase   │          ││
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          ││
│  │           │                     │                     │                     ││
│  │           └─────────────────────┼─────────────────────┘                     ││
│  │                                 │                                            ││
│  └─────────────────────────────────┼────────────────────────────────────────────┘│
│                                    │                                             │
│  ┌─────────────────────────────────┼────────────────────────────────────────────┐│
│  │                      DOMAIN LAYER                                            ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     ││
│  │  │  Connection  │  │ QueryResult  │  │ TableSchema  │  │   Database   │     ││
│  │  │   Entity     │  │   Entity     │  │   Entity     │  │    Entity    │     ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     ││
│  │                                                                              ││
│  │  ┌───────────────────────────── PORTS ─────────────────────────────────┐    ││
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    ││
│  │  │  │   SqlDriver     │  │ConnectionRepo   │  │  QueryHistory   │      │    ││
│  │  │  │   (trait)       │  │   (trait)       │  │    (trait)      │      │    ││
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │    ││
│  │  └─────────────────────────────────────────────────────────────────────┘    ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                    │                                             │
│  ┌─────────────────────────────────┼────────────────────────────────────────────┐│
│  │                   INFRASTRUCTURE LAYER                                       ││
│  │  ┌───────────────────────── ADAPTERS ──────────────────────────────────┐    ││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    ││
│  │  │  │  PostgreSQL │  │    MySQL    │  │   SQLite    │                  │    ││
│  │  │  │   Driver    │  │   Driver    │  │   Driver    │                  │    ││
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    ││
│  │  └─────────────────────────────────────────────────────────────────────┘    ││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐    ││
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    ││
│  │  │  │   Keychain      │  │  FileStorage    │  │  EventBus       │      │    ││
│  │  │  │   Repository    │  │  Repository     │  │  Implementation │      │    ││
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │    ││
│  │  └─────────────────────────────────────────────────────────────────────┘    ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                      PLUGIN SYSTEM (Extension Points)                        ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              ││
│  │  │  UI Plugins     │  │ Analysis Plugins│  │ Export Plugins  │              ││
│  │  │  (React)        │  │ (Rust/WASM)     │  │ (Rust)          │              ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Patrones de Diseño Implementados

### 1. Repository Pattern
- `ConnectionRepository`: Gestión de conexiones guardadas
- `QueryHistoryRepository`: Historial de queries ejecutadas
- Abstrae el almacenamiento de la lógica de negocio

### 2. Factory Pattern
- `DriverFactory`: Crea instancias de drivers SQL según el tipo de motor
- Permite agregar nuevos motores sin modificar código existente

### 3. Adapter Pattern
- Cada driver SQL implementa `SqlDriver` trait
- Normaliza las diferencias entre dialectos SQL
- Unifica el formato de resultados

### 4. Command Pattern
- `QueryCommand`: Encapsula ejecución de queries
- Permite undo/redo, logging y auditoría
- Facilita el historial de operaciones

### 5. Observer / Event Bus
- `EventBus`: Comunicación desacoplada entre componentes
- Eventos: ConnectionChanged, QueryExecuted, SchemaRefreshed
- Permite plugins reactivos

### 6. Strategy Pattern
- `PaginationStrategy`: Diferentes estrategias de paginación por motor
- `ExecutionStrategy`: Ejecución síncrona vs streaming

## Flujo de Datos

```
User Action → React Component → Zustand Action → Tauri Command
                                                       ↓
                                              Command Handler
                                                       ↓
                                                Use Case
                                                       ↓
                                              Domain Logic
                                                       ↓
                                              Port (trait)
                                                       ↓
                                              Adapter (impl)
                                                       ↓
                                              Database
```

## Seguridad

1. **Credenciales**: Almacenadas en OS Keychain (keyring crate)
2. **Conexiones**: Solo metadatos en archivo local, passwords en keychain
3. **IPC**: Validación de todos los comandos Tauri
4. **SQL Injection**: Queries parametrizadas obligatorias para operaciones internas

## Escalabilidad y Monetización

### Tier Free
- 3 conexiones simultáneas
- Funcionalidades básicas
- Sin plugins

### Tier Pro (futuro)
- Conexiones ilimitadas
- Plugins premium
- Sincronización cloud
- Colaboración en tiempo real

### Tier Enterprise (futuro)
- SSO/SAML
- Audit logs
- Role-based access
- On-premise deployment
