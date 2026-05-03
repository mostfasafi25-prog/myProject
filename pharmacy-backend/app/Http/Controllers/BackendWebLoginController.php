<?php

namespace App\Http\Controllers;

use App\Support\BackendWebScope;
use Illuminate\Http\Request;

class BackendWebLoginController extends Controller
{
    public function showLoginForm()
    {
        if (session('backend_web_ok') && (string) config('backend.web_password', '') !== '') {
            return redirect()->route('backend.dashboard');
        }

        if (config('backend.web_password') === '') {
            return view('backend.login', [
                'disabled' => true,
                'message' => 'لوحة الويب معطّلة: عرّف BACKEND_WEB_USERNAME و BACKEND_WEB_PASSWORD في ملف .env ثم أعد تحميل الصفحة.',
            ]);
        }

        return view('backend.login', ['disabled' => false, 'message' => null]);
    }

    public function login(Request $request)
    {
        $expectedPass = (string) config('backend.web_password', '');
        if ($expectedPass === '') {
            return back()->withErrors(['login' => 'لم تُضبط بيانات الدخول في الإعدادات.']);
        }

        $request->validate([
            'username' => 'required|string|max:255',
            'password' => 'required|string',
        ]);

        $expectedUser = (string) config('backend.web_username', 'admin');
        $userIn = trim((string) $request->input('username'));
        $passIn = (string) $request->input('password');

        $userOk = hash_equals($expectedUser, $userIn);
        $passOk = hash_equals($expectedPass, $passIn);

        if (!$userOk || !$passOk) {
            return back()
                ->withErrors(['login' => 'اسم المستخدم أو كلمة المرور غير صحيحة.'])
                ->withInput($request->only('username'));
        }

        $request->session()->put('backend_web_ok', true);

        return redirect()->route('backend.dashboard');
    }

    public function logout(Request $request)
    {
        BackendWebScope::clear();
        $request->session()->forget('backend_web_ok');

        return redirect()->route('backend.login')->with('ok', 'تم تسجيل الخروج.');
    }
}
