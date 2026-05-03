<?php

return [
    /*
    | رقم واتساب لطلبات الاشتراك (E.164 بدون +)، مثال: 972501234567
    | يُعرض في تطبيق الصيدلية لزر «اشتراك».
    */
    'whatsapp_e164' => preg_replace('/\D+/', '', (string) env('SUBSCRIPTION_WHATSAPP_E164', '')),
];
