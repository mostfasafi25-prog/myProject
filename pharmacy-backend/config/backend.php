<?php

return [
    /*
    | اسم المستخدم وكلمة مرور لوحة الويب الخلفية (مسارات /backend/*).
    | اضبطهما في .env ولا ترفعهما لـ Git.
    */
    'web_username' => env('BACKEND_WEB_USERNAME', 'admin'),
    'web_password' => env('BACKEND_WEB_PASSWORD', ''),
];
