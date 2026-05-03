<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Services\PharmacyPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionCatalogController extends Controller
{
    public function plans(Request $request, PharmacyPlanService $plans): JsonResponse
    {
        $pharmacy = null;
        $user = $request->user();
        if ($user !== null && ! empty($user->pharmacy_id)) {
            $pharmacy = Pharmacy::query()->find((int) $user->pharmacy_id);
        }

        $catalog = [];
        foreach (PharmacyPlanService::PLANS as $pk) {
            $d = $plans->definition($pk);
            $row = [
                'key' => $pk,
                'label' => $d['label'] ?? $pk,
                'tagline' => $d['tagline'] ?? '',
                'highlights' => $d['highlights'] ?? [],
                'billing' => $d['billing'] ?? null,
                'limits' => $d['limits'] ?? [],
            ];
            $catalog[] = $plans->applyCatalogRowBillingForPharmacy($row, $pharmacy);
        }

        $wa = (string) config('subscription.whatsapp_e164', '');
        $wa = preg_replace('/\D+/', '', $wa);

        return response()->json([
            'plans' => $catalog,
            'whatsapp_e164' => $wa !== '' ? $wa : null,
        ]);
    }
}
