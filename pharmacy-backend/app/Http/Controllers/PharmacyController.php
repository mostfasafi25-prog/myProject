<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Services\PharmacyPlanService;
use Carbon\Carbon;
use Illuminate\Support\Facades\App;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PharmacyController extends Controller
{
    /** @var array<string, array{code:string,label:string}> */
    private const CURRENCY_PRESETS = [
        'ILS' => ['code' => 'ILS', 'label' => 'شيكل'],
        'EGP' => ['code' => 'EGP', 'label' => 'جنيه'],
        'USD' => ['code' => 'USD', 'label' => 'دولار'],
        'AED' => ['code' => 'AED', 'label' => 'درهم'],
    ];

    public function index(Request $request, PharmacyPlanService $planService)
    {
        if ($request->user()?->role !== 'super_admin') {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }

        $rows = Pharmacy::query()->orderBy('id')->get();
        $data = $rows->map(function (Pharmacy $p) use ($planService) {
            $snap = $planService->toApiArray($p);

            return [
                'id' => $p->id,
                'name' => $p->name,
                'currency_code' => Schema::hasColumn('pharmacies', 'currency_code') ? (string) ($p->currency_code ?? '') : null,
                'currency_label' => Schema::hasColumn('pharmacies', 'currency_label') ? (string) ($p->currency_label ?? '') : null,
                'created_at' => $p->created_at,
                'subscription_plan' => $snap['plan'],
                'subscription_effective_plan' => $snap['effective_plan'],
                'subscription_label' => $snap['label'],
                'subscription_expires_at' => $snap['expires_at'],
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function store(Request $request)
    {
        if ($request->user()?->role !== 'super_admin') {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }

        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:191',
            'currency' => ['sometimes', 'string', Rule::in(array_keys(self::CURRENCY_PRESETS))],
        ]);
        if ($v->fails()) {
            return response()->json(['success' => false, 'errors' => $v->errors()], 422);
        }

        $curKey = strtoupper((string) $request->input('currency', 'ILS'));
        if (!isset(self::CURRENCY_PRESETS[$curKey])) {
            $curKey = 'ILS';
        }
        $cur = self::CURRENCY_PRESETS[$curKey];

        $attrs = [
            'name' => $request->name,
            'free_trial_ends_at' => Carbon::now()->addDays(App::make(PharmacyPlanService::class)->freeTrialDaysConfig()),
        ];
        if (Schema::hasColumn('pharmacies', 'currency_code')) {
            $attrs['currency_code'] = $cur['code'];
        }
        if (Schema::hasColumn('pharmacies', 'currency_label')) {
            $attrs['currency_label'] = $cur['label'];
        }

        $p = Pharmacy::create($attrs);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الصيدلية',
            'data' => ['id' => $p->id, 'name' => $p->name],
        ], 201);
    }
}
