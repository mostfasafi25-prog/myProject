<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Models\StaffActivity;
use App\Services\PharmacyTenantDeleteService;
use App\Support\BackendWebScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Throwable;

class BackendPharmacyController extends Controller
{
    public function update(Request $request, Pharmacy $pharmacy)
    {
        $sid = BackendWebScope::id();
        if ($sid !== null && (int) $pharmacy->id !== $sid) {
            abort(404);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $before = $pharmacy->name;
        $pharmacy->name = trim($data['name']);
        $pharmacy->save();

        $this->logActivity($pharmacy->id, $before, $pharmacy->name);

        return redirect()
            ->back()
            ->with('ok', 'تم حفظ اسم الصيدلية.');
    }

    public function destroy(Pharmacy $pharmacy, PharmacyTenantDeleteService $tenantDelete)
    {
        if (BackendWebScope::active()) {
            return redirect()
                ->route('backend.pharmacies.show', BackendWebScope::id())
                ->with('error', 'لا يمكن حذف صيدلية أثناء عرض صيدلية واحدة. اضغط «عرض كل الصيدليات» ثم احذف من لوحة التحكم.');
        }

        $id = (int) $pharmacy->id;

        try {
            $name = $tenantDelete->deleteTenant($id);
        } catch (Throwable $e) {
            return redirect()
                ->route('backend.dashboard')
                ->with('error', $e->getMessage());
        }

        if (BackendWebScope::id() === $id) {
            BackendWebScope::clear();
        }

        return redirect()
            ->route('backend.dashboard')
            ->with('ok', 'تم حذف الصيدلية «'.$name.'» وجميع مستخدميها وبياناتها (طلبات، مشتريات، مخزون، خزنة، إشعارات، إلخ).');
    }

    private function logActivity(int $pharmacyId, string $before, string $after): void
    {
        try {
            if (! Schema::hasTable('staff_activities')) {
                return;
            }
            StaffActivity::withoutGlobalScopes()->create([
                'pharmacy_id' => $pharmacyId,
                'user_id' => null,
                'username' => 'backend_web',
                'role' => 'system',
                'action_type' => 'pharmacy_update_web',
                'entity_type' => 'pharmacy',
                'entity_id' => (string) $pharmacyId,
                'description' => 'تحديث اسم الصيدلية من لوحة الويب',
                'meta' => [
                    'source' => 'backend_web_panel',
                    'name_before' => $before,
                    'name_after' => $after,
                ],
            ]);
        } catch (\Throwable) {
        }
    }
}
