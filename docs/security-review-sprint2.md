# تقرير المراجعة الأمنية — Sprint 2

**النطاق:** Task Engine، Approval Engine، Shift Management، Stations/Tanks، Inspections، Fuel Requests، بالإضافة لمراجعة سريعة على Roles-Permissions وMessaging من المرحلة السابقة.

**المنهجية:** فحص يدوي لكل استدعاء `this.prisma.*` في كل خدمة من الخدمات أعلاه، مع التحقق من أن كل `where` يتضمن `companyId` (أو مسار علاقة يؤدي إليه)، أو أن الـ id المستخدم في `update`/`delete` تم التحقق من ملكيته مسبقًا عبر استعلام آخر مُقيَّد بـ tenant (نمط find-then-update).

---

## النتائج

### 🔴 ثغرة حقيقية واحدة — تم إصلاحها

**`ShiftManagementService.openShiftLog()`**
كان `dto.stationId` (قادم من الـ Frontend) يُستخدم مباشرة عند إنشاء `ShiftLog` دون التحقق من انتمائه لنفس الشركة. عامل من الشركة A كان يستطيع نظريًا ربط سجل ورديته بمحطة تابعة لشركة B.

**الإصلاح:** إضافة `station.findFirst({ where: { id: dto.stationId, companyId } })` قبل الإنشاء، مع رمي `NotFoundException` إن لم تنتمِ المحطة لنفس الشركة.
**الاختبار:** `test/unit/shift-management/shift-management.service.spec.ts` — يتحقق من الرفض ومن أن الاستعلام فعليًا يتضمن `companyId` في الـ `where`.

### 🟡 تحصين إضافي (Defense in Depth) — لم تكن ثغرة فعلية لكن تم تشديدها

**`MessagesService.markRead()`**
كان `upToMessageId` (قادم من الفرونت إند) يُستخدم لجلب `createdAt` عبر `findUnique({ where: { id } })` دون التحقق من انتمائه لنفس المحادثة. **لم يكن هناك تسريب بيانات فعلي** لأن التحديث اللاحق (`updateMany`) يبقى مقيّدًا بـ `conversationId` المُتحقَّق منه مسبقًا عبر `assertMembership()` — لكن تم تشديدها بحيث يُرفض الطلب بالكامل إن لم ينتمِ `upToMessageId` لنفس المحادثة، لإغلاق أي احتمال منطقي غير متوقع مستقبلًا.

**`RolesPermissionsService.getUserPermissionCodes()`**
دالة مساعدة عامة (Helper) غير مُستخدَمة حاليًا من أي Controller، لكنها ستُستخدَم من وحدات مستقبلية لحساب صلاحيات مستخدم. كانت تقبل `userId` فقط دون `companyId`. تم تعديلها لتطلب `companyId` وتتحقق من انتماء المستخدم للشركة قبل حساب صلاحياته — تحصين استباقي قبل أن تصبح نقطة ضعف فعلية.

---

## نقاط تم التحقق منها وتبيّن أنها آمنة فعليًا (وليس افتراضًا)

| الموضع | آلية الحماية |
|---|---|
| `ApprovalEngineService.act()` — تحديث `Approval` بـ `where: {id}` فقط | الـ `id` تم التحقق من ملكيته مسبقًا عبر `findOne(companyId, approvalId)` في بداية الدالة (نمط find-then-update) |
| `ApprovalEngineService` — التحقق من دور المستخدم عبر `userRole.findUnique` بدون `companyId` مباشرة في نفس الاستعلام | آمن عبر "سلسلة ثقة": الـ `userId` تم التحقق من انتمائه للشركة قبلها، والـ `roleId` مضمون الانتماء لنفس الشركة لأن `createFlow()` يتحقق من كل الأدوار المستخدمة في الخطوات وقت إنشاء الـ Flow |
| `FuelRequestsService.create()` — قبول `dto.approvalFlowId` اختياري من العميل دون تحقق مباشر في هذه الدالة | **دفاع متعدد الطبقات**: `ApprovalEngineService.startApproval()` نفسه يستدعي `findFlow(companyId, flowId)` المُقيَّد بـ tenant، فيرفض تلقائيًا أي `flowId` من شركة أخرى حتى لو مرّرته هذه الخدمة دون تحقق مسبق |
| `TaskEngineService.addAttachmentToResponse()` | مُقيَّد عبر علاقة متداخلة: `taskResponse.findFirst({ where: { id, task: { companyId } } })` |
| `StationsService.updateTankLevel()` | مُقيَّد عبر علاقة متداخلة: `tank.findFirst({ where: { id, station: { companyId } } })` |
| جميع الـ Controllers الجديدة | لا يوجد أي استخدام متبقٍّ لـ `@Param('companyId')`؛ الكل يستخدم `@TenantId()` المُشتق من الـ JWT حصريًا (تم التحقق عبر `grep` شامل على `src/modules/`) |

---

## التحقق الفعلي بعد كل إصلاح
- ✅ **46/46** اختبار وحدة ناجح (بعد إضافة اختبار الثغرة المُصلَحة)
- ✅ **0** أخطاء TypeScript على كامل شجرة الكود (`tsc --noEmit`)
- ✅ إقلاع كامل لحاوية الـ DI (كل ~20 Module) بنجاح

## توصية
لا توجد ثغرات معلّقة تمنع اعتماد Sprint 2. الثغرة الوحيدة المكتشفة كانت محدودة الأثر (تتطلب أن يكون المهاجم عاملًا مُصادقًا بالفعل داخل شركته الخاصة) وتم إصلاحها واختبارها.
