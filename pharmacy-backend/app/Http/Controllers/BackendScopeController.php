<?php

namespace App\Http\Controllers;

use App\Support\BackendWebScope;
use Illuminate\Http\Request;

class BackendScopeController extends Controller
{
    public function clear(Request $request)
    {
        BackendWebScope::clear();

        return redirect()
            ->route('backend.dashboard')
            ->with('ok', 'تم الخروج من عرض صيدلية واحدة — يظهر الآن كل الصيدليات.');
    }
}
