<?php

namespace App\Http\Controllers;

use App\Services\PharmacyPlanService;
use App\Support\BackendWebScope;

class BackendPlansReferenceController extends Controller
{
    public function __invoke(PharmacyPlanService $plans)
    {
        if (BackendWebScope::active()) {
            return redirect()->route('backend.pharmacies.plan.edit', BackendWebScope::id());
        }

        $definitions = collect($plans->referenceDefinitions())
            ->except(['trial_expired'])
            ->all();

        return view('backend.plans-reference', compact('definitions'));
    }
}
