# WorkForce Connect AI — Architecture Diagram (نهاية المرحلة الأولى، Sprint 2)

## 1. نظرة عامة على الطبقات

```mermaid
graph TB
    subgraph Clients["العملاء (Phase 1 scope: Backend فقط لهذه الطبقة)"]
        WEB["Next.js Web — قيد الإنشاء"]
        MOBILE["Flutter Mobile — قيد الإنشاء"]
    end

    subgraph API["NestJS API — /api/v1"]
        GATEWAY["Global Guards\nJwtAuthGuard → TenantGuard → RolesGuard"]

        subgraph Foundation["Foundation Modules"]
            AUTH[Auth]
            USERS[Users]
            COMPANIES[Companies]
            RBAC[Roles & Permissions]
            TEAMS[Teams]
            SUBS[Subscriptions]
            AUDIT[Audit Logs]
            LANG[Languages]
        end

        subgraph Messaging["Messaging Core"]
            CONV[Conversations]
            MSG[Messages + Attachments]
            WS["WebSocket Gateway\n(Socket.io /chat)"]
            VOICE["Voice Processing\n(STT/Translation/TTS interfaces\n— stub in Phase 1)"]
        end

        subgraph Engines["Generic Engines (sector-agnostic)"]
            TASKENG["Task Engine\n(Dynamic Forms)"]
            APPENG["Approval Engine\n(Workflow: N configurable steps)"]
        end

        subgraph Domain["Domain Modules (fuel-station — first consumer)"]
            SHIFT[Shift Management]
            STATION[Stations & Tanks]
            INSPECT[Inspections]
            FUEL[Fuel Requests]
        end
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL\nvia Prisma")]
        REDIS[("Redis\n— reserved for Phase 2 caching/queues")]
        DISK[("Local disk /uploads\n— StorageProvider interface,\nS3-ready")]
    end

    WEB -.HTTP + WS.-> GATEWAY
    MOBILE -.HTTP + WS.-> GATEWAY

    GATEWAY --> Foundation
    GATEWAY --> Messaging
    GATEWAY --> Engines
    GATEWAY --> Domain

    MSG --> WS
    MSG --> DISK
    MSG --> VOICE

    TASKENG --> APPENG
    SHIFT --> TASKENG
    INSPECT --> TASKENG
    FUEL --> APPENG
    STATION --> AUDIT

    Foundation --> PG
    Messaging --> PG
    Engines --> PG
    Domain --> PG
```

## 2. مبدأ التصميم الأساسي: الفصل بين "المحرك" و"القطاع"

```mermaid
graph LR
    subgraph Generic["طبقة عامة — لا تعرف شيئًا عن أي قطاع"]
        TE[Task Engine]
        AE[Approval Engine]
    end

    subgraph FuelSector["قطاع محطات الوقود (أول تطبيق فعلي)"]
        SH[Shift Management]
        ST[Stations/Tanks]
        IN[Inspections]
        FR[Fuel Requests]
    end

    subgraph FutureSectors["قطاعات مستقبلية (بدون أي تعديل على الطبقة العامة)"]
        FUTURE1["مصانع — Manufacturing"]
        FUTURE2["مستشفيات — Healthcare"]
        FUTURE3["إنشاءات / أمن"]
    end

    SH -->|"createTask() / submitResponse()"| TE
    IN -->|"createTask()"| TE
    FR -->|"startApproval() / act()"| AE
    TE -->|"startApproval() عند الحاجة\n(entityType='TaskResponse')"| AE

    FUTURE1 -.->|نفس النمط| TE
    FUTURE1 -.->|نفس النمط| AE
    FUTURE2 -.->|نفس النمط| TE
    FUTURE3 -.->|نفس النمط| AE

    style Generic fill:#e8f4fd
    style FuelSector fill:#fff3e0
    style FutureSectors fill:#f0f0f0,stroke-dasharray: 5 5
```

**القاعدة الصارمة المُطبَّقة فعليًا في الكود (وتم التحقق منها):**
لا يوجد أي Foreign Key من جداول `Task`/`TaskTemplate`/`Approval`/`ApprovalFlow` إلى `Station`/`Tank`/`FuelRequest`. الربط الوحيد هو:
- من جهة القطاع → المحرك: استدعاء دالة (`taskEngine.createTask()`, `approvalEngine.startApproval()`)
- من جهة المحرك → القطاع: حقل نصي حر `entityType` + `entityId` (polymorphic)، **وليس** علاقة قاعدة بيانات مباشرة

هذا يعني أن حذف وحدة `FuelRequestsModule` بالكامل لا يكسر Task Engine أو Approval Engine إطلاقًا.

## 3. طبقة الأمان (مُطبَّقة على كل طلب HTTP)

```mermaid
sequenceDiagram
    participant C as Client
    participant G1 as JwtAuthGuard
    participant G2 as TenantGuard
    participant G3 as RolesGuard
    participant Dec as @TenantId() decorator
    participant Svc as Service Layer
    participant DB as PostgreSQL

    C->>G1: HTTP Request + Bearer JWT
    G1->>G1: يتحقق من التوقيع والصلاحية
    G1->>G2: request.user = {sub, companyId, systemRole}
    G2->>G2: يقارن :companyId في الـ URL بـ user.companyId
    Note over G2: يرفض فورًا إن لم يتطابقا (إلا لـ SUPER_ADMIN)
    G2->>G3: request.tenantId = user.companyId (من JWT حصريًا)
    G3->>G3: يتحقق من @Roles() المطلوبة على الـ Route
    G3->>Dec: Controller method يُستدعى
    Dec->>Svc: companyId مُشتق من request.tenantId (وليس params)
    Svc->>DB: كل Query يتضمن companyId في WHERE
    DB-->>Svc: بيانات هذه الشركة فقط
    Svc-->>C: Response
```

## 4. الوحدات المُنفَّذة حاليًا (خريطة كاملة)

| الطبقة | الوحدة | الحالة |
|---|---|---|
| Foundation | Auth (JWT + Refresh Rotation) | ✅ مكتمل + مُختبَر |
| Foundation | Companies (Multi-Tenant + Dashboard) | ✅ مكتمل |
| Foundation | Users | ✅ مكتمل + مُختبَر (tenant isolation) |
| Foundation | Roles & Permissions (RBAC مخصص لكل شركة) | ✅ مكتمل |
| Foundation | Teams | ✅ مكتمل |
| Foundation | Subscriptions | ✅ مكتمل |
| Foundation | Audit Logs | ✅ مكتمل |
| Foundation | Languages | ✅ مكتمل |
| Messaging | Conversations (Direct/Group/Team) | ✅ مكتمل |
| Messaging | Messages (نص/صوت/مرفقات/حالات) | ✅ مكتمل |
| Messaging | WebSocket Gateway | ✅ مكتمل |
| Messaging | Voice Processing (STT/Translation/TTS) | ✅ Interfaces جاهزة، Stub فقط (Phase 2 لاحقًا) |
| Engines | Task Engine (Dynamic Forms) | ✅ مكتمل + مُختبَر |
| Engines | Approval Engine (Workflow) | ✅ مكتمل + مُختبَر |
| Domain | Shift Management | ✅ مكتمل + مُختبَر |
| Domain | Stations & Tanks | ✅ مكتمل |
| Domain | Inspections | ✅ مكتمل |
| Domain | Fuel Requests | ✅ مكتمل + مُختبَر |

**إجمالي:** 18 Module، 46 اختبار وحدة ناجح، 0 أخطاء TypeScript، DI Container يُقلَع بالكامل.

## 5. ما تبقّى لإكمال المرحلة الأولى 100%
- Company Dashboard (تم بناء الـ API؛ الواجهة Next.js لم تُبنَ بعد)
- Worker Mobile App (Flutter) — لم يُبدأ بعد فعليًا (كان مخططًا في الجولة الأولى، أُجِّل لصالح تعميق الـ Backend حسب توجيهك)
- توثيق API الكامل (Swagger موجود وحي على `/api/docs`؛ يحتاج تصدير كملف ثابت للتوثيق)
- تعليمات Setup/Deployment الكاملة كملف منفصل
